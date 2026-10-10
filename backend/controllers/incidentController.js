const {
  listIncidents,
  getIncidentById,
  createIncidentFromLog,
  getIncidentStats,
  assignIncident,
  investigateIncident,
  startInvestigation,
  addInvestigationNote,
  resolveIncident,
  archiveIncident,
  getEligibleAnalysts,
} = require("../services/incidentService");
const Incident = require("../models/Incident");

// ─────────────────────────────────────────────────────────────────────────────
// Incident Controller – Phase 3: Incident Management & Investigation
// ─────────────────────────────────────────────────────────────────────────────

// ─────────────────────────────────────────────
// @route   GET /api/incidents
// @desc    List incidents with pagination, filters & search
//          Admins see all; Analysts are strictly scoped to their assigned incidents
// @access  Protected (Admin / Analyst / Auditor / User)
// ─────────────────────────────────────────────
const getIncidents = async (req, res) => {
  try {
    const queryParams = { ...req.query };

    // Analyst Authorization: Analysts must only receive incidents assigned to them
    if (req.user?.role === "Analyst") {
      queryParams.assignedTo = req.user.id;
    }

    const result = await listIncidents(queryParams);
    res.status(200).json(result);
  } catch (error) {
    console.error("[INCIDENT CONTROLLER] getIncidents error:", error);
    res.status(500).json({ message: "Server error fetching incidents." });
  }
};

// ─────────────────────────────────────────────
// @route   GET /api/incidents/stats
// @desc    Live summary counts for summary cards
// @access  Protected
// ─────────────────────────────────────────────
const getStats = async (req, res) => {
  try {
    const stats = await getIncidentStats();
    res.status(200).json({ stats });
  } catch (error) {
    console.error("[INCIDENT CONTROLLER] getStats error:", error);
    res.status(500).json({ message: "Server error fetching incident stats." });
  }
};

// ─────────────────────────────────────────────
// @route   GET /api/incidents/analysts
// @desc    Eligible analysts for incident assignment
// @access  Protected (Admin only)
// ─────────────────────────────────────────────
const getAnalysts = async (req, res) => {
  try {
    const analysts = await getEligibleAnalysts();
    res.status(200).json({ analysts });
  } catch (error) {
    console.error("[INCIDENT CONTROLLER] getAnalysts error:", error);
    res.status(500).json({ message: "Server error fetching analysts." });
  }
};

// ─────────────────────────────────────────────
// @route   GET /api/incidents/:id
// @desc    Get a single incident by _id or incidentId
//          Analyst must NOT be able to access unauthorized incidents by URL
// @access  Protected (Admin / Assigned Analyst / Auditor)
// ─────────────────────────────────────────────
const getIncident = async (req, res) => {
  try {
    const { id } = req.params;

    if (!id || !id.trim()) {
      return res.status(400).json({ message: "Incident ID is required." });
    }

    const incident = await getIncidentById(id.trim());

    if (!incident) {
      return res.status(404).json({ message: "Incident not found." });
    }

    // Role-Based Authorization Guard:
    // Analyst can ONLY view incidents assigned to them
    if (req.user?.role === "Analyst") {
      const assignedId = incident.assignedTo?._id?.toString() || incident.assignedTo?.toString();
      if (!assignedId || assignedId !== req.user.id.toString()) {
        return res.status(403).json({
          message: "Access denied. You are not authorized to view this incident.",
        });
      }
    }

    res.status(200).json({ incident });
  } catch (error) {
    console.error("[INCIDENT CONTROLLER] getIncident error:", error);
    res.status(500).json({ message: "Server error fetching incident." });
  }
};

// ─────────────────────────────────────────────
// @route   PATCH /api/incidents/:id/assign
// @desc    Assign or reassign incident to analyst
// @access  Protected (Admin only)
// ─────────────────────────────────────────────
const assignIncidentHandler = async (req, res) => {
  try {
    const { id } = req.params;
    const { analystId, note } = req.body;

    const incident = await assignIncident(id, {
      analystId,
      assignedByUserId: req.user?.id,
      assignedByName: req.user?.name || req.user?.email || "Admin",
      note,
    });

    res.status(200).json({
      message: analystId ? "Incident assigned successfully." : "Incident unassigned.",
      incident,
    });
  } catch (error) {
    console.error("[INCIDENT CONTROLLER] assign error:", error);
    res.status(400).json({ message: error.message || "Failed to assign incident." });
  }
};

// ─────────────────────────────────────────────
// @route   PATCH /api/incidents/:id/start-investigation
// @desc    Transition incident from ASSIGNED to INVESTIGATING
// @access  Protected (Admin / Assigned Analyst)
// ─────────────────────────────────────────────
const startInvestigationHandler = async (req, res) => {
  try {
    const { id } = req.params;
    const { notes } = req.body;

    // Authorization verification
    const existing = await getIncidentById(id.trim());
    if (!existing) {
      return res.status(404).json({ message: "Incident not found." });
    }

    if (req.user?.role === "Analyst") {
      const assignedId = existing.assignedTo?._id?.toString() || existing.assignedTo?.toString();
      if (!assignedId || assignedId !== req.user.id.toString()) {
        return res.status(403).json({
          message: "Access denied. You are not assigned to investigate this incident.",
        });
      }
    }

    const incident = await startInvestigation(id, {
      userId: req.user?.id,
      userName: req.user?.name || req.user?.email || "Analyst",
      notes,
    });

    res.status(200).json({
      message: "Investigation started successfully.",
      incident,
    });
  } catch (error) {
    console.error("[INCIDENT CONTROLLER] startInvestigation error:", error);
    res.status(400).json({ message: error.message || "Failed to start investigation." });
  }
};

