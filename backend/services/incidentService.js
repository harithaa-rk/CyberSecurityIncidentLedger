const crypto = require("crypto");
const Incident = require("../models/Incident");
const User = require("../models/User");
const SecurityLog = require("../models/SecurityLog");

// ─────────────────────────────────────────────────────────────────────────────
// Incident Service – Phase 3: Module 1 – Automatic Incident Creation
//
// This service is the ONLY place where incidents are created.  It is called
// by logIngestionService.js immediately after a SecurityLog is saved with
// threat = true.  It must never be called from the frontend.
// ─────────────────────────────────────────────────────────────────────────────

let ioInstance = null;

/**
 * Provide the Socket.IO server instance so this service can broadcast
 * incident:new events.  Called once from server.js during bootstrap.
 * @param {object} io - Socket.IO server instance
 */
function setIncidentSocketIO(io) {
  ioInstance = io;
}

// ── Atomic counter helpers ────────────────────────────────────────────────────
// Mongo does not have auto-increment.  We generate a sequential-looking suffix
// using the current UTC second within the day (0-86399) padded to 6 digits,
// XOR-ed with a random byte for uniqueness, keeping collisions astronomically
// rare while preserving the human-readable INC-YYYYMMDD-XXXXXX format.

/**
 * Generates a unique Incident ID: INC-YYYYMMDD-XXXXXX
 * The six-digit suffix is derived from a cryptographically random 3-byte
 * value truncated to 6 decimal digits, then zero-padded.
 *
 * Example: INC-20260908-047291
 *
 * @param {Date} [date=new Date()]
 * @returns {string}
 */
function generateIncidentId(date = new Date()) {
  const d = new Date(date);
  const year  = d.getUTCFullYear();
  const month = String(d.getUTCMonth() + 1).padStart(2, "0");
  const day   = String(d.getUTCDate()).padStart(2, "0");

  // 3 random bytes → integer 0-16777215 → modulo 1,000,000 → zero-pad to 6
  const randomInt = crypto.randomBytes(3).readUIntBE(0, 3) % 1_000_000;
  const suffix    = String(randomInt).padStart(6, "0");

  return `INC-${year}${month}${day}-${suffix}`;
}

/**
 * Derives a human-readable incident title from attack type and severity.
 * @param {string} attackType
 * @param {string} severity
 * @returns {string}
 */
function buildIncidentTitle(attackType, severity) {
  // Replace underscores with spaces, title-case each word
  const readable = String(attackType)
    .replace(/_/g, " ")
    .toLowerCase()
    .replace(/\b\w/g, (c) => c.toUpperCase());
  return `${readable} Detected`;
}

// ─────────────────────────────────────────────────────────────────────────────
// Core: Create Incident from a saved SecurityLog document
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Attempts to create a new Incident for the given SecurityLog.
 * Rules:
 *  - Only creates when savedLog.threat === true
 *  - Deduplicates via securityLogId unique index
 *  - Status always starts as "NEW"
 *  - Emits incident:new over Socket.IO on success
 *
 * @param {import("mongoose").Document} savedLog - Saved SecurityLog document
 * @returns {Promise<import("mongoose").Document|null>} - Created Incident or null
 */
