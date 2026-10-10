import API from "./api";

/**
 * Fetch paginated security logs with filter and search criteria (Standard Query).
 */
export const getSecurityLogs = async (params = {}) => {
  const queryParams = new URLSearchParams();
  if (params.page) queryParams.append("page", params.page);
  if (params.limit) queryParams.append("limit", params.limit);
  if (params.severity && params.severity !== "All") queryParams.append("severity", params.severity);
  if (params.verificationStatus && params.verificationStatus !== "All") queryParams.append("verificationStatus", params.verificationStatus);
  if (params.fileType && params.fileType !== "All") queryParams.append("fileType", params.fileType);
  if (params.source && params.source !== "All") queryParams.append("source", params.source);
  if (params.status && params.status !== "All") queryParams.append("status", params.status);
  if (params.origin && params.origin !== "All") queryParams.append("origin", params.origin);
  if (params.dataOrigin && params.dataOrigin !== "All") queryParams.append("dataOrigin", params.dataOrigin);
  if (params.search && params.search.trim()) queryParams.append("search", params.search.trim());

  const response = await API.get(`/admin/logs?${queryParams.toString()}`);
  return response.data;
};

/**
 * Fetch a single security log incident by ID with linked blockchain transaction.
 */
export const getSecurityLogById = async (id) => {
  const response = await API.get(`/admin/logs/${id}`);
  return response.data;
};

/**
 * Upload Security Log file (JSON, Snort .log/.txt, PCAP .pcap/.pcapng).
 */
export const uploadSecurityLogs = async (formData) => {
  const response = await API.post("/admin/logs/upload", formData, {
    headers: {
      "Content-Type": "multipart/form-data",
    },
  });
  return response.data;
};

/**
 * Perform active cryptographic integrity check against the blockchain ledger.
 */
export const verifyLogIntegrity = async (id) => {
  const response = await API.patch(`/admin/logs/${id}/verify`);
  return response.data;
};

/**
 * Download a security log evidence file / JSON.
 */
export const downloadSecurityLog = async (id, incidentId) => {
  const response = await API.get(`/admin/logs/${id}/download`, {
    responseType: "blob",
  });
  const blob = new Blob([response.data], { type: "application/json" });
  const url = window.URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.setAttribute("download", `${incidentId || "security_log"}_evidence.json`);
  document.body.appendChild(link);
  link.click();
  link.remove();
  window.URL.revokeObjectURL(url);
};

/**
 * Delete metadata for a security log (strictly PRESERVES blockchain records).
 */
export const deleteSecurityLogMetadata = async (id) => {
  const response = await API.delete(`/admin/logs/${id}`);
  return response.data;
};

/**
 * Trigger a controlled test security event [DEVELOPMENT ONLY].
 */
export const triggerTestEvent = async () => {
  const response = await API.post("/security-logs/test-event");
  return response.data;
};

/**
 * Fetch live security logs with explicit REAL/SAMPLE/TEST filters.
 */
export const getLiveSecurityLogs = async (params = {}) => {
  const queryParams = new URLSearchParams();
  if (params.page) queryParams.append("page", params.page);
  if (params.limit) queryParams.append("limit", params.limit);
  if (params.origin && params.origin !== "All") queryParams.append("origin", params.origin);
  if (params.severity && params.severity !== "All") queryParams.append("severity", params.severity);
  if (params.source && params.source !== "All") queryParams.append("source", params.source);
  if (params.threat && params.threat !== "All") queryParams.append("threat", params.threat);
  if (params.search && params.search.trim()) queryParams.append("search", params.search.trim());

  const response = await API.get(`/security-logs/live?${queryParams.toString()}`);
  return response.data;
};

/**
 * Fetch aggregated statistics across data origins (REAL, SAMPLE, TEST, UNKNOWN) and severities.
 */
export const getSecurityLogStats = async () => {
  const response = await API.get("/security-logs/stats");
  return response.data;
};

/**
 * Generate a controlled synthetic SAMPLE or TEST security event.
 */
export const generateSyntheticSecurityEvent = async (scenario = "SQL_INJECTION", origin = "SAMPLE") => {
  const response = await API.post("/security-logs/test-generate", { scenario, origin });
  return response.data;
};

/**
 * Trigger an authentic Windows Application event on the local machine for verification.
 */
export const triggerRealWindowsEvent = async (options = {}) => {
  const response = await API.post("/security-logs/trigger-windows-event", options);
  return response.data;
};

/**
 * Get status of the Windows Event Log collector.
 */
export const getWindowsCollectorStatus = async () => {
  const response = await API.get("/security-logs/collector/status");
  return response.data;
};
