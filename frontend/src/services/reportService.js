import API from "./api";

// ─────────────────────────────────────────────────────────────────────────────
// Frontend Report Service – Phase 5: Automated Incident Report Generation
//
// Wraps all report-related API calls.
// The frontend NEVER generates reportId, reportNumber, digitalSealId, or
// qrVerificationId — those are always server-generated.
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Generate (or retrieve existing) incident report.
 * Role: Admin, Analyst.
 *
 * @param {string}  incidentId
 * @param {boolean} forceRegenerate – pass true to force regeneration
 * @returns {Promise<{ message, reportNumber, reportId, status }>}
 */
export const generateReport = async (incidentId, forceRegenerate = false) => {
  const response = await API.post(`/incidents/${incidentId}/reports`, {
    forceRegenerate,
  });
  return response.data;
};

/**
 * List all reports for a given incident.
 * Role: Admin, Analyst, Auditor.
 *
 * @param {string} incidentId
 * @returns {Promise<{ reports: Array }>}
 */
export const getReportsForIncident = async (incidentId) => {
  const response = await API.get(`/incidents/${incidentId}/reports`);
  return response.data;
};

/**
 * List all reports across incidents.
 * Role: Admin, Analyst, Auditor, Organization.
 *
 * @returns {Promise<{ reports: Array }>}
 */
export const getAllReports = async () => {
  const response = await API.get("/reports");
  return response.data;
};

/**
 * Fetch a single report's metadata by its MongoDB _id or reportId string.
 * Role: Admin, Analyst, Auditor.
 *
 * @param {string} reportId
 * @returns {Promise<{ report: object }>}
 */
export const getReportById = async (reportId) => {
  const response = await API.get(`/reports/${reportId}`);
  return response.data;
};

/**
 * Download the report PDF as a Blob.
 * Role: Admin, Analyst, Auditor.
 *
 * @param {string} reportId
 * @returns {Promise<{ blob: Blob, filename: string }>}
 */
export const downloadReportPdf = async (reportId) => {
  const response = await API.get(`/reports/${reportId}/download`, {
    responseType: "blob",
    timeout: 60000, // PDFs can be large
  });

  const disposition = response.headers["content-disposition"] || "";
  let filename = "incident-report.pdf";
  const match = disposition.match(/filename="?([^";]+)"?/);
  if (match && match[1]) filename = decodeURIComponent(match[1]);

  return { blob: response.data, filename };
};

/**
 * Trigger on-demand PDF tamper-detection check.
 * Role: Admin, Auditor.
 *
 * @param {string} reportId
 * @returns {Promise<{ reportNumber, intact, currentHash, storedHash, verifiedAt }>}
 */
export const verifyReportIntegrity = async (reportId) => {
  const response = await API.post(`/reports/${reportId}/verify-integrity`);
  return response.data;
};

/**
 * Public verification — no JWT required.
 * Called when a user scans the QR code on the report.
 *
 * @param {string} reportNumber – CSR-YYYYMMDD-XXXXXX
 * @returns {Promise<object>}
 */
export const publicVerifyReport = async (reportNumber) => {
  const response = await API.get(`/verify/${encodeURIComponent(reportNumber)}`);
  return response.data;
};
