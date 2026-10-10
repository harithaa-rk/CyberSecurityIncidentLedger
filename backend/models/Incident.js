const mongoose = require("mongoose");

// ─────────────────────────────────────────────────────────────────────────────
// Incident Model – Phase 3: Incident Management (Module 1)
//
// Automatically generated when the existing threat-analysis pipeline sets
// threat = true on an ingested SecurityLog.  Every incident maps 1-to-1 with
// the source SecurityLog via securityLogId (unique index → duplicate guard).
// ─────────────────────────────────────────────────────────────────────────────

const activityHistoryEntrySchema = new mongoose.Schema(
  {
    action: { type: String, required: true, trim: true },
    description: {
      type: String,
      trim: true,
      default: function () {
        return this.note || "";
      },
    },
    note: {
      type: String,
      trim: true,
      default: function () {
        return this.description || "";
      },
    },
    performedBy: { type: String, trim: true, default: "system" },
    performedAt: {
      type: Date,
      default: Date.now,
    },
    timestamp: {
      type: Date,
      default: function () {
        return this.performedAt || Date.now();
      },
    },
  },
  { _id: false }
);

const investigationNoteSchema = new mongoose.Schema(
  {
    note: { type: String, required: true, trim: true },
    author: { type: String, required: true, trim: true },
    authorId: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },
    timestamp: { type: Date, default: Date.now },
  },
  { _id: true }
);

const incidentSchema = new mongoose.Schema(
  {
    // ── Unique Incident Identifier ────────────────────────────────────────────
    incidentId: {
      type: String,
      required: true,
      unique: true,
      index: true,
      immutable: true,   // never update after creation
    },

    // ── Backlink to Source SecurityLog ────────────────────────────────────────
    securityLogId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "SecurityLog",
      required: true,
      unique: true,      // ONE incident per security log → duplicate guard
      index: true,
      immutable: true,
    },

    // ── Human-Readable Summary ────────────────────────────────────────────────
    title: {
      type: String,
      required: true,
      trim: true,
    },
    description: {
      type: String,
      trim: true,
      default: "",
    },

    // ── Original Event Metadata (copied from SecurityLog) ─────────────────────
    timestamp: {
      type: Date,
      required: true,
      index: true,
    },
    source: {
      type: String,
      trim: true,
      default: "Security Monitor",
    },

    // ── Threat Intelligence Fields (from AI analysis) ─────────────────────────
    threat: {
      type: Boolean,
      default: true,     // incidents are always threat = true
    },
    threatCategory: {
      type: String,
      trim: true,
      default: "General",
      index: true,
    },
    attackType: {
      type: String,
      trim: true,
      required: true,
      index: true,
    },
    severity: {
      type: String,
      enum: ["LOW", "MEDIUM", "HIGH", "CRITICAL"],
      required: true,
      index: true,
    },
    riskScore: {
      type: Number,
      min: 0,
      max: 100,
      default: 0,
    },

    // ── Network Context ───────────────────────────────────────────────────────
    sourceIP: {
      type: String,
      trim: true,
      default: "0.0.0.0",
    },
    destinationIP: {
      type: String,
      trim: true,
      default: "0.0.0.0",
    },
    eventId: {
      type: String,
      trim: true,
      default: null,
    },
    protocol: {
      type: String,
      trim: true,
      default: "TCP",
    },

    // ── Telemetry Provenance & Live Collector Traceability ───────────────────
    dataOrigin: {
      type: String,
      enum: ["REAL", "SAMPLE", "TEST", "UNKNOWN"],
      default: "UNKNOWN",
      index: true,
    },
    collectionMethod: {
      type: String,
      default: "UNKNOWN",
      trim: true,
      index: true,
    },
    collectorHost: {
      type: String,
      default: "",
      trim: true,
    },
    eventRecordId: {
      type: String,
      default: "",
      trim: true,
    },
    providerName: {
      type: String,
      default: "",
      trim: true,
    },
    logName: {
      type: String,
      default: "",
      trim: true,
    },
    receivedAt: {
      type: Date,
      default: Date.now,
    },

    // ── AI Analysis Output ────────────────────────────────────────────────────
    aiExplanation: {
      type: String,
      trim: true,
      default: "",
    },
    recommendedAction: {
      type: String,
      trim: true,
      default: "",
    },

    // ══ Incident Management Fields ════════════════════════════════════════════

    status: {
      type: String,
      enum: ["NEW", "ASSIGNED", "INVESTIGATING", "RESOLVED", "ARCHIVED"],
      default: "NEW",
      required: true,
      index: true,
    },
    assignedTo: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },
    assignedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },
    assignedAt: {
      type: Date,
      default: null,
    },

    // ══ Investigation Fields ══════════════════════════════════════════════════

    investigationStartedAt: {
      type: Date,
      default: null,
    },
    investigationNotes: {
      type: String,
      trim: true,
      default: "",
    },
    notes: {
      type: [investigationNoteSchema],
      default: [],
    },

    // ══ Resolution Fields ═════════════════════════════════════════════════════

    resolutionSummary: {
      type: String,
      trim: true,
      default: "",
    },
    rootCause: {
      type: String,
      trim: true,
      default: "",
    },
    actionTaken: {
      type: String,
      trim: true,
      default: "",
    },
    resolvedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },
    resolvedAt: {
      type: Date,
      default: null,
    },

    // ══ Archive Fields ════════════════════════════════════════════════════════

    archivedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },
    archivedAt: {
      type: Date,
      default: null,
    },

    // ══ Audit Trail ═══════════════════════════════════════════════════════════

    activityHistory: {
      type: [activityHistoryEntrySchema],
      default: [],
    },
  },
  {
    timestamps: true,   // adds createdAt + updatedAt automatically
    toJSON: {
      transform: function (doc, ret) {
        delete ret.__v;
        return ret;
      },
    },
  }
);

// ── Compound Indexes ──────────────────────────────────────────────────────────
incidentSchema.index({ createdAt: -1, severity: 1, status: 1 });
incidentSchema.index({ status: 1, severity: 1, attackType: 1 });

// ── Safety net: auto-generate incidentId if somehow not set ──────────────────
// Normal creation always goes through incidentService.generateIncidentId().
incidentSchema.pre("validate", async function () {
  if (!this.incidentId) {
    const d = new Date();
    const pad = (n, l = 2) => String(n).padStart(l, "0");
    const datePart = `${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}`;
    const randomSuffix = Math.floor(Math.random() * 999999).toString().padStart(6, "0");
    this.incidentId = `INC-${datePart}-${randomSuffix}`;
  }
});

// ── Read-Only Enforcement for Archived Incidents ──────────────────────────────
incidentSchema.post("init", function () {
  this._originalStatus = this.status;
});

incidentSchema.pre("save", async function () {
  if (this._originalStatus === "ARCHIVED") {
    const err = new Error("Archived incidents are read-only and cannot be modified.");
    err.name = "ArchivedIncidentError";
    throw err;
  }
});

const Incident = mongoose.model("Incident", incidentSchema);

module.exports = Incident;