async function createIncidentFromLog(savedLog) {
  if (!savedLog || savedLog.threat !== true) {
    // Not a threat – do not create an incident
    return null;
  }

  const logId = savedLog._id;

  console.log(`[INCIDENT] Threat detected – SecurityLog ${savedLog.incidentId} (threat=true, severity=${savedLog.severity})`);

  // ── Duplicate Prevention ─────────────────────────────────────────────────
  const existing = await Incident.findOne({ securityLogId: logId }).lean();
  if (existing) {
    console.log(`[INCIDENT] Incident already exists for securityLogId: ${logId} → ${existing.incidentId}`);
    try {
      await SecurityLog.findByIdAndUpdate(logId, {
        createdIncidentId: existing.incidentId,
        incidentRef: existing._id,
      });
      if (savedLog && typeof savedLog === "object") {
        savedLog.createdIncidentId = existing.incidentId;
        savedLog.incidentRef = existing._id;
      }
    } catch (e) {
      console.warn(`[INCIDENT] Failed to update SecurityLog link: ${e.message}`);
    }
    return existing;
  }

  // ── Generate Unique Incident ID ──────────────────────────────────────────
  console.log(`[INCIDENT] Creating incident for SecurityLog ${savedLog.incidentId}`);

  // Retry loop in the extreme-edge-case that a collision hits the unique index
  let incidentId;
  let attempt = 0;
  while (attempt < 5) {
    incidentId = generateIncidentId(savedLog.timestamp || new Date());
    const collision = await Incident.findOne({ incidentId }).lean();
    if (!collision) break;
    attempt++;
  }

  // ── Build Incident Document ───────────────────────────────────────────────
  const title = buildIncidentTitle(savedLog.attackType, savedLog.severity);

  const incidentData = {
    incidentId,
    securityLogId: savedLog._id,
    title,
    description: savedLog.explanation || savedLog.message || "",

    // Original event metadata
    timestamp: savedLog.timestamp,
    source: savedLog.source,

    // Threat intelligence (from AI analysis stored on SecurityLog)
    threat: true,
    threatCategory: savedLog.threatCategory || "General",
    attackType: savedLog.attackType,
    severity: savedLog.severity,
    riskScore: savedLog.riskScore,

    // Network context
    sourceIP: savedLog.sourceIP,
    destinationIP: savedLog.destinationIP,
    eventId: savedLog.eventId || null,
    protocol: savedLog.protocol,

    // Telemetry provenance & traceability
    dataOrigin: savedLog.dataOrigin || "UNKNOWN",
    collectionMethod: savedLog.collectionMethod || "UNKNOWN",
    collectorHost: savedLog.collectorHost || "",
    eventRecordId: savedLog.eventRecordId || (savedLog.windowsEventData?.recordId ? String(savedLog.windowsEventData.recordId) : ""),
    providerName: savedLog.providerName || (savedLog.windowsEventData?.provider || ""),
    logName: savedLog.logName || (savedLog.windowsEventData?.channel || ""),
    receivedAt: savedLog.receivedAt || new Date(),

    // AI analysis output
    aiExplanation: savedLog.explanation || "",
    recommendedAction: savedLog.recommendedAction || "",

    // Incident management – always starts NEW, never assigned automatically
    status: "NEW",
    assignedTo: null,
    assignedBy: null,
    assignedAt: null,

    // Activity history – seed with creation event
    activityHistory: [
      {
        action: "INCIDENT_CREATED",
        description: `Automatically created from SecurityLog ${savedLog.incidentId} (${savedLog.attackType}, Risk: ${savedLog.riskScore})`,
        note: `Automatically created from SecurityLog ${savedLog.incidentId} (${savedLog.attackType}, Risk: ${savedLog.riskScore})`,
        performedBy: "system",
        performedAt: new Date(),
        timestamp: new Date(),
      },
    ],
  };

  const incident = new Incident(incidentData);
  const saved = await incident.save();

  console.log(`[INCIDENT] Incident created: ${saved.incidentId} [${saved.severity}] Status=${saved.status}`);

  // ── Link Incident to Source SecurityLog ───────────────────────────────────
  try {
    await SecurityLog.findByIdAndUpdate(savedLog._id, {
      createdIncidentId: saved.incidentId,
      incidentRef: saved._id,
    });
    if (savedLog && typeof savedLog === "object") {
      savedLog.createdIncidentId = saved.incidentId;
      savedLog.incidentRef = saved._id;
    }
  } catch (linkErr) {
    console.warn(`[INCIDENT] Failed to update SecurityLog with createdIncidentId: ${linkErr.message}`);
  }

  // ── Emit Socket.IO Event ──────────────────────────────────────────────────
  if (ioInstance) {
    ioInstance.emit("incident:new", saved.toJSON());
    console.log(`[SOCKET] incident:new emitted for ${saved.incidentId}`);
  }

  return saved;
}

// ─────────────────────────────────────────────────────────────────────────────
// Query Helpers & Lifecycle Methods (used by incidentController.js)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Computes live summary statistics for incident counters.
 * @returns {Promise<object>}
 */
async function getIncidentStats() {
  const [
    total,
    newCount,
    assignedCount,
    investigatingCount,
    resolvedCount,
    archivedCount,
    criticalCount,
    highCount,
  ] = await Promise.all([
    Incident.countDocuments(),
    Incident.countDocuments({ status: "NEW" }),
    Incident.countDocuments({
      $or: [
        { status: "ASSIGNED" },
        { assignedTo: { $ne: null }, status: { $in: ["NEW", "ASSIGNED"] } },
      ],
    }),
    Incident.countDocuments({ status: "INVESTIGATING" }),
    Incident.countDocuments({ status: "RESOLVED" }),
    Incident.countDocuments({ status: "ARCHIVED" }),
    Incident.countDocuments({ severity: "CRITICAL" }),
    Incident.countDocuments({ severity: "HIGH" }),
  ]);

  return {
    total,
    new: newCount,
    assigned: assignedCount,
    investigating: investigatingCount,
    resolved: resolvedCount,
    archived: archivedCount,
    critical: criticalCount,
    high: highCount,
  };
}

