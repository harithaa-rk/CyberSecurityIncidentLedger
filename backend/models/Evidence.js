const mongoose = require("mongoose");
const crypto   = require("crypto");

// ─────────────────────────────────────────────────────────────────────────────
// Evidence Model – Phase 4 Module 1: Digital Evidence Management & Collection
//
// Each Evidence document is linked to exactly one Incident via `incidentId`.
// The `evidenceId` (EVD-YYYYMMDD-XXXXXX) is generated server-side exclusively.
// The frontend never sends evidenceId, collectedBy, or collectionTimestamp.
//
// Blockchain / IPFS fields (ipfsCid, fabricTransactionId, fabricRecordedAt)
// are stored as null until Phase 4 Module 2 (Pinata) and Module 3 (Fabric).
// ─────────────────────────────────────────────────────────────────────────────

const evidenceSchema = new mongoose.Schema(
  {
    // ── Unique Evidence Identifier ────────────────────────────────────────────
    evidenceId: {
      type:      String,
      required:  true,
      unique:    true,
      index:     true,
      immutable: true,  // never update after creation
    },

    // ── Backlink to Parent Incident ───────────────────────────────────────────
    incidentId: {
      type:     mongoose.Schema.Types.ObjectId,
      ref:      "Incident",
      required: true,
      index:    true,
    },

    // ── Storage Metadata ──────────────────────────────────────────────────────
    // fileName      – UUID-based key used on the server filesystem (never exposed)
    // originalFileName – original client filename, stored for display only
    fileName: {
      type:     String,
      required: true,
      trim:     true,
    },
    originalFileName: {
      type:     String,
      required: true,
      trim:     true,
    },
    fileType: {
      type:  String,
      trim:  true,
      default: "",
    },
    mimeType: {
      type:     String,
      required: true,
      trim:     true,
    },
    fileSize: {
      type:     Number,   // bytes
      required: true,
      min:      1,
    },
    description: {
      type:    String,
      trim:    true,
      default: "",
    },

    // ── Chain of Custody ──────────────────────────────────────────────────────
    collectedBy: {
      type:     mongoose.Schema.Types.ObjectId,
      ref:      "User",
      required: true,
      index:    true,
    },
    collectionTimestamp: {
      type:     Date,
      required: true,
      default:  Date.now,
      index:    true,
    },

    // ── Storage Pipeline Status ───────────────────────────────────────────────
    storageStatus: {
      type:    String,
      enum:    ["PENDING", "UPLOADED", "FAILED"],
      default: "PENDING",
    },
    hashStatus: {
      type:    String,
      enum:    ["PENDING", "COMPUTED", "GENERATED", "FAILED"],
      default: "PENDING",
    },

    // ── Cryptographic Integrity ───────────────────────────────────────────────
    sha256Hash: {
      type:    String,
      trim:    true,
      default: null,
    },

    // ── IPFS / Pinata (Phase 4 Module 3) ───────────────────────────────────────
    ipfsCid: {
      type:    String,
      trim:    true,
      default: null,
    },
    ipfsUploadedAt: {
      type:    Date,
      default: null,
    },

    // ── Hyperledger Fabric (Phase 4 Module 7) ─────────────────────────────────
    blockchainStatus: {
      type:    String,
      enum:    ["NOT_REGISTERED", "REGISTERING", "REGISTERED", "FAILED"],
      default: "NOT_REGISTERED",
    },
    fabricTransactionId: {
      type:    String,
      trim:    true,
      default: null,
    },
    fabricRecordedAt: {
      type:    Date,
      default: null,
    },

    // ── Verification (Phase 4 Module 8) ──────────────────────────────────────
    verificationStatus: {
      type:    String,
      enum:    ["NOT_VERIFIED", "VERIFIED", "TAMPERED"],
      default: "NOT_VERIFIED",
    },
    lastVerifiedAt: {
      type:    Date,
      default: null,
    },
    lastVerifiedBy: {
      type:    String,
      trim:    true,
      default: null,
    },
  },
  {
    timestamps: true,  // adds createdAt + updatedAt automatically
    toJSON: {
      transform: function (doc, ret) {
        // Never expose the server-side storage path to the client
        delete ret.__v;
        return ret;
      },
    },
  }
);

// ── Compound Indexes ──────────────────────────────────────────────────────────
evidenceSchema.index({ incidentId: 1, collectionTimestamp: -1 });
evidenceSchema.index({ collectedBy: 1, collectionTimestamp: -1 });

// ── Auto-generate evidenceId before validation ────────────────────────────────
// Format: EVD-YYYYMMDD-XXXXXX  (same crypto-random pattern as INC-…)
// The frontend is NEVER allowed to supply evidenceId.
evidenceSchema.pre("validate", async function () {
  if (!this.evidenceId) {
    const d = new Date();
    const year  = d.getUTCFullYear();
    const month = String(d.getUTCMonth() + 1).padStart(2, "0");
    const day   = String(d.getUTCDate()).padStart(2, "0");

    // 3 random bytes → integer 0-16777215 → modulo 1,000,000 → zero-pad to 6
    const randomInt = crypto.randomBytes(3).readUIntBE(0, 3) % 1_000_000;
    const suffix    = String(randomInt).padStart(6, "0");

    this.evidenceId = `EVD-${year}${month}${day}-${suffix}`;
  }
});

// ── Immutability Guard ────────────────────────────────────────────────────────
// Do not allow modification of sha256Hash, ipfsCid, or fabricTransactionId
// once evidence has been registered on the blockchain.
evidenceSchema.post("init", function () {
  this._originalBlockchainStatus = this.blockchainStatus;
  this._originalFabricTxId = this.fabricTransactionId;
  this._originalSha256Hash = this.sha256Hash;
  this._originalIpfsCid = this.ipfsCid;
});

evidenceSchema.post("save", function () {
  this._originalBlockchainStatus = this.blockchainStatus;
  this._originalFabricTxId = this.fabricTransactionId;
  this._originalSha256Hash = this.sha256Hash;
  this._originalIpfsCid = this.ipfsCid;
});

evidenceSchema.pre("save", function () {
  if (!this.isNew) {
    const wasRegistered =
      this._originalBlockchainStatus === "REGISTERED" ||
      (this._originalFabricTxId && !this.isModified("fabricTransactionId"));

    if (wasRegistered) {
      if (this.isModified("sha256Hash") && this.sha256Hash !== this._originalSha256Hash) {
        throw new Error("Cannot modify sha256Hash: Evidence is immutably registered on Hyperledger Fabric.");
      }
      if (this.isModified("ipfsCid") && this.ipfsCid !== this._originalIpfsCid) {
        throw new Error("Cannot modify ipfsCid: Evidence is immutably registered on Hyperledger Fabric.");
      }
      if (this.isModified("fabricTransactionId") && this.fabricTransactionId !== this._originalFabricTxId) {
        throw new Error("Cannot modify fabricTransactionId: Evidence is immutably registered on Hyperledger Fabric.");
      }
      if (this.isModified("blockchainStatus") && this.blockchainStatus !== "REGISTERED") {
        throw new Error("Cannot change blockchainStatus: Evidence is immutably registered on Hyperledger Fabric.");
      }
    }
  }
});


const Evidence = mongoose.model("Evidence", evidenceSchema);

module.exports = Evidence;
