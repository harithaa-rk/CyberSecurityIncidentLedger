const express = require("express");
const router = express.Router();
const { verifyToken } = require("../middleware/auth");
const {
  getSecurityLogs,
  getLiveLogs,
  getLogStats,
  getSecurityLogById,
  createSecurityLog,
  generateTestOrSampleEvent,
  triggerWindowsEvent,
  getCollectorStatus,
  createTestEvent,
} = require("../controllers/securityLogController");

// Public development test event trigger (backward compatibility)
router.post("/test-event", createTestEvent);

// Live Security Log Monitor endpoints
router.get("/live", verifyToken, getLiveLogs);
router.get("/stats", verifyToken, getLogStats);
router.post("/test-generate", verifyToken, generateTestOrSampleEvent);
router.post("/trigger-windows-event", verifyToken, triggerWindowsEvent);
router.get("/collector/status", verifyToken, getCollectorStatus);

// Standard security log endpoints
router.get("/", verifyToken, getSecurityLogs);
router.get("/:id", verifyToken, getSecurityLogById);
router.post("/", verifyToken, createSecurityLog);

module.exports = router;
