const crypto = require("crypto");
const path   = require("path");
const fs     = require("fs");

const IncidentReport = require("../models/IncidentReport");
const Incident       = require("../models/Incident");
const Evidence       = require("../models/Evidence");
const User           = require("../models/User");

const { buildAiSummary, buildInvestigationNarrative } = require("./reportSummaryService");
const { generateDigitalSealId }                       = require("./digitalSealService");
const { generateQrVerificationId, buildVerificationUrl } = require("./qrVerificationService");
const { generatePdfReport, verifyPdfIntegrity }       = require("./pdfReportService");

// ─────────────────────────────────────────────────────────────────────────────
// Report Service – Phase 5: Orchestration Layer
//
// Coordinates all sub-services to produce, store, and verify incident reports.
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Generate a new incident report for a given incidentId.
 * If a GENERATED report already exists for that incident, return the existing one
 * (idempotent — callers may force a re-generation by passing forceRegenerate = true).
 *
 * @param {string|ObjectId} incidentId
 * @param {object}          generatedByUser  – { _id, name, role }
 * @param {boolean}         forceRegenerate
 * @returns {Promise<IncidentReport>}
 */
async function generateIncidentReport(incidentId, generatedByUser, forceRegenerate = false) {
  // ── 1. Load incident ──────────────────────────────────────────────────────
  const incident = await Incident.findById(incidentId).lean();
  if (!incident) {
    const err = new Error("Incident not found.");
    err.statusCode = 404;
    throw err;
  }

  // ── 2. Idempotency guard ──────────────────────────────────────────────────
  if (!forceRegenerate) {
    const existing = await IncidentReport.findOne({
      incidentId,
      status: { $in: ["GENERATED", "VERIFIED"] },
    }).lean();
    if (existing) return existing;
  }

  // ── 3. Load evidence for this incident ────────────────────────────────────
  const evidenceList = await Evidence.find({ incidentId }).lean();

  // ── 4. Compose AI summary & investigation narrative ───────────────────────
  const aiData    = buildAiSummary(incident);
  const invData   = buildInvestigationNarrative(incident);

  // ── 5. Generate seal & QR identifiers ────────────────────────────────────
  const now              = new Date();
  const digitalSealId    = generateDigitalSealId(now);
  const qrVerificationId = generateQrVerificationId(now);

  // ── 6. Build evidence list snapshot (immutable at report time) ────────────
  const evidenceSnapshot = evidenceList.map((ev) => ({
    evidenceId:         String(ev._id),
    fileName:           ev.fileName           || "Not Available",
    fileType:           ev.fileType           || "Not Available",
    mimeType:           ev.mimeType           || "Not Available",
    fileSize:           ev.fileSize           || 0,
    collectionTimestamp: ev.collectedAt       || ev.createdAt || null,
    sha256Hash:         ev.sha256Hash         || "Not Available",
    ipfsCid:            ev.ipfsCid            || "Not Available",
    fabricTransactionId: ev.fabricTransactionId || "Not Available",
    fabricRecordedAt:   ev.fabricRecordedAt   || null,
    verificationStatus: ev.verificationStatus || "NOT_VERIFIED",
  }));

  // ── 7. Determine organization ─────────────────────────────────────────────
  const orgId   = incident.organizationId || generatedByUser?.organizationId || null;
  const orgName = incident.organizationName
    || generatedByUser?.organizationName
    || "Cybersecurity Operations Center";

  // ── 8. Create IncidentReport document (status = GENERATING) ──────────────
  const reportDoc = new IncidentReport({
    incidentId:          incident._id,
    incidentIdentifier:  incident.incidentId,
    organizationId:      orgId,
    organizationName:    orgName,

    incidentTitle:       incident.title       || "Untitled Incident",
    incidentType:        "Security Incident",
    threatCategory:      incident.threatCategory || "General Threat",
    attackType:          incident.attackType   || "UNKNOWN",
    severity:            incident.severity     || "MEDIUM",
    riskScore:           incident.riskScore    ?? 0,
    incidentDetectedAt:  incident.timestamp    || incident.createdAt,
    incidentResolvedAt:  incident.resolvedAt   || null,

    source:              incident.source       || "Security Monitor",
    sourceIP:            incident.sourceIP     || "Not Available",
    destinationIP:       incident.destinationIP || "Not Available",
    sourcePort:          incident.sourcePort   ?? 0,
    destinationPort:     incident.destinationPort ?? 0,
    protocol:            incident.protocol     || "TCP",

    aiSummary:           aiData.aiSummary,
    aiExplanation:       aiData.aiExplanation,
    recommendedAction:   aiData.recommendedAction,

    investigationSummary: invData.investigationSummary,
    rootCause:           invData.rootCause,
    actionTaken:         invData.actionTaken,
    resolutionSummary:   invData.resolutionSummary,

    evidenceCount:       evidenceSnapshot.length,
    evidenceList:        evidenceSnapshot,

    generatedBy:         generatedByUser?._id   || null,
    generatedByName:     generatedByUser?.name  || "System",
    generatedAt:         now,

    digitalSealId,
    qrVerificationId,
    verificationUrl:     null, // set after we have reportNumber
    pdfPath:             null,
    reportHash:          null,
    status:              "GENERATING",
  });

  // Save once to trigger pre-validate hook and obtain reportId / reportNumber
  await reportDoc.save();

  // ── 9. Build verification URL now that reportNumber is known ──────────────
  reportDoc.verificationUrl = buildVerificationUrl(reportDoc.reportNumber);

  // ── 10. Generate PDF ──────────────────────────────────────────────────────
  const filename  = `${reportDoc.reportId}-${crypto.randomBytes(4).toString("hex")}`;
  const reportPlain = reportDoc.toObject({ getters: false });
  // toObject strips pdfPath for client; we need it internally so use raw
  reportPlain.pdfPath        = null;
  reportPlain.verificationUrl = reportDoc.verificationUrl;

  // ── Inject extra fields needed by the formal PDF template ─────────────────
  // These fields live only on the Incident model, not on IncidentReport.
  reportPlain.incidentStatus       = incident.status                  || "NOT AVAILABLE";
  reportPlain.hostname             = incident.hostname                || null;
  reportPlain.eventId              = incident.eventId                 || null;
  reportPlain.organizationLocation = incident.organizationLocation    || null;

  // resolvedByName — try to resolve from User if resolvedBy ObjectId exists
  let resolvedByName = null;
  if (incident.resolvedBy) {
    try {
      const resolver = await User.findById(incident.resolvedBy).select("name").lean();
      resolvedByName = resolver?.name || null;
    } catch (_) {
      // non-fatal — leave as null
    }
  }
  reportPlain.resolvedByName = resolvedByName;

  const { pdfPath, reportHash } = await generatePdfReport(reportPlain, filename);

  // ── 11. Persist final fields ──────────────────────────────────────────────
  reportDoc.pdfPath    = pdfPath;
  reportDoc.reportHash = reportHash;
  reportDoc.status     = "GENERATED";
  await reportDoc.save();

  return reportDoc;
}

