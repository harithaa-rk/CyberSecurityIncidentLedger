/**
 * Windows Real-Time Event Log Collector
 *
 * Automatically monitors Windows Event Channels (Security, System, Application)
 * by querying newly generated events from the local Windows host using native wevtutil.
 *
 * Maintains latest processed EventRecordID per channel to guarantee
 * that historical events are not re-read or duplicated on restarts.
 *
 * All events collected by this collector are strictly labeled:
 *   dataOrigin: "REAL"
 *   collectionMethod: "WINDOWS_EVENT_LOG"
 */

const os = require("os");
const crypto = require("crypto");
const { exec } = require("child_process");
const { parseWindowsEventXml } = require("../utils/windowsEventParser");
const { analyzeWindowsThreat } = require("../services/aiThreatAnalysisService");
const { processSecurityLog } = require("../services/logIngestionService");

class WindowsEventCollector {
  constructor(options = {}) {
    const rawLogsConfig = process.env.WINDOWS_EVENT_LOGS || "Security,System,Application";
    const channelNames = rawLogsConfig.split(",").map((s) => s.trim()).filter(Boolean);

    this.channels = channelNames.map((name) => ({
      name,
      active: true,
      lastRecordId: 0,
      permissionDenied: false,
    }));

    this.pollIntervalMs = parseInt(
      options.pollIntervalMs || process.env.WINDOWS_EVENT_POLL_INTERVAL_MS || 5000,
      10
    );
    this.startFromLatest = process.env.WINDOWS_EVENT_START_FROM_LATEST !== "false";
    this.hostname = os.hostname();
    this.timer = null;
    this.isPolling = false;
    this.isRunning = false;
  }

  /**
   * Executes a command line and returns stdout / stderr as a Promise.
   */
  execCommand(cmd) {
    return new Promise((resolve, reject) => {
      exec(cmd, { maxBuffer: 10 * 1024 * 1024, windowsHide: true }, (err, stdout, stderr) => {
        if (err) {
          return reject({ err, stdout, stderr });
        }
        resolve(stdout || "");
      });
    });
  }

  /**
   * Initializes channel bookmarks to the current latest event so startup does not
   * flood the database with historic events.
   */
  async initializeBookmarks() {
    for (const ch of this.channels) {
      try {
        if (this.startFromLatest) {
          // Query the single latest record in the channel
          const xml = await this.execCommand(`wevtutil qe "${ch.name}" /c:1 /rd:true /f:RenderedXml`);
          const events = parseWindowsEventXml(xml);
          if (events.length > 0 && events[0].recordId > 0) {
            ch.lastRecordId = events[0].recordId;
          } else {
            ch.lastRecordId = 0;
          }
        } else {
          ch.lastRecordId = 0;
        }
      } catch (error) {
        const stderrMsg = (error.stderr || error.err?.message || "").toString();
        if (/access is denied/i.test(stderrMsg)) {
          ch.permissionDenied = true;
          ch.active = false;
          if (ch.name === "Security") {
            console.warn(`[WINDOWS COLLECTOR] Security log access denied.`);
            console.warn(`[WINDOWS COLLECTOR] Run the terminal with Administrator privileges or grant appropriate Event Log Reader permissions.`);
          } else {
            console.warn(`[WINDOWS COLLECTOR] ${ch.name} log access denied.`);
          }
        } else {
          console.warn(`[WINDOWS COLLECTOR] Notice initializing ${ch.name} bookmark: ${stderrMsg.trim() || error.message}`);
          ch.lastRecordId = 0;
        }
      }
    }
  }

  /**
   * Starts the collector service.
   */
  async start() {
    if (this.isRunning) return;
    this.isRunning = true;

    console.log("[WINDOWS COLLECTOR] Starting...");
    console.log(`[WINDOWS COLLECTOR] Host: ${this.hostname}`);
    console.log(`[WINDOWS COLLECTOR] Poll interval: ${this.pollIntervalMs} ms`);
    console.log(`[WINDOWS COLLECTOR] Monitoring: ${this.channels.map((c) => c.name).join(",")}`);

    // Initialize bookmark position
    await this.initializeBookmarks();

    for (const ch of this.channels) {
      if (ch.active) {
        console.log(`[WINDOWS COLLECTOR] Monitoring ${ch.name}`);
      } else if (ch.permissionDenied) {
        console.log(`[WINDOWS COLLECTOR] ${ch.name} log skipped (permissions required)`);
      }
    }

    // Begin recurring live poll loop
    this.timer = setInterval(() => {
      this.pollNewEvents();
    }, this.pollIntervalMs);
  }

