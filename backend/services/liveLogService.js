/**
 * Live Security Log Service
 *
 * Dedicated business logic service for the Live Security Log Monitor module:
 * - Real-time querying with rich origin/severity/threat filtering
 * - Aggregated telemetry provenance statistics (REAL vs SAMPLE vs TEST vs UNKNOWN)
 * - Safe detail inspection including raw log extraction
 * - Controlled generation of synthetic demonstration events
 */

const SecurityLog = require("../models/SecurityLog");
const { generateSampleSecurityEvent, SCENARIOS } = require("../collectors/sampleLogGenerator");

/**
 * Retrieves filtered, newest-first live security telemetry logs.
 *
 * @param {object} params
 * @returns {Promise<{ logs: Array<object>, total: number, stats: object }>}
 */
async function getLiveSecurityLogs(params = {}) {
  const limit = Math.min(500, Math.max(1, parseInt(params.limit, 10) || 100));
  const page = Math.max(1, parseInt(params.page, 10) || 1);
  const skip = (page - 1) * limit;

  const filter = {};

  // 1. Data Origin Filter (REAL, SAMPLE, TEST, UNKNOWN)
  const origin = params.origin || params.dataOrigin;
  if (origin && origin !== "All" && origin !== "ALL") {
    filter.dataOrigin = origin.toUpperCase();
  }

  // 2. Collection Method Filter
  const method = params.method || params.collectionMethod;
  if (method && method !== "All" && method !== "ALL") {
    filter.collectionMethod = method.toUpperCase();
  }

  // 3. Severity Filter (LOW, MEDIUM, HIGH, CRITICAL)
  if (params.severity && params.severity !== "All" && params.severity !== "ALL") {
    filter.severity = params.severity.toUpperCase();
  }

  // 4. Source Filter
  if (params.source && params.source !== "All" && params.source !== "ALL") {
    if (params.source.toLowerCase() === "other") {
      filter.source = { $not: /Windows|Sample Generator/i };
    } else {
      const sanitized = params.source.trim().replace(/[-\s]+/g, "[- ]?");
      filter.source = new RegExp(sanitized, "i");
    }
  }

  // 5. Threat Boolean Filter
  if (params.threat !== undefined && params.threat !== "All" && params.threat !== "ALL") {
    if (params.threat === "true" || params.threat === true || params.threat === "threats") {
      filter.threat = true;
    } else if (params.threat === "false" || params.threat === false || params.threat === "normal") {
      filter.threat = false;
    }
  }

  // 6. Time Range Filter (from/to)
  if (params.from || params.to) {
    filter.timestamp = {};
    if (params.from) filter.timestamp.$gte = new Date(params.from);
    if (params.to) filter.timestamp.$lte = new Date(params.to);
  }

  // 7. General Text Search across message, source, event ID, attack type, collector host, incident ID
  if (params.search && params.search.trim()) {
    const term = params.search.trim();
    const regex = new RegExp(term, "i");
    filter.$or = [
      { message: regex },
      { source: regex },
      { eventId: regex },
      { attackType: regex },
      { collectorHost: regex },
      { incidentId: regex },
      { providerName: regex },
      { logName: regex },
      { eventRecordId: regex },
    ];
  }

  // Execute optimized parallel queries
  const [logs, filteredCount, stats] = await Promise.all([
    SecurityLog.find(filter)
      .sort({ timestamp: -1, createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .lean(),
    SecurityLog.countDocuments(filter),
    getSecurityLogStats(),
  ]);

  const Incident = require("../models/Incident");
  const logIds = logs.map((l) => l._id);
  const incidents = await Incident.find({ securityLogId: { $in: logIds } }, "incidentId securityLogId").lean();
  const incMap = new Map();
  incidents.forEach((inc) => {
    incMap.set(String(inc.securityLogId), inc.incidentId);
  });

  const enrichedLogs = logs.map((l) => ({
    ...l,
    createdIncidentId: l.createdIncidentId || incMap.get(String(l._id)) || null,
  }));

  return {
    logs: enrichedLogs,
    total: filteredCount,
    limit,
    page,
    totalPages: Math.ceil(filteredCount / limit) || 1,
    stats,
  };
}

/**
 * Calculates aggregated counts for live telemetry dashboard summary cards.
 *
 * @returns {Promise<object>}
 */
async function getSecurityLogStats() {
  const [
    total,
    real,
    sample,
    test,
    unknown,
    threats,
    critical,
    high,
    medium,
    low,
  ] = await Promise.all([
    SecurityLog.countDocuments(),
    SecurityLog.countDocuments({ dataOrigin: "REAL" }),
    SecurityLog.countDocuments({ dataOrigin: "SAMPLE" }),
    SecurityLog.countDocuments({ dataOrigin: "TEST" }),
    SecurityLog.countDocuments({ $or: [{ dataOrigin: "UNKNOWN" }, { dataOrigin: { $exists: false } }] }),
    SecurityLog.countDocuments({ threat: true }),
    SecurityLog.countDocuments({ severity: "CRITICAL" }),
    SecurityLog.countDocuments({ severity: "HIGH" }),
    SecurityLog.countDocuments({ severity: "MEDIUM" }),
    SecurityLog.countDocuments({ severity: "LOW" }),
  ]);

  return {
    total,
    real,
    sample,
    test,
    unknown,
    threats,
    critical,
    high,
    medium,
    low,
  };
}

/**
 * Retrieves complete single security log document, including rawLog.
 *
 * @param {string} id - Mongo ObjectId or Incident ID
 * @returns {Promise<object|null>}
 */
async function getSecurityLogDetail(id) {
  if (!id) return null;

  const isObjectId = /^[0-9a-fA-F]{24}$/.test(id);
  const query = isObjectId
    ? { $or: [{ _id: id }, { incidentId: id }] }
    : { incidentId: id };

  const log = await SecurityLog.findOne(query).lean();
  if (!log) return null;

  if (!log.createdIncidentId) {
    const Incident = require("../models/Incident");
    const inc = await Incident.findOne({ securityLogId: log._id }, "incidentId").lean();
    if (inc) log.createdIncidentId = inc.incidentId;
  }

  return log;
}

module.exports = {
  getLiveSecurityLogs,
  getSecurityLogStats,
  getSecurityLogDetail,
  generateSampleSecurityEvent,
  AVAILABLE_SCENARIOS: Object.keys(SCENARIOS),
};
