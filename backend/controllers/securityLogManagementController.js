const multer = require("multer");
const path = require("path");
const fs = require("fs");
const SecurityLog = require("../models/SecurityLog");
const BlockchainTransaction = require("../models/BlockchainTransaction");
const { processSecurityLog } = require("../services/logIngestionService");
const { verifyLogIntegrity } = require("../services/blockchain/blockchainService");
const {
  parsePipeDelimitedLog,
  parseSnortAlerts,
  parseJSONLogs,
  parsePCAPFile,
} = require("../utils/logParser");

// ── Multer Memory Storage Configuration ──
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 50 * 1024 * 1024 }, // 50MB max file size
  fileFilter: (req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    const allowedExts = [".json", ".log", ".txt", ".pcap", ".pcapng"];
    if (allowedExts.includes(ext)) {
      cb(null, true);
    } else {
      cb(new Error(`Unsupported file type ${ext}. Allowed formats: JSON, Snort (.log/.txt), PCAP (.pcap/.pcapng)`));
    }
  },
});

// ─────────────────────────────────────────────
// @route   POST /api/admin/logs/upload
// @desc    Upload & parse security logs (JSON, Snort, PCAP)
// @access  Admin only
// ─────────────────────────────────────────────
const uploadSecurityLogs = async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ message: "No file uploaded. Please select a JSON, Snort (.log), or PCAP file." });
    }

    const { originalname, buffer, size } = req.file;
    const ext = path.extname(originalname).toLowerCase();
    let parsedEvents = [];

    console.log(`[UPLOAD] Processing uploaded log file: ${originalname} (${size} bytes, type: ${ext})`);

    if (ext === ".json") {
      const textContent = buffer.toString("utf8");
      parsedEvents = parseJSONLogs(textContent);
    } else if (ext === ".pcap" || ext === ".pcapng") {
      parsedEvents = parsePCAPFile(buffer);
    } else if (ext === ".log" || ext === ".txt") {
      const textContent = buffer.toString("utf8");
      parsedEvents = parseSnortAlerts(textContent);
    }

    if (!parsedEvents || parsedEvents.length === 0) {
      return res.status(400).json({ message: "Could not extract valid security events from uploaded file." });
    }

    const savedLogs = [];
    for (const evt of parsedEvents) {
      try {
        const saved = await processSecurityLog({
          ...evt,
          fileName: originalname,
          fileSize: size,
          organization: req.body.organization || evt.organization || "CyberSecurity Inc",
        }, `UPLOAD_${evt.fileType || ext.slice(1).toUpperCase()}`);
        savedLogs.push(saved);
      } catch (ingestErr) {
        console.warn(`[UPLOAD] Ingest warning for item: ${ingestErr.message}`);
      }
    }

    res.status(201).json({
      message: `Successfully ingested ${savedLogs.length} security log incident(s) from ${originalname}.`,
      count: savedLogs.length,
      logs: savedLogs,
    });
  } catch (error) {
    console.error("Upload error:", error);
    res.status(500).json({ message: error.message || "Failed to parse and upload security logs." });
  }
};

// ─────────────────────────────────────────────
// @route   GET /api/admin/logs
// @desc    Get all security logs with search, filters & pagination
// @access  Admin only
// ─────────────────────────────────────────────
const getAllLogsAdmin = async (req, res) => {
  try {
    const page  = Math.max(1, parseInt(req.query.page, 10)  || 1);
    const limit = Math.min(100, Math.max(1, parseInt(req.query.limit, 10) || 20));
    const skip  = (page - 1) * limit;

    const { severity, verificationStatus, fileType, source, status, search, origin, dataOrigin } = req.query;

    const filter = {};

    const effectiveOrigin = origin || dataOrigin;
    if (effectiveOrigin && effectiveOrigin !== "All") {
      filter.dataOrigin = effectiveOrigin.toUpperCase();
    }

    if (severity && severity !== "All") {
      filter.severity = severity.toUpperCase();
    }

    if (verificationStatus && verificationStatus !== "All") {
      filter.verificationStatus = verificationStatus;
    }

    if (fileType && fileType !== "All") {
      filter.fileType = fileType;
    }

    if (source && source !== "All") {
      filter.source = new RegExp(`^${source}$`, "i");
    }

    if (status && status !== "All") {
      filter.status = status.toUpperCase();
    }

    if (search && search.trim()) {
      const regex = new RegExp(search.trim(), "i");
      filter.$or = [
        { incidentId: regex },
        { sourceIP: regex },
        { destinationIP: regex },
        { attackType: regex },
        { source: regex },
        { hash: regex },
        { cid: regex },
        { message: regex },
      ];
    }

    const [logs, total, totalCount, criticalCount, highCount, mediumCount, lowCount, verifiedCount, tamperedCount] = await Promise.all([
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
      SecurityLog.countDocuments({ verificationStatus: "Verified" }),
      SecurityLog.countDocuments({ verificationStatus: "Tampered" }),
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
        verified: verifiedCount,
        tampered: tamperedCount,
      },
    });
  } catch (error) {
    console.error("Admin getAllLogs error:", error);
    res.status(500).json({ message: "Server error fetching security logs." });
  }
};