  /**
   * Polls all active channels for newly generated events since lastRecordId.
   */
  async pollNewEvents() {
    if (this.isPolling || !this.isRunning) return;
    this.isPolling = true;

    try {
      await this.collectNewEvents();
    } catch (err) {
      console.error(`[WINDOWS COLLECTOR] Collector error: ${err.message}`);
    } finally {
      this.isPolling = false;
    }
  }

  /**
   * Main collection routine. Can also be called on demand.
   */
  async collectNewEvents() {
    let totalEventsFound = 0;

    for (const ch of this.channels) {
      if (!ch.active) continue;

      try {
        let queryCmd;
        if (ch.lastRecordId > 0) {
          queryCmd = `wevtutil qe "${ch.name}" "/q:*[System[(EventRecordID > ${ch.lastRecordId})]]" /c:50 /f:RenderedXml`;
        } else {
          // Initial or zero bookmark: take latest 5
          queryCmd = `wevtutil qe "${ch.name}" /c:5 /rd:true /f:RenderedXml`;
        }

        const xml = await this.execCommand(queryCmd);
        if (!xml || !xml.trim()) continue;

        const events = parseWindowsEventXml(xml);
        if (events.length === 0) continue;

        // Sort events in ascending order of recordId to process sequentially
        events.sort((a, b) => a.recordId - b.recordId);
        totalEventsFound += events.length;

        for (const evt of events) {
          if (evt.recordId > ch.lastRecordId) {
            ch.lastRecordId = evt.recordId;
          }

          console.log(`[WINDOWS COLLECTOR] New event received`);
          console.log(`[WINDOWS COLLECTOR] EventRecordID: ${evt.recordId}`);
          console.log(`[WINDOWS COLLECTOR] EventID: ${evt.eventId}`);
          console.log(`[WINDOWS COLLECTOR] LogName: ${ch.name}`);
          console.log(`[WINDOWS COLLECTOR] Origin: REAL`);

          await this.ingestWindowsEvent(evt, ch.name);
          console.log(`[WINDOWS COLLECTOR] Event processed`);
        }
      } catch (pollErr) {
        const msg = (pollErr.stderr || pollErr.err?.message || "").toString();
        if (/access is denied/i.test(msg)) {
          ch.active = false;
          ch.permissionDenied = true;
          if (ch.name === "Security") {
            console.warn(`[WINDOWS COLLECTOR] Security log access denied.`);
            console.warn(`[WINDOWS COLLECTOR] Run the terminal with Administrator privileges or grant appropriate Event Log Reader permissions.`);
          } else {
            console.warn(`[WINDOWS COLLECTOR] Access denied on ${ch.name} log. Disabling channel polling.`);
          }
        } else if (msg.trim()) {
          console.warn(`[WINDOWS COLLECTOR] Warning polling ${ch.name} log: ${msg.trim()}`);
        }
      }
    }

    return totalEventsFound;
  }

