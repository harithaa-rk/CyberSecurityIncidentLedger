const http = require("http");
const express = require("express");
const cors = require("cors");
const helmet = require("helmet");
const rateLimit = require("express-rate-limit");
const path = require("path");
const { Server } = require("socket.io");
require("dotenv").config({ path: path.resolve(__dirname, ".env") });

const connectDB = require("./config/database");
const authRoutes = require("./routes/authRoutes");
const adminRoutes = require("./routes/adminRoutes");
const securityLogRoutes = require("./routes/securityLogRoutes");
const incidentRoutes = require("./routes/incidentRoutes");
const evidenceRoutes = require("./routes/evidenceRoutes");
const reportRoutes  = require("./routes/reportRoutes");

const { setSocketIO } = require("./services/logIngestionService");
const { setIncidentSocketIO } = require("./services/incidentService");
const { setEvidenceSocketIO } = require("./services/evidenceService");
const { startFileCollector } = require("./collectors/fileCollector");
const { startWindowsCollector } = require("./collectors/windowsEventCollector");

const app = express();
const server = http.createServer(app);

connectDB().then(async () => {
  // Sync existing Incidents to SecurityLogs for backwards compatibility
  try {
    const Incident = require("./models/Incident");
    const SecurityLog = require("./models/SecurityLog");
    const incidents = await Incident.find({}, "incidentId securityLogId").lean();
    for (const inc of incidents) {
      if (inc.securityLogId) {
        await SecurityLog.updateOne(
          { _id: inc.securityLogId, createdIncidentId: { $ne: inc.incidentId } },
          { $set: { createdIncidentId: inc.incidentId, incidentRef: inc._id } }
        );
      }
    }
  } catch (syncErr) {
    console.warn("Past incidents sync note:", syncErr.message);
  }

  // Initialize and populate live system logs file in project root
  try {
    const { initializeLogFiles, appendRealSystemLog, LOG_FILE_PATH_PRIMARY } = require("./utils/systemLogFileWriter");
    const fs = require("fs");
    initializeLogFiles();

    if (fs.existsSync(LOG_FILE_PATH_PRIMARY) && fs.statSync(LOG_FILE_PATH_PRIMARY).size < 500) {
      const SecurityLog = require("./models/SecurityLog");
      const Incident = require("./models/Incident");
      const realLogs = await SecurityLog.find({ dataOrigin: "REAL" })
        .sort({ timestamp: 1 })
        .limit(100)
        .lean();
      const logIds = realLogs.map((l) => l._id);
      const incidents = await Incident.find({ securityLogId: { $in: logIds } }, "incidentId securityLogId").lean();
      const incMap = new Map();
      incidents.forEach((inc) => incMap.set(String(inc.securityLogId), inc.incidentId));

      for (const rLog of realLogs) {
        appendRealSystemLog({
          ...rLog,
          createdIncidentId: rLog.createdIncidentId || incMap.get(String(rLog._id)) || null,
        });
      }
      console.log(`[FILE WRITER] Pre-populated ${realLogs.length} real system logs to root project log files.`);
    }
  } catch (logFileErr) {
    console.warn("Log file setup note:", logFileErr.message);
  }

  // Start automated Windows Event Log collector
  startWindowsCollector();
  // Start local file collector fallback
  startFileCollector();
}).catch((err) => {
  console.error("MongoDB connection failed on startup:", err);
});

// ── Socket.IO Real-Time Engine & CORS Configuration ──
const allowedOrigins = [
  process.env.CLIENT_URL,
  process.env.FRONTEND_URL,
  "http://localhost:5173",
  "http://localhost:5174",
  "http://localhost:5175",
  "http://localhost:3000",
  "http://127.0.0.1:5173",
  "http://127.0.0.1:5174",
  "http://127.0.0.1:5175",
].filter(Boolean);

const isAllowedOrigin = (origin) => {
  if (!origin) return true;
  if (allowedOrigins.includes(origin)) return true;
  if (/^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(origin)) return true;
  return false;
};

const corsOriginHandler = (origin, callback) => {
  if (isAllowedOrigin(origin)) {
    return callback(null, true);
  }
  return callback(new Error(`CORS policy blocked access from origin: ${origin}`));
};

const io = new Server(server, {
  cors: {
    origin: corsOriginHandler,
    methods: ["GET", "POST", "PUT", "DELETE", "PATCH"],
    credentials: true,
  },
});

setSocketIO(io);
setIncidentSocketIO(io);
setEvidenceSocketIO(io);

io.on("connection", (socket) => {
  console.log(`[SOCKET] Client connected to real-time stream: ${socket.id}`);

  socket.on("disconnect", () => {
    console.log(`[SOCKET] Client disconnected: ${socket.id}`);
  });
});

// ── CORS & Security Headers ──
app.use(
  cors({
    origin: corsOriginHandler,
    credentials: true,
    methods: ["GET", "POST", "PUT", "DELETE", "PATCH", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization", "X-Requested-With"],
  })
);

app.use(helmet({ crossOriginResourcePolicy: false }));

// ── Body Parsers ──
app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ extended: true, limit: "10mb" }));

// ── Global Rate Limiter ──
const globalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 300,
  message: {
    message: "Too many requests. Please slow down.",
  },
  standardHeaders: true,
  legacyHeaders: false,
});
app.use(globalLimiter);

// ── Routes ──
app.use("/api/auth", authRoutes);
app.use("/api/admin", adminRoutes);
app.use("/api/security-logs", securityLogRoutes);
app.use("/api/incidents", incidentRoutes);
// Evidence routes are mounted at /api (not /api/incidents) because they
// handle both /api/incidents/:id/evidence AND /api/evidence/:id paths.
app.use("/api", evidenceRoutes);
// Report routes are mounted at /api — handles /api/incidents/:id/reports,
// /api/reports/:id, /api/reports/:id/download, and public /api/verify/:reportNumber.
app.use("/api", reportRoutes);

// ── Health Check ──
app.get("/", (req, res) => {
  res.json({
    status: "online",
    message: "CyberSecurity Incident Ledger API 🔐",
    version: "1.0.0",
    socketIO: "active",
    collector: "running",
  });
});

// ── 404 Handler ──
app.use((req, res) => {
  res.status(404).json({ message: "Route not found." });
});

// ── Global Error Handler ──
app.use((err, req, res, next) => {
  console.error("Unhandled error:", err);
  res.status(500).json({ message: "Internal server error." });
});

const PORT = process.env.PORT || 5000;

server.listen(PORT, () => {
  console.log(`🔐 Server running on port ${PORT}`);
  console.log(`🌐 Environment: ${process.env.NODE_ENV || "development"}`);
  console.log(`⚡ Socket.IO initialized on port ${PORT}`);
});