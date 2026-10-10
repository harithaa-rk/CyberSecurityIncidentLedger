const fs = require("fs");
const path = require("path");
const { parseSecurityLog } = require("../utils/logParser");
const { processSecurityLog } = require("../services/logIngestionService");

class FileCollector {
  constructor(filePath) {
    this.filePath = filePath;
    this.currentOffset = 0;
    this.lineBuffer = "";
    this.isWatching = false;
    this.watchInstance = null;
    this.pollInterval = null;
    this.isProcessing = false;
  }

  /**
   * Initializes and starts the local file watcher.
   */
  start() {
    // Ensure parent log directory exists
    const dir = path.dirname(this.filePath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }

    // Ensure target log file exists
    if (!fs.existsSync(this.filePath)) {
      fs.writeFileSync(this.filePath, "", "utf8");
      console.log(`[LOG COLLECTOR] Created initial log file at: ${this.filePath}`);
    }

    // Start offset from 0 so existing log entries are ingested into MongoDB on boot
    this.currentOffset = 0;

    console.log(`[LOG COLLECTOR] [DEVELOPMENT MODE] Watching: ${this.filePath}`);

    // Process existing lines immediately on startup
    this.handleFileChange();

    // 1. Primary event-driven watcher
    try {
      this.watchInstance = fs.watch(this.filePath, (eventType) => {
        if (eventType === "change" || eventType === "rename") {
          this.handleFileChange();
        }
      });
      this.isWatching = true;
    } catch (err) {
      console.warn(`[LOG COLLECTOR] fs.watch error (${err.message}). Falling back to active poll.`);
    }

    // 2. Secondary heartbeat poller for cross-platform reliability (Windows fs.watch edge cases)
    this.pollInterval = setInterval(() => {
      this.handleFileChange();
    }, 1000);
  }

  /**
   * Reads newly appended bytes and processes full lines.
   */
  async handleFileChange() {
    if (this.isProcessing) return;
    this.isProcessing = true;

    try {
      if (!fs.existsSync(this.filePath)) {
        this.isProcessing = false;
        return;
      }

      const stats = await fs.promises.stat(this.filePath);
      const newSize = stats.size;

      // Handle file truncation or rotation
      if (newSize < this.currentOffset) {
        console.log(`[LOG COLLECTOR] File truncation or rotation detected. Resetting offset to 0.`);
        this.currentOffset = 0;
        this.lineBuffer = "";
      }

      if (newSize === this.currentOffset) {
        this.isProcessing = false;
        return; // No new bytes added
      }

      const bytesToRead = newSize - this.currentOffset;
      const buffer = Buffer.alloc(bytesToRead);

      const fileHandle = await fs.promises.open(this.filePath, "r");
      try {
        await fileHandle.read(buffer, 0, bytesToRead, this.currentOffset);
      } finally {
        await fileHandle.close();
      }

      this.currentOffset = newSize;

      const rawChunk = buffer.toString("utf8");
      const combined = this.lineBuffer + rawChunk;

      // Split lines cleanly by \r\n or \n
      const lines = combined.split(/\r?\n/);

      // The last element may be a partial line if not ending with newline
      this.lineBuffer = lines.pop() || "";

      for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed || trimmed.startsWith("#")) continue;

        try {
          console.log(`[LOG COLLECTOR] New log detected: "${trimmed.slice(0, 60)}..."`);
          const parsed = parseSecurityLog(trimmed);
          if (parsed) {
            console.log(`[LOG PARSER] Log parsed successfully: ${parsed.attackType} [${parsed.severity}] from ${parsed.sourceIP}`);
            await processSecurityLog(parsed, "LOCAL_FILE");
          }
        } catch (parseErr) {
          console.error(`[LOG COLLECTOR] Error processing log line: ${parseErr.message}`);
        }
      }
    } catch (err) {
      console.error(`[LOG COLLECTOR] Error reading log file: ${err.message}`);
    } finally {
      this.isProcessing = false;
    }
  }

  /**
   * Stops watching the file.
   */
  stop() {
    if (this.watchInstance) {
      this.watchInstance.close();
      this.watchInstance = null;
    }
    if (this.pollInterval) {
      clearInterval(this.pollInterval);
      this.pollInterval = null;
    }
    this.isWatching = false;
    console.log(`[LOG COLLECTOR] Stopped watching ${this.filePath}`);
  }
}

// Global collector instance
let collectorInstance = null;

function startFileCollector() {
  const defaultPath = path.resolve(__dirname, "../logs/security.log");
  const logPath = process.env.SECURITY_LOG_PATH
    ? path.resolve(process.cwd(), process.env.SECURITY_LOG_PATH)
    : defaultPath;

  if (collectorInstance) {
    collectorInstance.stop();
  }

  collectorInstance = new FileCollector(logPath);
  collectorInstance.start();
  return collectorInstance;
}

module.exports = {
  FileCollector,
  startFileCollector,
};