/**
 * List all reports for a given incident.
 *
 * @param {string|ObjectId} incidentId
 * @returns {Promise<IncidentReport[]>}
 */
async function getReportsForIncident(incidentId) {
  return IncidentReport.find({ incidentId })
    .sort({ createdAt: -1 })
    .lean();
}

/**
 * List all reports with optional filtering (e.g. by organization).
 *
 * @param {object} filter
 * @returns {Promise<IncidentReport[]>}
 */
async function getAllReports(filter = {}) {
  return IncidentReport.find(filter)
    .sort({ createdAt: -1 })
    .lean();
}

/**
 * Get a single report by its reportNumber (used by public verification).
 *
 * @param {string} reportNumber – CSR-YYYYMMDD-XXXXXX
 * @returns {Promise<IncidentReport|null>}
 */
async function getReportByNumber(reportNumber) {
  return IncidentReport.findOne({ reportNumber }).lean();
}

/**
 * Get a single report by MongoDB _id.
 *
 * @param {string|ObjectId} id
 * @returns {Promise<IncidentReport|null>}
 */
async function getReportById(id) {
  return IncidentReport.findById(id).lean();
}

/**
 * Stream the PDF file to a response object.
 *
 * @param {string} reportId – IncidentReport._id or reportId string
 * @param {object} res      – Express response
 */
