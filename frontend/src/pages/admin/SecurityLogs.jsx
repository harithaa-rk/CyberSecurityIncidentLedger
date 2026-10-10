import React, { useState, useEffect, useCallback, useRef } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "../../context/AuthContext";
import DashboardLayout from "../../layouts/DashboardLayout";
import {
  getSecurityLogs,
  uploadSecurityLogs,
  downloadSecurityLog,
  deleteSecurityLogMetadata,
  triggerTestEvent,
} from "../../services/securityLogService";
import { getSocket } from "../../services/socket";
import LogDetailsModal from "../../components/security/LogDetailsModal";

/* Inline SVG Icons */
const ShieldIcon = ({ size = 20 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>
  </svg>
);

const SearchIcon = ({ size = 16 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
  </svg>
);

const RefreshIcon = ({ size = 16 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="23 4 23 10 17 10"/><path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10"/>
  </svg>
);

const UploadIcon = ({ size = 16 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/>
  </svg>
);

const DownloadIcon = ({ size = 14 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/>
  </svg>
);

const TrashIcon = ({ size = 14 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/><path d="M10 11v6M14 11v6"/><path d="M9 6V4h6v2"/>
  </svg>
);

const BoltIcon = ({ size = 16 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/>
  </svg>
);

const EyeIcon = ({ size = 14 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/>
  </svg>
);

const CloseIcon = ({ size = 18 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
  </svg>
);

const BackIcon = ({ size = 16 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <line x1="19" y1="12" x2="5" y2="12"/><polyline points="12 19 5 12 12 5"/>
  </svg>
);

const CopyIcon = ({ size = 12 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <rect x="9" y="9" width="13" height="13" rx="2" ry="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/>
  </svg>
);

/* Severity Badge */
const SeverityBadge = ({ severity }) => {
  const normalized = (severity || "LOW").toUpperCase();
  const styles = {
    CRITICAL: { bg: "#fef2f2", color: "#b91c1c", border: "#fca5a5", icon: "🚨" },
    HIGH:     { bg: "#fff7ed", color: "#c2410c", border: "#fdba74", icon: "⚠️" },
    MEDIUM:   { bg: "#fefce8", color: "#a16207", border: "#fde047", icon: "⚡" },
    LOW:      { bg: "#f0fdf4", color: "#15803d", border: "#86efac", icon: "ℹ️" },
  };
  const s = styles[normalized] || styles.LOW;
  return (
    <span style={{
      display: "inline-flex", alignItems: "center", gap: 4,
      padding: "3px 9px", borderRadius: 999, fontSize: "0.75rem",
      fontWeight: 800, letterSpacing: "0.04em",
      background: s.bg, color: s.color, border: `1px solid ${s.border}`,
    }}>
      <span>{s.icon}</span> {normalized}
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
      display: "inline-flex", alignItems: "center", gap: 4,
      padding: "2px 8px", borderRadius: 999, fontSize: "0.725rem",
      fontWeight: 800, background: s.bg, color: s.color, border: `1px solid ${s.border}`,
    }}>
      <span>{s.icon}</span> {norm}
    </span>
  );
};

/* Format Date & Time */
const formatTimeOnly = (dateStr) => {
  if (!dateStr) return "--:--:--";
  const d = new Date(dateStr);
  return d.toTimeString().split(" ")[0];
};

const formatFullDate = (dateStr) => {
  if (!dateStr) return "—";
  return new Date(dateStr).toLocaleString("en-US", {
    year: "numeric", month: "short", day: "numeric",
    hour: "2-digit", minute: "2-digit", second: "2-digit",
    hour12: false,
  });
};

const truncateHash = (str, start = 6, end = 4) => {
  if (!str || typeof str !== "string") return "—";
  if (str.length <= start + end) return str;
  return `${str.slice(0, start)}...${str.slice(-end)}`;
};

const SecurityLogs = () => {
  const { user } = useAuth();

  /* State */
  const [logs, setLogs] = useState([]);
  const [pagination, setPagination] = useState({ page: 1, total: 0, totalPages: 1, limit: 20 });
  const [stats, setStats] = useState({ total: 0, critical: 0, high: 0, medium: 0, low: 0, verified: 0, tampered: 0 });
  const [loading, setLoading] = useState(true);
  const [isConnected, setIsConnected] = useState(false);
  const [newEventFlash, setNewEventFlash] = useState(null);
  const [toastAlert, setToastAlert] = useState(null);
  const [toastMessage, setToastMessage] = useState(null);
  const [copiedKey, setCopiedKey] = useState(null);

  /* Modals */
  const [detailModalLog, setDetailModalLog] = useState(null);
  const [uploadModalOpen, setUploadModalOpen] = useState(false);
  const [deleteConfirmLog, setDeleteConfirmLog] = useState(null);

  /* Upload form state */
  const [selectedFile, setSelectedFile] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [simulating, setSimulating] = useState(false);
  const [actionLoading, setActionLoading] = useState({});

  /* Filters */
  const [originFilter, setOriginFilter] = useState("REAL");
  const [searchQuery, setSearchQuery] = useState("");
  const [severityFilter, setSeverityFilter] = useState("All");
  const [verificationFilter, setVerificationFilter] = useState("All");
  const [fileTypeFilter, setFileTypeFilter] = useState("All");

  const toastTimerRef = useRef(null);

  /* Show small toast message */
  const showToast = (type, msg) => {
    setToastMessage({ type, msg });
    setTimeout(() => setToastMessage(null), 3500);
  };

  /* Show live event notification */
  const showLiveEventToast = (log) => {
    if (toastTimerRef.current) clearTimeout(toastTimerRef.current);
    setToastAlert(log);
    toastTimerRef.current = setTimeout(() => setToastAlert(null), 6000);
  };

  /* Copy to clipboard */
  const handleCopy = (text, key) => {
    navigator.clipboard.writeText(text);
    setCopiedKey(key);
    setTimeout(() => setCopiedKey(null), 2000);
  };

  /* Fetch logs */
  const fetchLogs = useCallback(async (page = 1) => {
    setLoading(true);
    try {
      const data = await getSecurityLogs({
        page,
        limit: 20,
        origin: originFilter,
        severity: severityFilter,
        verificationStatus: verificationFilter,
        fileType: fileTypeFilter,
        search: searchQuery,
      });

      setLogs(data.logs || []);
      setPagination({
        page: data.page,
        total: data.total,
        totalPages: data.totalPages,
        limit: data.limit,
      });
      if (data.stats) {
        setStats(data.stats);
      }
    } catch (err) {
      console.error("Failed to fetch security logs:", err);
      showToast("error", "Failed to fetch logs.");
    } finally {
      setLoading(false);
    }
  }, [originFilter, severityFilter, verificationFilter, fileTypeFilter, searchQuery]);

  useEffect(() => {
    fetchLogs(1);
  }, [fetchLogs]);

  /* ── Socket.IO Real-Time Stream Listener ── */
  useEffect(() => {
    const socket = getSocket();

    const handleConnect = () => setIsConnected(true);
    const handleDisconnect = () => setIsConnected(false);

    const handleNewLog = (newLog) => {
      console.log("[REACT] Received real-time security-log:new event:", newLog.incidentId);

      // Filter out non-real sample logs if filtering for REAL system logs
      if (originFilter === "REAL" && newLog.dataOrigin !== "REAL") {
        return;
      }

      // Prepend without full page refresh
      setLogs((prev) => [newLog, ...prev.slice(0, 49)]);

      setStats((prev) => {
        const sev = (newLog.severity || "LOW").toUpperCase();
        return {
          ...prev,
          total: prev.total + 1,
          critical: sev === "CRITICAL" ? prev.critical + 1 : prev.critical,
          high:     sev === "HIGH"     ? prev.high + 1     : prev.high,
          medium:   sev === "MEDIUM"   ? prev.medium + 1   : prev.medium,
          low:      sev === "LOW"      ? prev.low + 1      : prev.low,
          verified: prev.verified + 1,
        };
      });

      setNewEventFlash(newLog.incidentId);
      setTimeout(() => setNewEventFlash(null), 3000);

      showLiveEventToast(newLog);
    };

    const handleNewIncident = (newInc) => {
      if (newInc?.securityLogId || newInc?.incidentId) {
        setLogs((prev) =>
          prev.map((l) =>
            l._id === newInc.securityLogId || l.incidentId === newInc.securityLogId
              ? { ...l, createdIncidentId: newInc.incidentId }
              : l
          )
        );
      }
    };

    setIsConnected(socket.connected);
    socket.on("connect", handleConnect);
    socket.on("disconnect", handleDisconnect);
    socket.on("security-log:new", handleNewLog);
    socket.on("incident:new", handleNewIncident);

    return () => {
      socket.off("connect", handleConnect);
      socket.off("disconnect", handleDisconnect);
      socket.off("security-log:new", handleNewLog);
      socket.off("incident:new", handleNewIncident);
    };
  }, []);

  /* Upload File Handler */
  const handleUploadSubmit = async (e) => {
    e.preventDefault();
    if (!selectedFile) {
      showToast("error", "Please choose a file to upload.");
      return;
    }

    const formData = new FormData();
    formData.append("file", selectedFile);

    setUploading(true);
    try {
      const res = await uploadSecurityLogs(formData);
      showToast("success", res.message || "File uploaded and parsed successfully.");
      setUploadModalOpen(false);
      setSelectedFile(null);
      fetchLogs(1);
    } catch (err) {
      showToast("error", err.response?.data?.message || "Failed to upload and parse log file.");
    } finally {
      setUploading(false);
    }
  };

  /* Delete Metadata Handler (Strictly preserves blockchain records) */
  const handleDeleteMetadata = async () => {
    if (!deleteConfirmLog) return;
    const logId = deleteConfirmLog._id || deleteConfirmLog.incidentId;
    setActionLoading((p) => ({ ...p, [logId]: true }));
    try {
      const res = await deleteSecurityLogMetadata(logId);
      showToast("success", res.message || "Log metadata deleted. Blockchain record preserved.");
      setDeleteConfirmLog(null);
      fetchLogs(pagination.page);
    } catch (err) {
      showToast("error", err.response?.data?.message || "Failed to delete log metadata.");
    } finally {
      setActionLoading((p) => ({ ...p, [logId]: false }));
    }
  };

  /* Trigger test event */
  const handleSimulateEvent = async () => {
    setSimulating(true);
    try {
      await triggerTestEvent();
    } catch (err) {
      console.error("Test event simulation failed:", err);
    } finally {
      setSimulating(false);
    }
  };

  return (
    <>
      <style>{`
        @keyframes logPulse { 0% { transform: scale(1); opacity: 1; } 50% { transform: scale(1.3); opacity: 0.6; } 100% { transform: scale(1); opacity: 1; } }
        @keyframes newRowFlash { 0% { background-color: rgba(20, 168, 173, 0.25); } 100% { background-color: transparent; } }
        @keyframes toastSlideIn { from { transform: translateY(-20px) scale(0.95); opacity: 0; } to { transform: translateY(0) scale(1); opacity: 1; } }
        @keyframes detailModalIn { from { transform: scale(0.95); opacity: 0; } to { transform: scale(1); opacity: 1; } }
        .security-table tr:hover td { background-color: var(--color-gold-soft); }
        .row-flash { animation: newRowFlash 2.5s ease-out; }
      `}</style>

      <DashboardLayout
        activeSection="security-logs"
        title="Security Ledger"
        onRefresh={() => fetchLogs(pagination.page)}
        loading={loading}
        headerActions={
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            {/* Live Indicator */}
            <div style={{
              display: "flex", alignItems: "center", gap: 6,
              background: isConnected ? "var(--state-verified-bg, rgba(16, 185, 129, 0.15))" : "rgba(239, 68, 68, 0.15)",
              border: `1px solid ${isConnected ? "var(--state-verified, #10b981)" : "#ef4444"}`,
              padding: "4px 10px", borderRadius: 20, fontSize: "0.72rem", fontWeight: 800,
              color: isConnected ? "var(--state-verified, #10b981)" : "#ef4444", letterSpacing: "0.04em",
            }}>
              {isConnected ? "🟢 LIVE" : "🔴 OFFLINE"}
            </div>

            {/* Upload Button */}
            <button
              onClick={() => setUploadModalOpen(true)}
              style={{
                display: "inline-flex", alignItems: "center", gap: 6,
                background: "var(--color-gold)", color: "var(--text-inverse)",
                border: "none", borderRadius: 8, padding: "6px 12px",
                fontSize: "0.78rem", fontWeight: 700, cursor: "pointer",
                boxShadow: "0 2px 8px var(--color-gold-glow)",
              }}
            >
              <UploadIcon size={13} /> Upload Logs
            </button>

            {/* Simulate Event Button */}
            <button
              onClick={handleSimulateEvent}
              disabled={simulating}
              style={{
                display: "inline-flex", alignItems: "center", gap: 6,
                background: "var(--bg-surface)", color: "var(--text-primary)",
                border: "1px solid var(--border-subtle)", borderRadius: 8, padding: "6px 10px",
                fontSize: "0.78rem", fontWeight: 700, cursor: "pointer",
              }}
            >
              <BoltIcon size={13} />
              {simulating ? "Simulating..." : "Simulate Log"}
            </button>
          </div>
        }
      >
        {/* ── Main Container ── */}
        <div style={{ maxWidth: 1420, margin: "0 auto", padding: "0.5rem 0" }}>

          {/* Toast Message */}
          {toastMessage && (
            <div style={{
              position: "fixed", bottom: 24, right: 24, zIndex: 9999,
              background: toastMessage.type === "success" ? "#0a7d55" : "#c0392b",
              color: "#fff", borderRadius: 10, padding: "12px 20px",
              fontSize: "0.9rem", fontWeight: 600, boxShadow: "0 4px 20px rgba(0,0,0,0.2)",
              display: "flex", alignItems: "center", gap: 10, maxWidth: 400,
            }}>
              <span>{toastMessage.type === "success" ? "✓" : "⚠"}</span>
              {toastMessage.msg}
            </div>
          )}

          {/* ── Real-Time Incident Toast Alert ── */}
          {toastAlert && (
            <div style={{
              marginBottom: "1.5rem",
              background: toastAlert.severity === "CRITICAL" ? "#7f1d1d" : toastAlert.severity === "HIGH" ? "#7c2d12" : "#0f2744",
              color: "#fff", borderRadius: 12, padding: "1rem 1.5rem",
              display: "flex", alignItems: "center", justifyContent: "space-between",
              boxShadow: "0 8px 24px rgba(0,0,0,0.2)", animation: "toastSlideIn 0.3s ease-out",
              border: `1.5px solid ${toastAlert.severity === "CRITICAL" ? "#ef4444" : "#14a8ad"}`,
            }}>
              <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
                <div style={{
                  width: 40, height: 40, borderRadius: "50%",
                  background: "rgba(255,255,255,0.15)",
                  display: "flex", alignItems: "center", justifyContent: "center", fontSize: "1.2rem",
                }}>
                  {toastAlert.severity === "CRITICAL" ? "🚨" : "⚡"}
                </div>
                <div>
                  <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                    <span style={{ fontSize: "0.75rem", fontWeight: 800, letterSpacing: "0.06em", color: "#14a8ad", textTransform: "uppercase" }}>
                      NEW LOG COMMITTED TO LEDGER
                    </span>
                    <SeverityBadge severity={toastAlert.severity} />
                  </div>
                  <div style={{ fontSize: "1rem", fontWeight: 800, marginTop: 2 }}>
                    {toastAlert.attackType} — <span style={{ fontWeight: 400, opacity: 0.9 }}>{toastAlert.message}</span>
                  </div>
                  <div style={{ fontSize: "0.8125rem", opacity: 0.8, marginTop: 2 }}>
                    IP: <strong>{toastAlert.sourceIP} → {toastAlert.destinationIP}</strong> | CID: <strong>{truncateHash(toastAlert.cid)}</strong> | Hash: <strong>{truncateHash(toastAlert.hash)}</strong>
                  </div>
                </div>
              </div>
              <button onClick={() => setToastAlert(null)} style={{ background: "none", border: "none", color: "#fff", cursor: "pointer", opacity: 0.7 }}>
                <CloseIcon size={20} />
              </button>
            </div>
          )}

          {/* ── Summary Counters ── */}
          <div style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
            gap: 14, marginBottom: "1.75rem",
          }}>
            {[
              { label: "Total Logs", count: stats.total, color: "#F4C542", icon: "📊" },
              { label: "Critical Severity", count: stats.critical, color: "#FF4D4F", icon: "🚨" },
              { label: "High Severity", count: stats.high, color: "#FF7849", icon: "⚠️" },
              { label: "Medium Severity", count: stats.medium, color: "#FFB547", icon: "⚡" },
              { label: "Low Severity", count: stats.low, color: "var(--state-verified, #36D6AE)", icon: "ℹ️" },
              { label: "Verified on Ledger", count: stats.verified || stats.total, color: "var(--state-verified, #36D6AE)", icon: "🛡️" },
            ].map((kpi) => (
              <div key={kpi.label} style={{
                background: "var(--bg-surface)", borderRadius: 12, padding: "1.1rem 1.25rem",
                border: "1px solid var(--border-subtle)", boxShadow: "var(--shadow-card)",
                display: "flex", alignItems: "center", justifyContent: "space-between",
              }}>
                <div>
                  <div style={{ fontSize: "0.8125rem", color: "var(--text-secondary)", fontWeight: 600, fontFamily: "Space Grotesk, sans-serif" }}>{kpi.label}</div>
                  <div style={{ fontSize: "1.6rem", fontWeight: 800, color: kpi.color, marginTop: 4, fontFamily: "JetBrains Mono, monospace" }}>
                    {kpi.count}
                  </div>
                </div>
                <div style={{ fontSize: "1.6rem" }}>{kpi.icon}</div>
              </div>
            ))}
          </div>

          {/* ── Table Card ── */}
          <div style={{
            background: "var(--bg-surface)", borderRadius: 16, border: "1px solid var(--border-subtle)",
            boxShadow: "var(--shadow-card)", overflow: "hidden",
          }}>
            {/* Header & Filter Controls */}
            <div style={{
              padding: "1.25rem 1.5rem", borderBottom: "1px solid var(--border-subtle)",
              display: "flex", alignItems: "center", justifyContent: "space-between",
              flexWrap: "wrap", gap: 12,
            }}>
              <div>
                <h2 style={{ fontSize: "1.25rem", fontWeight: 800, color: "var(--text-primary)", margin: 0, fontFamily: "Space Grotesk, sans-serif" }}>
                  Security Incident Ledger Records
                </h2>
                <p style={{ fontSize: "0.8125rem", color: "var(--text-secondary)", margin: "4px 0 0" }}>
                  All ingested events are cryptographically hashed and linked to the immutable blockchain transaction ledger.
                </p>
              </div>

              {/* Filters Bar */}
              <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
                {/* Search */}
                <div style={{
                  display: "flex", alignItems: "center", gap: 6,
                  background: "var(--bg-secondary)", border: "1px solid var(--border-subtle)",
                  borderRadius: 8, padding: "6px 12px", minWidth: 230,
                }}>
                  <SearchIcon />
                  <input
                    type="text"
                    placeholder="Search IP, attack, CID, hash..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    style={{
                      border: "none", outline: "none", background: "transparent",
                      fontSize: "0.8125rem", color: "var(--text-primary)", width: "100%",
                    }}
                  />
                </div>

                {/* Data Origin Filter */}
                <select
                  value={originFilter}
                  onChange={(e) => setOriginFilter(e.target.value)}
                  style={{
                    padding: "6px 12px",
                    borderRadius: 8,
                    border: originFilter === "REAL" ? "1px solid var(--color-gold)" : "1px solid var(--border-subtle)",
                    background: originFilter === "REAL" ? "var(--color-gold-soft)" : "var(--bg-surface)",
                    fontSize: "0.8125rem",
                    color: originFilter === "REAL" ? "var(--color-gold)" : "var(--text-primary)",
                    fontWeight: 700,
                  }}
                >
                  <option value="REAL">🟢 Real System Logs Only</option>
                  <option value="All">All Origins (Real &amp; Sample)</option>
                  <option value="SAMPLE">⚠️ Sample Demonstration Data</option>
                  <option value="TEST">🧪 Test Simulation Data</option>
                </select>

                {/* Severity Filter */}
                <select
                  value={severityFilter}
                  onChange={(e) => setSeverityFilter(e.target.value)}
                  style={{ padding: "6px 10px", borderRadius: 8, border: "1px solid var(--border-subtle)", background: "var(--bg-surface)", fontSize: "0.8125rem", color: "var(--text-primary)", fontWeight: 600 }}
                >
                  <option value="All">All Severities</option>
                  <option value="CRITICAL">Critical</option>
                  <option value="HIGH">High</option>
                  <option value="MEDIUM">Medium</option>
                  <option value="LOW">Low</option>
                </select>

                {/* Verification Status Filter */}
                <select
                  value={verificationFilter}
                  onChange={(e) => setVerificationFilter(e.target.value)}
                  style={{ padding: "6px 10px", borderRadius: 8, border: "1px solid var(--border-subtle)", background: "var(--bg-surface)", fontSize: "0.8125rem", color: "var(--text-primary)", fontWeight: 600 }}
                >
                  <option value="All">All Verifications</option>
                  <option value="Verified">Verified</option>
                  <option value="Tampered">Tampered</option>
                  <option value="Unverified">Unverified</option>
                </select>

                {/* Format Filter */}
                <select
                  value={fileTypeFilter}
                  onChange={(e) => setFileTypeFilter(e.target.value)}
                  style={{ padding: "6px 10px", borderRadius: 8, border: "1px solid var(--border-subtle)", background: "var(--bg-surface)", fontSize: "0.8125rem", color: "var(--text-primary)", fontWeight: 600 }}
                >
                  <option value="All">All Formats</option>
                  <option value="JSON">JSON</option>
                  <option value="Snort">Snort Logs</option>
                  <option value="PCAP">PCAP Files</option>
                  <option value="LOCAL_FILE">Local Stream</option>
                </select>

                {/* Refresh */}
                <button
                  onClick={() => fetchLogs(pagination.page)}
                  style={{
                    display: "flex", alignItems: "center", gap: 6,
                    background: "var(--bg-surface)", color: "var(--text-primary)", border: "1px solid var(--border-subtle)",
                    padding: "6px 12px", borderRadius: 8, fontSize: "0.8125rem", fontWeight: 600,
                    cursor: "pointer",
                  }}
                >
                  <RefreshIcon size={14} /> Refresh
                </button>
              </div>
            </div>

            {/* Logs Table (All 8 Display Columns + Actions) */}
            <div style={{ overflowX: "auto" }}>
              <table className="security-table" style={{ width: "100%", borderCollapse: "collapse", textAlign: "left" }}>
                <thead>
                  <tr style={{ background: "#f8fafc", borderBottom: "1px solid #e2e8f0" }}>
                    {[
                      "Timestamp",
                      "Source IP",
                      "Destination IP",
                      "Attack Type",
                      "Severity",
                      "Pinata CID",
                      "SHA-256 Hash",
                      "Verification",
                      "Actions",
                    ].map((h) => (
                      <th key={h} style={{
                        padding: "12px 14px", fontSize: "0.75rem", fontWeight: 700,
                        color: "#64748b", textTransform: "uppercase", letterSpacing: "0.05em",
                        whiteSpace: "nowrap",
                      }}>
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {loading && logs.length === 0 ? (
                    <tr>
                      <td colSpan={9} style={{ padding: "3rem", textAlign: "center", color: "#64748b" }}>
                        Loading security logs...
                      </td>
                    </tr>
                  ) : logs.length === 0 ? (
                    <tr>
                      <td colSpan={9} style={{ padding: "3rem", textAlign: "center", color: "#64748b" }}>
                        No security logs found matching your filters. Upload a JSON, Snort, or PCAP file.
                      </td>
                    </tr>
                  ) : (
                    logs.map((log) => {
                      const isNew = newEventFlash === log.incidentId;
                      const logId = log._id || log.incidentId;
                      return (
                        <tr
                          key={logId}
                          className={isNew ? "row-flash" : ""}
                          style={{ borderBottom: "1px solid #f1f5f9", transition: "background-color 0.15s" }}
                        >
                          {/* 1. Timestamp */}
                          <td style={{ padding: "12px 14px", color: "#475569", fontSize: "0.8125rem", whiteSpace: "nowrap" }} title={formatFullDate(log.timestamp)}>
                            <div style={{ fontWeight: 700, color: "#0f2744" }}>{formatTimeOnly(log.timestamp)}</div>
                            <div style={{ fontSize: "0.7rem", color: "#94a3b8" }}>{new Date(log.timestamp).toLocaleDateString()}</div>
                          </td>

                          {/* 2. Source IP */}
                          <td style={{ padding: "12px 14px", fontFamily: "monospace", fontSize: "0.8125rem", color: "#0f2744", whiteSpace: "nowrap" }}>
                            {log.sourceIP}
                            {log.sourcePort ? <span style={{ color: "#64748b", fontSize: "0.75rem" }}>:{log.sourcePort}</span> : ""}
                          </td>

                          {/* 3. Destination IP */}
                          <td style={{ padding: "12px 14px", fontFamily: "monospace", fontSize: "0.8125rem", color: "#0f2744", whiteSpace: "nowrap" }}>
                            {log.destinationIP}
                            {log.destinationPort ? <span style={{ color: "#64748b", fontSize: "0.75rem" }}>:{log.destinationPort}</span> : ""}
                          </td>

                          {/* 4. Attack Type */}
                          <td style={{ padding: "12px 14px", color: "#0f2744", fontSize: "0.84375rem", fontWeight: 700 }}>
                            <div style={{ display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
                              <span>{log.attackType}</span>
                              {log.eventId && (
                                <span style={{
                                  fontSize: "0.6875rem", fontWeight: 800,
                                  background: "rgba(20, 168, 173, 0.15)", color: "#0d7377",
                                  padding: "1px 6px", borderRadius: 4, letterSpacing: "0.04em",
                                }}>
                                  ID: {log.eventId}
                                </span>
                              )}
                              {log.createdIncidentId ? (
                                <Link
                                  to={`/admin/incidents/${log.createdIncidentId}`}
                                  title={`View Incident Details for ${log.createdIncidentId}`}
                                  onClick={(e) => e.stopPropagation()}
                                  style={{
                                    display: "inline-flex",
                                    alignItems: "center",
                                    gap: 5,
                                    fontSize: "0.6875rem",
                                    fontWeight: 800,
                                    background: "#fef2f2",
                                    color: "#b91c1c",
                                    border: "1px solid #f87171",
                                    padding: "2px 7px",
                                    borderRadius: 6,
                                    textDecoration: "none",
                                    letterSpacing: "0.03em",
                                    boxShadow: "0 1px 3px rgba(185, 28, 28, 0.15)",
                                    transition: "all 0.15s ease",
                                    cursor: "pointer",
                                  }}
                                  onMouseEnter={(e) => {
                                    e.currentTarget.style.background = "#fee2e2";
                                    e.currentTarget.style.borderColor = "#dc2626";
                                  }}
                                  onMouseLeave={(e) => {
                                    e.currentTarget.style.background = "#fef2f2";
                                    e.currentTarget.style.borderColor = "#f87171";
                                  }}
                                >
                                  <span>🚨</span>
                                  <span>{log.createdIncidentId}</span>
                                  <span style={{ fontSize: "0.7rem" }}>↗</span>
                                </Link>
                              ) : log.threat ? (
                                <span style={{
                                  fontSize: "0.65rem", fontWeight: 800,
                                  background: "#fef2f2", color: "#dc2626", border: "1px solid #fca5a5",
                                  padding: "1px 5px", borderRadius: 4,
                                }}>
                                  THREAT
                                </span>
                              ) : null}
                            </div>
                            <div style={{ fontSize: "0.7rem", color: "#64748b", fontWeight: 400, marginTop: 2 }}>
                              {log.source} ({log.collectionMethod === "WINDOWS_EVENT_LOG" ? "Windows Event Log" : log.fileType || "Stream"})
                            </div>
                          </td>

                          {/* 5. Severity */}
                          <td style={{ padding: "12px 14px", whiteSpace: "nowrap" }}>
                            <SeverityBadge severity={log.severity} />
                          </td>

                          {/* 6. Pinata CID */}
                          <td style={{ padding: "12px 14px", fontFamily: "monospace", fontSize: "0.78125rem", color: "#0d7377", whiteSpace: "nowrap" }}>
                            <div style={{ display: "inline-flex", alignItems: "center", gap: 4 }}>
                              <span title={log.cid}>{truncateHash(log.cid, 6, 4)}</span>
                              <button
                                onClick={() => handleCopy(log.cid, `cid_${logId}`)}
                                title="Copy Pinata CID"
                                style={{ background: "none", border: "none", cursor: "pointer", color: copiedKey === `cid_${logId}` ? "#10b981" : "#94a3b8" }}
                              >
                                <CopyIcon />
                              </button>
                            </div>
                          </td>

                          {/* 7. SHA-256 Hash */}
                          <td style={{ padding: "12px 14px", fontFamily: "monospace", fontSize: "0.78125rem", color: "#475569", whiteSpace: "nowrap" }}>
                            <div style={{ display: "inline-flex", alignItems: "center", gap: 4 }}>
                              <span title={log.hash}>{truncateHash(log.hash, 6, 4)}</span>
                              <button
                                onClick={() => handleCopy(log.hash, `hash_${logId}`)}
                                title="Copy SHA-256 Hash"
                                style={{ background: "none", border: "none", cursor: "pointer", color: copiedKey === `hash_${logId}` ? "#10b981" : "#94a3b8" }}
                              >
                                <CopyIcon />
                              </button>
                            </div>
                          </td>

                          {/* 8. Verification Status */}
                          <td style={{ padding: "12px 14px", whiteSpace: "nowrap" }}>
                            <VerificationBadge status={log.verificationStatus} />
                          </td>

                          {/* 9. Actions */}
                          <td style={{ padding: "12px 14px", whiteSpace: "nowrap" }}>
                            <div style={{ display: "flex", gap: 5 }}>
                              {/* View Details */}
                              <button
                                onClick={() => setDetailModalLog(log)}
                                title="View Complete Log Information"
                                style={{
                                  display: "inline-flex", alignItems: "center", gap: 3,
                                  background: "#eff6ff", color: "#1d4ed8", border: "1px solid #bfdbfe",
                                  borderRadius: 6, padding: "4px 8px", fontSize: "0.75rem",
                                  fontWeight: 700, cursor: "pointer",
                                }}
                              >
                                <EyeIcon size={12} /> Details
                              </button>

                              {/* Open Incident Details */}
                              {log.createdIncidentId && (
                                <Link
                                  to={`/admin/incidents/${log.createdIncidentId}`}
                                  title={`Open Incident Details for ${log.createdIncidentId}`}
                                  style={{
                                    display: "inline-flex", alignItems: "center", gap: 3,
                                    background: "#fff1f2", color: "#be123c", border: "1px solid #fecdd3",
                                    borderRadius: 6, padding: "4px 8px", fontSize: "0.75rem",
                                    fontWeight: 700, textDecoration: "none", cursor: "pointer",
                                    whiteSpace: "nowrap",
                                  }}
                                >
                                  <span>🚨</span> Incident
                                </Link>
                              )}

                              {/* Download */}
                              <button
                                onClick={() => downloadSecurityLog(logId, log.incidentId)}
                                title="Download Evidence File"
                                style={{
                                  background: "#f0fdf4", color: "#15803d", border: "1px solid #bbf7d0",
                                  borderRadius: 6, padding: "4px 7px", fontSize: "0.75rem",
                                  cursor: "pointer", display: "inline-flex", alignItems: "center",
                                }}
                              >
                                <DownloadIcon size={12} />
                              </button>

                              {/* Delete Metadata (Preserves Blockchain Records) */}
                              <button
                                onClick={() => setDeleteConfirmLog(log)}
                                title="Delete Metadata (Preserves Blockchain)"
                                disabled={actionLoading[logId]}
                                style={{
                                  background: "#fef2f2", color: "#dc2626", border: "1px solid #fecaca",
                                  borderRadius: 6, padding: "4px 7px", fontSize: "0.75rem",
                                  cursor: "pointer", display: "inline-flex", alignItems: "center",
                                }}
                              >
                                <TrashIcon size={12} />
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>

            {/* Pagination Controls */}
            {pagination.totalPages > 1 && (
              <div style={{
                padding: "1rem 1.5rem", borderTop: "1px solid #e2e8f0",
                display: "flex", alignItems: "center", justifyContent: "space-between",
              }}>
                <div style={{ fontSize: "0.8125rem", color: "#64748b" }}>
                  Showing page {pagination.page} of {pagination.totalPages} ({pagination.total} total log incidents)
                </div>
                <div style={{ display: "flex", gap: 6 }}>
                  <button
                    disabled={pagination.page <= 1}
                    onClick={() => fetchLogs(pagination.page - 1)}
                    style={{
                      padding: "6px 12px", borderRadius: 8, border: "1px solid #cbd5e1",
                      background: "#fff", cursor: pagination.page <= 1 ? "not-allowed" : "pointer",
                      opacity: pagination.page <= 1 ? 0.5 : 1, fontSize: "0.8125rem", fontWeight: 600,
                    }}
                  >
                    Previous
                  </button>
                  <button
                    disabled={pagination.page >= pagination.totalPages}
                    onClick={() => fetchLogs(pagination.page + 1)}
                    style={{
                      padding: "6px 12px", borderRadius: 8, border: "1px solid #cbd5e1",
                      background: "#fff", cursor: pagination.page >= pagination.totalPages ? "not-allowed" : "pointer",
                      opacity: pagination.page >= pagination.totalPages ? 0.5 : 1, fontSize: "0.8125rem", fontWeight: 600,
                    }}
                  >
                    Next
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </DashboardLayout>

      {/* ── Log Details Modal ── */}
      {detailModalLog && (
        <LogDetailsModal
          log={detailModalLog}
          onClose={() => setDetailModalLog(null)}
          onVerified={(res) => {
            setLogs((prev) =>
              prev.map((l) =>
                (l._id === detailModalLog._id || l.incidentId === detailModalLog.incidentId)
                  ? { ...l, verificationStatus: res.verificationStatus }
                  : l
              )
            );
          }}
        />
      )}

      {/* ── Upload Security Logs Modal ── */}
      {uploadModalOpen && (
        <div style={{
          position: "fixed", inset: 0, background: "rgba(15,39,68,0.75)",
          display: "flex", alignItems: "center", justifyContent: "center", zIndex: 9999,
          backdropFilter: "blur(4px)", padding: "1.5rem",
        }} onClick={() => setUploadModalOpen(false)}>
          <div style={{
            background: "#fff", borderRadius: 16, width: "100%", maxWidth: 540,
            padding: "2rem", boxShadow: "0 24px 64px rgba(0,0,0,0.35)",
          }} onClick={(e) => e.stopPropagation()}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1.25rem" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <div style={{ width: 38, height: 38, borderRadius: 10, background: "linear-gradient(135deg, #0d7377, #14a8ad)", color: "#fff", display: "flex", alignItems: "center", justifyContent: "center" }}>
                  <UploadIcon size={20} />
                </div>
                <div>
                  <h3 style={{ fontSize: "1.2rem", fontWeight: 800, color: "#0f2744", margin: 0 }}>
                    Upload Security Logs
                  </h3>
                  <div style={{ fontSize: "0.75rem", color: "#64748b" }}>
                    Supported: JSON, Snort Logs (.log/.txt), PCAP Files (.pcap/.pcapng)
                  </div>
                </div>
              </div>
              <button onClick={() => setUploadModalOpen(false)} style={{ background: "none", border: "none", cursor: "pointer", color: "#64748b" }}>
                <CloseIcon size={20} />
              </button>
            </div>

            <form onSubmit={handleUploadSubmit}>
              {/* File Dropzone Area */}
              <div style={{
                border: "2px dashed #cbd5e1", borderRadius: 12, padding: "2rem 1.5rem",
                textAlign: "center", background: "#f8fafc", cursor: "pointer",
                marginBottom: "1.25rem",
              }} onClick={() => document.getElementById("logFileInput").click()}>
                <input
                  id="logFileInput"
                  type="file"
                  accept=".json,.log,.txt,.pcap,.pcapng"
                  onChange={(e) => setSelectedFile(e.target.files[0] || null)}
                  style={{ display: "none" }}
                />
                <div style={{ fontSize: "2rem", marginBottom: 8 }}>📁</div>
                <div style={{ fontSize: "0.9375rem", fontWeight: 700, color: "#0f2744" }}>
                  {selectedFile ? selectedFile.name : "Click or drag security log file to upload"}
                </div>
                <div style={{ fontSize: "0.75rem", color: "#64748b", marginTop: 4 }}>
                  {selectedFile ? `${(selectedFile.size / 1024).toFixed(1)} KB` : "Supports JSON events, Snort alerts, and PCAP binary packet capture files"}
                </div>
              </div>

              {/* Supported Format Pills */}
              <div style={{ display: "flex", gap: 8, marginBottom: "1.5rem", justifyContent: "center" }}>
                <span style={{ fontSize: "0.725rem", fontWeight: 700, background: "#eff6ff", color: "#1d4ed8", padding: "3px 8px", borderRadius: 6 }}>
                  ✓ JSON Array/Objects
                </span>
                <span style={{ fontSize: "0.725rem", fontWeight: 700, background: "#f0fdf4", color: "#15803d", padding: "3px 8px", borderRadius: 6 }}>
                  ✓ Snort .log / Alerts
                </span>
                <span style={{ fontSize: "0.725rem", fontWeight: 700, background: "#fff7ed", color: "#c2410c", padding: "3px 8px", borderRadius: 6 }}>
                  ✓ PCAP / PCAPNG Files
                </span>
              </div>

              <div style={{ display: "flex", gap: 10, justifyContent: "flex-end" }}>
                <button
                  type="button"
                  onClick={() => setUploadModalOpen(false)}
                  style={{ padding: "8px 16px", borderRadius: 8, border: "1px solid #cbd5e1", background: "#f1f5f9", fontWeight: 600, cursor: "pointer" }}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={uploading || !selectedFile}
                  style={{
                    padding: "8px 20px", borderRadius: 8, border: "none",
                    background: "linear-gradient(135deg, #0d7377, #14a8ad)",
                    color: "#fff", fontWeight: 700, cursor: uploading || !selectedFile ? "not-allowed" : "pointer",
                    opacity: uploading || !selectedFile ? 0.6 : 1,
                  }}
                >
                  {uploading ? "Parsing & Ingesting..." : "Upload & Parse"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── Delete Metadata Confirmation Modal (Strictly Preserves Blockchain) ── */}
      {deleteConfirmLog && (
        <div style={{
          position: "fixed", inset: 0, background: "rgba(15,39,68,0.75)",
          display: "flex", alignItems: "center", justifyContent: "center", zIndex: 9999,
          backdropFilter: "blur(4px)", padding: "1.5rem",
        }} onClick={() => setDeleteConfirmLog(null)}>
          <div style={{
            background: "#fff", borderRadius: 16, width: "100%", maxWidth: 500,
            padding: "2rem", boxShadow: "0 24px 64px rgba(0,0,0,0.35)", textAlign: "center",
          }} onClick={(e) => e.stopPropagation()}>
            <div style={{ width: 50, height: 50, borderRadius: "50%", background: "#fef2f2", color: "#dc2626", display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 1rem", fontSize: "1.5rem" }}>
              ⚠️
            </div>
            <h3 style={{ fontSize: "1.2rem", fontWeight: 800, color: "#0f2744", margin: "0 0 0.5rem" }}>
              Delete Security Log Metadata?
            </h3>
            <p style={{ fontSize: "0.84375rem", color: "#64748b", margin: "0 0 1rem" }}>
              Are you sure you want to delete metadata for incident <strong>{deleteConfirmLog.incidentId}</strong>?
            </p>
            <div style={{
              background: "#ecfdf5", border: "1px solid #a7f3d0", borderRadius: 8,
              padding: "10px 14px", fontSize: "0.78125rem", color: "#065f46", textAlign: "left",
              marginBottom: "1.5rem",
            }}>
              <strong>🛡️ Immutable Ledger Guarantee:</strong> Database metadata and local file references will be purged, but the corresponding <strong>BlockchainTransaction record will remain permanently preserved</strong> on the cryptographic ledger for audit compliance.
            </div>
            <div style={{ display: "flex", gap: 10, justifyContent: "center" }}>
              <button
                onClick={() => setDeleteConfirmLog(null)}
                style={{ padding: "8px 18px", borderRadius: 8, border: "1px solid #cbd5e1", background: "#f1f5f9", fontWeight: 600, cursor: "pointer" }}
              >
                Cancel
              </button>
              <button
                onClick={handleDeleteMetadata}
                style={{
                  padding: "8px 20px", borderRadius: 8, border: "none",
                  background: "#dc2626", color: "#fff", fontWeight: 700, cursor: "pointer",
                }}
              >
                Confirm Delete Metadata
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};

export default SecurityLogs;