/**
 * List incidents with pagination, filters, sorting, and search.
 * @param {object} queryParams
 * @returns {Promise<object>}
 */
async function listIncidents(queryParams = {}) {
  const page  = Math.max(1, parseInt(queryParams.page, 10)  || 1);
  const limit = Math.min(100, Math.max(1, parseInt(queryParams.limit, 10) || 20));
  const skip  = (page - 1) * limit;

  const filter = {};

  // By default, show active incidents (NEW, ASSIGNED, INVESTIGATING, RESOLVED).
  // Do not show ARCHIVED incidents in the default active list unless explicitly requested.
  const statusParam = (queryParams.status || "").trim().toUpperCase();
  if (!statusParam || statusParam === "ALL" || statusParam === "ACTIVE") {
    if (queryParams.includeArchived !== "true" && queryParams.includeArchived !== true) {
      filter.status = { $in: ["NEW", "ASSIGNED", "INVESTIGATING", "RESOLVED"] };
    }
  } else if (statusParam === "ARCHIVED") {
    filter.status = "ARCHIVED";
  } else if (statusParam === "ASSIGNED") {
    filter.$or = [
      { status: "ASSIGNED" },
      { assignedTo: { $ne: null }, status: { $in: ["NEW", "ASSIGNED"] } },
    ];
  } else {
    filter.status = statusParam;
  }

  // Severity filter
  if (queryParams.severity && queryParams.severity !== "All") {
    filter.severity = queryParams.severity.toUpperCase();
  }

  // Attack type filter
  if (queryParams.attackType && queryParams.attackType !== "All") {
    filter.attackType = new RegExp(`^${queryParams.attackType}$`, "i");
  }

  // Threat category filter
  if (queryParams.threatCategory && queryParams.threatCategory !== "All") {
    filter.threatCategory = new RegExp(`^${queryParams.threatCategory}$`, "i");
  }

  // Assigned analyst filter
  if (queryParams.assignedTo && queryParams.assignedTo !== "All") {
    if (queryParams.assignedTo === "unassigned") {
      filter.assignedTo = null;
    } else {
      filter.assignedTo = queryParams.assignedTo;
    }
  }

  // Date range filter
  if (queryParams.startDate || queryParams.endDate) {
    filter.timestamp = {};
    if (queryParams.startDate) {
      filter.timestamp.$gte = new Date(queryParams.startDate);
    }
    if (queryParams.endDate) {
      const end = new Date(queryParams.endDate);
      end.setHours(23, 59, 59, 999);
      filter.timestamp.$lte = end;
    }
  }

  // Search filter (Incident ID, Threat Title, Description, IPs, Attack Type, Threat Category, Source)
  if (queryParams.search && queryParams.search.trim()) {
    const regex = new RegExp(queryParams.search.trim(), "i");
    const searchOr = [
      { incidentId: regex },
      { title: regex },
      { description: regex },
      { sourceIP: regex },
      { destinationIP: regex },
      { attackType: regex },
      { threatCategory: regex },
      { source: regex },
    ];
    if (filter.$or) {
      filter.$and = [{ $or: filter.$or }, { $or: searchOr }];
      delete filter.$or;
    } else {
      filter.$or = searchOr;
    }
  }

  // Sorting
  let sortOption = { createdAt: -1 }; // default Newest
  if (queryParams.sort === "oldest") {
    sortOption = { createdAt: 1 };
  } else if (queryParams.sort === "risk") {
    sortOption = { riskScore: -1, createdAt: -1 };
  } else if (queryParams.sort === "severity") {
    // Custom aggregation sorting for severity weight
    const [stats, count, incidents] = await Promise.all([
      getIncidentStats(),
      Incident.countDocuments(filter),
      Incident.aggregate([
        { $match: filter },
        {
          $addFields: {
            sevWeight: {
              $switch: {
                branches: [
                  { case: { $eq: ["$severity", "CRITICAL"] }, then: 4 },
                  { case: { $eq: ["$severity", "HIGH"] }, then: 3 },
                  { case: { $eq: ["$severity", "MEDIUM"] }, then: 2 },
                  { case: { $eq: ["$severity", "LOW"] }, then: 1 },
                ],
                default: 0,
              },
            },
          },
        },
        { $sort: { sevWeight: -1, createdAt: -1 } },
        { $skip: skip },
        { $limit: limit },
        {
          $lookup: {
            from: "users",
            localField: "assignedTo",
            foreignField: "_id",
            as: "assignedToUser",
          },
        },
        {
          $addFields: {
            assignedTo: { $arrayElemAt: ["$assignedToUser", 0] },
          },
        },
        {
          $project: {
            assignedToUser: 0,
            sevWeight: 0,
            "assignedTo.password": 0,
          },
        },
      ]),
    ]);

    return {
      incidents,
      total: count,
      page,
      limit,
      totalPages: Math.ceil(count / limit) || 1,
      stats,
    };
  }

  const [incidents, total, stats] = await Promise.all([
    Incident.find(filter)
      .populate("assignedTo", "name email role")
      .populate("assignedBy", "name email role")
      .sort(sortOption)
      .skip(skip)
      .limit(limit)
      .lean(),
    Incident.countDocuments(filter),
    getIncidentStats(),
  ]);

  return {
    incidents,
    total,
    page,
    limit,
    totalPages: Math.ceil(total / limit) || 1,
    stats,
  };
}

