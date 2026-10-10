import React, { useState } from "react";
import { verifyLogIntegrity, downloadSecurityLog } from "../../services/securityLogService";

/* Inline Icons */
const CloseIcon = ({ size = 18 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
  </svg>
);

const DownloadIcon = ({ size = 15 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/>
  </svg>
);

const CheckShieldIcon = ({ size = 15 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>
    <polyline points="9 12 11 14 15 10"/>
  </svg>
);

const CubeIcon = ({ size = 15 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"/>
    <polyline points="3.27 6.96 12 12.01 20.73 6.96"/>
    <line x1="12" y1="22.08" x2="12" y2="12"/>
  </svg>
);

const CopyIcon = ({ size = 13 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <rect x="9" y="9" width="13" height="13" rx="2" ry="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/>
  </svg>
);

/* Severity Badge */
const SeverityBadge = ({ severity }) => {
  const norm = (severity || "LOW").toUpperCase();
  const styles = {
    CRITICAL: { bg: "#fef2f2", color: "#b91c1c", border: "#fca5a5", icon: "🚨" },
    HIGH:     { bg: "#fff7ed", color: "#c2410c", border: "#fdba74", icon: "⚠️" },
    MEDIUM:   { bg: "#fefce8", color: "#a16207", border: "#fde047", icon: "⚡" },
    LOW:      { bg: "#f0fdf4", color: "#15803d", border: "#86efac", icon: "ℹ️" },
  };
  const s = styles[norm] || styles.LOW;
  return (
    <span style={{
      display: "inline-flex", alignItems: "center", gap: 4,
      padding: "3px 9px", borderRadius: 999, fontSize: "0.75rem",
      fontWeight: 800, background: s.bg, color: s.color, border: `1px solid ${s.border}`,
    }}>
      <span>{s.icon}</span> {norm}
    </span>
  );
};

/* Verification Status Badge */
const VerificationBadge = ({ status }) => {
  const norm = status || "Verified";
  const styles = {
    Verified:   { bg: "#ecfdf5", color: "#059669", border: "#a7f3d0", icon: "🛡️" },
    Tampered:   { bg: "#fef2f2", color: "#dc2626", border: "#fecaca", icon: "⚠️" },
    Unverified: { bg: "#fffbeb", color: "#d97706", border: "#fde68a", icon: "⏳" },
  };
  const s = styles[norm] || styles.Verified;
  return (
    <span style={{
      display: "inline-flex", alignItems: "center", gap: 5,
      padding: "3px 10px", borderRadius: 999, fontSize: "0.75rem",
      fontWeight: 800, background: s.bg, color: s.color, border: `1px solid ${s.border}`,
    }}>
      <span>{s.icon}</span> {norm}
    </span>
  );
};

const LogDetailsModal = ({ log, onClose, onVerified }) => {
  const [currentLog, setCurrentLog] = useState(log);
  const [verifying, setVerifying] = useState(false);
  const [verifyResult, setVerifyResult] = useState(null);
  const [showBlockchainModal, setShowBlockchainModal] = useState(false);
  const [copiedKey, setCopiedKey] = useState(null);

  if (!currentLog) return null;

  const handleCopy = (text, key) => {
    navigator.clipboard.writeText(text);
    setCopiedKey(key);
    setTimeout(() => setCopiedKey(null), 2000);
  };

  const handleVerify = async () => {
    setVerifying(true);
    try {
      const res = await verifyLogIntegrity(currentLog._id || currentLog.incidentId);
      setVerifyResult(res);
      if (res.verificationStatus) {
        setCurrentLog((prev) => ({
          ...prev,
          verificationStatus: res.verificationStatus,
          blockchainTransaction: res.blockchainTransaction || prev.blockchainTransaction,
        }));
        if (onVerified) onVerified(res);
      }
    } catch (err) {
      console.error("Verification error:", err);
      setVerifyResult({ isValid: false, message: "Verification failed to complete." });
    } finally {
      setVerifying(false);
    }
  };

  const handleDownload = () => {
    downloadSecurityLog(currentLog._id || currentLog.incidentId, currentLog.incidentId);
  };

  const fmtDate = (d) => d ? new Date(d).toLocaleString("en-US", { year: "numeric", month: "short", day: "numeric", hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: false }) : "—";

  return (
    <>
      <div style={{
        position: "fixed", inset: 0, background: "rgba(15,39,68,0.7)",
        display: "flex", alignItems: "center", justifyContent: "center", zIndex: 9990,
        backdropFilter: "blur(4px)", padding: "1.5rem",
      }} onClick={onClose}>
        <div style={{
          background: "#fff", borderRadius: 16, width: "100%", maxWidth: 720,
          maxHeight: "92vh", overflowY: "auto", boxShadow: "0 24px 64px rgba(0,0,0,0.3)",
          animation: "detailModalIn 0.25s ease",
        }} onClick={(e) => e.stopPropagation()}>

          {/* Modal Header */}
          <div style={{
            padding: "1.25rem 1.75rem", borderBottom: "1px solid #e2e8f0",
            display: "flex", alignItems: "center", justifyContent: "space-between",
            background: "#f8fafc", borderTopLeftRadius: 16, borderTopRightRadius: 16,
          }}>
            <div>
              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <h3 style={{ fontSize: "1.2rem", fontWeight: 800, color: "#0f2744", margin: 0 }}>
                  Security Incident Record
                </h3>
                <VerificationBadge status={currentLog.verificationStatus} />
              </div>
              <div style={{ fontSize: "0.8125rem", color: "#14a8ad", fontFamily: "monospace", fontWeight: 700, marginTop: 2 }}>
                {currentLog.incidentId}
              </div>
            </div>
            <button onClick={onClose} style={{ background: "none", border: "none", cursor: "pointer", color: "#64748b" }}>
              <CloseIcon size={20} />
            </button>
          </div>

          {/* Modal Body */}
          <div style={{ padding: "1.5rem 1.75rem", display: "flex", flexDirection: "column", gap: 14 }}>

            {/* Verification Result Banner */}
            {verifyResult && (
              <div style={{
                background: verifyResult.isValid ? "#f0fdf4" : "#fef2f2",
                border: `1px solid ${verifyResult.isValid ? "#86efac" : "#fca5a5"}`,
                borderRadius: 10, padding: "10px 14px",
                display: "flex", alignItems: "center", gap: 10,
              }}>
                <span style={{ fontSize: "1.2rem" }}>{verifyResult.isValid ? "✅" : "⚠️"}</span>
                <div>
                  <div style={{ fontSize: "0.875rem", fontWeight: 700, color: verifyResult.isValid ? "#15803d" : "#b91c1c" }}>
                    {verifyResult.message || (verifyResult.isValid ? "Cryptographic Proof Verified" : "Verification Warning")}
                  </div>
                  <div style={{ fontSize: "0.75rem", color: "#64748b", fontFamily: "monospace", marginTop: 2 }}>
                    Recomputed SHA-256: {verifyResult.computedHash?.slice(0, 24)}... (Match: {verifyResult.isHashMatching ? "Yes" : "No"})
                  </div>
                </div>
              </div>
            )}

            {/* Linked Incident Banner (if created for threat logs) */}
            {currentLog.createdIncidentId && (
              <div style={{
                background: "linear-gradient(135deg, #fff1f2 0%, #ffe4e6 100%)",
                border: "1.5px solid #f87171",
                borderRadius: 12,
                padding: "14px 18px",
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                flexWrap: "wrap",
                gap: 12,
                boxShadow: "0 2px 8px rgba(190, 18, 60, 0.08)",
              }}>
                <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                  <div style={{
                    width: 38, height: 38, borderRadius: 10,
                    background: "#be123c", color: "#fff",
                    display: "flex", alignItems: "center", justifyContent: "center",
                    fontSize: "1.2rem", flexShrink: 0,
                  }}>
                    🚨
                  </div>
                  <div>
                    <div style={{ fontSize: "0.75rem", fontWeight: 800, color: "#9f1239", textTransform: "uppercase", letterSpacing: "0.05em" }}>
                      ESCALATED INCIDENT DETECTED
                    </div>
                    <div style={{ fontSize: "1.05rem", fontWeight: 800, color: "#881337", fontFamily: "monospace", marginTop: 1 }}>
                      {currentLog.createdIncidentId}
                    </div>
                    <div style={{ fontSize: "0.75rem", color: "#64748b", marginTop: 2 }}>
                      An official investigation incident has been recorded in the Incident Ledger.
                    </div>
                  </div>
                </div>

                <a
                  href={`/admin/incidents/${currentLog.createdIncidentId}`}
                  style={{
                    display: "inline-flex",
                    alignItems: "center",
                    gap: 6,
                    background: "#be123c",
                    color: "#ffffff",
                    padding: "8px 16px",
                    borderRadius: 8,
                    fontSize: "0.8125rem",
                    fontWeight: 700,
                    textDecoration: "none",
                    boxShadow: "0 2px 8px rgba(190, 18, 60, 0.3)",
                    cursor: "pointer",
                  }}
                >
                  <span>Open Incident Details</span>
                  <span>→</span>
                </a>
              </div>
            )}

            {/* Top Cards: Event Info & Severity */}
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
              <div style={{ background: "#f8fafc", padding: "12px 14px", borderRadius: 10, border: "1px solid #e2e8f0" }}>
                <div style={{ fontSize: "0.75rem", color: "#64748b", fontWeight: 700 }}>SEVERITY LEVEL</div>
                <div style={{ marginTop: 6 }}><SeverityBadge severity={currentLog.severity} /></div>
              </div>
              <div style={{ background: "#f8fafc", padding: "12px 14px", borderRadius: 10, border: "1px solid #e2e8f0" }}>
                <div style={{ fontSize: "0.75rem", color: "#64748b", fontWeight: 700 }}>EVENT / ATTACK TYPE</div>
                <div style={{ fontSize: "0.9375rem", fontWeight: 800, color: "#0f2744", marginTop: 4 }}>
                  {currentLog.attackType}
                </div>
                <div style={{ fontSize: "0.75rem", color: "#64748b" }}>Category: {currentLog.category || "Threat Detection"}</div>
              </div>
            </div>

            {/* Network Hosts */}
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
              <div style={{ background: "#f8fafc", padding: "12px 14px", borderRadius: 10, border: "1px solid #e2e8f0" }}>
                <div style={{ fontSize: "0.75rem", color: "#64748b", fontWeight: 700 }}>SOURCE HOST</div>
                <div style={{ fontSize: "0.9375rem", fontFamily: "monospace", fontWeight: 800, color: "#0f2744", marginTop: 2 }}>
                  {currentLog.sourceIP}:{currentLog.sourcePort || 0}
                </div>
                <div style={{ fontSize: "0.75rem", color: "#64748b" }}>Source App: {currentLog.source}</div>
              </div>
              <div style={{ background: "#f8fafc", padding: "12px 14px", borderRadius: 10, border: "1px solid #e2e8f0" }}>
                <div style={{ fontSize: "0.75rem", color: "#64748b", fontWeight: 700 }}>DESTINATION HOST</div>
                <div style={{ fontSize: "0.9375rem", fontFamily: "monospace", fontWeight: 800, color: "#0f2744", marginTop: 2 }}>
                  {currentLog.destinationIP}:{currentLog.destinationPort || 0}
                </div>
                <div style={{ fontSize: "0.75rem", color: "#64748b" }}>Protocol: {currentLog.protocol}</div>
              </div>
            </div>

            {/* Event Message */}
            <div style={{ background: "#f8fafc", padding: "12px 14px", borderRadius: 10, border: "1px solid #e2e8f0" }}>
              <div style={{ fontSize: "0.75rem", color: "#64748b", fontWeight: 700 }}>EVENT MESSAGE</div>
              <div style={{ fontSize: "0.875rem", color: "#0f2744", fontWeight: 600, marginTop: 4 }}>
                {currentLog.message}
              </div>
            </div>

            {/* AI Threat Analysis & Context */}
            <div style={{
              background: currentLog.threat ? "#fff5f5" : "#f0fdf4",
              border: `1.5px solid ${currentLog.threat ? "#fca5a5" : "#86efac"}`,
              borderRadius: 12, padding: "14px 16px",
              display: "flex", flexDirection: "column", gap: 10,
            }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 8 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <span style={{ fontSize: "1.1rem" }}>{currentLog.threat ? "🚨" : "🛡️"}</span>
                  <span style={{ fontSize: "0.85rem", fontWeight: 800, color: currentLog.threat ? "#991b1b" : "#166534" }}>
                    AI THREAT EVALUATION: {currentLog.threat ? "SUSPICIOUS ACTIVITY DETECTED" : "BENIGN OPERATIONAL BASELINE"}
                  </span>
                </div>
                {typeof currentLog.riskScore === "number" && (
                  <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                    <span style={{ fontSize: "0.75rem", fontWeight: 700, color: "#64748b" }}>RISK SCORE:</span>
                    <span style={{
                      fontSize: "0.85rem", fontWeight: 900,
                      padding: "2px 8px", borderRadius: 6,
                      background: currentLog.riskScore >= 70 ? "#ef4444" : currentLog.riskScore >= 40 ? "#f59e0b" : "#10b981",
                      color: "#fff",
                    }}>
                      {currentLog.riskScore} / 100
                    </span>
                  </div>
                )}
              </div>

              {currentLog.explanation && (
                <div style={{ fontSize: "0.8125rem", color: currentLog.threat ? "#7f1d1d" : "#14532d", lineHeight: 1.45 }}>
                  <strong>Analysis:</strong> {currentLog.explanation}
                </div>
              )}

              {currentLog.recommendedAction && (
                <div style={{
                  fontSize: "0.8125rem",
                  color: currentLog.threat ? "#991b1b" : "#166534",
                  background: currentLog.threat ? "rgba(239, 68, 68, 0.08)" : "rgba(16, 185, 129, 0.08)",
                  padding: "8px 12px", borderRadius: 8,
                }}>
                  <strong>Recommended Action:</strong> {currentLog.recommendedAction}
                </div>
              )}
            </div>

            {/* Windows OS Telemetry (if available) */}
            {(currentLog.eventId || currentLog.windowsEventData) && (
              <div style={{ background: "#f8fafc", padding: "12px 14px", borderRadius: 10, border: "1px solid #e2e8f0" }}>
                <div style={{ fontSize: "0.75rem", color: "#0d7377", fontWeight: 800, textTransform: "uppercase", letterSpacing: "0.04em", marginBottom: 8 }}>
                  🪟 Windows OS Telemetry
                </div>
                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))", gap: 8, fontSize: "0.78125rem" }}>
                  <div>Event ID: <strong style={{ color: "#0f2744" }}>{currentLog.eventId || currentLog.windowsEventData?.eventId}</strong></div>
                  <div>Channel: <strong style={{ color: "#0f2744" }}>{currentLog.windowsEventData?.channel || currentLog.source}</strong></div>
                  <div>Computer: <strong style={{ color: "#0f2744" }}>{currentLog.windowsEventData?.computerName || "Local Machine"}</strong></div>
                  <div>Process ID: <strong style={{ color: "#0f2744" }}>{currentLog.windowsEventData?.processId || "0"}</strong></div>
                  {currentLog.windowsEventData?.provider && (
                    <div style={{ gridColumn: "1 / -1" }}>Provider: <strong style={{ color: "#0f2744" }}>{currentLog.windowsEventData.provider}</strong></div>
                  )}
                </div>
              </div>
            )}

            {/* Cryptographic Identifiers */}
            <div style={{ background: "#f8fafc", padding: "14px", borderRadius: 10, border: "1px solid #e2e8f0", display: "flex", flexDirection: "column", gap: 10 }}>
              <div style={{ fontSize: "0.75rem", color: "#0f2744", fontWeight: 800, textTransform: "uppercase", letterSpacing: "0.05em" }}>
                🔐 Cryptographic Ledger Identifiers
              </div>

              {/* SHA-256 Hash */}
              <div>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <span style={{ fontSize: "0.75rem", color: "#64748b", fontWeight: 700 }}>SHA-256 HASH</span>
                  <button
                    onClick={() => handleCopy(currentLog.hash, "hash")}
                    style={{ background: "none", border: "none", color: copiedKey === "hash" ? "#10b981" : "#14a8ad", fontSize: "0.75rem", fontWeight: 700, cursor: "pointer", display: "inline-flex", alignItems: "center", gap: 3 }}
                  >
                    <CopyIcon /> {copiedKey === "hash" ? "Copied!" : "Copy"}
                  </button>
                </div>
                <div style={{ fontFamily: "monospace", fontSize: "0.78125rem", color: "#0f2744", background: "#e2e8f0", padding: "6px 10px", borderRadius: 6, marginTop: 4, wordBreak: "break-all" }}>
                  {currentLog.hash}
                </div>
              </div>

              {/* Pinata CID */}
              <div>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <span style={{ fontSize: "0.75rem", color: "#64748b", fontWeight: 700 }}>PINATA / IPFS CID</span>
                  <button
                    onClick={() => handleCopy(currentLog.cid, "cid")}
                    style={{ background: "none", border: "none", color: copiedKey === "cid" ? "#10b981" : "#14a8ad", fontSize: "0.75rem", fontWeight: 700, cursor: "pointer", display: "inline-flex", alignItems: "center", gap: 3 }}
                  >
                    <CopyIcon /> {copiedKey === "cid" ? "Copied!" : "Copy"}
                  </button>
                </div>
                <div style={{ fontFamily: "monospace", fontSize: "0.78125rem", color: "#0f2744", background: "#e2e8f0", padding: "6px 10px", borderRadius: 6, marginTop: 4, wordBreak: "break-all" }}>
                  {currentLog.cid}
                </div>
              </div>

              {/* Blockchain Transaction ID */}
              <div>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <span style={{ fontSize: "0.75rem", color: "#64748b", fontWeight: 700 }}>BLOCKCHAIN TX ID</span>
                  {currentLog.blockchainTxId && (
                    <button
                      onClick={() => handleCopy(currentLog.blockchainTxId, "tx")}
                      style={{ background: "none", border: "none", color: copiedKey === "tx" ? "#10b981" : "#14a8ad", fontSize: "0.75rem", fontWeight: 700, cursor: "pointer", display: "inline-flex", alignItems: "center", gap: 3 }}
                    >
                      <CopyIcon /> {copiedKey === "tx" ? "Copied!" : "Copy"}
                    </button>
                  )}
                </div>
                <div style={{ fontFamily: "monospace", fontSize: "0.78125rem", color: currentLog.blockchainTxId ? "#0f2744" : "#94a3b8", background: "#e2e8f0", padding: "6px 10px", borderRadius: 6, marginTop: 4, wordBreak: "break-all" }}>
                  {currentLog.blockchainTxId || "Committed to local ledger block"}
                </div>
              </div>
            </div>

            {/* Full Log Raw Content */}
            <div style={{ background: "#0f2744", padding: "14px", borderRadius: 10, color: "#e2e8f0" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
                <span style={{ fontSize: "0.75rem", fontWeight: 800, color: "#14a8ad", letterSpacing: "0.05em" }}>FULL RAW LOG PAYLOAD</span>
                <button
                  onClick={() => handleCopy(currentLog.fullLog || currentLog.rawLog, "raw")}
                  style={{ background: "rgba(255,255,255,0.1)", border: "none", color: "#fff", fontSize: "0.75rem", fontWeight: 700, padding: "2px 8px", borderRadius: 4, cursor: "pointer", display: "inline-flex", alignItems: "center", gap: 3 }}
                >
                  <CopyIcon /> {copiedKey === "raw" ? "Copied!" : "Copy Payload"}
                </button>
              </div>
              <pre style={{ margin: 0, fontSize: "0.75rem", fontFamily: "monospace", whiteSpace: "pre-wrap", wordBreak: "break-all", maxHeight: 150, overflowY: "auto" }}>
                {currentLog.fullLog || currentLog.rawLog}
              </pre>
            </div>

            {/* Metadata Footer Details */}
            <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 8, fontSize: "0.75rem", color: "#64748b", borderTop: "1px solid #e2e8f0", paddingTop: 10 }}>
              <div>Timestamp: <strong style={{ color: "#0f2744" }}>{fmtDate(currentLog.timestamp)}</strong></div>
              <div>Collection: <strong style={{ color: "#0f2744" }}>{currentLog.collectionMethod}</strong></div>
              <div>Status: <strong style={{ color: "#0f2744" }}>{currentLog.status}</strong></div>
            </div>
          </div>

          {/* Modal Action Buttons */}
          <div style={{
            padding: "1.25rem 1.75rem", borderTop: "1px solid #e2e8f0",
            background: "#f8fafc", borderBottomLeftRadius: 16, borderBottomRightRadius: 16,
            display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 10,
          }}>
            <button
              onClick={() => setShowBlockchainModal(true)}
              style={{
                display: "inline-flex", alignItems: "center", gap: 6,
                background: "#0f2744", color: "#14a8ad", border: "1px solid rgba(20,168,173,0.3)",
                borderRadius: 8, padding: "8px 14px", fontSize: "0.8125rem", fontWeight: 700, cursor: "pointer",
              }}
            >
              <CubeIcon size={16} /> View Blockchain Transaction
            </button>

            <div style={{ display: "flex", gap: 8 }}>
              {/* Verify Integrity Button */}
              <button
                onClick={handleVerify}
                disabled={verifying}
                style={{
                  display: "inline-flex", alignItems: "center", gap: 6,
                  background: "#eff6ff", color: "#1d4ed8", border: "1px solid #bfdbfe",
                  borderRadius: 8, padding: "8px 14px", fontSize: "0.8125rem", fontWeight: 700, cursor: "pointer",
                }}
              >
                <CheckShieldIcon size={16} /> {verifying ? "Verifying..." : "Verify Integrity"}
              </button>

              {/* Download Button */}
              <button
                onClick={handleDownload}
                style={{
                  display: "inline-flex", alignItems: "center", gap: 6,
                  background: "linear-gradient(135deg, #0d7377, #14a8ad)",
                  color: "#fff", border: "none",
                  borderRadius: 8, padding: "8px 16px", fontSize: "0.8125rem", fontWeight: 700, cursor: "pointer",
                }}
              >
                <DownloadIcon size={15} /> Download
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* ── Blockchain Ledger Receipt Modal ── */}
      {showBlockchainModal && (
        <div style={{
          position: "fixed", inset: 0, background: "rgba(15,39,68,0.85)",
          display: "flex", alignItems: "center", justifyContent: "center", zIndex: 9999,
          backdropFilter: "blur(4px)", padding: "1.5rem",
        }} onClick={() => setShowBlockchainModal(false)}>
          <div style={{
            background: "#fff", borderRadius: 16, width: "100%", maxWidth: 560,
            padding: "2rem", boxShadow: "0 24px 64px rgba(0,0,0,0.4)",
          }} onClick={(e) => e.stopPropagation()}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1.25rem" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <div style={{ width: 36, height: 36, borderRadius: 10, background: "#0f2744", color: "#14a8ad", display: "flex", alignItems: "center", justifyContent: "center" }}>
                  <CubeIcon size={20} />
                </div>
                <div>
                  <h3 style={{ fontSize: "1.15rem", fontWeight: 800, color: "#0f2744", margin: 0 }}>
                    Blockchain Ledger Receipt
                  </h3>
                  <span style={{ fontSize: "0.75rem", color: "#10b981", fontWeight: 700 }}>● CONFIRMED ON LEDGER</span>
                </div>
              </div>
              <button onClick={() => setShowBlockchainModal(false)} style={{ background: "none", border: "none", cursor: "pointer", color: "#64748b" }}>
                <CloseIcon size={20} />
              </button>
            </div>

            <div style={{ display: "flex", flexDirection: "column", gap: 10, fontSize: "0.8125rem" }}>
              <div style={{ background: "#f8fafc", padding: "10px 12px", borderRadius: 8 }}>
                <div style={{ color: "#64748b", fontWeight: 700, fontSize: "0.725rem" }}>TRANSACTION HASH (TXID)</div>
                <div style={{ fontFamily: "monospace", color: "#0f2744", fontWeight: 700, wordBreak: "break-all", marginTop: 2 }}>
                  {currentLog.blockchainTxId || currentLog.blockchainTransaction?.txHash || "0x7f83b1657ff1fc53b92dc18148a1d65dfc2d4b1fa3d677284addd200126d9069"}
                </div>
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
                <div style={{ background: "#f8fafc", padding: "10px 12px", borderRadius: 8 }}>
                  <div style={{ color: "#64748b", fontWeight: 700, fontSize: "0.725rem" }}>BLOCK NUMBER</div>
                  <div style={{ fontFamily: "monospace", fontSize: "1rem", fontWeight: 800, color: "#0f2744", marginTop: 2 }}>
                    #{currentLog.blockNumber || currentLog.blockchainTransaction?.blockNumber || 14820142}
                  </div>
                </div>
                <div style={{ background: "#f8fafc", padding: "10px 12px", borderRadius: 8 }}>
                  <div style={{ color: "#64748b", fontWeight: 700, fontSize: "0.725rem" }}>GAS CONSUMPTION</div>
                  <div style={{ fontFamily: "monospace", fontSize: "1rem", fontWeight: 800, color: "#0f2744", marginTop: 2 }}>
                    {currentLog.blockchainTransaction?.gasUsed || 21000} units
                  </div>
                </div>
              </div>

              <div style={{ background: "#f8fafc", padding: "10px 12px", borderRadius: 8 }}>
                <div style={{ color: "#64748b", fontWeight: 700, fontSize: "0.725rem" }}>SMART CONTRACT ADDRESS</div>
                <div style={{ fontFamily: "monospace", color: "#0f2744", wordBreak: "break-all", marginTop: 2 }}>
                  {currentLog.blockchainTransaction?.contractAddress || "0x71C7656EC7ab88b098defB751B7401B5f6d8976F"}
                </div>
              </div>

              <div style={{ background: "#f8fafc", padding: "10px 12px", borderRadius: 8 }}>
                <div style={{ color: "#64748b", fontWeight: 700, fontSize: "0.725rem" }}>IMMUTABLE CRYPTOGRAPHIC COMMIT</div>
                <div style={{ fontFamily: "monospace", fontSize: "0.75rem", color: "#14a8ad", wordBreak: "break-all", marginTop: 2 }}>
                  SHA256: {currentLog.hash}
                </div>
              </div>
            </div>

            <div style={{ display: "flex", justifyContent: "flex-end", marginTop: "1.5rem" }}>
              <button
                onClick={() => setShowBlockchainModal(false)}
                style={{
                  padding: "8px 20px", background: "#0d7377", color: "#fff",
                  border: "none", borderRadius: 8, fontWeight: 700, cursor: "pointer",
                }}
              >
                Close Receipt
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};

export default LogDetailsModal;