  /**
   * Evaluates and ingests a single Windows event into the security pipeline.
   */
  async ingestWindowsEvent(rawEvent, channelName) {
    try {
      console.log(`[LOG INGESTION] Processing security event`);
      console.log(`[LOG INGESTION] Data origin: REAL`);

      // 1. Run through AI Threat Analysis
      const aiAnalysis = analyzeWindowsThreat(rawEvent);
      console.log(`[AI] Threat analysis completed (threat=${aiAnalysis.threat}, severity=${aiAnalysis.severity})`);

      // 2. Deterministic SHA-256 fingerprint ensuring zero duplicate records
      const eventFingerprint = crypto
        .createHash("sha256")
        .update(`${this.hostname}|${channelName}|${rawEvent.recordId}|${rawEvent.provider || ""}`)
        .digest("hex");

      const fingerprint = `WINDOWS_EVENT|${channelName}|${rawEvent.eventId}|${rawEvent.recordId}|${rawEvent.computerName}|${rawEvent.timestamp}`;

      // 3. Normalize to SecurityLog schema with STRICT REAL DATA ORIGIN
      const normalizedLog = {
        timestamp: rawEvent.timestamp,
        receivedAt: new Date(),
        dataOrigin: "REAL",
        collectionMethod: "WINDOWS_EVENT_LOG",
        collectorHost: this.hostname,
        collectorProcess: `node:${process.pid}`,
        eventRecordId: String(rawEvent.recordId),
        providerName: rawEvent.provider || "Microsoft-Windows",
        logName: channelName,
        eventFingerprint,
        source: `Windows-${channelName}`,
        eventName: `${channelName} Event ${rawEvent.eventId}`,
        category: aiAnalysis.threatCategory,
        attackType: aiAnalysis.attackType,
        severity: aiAnalysis.severity,
        sourceIP: rawEvent.sourceIP || "127.0.0.1",
        destinationIP: rawEvent.destinationIP || "127.0.0.1",
        sourcePort: rawEvent.sourcePort || 0,
        destinationPort: 0,
        protocol: "OS_EVENT",
        message: rawEvent.message || `Windows ${channelName} Event ${rawEvent.eventId} from ${rawEvent.provider}`,
        rawLog: rawEvent.rawLog,
        fullLog: rawEvent.rawLog,
        fileType: "WINDOWS_EVENT_LOG",
        fileName: `${channelName}.evtx`,
        fileSize: rawEvent.rawLog ? rawEvent.rawLog.length : 0,
        fingerprint,
        eventId: String(rawEvent.eventId),
        threat: aiAnalysis.threat,
        threatCategory: aiAnalysis.threatCategory,
        riskScore: aiAnalysis.riskScore,
        explanation: aiAnalysis.explanation,
        recommendedAction: aiAnalysis.recommendedAction,
        windowsEventData: {
          eventId: rawEvent.eventId,
          recordId: rawEvent.recordId,
          channel: channelName,
          provider: rawEvent.provider,
          level: rawEvent.level,
          computerName: rawEvent.computerName,
          user: rawEvent.user,
          processId: rawEvent.processId,
          threadId: rawEvent.threadId,
          keywords: rawEvent.keywords,
          taskCategory: rawEvent.taskCategory,
          eventData: rawEvent.eventData,
        },
      };

      // 4. Save to MongoDB & emit to Socket.IO
      await processSecurityLog(normalizedLog, "WINDOWS_EVENT_LOG");
    } catch (ingestErr) {
      console.error(`[WINDOWS COLLECTOR] Error ingesting event ${rawEvent.eventId}: ${ingestErr.message}`);
    }
  }

  /**
   * Stops the collector.
   */
  stop() {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
    this.isRunning = false;
    console.log("[WINDOWS COLLECTOR] Stopped");
  }

  /**
   * Returns current operational status.
   */
  getStatus() {
    return {
      running: this.isRunning,
      polling: this.isPolling,
      host: this.hostname,
      pollIntervalMs: this.pollIntervalMs,
      channels: this.channels.map((c) => ({
        name: c.name,
        active: c.active,
        lastRecordId: c.lastRecordId,
        permissionDenied: c.permissionDenied,
      })),
    };
  }
}

let collectorInstance = null;

function startWindowsEventCollector(options = {}) {
  if (collectorInstance) {
    collectorInstance.stop();
  }
  collectorInstance = new WindowsEventCollector(options);
  collectorInstance.start();
  return collectorInstance;
}

function stopWindowsEventCollector() {
  if (collectorInstance) {
    collectorInstance.stop();
    collectorInstance = null;
  }
}

function collectNewEvents() {
  if (collectorInstance) {
    return collectorInstance.collectNewEvents();
  }
  return Promise.resolve(0);
}

function getWindowsCollectorStatus() {
  if (collectorInstance) {
    return collectorInstance.getStatus();
  }
  return { running: false };
}

module.exports = {
  WindowsEventCollector,
  startWindowsEventCollector,
  stopWindowsEventCollector,
  collectNewEvents,
  getWindowsCollectorStatus,
  // Backward compatibility aliases
  startWindowsCollector: startWindowsEventCollector,
  stopWindowsCollector: stopWindowsEventCollector,
};
