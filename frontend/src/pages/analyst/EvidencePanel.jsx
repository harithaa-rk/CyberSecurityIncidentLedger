import React, { useState, useEffect, useCallback, useRef } from "react";
import { useAuth } from "../../context/AuthContext";
import {
  getEvidenceForIncident,
  uploadEvidence,
  deleteEvidence,
  uploadEvidenceToIpfs,
  fetchEvidenceBlob,
  registerEvidenceOnBlockchain,
  getBlockchainRecord,
  verifyEvidenceIntegrity,
} from "../../services/evidenceService";

// ─────────────────────────────────────────────────────────────────────────────
// EvidencePanel – Phase 4 Module 1: Digital Evidence Management
//
// Self-contained panel embedded in IncidentInvestigation.jsx.
// Reads all data from the backend; never generates IDs client-side.
// All uploads go through multipart/form-data; user identity injected by JWT.
// ─────────────────────────────────────────────────────────────────────────────

/* ── Constants ── */
const MAX_FILE_SIZE_MB = 50;
const ALLOWED_EXTENSIONS = [
  ".pdf", ".png", ".jpg", ".jpeg", ".gif", ".webp",
  ".txt", ".csv", ".json", ".xml", ".zip", ".pcap", ".log", ".bin",
];
const ALLOWED_MIME_TYPES = new Set([
  "application/pdf", "image/png", "image/jpeg", "image/gif", "image/webp",
  "text/plain", "text/csv", "application/json", "application/xml", "text/xml",
  "application/zip", "application/x-zip-compressed", "application/octet-stream",
  "application/vnd.tcpdump.pcap",
]);

