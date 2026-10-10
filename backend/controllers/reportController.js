const {
  generateIncidentReport,
  getReportsForIncident,
  getAllReports,
  getReportByNumber,
  getReportById,
  streamReportPdf,
  verifyReportIntegrity,
  publicVerifyReport,
} = require("../services/reportService");

// ─────────────────────────────────────────────────────────────────────────────
// Report Controller – Phase 5: API Handler Layer
// ─────────────────────────────────────────────────────────────────────────────

// ── POST /api/incidents/:incidentId/reports ───────────────────────────────────
// Generate (or retrieve existing) incident report. Role: Admin, Analyst.
async function generateReportHandler(req, res) {
  try {
    const { incidentId } = req.params;
    const forceRegenerate = req.body?.forceRegenerate === true;

    const user = {
      _id:              req.user._id,
      name:             req.user.name || req.user.email || "Unknown",
      role:             req.user.role,
      organizationId:   req.user.organizationId   || null,
      organizationName: req.user.organizationName || null,
    };

    const report = await generateIncidentReport(incidentId, user, forceRegenerate);

    return res.status(201).json({
      message:      "Incident report generated successfully.",
      reportNumber: report.reportNumber,
      reportId:     report.reportId,
      status:       report.status,
    });
  } catch (err) {
    console.error("[Report] generateReportHandler error:", err.message);
    return res.status(err.statusCode || 500).json({ message: err.message || "Failed to generate report." });
  }
}

// ── GET /api/incidents/:incidentId/reports ────────────────────────────────────
// List all reports for an incident. Role: Admin, Analyst, Auditor.
async function listReportsHandler(req, res) {
  try {
    const { incidentId } = req.params;
    const reports = await getReportsForIncident(incidentId);
    return res.status(200).json({ reports });
  } catch (err) {
    console.error("[Report] listReportsHandler error:", err.message);
    return res.status(500).json({ message: "Failed to retrieve reports." });
  }
}

// ── GET /api/reports/:reportId ────────────────────────────────────────────────
// Get single report metadata. Role: Admin, Analyst, Auditor.
async function getReportHandler(req, res) {
  try {
    const { reportId } = req.params;
    const report = await getReportById(reportId);
    if (!report) {
      return res.status(404).json({ message: "Report not found." });
    }
    return res.status(200).json({ report });
  } catch (err) {
    console.error("[Report] getReportHandler error:", err.message);
    return res.status(500).json({ message: "Failed to retrieve report." });
  }
}

// ── GET /api/reports/:reportId/download ──────────────────────────────────────
// Download PDF. Role: Admin, Analyst, Auditor.
async function downloadReportHandler(req, res) {
  try {
    const { reportId } = req.params;
    await streamReportPdf(reportId, res);
  } catch (err) {
    console.error("[Report] downloadReportHandler error:", err.message);
    if (!res.headersSent) {
      return res.status(err.statusCode || 500).json({ message: err.message || "Failed to download report." });
    }
  }
}

// ── POST /api/reports/:reportId/verify-integrity ─────────────────────────────
// Verify on-disk PDF has not been tampered with. Role: Admin, Auditor.
async function verifyReportIntegrityHandler(req, res) {
  try {
    const { reportId } = req.params;
    const result = await verifyReportIntegrity(reportId);
    return res.status(200).json(result);
  } catch (err) {
    console.error("[Report] verifyReportIntegrityHandler error:", err.message);
    return res.status(err.statusCode || 500).json({ message: err.message || "Verification failed." });
  }
}

// ── GET /api/verify/:reportNumber ────────────────────────────────────────────
// PUBLIC endpoint — no authentication required.
// Returns authenticity metadata for QR scan verification pages.
async function publicVerifyHandler(req, res) {
  try {
    const { reportNumber } = req.params;
    const result = await publicVerifyReport(reportNumber);
    return res.status(200).json(result);
  } catch (err) {
    console.error("[Report] publicVerifyHandler error:", err.message);
    return res.status(err.statusCode || 500).json({ message: err.message || "Verification failed." });
  }
}

// ── GET /api/reports ─────────────────────────────────────────────────────────
// List all reports across incidents. Role: Admin, Analyst, Auditor, Organization.
async function listAllReportsHandler(req, res) {
  try {
    const filter = {};
    if (req.user && req.user.role === "Organization") {
      filter.organizationId = req.user.organizationId;
    }
    const reports = await getAllReports(filter);
    return res.status(200).json({ reports });
  } catch (err) {
    console.error("[Report] listAllReportsHandler error:", err.message);
    return res.status(500).json({ message: "Failed to retrieve reports." });
  }
}

module.exports = {
  generateReportHandler,
  listReportsHandler,
  listAllReportsHandler,
  getReportHandler,
  downloadReportHandler,
  verifyReportIntegrityHandler,
  publicVerifyHandler,
};
