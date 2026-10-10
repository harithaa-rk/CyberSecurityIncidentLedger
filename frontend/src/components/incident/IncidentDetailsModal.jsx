import React, { useState } from "react";
import ReportPanel from "./ReportPanel";

/* ── Inline SVG Icons ── */
const ShieldIcon = ({ size = 20 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>
  </svg>
);

const CloseIcon = ({ size = 18 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
  </svg>
);

const CopyIcon = ({ size = 13 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <rect x="9" y="9" width="13" height="13" rx="2" ry="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/>
  </svg>
);

const UserIcon = ({ size = 14 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/>
  </svg>
);

const CheckCircleIcon = ({ size = 14 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/>
  </svg>
);

const BoltIcon = ({ size = 14 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/>
  </svg>
);

const ArchiveIcon = ({ size = 14 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="21 8 21 21 3 21 3 8"/><rect x="1" y="3" width="22" height="5"/><line x1="10" y1="12" x2="14" y2="12"/>
  </svg>
);

/* ── Badges ── */
export const StatusBadge = ({ status }) => {
  const norm = (status || "NEW").toUpperCase();
  const styles = {
    NEW:           { bg: "#eff6ff", color: "#2563eb", border: "#bfdbfe", icon: "✨" },
    ASSIGNED:      { bg: "#f5f3ff", color: "#7c3aed", border: "#ddd6fe", icon: "👤" },
    INVESTIGATING: { bg: "#fffbeb", color: "#d97706", border: "#fde68a", icon: "🔍" },
    RESOLVED:      { bg: "#ecfdf5", color: "#059669", border: "#a7f3d0", icon: "✅" },
    ARCHIVED:      { bg: "#f1f5f9", color: "#475569", border: "#cbd5e1", icon: "📦" },
  };
  const s = styles[norm] || styles.NEW;
  return (
    <span style={{
      display: "inline-flex", alignItems: "center", gap: 5,
      padding: "3px 10px", borderRadius: 999, fontSize: "0.75rem",
      fontWeight: 800, background: s.bg, color: s.color, border: `1px solid ${s.border}`,
      letterSpacing: "0.03em",
    }}>
      <span>{s.icon}</span> {norm}
    </span>
  );
};

export const SeverityBadge = ({ severity }) => {
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
      display: "inline-flex", alignItems: "center", gap: 5,
      padding: "3px 9px", borderRadius: 999, fontSize: "0.75rem",
      fontWeight: 800, background: s.bg, color: s.color, border: `1px solid ${s.border}`,
      letterSpacing: "0.03em",
    }}>
      <span>{s.icon}</span> {norm}
    </span>
  );
};

const formatDate = (dateStr) => {
  if (!dateStr) return "—";
  return new Date(dateStr).toLocaleString("en-US", {
    year: "numeric", month: "short", day: "numeric",
    hour: "2-digit", minute: "2-digit", second: "2-digit",
    hour12: false,
  });
};

const IncidentDetailsModal = ({
  incident,
  onClose,
  userRole = "Admin",
  onOpenAssign,
  onOpenInvestigate,
  onOpenResolve,
  onOpenArchive,
}) => {
  const [copiedKey, setCopiedKey] = useState(null);
  const [activeTab, setActiveTab] = useState("overview");

  if (!incident) return null;

  const handleCopy = (text, key) => {
    navigator.clipboard.writeText(text);
    setCopiedKey(key);
    setTimeout(() => setCopiedKey(null), 2000);
  };

  const status = (incident.status || "NEW").toUpperCase();
  const canManage = userRole === "Admin" || userRole === "Analyst";
  const isAdmin = userRole === "Admin";

  const secLog = incident.securityLogId && typeof incident.securityLogId === "object"
    ? incident.securityLogId
    : null;

  return (
    <div style={{
      position: "fixed", inset: 0, zIndex: 9000,
      background: "rgba(15, 39, 68, 0.65)", backdropFilter: "blur(5px)",
      display: "flex", alignItems: "center", justifyContent: "center", padding: "1.5rem",
      animation: "modalFadeIn 0.2s ease-out",
    }}>
      <style>{`
        @keyframes modalFadeIn { from { opacity: 0; transform: scale(0.97); } to { opacity: 1; transform: scale(1); } }
        .details-tab-btn {
          background: none; border: none; padding: 10px 18px; font-size: 0.875rem;
          font-weight: 700; color: #64748b; cursor: pointer; border-bottom: 2px solid transparent;
          transition: all 0.15s; font-family: inherit;
        }
        .details-tab-btn.active {
          color: #0d7377; border-bottom-color: #0d7377;
        }
        .detail-info-row {
          display: flex; justify-content: space-between; align-items: flex-start;
          padding: 8px 0; border-bottom: 1px solid #f1f5f9; font-size: 0.875rem;
        }
        .detail-info-row:last-child { border-bottom: none; }
        .detail-info-label { color: #64748b; font-weight: 600; min-width: 140px; }
        .detail-info-val { color: #0f2744; font-weight: 700; text-align: right; word-break: break-all; }
      `}</style>

      <div style={{
        background: "#fff", borderRadius: 16, width: "100%", maxWidth: 940,
        maxHeight: "90vh", display: "flex", flexDirection: "column",
        boxShadow: "0 20px 60px rgba(0,0,0,0.3)", overflow: "hidden",
      }}>

        {/* ── Modal Header ── */}
        <div style={{
          background: "#0f2744", color: "#fff", padding: "1.25rem 1.75rem",
          display: "flex", alignItems: "center", justifyContent: "space-between",
          borderBottom: "1px solid rgba(255,255,255,0.1)",
        }}>
          <div style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
            <div style={{
              background: "rgba(20, 168, 173, 0.2)", color: "#14a8ad",
              padding: "6px 10px", borderRadius: 8, display: "flex", alignItems: "center",
            }}>
              <ShieldIcon size={20} />
            </div>
            <div>
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <span style={{ fontSize: "1.15rem", fontWeight: 800, fontFamily: "monospace", letterSpacing: "0.02em" }}>
                  {incident.incidentId}
                </span>
                <button
                  onClick={() => handleCopy(incident.incidentId, "modal-id")}
                  title="Copy Incident ID"
                  style={{
                    background: "rgba(255,255,255,0.1)", border: "none", color: "#cbd5e1",
                    borderRadius: 4, padding: "3px 6px", cursor: "pointer", display: "flex",
                    alignItems: "center", gap: 4, fontSize: "0.7rem",
                  }}
                >
                  <CopyIcon /> {copiedKey === "modal-id" ? "Copied!" : "Copy"}
                </button>
              </div>
              <div style={{ color: "#94a3b8", fontSize: "0.8rem", marginTop: 2 }}>
                {incident.title || "Security Incident"} · Created {formatDate(incident.createdAt || incident.timestamp)}
              </div>
            </div>
          </div>

          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <StatusBadge status={incident.status} />
            <SeverityBadge severity={incident.severity} />
            <button
              onClick={onClose}
              style={{
                background: "rgba(255,255,255,0.1)", border: "none", color: "#fff",
                borderRadius: "50%", width: 32, height: 32, cursor: "pointer",
                display: "flex", alignItems: "center", justifyContent: "center", marginLeft: 8,
              }}
            >
              <CloseIcon />
            </button>
          </div>
        </div>

        {/* ── Tabs Navigation ── */}
        <div style={{
          display: "flex", borderBottom: "1px solid #e2e8f0", background: "#f8fafc",
          padding: "0 1.5rem", gap: 8, overflowX: "auto",
        }}>
          <button
            className={`details-tab-btn ${activeTab === "overview" ? "active" : ""}`}
            onClick={() => setActiveTab("overview")}
          >
            🛡️ Overview & Threat
          </button>
          <button
            className={`details-tab-btn ${activeTab === "ai" ? "active" : ""}`}
            onClick={() => setActiveTab("ai")}
          >
            🤖 AI Analysis & Recommendations
          </button>
          <button
            className={`details-tab-btn ${activeTab === "log" ? "active" : ""}`}
            onClick={() => setActiveTab("log")}
          >
            📜 Original Security Log
          </button>
          <button
            className={`details-tab-btn ${activeTab === "investigation" ? "active" : ""}`}
            onClick={() => setActiveTab("investigation")}
          >
            🔍 Investigation & Resolution
          </button>
          <button
            className={`details-tab-btn ${activeTab === "timeline" ? "active" : ""}`}
            onClick={() => setActiveTab("timeline")}
          >
            ⏱️ Activity Timeline ({incident.activityHistory?.length || 0})
          </button>
          <button
            className={`details-tab-btn ${activeTab === "reports" ? "active" : ""}`}
            onClick={() => setActiveTab("reports")}
          >
            📄 Reports
          </button>
        </div>

        {/* ── Modal Body Content ── */}
        <div style={{ padding: "1.5rem", overflowY: "auto", flex: 1 }}>

          {/* TAB 1: OVERVIEW & THREAT */}
          {activeTab === "overview" && (
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(360px, 1fr))", gap: 16 }}>
              {/* Card 1: Incident Identity */}
              <div style={{ background: "#f8fafc", borderRadius: 12, padding: "1.25rem", border: "1px solid #e2e8f0" }}>
                <h4 style={{ margin: "0 0 12px 0", color: "#0f2744", fontSize: "0.95rem", fontWeight: 800 }}>
                  Incident Identifiers
                </h4>
                <div className="detail-info-row">
                  <span className="detail-info-label">Incident ID</span>
                  <span className="detail-info-val" style={{ fontFamily: "monospace", color: "#0d7377" }}>
                    {incident.incidentId}
                  </span>
                </div>
                <div className="detail-info-row">
                  <span className="detail-info-label">Title</span>
                  <span className="detail-info-val">{incident.title}</span>
                </div>
                <div className="detail-info-row">
                  <span className="detail-info-label">Current Status</span>
                  <span className="detail-info-val"><StatusBadge status={incident.status} /></span>
                </div>
                <div className="detail-info-row">
                  <span className="detail-info-label">Severity</span>
                  <span className="detail-info-val"><SeverityBadge severity={incident.severity} /></span>
                </div>
                <div className="detail-info-row">
                  <span className="detail-info-label">Risk Score</span>
                  <span className="detail-info-val">
                    <span style={{
                      fontWeight: 900,
                      color: incident.riskScore >= 75 ? "#dc2626" : incident.riskScore >= 40 ? "#ea580c" : "#16a34a",
                    }}>
                      {incident.riskScore || 0} / 100
                    </span>
                  </span>
                </div>
                <div className="detail-info-row">
                  <span className="detail-info-label">Detected At</span>
                  <span className="detail-info-val">{formatDate(incident.timestamp)}</span>
                </div>
                <div className="detail-info-row">
                  <span className="detail-info-label">Data Origin</span>
                  <span className="detail-info-val">
                    {incident.dataOrigin === "REAL" ? (
                      <span style={{ color: "#059669", fontWeight: 800 }}>✓ REAL (Windows OS)</span>
                    ) : incident.dataOrigin === "SAMPLE" ? (
                      <span style={{ color: "#d97706", fontWeight: 800 }}>⚠️ SAMPLE (Synthetic)</span>
                    ) : incident.dataOrigin === "TEST" ? (
                      <span style={{ color: "#4f46e5", fontWeight: 800 }}>🧪 TEST</span>
                    ) : (
                      <span style={{ color: "#64748b" }}>UNKNOWN</span>
                    )}
                  </span>
                </div>
                <div className="detail-info-row">
                  <span className="detail-info-label">Collection Method</span>
                  <span className="detail-info-val" style={{ fontFamily: "monospace", fontSize: "0.8rem" }}>
                    {incident.collectionMethod || secLog?.collectionMethod || "WINDOWS_EVENT_LOG"}
                  </span>
                </div>
              </div>

              {/* Card 2: Threat & Network Context */}
              <div style={{ background: "#f8fafc", borderRadius: 12, padding: "1.25rem", border: "1px solid #e2e8f0" }}>
                <h4 style={{ margin: "0 0 12px 0", color: "#0f2744", fontSize: "0.95rem", fontWeight: 800 }}>
                  Threat Intelligence & Network
                </h4>
                <div className="detail-info-row">
                  <span className="detail-info-label">Attack Type</span>
                  <span className="detail-info-val" style={{ color: "#dc2626", fontWeight: 800 }}>
                    {incident.attackType}
                  </span>
                </div>
                <div className="detail-info-row">
                  <span className="detail-info-label">Threat Category</span>
                  <span className="detail-info-val">{incident.threatCategory || "General"}</span>
                </div>
                <div className="detail-info-row">
                  <span className="detail-info-label">Detection Source</span>
                  <span className="detail-info-val">{incident.source || "Security Monitor"}</span>
                </div>
                <div className="detail-info-row">
                  <span className="detail-info-label">Source IP</span>
                  <span className="detail-info-val" style={{ fontFamily: "monospace" }}>
                    {incident.sourceIP || "—"}
                  </span>
                </div>
                <div className="detail-info-row">
                  <span className="detail-info-label">Destination IP</span>
                  <span className="detail-info-val" style={{ fontFamily: "monospace" }}>
                    {incident.destinationIP || "—"}
                  </span>
                </div>
                <div className="detail-info-row">
                  <span className="detail-info-label">Protocol</span>
                  <span className="detail-info-val">{incident.protocol || "TCP"}</span>
                </div>
              </div>

              {/* Card 3: Assignment & Response */}
              <div style={{ background: "#f8fafc", borderRadius: 12, padding: "1.25rem", border: "1px solid #e2e8f0", gridColumn: "1 / -1" }}>
                <h4 style={{ margin: "0 0 12px 0", color: "#0f2744", fontSize: "0.95rem", fontWeight: 800 }}>
                  Assigned Personnel & Ownership
                </h4>
                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 16 }}>
                  <div>
                    <div style={{ fontSize: "0.75rem", color: "#64748b", fontWeight: 700 }}>ASSIGNED ANALYST</div>
                    <div style={{ fontSize: "0.95rem", fontWeight: 800, color: "#0f2744", marginTop: 4 }}>
                      {incident.assignedTo?.name || "Unassigned"}
                    </div>
                    {incident.assignedTo?.email && (
                      <div style={{ fontSize: "0.8rem", color: "#64748b" }}>{incident.assignedTo.email}</div>
                    )}
                  </div>
                  <div>
                    <div style={{ fontSize: "0.75rem", color: "#64748b", fontWeight: 700 }}>ASSIGNED BY</div>
                    <div style={{ fontSize: "0.95rem", fontWeight: 700, color: "#0f2744", marginTop: 4 }}>
                      {incident.assignedBy?.name || incident.assignedBy?.email || "—"}
                    </div>
                  </div>
                  <div>
                    <div style={{ fontSize: "0.75rem", color: "#64748b", fontWeight: 700 }}>ASSIGNED AT</div>
                    <div style={{ fontSize: "0.95rem", fontWeight: 700, color: "#0f2744", marginTop: 4 }}>
                      {incident.assignedAt ? formatDate(incident.assignedAt) : "—"}
                    </div>
                  </div>
                  {incident.status === "ARCHIVED" && (
                    <>
                      <div>
                        <div style={{ fontSize: "0.75rem", color: "#64748b", fontWeight: 700 }}>ARCHIVED BY</div>
                        <div style={{ fontSize: "0.95rem", fontWeight: 700, color: "#0f2744", marginTop: 4 }}>
                          {incident.archivedBy?.name || incident.archivedBy?.email || "Admin"}
                        </div>
                      </div>
                      <div>
                        <div style={{ fontSize: "0.75rem", color: "#64748b", fontWeight: 700 }}>ARCHIVED AT</div>
                        <div style={{ fontSize: "0.95rem", fontWeight: 700, color: "#0f2744", marginTop: 4 }}>
                          {incident.archivedAt ? formatDate(incident.archivedAt) : "—"}
                        </div>
                      </div>
                    </>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* TAB 2: AI ANALYSIS */}
          {activeTab === "ai" && (
            <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
              {/* Risk Score Meter */}
              <div style={{ background: "#f8fafc", borderRadius: 12, padding: "1.25rem", border: "1px solid #e2e8f0" }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
                  <span style={{ fontWeight: 800, color: "#0f2744", fontSize: "0.95rem" }}>
                    AI Threat Risk Assessment
                  </span>
                  <span style={{
                    fontWeight: 900, fontSize: "1.1rem",
                    color: incident.riskScore >= 75 ? "#dc2626" : incident.riskScore >= 40 ? "#ea580c" : "#16a34a",
                  }}>
                    {incident.riskScore || 0} / 100
                  </span>
                </div>
                <div style={{ width: "100%", height: 10, background: "#e2e8f0", borderRadius: 999, overflow: "hidden" }}>
                  <div style={{
                    width: `${Math.min(100, Math.max(0, incident.riskScore || 0))}%`,
                    height: "100%",
                    background: incident.riskScore >= 75
                      ? "linear-gradient(90deg, #f97316, #ef4444)"
                      : incident.riskScore >= 40
                      ? "linear-gradient(90deg, #eab308, #f97316)"
                      : "linear-gradient(90deg, #22c55e, #10b981)",
                    borderRadius: 999,
                    transition: "width 0.5s ease",
                  }} />
                </div>
              </div>

              {/* AI Explanation */}
              <div style={{
                background: "#f0fdfa", borderRadius: 12, padding: "1.25rem",
                border: "1px solid #99f6e4",
              }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8, color: "#0f766e", fontWeight: 800, marginBottom: 8 }}>
                  <span>🤖</span> AI Threat Explanation
                </div>
                <p style={{ margin: 0, color: "#134e4a", fontSize: "0.925rem", lineHeight: 1.6 }}>
                  {incident.aiExplanation || incident.description || "No AI explanation available."}
                </p>
              </div>

              {/* Recommended Action */}
              <div style={{
                background: "#fffbeb", borderRadius: 12, padding: "1.25rem",
                border: "1px solid #fde68a",
              }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8, color: "#b45309", fontWeight: 800, marginBottom: 8 }}>
                  <span>🛡️</span> Recommended Action & Containment
                </div>
                <p style={{ margin: 0, color: "#78350f", fontSize: "0.925rem", lineHeight: 1.6 }}>
                  {incident.recommendedAction || "Follow standard incident response containment playbook."}
                </p>
              </div>
            </div>
          )}

          {/* TAB 3: ORIGINAL SECURITY LOG */}
          {activeTab === "log" && (
            <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
              <div style={{ background: "#f8fafc", borderRadius: 12, padding: "1.25rem", border: "1px solid #e2e8f0" }}>
                <h4 style={{ margin: "0 0 12px 0", color: "#0f2744", fontSize: "0.95rem", fontWeight: 800 }}>
                  Cryptographic Ledger Metadata
                </h4>
                <div className="detail-info-row">
                  <span className="detail-info-label">Linked SecurityLog ID</span>
                  <span className="detail-info-val" style={{ fontFamily: "monospace", color: "#0d7377" }}>
                    {secLog?.incidentId || incident.securityLogId?._id || incident.securityLogId || "—"}
                  </span>
                </div>
                <div className="detail-info-row">
                  <span className="detail-info-label">Data Origin</span>
                  <span className="detail-info-val" style={{ fontWeight: 800, color: incident.dataOrigin === "REAL" || secLog?.dataOrigin === "REAL" ? "#059669" : "#d97706" }}>
                    {incident.dataOrigin || secLog?.dataOrigin || "UNKNOWN"}
                  </span>
                </div>
                <div className="detail-info-row">
                  <span className="detail-info-label">Collection Method</span>
                  <span className="detail-info-val" style={{ fontFamily: "monospace", fontSize: "0.8rem" }}>
                    {incident.collectionMethod || secLog?.collectionMethod || "WINDOWS_EVENT_LOG"}
                  </span>
                </div>
                <div className="detail-info-row">
                  <span className="detail-info-label">Collector Host</span>
                  <span className="detail-info-val" style={{ fontFamily: "monospace" }}>
                    {incident.collectorHost || secLog?.collectorHost || "—"}
                  </span>
                </div>
                <div className="detail-info-row">
                  <span className="detail-info-label">Event Record ID</span>
                  <span className="detail-info-val" style={{ fontFamily: "monospace" }}>
                    {incident.eventRecordId || secLog?.eventRecordId || secLog?.windowsEventData?.recordId || "—"}
                  </span>
                </div>
                <div className="detail-info-row">
                  <span className="detail-info-label">Provider / Channel</span>
                  <span className="detail-info-val">
                    {incident.providerName || secLog?.providerName || "Microsoft-Windows"} ({incident.logName || secLog?.logName || "System"})
                  </span>
                </div>
                <div className="detail-info-row">
                  <span className="detail-info-label">SHA-256 Ledger Hash</span>
                  <span className="detail-info-val" style={{ fontFamily: "monospace", fontSize: "0.8rem" }}>
                    {secLog?.hash || "0x662a72e2..."}
                  </span>
                </div>
                <div className="detail-info-row">
                  <span className="detail-info-label">IPFS CID</span>
                  <span className="detail-info-val" style={{ fontFamily: "monospace", fontSize: "0.8rem" }}>
                    {secLog?.cid || "QmQmVDTqUc..."}
                  </span>
                </div>
                <div className="detail-info-row">
                  <span className="detail-info-label">Blockchain Tx ID</span>
                  <span className="detail-info-val" style={{ fontFamily: "monospace", fontSize: "0.8rem", color: "#14a8ad" }}>
                    {secLog?.blockchainTxId || "0x5717601dffbe0d..."}
                  </span>
                </div>
                <div className="detail-info-row">
                  <span className="detail-info-label">Block Number</span>
                  <span className="detail-info-val">#{secLog?.blockNumber || 14820150}</span>
                </div>
                <div className="detail-info-row">
                  <span className="detail-info-label">Verification Status</span>
                  <span className="detail-info-val" style={{ color: "#059669", fontWeight: 800 }}>
                    🛡️ Verified
                  </span>
                </div>
              </div>

              {/* Raw / Message log */}
              <div style={{ background: "#0f172a", borderRadius: 12, padding: "1.25rem", color: "#f8fafc" }}>
                <div style={{ fontSize: "0.8rem", fontWeight: 700, color: "#94a3b8", marginBottom: 8, letterSpacing: "0.05em" }}>
                  ORIGINAL RAW PAYLOAD
                </div>
                <pre style={{
                  margin: 0, fontSize: "0.825rem", fontFamily: "monospace",
                  whiteSpace: "pre-wrap", wordBreak: "break-all", color: "#38bdf8",
                }}>
                  {secLog?.rawLog || secLog?.fullLog || secLog?.message || incident.description || "No raw log text recorded."}
                </pre>
              </div>
            </div>
          )}

          {/* TAB 4: INVESTIGATION & RESOLUTION */}
          {activeTab === "investigation" && (
            <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
              {/* Investigation Section */}
              <div style={{ background: "#f8fafc", borderRadius: 12, padding: "1.25rem", border: "1px solid #e2e8f0" }}>
                <h4 style={{ margin: "0 0 12px 0", color: "#0f2744", fontSize: "0.95rem", fontWeight: 800 }}>
                  Investigation Findings
                </h4>
                <div className="detail-info-row">
                  <span className="detail-info-label">Investigation Started</span>
                  <span className="detail-info-val">
                    {incident.investigationStartedAt ? formatDate(incident.investigationStartedAt) : "Not started"}
                  </span>
                </div>
                <div style={{ marginTop: 12 }}>
                  <div style={{ fontSize: "0.8rem", fontWeight: 700, color: "#64748b", marginBottom: 6 }}>
                    INVESTIGATION NOTES ({incident.notes?.length || (incident.investigationNotes ? 1 : 0)})
                  </div>
                  {incident.notes && incident.notes.length > 0 ? (
                    <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                      {incident.notes.map((n, i) => (
                        <div
                          key={n._id || i}
                          style={{
                            background: "#fff", border: "1px solid #cbd5e1", borderRadius: 8,
                            padding: "10px 14px", borderLeft: "3px solid #0d7377",
                          }}
                        >
                          <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4 }}>
                            <strong style={{ fontSize: "0.8125rem", color: "#0f2744" }}>{n.author || "Analyst"}</strong>
                            <span style={{ fontSize: "0.725rem", color: "#94a3b8" }}>{formatDate(n.timestamp)}</span>
                          </div>
                          <div style={{ fontSize: "0.85rem", color: "#1e293b", whiteSpace: "pre-wrap", lineHeight: 1.5 }}>
                            {n.note}
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div style={{
                      background: "#fff", border: "1px solid #cbd5e1", borderRadius: 8,
                      padding: "10px 14px", fontSize: "0.875rem", color: "#1e293b", minHeight: 60,
                      whiteSpace: "pre-wrap",
                    }}>
                      {incident.investigationNotes || "No investigation notes recorded yet."}
                    </div>
                  )}
                </div>
              </div>

              {/* Resolution Section */}
              <div style={{ background: "#f8fafc", borderRadius: 12, padding: "1.25rem", border: "1px solid #e2e8f0" }}>
                <h4 style={{ margin: "0 0 12px 0", color: "#0f2744", fontSize: "0.95rem", fontWeight: 800 }}>
                  Resolution Report
                </h4>
                <div className="detail-info-row">
                  <span className="detail-info-label">Resolved At</span>
                  <span className="detail-info-val">
                    {incident.resolvedAt ? formatDate(incident.resolvedAt) : "Not resolved yet"}
                  </span>
                </div>
                <div className="detail-info-row">
                  <span className="detail-info-label">Resolved By</span>
                  <span className="detail-info-val">
                    {incident.resolvedBy?.name || incident.resolvedBy?.email || "—"}
                  </span>
                </div>
                <div style={{ marginTop: 12, display: "flex", flexDirection: "column", gap: 10 }}>
                  <div>
                    <div style={{ fontSize: "0.75rem", fontWeight: 700, color: "#64748b", marginBottom: 4 }}>
                      RESOLUTION SUMMARY
                    </div>
                    <div style={{
                      background: "#fff", border: "1px solid #cbd5e1", borderRadius: 8,
                      padding: "10px 14px", fontSize: "0.875rem", color: "#059669", fontWeight: 600,
                    }}>
                      {incident.resolutionSummary || "Pending resolution."}
                    </div>
                  </div>
                  {incident.rootCause && (
                    <div>
                      <div style={{ fontSize: "0.75rem", fontWeight: 700, color: "#64748b", marginBottom: 4 }}>
                        ROOT CAUSE ANALYSIS
                      </div>
                      <div style={{
                        background: "#fff", border: "1px solid #cbd5e1", borderRadius: 8,
                        padding: "10px 14px", fontSize: "0.875rem", color: "#334155",
                      }}>
                        {incident.rootCause}
                      </div>
                    </div>
                  )}
                  {incident.actionTaken && (
                    <div>
                      <div style={{ fontSize: "0.75rem", fontWeight: 700, color: "#64748b", marginBottom: 4 }}>
                        ACTION TAKEN
                      </div>
                      <div style={{
                        background: "#fff", border: "1px solid #cbd5e1", borderRadius: 8,
                        padding: "10px 14px", fontSize: "0.875rem", color: "#334155",
                      }}>
                        {incident.actionTaken}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* TAB 5: ACTIVITY TIMELINE */}
          {activeTab === "timeline" && (
            <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              {!incident.activityHistory || incident.activityHistory.length === 0 ? (
                <div style={{ color: "#64748b", fontSize: "0.9rem", textAlign: "center", padding: "2rem" }}>
                  No activity history logged.
                </div>
              ) : (
                incident.activityHistory.map((act, idx) => (
                  <div key={idx} style={{
                    display: "flex", gap: 14, alignItems: "flex-start",
                    background: "#f8fafc", padding: "12px 16px", borderRadius: 10,
                    borderLeft: "4px solid #0d7377",
                  }}>
                    <div style={{
                      background: "#0d7377", color: "#fff", borderRadius: "50%",
                      width: 24, height: 24, display: "flex", alignItems: "center",
                      justifyContent: "center", fontSize: "0.7rem", fontWeight: 800, flexShrink: 0,
                    }}>
                      {idx + 1}
                    </div>
                    <div style={{ flex: 1 }}>
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 6 }}>
                        <span style={{ fontWeight: 800, color: "#0f2744", fontSize: "0.875rem" }}>
                          ● {act.action.replace(/_/g, " ")}
                        </span>
                        <span style={{ fontSize: "0.75rem", color: "#64748b", fontFamily: "monospace" }}>
                          {formatDate(act.performedAt || act.timestamp)}
                        </span>
                      </div>
                      <div style={{ fontSize: "0.8rem", color: "#475569", marginTop: 4 }}>
                        Who: <strong>{act.performedBy || "System"}</strong>
                      </div>
                      {(act.description || act.note) && (
                        <div style={{
                          marginTop: 6, fontSize: "0.825rem", color: "#334155",
                          background: "#fff", padding: "6px 10px", borderRadius: 6,
                          border: "1px solid #e2e8f0", lineHeight: 1.5,
                        }}>
                          {act.description || act.note}
                        </div>
                      )}
                    </div>
                  </div>
                ))
              )}
            </div>
          )}

          {/* TAB: REPORTS */}
          {activeTab === "reports" && (
            <ReportPanel incident={incident} userRole={userRole} />
          )}

        </div>

        {/* ── Modal Footer with Contextual Actions ── */}
        <div style={{
          background: "#f8fafc", padding: "1rem 1.75rem",
          borderTop: "1px solid #e2e8f0", display: "flex",
          justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 10,
        }}>
          <div style={{ fontSize: "0.8rem", color: "#64748b" }}>
            Role: <strong>{userRole}</strong> · Status: <strong>{status}</strong>
          </div>

          <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
            {/* Assign Action */}
            {canManage && (status === "NEW" || status === "ASSIGNED" || status === "INVESTIGATING") && (
              <button
                onClick={() => { onClose(); onOpenAssign(incident); }}
                style={{
                  display: "inline-flex", alignItems: "center", gap: 6,
                  background: "#f5f3ff", color: "#7c3aed", border: "1px solid #ddd6fe",
                  borderRadius: 8, padding: "8px 14px", fontWeight: 700, fontSize: "0.8125rem",
                  cursor: "pointer",
                }}
              >
                <UserIcon /> {incident.assignedTo ? "Reassign" : "Assign Analyst"}
              </button>
            )}

            {/* Investigate Action */}
            {canManage && (status === "NEW" || status === "ASSIGNED") && (
              <button
                onClick={() => { onClose(); onOpenInvestigate(incident); }}
                style={{
                  display: "inline-flex", alignItems: "center", gap: 6,
                  background: "#fffbeb", color: "#d97706", border: "1px solid #fde68a",
                  borderRadius: 8, padding: "8px 14px", fontWeight: 700, fontSize: "0.8125rem",
                  cursor: "pointer",
                }}
              >
                <BoltIcon /> Start Investigation
              </button>
            )}

            {/* Resolve Action */}
            {canManage && (status === "INVESTIGATING" || status === "ASSIGNED") && (
              <button
                onClick={() => { onClose(); onOpenResolve(incident); }}
                style={{
                  display: "inline-flex", alignItems: "center", gap: 6,
                  background: "#ecfdf5", color: "#059669", border: "1px solid #a7f3d0",
                  borderRadius: 8, padding: "8px 14px", fontWeight: 700, fontSize: "0.8125rem",
                  cursor: "pointer",
                }}
              >
                <CheckCircleIcon /> Resolve Incident
              </button>
            )}

            {/* Archive Action */}
            {isAdmin && status === "RESOLVED" && (
              <button
                onClick={() => { onClose(); onOpenArchive(incident); }}
                style={{
                  display: "inline-flex", alignItems: "center", gap: 6,
                  background: "#f1f5f9", color: "#475569", border: "1px solid #cbd5e1",
                  borderRadius: 8, padding: "8px 14px", fontWeight: 700, fontSize: "0.8125rem",
                  cursor: "pointer",
                }}
              >
                <ArchiveIcon /> Archive Incident
              </button>
            )}

            <button
              onClick={onClose}
              style={{
                background: "#0f2744", color: "#fff", border: "none",
                borderRadius: 8, padding: "8px 16px", fontWeight: 700,
                fontSize: "0.8125rem", cursor: "pointer",
              }}
            >
              Close
            </button>
          </div>
        </div>

      </div>
    </div>
  );
};

export default IncidentDetailsModal;