/**
 * Get a single incident by its MongoDB _id or human-readable incidentId.
 * Populates linked SecurityLog and user references.
 * @param {string} id
 * @returns {Promise<object|null>}
 */
async function getIncidentById(id) {
  const isObjectId = /^[0-9a-fA-F]{24}$/.test(id);
  const query = isObjectId
    ? { $or: [{ _id: id }, { securityLogId: id }] }
    : { $or: [{ incidentId: id }] };

  return Incident.findOne(query)
    .populate("assignedTo", "name email role")
    .populate("assignedBy", "name email role")
    .populate("resolvedBy", "name email role")
    .populate("archivedBy", "name email role")
    .populate("securityLogId")
    .lean();
}

/**
 * Assign or reassign an incident to an analyst.
 * @param {string} id - Incident ID or ObjectId
 * @param {object} payload - { analystId, assignedByUserId, assignedByName, note }
 * @returns {Promise<object>}
 */
async function assignIncident(id, payload = {}) {
  const isObjectId = /^[0-9a-fA-F]{24}$/.test(id);
  const incident = await Incident.findOne(isObjectId ? { _id: id } : { incidentId: id });

  if (!incident) {
    throw new Error("Incident not found.");
  }

  // Read-only guard: Archived incidents cannot be assigned or reassigned
  if (incident.status === "ARCHIVED") {
    throw new Error("Cannot assign or reassign an archived incident. Archived incidents are read-only.");
  }

  const { analystId, assignedByUserId, assignedByName = "Admin", note = "" } = payload;

  const User = require("../models/User");
  let analystDoc = null;
  let previousAnalyst = null;

  if (incident.assignedTo) {
    previousAnalyst = await User.findById(incident.assignedTo).select("name email role").lean();
  }

  if (analystId) {
    analystDoc = await User.findById(analystId).select("name email role isActive").lean();
    if (!analystDoc) {
      throw new Error("Selected analyst not found.");
    }

    // Strict validation: target user must have the Analyst role
    if (analystDoc.role !== "Analyst") {
      throw new Error(`Selected user (${analystDoc.name}) does not have the Analyst role. Role is: ${analystDoc.role}.`);
    }

    const isReassignment = previousAnalyst && previousAnalyst._id.toString() !== analystDoc._id.toString();

    incident.assignedTo = analystDoc._id;
    incident.assignedBy = assignedByUserId || null;
    incident.assignedAt = new Date();

    if (incident.status === "NEW") {
      incident.status = "ASSIGNED";
    }

    // Record assignment or reassignment in activityHistory without losing previous history
    const assignTime = new Date();
    if (isReassignment) {
      const desc = `Incident assigned from ${previousAnalyst.name} to ${analystDoc.name}.${note ? " " + note : ""}`.trim();
      incident.activityHistory.push({
        action: "INCIDENT_REASSIGNED",
        description: desc,
        note: desc,
        performedBy: assignedByName,
        performedAt: assignTime,
        timestamp: assignTime,
      });
    } else {
      const desc = `Incident assigned to ${analystDoc.name} (${analystDoc.email}).${note ? " " + note : ""}`.trim();
      incident.activityHistory.push({
        action: "INCIDENT_ASSIGNED",
        description: desc,
        note: desc,
        performedBy: assignedByName,
        performedAt: assignTime,
        timestamp: assignTime,
      });
    }
  } else {
    // Unassign
    const prevName = previousAnalyst ? previousAnalyst.name : "Analyst";
    incident.assignedTo = null;
    incident.assignedBy = null;
    incident.assignedAt = null;
    if (incident.status === "ASSIGNED") {
      incident.status = "NEW";
    }

    const unassignTime = new Date();
    const desc = `Incident unassigned from ${prevName}.${note ? " " + note : ""}`.trim();
    incident.activityHistory.push({
      action: "INCIDENT_UNASSIGNED",
      description: desc,
      note: desc,
      performedBy: assignedByName,
      performedAt: unassignTime,
      timestamp: unassignTime,
    });
  }

  await incident.save();

  const populated = await getIncidentById(incident.incidentId);

  if (ioInstance) {
    ioInstance.emit("incident:updated", populated);
  }

  return populated;
}

