import React, { useState, useEffect, useCallback, useRef } from "react";
import { Link } from "react-router-dom";
import DashboardLayout from "../../layouts/DashboardLayout";
import {
  getLiveSecurityLogs,
  getSecurityLogStats,
  generateSyntheticSecurityEvent,
  triggerRealWindowsEvent,
  getWindowsCollectorStatus,
} from "../../services/securityLogService";
import { getSocket } from "../../services/socket";

/* ── Inline SVG Icons ── */
const ShieldCheckIcon = ({ size = 20, color = "currentColor" }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>
    <polyline points="9 12 11 14 15 10"/>
  </svg>
);

const ActivityIcon = ({ size = 18 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/>
  </svg>
);

const SearchIcon = ({ size = 16 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
  </svg>
);

const RefreshIcon = ({ size = 16, spinning = false }) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
    style={{ animation: spinning ? "spin 0.8s linear infinite" : "none" }}
  >
    <polyline points="23 4 23 10 17 10"/><path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10"/>
  </svg>
);

const PauseIcon = ({ size = 16 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <rect x="6" y="4" width="4" height="16"/><rect x="14" y="4" width="4" height="16"/>
  </svg>
);

const PlayIcon = ({ size = 16 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <polygon points="5 3 19 12 5 21 5 3"/>
  </svg>
);

const CloseIcon = ({ size = 18 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
  </svg>
);

const CopyIcon = ({ size = 14 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <rect x="9" y="9" width="13" height="13" rx="2" ry="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/>
  </svg>
);

const CheckIcon = ({ size = 14 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="20 6 9 17 4 12"/>
  </svg>
);

const AlertTriangleIcon = ({ size = 16 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/>
    <line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/>
  </svg>
);

const WindowsIcon = ({ size = 16 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor">
    <path d="M0 3.449L9.75 2.1v9.451H0m10.949-9.602L24 0v11.4H10.949M0 12.6h9.75v9.451L0 20.699M10.949 12.6H24V24l-13.051-1.8"/>
  </svg>
);

/* ── Origin Badge Component ── */
const OriginBadge = ({ origin }) => {
  const norm = (origin || "UNKNOWN").toUpperCase();

  if (norm === "REAL") {
    return (
      <span
        style={{
          display: "inline-flex",
          alignItems: "center",
          gap: 6,
          padding: "3px 10px",
          borderRadius: 4,
          fontSize: "0.72rem",
          fontWeight: 800,
          fontFamily: "var(--font-mono, 'JetBrains Mono', monospace)",
          letterSpacing: "0.06em",
          background: "rgba(54, 214, 174, 0.12)",
          color: "#36D6AE",
          border: "1px solid rgba(54, 214, 174, 0.5)",
          boxShadow: "0 0 10px rgba(54, 214, 174, 0.15)",
        }}
        title="Verified Authentic Windows OS Telemetry"
      >
        <span style={{ color: "#36D6AE", fontWeight: 900 }}>✓</span> REAL
      </span>
    );
  }

  if (norm === "SAMPLE") {
    return (
      <span
        style={{
          display: "inline-flex",
          alignItems: "center",
          gap: 6,
          padding: "3px 10px",
          borderRadius: 4,
          fontSize: "0.72rem",
          fontWeight: 800,
          fontFamily: "var(--font-mono, 'JetBrains Mono', monospace)",
          letterSpacing: "0.06em",
          background: "rgba(255, 181, 71, 0.12)",
          color: "#FFB547",
          border: "1px solid rgba(255, 181, 71, 0.45)",
          boxShadow: "0 0 10px rgba(255, 181, 71, 0.15)",
        }}
        title="Synthetic demonstration data"
      >
        <span>⚠️</span> SAMPLE
      </span>
    );
  }

  if (norm === "TEST") {
    return (
      <span
        style={{
          display: "inline-flex",
          alignItems: "center",
          gap: 6,
          padding: "3px 10px",
          borderRadius: 4,
          fontSize: "0.72rem",
          fontWeight: 800,
          fontFamily: "var(--font-mono, 'JetBrains Mono', monospace)",
          letterSpacing: "0.06em",
          background: "rgba(99, 102, 241, 0.14)",
          color: "#a5b4fc",
          border: "1px solid rgba(129, 140, 248, 0.4)",
        }}
        title="Automated Test Event"
      >
        <span>🧪</span> TEST
      </span>
    );
  }

  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 6,
        padding: "3px 10px",
        borderRadius: 4,
        fontSize: "0.72rem",
        fontWeight: 700,
        fontFamily: "var(--font-mono, 'JetBrains Mono', monospace)",
        background: "rgba(255, 255, 255, 0.05)",
        color: "#94a3b8",
        border: "1px solid #334155",
      }}
    >
      <span>❓</span> UNKNOWN
    </span>
  );
};

/* ── Severity Badge ── */
const SeverityBadge = ({ severity }) => {
  const norm = (severity || "LOW").toUpperCase();
  const styles = {
    CRITICAL: { bg: "rgba(255, 77, 79, 0.15)", color: "#FF4D4F", border: "rgba(255, 77, 79, 0.45)", icon: "🚨" },
    HIGH:     { bg: "rgba(255, 142, 60, 0.15)", color: "#FF8E3C", border: "rgba(255, 142, 60, 0.45)", icon: "⚠️" },
    MEDIUM:   { bg: "rgba(244, 197, 66, 0.15)", color: "#F4C542", border: "rgba(244, 197, 66, 0.45)", icon: "⚡" },
    LOW:      { bg: "rgba(54, 214, 174, 0.15)", color: "#36D6AE", border: "rgba(54, 214, 174, 0.45)", icon: "ℹ️" },
  };
  const s = styles[norm] || styles.LOW;
  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 5,
        padding: "2px 8px",
        borderRadius: 4,
        fontSize: "0.7rem",
        fontWeight: 800,
        fontFamily: "var(--font-mono, 'JetBrains Mono', monospace)",
        letterSpacing: "0.04em",
        background: s.bg,
        color: s.color,
        border: `1px solid ${s.border}`,
        boxShadow: `0 0 8px ${s.color}22`,
      }}
    >
      <span>{s.icon}</span> {norm}
    </span>
  );
};

/* ── Collection Method Badge ── */
const MethodBadge = ({ method }) => {
  const norm = method || "UNKNOWN";
  return (
    <code
      style={{
        fontSize: "0.7rem",
        padding: "3px 7px",
        background: "#080907",
        color: "#F4C542",
        borderRadius: 4,
        fontFamily: "var(--font-mono, 'JetBrains Mono', monospace)",
        border: "1px solid rgba(244, 197, 66, 0.25)",
        fontWeight: 700,
      }}
    >
      {norm}
    </code>
  );
};

/* ── Main Component ── */
const LiveSecurityLogs = () => {
  const [logs, setLogs] = useState([]);
  const [stats, setStats] = useState({
    total: 0,
    real: 0,
    sample: 0,
    test: 0,
    unknown: 0,
    threats: 0,
    critical: 0,
    high: 0,
    medium: 0,
    low: 0,
  });
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [socketConnected, setSocketConnected] = useState(false);
  const [collectorStatus, setCollectorStatus] = useState(null);

  // Filters
  const [originFilter, setOriginFilter] = useState("REAL");
  const [severityFilter, setSeverityFilter] = useState("All");
  const [threatFilter, setThreatFilter] = useState("All");
  const [sourceFilter, setSourceFilter] = useState("All");
  const [searchTerm, setSearchTerm] = useState("");

  // Live Pause State
  const [isPaused, setIsPaused] = useState(false);
  const [pausedBuffer, setPausedBuffer] = useState([]);

  // Detail Modal
  const [selectedLog, setSelectedLog] = useState(null);
  const [copiedRaw, setCopiedRaw] = useState(false);

  // Demo Generator State
  const [generatingScenario, setGeneratingScenario] = useState("");
  const [triggeringWindows, setTriggeringWindows] = useState(false);
  const [toast, setToast] = useState(null);
  const [newEventNotice, setNewEventNotice] = useState(null);
  const [flashId, setFlashId] = useState(null);

  const showToast = (type, message) => {
    setToast({ type, message });
    setTimeout(() => setToast(null), 4000);
  };

  // ── Load Logs & Stats from API ──
  const fetchLogsAndStats = useCallback(async (isInitial = false) => {
    if (isInitial) setLoading(true);
    else setRefreshing(true);

    try {
      const [logsData, statsData, statusData] = await Promise.all([
        getLiveSecurityLogs({
          limit: 100,
          origin: originFilter !== "All" ? originFilter : undefined,
          severity: severityFilter !== "All" ? severityFilter : undefined,
          threat: threatFilter !== "All" ? threatFilter : undefined,
          source: sourceFilter !== "All" ? sourceFilter : undefined,
          search: searchTerm || undefined,
        }),
        getSecurityLogStats(),
        getWindowsCollectorStatus().catch(() => ({ status: null })),
      ]);

      if (logsData && logsData.logs) {
        setLogs(logsData.logs);
      }
      if (statsData) {
        setStats(statsData);
      }
      if (statusData && statusData.status) {
        setCollectorStatus(statusData.status);
      }
    } catch (err) {
      console.error("Error loading live security telemetry:", err);
      showToast("error", "Failed to retrieve telemetry data.");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [originFilter, severityFilter, threatFilter, sourceFilter, searchTerm]);

  useEffect(() => {
    fetchLogsAndStats(true);
  }, [fetchLogsAndStats]);

  // ── Socket.IO Real-Time Listener ──
  useEffect(() => {
    const socket = getSocket();

    const handleConnect = () => {
      setSocketConnected(true);
    };

    const handleDisconnect = () => {
      setSocketConnected(false);
    };

    const handleNewLog = (newLog) => {
      if (!newLog) return;

      // Update counters dynamically
      setStats((prev) => {
        const originKey = String(newLog.dataOrigin || "UNKNOWN").toLowerCase();
        const severityKey = String(newLog.severity || "LOW").toLowerCase();
        return {
          ...prev,
          total: (prev.total || 0) + 1,
          [originKey]: (prev[originKey] || 0) + 1,
          threats: newLog.threat ? (prev.threats || 0) + 1 : prev.threats,
          [severityKey]: (prev[severityKey] || 0) + 1,
        };
      });

      // If filtering by origin (e.g. REAL), ignore events that don't match
      if (originFilter !== "All" && newLog.dataOrigin !== originFilter) {
        return;
      }

      // Visual notification: small "New event received" alert (Requirement 23)
      const originTag = newLog.dataOrigin || "EVENT";
      const srcTag = newLog.source || "System";
      const idTag = newLog.incidentId || newLog._id;
      setFlashId(idTag);
      setNewEventNotice({
        origin: originTag,
        source: srcTag,
        attackType: newLog.attackType || "TELEMETRY",
        id: idTag,
        severity: newLog.severity || "LOW",
      });
      setTimeout(() => setNewEventNotice(null), 4000);
      setTimeout(() => setFlashId(null), 2500);

      if (isPaused) {
        // Enqueue into paused buffer
        setPausedBuffer((prev) => [newLog, ...prev]);
      } else {
        // Prepend directly to active table, keeping maximum 100 entries for high performance
        setLogs((prev) => {
          // Avoid duplicate insertion if already in list
          if (prev.some((item) => item.incidentId === newLog.incidentId || item._id === newLog._id)) {
            return prev;
          }
          return [newLog, ...prev].slice(0, 100);
        });
      }
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
        setSelectedLog((prev) => {
          if (!prev) return prev;
          if (prev._id === newInc.securityLogId || prev.incidentId === newInc.securityLogId) {
            return { ...prev, createdIncidentId: newInc.incidentId };
          }
          return prev;
        });
      }
    };

    if (socket.connected) {
      setSocketConnected(true);
    }

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
  }, [isPaused]);

  // Resume stream handler
  const handleResumeStream = () => {
    if (pausedBuffer.length > 0) {
      setLogs((prev) => {
        const combined = [...pausedBuffer, ...prev];
        // Deduplicate
        const seen = new Set();
        const unique = [];
        for (const item of combined) {
          const key = item.incidentId || item._id;
          if (!seen.has(key)) {
            seen.add(key);
            unique.push(item);
          }
        }
        return unique.slice(0, 100);
      });
      setPausedBuffer([]);
    }
    setIsPaused(false);
  };

  // Copy raw event block
  const handleCopyRaw = (text) => {
    navigator.clipboard.writeText(text);
    setCopiedRaw(true);
    setTimeout(() => setCopiedRaw(false), 2000);
  };

  // Trigger Sample generator
  const handleGenerateSample = async (scenario, origin = "SAMPLE") => {
    setGeneratingScenario(scenario);
    try {
      const res = await generateSyntheticSecurityEvent(scenario, origin);
      showToast("success", `Generated ${origin} event: ${scenario}`);
      if (res && res.log && !isPaused) {
        setLogs((prev) => [res.log, ...prev].slice(0, 100));
      }
    } catch (err) {
      showToast("error", "Failed to generate sample event: " + err.message);
    } finally {
      setGeneratingScenario("");
    }
  };

  // Trigger Real Windows Event
  const handleTriggerRealWindowsEvent = async () => {
    setTriggeringWindows(true);
    try {
      const res = await triggerRealWindowsEvent({
        eventId: 1000,
        message: `CyberSecurity Incident Ledger REAL telemetry verification at ${new Date().toISOString()}`,
      });
      showToast("success", res.message || "Windows Event written to Application log. Polling...");
    } catch (err) {
      showToast("error", "Error writing to Windows Event Log: " + err.message);
    } finally {
      setTriggeringWindows(false);
    }
  };

  return (
    <DashboardLayout activeSection="feeds" stats={stats}>
      <div style={{ padding: "0 0.5rem 3rem 0.5rem", fontFamily: "var(--font-sans, system-ui, sans-serif)" }}>
        {/* ── Toast Notification ── */}
        {toast && (
          <div
            style={{
              position: "fixed",
              top: 24,
              right: 24,
              zIndex: 9999,
              padding: "12px 20px",
              borderRadius: 8,
              fontSize: "0.875rem",
              fontWeight: 600,
              boxShadow: "0 10px 25px -5px rgba(0,0,0,0.1), 0 8px 10px -6px rgba(0,0,0,0.1)",
              display: "flex",
              alignItems: "center",
              gap: 10,
              color: "#fff",
              background: toast.type === "error" ? "#dc2626" : "#059669",
              animation: "fadeIn 0.25s ease",
            }}
          >
            <span>{toast.type === "error" ? "⚠️" : "✓"}</span>
            <span>{toast.message}</span>
          </div>
        )}

        {/* ── Top Header ── */}
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "flex-start",
            flexWrap: "wrap",
            gap: 16,
            marginBottom: 24,
            paddingBottom: 20,
            borderBottom: "1px solid var(--border-subtle)",
          }}
        >
          <div>
            <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
              <div style={{
                width: 44, height: 44, borderRadius: 12,
                background: "#080907", display: "flex", alignItems: "center", justifyContent: "center",
                border: "1.5px solid rgba(244, 197, 66, 0.45)", padding: 4, flexShrink: 0,
                boxShadow: "0 0 16px rgba(244, 197, 66, 0.25)",
              }}>
                <img src="/logo.png" alt="Owlyx Logo" style={{ width: "100%", height: "100%", objectFit: "contain" }} />
              </div>
              <div>
                <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
                  <h1
                    style={{
                      fontSize: "1.75rem",
                      fontWeight: 800,
                      color: "var(--text-primary)",
                      fontFamily: "var(--font-heading)",
                      letterSpacing: "-0.02em",
                      margin: 0,
                    }}
                  >
                    OWLYX LIVE TELEMETRY
                  </h1>
                  <span
                    style={{
                      fontSize: "0.7rem",
                      fontWeight: 800,
                      color: "var(--color-gold)",
                      background: "rgba(244, 197, 66, 0.12)",
                      border: "1px solid rgba(244, 197, 66, 0.35)",
                      padding: "3px 10px",
                      borderRadius: 4,
                      letterSpacing: "0.08em",
                      fontFamily: "var(--font-mono)",
                    }}
                  >
                    SILENT WATCH. UNBREAKABLE PROOF.
                  </span>
                  {/* Connection Status Badge */}
                  <div
                    style={{
                      display: "inline-flex",
                      alignItems: "center",
                      gap: 6,
                      padding: "3px 10px",
                      borderRadius: 4,
                      fontSize: "0.72rem",
                      fontWeight: 800,
                      fontFamily: "var(--font-mono)",
                      letterSpacing: "0.05em",
                      background: socketConnected ? "rgba(54, 214, 174, 0.12)" : "rgba(255, 77, 79, 0.12)",
                      color: socketConnected ? "var(--state-verified)" : "var(--state-critical)",
                      border: `1px solid ${socketConnected ? "rgba(54, 214, 174, 0.4)" : "rgba(255, 77, 79, 0.4)"}`,
                    }}
                  >
                    <span
                      style={{
                        width: 7,
                        height: 7,
                        borderRadius: "50%",
                        background: socketConnected ? "var(--state-verified)" : "var(--state-critical)",
                        boxShadow: socketConnected ? "0 0 8px var(--state-verified)" : "none",
                      }}
                    />
                    {socketConnected ? "● LIVE STREAM" : "● DISCONNECTED"}
                  </div>
                </div>
                <p style={{ margin: "6px 0 0 0", color: "var(--text-secondary)", fontSize: "0.875rem" }}>
                  Authentic Windows operating system telemetry monitored continuously by Owlyx Sentinel Engine.
                </p>
              </div>
            </div>
            {collectorStatus && collectorStatus.host && (
              <div style={{ display: "flex", gap: 16, marginTop: 10, fontSize: "0.78rem", color: "var(--text-secondary)", fontFamily: "var(--font-mono)" }}>
                <span>Host: <strong style={{ color: "var(--text-primary)" }}>{collectorStatus.host}</strong></span>
                <span>Poll: <strong style={{ color: "var(--color-gold)" }}>{collectorStatus.pollIntervalMs}ms</strong></span>
                <span>
                  Channels: {collectorStatus.channels?.map((c) => (
                    <span
                      key={c.name}
                      style={{
                        marginLeft: 6,
                        padding: "1px 6px",
                        borderRadius: 3,
                        fontSize: "0.7rem",
                        background: c.active ? "rgba(54, 214, 174, 0.12)" : "rgba(255, 77, 79, 0.12)",
                        color: c.active ? "var(--state-verified)" : "var(--state-critical)",
                        border: `1px solid ${c.active ? "rgba(54, 214, 174, 0.3)" : "rgba(255, 77, 79, 0.3)"}`,
                      }}
                    >
                      {c.name} {c.active ? "✓" : "(restricted)"}
                    </span>
                  ))}
                </span>
              </div>
            )}
          </div>

          {/* Action Buttons */}
          <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
            {/* Pause / Resume Button */}
            {isPaused ? (
              <button
                onClick={handleResumeStream}
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 8,
                  padding: "8px 16px",
                  borderRadius: 6,
                  fontSize: "0.8125rem",
                  fontWeight: 800,
                  fontFamily: "var(--font-mono)",
                  background: "var(--state-investigating)",
                  color: "#080907",
                  border: "none",
                  cursor: "pointer",
                  boxShadow: "0 0 14px rgba(255, 181, 71, 0.3)",
                }}
              >
                <PlayIcon size={14} />
                LIVE PAUSED — {pausedBuffer.length} BUFFERED (Resume)
              </button>
            ) : (
              <button
                onClick={() => setIsPaused(true)}
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 8,
                  padding: "8px 14px",
                  borderRadius: 6,
                  fontSize: "0.8125rem",
                  fontWeight: 700,
                  background: "rgba(255, 255, 255, 0.04)",
                  color: "var(--text-primary)",
                  border: "1px solid var(--border-subtle)",
                  cursor: "pointer",
                  transition: "all 0.15s",
                }}
              >
                <PauseIcon size={14} />
                Pause Stream
              </button>
            )}

            {/* Refresh */}
            <button
              onClick={() => fetchLogsAndStats(false)}
              disabled={refreshing}
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: 6,
                padding: "8px 14px",
                borderRadius: 6,
                fontSize: "0.8125rem",
                fontWeight: 700,
                background: "rgba(255, 255, 255, 0.04)",
                color: "var(--text-primary)",
                border: "1px solid var(--border-subtle)",
                cursor: "pointer",
              }}
            >
              <RefreshIcon size={14} spinning={refreshing} />
              Refresh
            </button>

            {/* Trigger Real Windows Event */}
            <button
              onClick={handleTriggerRealWindowsEvent}
              disabled={triggeringWindows}
              title="Writes an event to Windows Application log via PowerShell Write-EventLog which wevtutil detects as REAL"
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: 6,
                padding: "8px 16px",
                borderRadius: 6,
                fontSize: "0.8125rem",
                fontWeight: 800,
                fontFamily: "var(--font-heading)",
                background: "linear-gradient(135deg, #10b981 0%, #059669 100%)",
                color: "#080907",
                border: "1px solid rgba(54, 214, 174, 0.4)",
                cursor: "pointer",
                boxShadow: "0 0 14px rgba(54, 214, 174, 0.25)",
              }}
            >
              <WindowsIcon size={14} />
              {triggeringWindows ? "Writing Event..." : "Emit Real Windows Event"}
            </button>

            {/* Generate Sample Dropdown */}
            <div style={{ position: "relative", display: "inline-block" }}>
              <select
                onChange={(e) => {
                  if (e.target.value) {
                    handleGenerateSample(e.target.value, "SAMPLE");
                    e.target.value = "";
                  }
                }}
                disabled={Boolean(generatingScenario)}
                style={{
                  padding: "8px 14px",
                  borderRadius: 6,
                  fontSize: "0.8125rem",
                  fontWeight: 800,
                  fontFamily: "var(--font-heading)",
                  background: "rgba(244, 197, 66, 0.15)",
                  color: "var(--color-gold)",
                  border: "1px solid rgba(244, 197, 66, 0.4)",
                  cursor: "pointer",
                  outline: "none",
                  boxShadow: "0 0 12px rgba(244, 197, 66, 0.15)",
                }}
                defaultValue=""
              >
                <option value="" disabled style={{ background: "#080907", color: "#F2F2EA" }}>
                  {generatingScenario ? "Synthesizing..." : "⚡ Sample Threat Generator ▾"}
                </option>
                <option value="SQL_INJECTION" style={{ background: "#141610", color: "#F2F2EA" }}>Sample SQL Injection</option>
                <option value="BRUTE_FORCE" style={{ background: "#141610", color: "#F2F2EA" }}>Sample Brute Force</option>
                <option value="PORT_SCAN" style={{ background: "#141610", color: "#F2F2EA" }}>Sample Port Scan</option>
                <option value="DDOS" style={{ background: "#141610", color: "#F2F2EA" }}>Sample DDoS</option>
                <option value="SUSPICIOUS_PROCESS_EXECUTION" style={{ background: "#141610", color: "#F2F2EA" }}>Sample Suspicious Process</option>
                <option value="MALWARE_DETECTION" style={{ background: "#141610", color: "#F2F2EA" }}>Sample Malware Detection</option>
              </select>
            </div>

            {/* Generate Test Event */}
            <button
              onClick={() => handleGenerateSample("SQL_INJECTION", "TEST")}
              disabled={Boolean(generatingScenario)}
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: 6,
                padding: "8px 14px",
                borderRadius: 6,
                fontSize: "0.8125rem",
                fontWeight: 700,
                fontFamily: "var(--font-heading)",
                background: "rgba(99, 102, 241, 0.16)",
                color: "#a5b4fc",
                border: "1px solid rgba(129, 140, 248, 0.35)",
                cursor: "pointer",
              }}
            >
              <span>🧪</span> Test Event
            </button>
          </div>
        </div>

        {/* ── Summary KPI Cards (Section 18) ── */}
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))",
            gap: 14,
            marginBottom: 24,
          }}
        >
          {/* REAL LOGS */}
          <div
            style={{
              background: "var(--bg-surface)",
              padding: "16px 18px",
              borderRadius: 8,
              border: "1px solid rgba(54, 214, 174, 0.35)",
              boxShadow: "0 4px 16px rgba(0,0,0,0.4)",
              position: "relative",
            }}
          >
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <span style={{ fontSize: "0.75rem", fontWeight: 800, color: "var(--state-verified)", fontFamily: "var(--font-mono)", letterSpacing: "0.06em" }}>
                REAL LOGS
              </span>
              <span style={{ background: "rgba(54, 214, 174, 0.15)", color: "var(--state-verified)", padding: "2px 6px", borderRadius: 4, fontSize: "0.68rem", fontWeight: 800, fontFamily: "var(--font-mono)" }}>
                ✓ OS Telemetry
              </span>
            </div>
            <div style={{ fontSize: "2.1rem", fontWeight: 900, color: "var(--state-verified)", fontFamily: "var(--font-mono)", marginTop: 6, textShadow: "0 0 12px rgba(54, 214, 174, 0.25)" }}>
              {Number(stats.real || 0).toLocaleString()}
            </div>
            <div style={{ fontSize: "0.72rem", color: "var(--text-secondary)", marginTop: 4 }}>
              Native Windows Event Logs
            </div>
          </div>

          {/* SAMPLE LOGS */}
          <div
            style={{
              background: "var(--bg-surface)",
              padding: "16px 18px",
              borderRadius: 8,
              border: "1px solid rgba(255, 181, 71, 0.35)",
              boxShadow: "0 4px 16px rgba(0,0,0,0.4)",
            }}
          >
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <span style={{ fontSize: "0.75rem", fontWeight: 800, color: "var(--state-investigating)", fontFamily: "var(--font-mono)", letterSpacing: "0.06em" }}>
                SAMPLE LOGS
              </span>
              <span style={{ background: "rgba(255, 181, 71, 0.15)", color: "var(--state-investigating)", padding: "2px 6px", borderRadius: 4, fontSize: "0.68rem", fontWeight: 800, fontFamily: "var(--font-mono)" }}>
                ⚠️ Synthetic
              </span>
            </div>
            <div style={{ fontSize: "2.1rem", fontWeight: 900, color: "var(--state-investigating)", fontFamily: "var(--font-mono)", marginTop: 6 }}>
              {Number(stats.sample || 0).toLocaleString()}
            </div>
            <div style={{ fontSize: "0.72rem", color: "var(--text-secondary)", marginTop: 4 }}>
              Controlled Demonstration Data
            </div>
          </div>

          {/* TEST LOGS */}
          <div
            style={{
              background: "var(--bg-surface)",
              padding: "16px 18px",
              borderRadius: 8,
              border: "1px solid rgba(129, 140, 248, 0.35)",
              boxShadow: "0 4px 16px rgba(0,0,0,0.4)",
            }}
          >
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <span style={{ fontSize: "0.75rem", fontWeight: 800, color: "#a5b4fc", fontFamily: "var(--font-mono)", letterSpacing: "0.06em" }}>
                TEST LOGS
              </span>
              <span style={{ background: "rgba(99, 102, 241, 0.15)", color: "#a5b4fc", padding: "2px 6px", borderRadius: 4, fontSize: "0.68rem", fontWeight: 800, fontFamily: "var(--font-mono)" }}>
                🧪 Injected
              </span>
            </div>
            <div style={{ fontSize: "2.1rem", fontWeight: 900, color: "#c7d2fe", fontFamily: "var(--font-mono)", marginTop: 6 }}>
              {Number(stats.test || 0).toLocaleString()}
            </div>
            <div style={{ fontSize: "0.72rem", color: "var(--text-secondary)", marginTop: 4 }}>
              Automated Harness Tests
            </div>
          </div>

          {/* THREAT EVENTS */}
          <div
            style={{
              background: "var(--bg-surface)",
              padding: "16px 18px",
              borderRadius: 8,
              border: "1px solid rgba(255, 77, 79, 0.4)",
              boxShadow: "0 4px 16px rgba(0,0,0,0.4)",
            }}
          >
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <span style={{ fontSize: "0.75rem", fontWeight: 800, color: "var(--state-critical)", fontFamily: "var(--font-mono)", letterSpacing: "0.06em" }}>
                THREAT EVENTS
              </span>
              <span style={{ background: "rgba(255, 77, 79, 0.15)", color: "var(--state-critical)", padding: "2px 6px", borderRadius: 4, fontSize: "0.68rem", fontWeight: 800, fontFamily: "var(--font-mono)" }}>
                🚨 Flagged
              </span>
            </div>
            <div style={{ fontSize: "2.1rem", fontWeight: 900, color: "var(--state-critical)", fontFamily: "var(--font-mono)", marginTop: 6, textShadow: "0 0 12px rgba(255, 77, 79, 0.3)" }}>
              {Number(stats.threats || 0).toLocaleString()}
            </div>
            <div style={{ fontSize: "0.72rem", color: "var(--text-secondary)", marginTop: 4 }}>
              Converted to Incidents
            </div>
          </div>

          {/* CRITICAL EVENTS */}
          <div
            style={{
              background: "var(--bg-surface)",
              padding: "16px 18px",
              borderRadius: 8,
              border: "1px solid var(--border-subtle)",
              boxShadow: "0 4px 16px rgba(0,0,0,0.4)",
            }}
          >
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <span style={{ fontSize: "0.75rem", fontWeight: 800, color: "var(--color-gold)", fontFamily: "var(--font-mono)", letterSpacing: "0.06em" }}>
                CRITICAL RISK
              </span>
              <span style={{ background: "rgba(244, 197, 66, 0.15)", color: "var(--color-gold)", padding: "2px 6px", borderRadius: 4, fontSize: "0.68rem", fontWeight: 800, fontFamily: "var(--font-mono)" }}>
                MAX RISK
              </span>
            </div>
            <div style={{ fontSize: "2.1rem", fontWeight: 900, color: "var(--text-primary)", fontFamily: "var(--font-mono)", marginTop: 6 }}>
              {Number(stats.critical || 0).toLocaleString()}
            </div>
            <div style={{ fontSize: "0.72rem", color: "var(--text-secondary)", marginTop: 4 }}>
              High-velocity anomalies
            </div>
          </div>
        </div>

        {/* ── Filter Bar (Section 20) ── */}
        <div
          style={{
            background: "var(--bg-surface)",
            padding: "16px 20px",
            borderRadius: 8,
            border: "1px solid var(--border-subtle)",
            marginBottom: 20,
            display: "flex",
            flexWrap: "wrap",
            gap: 14,
            alignItems: "center",
          }}
        >
          {/* Origin Filter */}
          <div style={{ display: "flex", flexDirection: "column", gap: 5 }}>
            <label style={{ fontSize: "0.7rem", fontWeight: 800, color: "var(--color-gold)", fontFamily: "var(--font-mono)", letterSpacing: "0.06em" }}>DATA ORIGIN</label>
            <select
              value={originFilter}
              onChange={(e) => setOriginFilter(e.target.value)}
              style={{
                padding: "7px 12px",
                borderRadius: 4,
                border: "1px solid var(--border-subtle)",
                fontSize: "0.8125rem",
                fontWeight: 700,
                background: "var(--bg-secondary)",
                color: "var(--text-primary)",
                cursor: "pointer",
              }}
            >
              <option value="All">All Origins</option>
              <option value="REAL">REAL (Windows OS Telemetry)</option>
              <option value="SAMPLE">SAMPLE (Synthetic Demo)</option>
              <option value="TEST">TEST (Harness Test)</option>
              <option value="UNKNOWN">UNKNOWN</option>
            </select>
          </div>

          {/* Severity Filter */}
          <div style={{ display: "flex", flexDirection: "column", gap: 5 }}>
            <label style={{ fontSize: "0.7rem", fontWeight: 800, color: "var(--color-gold)", fontFamily: "var(--font-mono)", letterSpacing: "0.06em" }}>SEVERITY</label>
            <select
              value={severityFilter}
              onChange={(e) => setSeverityFilter(e.target.value)}
              style={{
                padding: "7px 12px",
                borderRadius: 4,
                border: "1px solid var(--border-subtle)",
                fontSize: "0.8125rem",
                background: "var(--bg-secondary)",
                color: "var(--text-primary)",
                cursor: "pointer",
              }}
            >
              <option value="All">All Severities</option>
              <option value="CRITICAL">CRITICAL</option>
              <option value="HIGH">HIGH</option>
              <option value="MEDIUM">MEDIUM</option>
              <option value="LOW">LOW</option>
            </select>
          </div>

          {/* Threat Filter */}
          <div style={{ display: "flex", flexDirection: "column", gap: 5 }}>
            <label style={{ fontSize: "0.7rem", fontWeight: 800, color: "var(--color-gold)", fontFamily: "var(--font-mono)", letterSpacing: "0.06em" }}>THREAT STATUS</label>
            <select
              value={threatFilter}
              onChange={(e) => setThreatFilter(e.target.value)}
              style={{
                padding: "7px 12px",
                borderRadius: 4,
                border: "1px solid var(--border-subtle)",
                fontSize: "0.8125rem",
                background: "var(--bg-secondary)",
                color: "var(--text-primary)",
                cursor: "pointer",
              }}
            >
              <option value="All">All Logs</option>
              <option value="threats">Threats Only (Incidents)</option>
              <option value="normal">Normal / Benign Telemetry</option>
            </select>
          </div>

          {/* Source Filter */}
          <div style={{ display: "flex", flexDirection: "column", gap: 5 }}>
            <label style={{ fontSize: "0.7rem", fontWeight: 800, color: "var(--color-gold)", fontFamily: "var(--font-mono)", letterSpacing: "0.06em" }}>SOURCE</label>
            <select
              value={sourceFilter}
              onChange={(e) => setSourceFilter(e.target.value)}
              style={{
                padding: "7px 12px",
                borderRadius: 4,
                border: "1px solid var(--border-subtle)",
                fontSize: "0.8125rem",
                background: "var(--bg-secondary)",
                color: "var(--text-primary)",
                cursor: "pointer",
              }}
            >
              <option value="All">All Sources</option>
              <option value="Windows-Security">Windows Security</option>
              <option value="Windows-System">Windows System</option>
              <option value="Windows-Application">Windows Application</option>
              <option value="Sample Generator">Sample Generator</option>
              <option value="Other">Other</option>
            </select>
          </div>

          {/* Search Input (Section 25) */}
          <div style={{ display: "flex", flexDirection: "column", gap: 5, flex: 1, minWidth: 220 }}>
            <label style={{ fontSize: "0.7rem", fontWeight: 800, color: "var(--color-gold)", fontFamily: "var(--font-mono)", letterSpacing: "0.06em" }}>SEARCH TELEMETRY</label>
            <div style={{ position: "relative" }}>
              <input
                type="text"
                placeholder="Search message, event ID, host, incident ID..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                style={{
                  width: "100%",
                  padding: "7px 12px 7px 34px",
                  borderRadius: 4,
                  border: "1px solid var(--border-subtle)",
                  fontSize: "0.8125rem",
                  background: "var(--bg-secondary)",
                  color: "var(--text-primary)",
                  boxSizing: "border-box",
                }}
              />
              <span style={{ position: "absolute", left: 10, top: "50%", transform: "translateY(-50%)", color: "var(--text-muted)" }}>
                <SearchIcon size={14} />
              </span>
            </div>
          </div>
        </div>

        {/* ── Real-Time Event Notification (Section 23) ── */}
        {newEventNotice && (
          <div
            style={{
              marginBottom: 16,
              padding: "10px 16px",
              borderRadius: 6,
              fontSize: "0.8125rem",
              fontWeight: 700,
              fontFamily: "var(--font-mono)",
              background: newEventNotice.origin === "REAL" ? "rgba(54, 214, 174, 0.12)" : "rgba(255, 181, 71, 0.12)",
              color: newEventNotice.origin === "REAL" ? "var(--state-verified)" : "var(--state-investigating)",
              border: `1px solid ${newEventNotice.origin === "REAL" ? "rgba(54, 214, 174, 0.4)" : "rgba(255, 181, 71, 0.4)"}`,
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              boxShadow: "0 4px 12px rgba(0,0,0,0.3)",
              animation: "fadeIn 0.25s ease-in-out",
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <span
                style={{
                  width: 8,
                  height: 8,
                  borderRadius: "50%",
                  background: newEventNotice.origin === "REAL" ? "var(--state-verified)" : "var(--state-investigating)",
                  boxShadow: `0 0 8px ${newEventNotice.origin === "REAL" ? "var(--state-verified)" : "var(--state-investigating)"}`,
                }}
              />
              <span>
                ⚡ <strong>Telemetry Ingest:</strong> [{newEventNotice.origin}] {newEventNotice.source} — {newEventNotice.attackType} (<code>{newEventNotice.id}</code>)
              </span>
            </div>
            <span style={{ fontSize: "0.75rem", opacity: 0.8 }}>Just now</span>
          </div>
        )}

        {/* ── Table Container (Section 19) ── */}
        <div
          style={{
            background: "var(--bg-surface)",
            borderRadius: 8,
            border: "1px solid var(--border-subtle)",
            overflow: "hidden",
            boxShadow: "0 4px 20px rgba(0,0,0,0.5)",
          }}
        >
          <div style={{ overflowX: "auto" }}>
            <table
              style={{
                width: "100%",
                borderCollapse: "collapse",
                textAlign: "left",
                fontSize: "0.85rem",
              }}
            >
              <thead>
                <tr
                  style={{
                    background: "var(--bg-secondary)",
                    borderBottom: "1px solid var(--border-subtle)",
                    color: "var(--color-gold)",
                    fontSize: "0.72rem",
                    fontWeight: 800,
                    textTransform: "uppercase",
                    letterSpacing: "0.06em",
                    fontFamily: "var(--font-mono)",
                  }}
                >
                  <th style={{ padding: "12px 16px" }}>Time</th>
                  <th style={{ padding: "12px 16px" }}>Origin</th>
                  <th style={{ padding: "12px 16px" }}>Method</th>
                  <th style={{ padding: "12px 16px" }}>Source / Host</th>
                  <th style={{ padding: "12px 16px" }}>Event ID</th>
                  <th style={{ padding: "12px 16px" }}>Threat</th>
                  <th style={{ padding: "12px 16px" }}>Severity</th>
                  <th style={{ padding: "12px 16px" }}>Risk</th>
                  <th style={{ padding: "12px 16px" }}>Attack Type</th>
                  <th style={{ padding: "12px 16px" }}>Message</th>
                  <th style={{ padding: "12px 16px", textAlign: "right" }}>Action</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr>
                    <td colSpan="11" style={{ padding: "48px", textAlign: "center", color: "var(--text-secondary)" }}>
                      <div style={{ display: "inline-block", width: 32, height: 32, border: "3px solid var(--border-subtle)", borderTopColor: "var(--color-gold)", borderRadius: "50%", animation: "spin 0.8s linear infinite" }} />
                      <p style={{ marginTop: 12, fontWeight: 600, fontFamily: "var(--font-mono)" }}>Connecting to live security telemetry stream...</p>
                    </td>
                  </tr>
                ) : logs.length === 0 ? (
                  <tr>
                    <td colSpan="11" style={{ padding: "48px", textAlign: "center", color: "var(--text-secondary)" }}>
                      <p style={{ fontSize: "1.1rem", fontWeight: 700, color: "var(--text-primary)", fontFamily: "var(--font-heading)" }}>No security telemetry events found</p>
                      <p style={{ fontSize: "0.85rem", color: "var(--text-muted)" }}>Click "Emit Real Windows Event" or generate sample events to test live stream ingest.</p>
                    </td>
                  </tr>
                ) : (
                  logs.map((log) => {
                    const eventTime = new Date(log.timestamp || log.createdAt).toLocaleTimeString();
                    const isReal = log.dataOrigin === "REAL";
                    const isFlash = flashId && (log.incidentId === flashId || log._id === flashId);

                    return (
                      <tr
                        key={log.incidentId || log._id}
                        onClick={() => setSelectedLog(log)}
                        style={{
                          borderBottom: "1px solid var(--border-subtle)",
                          cursor: "pointer",
                          transition: "background 0.2s ease, border-left 0.2s ease",
                          background: isFlash ? "rgba(54, 214, 174, 0.15)" : isReal ? "rgba(54, 214, 174, 0.02)" : "transparent",
                          borderLeft: isFlash ? "4px solid var(--state-verified)" : isReal ? "3px solid var(--state-verified)" : "3px solid transparent",
                        }}
                        onMouseEnter={(e) => {
                          e.currentTarget.style.background = "rgba(244, 197, 66, 0.05)";
                        }}
                        onMouseLeave={(e) => {
                          e.currentTarget.style.background = isFlash ? "rgba(54, 214, 174, 0.15)" : isReal ? "rgba(54, 214, 174, 0.02)" : "transparent";
                        }}
                      >
                        {/* Time */}
                        <td style={{ padding: "12px 16px", whiteSpace: "nowrap" }}>
                          <span style={{ fontWeight: 700, color: "var(--text-primary)", fontFamily: "var(--font-mono)", fontSize: "0.82rem" }}>{eventTime}</span>
                          {log.receivedAt && (
                            <span style={{ display: "block", fontSize: "0.68rem", color: "var(--text-muted)", fontFamily: "var(--font-mono)" }} title="System received timestamp">
                              Recv: {new Date(log.receivedAt).toLocaleTimeString()}
                            </span>
                          )}
                        </td>

                        {/* Origin Badge */}
                        <td style={{ padding: "12px 16px" }}>
                          <OriginBadge origin={log.dataOrigin} />
                        </td>

                        {/* Method */}
                        <td style={{ padding: "12px 16px" }}>
                          <MethodBadge method={log.collectionMethod} />
                        </td>

                        {/* Source / Host */}
                        <td style={{ padding: "12px 16px" }}>
                          <span style={{ fontWeight: 600, color: "var(--text-primary)" }}>{log.source || "System"}</span>
                          {log.collectorHost && (
                            <span style={{ display: "block", fontSize: "0.68rem", color: "var(--text-muted)", fontFamily: "var(--font-mono)" }}>
                              🖥️ {log.collectorHost}
                            </span>
                          )}
                        </td>

                        {/* Event ID */}
                        <td style={{ padding: "12px 16px" }}>
                          <code style={{ fontSize: "0.78rem", fontWeight: 700, color: "var(--color-gold)", fontFamily: "var(--font-mono)" }}>
                            {log.eventId || log.eventRecordId || "N/A"}
                          </code>
                        </td>

                        {/* Threat */}
                        <td style={{ padding: "12px 16px" }}>
                          {log.createdIncidentId ? (
                            <Link
                              to={`/admin/incidents/${log.createdIncidentId}`}
                              title={`Open Incident ${log.createdIncidentId}`}
                              onClick={(e) => e.stopPropagation()}
                              style={{
                                display: "inline-flex",
                                alignItems: "center",
                                gap: 4,
                                padding: "2px 8px",
                                borderRadius: 4,
                                background: "rgba(255, 77, 79, 0.15)",
                                color: "var(--state-critical)",
                                fontWeight: 800,
                                fontSize: "0.72rem",
                                textDecoration: "none",
                                border: "1px solid rgba(255, 77, 79, 0.4)",
                                fontFamily: "var(--font-mono)",
                                boxShadow: "0 0 8px rgba(255, 77, 79, 0.2)",
                              }}
                            >
                              <span>🚨</span>
                              <span>{log.createdIncidentId}</span>
                              <span style={{ fontSize: "0.65rem" }}>↗</span>
                            </Link>
                          ) : log.threat ? (
                            <span style={{ padding: "2px 8px", borderRadius: 4, background: "rgba(255, 77, 79, 0.15)", color: "var(--state-critical)", fontWeight: 800, fontSize: "0.7rem", fontFamily: "var(--font-mono)", border: "1px solid rgba(255, 77, 79, 0.3)" }}>
                              YES
                            </span>
                          ) : (
                            <span style={{ padding: "2px 8px", borderRadius: 4, background: "rgba(54, 214, 174, 0.1)", color: "var(--state-verified)", fontWeight: 700, fontSize: "0.7rem", fontFamily: "var(--font-mono)", border: "1px solid rgba(54, 214, 174, 0.3)" }}>
                              NO
                            </span>
                          )}
                        </td>

                        {/* Severity */}
                        <td style={{ padding: "12px 16px" }}>
                          <SeverityBadge severity={log.severity} />
                        </td>

                        {/* Risk Score */}
                        <td style={{ padding: "12px 16px" }}>
                          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                            <div style={{ width: 44, height: 6, background: "var(--bg-secondary)", border: "1px solid var(--border-subtle)", borderRadius: 3, overflow: "hidden" }}>
                              <div
                                style={{
                                  width: `${log.riskScore || 0}%`,
                                  height: "100%",
                                  background: (log.riskScore || 0) > 75 ? "var(--state-critical)" : (log.riskScore || 0) > 40 ? "var(--state-investigating)" : "var(--state-verified)",
                                }}
                              />
                            </div>
                            <span style={{ fontSize: "0.78rem", fontWeight: 700, color: "var(--text-primary)", fontFamily: "var(--font-mono)" }}>
                              {log.riskScore || 0}
                            </span>
                          </div>
                        </td>

                        {/* Attack Type */}
                        <td style={{ padding: "12px 16px", fontWeight: 600, color: "var(--text-primary)", fontFamily: "var(--font-mono)", fontSize: "0.8rem" }}>
                          {log.attackType || "NORMAL"}
                        </td>

                        {/* Message */}
                        <td
                          style={{
                            padding: "12px 16px",
                            maxWidth: 280,
                            overflow: "hidden",
                            textOverflow: "ellipsis",
                            whiteSpace: "nowrap",
                            color: "var(--text-secondary)",
                            fontSize: "0.8rem",
                          }}
                          title={log.message}
                        >
                          {log.message}
                        </td>

                        {/* Action */}
                        <td style={{ padding: "12px 16px", textAlign: "right", whiteSpace: "nowrap" }}>
                          <div style={{ display: "inline-flex", gap: 6, alignItems: "center" }}>
                            {log.createdIncidentId && (
                              <Link
                                to={`/admin/incidents/${log.createdIncidentId}`}
                                onClick={(e) => e.stopPropagation()}
                                title={`Open Incident Details for ${log.createdIncidentId}`}
                                style={{
                                  padding: "4px 8px",
                                  borderRadius: 4,
                                  fontSize: "0.72rem",
                                  fontWeight: 800,
                                  background: "rgba(255, 77, 79, 0.15)",
                                  color: "var(--state-critical)",
                                  border: "1px solid rgba(255, 77, 79, 0.4)",
                                  textDecoration: "none",
                                  display: "inline-flex",
                                  alignItems: "center",
                                  gap: 4,
                                }}
                              >
                                <span>🚨</span> View
                              </Link>
                            )}
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                setSelectedLog(log);
                              }}
                              style={{
                                padding: "4px 10px",
                                borderRadius: 4,
                                fontSize: "0.72rem",
                                fontWeight: 700,
                                fontFamily: "var(--font-mono)",
                                background: "rgba(255, 255, 255, 0.05)",
                                color: "var(--text-primary)",
                                border: "1px solid var(--border-subtle)",
                                cursor: "pointer",
                                transition: "all 0.15s",
                              }}
                              onMouseEnter={(e) => {
                                e.currentTarget.style.borderColor = "var(--color-gold)";
                                e.currentTarget.style.color = "var(--color-gold)";
                              }}
                              onMouseLeave={(e) => {
                                e.currentTarget.style.borderColor = "var(--border-subtle)";
                                e.currentTarget.style.color = "var(--text-primary)";
                              }}
                            >
                              Inspect Raw
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
        </div>

        {/* ── Raw Log Detail Modal (Section 21 & 22) ── */}
        {selectedLog && (
          <div
            style={{
              position: "fixed",
              top: 0,
              left: 0,
              right: 0,
              bottom: 0,
              backgroundColor: "rgba(8, 9, 7, 0.85)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              zIndex: 10000,
              padding: 20,
              backdropFilter: "blur(6px)",
            }}
            onClick={() => setSelectedLog(null)}
          >
            <div
              style={{
                background: "var(--bg-surface)",
                borderRadius: 12,
                border: "1px solid var(--border-subtle)",
                maxWidth: 920,
                width: "100%",
                maxHeight: "90vh",
                overflowY: "auto",
                boxShadow: "0 25px 60px rgba(0, 0, 0, 0.8), 0 0 25px rgba(244, 197, 66, 0.1)",
                display: "flex",
                flexDirection: "column",
              }}
              onClick={(e) => e.stopPropagation()}
            >
              {/* Modal Header */}
              <div
                style={{
                  padding: "18px 24px",
                  borderBottom: "1px solid var(--border-subtle)",
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  background: "var(--bg-secondary)",
                }}
              >
                <div>
                  <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                    <h2 style={{ margin: 0, fontSize: "1.2rem", fontWeight: 800, color: "var(--text-primary)", fontFamily: "var(--font-heading)" }}>
                      Telemetry Node Inspector
                    </h2>
                    <OriginBadge origin={selectedLog.dataOrigin} />
                  </div>
                  <p style={{ margin: "4px 0 0 0", fontSize: "0.78rem", color: "var(--text-secondary)", fontFamily: "var(--font-mono)" }}>
                    Incident Reference: <strong style={{ color: "var(--color-gold)" }}>{selectedLog.incidentId || "NONE"}</strong>
                  </p>
                </div>
                <button
                  onClick={() => setSelectedLog(null)}
                  style={{
                    background: "transparent",
                    border: "none",
                    cursor: "pointer",
                    color: "var(--text-muted)",
                    padding: 6,
                  }}
                >
                  <CloseIcon size={20} />
                </button>
              </div>

              {/* Modal Body */}
              <div style={{ padding: "20px 24px" }}>
                {/* ── Authenticity Verification Banner ── */}
                {selectedLog.dataOrigin === "REAL" ? (
                  <div
                    style={{
                      background: "rgba(54, 214, 174, 0.08)",
                      border: "1px solid rgba(54, 214, 174, 0.4)",
                      borderRadius: 8,
                      padding: "16px 20px",
                      marginBottom: 20,
                    }}
                  >
                    <div style={{ display: "flex", alignItems: "center", gap: 8, color: "var(--state-verified)", fontWeight: 800, fontSize: "0.9rem", fontFamily: "var(--font-heading)" }}>
                      <CheckIcon size={18} />
                      VERIFIED REAL OPERATING SYSTEM TELEMETRY
                    </div>
                    <div
                      style={{
                        display: "grid",
                        gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
                        gap: 8,
                        marginTop: 10,
                        fontSize: "0.78rem",
                        color: "var(--text-primary)",
                        fontFamily: "var(--font-mono)",
                      }}
                    >
                      <div>✓ Source: <strong>Windows Event Log</strong></div>
                      <div>✓ Method: <strong>{selectedLog.collectionMethod || "WINDOWS_EVENT_LOG"}</strong></div>
                      <div>✓ Host: <strong>{selectedLog.collectorHost || "Windows Machine"}</strong></div>
                      <div>✓ EventRecordID: <strong>{selectedLog.eventRecordId || selectedLog.windowsEventData?.recordId || "N/A"}</strong></div>
                      <div>✓ Provider: <strong>{selectedLog.providerName || selectedLog.windowsEventData?.provider || "Windows"}</strong></div>
                      <div>✓ Channel: <strong>{selectedLog.logName || selectedLog.windowsEventData?.channel || "System"}</strong></div>
                    </div>
                  </div>
                ) : selectedLog.dataOrigin === "SAMPLE" ? (
                  <div
                    style={{
                      background: "rgba(255, 181, 71, 0.08)",
                      border: "1px solid rgba(255, 181, 71, 0.4)",
                      borderRadius: 8,
                      padding: "16px 20px",
                      marginBottom: 20,
                    }}
                  >
                    <div style={{ display: "flex", alignItems: "center", gap: 8, color: "var(--state-investigating)", fontWeight: 800, fontSize: "0.9rem", fontFamily: "var(--font-heading)" }}>
                      <AlertTriangleIcon size={18} />
                      SYNTHETIC DEMONSTRATION DATA (NOT REAL TELEMETRY)
                    </div>
                    <p style={{ margin: "6px 0 0 0", fontSize: "0.8rem", color: "var(--text-secondary)" }}>
                      This security event was synthesized for testing purposes. It did not originate from the Windows operating system kernel.
                    </p>
                  </div>
                ) : (
                  <div
                    style={{
                      background: "rgba(99, 102, 241, 0.08)",
                      border: "1px solid rgba(129, 140, 248, 0.4)",
                      borderRadius: 8,
                      padding: "16px 20px",
                      marginBottom: 20,
                    }}
                  >
                    <div style={{ display: "flex", alignItems: "center", gap: 8, color: "#a5b4fc", fontWeight: 800, fontSize: "0.9rem", fontFamily: "var(--font-heading)" }}>
                      <span>🧪</span> AUTOMATED TEST EVENT
                    </div>
                    <p style={{ margin: "6px 0 0 0", fontSize: "0.8rem", color: "var(--text-secondary)" }}>
                      This event was intentionally injected as part of automated system testing.
                    </p>
                  </div>
                )}

                {/* ── Linked Incident Callout ── */}
                {selectedLog.createdIncidentId && (
                  <div
                    style={{
                      background: "rgba(255, 77, 79, 0.1)",
                      border: "1px solid rgba(255, 77, 79, 0.45)",
                      borderRadius: 8,
                      padding: "14px 18px",
                      marginBottom: 20,
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "space-between",
                      flexWrap: "wrap",
                      gap: 12,
                    }}
                  >
                    <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                      <span style={{ fontSize: "1.25rem" }}>🚨</span>
                      <div>
                        <div style={{ fontSize: "0.72rem", fontWeight: 800, color: "var(--state-critical)", textTransform: "uppercase", fontFamily: "var(--font-mono)" }}>
                          LINKED OPERATIONAL INCIDENT
                        </div>
                        <div style={{ fontSize: "1.05rem", fontWeight: 800, color: "var(--text-primary)", fontFamily: "var(--font-mono)" }}>
                          {selectedLog.createdIncidentId}
                        </div>
                      </div>
                    </div>
                    <Link
                      to={`/admin/incidents/${selectedLog.createdIncidentId}`}
                      style={{
                        padding: "8px 16px",
                        borderRadius: 6,
                        fontSize: "0.8125rem",
                        fontWeight: 700,
                        background: "var(--state-critical)",
                        color: "#080907",
                        textDecoration: "none",
                        display: "inline-flex",
                        alignItems: "center",
                        gap: 6,
                        boxShadow: "0 0 12px rgba(255, 77, 79, 0.35)",
                      }}
                    >
                      <span>Open Incident Workspace</span>
                      <span>→</span>
                    </Link>
                  </div>
                )}

                {/* ── Key Attributes Grid ── */}
                <div
                  style={{
                    display: "grid",
                    gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))",
                    gap: 14,
                    background: "var(--bg-secondary)",
                    padding: 16,
                    borderRadius: 8,
                    border: "1px solid var(--border-subtle)",
                    marginBottom: 20,
                  }}
                >
                  <div>
                    <span style={{ fontSize: "0.72rem", color: "var(--text-muted)", display: "block", fontFamily: "var(--font-mono)" }}>Event Timestamp</span>
                    <strong style={{ fontSize: "0.85rem", color: "var(--text-primary)", fontFamily: "var(--font-mono)" }}>
                      {new Date(selectedLog.timestamp).toLocaleString()}
                    </strong>
                  </div>
                  <div>
                    <span style={{ fontSize: "0.72rem", color: "var(--text-muted)", display: "block", fontFamily: "var(--font-mono)" }}>Ingested / Received At</span>
                    <strong style={{ fontSize: "0.85rem", color: "var(--text-primary)", fontFamily: "var(--font-mono)" }}>
                      {selectedLog.receivedAt ? new Date(selectedLog.receivedAt).toLocaleString() : "N/A"}
                    </strong>
                  </div>
                  <div>
                    <span style={{ fontSize: "0.72rem", color: "var(--text-muted)", display: "block", fontFamily: "var(--font-mono)" }}>Collector Host</span>
                    <strong style={{ fontSize: "0.85rem", color: "var(--text-primary)", fontFamily: "var(--font-mono)" }}>
                      {selectedLog.collectorHost || "N/A"}
                    </strong>
                  </div>
                  <div>
                    <span style={{ fontSize: "0.72rem", color: "var(--text-muted)", display: "block", fontFamily: "var(--font-mono)" }}>Record ID</span>
                    <strong style={{ fontSize: "0.85rem", color: "var(--color-gold)", fontFamily: "var(--font-mono)" }}>
                      {selectedLog.eventRecordId || selectedLog.windowsEventData?.recordId || "N/A"}
                    </strong>
                  </div>
                  <div>
                    <span style={{ fontSize: "0.72rem", color: "var(--text-muted)", display: "block", fontFamily: "var(--font-mono)" }}>Attack Type</span>
                    <strong style={{ fontSize: "0.85rem", color: "var(--text-primary)", fontFamily: "var(--font-mono)" }}>
                      {selectedLog.attackType || "NORMAL"}
                    </strong>
                  </div>
                  <div>
                    <span style={{ fontSize: "0.72rem", color: "var(--text-muted)", display: "block", fontFamily: "var(--font-mono)" }}>Severity & Risk</span>
                    <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 4 }}>
                      <SeverityBadge severity={selectedLog.severity} />
                      <strong style={{ fontSize: "0.82rem", color: "var(--text-primary)", fontFamily: "var(--font-mono)" }}>{selectedLog.riskScore}/100</strong>
                    </div>
                  </div>
                  <div>
                    <span style={{ fontSize: "0.72rem", color: "var(--text-muted)", display: "block", fontFamily: "var(--font-mono)" }}>Network Context</span>
                    <strong style={{ fontSize: "0.8rem", color: "var(--text-primary)", fontFamily: "var(--font-mono)" }}>
                      {selectedLog.sourceIP || "127.0.0.1"} → {selectedLog.destinationIP || "127.0.0.1"} ({selectedLog.protocol || "TCP"})
                    </strong>
                  </div>
                  <div>
                    <span style={{ fontSize: "0.72rem", color: "var(--text-muted)", display: "block", fontFamily: "var(--font-mono)" }}>Incident Pipeline</span>
                    {selectedLog.threat ? (
                      <Link
                        to={`/admin/incidents/${selectedLog.incidentId}`}
                        style={{
                          fontSize: "0.8rem",
                          fontWeight: 700,
                          color: "var(--color-gold)",
                          textDecoration: "underline",
                        }}
                      >
                        View Incident Details ↗
                      </Link>
                    ) : (
                      <span style={{ fontSize: "0.8rem", color: "var(--text-muted)" }}>Normal Telemetry</span>
                    )}
                  </div>
                </div>

                {/* Explanation */}
                {selectedLog.explanation && (
                  <div style={{ marginBottom: 16 }}>
                    <span style={{ fontSize: "0.72rem", fontWeight: 800, color: "var(--color-gold)", textTransform: "uppercase", fontFamily: "var(--font-mono)", letterSpacing: "0.06em" }}>
                      AI Threat Evaluation & Analysis
                    </span>
                    <p style={{ margin: "4px 0 0 0", fontSize: "0.85rem", color: "var(--text-primary)", background: "var(--bg-secondary)", padding: "10px 14px", borderRadius: 6, border: "1px solid var(--border-subtle)", lineHeight: 1.5 }}>
                      {selectedLog.explanation}
                    </p>
                  </div>
                )}

                {/* ── Raw Event Data ── */}
                <div>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
                    <span style={{ fontSize: "0.75rem", fontWeight: 800, color: "var(--text-primary)", textTransform: "uppercase", letterSpacing: "0.06em", fontFamily: "var(--font-mono)" }}>
                      RAW EVENT DATA {selectedLog.dataOrigin === "REAL" ? "(Windows Native XML)" : "(Synthetic JSON)"}
                    </span>
                    <button
                      onClick={() => handleCopyRaw(selectedLog.rawLog || selectedLog.fullLog || selectedLog.message)}
                      style={{
                        display: "inline-flex",
                        alignItems: "center",
                        gap: 6,
                        padding: "4px 10px",
                        borderRadius: 4,
                        fontSize: "0.72rem",
                        fontWeight: 700,
                        background: copiedRaw ? "rgba(54, 214, 174, 0.2)" : "rgba(255, 255, 255, 0.05)",
                        color: copiedRaw ? "var(--state-verified)" : "var(--text-primary)",
                        border: "1px solid var(--border-subtle)",
                        cursor: "pointer",
                      }}
                    >
                      {copiedRaw ? <CheckIcon size={13} /> : <CopyIcon size={13} />}
                      {copiedRaw ? "Copied!" : "Copy Raw Data"}
                    </button>
                  </div>
                  <pre
                    style={{
                      background: "#080907",
                      color: "var(--text-primary)",
                      padding: "16px",
                      borderRadius: 6,
                      fontSize: "0.76rem",
                      fontFamily: "var(--font-mono)",
                      border: "1px solid var(--border-subtle)",
                      overflowX: "auto",
                      maxHeight: 280,
                      whiteSpace: "pre-wrap",
                      wordBreak: "break-all",
                    }}
                  >
                    {selectedLog.rawLog || selectedLog.fullLog || selectedLog.message}
                  </pre>
                </div>
              </div>

              {/* Modal Footer */}
              <div
                style={{
                  padding: "14px 24px",
                  borderTop: "1px solid var(--border-subtle)",
                  display: "flex",
                  justifyContent: "flex-end",
                  background: "var(--bg-secondary)",
                  borderRadius: "0 0 12px 12px",
                }}
              >
                <button
                  onClick={() => setSelectedLog(null)}
                  style={{
                    padding: "8px 18px",
                    borderRadius: 6,
                    fontSize: "0.85rem",
                    fontWeight: 700,
                    fontFamily: "var(--font-heading)",
                    background: "rgba(255, 255, 255, 0.08)",
                    color: "var(--text-primary)",
                    border: "1px solid var(--border-subtle)",
                    cursor: "pointer",
                  }}
                >
                  Close Inspector
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </DashboardLayout>
  );
};

export default LiveSecurityLogs;
