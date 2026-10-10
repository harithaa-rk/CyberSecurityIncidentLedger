const express = require("express");
const router = express.Router();
const { verifyToken, requireRole } = require("../middleware/auth");
const {
  getIncidents,
  getStats,
  getAnalysts,
  getIncident,
  assignIncidentHandler,
  startInvestigationHandler,
  addInvestigationNoteHandler,
  resolveIncidentHandler,
  archiveIncidentHandler,
  createIncident,
} = require("../controllers/incidentController");

// ─────────────────────────────────────────────────────────────────────────────
// Incident Routes – Phase 3: Incident Management & Investigation (Module 3)
// ─────────────────────────────────────────────────────────────────────────────

// All incident routes require authentication
router.use(verifyToken);

// GET /api/incidents          – list with pagination, filters & search (Analysts scoped to assigned)
router.get("/", requireRole("Admin", "Analyst", "Auditor", "User"), getIncidents);

// GET /api/incidents/stats    – live summary card counts
router.get("/stats", requireRole("Admin", "Analyst", "Auditor", "User"), getStats);

// GET /api/incidents/analysts – eligible assignees (Admin only)
router.get("/analysts", requireRole("Admin"), getAnalysts);

// GET /api/incidents/:id      – single incident details (Analysts restricted to assigned)
router.get("/:id", requireRole("Admin", "Analyst", "Auditor", "User"), getIncident);

// PATCH /api/incidents/:id/assign              – assign/reassign to analyst (Admin only)
router.patch("/:id/assign", requireRole("Admin"), assignIncidentHandler);

// PATCH /api/incidents/:id/start-investigation – start investigation (Admin / Assigned Analyst)
router.patch("/:id/start-investigation", requireRole("Admin", "Analyst"), startInvestigationHandler);

// PATCH /api/incidents/:id/investigate         – backward compatibility alias
router.patch("/:id/investigate", requireRole("Admin", "Analyst"), startInvestigationHandler);

// POST /api/incidents/:id/notes                – add investigation note (Admin / Assigned Analyst)
router.post("/:id/notes", requireRole("Admin", "Analyst"), addInvestigationNoteHandler);

// PATCH /api/incidents/:id/notes               – add investigation note (backward compatibility alias)
router.patch("/:id/notes", requireRole("Admin", "Analyst"), addInvestigationNoteHandler);

// PATCH /api/incidents/:id/resolve             – resolve incident
router.patch("/:id/resolve", requireRole("Admin", "Analyst"), resolveIncidentHandler);

// PATCH /api/incidents/:id/archive             – archive incident (Admin / Assigned Analyst)
router.patch("/:id/archive", requireRole("Admin", "Analyst"), archiveIncidentHandler);

// POST /api/incidents                         – Admin-only manual creation from SecurityLog
router.post("/", requireRole("Admin"), createIncident);

module.exports = router;