async function streamReportPdf(reportId, res) {
  // Accept both MongoDB _id and our custom reportId string
  let report = await IncidentReport.findById(reportId).lean().catch(() => null);
  if (!report) {
    report = await IncidentReport.findOne({ reportId }).lean();
  }

  if (!report) {
    const err = new Error("Report not found.");
    err.statusCode = 404;
    throw err;
  }

  if (report.status !== "GENERATED" && report.status !== "VERIFIED") {
    const err = new Error("Report is not yet available for download.");
    err.statusCode = 422;
    throw err;
  }

  const pdfPath = report.pdfPath;
  if (!pdfPath || !fs.existsSync(pdfPath)) {
    const err = new Error("Report PDF file not found on server.");
    err.statusCode = 404;
    throw err;
  }

  res.setHeader("Content-Type", "application/pdf");
  res.setHeader(
    "Content-Disposition",
    `attachment; filename="${report.reportNumber}.pdf"`
  );
  res.setHeader("Content-Length", fs.statSync(pdfPath).size);

  fs.createReadStream(pdfPath).pipe(res);
}

/**
 * Verify PDF tamper-detection.
 * Recomputes SHA-256 of the on-disk PDF and compares to stored reportHash.
 *
 * @param {string|ObjectId} reportId
 * @returns {Promise<{ reportNumber: string, intact: boolean, currentHash: string, storedHash: string, verifiedAt: Date }>}
 */
async function verifyReportIntegrity(reportId) {
  let report = await IncidentReport.findById(reportId).lean().catch(() => null);
  if (!report) {
    report = await IncidentReport.findOne({ reportId }).lean();
  }
  if (!report) {
    const err = new Error("Report not found.");
    err.statusCode = 404;
    throw err;
  }

  if (!report.pdfPath) {
    const err = new Error("Report PDF path not available.");
    err.statusCode = 422;
    throw err;
  }

  const result = verifyPdfIntegrity(report.pdfPath, report.reportHash);

  // Update status to VERIFIED if intact
  if (result.intact && report.status === "GENERATED") {
    await IncidentReport.findByIdAndUpdate(report._id, { status: "VERIFIED" });
  }

  return {
    reportNumber:  report.reportNumber,
    reportId:      report.reportId,
    incidentId:    String(report.incidentId),
    intact:        result.intact,
    currentHash:   result.currentHash,
    storedHash:    result.storedHash,
    verifiedAt:    new Date(),
  };
}

/**
 * Public verification – look up a report by reportNumber, return metadata and
 * integrity status without exposing internal PDF path.
 *
 * @param {string} reportNumber
 * @returns {Promise<object>}
 */
async function publicVerifyReport(reportNumber) {
  const report = await IncidentReport.findOne({ reportNumber }).lean();
  if (!report) {
    const err = new Error("Report not found. The verification code may be invalid or the report does not exist.");
    err.statusCode = 404;
    throw err;
  }

  let integrityResult = null;
  if (report.pdfPath && fs.existsSync(report.pdfPath)) {
    integrityResult = verifyPdfIntegrity(report.pdfPath, report.reportHash);
  }

  return {
    reportNumber:       report.reportNumber,
    reportId:           report.reportId,
    incidentIdentifier: report.incidentIdentifier,
    incidentTitle:      report.incidentTitle,
    severity:           report.severity,
    generatedAt:        report.generatedAt,
    generatedByName:    report.generatedByName,
    organizationName:   report.organizationName,
    digitalSealId:      report.digitalSealId,
    qrVerificationId:   report.qrVerificationId,
    status:             report.status,
    intact:             integrityResult?.intact   ?? null,
    currentHash:        integrityResult?.currentHash ?? null,
    storedHash:         integrityResult?.storedHash  ?? null,
    verifiedAt:         new Date(),
  };
}

module.exports = {
  generateIncidentReport,
  getReportsForIncident,
  getAllReports,
  getReportByNumber,
  getReportById,
  streamReportPdf,
  verifyReportIntegrity,
  publicVerifyReport,
};