/* ── Inline SVG Icons ── */
const UploadIcon = ({ size = 16 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/>
  </svg>
);

const FileIcon = ({ size = 16 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/>
  </svg>
);

const TrashIcon = ({ size = 14 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/><path d="M10 11v6"/><path d="M14 11v6"/><path d="M9 6V4h6v2"/>
  </svg>
);

const EyeIcon = ({ size = 14 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/>
  </svg>
);

const ShieldIcon = ({ size = 14 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>
  </svg>
);

const XIcon = ({ size = 16 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
  </svg>
);

const CopyIcon = ({ size = 12 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <rect x="9" y="9" width="13" height="13" rx="2" ry="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/>
  </svg>
);

/* ── Formatters ── */
const formatBytes = (bytes) => {
  if (!bytes) return "—";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
};

const formatDate = (d) => {
  if (!d) return "—";
  return new Date(d).toLocaleString("en-US", {
    year: "numeric", month: "short", day: "numeric",
    hour: "2-digit", minute: "2-digit", second: "2-digit",
    hour12: false,
  });
};

/* ── Status Badge helpers ── */
const storageColor = (s) => ({
  UPLOADED: { bg: "rgba(16,185,129,0.12)", color: "#10b981", label: "Uploaded" },
  PENDING:  { bg: "rgba(245,158,11,0.12)",  color: "#f59e0b", label: "Pending" },
  FAILED:   { bg: "rgba(239,68,68,0.12)",   color: "#ef4444", label: "Failed"  },
}[s] || { bg: "rgba(100,116,139,0.12)", color: "#64748b", label: s || "—" });

const hashColor = (s) => ({
  GENERATED: { bg: "rgba(16,185,129,0.12)", color: "#10b981", label: "SHA-256 Generated" },
  COMPUTED:  { bg: "rgba(16,185,129,0.12)", color: "#10b981", label: "Computed" },
  PENDING:   { bg: "rgba(245,158,11,0.12)", color: "#f59e0b", label: "Pending" },
  FAILED:    { bg: "rgba(239,68,68,0.12)",  color: "#ef4444", label: "Failed"  },
}[s] || { bg: "rgba(100,116,139,0.12)", color: "#64748b", label: s || "—" });

const verifyColor = (s) => ({
  NOT_VERIFIED: { bg: "rgba(100,116,139,0.12)", color: "#64748b", label: "Not Verified" },
  VERIFIED:     { bg: "rgba(16,185,129,0.12)",  color: "#10b981", label: "Verified"     },
  TAMPERED:     { bg: "rgba(239,68,68,0.12)",   color: "#ef4444", label: "⚠ Tampered"  },
}[s] || { bg: "rgba(100,116,139,0.12)", color: "#64748b", label: s || "—" });

const ipfsColor = (cid, status) => {
  if (cid) return { bg: "rgba(16,185,129,0.12)", color: "#10b981", label: "Uploaded" };
  if (status === "FAILED") return { bg: "rgba(239,68,68,0.12)", color: "#ef4444", label: "Failed" };
  return { bg: "rgba(245,158,11,0.12)", color: "#f59e0b", label: "Pending" };
};

const blockchainColor = (status, txId) => {
  if (status === "REGISTERED" || txId) {
    return { bg: "rgba(16,185,129,0.12)", color: "#10b981", label: "Registered" };
  }
  if (status === "REGISTERING") {
    return { bg: "rgba(59,130,246,0.12)", color: "#3b82f6", label: "Registering…" };
  }
  if (status === "FAILED") {
    return { bg: "rgba(239,68,68,0.12)", color: "#ef4444", label: "Failed" };
  }
  return { bg: "rgba(100,116,139,0.12)", color: "#64748b", label: "Not Registered" };
};

const Badge = ({ style: { bg, color, label } }) => (
  <span style={{
    display: "inline-block", padding: "2px 8px", borderRadius: 4,
    background: bg, color, fontWeight: 600, fontSize: "0.72rem",
    letterSpacing: "0.03em", whiteSpace: "nowrap",
  }}>{label}</span>
);

// ─────────────────────────────────────────────────────────────────────────────
// Sub-components
// ─────────────────────────────────────────────────────────────────────────────

/* ── Evidence Integrity Verification Modal (Phase 4 Module 8) ── */
const EvidenceIntegrityModal = ({
  evidence,
  onClose,
  onCopy,
  copied,
  onVerified,
}) => {
  const [loading, setLoading] = useState(true);
  const [result, setResult] = useState(null);
  const [err, setErr] = useState(null);

  const runVerification = useCallback(async () => {
    if (!evidence?.evidenceId) return;
    setLoading(true);
    setErr(null);
    try {
      const res = await verifyEvidenceIntegrity(evidence.evidenceId);
      setResult(res);
      if (onVerified) onVerified(res);
    } catch (error) {
      setErr(error?.response?.data?.message || error?.message || "Failed to verify evidence integrity.");
    } finally {
      setLoading(false);
    }
  }, [evidence, onVerified]);

  useEffect(() => {
    runVerification();
  }, [runVerification]);

  if (!evidence) return null;

  return (
    <div style={{
      position: "fixed", inset: 0, zIndex: 1100,
      background: "rgba(0,0,0,0.75)", backdropFilter: "blur(6px)",
      display: "flex", alignItems: "center", justifyContent: "center",
      padding: "1rem",
    }} onClick={onClose}>
      <div onClick={e => e.stopPropagation()} style={{
        background: "var(--color-surface)", border: "1px solid var(--color-border)",
        borderRadius: 12, width: "100%", maxWidth: 640, maxHeight: "90vh",
        overflow: "auto", boxShadow: "0 25px 60px rgba(0,0,0,0.6)",
      }}>
        {/* Header */}
        <div style={{
          display: "flex", alignItems: "center", justifyContent: "space-between",
          padding: "1.25rem 1.5rem", borderBottom: "1px solid var(--color-border)",
          position: "sticky", top: 0, background: "var(--color-surface)", zIndex: 1,
        }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <span style={{ fontSize: "1.2rem" }}>🛡️</span>
            <div>
              <div style={{ fontWeight: 800, fontSize: "1.05rem", color: "var(--color-text)", letterSpacing: "0.02em" }}>
                Evidence Integrity
              </div>
              <div style={{ fontSize: "0.75rem", color: "var(--color-text-secondary)" }}>
                Hyperledger Fabric On-Chain Cryptographic Verification
              </div>
            </div>
          </div>
          <button onClick={onClose} style={{
            background: "none", border: "none", cursor: "pointer",
            color: "var(--color-text-secondary)", padding: 4, borderRadius: 4,
          }}><XIcon /></button>
        </div>

        {/* Content */}
        <div style={{ padding: "1.5rem" }}>
          {loading ? (
            <div style={{ textAlign: "center", padding: "2.5rem 1rem", color: "var(--color-text-secondary)" }}>
              <div style={{
                width: 36, height: 36, border: "3px solid var(--color-border)",
                borderTopColor: "var(--color-teal)", borderRadius: "50%",
                animation: "spin 0.8s linear infinite", margin: "0 auto 1rem",
              }} />
              <div style={{ fontWeight: 600, color: "var(--color-text)", marginBottom: 4 }}>
                Verifying Evidence Integrity…
              </div>
              <div style={{ fontSize: "0.8rem" }}>
                Retrieving file from IPFS → Computing SHA-256 → Querying Hyperledger Fabric peer…
              </div>
            </div>
          ) : err ? (
            <div style={{
              background: "rgba(239,68,68,0.08)", border: "1px solid rgba(239,68,68,0.3)",
              borderRadius: 8, padding: "1.25rem", color: "#ef4444", fontSize: "0.85rem",
            }}>
              <div style={{ fontWeight: 700, marginBottom: "0.5rem" }}>Verification Error</div>
              <div>{err}</div>
              <button
                onClick={runVerification}
                style={{
                  marginTop: "1rem", padding: "0.4rem 0.8rem",
                  background: "#ef4444", color: "#fff", border: "none",
                  borderRadius: 6, cursor: "pointer", fontWeight: 600, fontSize: "0.8rem",
                }}
              >
                Retry Verification
              </button>
            </div>
          ) : (
            <>
              {/* Result Banner */}
              {result?.verificationStatus === "VERIFIED" ? (
                <div style={{
                  background: "rgba(16,185,129,0.12)", border: "1.5px solid #10b981",
                  borderRadius: 8, padding: "1rem 1.25rem", marginBottom: "1.25rem",
                  display: "flex", alignItems: "center", gap: 12,
                }}>
                  <div style={{ fontSize: "1.5rem", color: "#10b981" }}>✓</div>
                  <div>
                    <div style={{ fontWeight: 800, color: "#10b981", fontSize: "0.95rem" }}>
                      ✓ VERIFIED — Evidence integrity confirmed.
                    </div>
                    <div style={{ fontSize: "0.78rem", color: "var(--color-text-secondary)", marginTop: 2 }}>
                      IPFS file checksum matches the immutable cryptographic hash recorded on Hyperledger Fabric.
                    </div>
                  </div>
                </div>
              ) : (
                <div style={{
                  background: "rgba(239,68,68,0.12)", border: "1.5px solid #ef4444",
                  borderRadius: 8, padding: "1rem 1.25rem", marginBottom: "1.25rem",
                  display: "flex", alignItems: "center", gap: 12,
                }}>
                  <div style={{ fontSize: "1.5rem", color: "#ef4444" }}>⚠</div>
                  <div>
                    <div style={{ fontWeight: 800, color: "#ef4444", fontSize: "0.95rem" }}>
                      ⚠ TAMPERED — Evidence hash does not match the blockchain record.
                    </div>
                    <div style={{ fontSize: "0.78rem", color: "var(--color-text-secondary)", marginTop: 2 }}>
                      The current IPFS file content deviates from the immutable ledger record. Tamper event recorded in audit trail.
                    </div>
                  </div>
                </div>
              )}

              {/* Data Rows per spec */}
              <div style={{
                background: "var(--color-surface-2, rgba(255,255,255,0.02))",
                border: "1px solid var(--color-border)", borderRadius: 8,
                padding: "0.5rem 1rem", marginBottom: "1.25rem",
              }}>
                {[
                  ["Evidence ID", result?.evidenceId || evidence.evidenceId, true],
                  ["IPFS CID", evidence.ipfsCid || "—", true],
                  ["Blockchain SHA-256", result?.blockchainHash || "—", true],
                  ["Current SHA-256", result?.currentHash || "—", true],
                  ["Verification Status", result?.verificationStatus || "—", false],
                  ["Verified By", result?.lastVerifiedBy || "Analyst", false],
                  ["Verified At", formatDate(result?.lastVerifiedAt), false],
                ].map(([lbl, val, canCopy]) => (
                  <div key={lbl} style={{
                    display: "grid", gridTemplateColumns: "150px 1fr",
                    gap: "0.5rem", padding: "0.6rem 0",
                    borderBottom: "1px solid var(--color-border)",
                    fontSize: "0.82rem", alignItems: "center",
                  }}>
                    <span style={{ color: "var(--color-text-secondary)", fontWeight: 600 }}>{lbl}</span>
                    <div style={{ display: "flex", alignItems: "center", gap: 6, overflow: "hidden" }}>
                      <code style={{
                        color: lbl.includes("SHA-256")
                          ? (result?.verificationStatus === "VERIFIED" ? "#10b981" : "#ef4444")
                          : "var(--color-text)",
                        fontSize: "0.8rem", wordBreak: "break-all", fontFamily: "monospace",
                        fontWeight: lbl.includes("SHA-256") ? 700 : 400,
                      }}>
                        {val || "—"}
                      </code>
                      {canCopy && val && val !== "—" && (
                        <button
                          onClick={() => onCopy(val, `integrity-${lbl}`)}
                          style={{
                            background: "none", border: "none", cursor: "pointer",
                            color: copied === `integrity-${lbl}` ? "var(--color-teal)" : "var(--color-text-secondary)",
                            padding: 2, flexShrink: 0,
                          }}
                          title={`Copy ${lbl}`}
                        >
                          <CopyIcon />
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>

              {/* Actions */}
              <div style={{ display: "flex", justifyContent: "flex-end", gap: 8 }}>
                <button
                  onClick={runVerification}
                  style={{
                    padding: "0.5rem 1rem", background: "rgba(13,115,119,0.15)",
                    border: "1px solid var(--color-teal)", borderRadius: 6,
                    color: "var(--color-teal)", cursor: "pointer", fontWeight: 700, fontSize: "0.8rem",
                  }}
                >
                  🔄 Re-verify
                </button>
                <button
                  onClick={onClose}
                  style={{
                    padding: "0.5rem 1rem", background: "var(--color-border)",
                    border: "none", borderRadius: 6,
                    color: "var(--color-text)", cursor: "pointer", fontWeight: 600, fontSize: "0.8rem",
                  }}
                >
                  Close
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
};

/* ── Blockchain Record Modal ── */
const BlockchainRecordModal = ({
  evidence,
  onClose,
  onCopy,
  copied,
  onViewFile,
}) => {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState(null);

  useEffect(() => {
    if (!evidence?.evidenceId) return;
    let active = true;
    setLoading(true);
    setErr(null);

    getBlockchainRecord(evidence.evidenceId)
      .then((res) => {
        if (active) setData(res);
      })
      .catch((e) => {
        if (active) setErr(e.response?.data?.message || e.message || "Failed to load blockchain record.");
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => { active = false; };
  }, [evidence?.evidenceId]);

  if (!evidence) return null;

  const txId = data?.record?.fabricTransactionId || data?.record?.txId || evidence.fabricTransactionId;
  const recordedAt = data?.record?.recordedAt || evidence.fabricRecordedAt;
  const historyList = Array.isArray(data?.history) ? data.history : [];

  return (
    <div style={{
      position: "fixed", inset: 0, zIndex: 1200,
      background: "rgba(0,0,0,0.75)", backdropFilter: "blur(5px)",
      display: "flex", alignItems: "center", justifyContent: "center",
      padding: "1rem",
    }} onClick={onClose}>
      <div onClick={e => e.stopPropagation()} style={{
        background: "var(--color-surface)", border: "1px solid var(--color-border)",
        borderRadius: 12, width: "100%", maxWidth: 680, maxHeight: "90vh",
        overflow: "auto", boxShadow: "0 25px 60px rgba(0,0,0,0.6)",
      }}>
        {/* Header */}
        <div style={{
          display: "flex", alignItems: "center", justifyContent: "space-between",
          padding: "1.25rem 1.5rem", borderBottom: "1px solid var(--color-border)",
          position: "sticky", top: 0, background: "var(--color-surface)", zIndex: 1,
        }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <span style={{ fontSize: 22 }}>🔗</span>
            <div>
              <div style={{ fontWeight: 700, fontSize: "1.05rem", color: "var(--color-text)" }}>
                Hyperledger Fabric Blockchain Record
              </div>
              <div style={{ fontSize: "0.75rem", color: "var(--color-text-secondary)" }}>
                Channel: <code>incidentchannel</code> · Chaincode: <code>incident-ledger</code>
              </div>
            </div>
          </div>
          <button onClick={onClose} style={{
            background: "none", border: "none", cursor: "pointer",
            color: "var(--color-text-secondary)", padding: 4, borderRadius: 4,
          }}><XIcon /></button>
        </div>

        {/* 4 Required Status Indicators */}
        <div style={{
          display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(130px, 1fr))",
          gap: 10, padding: "1.25rem 1.5rem 0.5rem",
        }}>
          <div style={{ background: "rgba(16,185,129,0.08)", border: "1px solid rgba(16,185,129,0.2)", borderRadius: 8, padding: "0.6rem 0.8rem" }}>
            <div style={{ fontSize: "0.7rem", color: "var(--color-text-secondary)", textTransform: "uppercase", fontWeight: 700 }}>IPFS</div>
            <div style={{ fontSize: "0.88rem", fontWeight: 700, color: "#10b981", marginTop: 2 }}>Uploaded</div>
          </div>
          <div style={{ background: "rgba(16,185,129,0.08)", border: "1px solid rgba(16,185,129,0.2)", borderRadius: 8, padding: "0.6rem 0.8rem" }}>
            <div style={{ fontSize: "0.7rem", color: "var(--color-text-secondary)", textTransform: "uppercase", fontWeight: 700 }}>SHA-256</div>
            <div style={{ fontSize: "0.88rem", fontWeight: 700, color: "#10b981", marginTop: 2 }}>Generated</div>
          </div>
          <div style={{ background: "rgba(16,185,129,0.08)", border: "1px solid rgba(16,185,129,0.2)", borderRadius: 8, padding: "0.6rem 0.8rem" }}>
            <div style={{ fontSize: "0.7rem", color: "var(--color-text-secondary)", textTransform: "uppercase", fontWeight: 700 }}>Blockchain</div>
            <div style={{ fontSize: "0.88rem", fontWeight: 700, color: "#10b981", marginTop: 2 }}>Registered</div>
          </div>
          <div style={{ background: "rgba(13,115,119,0.08)", border: "1px solid rgba(13,115,119,0.2)", borderRadius: 8, padding: "0.6rem 0.8rem" }}>
            <div style={{ fontSize: "0.7rem", color: "var(--color-text-secondary)", textTransform: "uppercase", fontWeight: 700 }}>Integrity</div>
            <div style={{ fontSize: "0.88rem", fontWeight: 700, color: "var(--color-teal)", marginTop: 2 }}>VERIFIED</div>
          </div>
        </div>

        {/* Content */}
        <div style={{ padding: "1rem 1.5rem 1.5rem" }}>
          {loading ? (
            <div style={{ textAlign: "center", padding: "2rem", color: "var(--color-text-secondary)" }}>
              <div style={{
                width: 28, height: 28, border: "3px solid var(--color-border)",
                borderTopColor: "var(--color-teal)", borderRadius: "50%",
                animation: "spin 0.7s linear infinite", margin: "0 auto 0.75rem",
              }} />
              Querying live ledger record from Hyperledger Fabric peer…
            </div>
          ) : err ? (
            <div style={{
              background: "rgba(239,68,68,0.08)", border: "1px solid rgba(239,68,68,0.25)",
              borderRadius: 8, padding: "1rem", color: "#ef4444", fontSize: "0.85rem",
            }}>
              {err}
            </div>
          ) : (
            <>
              {/* Ledger fields */}
              <div style={{
                background: "var(--color-surface-2, rgba(255,255,255,0.02))",
                border: "1px solid var(--color-border)", borderRadius: 8,
                padding: "0.5rem 1rem", marginBottom: "1.25rem",
              }}>
                {[
                  ["Transaction ID", txId, true],
                  ["Evidence ID", data?.record?.evidenceId || evidence.evidenceId, true],
                  ["Incident ID", data?.record?.incidentId || evidence.incidentId?.incidentId || "—", true],
                  ["SHA-256 Hash", data?.record?.sha256Hash || evidence.sha256Hash, true],
                  ["IPFS CID", data?.record?.ipfsCid || evidence.ipfsCid, true],
                  ["Recorded By", data?.record?.recordedBy || "appUser", false],
                  ["Committed At", formatDate(recordedAt), false],
                ].map(([lbl, val, canCopy]) => (
                  <div key={lbl} style={{
                    display: "grid", gridTemplateColumns: "140px 1fr",
                    gap: "0.5rem", padding: "0.5rem 0",
                    borderBottom: "1px solid var(--color-border)",
                    fontSize: "0.8rem", alignItems: "center",
                  }}>
                    <span style={{ color: "var(--color-text-secondary)", fontWeight: 600 }}>{lbl}</span>
                    <div style={{ display: "flex", alignItems: "center", gap: 6, overflow: "hidden" }}>
                      <code style={{
                        color: "var(--color-text)", fontSize: "0.78rem",
                        wordBreak: "break-all", fontFamily: "monospace",
                      }}>
                        {val || "—"}
                      </code>
                      {canCopy && val && (
                        <button
                          onClick={() => onCopy(val, `bcrecord-${lbl}`)}
                          style={{
                            background: "none", border: "none", cursor: "pointer",
                            color: copied === `bcrecord-${lbl}` ? "var(--color-teal)" : "var(--color-text-secondary)",
                            padding: 2, flexShrink: 0,
                          }}
                          title={`Copy ${lbl}`}
                        >
                          <CopyIcon />
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>

              {/* Block History Audit Trail */}
              <div>
                <div style={{ fontWeight: 700, fontSize: "0.85rem", color: "var(--color-text)", marginBottom: 8 }}>
                  Block Audit History ({historyList.length} Transaction{historyList.length === 1 ? "" : "s"})
                </div>
                {historyList.length === 0 ? (
                  <div style={{ fontSize: "0.78rem", color: "var(--color-text-secondary)" }}>
                    Initial block transaction commit recorded.
                  </div>
                ) : (
                  <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                    {historyList.map((h, i) => (
                      <div key={h.txId || i} style={{
                        background: "rgba(13,115,119,0.04)", border: "1px solid var(--color-border)",
                        borderRadius: 6, padding: "0.6rem 0.75rem", fontSize: "0.75rem",
                      }}>
                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                          <span style={{ fontWeight: 700, color: "var(--color-teal)" }}>Commit #{i + 1}</span>
                          <span style={{ color: "var(--color-text-secondary)" }}>{formatDate(h.timestamp)}</span>
                        </div>
                        <div style={{ marginTop: 4, fontFamily: "monospace", color: "var(--color-text-secondary)", wordBreak: "break-all" }}>
                          Tx ID: {h.txId}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </>
          )}

          {/* Actions */}
          <div style={{ display: "flex", justifyContent: "flex-end", gap: 10, marginTop: "1.25rem" }}>
            {onViewFile && (
              <button onClick={() => onViewFile(evidence)} style={{
                padding: "0.5rem 1rem", background: "var(--color-teal)",
                border: "none", borderRadius: 6, color: "#fff",
                fontWeight: 700, fontSize: "0.82rem", cursor: "pointer",
                display: "flex", alignItems: "center", gap: 6,
              }}>
                <EyeIcon size={14} /> View Evidence
              </button>
            )}
            <button onClick={onClose} style={{
              padding: "0.5rem 1.25rem", background: "transparent",
              border: "1px solid var(--color-border)", borderRadius: 6,
              color: "var(--color-text-secondary)", cursor: "pointer",
              fontWeight: 600, fontSize: "0.82rem",
            }}>
              Close
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

/* ── Evidence Detail Modal ── */
const EvidenceDetailModal = ({
  evidence,
  onClose,
  onCopy,
  copied,
  onViewFile,
  onUploadIpfs,
  ipfsUploading,
  onViewBlockchainRecord,
  onRegisterBlockchain,
  blockchainRegistering,
  onVerifyIntegrity,
}) => {
  if (!evidence) return null;
  const isRegistered = Boolean(evidence.fabricTransactionId || evidence.blockchainStatus === "REGISTERED");

  const rows = [
    ["Evidence ID",         evidence.evidenceId],
    ["Original File Name",  evidence.originalFileName],
    ["File Type",           evidence.fileType || "—"],
    ["MIME Type",           evidence.mimeType],
    ["File Size",           formatBytes(evidence.fileSize)],
    ["Description",         evidence.description || "—"],
    ["Collected By",        evidence.collectedBy?.name || evidence.collectedBy?.email || "—"],
    ["Collection Time",     formatDate(evidence.collectionTimestamp)],
    ["SHA-256",             evidence.hashStatus === "GENERATED" ? "Generated" : (evidence.hashStatus || "Pending")],
    ["SHA-256 Hash",        evidence.sha256Hash || "—"],
    ["IPFS",                evidence.ipfsCid ? "Uploaded" : (evidence.storageStatus === "FAILED" ? "Failed" : "Pending")],
    ["IPFS CID",            evidence.ipfsCid || "Not uploaded to IPFS yet"],
    ["IPFS Uploaded At",    formatDate(evidence.ipfsUploadedAt)],
    ["Blockchain",          isRegistered ? "Registered" : (evidence.blockchainStatus || "Not Registered")],
    ["Transaction ID",      evidence.fabricTransactionId || "Not registered yet"],
    ["Blockchain At",       formatDate(evidence.fabricRecordedAt)],
    ["Created At",          formatDate(evidence.createdAt)],
  ];

  return (
    <div style={{
      position: "fixed", inset: 0, zIndex: 1000,
      background: "rgba(0,0,0,0.65)", backdropFilter: "blur(4px)",
      display: "flex", alignItems: "center", justifyContent: "center",
      padding: "1rem",
    }} onClick={onClose}>
      <div onClick={e => e.stopPropagation()} style={{
        background: "var(--color-surface)", border: "1px solid var(--color-border)",
        borderRadius: 12, width: "100%", maxWidth: 620, maxHeight: "90vh",
        overflow: "auto", boxShadow: "0 25px 60px rgba(0,0,0,0.5)",
      }}>
        {/* Header */}
        <div style={{
          display: "flex", alignItems: "center", justifyContent: "space-between",
          padding: "1.25rem 1.5rem", borderBottom: "1px solid var(--color-border)",
          position: "sticky", top: 0, background: "var(--color-surface)", zIndex: 1,
        }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <FileIcon size={18} />
            <span style={{ fontWeight: 700, fontSize: "1rem", color: "var(--color-text)" }}>
              Evidence Details
            </span>
          </div>
          <button onClick={onClose} style={{
            background: "none", border: "none", cursor: "pointer",
            color: "var(--color-text-secondary)", padding: 4, borderRadius: 4,
          }}><XIcon /></button>
        </div>

        {/* 4 Status row */}
        <div style={{ display: "flex", gap: 8, padding: "1rem 1.5rem 0", flexWrap: "wrap", alignItems: "center" }}>
          <Badge style={storageColor(evidence.storageStatus)} />
          <Badge style={hashColor(evidence.hashStatus)} />
          <Badge style={ipfsColor(evidence.ipfsCid, evidence.storageStatus)} />
          <Badge style={blockchainColor(evidence.blockchainStatus, evidence.fabricTransactionId)} />
          <Badge style={verifyColor(evidence.verificationStatus)} />
        </div>

        {/* Fields */}
        <div style={{ padding: "1rem 1.5rem 1.5rem" }}>
          {rows.map(([label, value]) => (
            <div key={label} style={{
              display: "grid", gridTemplateColumns: "160px 1fr",
              gap: "0.5rem", padding: "0.5rem 0",
              borderBottom: "1px solid var(--color-border)",
              alignItems: "start",
            }}>
              <span style={{ fontSize: "0.8rem", color: "var(--color-text-secondary)", fontWeight: 600 }}>
                {label}
              </span>
              <div style={{ display: "flex", alignItems: "flex-start", gap: 6 }}>
                <span style={{
                  fontSize: "0.82rem", color: "var(--color-text)",
                  wordBreak: "break-all", fontFamily: label.includes("Hash") || label.includes("CID") || label.includes("Transaction") ? "monospace" : "inherit",
                }}>{value}</span>
                {(label.includes("Hash") || label.includes("ID") || label.includes("CID") || label.includes("Transaction")) && value && value !== "—" && !value.includes("Not ") && (
                  <button onClick={() => onCopy(value, label)} style={{
                    background: "none", border: "none", cursor: "pointer",
                    color: copied === label ? "var(--color-teal)" : "var(--color-text-secondary)",
                    padding: 2, flexShrink: 0, marginTop: 2,
                  }} title={`Copy ${label}`}><CopyIcon /></button>
                )}
              </div>
            </div>
          ))}

          {/* Modal Action Buttons: View Blockchain Record, Upload IPFS, View Evidence */}
          <div style={{ display: "flex", gap: 10, marginTop: "1.25rem", justifyContent: "flex-end", flexWrap: "wrap" }}>
            {/* View Blockchain Record button if registered */}
            {isRegistered && onViewBlockchainRecord && (
              <button
                onClick={() => { onClose(); onViewBlockchainRecord(evidence); }}
                style={{
                  display: "flex", alignItems: "center", gap: 6,
                  padding: "0.5rem 1rem",
                  background: "rgba(16,185,129,0.12)",
                  border: "1px solid rgba(16,185,129,0.3)",
                  borderRadius: 6, color: "#10b981",
                  cursor: "pointer", fontSize: "0.82rem", fontWeight: 700,
                }}
              >
                <span>🔗</span> View Blockchain Record
              </button>
            )}

            {/* Verify Integrity button if registered */}
            {isRegistered && onVerifyIntegrity && (
              <button
                onClick={() => { onClose(); onVerifyIntegrity(evidence); }}
                style={{
                  display: "flex", alignItems: "center", gap: 6,
                  padding: "0.5rem 1rem",
                  background: evidence.verificationStatus === "VERIFIED"
                    ? "rgba(16,185,129,0.15)"
                    : evidence.verificationStatus === "TAMPERED"
                    ? "rgba(239,68,68,0.15)"
                    : "rgba(13,115,119,0.15)",
                  border: `1px solid ${
                    evidence.verificationStatus === "VERIFIED"
                      ? "#10b981"
                      : evidence.verificationStatus === "TAMPERED"
                      ? "#ef4444"
                      : "var(--color-teal)"
                  }`,
                  borderRadius: 6,
                  color: evidence.verificationStatus === "VERIFIED"
                    ? "#10b981"
                    : evidence.verificationStatus === "TAMPERED"
                    ? "#ef4444"
                    : "var(--color-teal)",
                  cursor: "pointer", fontSize: "0.82rem", fontWeight: 700,
                }}
              >
                <span>{evidence.verificationStatus === "VERIFIED" ? "✓" : evidence.verificationStatus === "TAMPERED" ? "⚠" : "🛡️"}</span> Verify Integrity
              </button>
            )}

            {/* Register on Fabric button if IPFS uploaded but not on blockchain */}
            {!isRegistered && evidence.ipfsCid && onRegisterBlockchain && (
              <button
                onClick={() => onRegisterBlockchain(evidence)}
                disabled={blockchainRegistering}
                style={{
                  display: "flex", alignItems: "center", gap: 6,
                  padding: "0.5rem 1rem",
                  background: "rgba(13,115,119,0.15)",
                  border: "1px solid var(--color-teal)",
                  borderRadius: 6, color: "var(--color-teal)",
                  cursor: blockchainRegistering ? "not-allowed" : "pointer",
                  fontSize: "0.82rem", fontWeight: 700,
                }}
              >
                <span>⚡</span> {blockchainRegistering ? "Registering on Fabric..." : "Register on Hyperledger Fabric"}
              </button>
            )}

            {!evidence.ipfsCid && onUploadIpfs && (
              <button
                onClick={() => onUploadIpfs(evidence)}
                disabled={ipfsUploading}
                style={{
                  display: "flex", alignItems: "center", gap: 6,
                  padding: "0.5rem 1rem",
                  background: "rgba(245,158,11,0.1)",
                  border: "1px solid rgba(245,158,11,0.3)",
                  borderRadius: 6, color: "#f59e0b",
                  cursor: ipfsUploading ? "not-allowed" : "pointer",
                  fontSize: "0.82rem", fontWeight: 700,
                }}
              >
                <UploadIcon size={14} />
                {ipfsUploading ? "Uploading to IPFS..." : "Upload to Pinata/IPFS"}
              </button>
            )}

            {onViewFile && (
              <button
                onClick={() => onViewFile(evidence)}
                style={{
                  display: "flex", alignItems: "center", gap: 6,
                  padding: "0.5rem 1.25rem",
                  background: "var(--color-teal, #0d7377)",
                  border: "none",
                  borderRadius: 6, color: "#fff",
                  cursor: "pointer", fontSize: "0.82rem", fontWeight: 700,
                  boxShadow: "0 2px 8px rgba(13,115,119,0.3)",
                }}
              >
                <EyeIcon size={15} />
                View Evidence
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

/* ── Upload Evidence Modal ── */
const UploadModal = ({ onClose, onSubmit, uploading, progress }) => {
  const [file, setFile]           = useState(null);
  const [description, setDesc]    = useState("");
  const [fileError, setFileError] = useState("");
  const inputRef                  = useRef(null);
  const [dragging, setDragging]   = useState(false);

  const validateFile = (f) => {
    if (!f) return "No file selected.";
    if (f.size === 0) return "File is empty.";
    if (f.size > MAX_FILE_SIZE_MB * 1024 * 1024) return `File exceeds ${MAX_FILE_SIZE_MB} MB limit.`;
    const ext = "." + f.name.split(".").pop().toLowerCase();
    if (!ALLOWED_EXTENSIONS.includes(ext) && !ALLOWED_MIME_TYPES.has(f.type)) {
      return `File type '${ext}' is not allowed. Use: ${ALLOWED_EXTENSIONS.join(", ")}`;
    }
    return "";
  };

  const handleFile = (f) => {
    const err = validateFile(f);
    setFileError(err);
    if (!err) setFile(f);
    else setFile(null);
  };

  const handleDrop = (e) => {
    e.preventDefault();
    setDragging(false);
    const f = e.dataTransfer.files[0];
    if (f) handleFile(f);
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!file) { setFileError("Please select a file."); return; }
    const err = validateFile(file);
    if (err) { setFileError(err); return; }
    onSubmit(file, description);
  };

  return (
    <div style={{
      position: "fixed", inset: 0, zIndex: 1000,
      background: "rgba(0,0,0,0.65)", backdropFilter: "blur(4px)",
      display: "flex", alignItems: "center", justifyContent: "center",
      padding: "1rem",
    }} onClick={onClose}>
      <div onClick={e => e.stopPropagation()} style={{
        background: "var(--color-surface)", border: "1px solid var(--color-border)",
        borderRadius: 12, width: "100%", maxWidth: 520,
        boxShadow: "0 25px 60px rgba(0,0,0,0.5)",
      }}>
        {/* Header */}
        <div style={{
          display: "flex", alignItems: "center", justifyContent: "space-between",
          padding: "1.25rem 1.5rem", borderBottom: "1px solid var(--color-border)",
        }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <UploadIcon size={18} />
            <span style={{ fontWeight: 700, fontSize: "1rem", color: "var(--color-text)" }}>
              Collect Evidence
            </span>
          </div>
          <button onClick={onClose} disabled={uploading} style={{
            background: "none", border: "none", cursor: "pointer",
            color: "var(--color-text-secondary)", padding: 4,
          }}><XIcon /></button>
        </div>

        <form onSubmit={handleSubmit} style={{ padding: "1.5rem" }}>
          {/* Drop zone */}
          <div
            onDragOver={e => { e.preventDefault(); setDragging(true); }}
            onDragLeave={() => setDragging(false)}
            onDrop={handleDrop}
            onClick={() => !uploading && inputRef.current?.click()}
            style={{
              border: `2px dashed ${dragging ? "var(--color-teal)" : fileError ? "#ef4444" : "var(--color-border)"}`,
              borderRadius: 8, padding: "2rem 1rem", textAlign: "center",
              cursor: uploading ? "not-allowed" : "pointer",
              background: dragging ? "rgba(13,115,119,0.05)" : "var(--color-surface-2, rgba(255,255,255,0.03))",
              transition: "all 0.2s ease", marginBottom: "0.75rem",
            }}
          >
            <input
              ref={inputRef}
              type="file"
              style={{ display: "none" }}
              disabled={uploading}
              onChange={e => handleFile(e.target.files[0])}
            />
            {file ? (
              <div>
                <FileIcon size={28} />
                <div style={{ marginTop: 8, fontWeight: 600, color: "var(--color-text)", fontSize: "0.9rem" }}>
                  {file.name}
                </div>
                <div style={{ color: "var(--color-text-secondary)", fontSize: "0.78rem", marginTop: 2 }}>
                  {formatBytes(file.size)} · {file.type || "unknown type"}
                </div>
              </div>
            ) : (
              <div>
                <UploadIcon size={28} />
                <div style={{ marginTop: 8, color: "var(--color-text)", fontWeight: 600, fontSize: "0.9rem" }}>
                  Drop file here or click to browse
                </div>
                <div style={{ color: "var(--color-text-secondary)", fontSize: "0.75rem", marginTop: 4 }}>
                  Max {MAX_FILE_SIZE_MB} MB · PDF, PNG, JPG, TXT, CSV, JSON, XML, ZIP, PCAP, LOG
                </div>
              </div>
            )}
          </div>

          {fileError && (
            <div style={{ color: "#ef4444", fontSize: "0.8rem", marginBottom: "0.75rem" }}>
              {fileError}
            </div>
          )}

          {/* Description */}
          <label style={{ display: "block", marginBottom: "0.5rem" }}>
            <span style={{ fontSize: "0.82rem", fontWeight: 600, color: "var(--color-text-secondary)" }}>
              Description <span style={{ fontWeight: 400 }}>(optional)</span>
            </span>
            <textarea
              value={description}
              onChange={e => setDesc(e.target.value)}
              disabled={uploading}
              maxLength={2000}
              rows={3}
              placeholder="Describe the evidence, its source, or how it was collected..."
              style={{
                width: "100%", marginTop: 6, padding: "0.625rem 0.75rem",
                background: "var(--color-surface-2, rgba(255,255,255,0.04))",
                border: "1px solid var(--color-border)", borderRadius: 6,
                color: "var(--color-text)", fontSize: "0.85rem",
                resize: "vertical", fontFamily: "inherit", outline: "none",
                boxSizing: "border-box",
              }}
            />
          </label>

          {/* Upload progress */}
          {uploading && (
            <div style={{ margin: "0.75rem 0" }}>
              <div style={{
                height: 6, background: "var(--color-border)", borderRadius: 3, overflow: "hidden",
              }}>
                <div style={{
                  height: "100%", background: "var(--color-teal)",
                  width: `${progress}%`, transition: "width 0.3s ease",
                  borderRadius: 3,
                }} />
              </div>
              <div style={{ fontSize: "0.75rem", color: "var(--color-text-secondary)", marginTop: 4 }}>
                Uploading… {progress}% — computing SHA-256 hash server-side
              </div>
            </div>
          )}

          {/* Actions */}
          <div style={{ display: "flex", gap: 10, marginTop: "1.25rem", justifyContent: "flex-end" }}>
            <button type="button" onClick={onClose} disabled={uploading} style={{
              padding: "0.5rem 1.25rem", background: "transparent",
              border: "1px solid var(--color-border)", borderRadius: 6,
              color: "var(--color-text-secondary)", cursor: "pointer",
              fontSize: "0.875rem", fontWeight: 600,
            }}>
              Cancel
            </button>
            <button type="submit" disabled={uploading || !file} style={{
              padding: "0.5rem 1.5rem",
              background: uploading || !file ? "rgba(13,115,119,0.4)" : "var(--color-teal)",
              border: "none", borderRadius: 6, color: "#fff",
              cursor: uploading || !file ? "not-allowed" : "pointer",
              fontSize: "0.875rem", fontWeight: 700,
              display: "flex", alignItems: "center", gap: 8,
            }}>
              {uploading ? (
                <><span style={{
                  width: 14, height: 14, border: "2px solid rgba(255,255,255,0.3)",
                  borderTopColor: "#fff", borderRadius: "50%",
                  animation: "spin 0.7s linear infinite", display: "inline-block",
                }} /> Uploading…</>
              ) : (
                <><UploadIcon size={14} /> Collect Evidence</>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

/* ── Delete Confirm Modal ── */
const DeleteConfirmModal = ({ evidence, onClose, onConfirm, deleting }) => (
  <div style={{
    position: "fixed", inset: 0, zIndex: 1100,
    background: "rgba(0,0,0,0.70)", backdropFilter: "blur(4px)",
    display: "flex", alignItems: "center", justifyContent: "center",
    padding: "1rem",
  }} onClick={onClose}>
    <div onClick={e => e.stopPropagation()} style={{
      background: "var(--color-surface)", border: "1px solid var(--color-border)",
      borderRadius: 12, width: "100%", maxWidth: 420,
      padding: "1.75rem", boxShadow: "0 25px 60px rgba(0,0,0,0.5)",
    }}>
      <div style={{ textAlign: "center", marginBottom: "1.25rem" }}>
        <div style={{ fontSize: 40, marginBottom: 8 }}>🗑️</div>
        <h3 style={{ margin: 0, color: "var(--color-text)", fontSize: "1.05rem", fontWeight: 700 }}>
          Delete Evidence
        </h3>
        <p style={{ color: "var(--color-text-secondary)", fontSize: "0.85rem", marginTop: 8 }}>
          Are you sure you want to delete <strong>{evidence?.originalFileName}</strong>?<br />
          <span style={{ color: "#f59e0b" }}>
            {evidence?.evidenceId} will be permanently removed.
          </span>
        </p>
      </div>
      <div style={{ display: "flex", gap: 10, justifyContent: "center" }}>
        <button onClick={onClose} disabled={deleting} style={{
          padding: "0.5rem 1.25rem", background: "transparent",
          border: "1px solid var(--color-border)", borderRadius: 6,
          color: "var(--color-text-secondary)", cursor: "pointer",
          fontSize: "0.875rem", fontWeight: 600,
        }}>Cancel</button>
        <button onClick={onConfirm} disabled={deleting} style={{
          padding: "0.5rem 1.5rem", background: "#ef4444",
          border: "none", borderRadius: 6, color: "#fff",
          cursor: deleting ? "not-allowed" : "pointer",
          fontSize: "0.875rem", fontWeight: 700,
          display: "flex", alignItems: "center", gap: 6,
        }}>
          {deleting ? "Deleting…" : <><TrashIcon size={14} /> Delete</>}
        </button>
      </div>
    </div>
  </div>
);

// ─────────────────────────────────────────────────────────────────────────────
// Main Component: EvidencePanel
// ─────────────────────────────────────────────────────────────────────────────

const EvidencePanel = ({ incident, onRefresh }) => {
  const { user } = useAuth();

  const [evidenceList, setEvidenceList] = useState([]);
  const [loading, setLoading]           = useState(true);
  const [error, setError]               = useState(null);
  const [toast, setToast]               = useState(null);

  const [showUploadModal, setShowUploadModal] = useState(false);
  const [uploading, setUploading]             = useState(false);
  const [uploadProgress, setUploadProgress]   = useState(0);

  const [viewEvidence, setViewEvidence]       = useState(null);
  const [deleteTarget, setDeleteTarget]       = useState(null);
  const [deleting, setDeleting]               = useState(false);

  const [copiedKey, setCopiedKey] = useState(null);

  const isArchived  = incident?.status === "ARCHIVED";
  const incId       = incident?.incidentId || incident?._id;
  const incMongoId  = incident?._id;

  /* ── Toast helper ── */
  const showToast = (type, msg) => {
    setToast({ type, msg });
    setTimeout(() => setToast(null), 3500);
  };

  /* ── Copy to clipboard ── */
  const handleCopy = (text, key) => {
    if (!text) return;
    navigator.clipboard.writeText(text);
    setCopiedKey(key);
    setTimeout(() => setCopiedKey(null), 2000);
  };

  /* ── Load evidence from DB ── */
  const loadEvidence = useCallback(async () => {
    if (!incMongoId) return;
    setLoading(true);
    setError(null);
    try {
      const res = await getEvidenceForIncident(incMongoId);
      setEvidenceList(res.evidence || []);
    } catch (err) {
      setError(err.response?.data?.message || "Failed to load evidence.");
    } finally {
      setLoading(false);
    }
  }, [incMongoId]);

  useEffect(() => { loadEvidence(); }, [loadEvidence]);

  /* ── Upload evidence ── */
  const handleUpload = async (file, description) => {
    setUploading(true);
    setUploadProgress(0);
    try {
      await uploadEvidence(incMongoId, file, description, setUploadProgress);
      showToast("success", "Evidence collected and attached to incident.");
      setShowUploadModal(false);
      await loadEvidence();
      if (onRefresh) await onRefresh();
    } catch (err) {
      showToast("error", err.response?.data?.message || "Failed to upload evidence.");
    } finally {
      setUploading(false);
      setUploadProgress(0);
    }
  };

  /* ── Delete evidence ── */
  const handleDelete = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      await deleteEvidence(deleteTarget.evidenceId);
      showToast("success", `Evidence ${deleteTarget.evidenceId} deleted.`);
      setDeleteTarget(null);
      await loadEvidence();
      if (onRefresh) await onRefresh();
    } catch (err) {
      showToast("error", err.response?.data?.message || "Failed to delete evidence.");
    } finally {
      setDeleting(false);
    }
  };

  /* ── IPFS Upload & View Handlers (Phase 4 Module 3) ── */
  const [ipfsUploadingId, setIpfsUploadingId] = useState(null);

  const handleViewEvidenceFile = async (ev) => {
    try {
      showToast("info", `Opening ${ev.originalFileName} via secure retrieval...`);
      const { blob, filename } = await fetchEvidenceBlob(ev.evidenceId);
      const url = URL.createObjectURL(blob);
      const win = window.open(url, "_blank");
      if (!win) {
        const a = document.createElement("a");
        a.href = url;
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
      }
    } catch (err) {
      showToast("error", err.response?.data?.message || "Failed to retrieve evidence file.");
    }
  };

  const handleUploadToIpfs = async (ev) => {
    setIpfsUploadingId(ev.evidenceId);
    try {
      showToast("info", "Uploading evidence file to Pinata/IPFS...");
      const res = await uploadEvidenceToIpfs(ev.evidenceId);
      showToast("success", `Uploaded to IPFS! CID: ${res.ipfsCid?.slice(0, 12)}…`);
      await loadEvidence();
      if (viewEvidence && viewEvidence.evidenceId === ev.evidenceId) {
        setViewEvidence(prev => ({
          ...prev,
          ipfsCid: res.ipfsCid,
          storageStatus: res.storageStatus,
          ipfsUploadedAt: new Date(),
        }));
      }
      if (onRefresh) await onRefresh();
    } catch (err) {
      showToast("error", err.response?.data?.message || "Failed to upload to Pinata/IPFS.");
      await loadEvidence();
    } finally {
      setIpfsUploadingId(null);
    }
  };

  /* ── Blockchain Registration & View Handlers (Phase 4 Modules 6 & 7) ── */
  const [blockchainEvidence, setBlockchainEvidence]       = useState(null);
  const [blockchainRegisteringId, setBlockchainRegisteringId] = useState(null);

  const handleOpenBlockchainModal = (ev) => {
    setBlockchainEvidence(ev);
  };

  const handleRegisterBlockchain = async (ev) => {
    setBlockchainRegisteringId(ev.evidenceId);
    try {
      showToast("info", "Submitting transaction to Hyperledger Fabric...");
      const res = await registerEvidenceOnBlockchain(ev.evidenceId);
      showToast("success", `Registered on Fabric! Tx: ${res.fabricTransactionId?.slice(0, 12)}…`);
      await loadEvidence();
      if (viewEvidence && viewEvidence.evidenceId === ev.evidenceId) {
        setViewEvidence(prev => ({
          ...prev,
          fabricTransactionId: res.fabricTransactionId,
          fabricRecordedAt: res.fabricRecordedAt,
          blockchainStatus: res.blockchainStatus,
        }));
      }
      if (onRefresh) await onRefresh();
    } catch (err) {
      showToast("error", err.response?.data?.message || "Failed to register on Hyperledger Fabric.");
      await loadEvidence();
    } finally {
      setBlockchainRegisteringId(null);
    }
  };

  /* ── Evidence Integrity Verification Handlers (Phase 4 Module 8) ── */
  const [verifyEvidenceTarget, setVerifyEvidenceTarget] = useState(null);

  const handleOpenVerifyModal = (ev) => {
    setVerifyEvidenceTarget(ev);
  };

  const handleEvidenceVerified = useCallback(async (res) => {
    if (res.verificationStatus === "VERIFIED") {
      showToast("success", `✓ Evidence ${res.evidenceId} integrity verified against Fabric!`);
    } else {
      showToast("error", `⚠ TAMPERING DETECTED: Evidence ${res.evidenceId} hash does not match Fabric!`);
    }

    setEvidenceList(prev => prev.map(item => {
      if (item.evidenceId === res.evidenceId) {
        return {
          ...item,
          verificationStatus: res.verificationStatus,
          lastVerifiedAt: res.lastVerifiedAt,
          lastVerifiedBy: res.lastVerifiedBy,
        };
      }
      return item;
    }));

    if (viewEvidence && viewEvidence.evidenceId === res.evidenceId) {
      setViewEvidence(prev => ({
        ...prev,
        verificationStatus: res.verificationStatus,
        lastVerifiedAt: res.lastVerifiedAt,
        lastVerifiedBy: res.lastVerifiedBy,
      }));
    }

    if (onRefresh) await onRefresh();
  }, [viewEvidence, onRefresh]);

  /* ── Render ── */
  return (
    <section style={{
      background: "var(--color-surface)",
      border: "1px solid var(--color-border)",
      borderRadius: 12,
      marginTop: "1.5rem",
      overflow: "hidden",
    }}>
      {/* ── Panel Header ── */}
      <div style={{
        display: "flex", alignItems: "center", justifyContent: "space-between",
        padding: "1.1rem 1.5rem",
        borderBottom: "1px solid var(--color-border)",
        background: "rgba(13,115,119,0.04)",
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <FileIcon size={18} />
          <span style={{ fontWeight: 700, fontSize: "1rem", color: "var(--color-text)" }}>
            Digital Evidence
          </span>
          {!loading && (
            <span style={{
              background: "rgba(13,115,119,0.15)", color: "var(--color-teal)",
              borderRadius: 20, padding: "1px 10px", fontSize: "0.78rem", fontWeight: 700,
            }}>
              {evidenceList.length}
            </span>
          )}
          {isArchived && (
            <span style={{
              background: "rgba(239,68,68,0.1)", color: "#ef4444",
              borderRadius: 20, padding: "2px 10px", fontSize: "0.72rem", fontWeight: 700,
              marginLeft: 4,
            }}>
              ARCHIVED – Read-Only
            </span>
          )}
        </div>

        {/* Action buttons */}
        {!isArchived && (user?.role === "Admin" || user?.role === "Analyst") && (
          <button
            onClick={() => setShowUploadModal(true)}
            style={{
              display: "flex", alignItems: "center", gap: 6,
              padding: "0.45rem 1rem",
              background: "var(--color-teal)", color: "#fff",
              border: "none", borderRadius: 6,
              cursor: "pointer", fontSize: "0.82rem", fontWeight: 700,
            }}
          >
            <UploadIcon size={14} /> Upload Evidence
          </button>
        )}
      </div>

      {/* ── Body ── */}
      <div style={{ padding: "1.25rem 1.5rem" }}>
        {loading ? (
          <div style={{ textAlign: "center", padding: "2rem", color: "var(--color-text-secondary)" }}>
            <div style={{
              width: 32, height: 32, border: "3px solid var(--color-border)",
              borderTopColor: "var(--color-teal)", borderRadius: "50%",
              animation: "spin 0.7s linear infinite", margin: "0 auto 1rem",
            }} />
            Loading evidence from database…
          </div>
        ) : error ? (
          <div style={{
            textAlign: "center", padding: "2rem",
            color: "#ef4444", background: "rgba(239,68,68,0.06)",
            borderRadius: 8, fontSize: "0.875rem",
          }}>
            {error}
          </div>
        ) : evidenceList.length === 0 ? (
          <div style={{
            textAlign: "center", padding: "2.5rem 1rem",
            color: "var(--color-text-secondary)",
          }}>
            <FileIcon size={40} />
            <p style={{ marginTop: 12, fontSize: "0.9rem", fontWeight: 500 }}>
              No evidence collected yet.
            </p>
            {!isArchived && (user?.role === "Admin" || user?.role === "Analyst") && (
              <p style={{ fontSize: "0.8rem", marginTop: 4 }}>
                Click <strong>Upload Evidence</strong> to attach digital evidence to this incident.
              </p>
            )}
          </div>
        ) : (
          <div style={{ overflowX: "auto" }}>
            <table style={{
              width: "100%", borderCollapse: "collapse",
              fontSize: "0.82rem", color: "var(--color-text)",
            }}>
              <thead>
                <tr style={{ borderBottom: "2px solid var(--color-border)" }}>
                  {[
                    "Evidence ID", "File Name", "Type", "Size",
                    "Collected By", "Collection Time",
                    "Storage", "SHA-256", "IPFS", "Blockchain", "Verification",
                    "Actions",
                  ].map(h => (
                    <th key={h} style={{
                      padding: "0.5rem 0.75rem", textAlign: "left",
                      color: "var(--color-text-secondary)", fontWeight: 700,
                      fontSize: "0.72rem", textTransform: "uppercase",
                      letterSpacing: "0.05em", whiteSpace: "nowrap",
                    }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {evidenceList.map((ev, idx) => (
                  <tr key={ev._id || idx} style={{
                    borderBottom: "1px solid var(--color-border)",
                    transition: "background 0.15s",
                  }}
                    onMouseEnter={e => e.currentTarget.style.background = "rgba(13,115,119,0.04)"}
                    onMouseLeave={e => e.currentTarget.style.background = "transparent"}
                  >
                    {/* Evidence ID */}
                    <td style={{ padding: "0.6rem 0.75rem", whiteSpace: "nowrap" }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
                        <code style={{ fontSize: "0.75rem", color: "var(--color-teal)" }}>
                          {ev.evidenceId}
                        </code>
                        <button onClick={() => handleCopy(ev.evidenceId, ev.evidenceId)} style={{
                          background: "none", border: "none", cursor: "pointer",
                          color: copiedKey === ev.evidenceId ? "var(--color-teal)" : "var(--color-text-secondary)",
                          padding: 2,
                        }}><CopyIcon /></button>
                      </div>
                    </td>

                    {/* File Name */}
                    <td style={{ padding: "0.6rem 0.75rem", maxWidth: 160 }}>
                      <div style={{ fontWeight: 500, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}
                        title={ev.originalFileName}>
                        {ev.originalFileName}
                      </div>
                    </td>

                    {/* Type */}
                    <td style={{ padding: "0.6rem 0.75rem", whiteSpace: "nowrap" }}>
                      <span style={{
                        background: "rgba(13,115,119,0.1)", color: "var(--color-teal)",
                        borderRadius: 4, padding: "1px 6px", fontSize: "0.7rem", fontWeight: 700,
                      }}>
                        {ev.fileType || "?"}
                      </span>
                    </td>

                    {/* Size */}
                    <td style={{ padding: "0.6rem 0.75rem", whiteSpace: "nowrap" }}>
                      {formatBytes(ev.fileSize)}
                    </td>

                    {/* Collected By */}
                    <td style={{ padding: "0.6rem 0.75rem", whiteSpace: "nowrap" }}>
                      {ev.collectedBy?.name || ev.collectedBy?.email || "—"}
                    </td>

                    {/* Collection Time */}
                    <td style={{ padding: "0.6rem 0.75rem", whiteSpace: "nowrap", fontSize: "0.75rem" }}>
                      {formatDate(ev.collectionTimestamp)}
                    </td>

                    {/* Storage Status */}
                    <td style={{ padding: "0.6rem 0.75rem" }}>
                      <Badge style={storageColor(ev.storageStatus)} />
                    </td>

                    {/* SHA-256 Status */}
                    <td style={{ padding: "0.6rem 0.75rem" }}>
                      <Badge style={hashColor(ev.hashStatus)} />
                    </td>

                    {/* IPFS Status, CID & Uploaded Time */}
                    <td style={{ padding: "0.6rem 0.75rem", minWidth: 150 }}>
                      <div style={{ display: "flex", flexDirection: "column", gap: 3 }}>
                        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                          <Badge style={ipfsColor(ev.ipfsCid, ev.storageStatus)} />
                          {ev.ipfsCid && (
                            <button
                              onClick={() => handleCopy(ev.ipfsCid, "cid-" + ev.evidenceId)}
                              title="Copy IPFS CID"
                              style={{
                                background: "none", border: "none", cursor: "pointer",
                                color: copiedKey === "cid-" + ev.evidenceId ? "var(--color-teal)" : "var(--color-text-secondary)",
                                padding: 1, display: "flex", alignItems: "center",
                              }}
                            >
                              <CopyIcon size={12} />
                            </button>
                          )}
                        </div>
                        {ev.ipfsCid && (
                          <span style={{ fontSize: "0.7rem", fontFamily: "monospace", color: "var(--color-text-secondary)" }} title={ev.ipfsCid}>
                            {ev.ipfsCid.slice(0, 8)}…{ev.ipfsCid.slice(-6)}
                          </span>
                        )}
                        {ev.ipfsUploadedAt && (
                          <span style={{ fontSize: "0.68rem", color: "var(--color-text-secondary)" }}>
                            {formatDate(ev.ipfsUploadedAt)}
                          </span>
                        )}
                      </div>
                    </td>

                    {/* Blockchain Status & Tx ID */}
                    <td style={{ padding: "0.6rem 0.75rem", minWidth: 140 }}>
                      <div style={{ display: "flex", flexDirection: "column", gap: 3 }}>
                        <Badge style={blockchainColor(ev.blockchainStatus, ev.fabricTransactionId)} />
                        {ev.fabricTransactionId && (
                          <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
                            <span style={{ fontSize: "0.68rem", fontFamily: "monospace", color: "var(--color-text-secondary)" }} title={ev.fabricTransactionId}>
                              {ev.fabricTransactionId.slice(0, 8)}…{ev.fabricTransactionId.slice(-6)}
                            </span>
                            <button
                              onClick={() => handleCopy(ev.fabricTransactionId, "tx-" + ev.evidenceId)}
                              title="Copy Blockchain Transaction ID"
                              style={{
                                background: "none", border: "none", cursor: "pointer",
                                color: copiedKey === "tx-" + ev.evidenceId ? "var(--color-teal)" : "var(--color-text-secondary)",
                                padding: 1, display: "flex", alignItems: "center",
                              }}
                            >
                              <CopyIcon size={11} />
                            </button>
                          </div>
                        )}
                      </div>
                    </td>

                    {/* Verification */}
                    <td style={{ padding: "0.6rem 0.75rem" }}>
                      <Badge style={verifyColor(ev.verificationStatus)} />
                    </td>

                    {/* Actions */}
                    <td style={{ padding: "0.6rem 0.75rem", whiteSpace: "nowrap" }}>
                      <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
                        {/* View Evidence File (Safe Retrieval) */}
                        <button
                          onClick={() => handleViewEvidenceFile(ev)}
                          title="View Evidence (Secure Backend Retrieval)"
                          style={{
                            display: "flex", alignItems: "center", gap: 4,
                            padding: "0.3rem 0.6rem",
                            background: "var(--color-teal, #0d7377)",
                            border: "none",
                            borderRadius: 5, color: "#fff",
                            cursor: "pointer", fontSize: "0.72rem", fontWeight: 700,
                            boxShadow: "0 1px 4px rgba(13,115,119,0.25)",
                          }}
                        >
                          <EyeIcon size={12} /> View
                        </button>

                        {/* View Blockchain Record button if registered */}
                        {(ev.fabricTransactionId || ev.blockchainStatus === "REGISTERED") && (
                          <button
                            onClick={() => handleOpenBlockchainModal(ev)}
                            title="View Blockchain Record on Hyperledger Fabric"
                            style={{
                              display: "flex", alignItems: "center", gap: 4,
                              padding: "0.3rem 0.6rem",
                              background: "rgba(16,185,129,0.12)",
                              border: "1px solid rgba(16,185,129,0.3)",
                              borderRadius: 5, color: "#10b981",
                              cursor: "pointer", fontSize: "0.72rem", fontWeight: 700,
                            }}
                          >
                            <span>🔗</span> Record
                          </button>
                        )}

                        {/* Verify Evidence Integrity button if registered */}
                        {(ev.fabricTransactionId || ev.blockchainStatus === "REGISTERED") && (
                          <button
                            onClick={() => handleOpenVerifyModal(ev)}
                            title="Verify Evidence Integrity against Hyperledger Fabric"
                            style={{
                              display: "flex", alignItems: "center", gap: 4,
                              padding: "0.3rem 0.6rem",
                              background: ev.verificationStatus === "VERIFIED"
                                ? "rgba(16,185,129,0.12)"
                                : ev.verificationStatus === "TAMPERED"
                                ? "rgba(239,68,68,0.15)"
                                : "rgba(13,115,119,0.15)",
                              border: `1px solid ${
                                ev.verificationStatus === "VERIFIED"
                                  ? "rgba(16,185,129,0.4)"
                                  : ev.verificationStatus === "TAMPERED"
                                  ? "#ef4444"
                                  : "var(--color-teal)"
                              }`,
                              borderRadius: 5,
                              color: ev.verificationStatus === "VERIFIED"
                                ? "#10b981"
                                : ev.verificationStatus === "TAMPERED"
                                ? "#ef4444"
                                : "var(--color-teal)",
                              cursor: "pointer", fontSize: "0.72rem", fontWeight: 700,
                            }}
                          >
                            <span>{ev.verificationStatus === "VERIFIED" ? "✓" : ev.verificationStatus === "TAMPERED" ? "⚠" : "🛡️"}</span> Verify
                          </button>
                        )}

                        {/* Register on Fabric if IPFS uploaded but not registered */}
                        {!ev.fabricTransactionId && ev.blockchainStatus !== "REGISTERED" && ev.ipfsCid && (user?.role === "Admin" || user?.role === "Analyst") && !isArchived && (
                          <button
                            onClick={() => handleRegisterBlockchain(ev)}
                            disabled={blockchainRegisteringId === ev.evidenceId}
                            title="Register on Hyperledger Fabric"
                            style={{
                              display: "flex", alignItems: "center", gap: 4,
                              padding: "0.3rem 0.6rem",
                              background: "rgba(13,115,119,0.15)",
                              border: "1px solid var(--color-teal)",
                              borderRadius: 5, color: "var(--color-teal)",
                              cursor: blockchainRegisteringId === ev.evidenceId ? "not-allowed" : "pointer",
                              fontSize: "0.72rem", fontWeight: 700,
                            }}
                          >
                            <span>⚡</span>
                            {blockchainRegisteringId === ev.evidenceId ? "Fabric…" : "Fabric"}
                          </button>
                        )}

                        {/* Upload to IPFS button if not uploaded */}
                        {!ev.ipfsCid && (user?.role === "Admin" || user?.role === "Analyst") && !isArchived && (
                          <button
                            onClick={() => handleUploadToIpfs(ev)}
                            disabled={ipfsUploadingId === ev.evidenceId}
                            title="Upload to Pinata / IPFS"
                            style={{
                              display: "flex", alignItems: "center", gap: 4,
                              padding: "0.3rem 0.6rem",
                              background: "rgba(245,158,11,0.1)",
                              border: "1px solid rgba(245,158,11,0.3)",
                              borderRadius: 5, color: "#f59e0b",
                              cursor: ipfsUploadingId === ev.evidenceId ? "not-allowed" : "pointer",
                              fontSize: "0.72rem", fontWeight: 700,
                            }}
                          >
                            <UploadIcon size={12} />
                            {ipfsUploadingId === ev.evidenceId ? "IPFS..." : "IPFS"}
                          </button>
                        )}

                        {/* Details */}
                        <button
                          onClick={() => setViewEvidence(ev)}
                          title="View Evidence Details"
                          style={{
                            display: "flex", alignItems: "center", gap: 4,
                            padding: "0.3rem 0.6rem",
                            background: "rgba(13,115,119,0.1)",
                            border: "1px solid rgba(13,115,119,0.2)",
                            borderRadius: 5, color: "var(--color-teal)",
                            cursor: "pointer", fontSize: "0.72rem", fontWeight: 700,
                          }}
                        >
                          Details
                        </button>

                        {/* Delete – only if not blockchain-registered */}
                        {!isArchived && !ev.fabricTransactionId &&
                          (user?.role === "Admin" || user?.role === "Analyst") && (
                          <button
                            onClick={() => setDeleteTarget(ev)}
                            title="Delete Evidence"
                            style={{
                              display: "flex", alignItems: "center", gap: 4,
                              padding: "0.3rem 0.6rem",
                              background: "rgba(239,68,68,0.08)",
                              border: "1px solid rgba(239,68,68,0.2)",
                              borderRadius: 5, color: "#ef4444",
                              cursor: "pointer", fontSize: "0.72rem", fontWeight: 700,
                            }}
                          >
                            <TrashIcon /> Delete
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* ── Security & Integrity Note ── */}
      {evidenceList.length > 0 && (
        <div style={{
          padding: "0.75rem 1.5rem",
          borderTop: "1px solid var(--color-border)",
          fontSize: "0.73rem", color: "var(--color-text-secondary)",
          display: "flex", alignItems: "center", gap: 6,
        }}>
          <ShieldIcon size={12} />
          Evidence integrity is cryptographically guaranteed via server-side SHA-256 hashing, Pinata IPFS decentralized storage, and Hyperledger Fabric immutable ledger registration.
        </div>
      )}

      {/* ── Toast ── */}
      {toast && (
        <div style={{
          position: "fixed", bottom: "1.5rem", right: "1.5rem",
          padding: "0.75rem 1.25rem", borderRadius: 8,
          background: toast.type === "success" ? "rgba(16,185,129,0.95)" : "rgba(239,68,68,0.95)",
          color: "#fff", fontWeight: 600, fontSize: "0.875rem",
          boxShadow: "0 8px 24px rgba(0,0,0,0.3)",
          zIndex: 9999, animation: "fadeIn 0.2s ease",
          maxWidth: 380,
        }}>
          {toast.msg}
        </div>
      )}

      {/* ── Modals ── */}
      {showUploadModal && (
        <UploadModal
          onClose={() => { if (!uploading) setShowUploadModal(false); }}
          onSubmit={handleUpload}
          uploading={uploading}
          progress={uploadProgress}
        />
      )}

      {viewEvidence && (
        <EvidenceDetailModal
          evidence={viewEvidence}
          onClose={() => setViewEvidence(null)}
          onCopy={handleCopy}
          copied={copiedKey}
          onViewFile={handleViewEvidenceFile}
          onUploadIpfs={handleUploadToIpfs}
          ipfsUploading={ipfsUploadingId === viewEvidence.evidenceId}
          onViewBlockchainRecord={handleOpenBlockchainModal}
          onRegisterBlockchain={handleRegisterBlockchain}
          blockchainRegistering={blockchainRegisteringId === viewEvidence.evidenceId}
          onVerifyIntegrity={handleOpenVerifyModal}
        />
      )}

      {blockchainEvidence && (
        <BlockchainRecordModal
          evidence={blockchainEvidence}
          onClose={() => setBlockchainEvidence(null)}
          onCopy={handleCopy}
          copied={copiedKey}
          onViewFile={handleViewEvidenceFile}
        />
      )}

      {verifyEvidenceTarget && (
        <EvidenceIntegrityModal
          evidence={verifyEvidenceTarget}
          onClose={() => setVerifyEvidenceTarget(null)}
          onCopy={handleCopy}
          copied={copiedKey}
          onVerified={handleEvidenceVerified}
        />
      )}

      {deleteTarget && (
        <DeleteConfirmModal
          evidence={deleteTarget}
          onClose={() => { if (!deleting) setDeleteTarget(null); }}
          onConfirm={handleDelete}
          deleting={deleting}
        />
      )}
    </section>
  );
};

export default EvidencePanel;