// ─────────────────────────────────────────────
// @route   POST /api/incidents/:id/notes & PATCH /api/incidents/:id/notes
// @desc    Append investigation note and record in audit activity history
// @access  Protected (Admin / Assigned Analyst)
// ─────────────────────────────────────────────
const addInvestigationNoteHandler = async (req, res) => {
  try {
    const { id } = req.params;
    const { note } = req.body;

    if (!note || !String(note).trim()) {
      return res.status(400).json({ message: "Note content is required." });
    }

    // Authorization verification
    const existing = await getIncidentById(id.trim());
    if (!existing) {
      return res.status(404).json({ message: "Incident not found." });
    }

    if (req.user?.role === "Analyst") {
      const assignedId = existing.assignedTo?._id?.toString() || existing.assignedTo?.toString();
      if (!assignedId || assignedId !== req.user.id.toString()) {
        return res.status(403).json({
          message: "Access denied. You are not assigned to add notes to this incident.",
        });
      }
    }

    const incident = await addInvestigationNote(id, {
      note,
      author: req.user?.name || req.user?.email || "Analyst",
      authorId: req.user?.id,
      userName: req.user?.name || req.user?.email || "Analyst",
    });

    res.status(201).json({
      message: "Investigation note recorded successfully.",
      incident,
    });
  } catch (error) {
    console.error("[INCIDENT CONTROLLER] addInvestigationNote error:", error);
    res.status(400).json({ message: error.message || "Failed to add investigation note." });
  }
};

// ─────────────────────────────────────────────
// @route   PATCH /api/incidents/:id/resolve
// @desc    Transition incident to RESOLVED with resolution report
// @access  Protected (Admin / Analyst)
// ─────────────────────────────────────────────
const resolveIncidentHandler = async (req, res) => {
  try {
    const { id } = req.params;
    const { resolutionSummary, rootCause, actionTaken } = req.body;

    const incident = await resolveIncident(id, {
      userId: req.user?.id,
      userName: req.user?.name || req.user?.email || "Analyst",
      resolutionSummary,
      rootCause,
      actionTaken,
    });

    res.status(200).json({
      message: "Incident resolved successfully.",
      incident,
    });
  } catch (error) {
    console.error("[INCIDENT CONTROLLER] resolve error:", error);
    res.status(400).json({ message: error.message || "Failed to resolve incident." });
  }
};

// ─────────────────────────────────────────────
// @route   PATCH /api/incidents/:id/archive
// @desc    Transition incident to ARCHIVED
// @access  Protected (Admin only)
// ─────────────────────────────────────────────
const archiveIncidentHandler = async (req, res) => {
  try {
    const { id } = req.params;
    const { note } = req.body;

    // Analyst Authorization: can only archive incidents assigned to them
    if (req.user?.role === "Analyst") {
      const isObjectId = /^[0-9a-fA-F]{24}$/.test(id);
      const existing = await Incident.findOne(isObjectId ? { _id: id } : { incidentId: id }).select("assignedTo status");
      if (!existing) {
        return res.status(404).json({ message: "Incident not found." });
      }
      const assignedId = existing.assignedTo?._id?.toString() || existing.assignedTo?.toString();
      if (!assignedId || assignedId !== req.user.id.toString()) {
        return res.status(403).json({
          message: "Access denied. You can only archive your assigned incidents.",
        });
      }
    }

    const incident = await archiveIncident(id, {
      userId: req.user?.id,
      userName: req.user?.name || req.user?.email || "Admin",
      note,
    });

    res.status(200).json({
      message: "Incident archived.",
      incident,
    });
  } catch (error) {
    console.error("[INCIDENT CONTROLLER] archive error:", error);
    res.status(400).json({ message: error.message || "Failed to archive incident." });
  }
};

// ─────────────────────────────────────────────
// @route   POST /api/incidents
// @desc    Manually create an incident from an existing SecurityLog.
// @access  Admin only
// ─────────────────────────────────────────────
const createIncident = async (req, res) => {
  try {
    const { securityLogId } = req.body;

    if (!securityLogId) {
      return res.status(400).json({ message: "securityLogId is required." });
    }

    if (!/^[0-9a-fA-F]{24}$/.test(securityLogId)) {
      return res.status(400).json({ message: "securityLogId must be a valid MongoDB ObjectId." });
    }

    const SecurityLog = require("../models/SecurityLog");
    const securityLog = await SecurityLog.findById(securityLogId);

    if (!securityLog) {
      return res.status(404).json({ message: "SecurityLog not found." });
    }

    if (!securityLog.threat) {
      return res.status(422).json({
        message: "Cannot create an incident for a non-threat SecurityLog (threat=false).",
      });
    }

    const incident = await createIncidentFromLog(securityLog);

    if (!incident) {
      const existing = await Incident.findOne({ securityLogId: securityLog._id }).lean();
      return res.status(200).json({
        message: "An incident already exists for this SecurityLog.",
        incident: existing,
        duplicate: true,
      });
    }

    res.status(201).json({
      message: "Incident created successfully.",
      incident: incident.toJSON ? incident.toJSON() : incident,
    });
  } catch (error) {
    console.error("[INCIDENT CONTROLLER] createIncident error:", error);
    res.status(500).json({ message: "Server error creating incident." });
  }
};

module.exports = {
  getIncidents,
  getStats,
  getAnalysts,
  getIncident,
  assignIncidentHandler,
  investigateIncidentHandler: startInvestigationHandler,
  startInvestigationHandler,
  addInvestigationNoteHandler,
  resolveIncidentHandler,
  archiveIncidentHandler,
  createIncident,
};
