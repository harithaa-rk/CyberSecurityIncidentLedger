const os = require("os");
const { exec } = require("child_process");
const SecurityLog = require("../models/SecurityLog");
const { processSecurityLog } = require("../services/logIngestionService");
const { parseSecurityLog } = require("../utils/logParser");
const {
  getLiveSecurityLogs,
  getSecurityLogStats,
  getSecurityLogDetail,
  generateSampleSecurityEvent,
} = require("../services/liveLogService");
const {
  getWindowsCollectorStatus,
  collectNewEvents,
} = require("../collectors/windowsEventCollector");

// ─────────────────────────────────────────────
// @route   GET /api/security-logs
// @desc    Get paginated security logs with filters & summary statistics (Legacy / Standard)
// @access  Protected (Admin / Analyst / Auditor / User)
// ─────────────────────────────────────────────
const getSecurityLogs = async (req, res) => {
  try {
    const page  = Math.max(1, parseInt(req.query.page, 10)  || 1);
    const limit = Math.min(100, Math.max(1, parseInt(req.query.limit, 10) || 20));
    const skip  = (page - 1) * limit;

    const { severity, source, attackType, status, search, origin, dataOrigin } = req.query;

    const filter = {};

    if (severity && severity !== "All") {
      filter.severity = severity.toUpperCase();
    }

    if (source && source !== "All") {
      filter.source = new RegExp(`^${source}$`, "i");
    }

    if (attackType && attackType !== "All") {
      filter.attackType = new RegExp(`^${attackType}$`, "i");
    }

    if (status && status !== "All") {
      filter.status = status.toUpperCase();
    }

    const effectiveOrigin = origin || dataOrigin;
    if (effectiveOrigin && effectiveOrigin !== "All") {
      filter.dataOrigin = effectiveOrigin.toUpperCase();
    }

    if (search && search.trim()) {
      const regex = new RegExp(search.trim(), "i");
      filter.$or = [
        { incidentId: regex },
        { sourceIP: regex },
        { destinationIP: regex },
        { attackType: regex },
        { source: regex },
        { message: regex },
        { collectorHost: regex },
        { eventId: regex },
      ];
    }

    const [logs, total, totalCount, criticalCount, highCount, mediumCount, lowCount, newCount] = await Promise.all([
      SecurityLog.find(filter)
        .sort({ timestamp: -1, createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .lean(),
      SecurityLog.countDocuments(filter),
      SecurityLog.countDocuments(),
      SecurityLog.countDocuments({ severity: "CRITICAL" }),
      SecurityLog.countDocuments({ severity: "HIGH" }),
      SecurityLog.countDocuments({ severity: "MEDIUM" }),
      SecurityLog.countDocuments({ severity: "LOW" }),
      SecurityLog.countDocuments({ status: "NEW" }),
    ]);

    const Incident = require("../models/Incident");
    const logIds = logs.map(l => l._id);
    const incidents = await Incident.find({ securityLogId: { $in: logIds } }, "incidentId securityLogId").lean();
    const incMap = new Map();
    incidents.forEach(inc => {
      incMap.set(String(inc.securityLogId), inc.incidentId);
    });

    const enrichedLogs = logs.map(l => ({
      ...l,
      createdIncidentId: l.createdIncidentId || incMap.get(String(l._id)) || null,
    }));

    res.status(200).json({
      logs: enrichedLogs,
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit) || 1,
      stats: {
        total: totalCount,
        critical: criticalCount,
        high: highCount,
        medium: mediumCount,
        low: lowCount,
        newLogs: newCount,
      },
    });
  } catch (error) {
    console.error("getSecurityLogs error:", error);
    res.status(500).json({ message: "Server error fetching security logs." });
  }
};

// ─────────────────────────────────────────────
// @route   GET /api/security-logs/live
// @desc    Get real-time security logs with live monitoring filters (REAL / SAMPLE / TEST)
// @access  Protected
// ─────────────────────────────────────────────
const getLiveLogs = async (req, res) => {
  try {
    const result = await getLiveSecurityLogs(req.query);
    res.status(200).json(result);
  } catch (error) {
    console.error("getLiveLogs error:", error);
    res.status(500).json({ message: "Server error fetching live security logs." });
  }
};

// ─────────────────────────────────────────────
// @route   GET /api/security-logs/stats
// @desc    Get counts by origin (REAL, SAMPLE, TEST, UNKNOWN) & severity
// @access  Protected
// ─────────────────────────────────────────────
const getLogStats = async (req, res) => {
  try {
    const stats = await getSecurityLogStats();
    res.status(200).json(stats);
  } catch (error) {
    console.error("getLogStats error:", error);
    res.status(500).json({ message: "Server error fetching security log statistics." });
  }
};

// ─────────────────────────────────────────────
// @route   GET /api/security-logs/:id
// @desc    Get a single security log by ID or Incident ID with full rawLog details
// @access  Protected
// ─────────────────────────────────────────────
const getSecurityLogById = async (req, res) => {
  try {
    const { id } = req.params;
    const log = await getSecurityLogDetail(id);

    if (!log) {
      return res.status(404).json({ message: "Security log incident not found." });
    }

    res.status(200).json({ log });
  } catch (error) {
    console.error("getSecurityLogById error:", error);
    res.status(500).json({ message: "Server error fetching security log detail." });
  }
};

// ─────────────────────────────────────────────
// @route   POST /api/security-logs
// @desc    Manually ingest or submit a security log entry
// @access  Protected (Admin / Ingest API)
// ─────────────────────────────────────────────
const createSecurityLog = async (req, res) => {
  try {
    const { rawLog, line, dataOrigin, collectionMethod, ...structuredData } = req.body;

    let payloadToProcess;

    if (rawLog || line) {
      const parsed = parseSecurityLog(rawLog || line);
      if (!parsed) {
        return res.status(400).json({ message: "Unable to parse raw log format." });
      }
      payloadToProcess = parsed;
    } else {
      payloadToProcess = {
        ...structuredData,
        rawLog: structuredData.rawLog || `${structuredData.timestamp || new Date().toISOString()} | ${structuredData.source || "Manual"} | ${structuredData.attackType} | ${structuredData.severity} | ${structuredData.sourceIP} | ${structuredData.destinationIP} | ${structuredData.sourcePort || 0} | ${structuredData.destinationPort || 0} | ${structuredData.protocol || "TCP"} | ${structuredData.message}`,
      };
    }

    // STRICT AUTHENTICITY ENFORCEMENT:
    // Frontend cannot claim dataOrigin is REAL.
    // If client supplied SAMPLE or TEST, respect it; otherwise label MANUAL / UNKNOWN.
    let sanitizedOrigin = "UNKNOWN";
    if (dataOrigin === "SAMPLE") sanitizedOrigin = "SAMPLE";
    else if (dataOrigin === "TEST") sanitizedOrigin = "TEST";
    else sanitizedOrigin = "UNKNOWN";

    payloadToProcess.dataOrigin = sanitizedOrigin;
    payloadToProcess.collectionMethod = "MANUAL";
    payloadToProcess.collectorHost = req.ip || "REMOTE-CLIENT";

    const savedLog = await processSecurityLog(payloadToProcess, "MANUAL");

    res.status(201).json({
      message: "Security log ingested successfully.",
      log: savedLog,
    });
  } catch (error) {
    console.error("createSecurityLog error:", error);
    res.status(400).json({ message: error.message || "Failed to process security log." });
  }
};

// ─────────────────────────────────────────────
// @route   POST /api/security-logs/test-generate
// @desc    Generate controlled SAMPLE or TEST synthetic security event
// @access  Protected
// ─────────────────────────────────────────────
const generateTestOrSampleEvent = async (req, res) => {
  try {
    const { scenario = "SQL_INJECTION", origin = "SAMPLE" } = req.body;
    const targetOrigin = origin === "TEST" ? "TEST" : "SAMPLE";

    const savedLog = await generateSampleSecurityEvent(scenario, targetOrigin);

    res.status(201).json({
      message: `Controlled ${targetOrigin} security event generated.`,
      log: savedLog,
    });
  } catch (error) {
    console.error("generateTestOrSampleEvent error:", error);
    res.status(500).json({ message: "Failed to generate test/sample event: " + error.message });
  }
};

// ─────────────────────────────────────────────
// @route   POST /api/security-logs/trigger-windows-event
// @desc    Trigger an authentic Windows Event Log entry on this Windows host
//          (Uses PowerShell Write-EventLog so the Windows Event Collector captures it natively as REAL)
// @access  Protected (Admin / Development)
// ─────────────────────────────────────────────
const triggerWindowsEvent = async (req, res) => {
  try {
    const { message, severity = "Information", eventId = 1000 } = req.body;
    const eventMessage = message || `CyberSecurity Incident Ledger Test Event - ${new Date().toISOString()}`;

    // Execute PowerShell Write-EventLog targeting Application log
    const psCmd = `powershell -Command "Write-EventLog -LogName 'Application' -Source 'Application Error' -EventId ${eventId} -EntryType ${severity} -Message '${eventMessage.replace(/'/g, "''")}'"`;

    exec(psCmd, async (err) => {
      if (err) {
        console.warn("[WINDOWS TRIGGER] Write-EventLog note:", err.message);
        return res.status(500).json({
          message: "Failed to write event to Windows Event Log.",
          error: err.message,
        });
      }

      console.log(`[WINDOWS TRIGGER] Authentic Windows Application Event ${eventId} generated.`);

      // Promptly run collection check
      setTimeout(async () => {
        try {
          await collectNewEvents();
        } catch (cErr) {
          console.warn("[WINDOWS TRIGGER] Collection poll warning:", cErr.message);
        }
      }, 500);

      res.status(200).json({
        message: "Authentic Windows Event written to Application Event Log. Windows Event Collector is polling for it.",
        eventId,
        host: os.hostname(),
        channel: "Application",
      });
    });
  } catch (error) {
    console.error("triggerWindowsEvent error:", error);
    res.status(500).json({ message: "Server error triggering Windows event." });
  }
};

// ─────────────────────────────────────────────
// @route   GET /api/security-logs/collector/status
// @desc    Get Windows Event Collector status
// @access  Protected
// ─────────────────────────────────────────────
const getCollectorStatus = async (req, res) => {
  try {
    const status = getWindowsCollectorStatus();
    res.status(200).json({ status });
  } catch (error) {
    res.status(500).json({ message: "Server error reading collector status." });
  }
};

// ─────────────────────────────────────────────
// @route   POST /api/security-logs/test-event
// @desc    [DEVELOPMENT / BACKWARD COMPATIBILITY] Trigger sample test event
// @access  Development Only
// ─────────────────────────────────────────────
const createTestEvent = async (req, res) => {
  if (process.env.NODE_ENV === "production") {
    return res.status(403).json({ message: "Test event generation is disabled in production." });
  }

  try {
    const savedLog = await generateSampleSecurityEvent("SQL_INJECTION", "TEST");
    res.status(201).json({
      message: "[DEVELOPMENT ONLY] Controlled test security event emitted.",
      log: savedLog,
    });
  } catch (error) {
    console.error("createTestEvent error:", error);
    res.status(500).json({ message: "Failed to generate test event." });
  }
};

module.exports = {
  getSecurityLogs,
  getLiveLogs,
  getLogStats,
  getSecurityLogById,
  createSecurityLog,
  generateTestOrSampleEvent,
  triggerWindowsEvent,
  getCollectorStatus,
  createTestEvent,
};
