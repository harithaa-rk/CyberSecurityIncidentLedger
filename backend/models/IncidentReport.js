const mongoose = require("mongoose");
const crypto = require("crypto");

// ─────────────────────────────────────────────────────────────────────────────
// IncidentReport Model – Phase 5: Automated Incident Report Generation
//
// Represents an official-style, verifiable incident report document.
// Identifiers (reportId, reportNumber) are generated strictly on the server.
// ─────────────────────────────────────────────────────────────────────────────

const reportEvidenceItemSchema = new mongoose.Schema(
  {
    evidenceId: { type: String, required: true },
    fileName: { type: String, default: "Not Available" },
    fileType: { type: String, default: "Not Available" },
    mimeType: { type: String, default: "Not Available" },
    fileSize: { type: Number, default: 0 },
    collectionTimestamp: { type: Date, default: null },
    sha256Hash: { type: String, default: "Not Available" },
    ipfsCid: { type: String, default: "Not Available" },
    fabricTransactionId: { type: String, default: "Not Available" },
    fabricRecordedAt: { type: Date, default: null },
    verificationStatus: {
      type: String,
      enum: ["NOT_VERIFIED", "VERIFIED", "TAMPERED", "Not Available"],
      default: "NOT_VERIFIED",
    },
  },
  { _id: false }
);

const incidentReportSchema = new mongoose.Schema(
  {
    // ── Unique Identifiers (Server Generated) ────────────────────────────────
    reportId: {
      type: String,
      required: true,
      unique: true,
      index: true,
      immutable: true,
    },
    incidentId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Incident",
      required: true,
      index: true,
      immutable: true,
    },
    incidentIdentifier: {
      type: String,
      required: true,
      trim: true,
      index: true,
    },
    reportNumber: {
      type: String,
      required: true,
      unique: true,
      index: true,
      immutable: true, // CSR-YYYYMMDD-XXXXXX
    },

    // ── Organization Context ──────────────────────────────────────────────────
    organizationName: {
      type: String,
      trim: true,
      default: "Cybersecurity Operations Center",
    },
    organizationId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Organization",
      default: null,
      index: true,
    },

    // ── Incident Telemetry & Overview ─────────────────────────────────────────
    incidentTitle: {
      type: String,
      required: true,
      trim: true,
    },
    incidentType: {
      type: String,
      trim: true,
      default: "Security Incident",
    },
    threatCategory: {
      type: String,
      trim: true,
      default: "General Threat",
    },
    attackType: {
      type: String,
      required: true,
      trim: true,
    },
    severity: {
      type: String,
      enum: ["LOW", "MEDIUM", "HIGH", "CRITICAL"],
      required: true,
      default: "MEDIUM",
    },
    riskScore: {
      type: Number,
      min: 0,
      max: 100,
      default: 0,
    },
    incidentDetectedAt: {
      type: Date,
      required: true,
      default: Date.now,
    },
    incidentResolvedAt: {
      type: Date,
      default: null,
    },

    // ── Network Details ───────────────────────────────────────────────────────
    source: {
      type: String,
      trim: true,
      default: "Security Monitor",
    },
    sourceIP: {
      type: String,
      trim: true,
      default: "Not Available",
    },
    destinationIP: {
      type: String,
      trim: true,
      default: "Not Available",
    },
    sourcePort: {
      type: Number,
      default: 0,
    },
    destinationPort: {
      type: Number,
      default: 0,
    },
    protocol: {
      type: String,
      trim: true,
      default: "TCP",
    },

    // ── AI Threat Analysis & Report Summary ───────────────────────────────────
    aiSummary: {
      type: String,
      trim: true,
      default: "Not Available",
    },
    aiExplanation: {
      type: String,
      trim: true,
      default: "Not Available",
    },
    recommendedAction: {
      type: String,
      trim: true,
      default: "Not Available",
    },

    // ── Investigation & Resolution Data ───────────────────────────────────────
    investigationSummary: {
      type: String,
      trim: true,
      default: "Not Available",
    },
    rootCause: {
      type: String,
      trim: true,
      default: "Not Available",
    },
    actionTaken: {
      type: String,
      trim: true,
      default: "Not Available",
    },
    resolutionSummary: {
      type: String,
      trim: true,
      default: "Not Available",
    },

    // ── Evidence & Blockchain Integrity Data ──────────────────────────────────
    evidenceCount: {
      type: Number,
      default: 0,
    },
    evidenceList: {
      type: [reportEvidenceItemSchema],
      default: [],
    },

    // ── Generation Metadata ───────────────────────────────────────────────────
    generatedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },
    generatedByName: {
      type: String,
      trim: true,
      default: "System Administrator",
    },
    generatedAt: {
      type: Date,
      default: Date.now,
    },

    // ── Authenticity & Digital Verification ───────────────────────────────────
    digitalSealId: {
      type: String,
      trim: true,
      default: null, // SEAL-YYYYMMDD-XXXXXXXX
    },
    qrVerificationId: {
      type: String,
      trim: true,
      default: null, // VRF-YYYYMMDD-XXXXXXXX
    },
    verificationUrl: {
      type: String,
      trim: true,
      default: null,
    },
    pdfPath: {
      type: String,
      trim: true,
      default: null, // internal UUID storage filename
    },
    reportHash: {
      type: String,
      trim: true,
      default: null, // 64 hex character SHA-256 of completed PDF
    },

    // ── Lifecycle Status ──────────────────────────────────────────────────────
    status: {
      type: String,
      enum: ["DRAFT", "GENERATING", "GENERATED", "VERIFIED", "REVOKED"],
      default: "GENERATING",
      index: true,
    },
  },
  {
    timestamps: true,
    toJSON: {
      transform: function (doc, ret) {
        // Never expose internal filesystem storage paths to client
        delete ret.pdfPath;
        delete ret.__v;
        return ret;
      },
    },
  }
);

// ── Indexes ──────────────────────────────────────────────────────────────────
incidentReportSchema.index({ incidentId: 1, createdAt: -1 });
incidentReportSchema.index({ organizationId: 1, createdAt: -1 });

// ── Automatic Identifier Generator Pre-Validate Hook ─────────────────────────
incidentReportSchema.pre("validate", function () {
  const d = this.generatedAt || new Date();
  const year = d.getUTCFullYear();
  const month = String(d.getUTCMonth() + 1).padStart(2, "0");
  const day = String(d.getUTCDate()).padStart(2, "0");
  const dateStr = `${year}${month}${day}`;

  if (!this.reportId) {
    const rand = crypto.randomBytes(3).readUIntBE(0, 3) % 1_000_000;
    this.reportId = `REP-${dateStr}-${String(rand).padStart(6, "0")}`;
  }

  if (!this.reportNumber) {
    const rand = crypto.randomBytes(3).readUIntBE(0, 3) % 1_000_000;
    this.reportNumber = `CSR-${dateStr}-${String(rand).padStart(6, "0")}`;
  }
});

const IncidentReport = mongoose.model("IncidentReport", incidentReportSchema);

module.exports = IncidentReport;
