const express = require("express");
const router  = express.Router();

const { verifyToken, requireRole } = require("../middleware/auth");
const {
  generateReportHandler,
  listReportsHandler,
  listAllReportsHandler,
  getReportHandler,
  downloadReportHandler,
  verifyReportIntegrityHandler,
  publicVerifyHandler,
} = require("../controllers/reportController");

// ─────────────────────────────────────────────────────────────────────────────
// Report Routes – Phase 5: Automated Incident Report Generation
//
// Mounted at /api in server.js.
//
// Protected routes:
//   POST   /api/incidents/:incidentId/reports            – generate report
//   GET    /api/incidents/:incidentId/reports            – list reports
//   GET    /api/reports/:reportId                        – single report metadata
//   GET    /api/reports/:reportId/download               – download PDF
//   POST   /api/reports/:reportId/verify-integrity       – tamper-detection check
//
// Public routes (no auth):
//   GET    /api/verify/:reportNumber                     – QR scan verification
// ─────────────────────────────────────────────────────────────────────────────

// ── PUBLIC ───────────────────────────────────────────────────────────────────
// Must be declared before verifyToken middleware so it is accessible without
// a JWT token (e.g., when a QR code is scanned on a mobile device).
router.get("/verify/:reportNumber", publicVerifyHandler);

// ── All routes below require authentication ───────────────────────────────────
router.use(verifyToken);

// ── Global reports list ───────────────────────────────────────────────────────
router.get(
  "/reports",
  requireRole("Admin", "Analyst", "Auditor", "Organization"),
  listAllReportsHandler
);

// ── Incident-scoped ───────────────────────────────────────────────────────────
router.post(
  "/incidents/:incidentId/reports",
  requireRole("Admin", "Analyst"),
  generateReportHandler
);

router.get(
  "/incidents/:incidentId/reports",
  requireRole("Admin", "Analyst", "Auditor"),
  listReportsHandler
);

// ── Report-scoped ─────────────────────────────────────────────────────────────
router.get(
  "/reports/:reportId",
  requireRole("Admin", "Analyst", "Auditor"),
  getReportHandler
);

router.get(
  "/reports/:reportId/download",
  requireRole("Admin", "Analyst", "Auditor"),
  downloadReportHandler
);

router.post(
  "/reports/:reportId/verify-integrity",
  requireRole("Admin", "Auditor"),
  verifyReportIntegrityHandler
);

module.exports = router;