/**
 * Transition incident from ASSIGNED to INVESTIGATING status.
 * Records investigationStartedAt and an entry in activityHistory.
 * @param {string} id
 * @param {object} payload - { userId, userName, notes }
 * @returns {Promise<object>}
 */
async function startInvestigation(id, payload = {}) {
  const isObjectId = /^[0-9a-fA-F]{24}$/.test(id);
  const incident = await Incident.findOne(isObjectId ? { _id: id } : { incidentId: id });

  if (!incident) {
    throw new Error("Incident not found.");
  }

  // Read-only guard: Archived incidents cannot be transitioned to investigation
  if (incident.status === "ARCHIVED") {
    throw new Error("Cannot modify investigation status on an archived incident. Archived incidents are read-only.");
  }

  const { userId, userName = "Analyst", notes = "" } = payload;
  const startedAt = new Date();

  incident.status = "INVESTIGATING";
  if (!incident.investigationStartedAt) {
    incident.investigationStartedAt = startedAt;
  }
  if (notes && notes.trim()) {
    incident.investigationNotes = incident.investigationNotes
      ? `${incident.investigationNotes}\n[${startedAt.toISOString()}] ${notes.trim()}`
      : `[${startedAt.toISOString()}] ${notes.trim()}`;
  }

  const desc = notes && notes.trim()
    ? `Investigation started. Note: ${notes.trim()}`
    : "Investigation started by analyst.";

  incident.activityHistory.push({
    action: "INVESTIGATION_STARTED",
    description: desc,
    note: desc,
    performedBy: userName,
    performedAt: startedAt,
    timestamp: startedAt,
  });

  await incident.save();

  const populated = await getIncidentById(incident.incidentId);

  if (ioInstance) {
    ioInstance.emit("incident:updated", populated);
  }

  return populated;
}

/**
 * Backward compatibility alias for startInvestigation
 */
const investigateIncident = startInvestigation;

/**
 * Add an investigation note to an active incident.
 * @param {string} id
 * @param {object} payload - { note, author, authorId, userName }
 * @returns {Promise<object>}
 */
async function addInvestigationNote(id, payload = {}) {
  const isObjectId = /^[0-9a-fA-F]{24}$/.test(id);
  const incident = await Incident.findOne(isObjectId ? { _id: id } : { incidentId: id });

  if (!incident) {
    throw new Error("Incident not found.");
  }

  // Read-only guard: Archived incidents cannot have notes added
  if (incident.status === "ARCHIVED") {
    throw new Error("Cannot add investigation notes to an archived incident. Archived incidents are read-only.");
  }

  const { note = "", author = "", authorId = null, userName = "Analyst" } = payload;
  const trimmedNote = String(note || "").trim();

  if (!trimmedNote) {
    throw new Error("Investigation note cannot be empty.");
  }

  const resolvedAuthor = (author && author.trim()) || (userName && userName.trim()) || "Analyst";
  const timestamp = new Date();

  // 1. Structured notes array
  if (!incident.notes) {
    incident.notes = [];
  }
  incident.notes.push({
    note: trimmedNote,
    author: resolvedAuthor,
    authorId: authorId || null,
    timestamp,
  });

  // 2. Legacy investigationNotes string
  const formattedNote = `[${timestamp.toISOString()} - ${resolvedAuthor}] ${trimmedNote}`;
  incident.investigationNotes = incident.investigationNotes
    ? `${incident.investigationNotes}\n\n${formattedNote}`
    : formattedNote;

  // 3. Activity History entry with action, description, performedBy, performedAt
  incident.activityHistory.push({
    action: "NOTE_ADDED",
    description: trimmedNote,
    note: trimmedNote,
    performedBy: resolvedAuthor,
    performedAt: timestamp,
    timestamp,
  });

  await incident.save();

  const populated = await getIncidentById(incident.incidentId);

  if (ioInstance) {
    ioInstance.emit("incident:updated", populated);
  }

  return populated;
}