// ─────────────────────────────────────────────
// @route   GET /api/admin/logs/:id
// @desc    Get complete security log detail with blockchain transaction record
// @access  Admin only
// ─────────────────────────────────────────────
const getLogDetailsAdmin = async (req, res) => {
  try {
    const { id } = req.params;

    const log = await SecurityLog.findOne({
      $or: [{ _id: id.match(/^[0-9a-fA-F]{24}$/) ? id : null }, { incidentId: id }, { logId: id }],
    }).lean();

    if (!log) {
      return res.status(404).json({ message: "Security log incident not found." });
    }

    // Query linked blockchain transaction record
    const incidentId = log.incidentId || log.logId;
    const blockchainTx = await BlockchainTransaction.findOne({ logId: incidentId }).lean();

    // Query linked incident if missing
    let createdIncidentId = log.createdIncidentId;
    if (!createdIncidentId) {
      const Incident = require("../models/Incident");
      const inc = await Incident.findOne({ securityLogId: log._id }, "incidentId").lean();
      if (inc) createdIncidentId = inc.incidentId;
    }

    res.status(200).json({
      log: {
        ...log,
        createdIncidentId: createdIncidentId || null,
        blockchainTransaction: blockchainTx || null,
      },
    });
  } catch (error) {
    console.error("Admin getLogDetails error:", error);
    res.status(500).json({ message: "Server error fetching log detail." });
  }
};

// ─────────────────────────────────────────────
// @route   PATCH /api/admin/logs/:id/verify
// @desc    Perform active cryptographic integrity verification
// @access  Admin only
// ─────────────────────────────────────────────
const verifyLogIntegrityAdmin = async (req, res) => {
  try {
    const { id } = req.params;

    const log = await SecurityLog.findOne({
      $or: [{ _id: id.match(/^[0-9a-fA-F]{24}$/) ? id : null }, { incidentId: id }, { logId: id }],
    });

    if (!log) {
      return res.status(404).json({ message: "Security log incident not found." });
    }

    const verificationResult = await verifyLogIntegrity(log);

    // Update status in MongoDB if state changed
    if (log.verificationStatus !== verificationResult.verificationStatus) {
      log.verificationStatus = verificationResult.verificationStatus;
      await log.save();
    }

    res.status(200).json({
      message: verificationResult.isValid
        ? "Cryptographic integrity verified against blockchain ledger."
        : "Integrity verification alert: Hash or ledger mismatch detected.",
      ...verificationResult,
    });
  } catch (error) {
    console.error("Admin verifyLogIntegrity error:", error);
    res.status(500).json({ message: "Server error verifying log integrity." });
  }
};

// ─────────────────────────────────────────────
// @route   GET /api/admin/logs/:id/download
// @desc    Download raw log content or formatted JSON
// @access  Admin only
// ─────────────────────────────────────────────
const downloadLogAdmin = async (req, res) => {
  try {
    const { id } = req.params;

    const log = await SecurityLog.findOne({
      $or: [{ _id: id.match(/^[0-9a-fA-F]{24}$/) ? id : null }, { incidentId: id }, { logId: id }],
    }).lean();

    if (!log) {
      return res.status(404).json({ message: "Security log incident not found." });
    }

    const filename = `${log.incidentId || "security_log"}_evidence.json`;
    const payload = JSON.stringify(log, null, 2);

    res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);
    res.setHeader("Content-Type", "application/json");
    res.send(payload);
  } catch (error) {
    console.error("Admin downloadLog error:", error);
    res.status(500).json({ message: "Server error downloading log." });
  }
};

// ─────────────────────────────────────────────
// @route   DELETE /api/admin/logs/:id
// @desc    Delete security log metadata ONLY (strictly PRESERVES blockchain records)
// @access  Admin only
// ─────────────────────────────────────────────
const deleteLogMetadataAdmin = async (req, res) => {
  try {
    const { id } = req.params;

    const log = await SecurityLog.findOne({
      $or: [{ _id: id.match(/^[0-9a-fA-F]{24}$/) ? id : null }, { incidentId: id }, { logId: id }],
    });

    if (!log) {
      return res.status(404).json({ message: "Security log incident not found." });
    }

    const incidentId = log.incidentId || log.logId;

    // Delete document from SecurityLog collection
    await SecurityLog.findByIdAndDelete(log._id);

    console.log(`[DELETE METADATA] Purged metadata for log ${incidentId}. BlockchainTransaction record remains preserved.`);

    res.status(200).json({
      message: `Metadata for incident ${incidentId} was permanently deleted. Blockchain ledger transaction remains preserved.`,
      incidentId,
    });
  } catch (error) {
    console.error("Admin deleteLogMetadata error:", error);
    res.status(500).json({ message: "Server error deleting log metadata." });
  }
};

module.exports = {
  upload,
  uploadSecurityLogs,
  getAllLogsAdmin,
  getLogDetailsAdmin,
  verifyLogIntegrityAdmin,
  downloadLogAdmin,
  deleteLogMetadataAdmin,
};
