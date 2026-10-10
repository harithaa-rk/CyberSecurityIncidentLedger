const mongoose = require("mongoose");

const securityLogSchema = new mongoose.Schema(
  {
    incidentId: {
      type: String,
      required: true,
      unique: true,
      index: true,
    },
    // Alias for incidentId for backward compatibility
    logId: {
      type: String,
      default: function () {
        return this.incidentId;
      },
    },
    timestamp: {
      type: Date,
      required: true,
      default: Date.now,
      index: true,
    },
    source: {
      type: String,
      required: true,
      trim: true,
      default: "Security Monitor",
      index: true,
    },
    eventName: {
      type: String,
      trim: true,
      default: "Security Event",
    },
    category: {
      type: String,
      trim: true,
      default: "Intrusion Detection",
    },
    attackType: {
      type: String,
      required: true,
      trim: true,
      index: true,
    },
    severity: {
      type: String,
      enum: ["LOW", "MEDIUM", "HIGH", "CRITICAL"],
      required: true,
      default: "LOW",
      index: true,
    },
    sourceIP: {
      type: String,
      required: true,
      trim: true,
      default: "127.0.0.1",
      index: true,
    },
    destinationIP: {
      type: String,
      required: true,
      trim: true,
      default: "127.0.0.1",
      index: true,
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
      default: "TCP",
      trim: true,
    },
    message: {
      type: String,
      required: true,
      trim: true,
    },
    rawLog: {
      type: String,
      default: "",
    },
    fullLog: {
      type: String,
      default: function () {
        return this.rawLog;
      },
    },
    dataOrigin: {
      type: String,
      enum: ["REAL", "SAMPLE", "TEST", "UNKNOWN"],
      default: "UNKNOWN",
      index: true,
    },
    collectionMethod: {
      type: String,
      enum: [
        "WINDOWS_EVENT_LOG",
        "SYSLOG",
        "FILE_UPLOAD",
        "TEST_GENERATOR",
        "MANUAL",
        "LOCAL_FILE",
        "API_INGEST",
        "TEST_SIMULATION",
        "UNKNOWN",
      ],
      default: "UNKNOWN",
      index: true,
    },
    receivedAt: {
      type: Date,
      default: Date.now,
      index: true,
    },
    collectorHost: {
      type: String,
      default: "",
      trim: true,
      index: true,
    },
    collectorProcess: {
      type: String,
      default: "",
      trim: true,
    },
    eventRecordId: {
      type: String,
      default: "",
      trim: true,
      index: true,
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
    eventFingerprint: {
      type: String,
      default: null,
      index: true,
    },
    hash: {
      type: String,
      required: true,
      index: true,
    },
    cid: {
      type: String,
      required: true,
      index: true,
    },
    blockchainTxId: {
      type: String,
      default: null,
      index: true,
    },
    blockNumber: {
      type: Number,
      default: null,
    },
    verificationStatus: {
      type: String,
      enum: ["Verified", "Tampered", "Unverified"],
      default: "Verified",
      index: true,
    },
    status: {
      type: String,
      enum: ["NEW", "INVESTIGATING", "RESOLVED", "ARCHIVED"],
      default: "NEW",
      index: true,
    },
    organization: {
      type: String,
      default: "CyberSecurity Inc",
      trim: true,
    },
    fileName: {
      type: String,
      default: null,
    },
    fileSize: {
      type: Number,
      default: 0,
    },
    fileType: {
      type: String,
      default: "LOCAL_FILE",
      trim: true,
    },
    fingerprint: {
      type: String,
      index: true,
    },
    eventId: {
      type: String,
      trim: true,
      default: null,
      index: true,
    },
    threat: {
      type: Boolean,
      default: false,
      index: true,
    },
    threatCategory: {
      type: String,
      trim: true,
      default: "General",
    },
    riskScore: {
      type: Number,
      default: 0,
      min: 0,
      max: 100,
    },
    explanation: {
      type: String,
      trim: true,
      default: "",
    },
    recommendedAction: {
      type: String,
      trim: true,
      default: "",
    },
    windowsEventData: {
      type: mongoose.Schema.Types.Mixed,
      default: null,
    },
    createdIncidentId: {
      type: String,
      default: null,
      trim: true,
      index: true,
    },
    incidentRef: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Incident",
      default: null,
    },
  },
  {
    timestamps: true,
    toJSON: {
      transform: function (doc, ret) {
        delete ret.__v;
        return ret;
      },
    },
  }
);

// Compound index for optimized querying
securityLogSchema.index({ createdAt: -1, severity: 1, verificationStatus: 1 });

const SecurityLog = mongoose.model("SecurityLog", securityLogSchema);

// Safe cleanup of legacy unique index on logId if present
SecurityLog.collection.dropIndex("logId_1").catch(() => {});

module.exports = SecurityLog;