/**
 * Transition incident to RESOLVED status.
 * @param {string} id
 * @param {object} payload - { userId, userName, resolutionSummary, rootCause, actionTaken }
 * @returns {Promise<object>}
 */
async function resolveIncident(id, payload = {}) {
  const isObjectId = /^[0-9a-fA-F]{24}$/.test(id);
  const incident = await Incident.findOne(isObjectId ? { _id: id } : { incidentId: id });

  if (!incident) {
    throw new Error("Incident not found.");
  }

  // Read-only guard: Archived incidents cannot have resolution details modified
  if (incident.status === "ARCHIVED") {
    throw new Error("Cannot modify resolution details on an archived incident. Archived incidents are read-only.");
  }

  const {
    userId,
    userName = "Analyst",
    resolutionSummary = "",
    rootCause = "",
    actionTaken = "",
  } = payload;

  if (!resolutionSummary.trim()) {
    throw new Error("Resolution summary is required.");
  }

  const resolvedTime = new Date();
  incident.status = "RESOLVED";
  incident.resolvedBy = userId || null;
  incident.resolvedAt = resolvedTime;
  incident.resolutionSummary = resolutionSummary.trim();
  incident.rootCause = rootCause.trim();
  incident.actionTaken = actionTaken.trim();

  const desc = `Resolved. Summary: ${resolutionSummary}. Root cause: ${rootCause || "N/A"}. Action: ${actionTaken || "N/A"}`;
  incident.activityHistory.push({
    action: "INCIDENT_RESOLVED",
    description: desc,
    note: desc,
    performedBy: userName,
    performedAt: resolvedTime,
    timestamp: resolvedTime,
  });

  await incident.save();

  const populated = await getIncidentById(incident.incidentId);

  if (ioInstance) {
    ioInstance.emit("incident:updated", populated);
  }

  return populated;
}

/**
 * Transition incident to ARCHIVED status.
 * @param {string} id
 * @param {object} payload - { userId, userName, note }
 * @returns {Promise<object>}
 */
async function archiveIncident(id, payload = {}) {
  const isObjectId = /^[0-9a-fA-F]{24}$/.test(id);
  const incident = await Incident.findOne(isObjectId ? { _id: id } : { incidentId: id });

  if (!incident) {
    throw new Error("Incident not found.");
  }

  // Transition Rule: Only allow RESOLVED -> ARCHIVED. Reject all other transitions.
  if (incident.status !== "RESOLVED") {
    throw new Error(`Only RESOLVED incidents can be archived. Current status is ${incident.status}.`);
  }

  const { userId, userName = "Admin", note = "" } = payload;
  const archiveTime = new Date();

  incident.status = "ARCHIVED";
  incident.archivedBy = userId || null;
  incident.archivedAt = archiveTime;

  const desc = note && note.trim()
    ? `Incident archived. ${note.trim()}`
    : "Incident permanently archived in ledger audit records.";
  incident.activityHistory.push({
    action: "INCIDENT_ARCHIVED",
    description: desc,
    note: desc,
    performedBy: userName,
    performedAt: archiveTime,
    timestamp: archiveTime,
  });

  await incident.save();

  const populated = await getIncidentById(incident.incidentId);

  if (ioInstance) {
    ioInstance.emit("incident:updated", populated);
  }

  return populated;
}

/**
 * Fetch all eligible analysts for incident assignment.
 * Strictly filters users with role "Analyst" who are active.
 * @returns {Promise<Array>}
 */
async function getEligibleAnalysts() {
  const User = require("../models/User");
  return User.find({
    role: "Analyst",
    $or: [{ isActive: true }, { isActive: { $exists: false } }],
  })
    .select("_id name email role")
    .sort({ name: 1 })
    .lean();
}

module.exports = {
  setIncidentSocketIO,
  generateIncidentId,
  createIncidentFromLog,
  listIncidents,
  getIncidentById,
  getIncidentStats,
  assignIncident,
  investigateIncident,
  startInvestigation,
  addInvestigationNote,
  resolveIncident,
  archiveIncident,
  getEligibleAnalysts,
};
