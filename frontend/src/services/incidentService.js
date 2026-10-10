import API from "./api";

/**
 * Fetch paginated, filtered, and searched incidents.
 * @param {object} params - { page, limit, status, severity, attackType, threatCategory, assignedTo, startDate, endDate, search, sort }
 * @returns {Promise<object>} - { incidents, total, page, limit, totalPages, stats }
 */
export const getIncidents = async (params = {}) => {
  const query = new URLSearchParams();

  Object.entries(params).forEach(([key, val]) => {
    if (val !== undefined && val !== null && val !== "" && val !== "All") {
      query.append(key, val);
    }
  });

  const response = await API.get(`/incidents?${query.toString()}`);
  return response.data;
};

/**
 * Fetch real-time incident counters and summary statistics.
 * @returns {Promise<object>} - { stats: { total, new, assigned, investigating, resolved, archived, critical, high } }
 */
export const getIncidentStats = async () => {
  const response = await API.get("/incidents/stats");
  return response.data;
};

/**
 * Fetch a single incident by ID or incidentId (with populated SecurityLog and users).
 * @param {string} id
 * @returns {Promise<object>} - { incident }
 */
export const getIncidentById = async (id) => {
  const response = await API.get(`/incidents/${id}`);
  return response.data;
};

/**
 * Fetch all eligible analysts and admins for assignment dropdown.
 * @returns {Promise<object>} - { analysts: [...] }
 */
export const getEligibleAnalysts = async () => {
  const response = await API.get("/incidents/analysts");
  return response.data;
};

/**
 * Assign or reassign an incident to an analyst.
 * @param {string} id
 * @param {object} data - { analystId, note }
 * @returns {Promise<object>}
 */
export const assignIncident = async (id, data) => {
  const response = await API.patch(`/incidents/${id}/assign`, data);
  return response.data;
};

/**
 * Transition incident to INVESTIGATING status.
 * @param {string} id
 * @param {object} data - { notes }
 * @returns {Promise<object>}
 */
export const startInvestigation = async (id, data = {}) => {
  const response = await API.patch(`/incidents/${id}/start-investigation`, data);
  return response.data;
};

/**
 * Backward compatibility alias for startInvestigation.
 */
export const investigateIncident = startInvestigation;

/**
 * Append an investigation note and update audit history.
 * @param {string} id
 * @param {object} data - { note }
 * @returns {Promise<object>}
 */
export const addInvestigationNote = async (id, data = {}) => {
  const response = await API.post(`/incidents/${id}/notes`, data);
  return response.data;
};

/**
 * Resolve an incident with summary, root cause, and action taken.
 * @param {string} id
 * @param {object} data - { resolutionSummary, rootCause, actionTaken }
 * @returns {Promise<object>}
 */
export const resolveIncident = async (id, data) => {
  const response = await API.patch(`/incidents/${id}/resolve`, data);
  return response.data;
};

/**
 * Archive an incident.
 * @param {string} id
 * @param {object} data - { note }
 * @returns {Promise<object>}
 */
export const archiveIncident = async (id, data = {}) => {
  const response = await API.patch(`/incidents/${id}/archive`, data);
  return response.data;
};
