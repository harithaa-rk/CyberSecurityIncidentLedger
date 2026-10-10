import React, { useState, useEffect, useCallback, useRef } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../../context/AuthContext";
import DashboardLayout from "../../layouts/DashboardLayout";
import {
  getIncidents,
  startInvestigation,
} from "../../services/incidentService";
import { getSocket } from "../../services/socket";
import {
  StatusBadge,
  SeverityBadge,
} from "../../components/incident/IncidentDetailsModal";

/* ── Inline SVG Icons ── */
const ShieldIcon = ({ size = 22 }) => (
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

const LogoutIcon = ({ size = 16 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/>
  </svg>
);

const InvestigationIcon = ({ size = 16 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
  </svg>
);

const PlayIcon = ({ size = 14 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor">
    <polygon points="5 3 19 12 5 21 5 3"/>
  </svg>
);

const formatDate = (dateStr) => {
  if (!dateStr) return "—";
  return new Date(dateStr).toLocaleString("en-US", {
    month: "short", day: "numeric",
    hour: "2-digit", minute: "2-digit", second: "2-digit",
    hour12: false,
  });
};

const Incidents = () => {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  const [incidents, setIncidents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [apiError, setApiError] = useState(null);
  const [isConnected, setIsConnected] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("All");
  const [severityFilter, setSeverityFilter] = useState("All");
  const [actionLoadingId, setActionLoadingId] = useState(null);
  const [toastMessage, setToastMessage] = useState(null);

  const socketRef = useRef(null);

  const showToast = (type, msg) => {
    setToastMessage({ type, msg });
    setTimeout(() => setToastMessage(null), 3500);
  };

  const loadAssignedIncidents = useCallback(async () => {
    setLoading(true);
    setApiError(null);
    try {
      // Backend automatically scopes getIncidents to req.user.id for Analyst role
      const res = await getIncidents({
        limit: 100,
        search: searchQuery,
        status: statusFilter,
        severity: severityFilter,
      });

      setIncidents(res.incidents || []);
    } catch (err) {
      console.error("Failed to load analyst incidents:", err);
      setApiError(err.response?.data?.message || "Failed to load assigned incidents.");
    } finally {
      setLoading(false);
    }
  }, [searchQuery, statusFilter, severityFilter]);

  useEffect(() => {
    loadAssignedIncidents();
  }, [loadAssignedIncidents]);

  // WebSocket Live Updates
  useEffect(() => {
    const socket = getSocket();
    socketRef.current = socket;

    const onConnect = () => setIsConnected(true);
    const onDisconnect = () => setIsConnected(false);

    const onIncidentUpdated = (updatedIncident) => {
      setIncidents((prev) => {
        const index = prev.findIndex(
          (inc) =>
            inc._id === updatedIncident._id ||
            inc.incidentId === updatedIncident.incidentId
        );
        if (index !== -1) {
          const next = [...prev];
          next[index] = updatedIncident;
          return next;
        }
        // If newly assigned to this analyst
        const assignedId = updatedIncident.assignedTo?._id || updatedIncident.assignedTo;
        if (assignedId === user?.id) {
          showToast("info", `New incident assigned: ${updatedIncident.incidentId}`);
          return [updatedIncident, ...prev];
        }
        return prev;
      });
    };

    if (socket.connected) setIsConnected(true);

    socket.on("connect", onConnect);
    socket.on("disconnect", onDisconnect);
    socket.on("incident:updated", onIncidentUpdated);

    return () => {
      socket.off("connect", onConnect);
      socket.off("disconnect", onDisconnect);
      socket.off("incident:updated", onIncidentUpdated);
    };
  }, [user?.id]);

  const handleStartInvestigation = async (incident) => {
    const incId = incident.incidentId || incident._id;
    setActionLoadingId(incId);
    try {
      const res = await startInvestigation(incId, {
        notes: "Investigation initiated from Analyst Incident View.",
      });
      showToast("success", `Investigation started for ${incId}`);
      // Update local item
      setIncidents((prev) =>
        prev.map((item) =>
          (item.incidentId === incId || item._id === incId) ? res.incident : item
        )
      );
      // Navigate to investigation view
      navigate(`/analyst/incidents/${incId}`);
    } catch (err) {
      console.error("Failed to start investigation:", err);
      showToast("error", err.response?.data?.message || "Failed to start investigation.");
    } finally {
      setActionLoadingId(null);
    }
  };

  const handleLogout = () => {
    logout();
    navigate("/login");
  };

  // Metrics counts
  const totalAssigned = incidents.length;
  const awaitingCount = incidents.filter((i) => i.status === "ASSIGNED").length;
  const investigatingCount = incidents.filter((i) => i.status === "INVESTIGATING").length;
  const resolvedCount = incidents.filter((i) => i.status === "RESOLVED").length;

  return (
    <DashboardLayout
      activeSection="analyst-incidents"
      title="Assigned Incidents"
      onRefresh={fetchIncidents}
      loading={loading}
      headerActions={
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <div style={{
            display: "flex", alignItems: "center", gap: 6,
            background: isConnected ? "var(--state-verified-bg, rgba(54, 214, 174, 0.12))" : "rgba(255, 77, 79, 0.12)",
            border: `1px solid ${isConnected ? "var(--state-verified-border, rgba(54, 214, 174, 0.4))" : "rgba(255, 77, 79, 0.4)"}`,
            padding: "4px 10px", borderRadius: 20,
            fontSize: "0.72rem", fontWeight: 700, color: isConnected ? "var(--state-verified)" : "var(--state-critical)",
          }}>
            <span style={{
              width: 7, height: 7, borderRadius: "50%",
              background: isConnected ? "var(--state-verified)" : "var(--state-critical)",
              boxShadow: isConnected ? "0 0 6px var(--state-verified)" : "none",
            }} />
            {isConnected ? "Ledger Synced" : "Reconnecting..."}
          </div>
        </div>
      }
    >
      {/* Toast */}
      {toastMessage && (
        <div style={{
          position: "fixed", bottom: 24, right: 24, zIndex: 9999,
          background: toastMessage.type === "success" ? "#064e3b" : toastMessage.type === "error" ? "#7f1d1d" : "var(--bg-surface)",
          color: "#fff", borderRadius: 10, padding: "12px 20px",
          fontSize: "0.9rem", fontWeight: 600, boxShadow: "var(--shadow-obsidian)",
          border: `1px solid ${toastMessage.type === "success" ? "rgba(54, 214, 174, 0.4)" : toastMessage.type === "error" ? "rgba(255, 77, 79, 0.4)" : "var(--color-gold-border)"}`,
          display: "flex", alignItems: "center", gap: 10,
        }}>
          <span>{toastMessage.type === "success" ? "✓" : toastMessage.type === "error" ? "⚠" : "ℹ"}</span>
          {toastMessage.msg}
        </div>
      )}

      {/* Main Content */}
      <div style={{ maxWidth: 1320, margin: "0 auto", padding: "0.5rem 0" }}>
        {/* Page Title */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end", marginBottom: "1.75rem", flexWrap: "wrap", gap: 12 }}>
          <div>
            <h1 style={{ margin: 0, fontSize: "1.85rem", fontWeight: 800, color: "var(--text-primary, #F2F2EA)", fontFamily: "var(--font-heading, 'Space Grotesk', sans-serif)" }}>
              Assigned Threat Incidents
            </h1>
            <p style={{ margin: "4px 0 0", color: "var(--text-secondary, #9B9D91)", fontSize: "0.9375rem" }}>
              Active investigative queue filtered for authenticated account ({user?.email}).
            </p>
          </div>
          <button
            onClick={loadAssignedIncidents}
            disabled={loading}
            style={{
              display: "flex", alignItems: "center", gap: 8,
              background: "var(--bg-surface, #141610)", color: "var(--text-primary, #F2F2EA)",
              border: "1px solid var(--border-subtle, #292B22)",
              borderRadius: 8, padding: "8px 16px", fontWeight: 700, fontSize: "0.875rem", cursor: "pointer",
            }}
          >
            <RefreshIcon />
            {loading ? "Refreshing..." : "Refresh Queue"}
          </button>
        </div>

        {/* Metrics Cards */}
        <div style={{
          display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
          gap: "1.25rem", marginBottom: "2rem",
        }}>
          <div style={{ background: "var(--bg-surface, #141610)", borderRadius: 12, padding: "1.25rem", border: "1px solid var(--border-subtle, #292B22)", boxShadow: "0 6px 20px rgba(0,0,0,0.5)" }}>
            <div style={{ fontSize: "0.75rem", fontWeight: 700, color: "var(--text-secondary, #9B9D91)", textTransform: "uppercase", letterSpacing: "0.06em", fontFamily: "var(--font-heading, 'Space Grotesk', sans-serif)" }}>Total Assigned</div>
            <div style={{ fontSize: "2rem", fontWeight: 800, color: "var(--color-gold, #F4C542)", marginTop: 6, fontFamily: "var(--font-mono, 'JetBrains Mono', monospace)" }}>{totalAssigned}</div>
            <div style={{ fontSize: "0.75rem", color: "var(--text-muted, #686B60)", marginTop: 4 }}>Incidents under your purview</div>
          </div>

          <div style={{ background: "var(--bg-surface, #141610)", borderRadius: 12, padding: "1.25rem", border: "1px solid rgba(147, 51, 234, 0.4)", borderLeft: "4px solid #a855f7", boxShadow: "0 6px 20px rgba(0,0,0,0.5)" }}>
            <div style={{ fontSize: "0.75rem", fontWeight: 700, color: "#c084fc", textTransform: "uppercase", letterSpacing: "0.06em", fontFamily: "var(--font-heading, 'Space Grotesk', sans-serif)" }}>Awaiting Investigation</div>
            <div style={{ fontSize: "2rem", fontWeight: 800, color: "#c084fc", marginTop: 6, fontFamily: "var(--font-mono, 'JetBrains Mono', monospace)" }}>{awaitingCount}</div>
            <div style={{ fontSize: "0.75rem", color: "var(--text-muted, #686B60)", marginTop: 4 }}>Status: ASSIGNED</div>
          </div>

          <div style={{ background: "var(--bg-surface, #141610)", borderRadius: 12, padding: "1.25rem", border: "1px solid rgba(255, 181, 71, 0.4)", borderLeft: "4px solid #FFB547", boxShadow: "0 6px 20px rgba(0,0,0,0.5)" }}>
            <div style={{ fontSize: "0.75rem", fontWeight: 700, color: "#FFB547", textTransform: "uppercase", letterSpacing: "0.06em", fontFamily: "var(--font-heading, 'Space Grotesk', sans-serif)" }}>Under Investigation</div>
            <div style={{ fontSize: "2rem", fontWeight: 800, color: "#FFB547", marginTop: 6, fontFamily: "var(--font-mono, 'JetBrains Mono', monospace)" }}>{investigatingCount}</div>
            <div style={{ fontSize: "0.75rem", color: "var(--text-muted, #686B60)", marginTop: 4 }}>Status: INVESTIGATING</div>
          </div>

          <div style={{ background: "var(--bg-surface, #141610)", borderRadius: 12, padding: "1.25rem", border: "1px solid rgba(54, 214, 174, 0.4)", borderLeft: "4px solid #36D6AE", boxShadow: "0 6px 20px rgba(0,0,0,0.5)" }}>
            <div style={{ fontSize: "0.75rem", fontWeight: 700, color: "#36D6AE", textTransform: "uppercase", letterSpacing: "0.06em", fontFamily: "var(--font-heading, 'Space Grotesk', sans-serif)" }}>Resolved & Sealed</div>
            <div style={{ fontSize: "2rem", fontWeight: 800, color: "#36D6AE", marginTop: 6, fontFamily: "var(--font-mono, 'JetBrains Mono', monospace)" }}>{resolvedCount}</div>
            <div style={{ fontSize: "0.75rem", color: "var(--text-muted, #686B60)", marginTop: 4 }}>Status: RESOLVED</div>
          </div>
        </div>

        {/* Filter Controls */}
        <div style={{
          background: "var(--bg-surface, #141610)", borderRadius: 12, padding: "1rem 1.25rem",
          border: "1px solid var(--border-subtle, #292B22)", marginBottom: "1.5rem",
          display: "flex", flexWrap: "wrap", gap: 12, alignItems: "center", justifyContent: "space-between",
        }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, flex: "1 1 280px", position: "relative" }}>
            <SearchIcon />
            <input
              type="text"
              placeholder="Search by ID, Attack Type, IP..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              style={{
                width: "100%", padding: "8px 12px", borderRadius: 8,
                background: "var(--bg-secondary, #0D0F0C)", color: "var(--text-primary, #F2F2EA)",
                border: "1px solid var(--border-subtle, #292B22)", fontSize: "0.875rem", fontFamily: "inherit",
              }}
            />
          </div>

          <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              style={{
                padding: "8px 12px", borderRadius: 8,
                background: "var(--bg-secondary, #0D0F0C)", color: "var(--text-primary, #F2F2EA)",
                border: "1px solid var(--border-subtle, #292B22)", fontSize: "0.875rem", fontFamily: "inherit",
              }}
            >
              <option value="All">⚡ Active Incidents (Default)</option>
              <option value="ASSIGNED">Assigned (Ready)</option>
              <option value="INVESTIGATING">Investigating (In Progress)</option>
              <option value="RESOLVED">Resolved</option>
              <option value="ARCHIVED">📦 Archived (Read-Only)</option>
            </select>

            <select
              value={severityFilter}
              onChange={(e) => setSeverityFilter(e.target.value)}
              style={{
                padding: "8px 12px", borderRadius: 8,
                background: "var(--bg-secondary, #0D0F0C)", color: "var(--text-primary, #F2F2EA)",
                border: "1px solid var(--border-subtle, #292B22)", fontSize: "0.875rem", fontFamily: "inherit",
              }}
            >
              <option value="All">All Severities</option>
              <option value="CRITICAL">Critical</option>
              <option value="HIGH">High</option>
              <option value="MEDIUM">Medium</option>
              <option value="LOW">Low</option>
            </select>
          </div>
        </div>

        {/* Error Alert */}
        {apiError && (
          <div style={{
            background: "rgba(255, 77, 79, 0.12)", border: "1px solid rgba(255, 77, 79, 0.4)", color: "#FF4D4F",
            borderRadius: 10, padding: "1rem", marginBottom: "1.5rem", fontSize: "0.875rem",
          }}>
            {apiError}
          </div>
        )}

        {/* Incidents Table / Cards */}
        {loading ? (
          <div style={{ textAlign: "center", padding: "4rem 0", color: "var(--text-secondary, #9B9D91)" }}>
            <div style={{
              width: 36, height: 36, border: "3px solid #292B22", borderTopColor: "#F4C542",
              borderRadius: "50%", margin: "0 auto 12px", animation: "spin 0.7s linear infinite",
            }} />
            Loading assigned incident stream...
          </div>
        ) : incidents.length === 0 ? (
          <div style={{
            background: "var(--bg-surface, #141610)", borderRadius: 14, padding: "3.5rem 2rem",
            textAlign: "center", border: "1px dashed var(--border-subtle, #292B22)",
          }}>
            <ShieldIcon size={44} />
            <h3 style={{ fontSize: "1.25rem", fontWeight: 700, color: "var(--text-primary, #F2F2EA)", margin: "1rem 0 0.5rem", fontFamily: "var(--font-heading, 'Space Grotesk', sans-serif)" }}>
              No Incidents Assigned
            </h3>
            <p style={{ color: "var(--text-secondary, #9B9D91)", fontSize: "0.9375rem", maxWidth: 460, margin: "0 auto" }}>
              You currently have no security incidents assigned. When an Administrator assigns a new threat to your account, it will appear here in real-time.
            </p>
          </div>
        ) : (
          <div style={{
            background: "var(--bg-surface, #141610)", borderRadius: 14, border: "1px solid var(--border-subtle, #292B22)",
            overflow: "hidden", boxShadow: "0 8px 32px rgba(0,0,0,0.6)",
          }}>
            <div style={{ overflowX: "auto" }}>
              <table style={{ width: "100%", borderCollapse: "collapse", textAlign: "left", fontSize: "0.875rem" }}>
                <thead>
                  <tr style={{ background: "var(--bg-secondary, #0D0F0C)", borderBottom: "1px solid var(--border-subtle, #292B22)", color: "var(--text-secondary, #9B9D91)", fontWeight: 700, fontFamily: "var(--font-heading, 'Space Grotesk', sans-serif)" }}>
                    <th style={{ padding: "14px 16px" }}>Incident ID</th>
                    <th style={{ padding: "14px 16px" }}>Severity</th>
                    <th style={{ padding: "14px 16px" }}>Attack Type</th>
                    <th style={{ padding: "14px 16px" }}>Status</th>
                    <th style={{ padding: "14px 16px" }}>Risk</th>
                    <th style={{ padding: "14px 16px" }}>Assigned At</th>
                    <th style={{ padding: "14px 16px" }}>Assigned By</th>
                    <th style={{ padding: "14px 16px", textAlign: "right" }}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {incidents.map((inc) => {
                    const incId = inc.incidentId || inc._id;
                    const isAssigned = inc.status === "ASSIGNED";
                    const isInvestigating = inc.status === "INVESTIGATING";

                    return (
                      <tr key={inc._id} style={{ borderBottom: "1px solid #1E2019", transition: "background 0.15s" }}>
                        <td style={{ padding: "14px 16px", fontWeight: 700, fontFamily: "var(--font-mono, 'JetBrains Mono', monospace)", color: "var(--text-primary, #F2F2EA)" }}>
                          <Link to={`/analyst/incidents/${incId}`} style={{ color: "var(--color-gold, #F4C542)", textDecoration: "none" }}>
                            {incId}
                          </Link>
                          <div style={{ fontSize: "0.75rem", color: "var(--text-secondary, #9B9D91)", fontFamily: "sans-serif", fontWeight: 500, marginTop: 2 }}>
                            {inc.title}
                          </div>
                        </td>

                        <td style={{ padding: "14px 16px" }}>
                          <SeverityBadge severity={inc.severity} />
                        </td>

                        <td style={{ padding: "14px 16px" }}>
                          <span style={{ fontWeight: 600, color: "var(--text-primary, #F2F2EA)" }}>{inc.attackType}</span>
                          <div style={{ fontSize: "0.75rem", color: "var(--text-muted, #686B60)" }}>{inc.threatCategory || "General"}</div>
                        </td>

                        <td style={{ padding: "14px 16px" }}>
                          <StatusBadge status={inc.status} />
                        </td>

                        <td style={{ padding: "14px 16px" }}>
                          <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                            <span style={{ fontWeight: 800, fontFamily: "var(--font-mono, 'JetBrains Mono', monospace)", color: inc.riskScore >= 70 ? "#FF4D4F" : inc.riskScore >= 40 ? "#FFB547" : "#36D6AE" }}>
                              {inc.riskScore}
                            </span>
                            <div style={{ width: 44, height: 6, background: "#1E2019", borderRadius: 3, overflow: "hidden" }}>
                              <div style={{
                                width: `${inc.riskScore}%`, height: "100%",
                                background: inc.riskScore >= 70 ? "#FF4D4F" : inc.riskScore >= 40 ? "#FFB547" : "#36D6AE",
                              }} />
                            </div>
                          </div>
                        </td>

                        <td style={{ padding: "14px 16px", color: "var(--text-secondary, #9B9D91)", fontSize: "0.8125rem", fontFamily: "var(--font-mono, 'JetBrains Mono', monospace)" }}>
                          {formatDate(inc.assignedAt || inc.createdAt)}
                        </td>

                        <td style={{ padding: "14px 16px", color: "var(--text-primary, #F2F2EA)", fontSize: "0.8125rem" }}>
                          {inc.assignedBy?.name || "Admin"}
                        </td>

                        <td style={{ padding: "14px 16px", textAlign: "right" }}>
                          <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
                            {/* If status is ASSIGNED, provide one-click Start Investigation */}
                            {isAssigned && (
                              <button
                                onClick={() => handleStartInvestigation(inc)}
                                disabled={actionLoadingId === incId}
                                style={{
                                  display: "inline-flex", alignItems: "center", gap: 5,
                                  background: "linear-gradient(135deg, #F4C542 0%, #B58B20 100%)",
                                  color: "#080907", border: "none", borderRadius: 8,
                                  padding: "6px 12px", fontSize: "0.8125rem", fontWeight: 800,
                                  cursor: "pointer", boxShadow: "0 2px 8px rgba(244, 197, 66, 0.3)",
                                }}
                              >
                                <PlayIcon />
                                {actionLoadingId === incId ? "Starting..." : "Start Investigation"}
                              </button>
                            )}

                            {/* View / Investigate Link */}
                            <Link
                              to={`/analyst/incidents/${incId}`}
                              style={{
                                display: "inline-flex", alignItems: "center", gap: 5,
                                background: isInvestigating ? "rgba(255, 181, 71, 0.12)" : "rgba(242, 242, 234, 0.06)",
                                color: isInvestigating ? "#FFB547" : "var(--text-primary, #F2F2EA)",
                                border: isInvestigating ? "1px solid rgba(255, 181, 71, 0.4)" : "1px solid var(--border-subtle, #292B22)",
                                borderRadius: 8, padding: "6px 12px", fontSize: "0.8125rem",
                                fontWeight: 700, textDecoration: "none",
                              }}
                            >
                              <InvestigationIcon size={13} />
                              {isInvestigating ? "Active Investigation" : "View Details"}
                            </Link>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </DashboardLayout>
  );
};

export default Incidents;
