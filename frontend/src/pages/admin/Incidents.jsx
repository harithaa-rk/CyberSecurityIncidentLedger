import React, { useState, useEffect, useCallback, useRef } from "react";
import { Link, useParams, useNavigate } from "react-router-dom";
import { useAuth } from "../../context/AuthContext";
import DashboardLayout from "../../layouts/DashboardLayout";
import {
  getIncidents,
  getIncidentById,
  getEligibleAnalysts,
  assignIncident,
  investigateIncident,
  resolveIncident,
  archiveIncident,
} from "../../services/incidentService";
import { getSocket } from "../../services/socket";
import IncidentDetailsModal, {
  StatusBadge,
  SeverityBadge,
} from "../../components/incident/IncidentDetailsModal";
import {
  AssignModal,
  InvestigateModal,
  ResolveModal,
  ArchiveModal,
} from "../../components/incident/IncidentActionModals";

/* ── Inline SVG Icons ── */
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

const BackIcon = ({ size = 16 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <line x1="19" y1="12" x2="5" y2="12"/><polyline points="12 19 5 12 12 5"/>
  </svg>
);

const EyeIcon = ({ size = 14 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/>
  </svg>
);

const UserIcon = ({ size = 13 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/>
  </svg>
);

const BoltIcon = ({ size = 13 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/>
  </svg>
);

const CheckCircleIcon = ({ size = 13 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/>
  </svg>
);

const ArchiveIcon = ({ size = 13 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="21 8 21 21 3 21 3 8"/><rect x="1" y="3" width="22" height="5"/><line x1="10" y1="12" x2="14" y2="12"/>
  </svg>
);

const CopyIcon = ({ size = 11 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <rect x="9" y="9" width="13" height="13" rx="2" ry="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/>
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
  const { user } = useAuth();
  const { id: routeIncidentId } = useParams();
  const navigate = useNavigate();

  /* ── State ── */
  const [incidents, setIncidents] = useState([]);
  const [pagination, setPagination] = useState({ page: 1, total: 0, totalPages: 1, limit: 20 });
  const [stats, setStats] = useState({
    total: 0, new: 0, assigned: 0, investigating: 0,
    resolved: 0, archived: 0, critical: 0, high: 0,
  });
  const [analysts, setAnalysts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [apiError, setApiError] = useState(null);
  const [isConnected, setIsConnected] = useState(false);
  const [newEventFlash, setNewEventFlash] = useState(null);
  const [toastMessage, setToastMessage] = useState(null);
  const [liveEventToast, setLiveEventToast] = useState(null);
  const [copiedKey, setCopiedKey] = useState(null);
  const [actionLoading, setActionLoading] = useState(false);

  /* ── Modals State ── */
  const [detailModalIncident, setDetailModalIncident] = useState(null);
  const [assignModalIncident, setAssignModalIncident] = useState(null);
  const [investigateModalIncident, setInvestigateModalIncident] = useState(null);
  const [resolveModalIncident, setResolveModalIncident] = useState(null);
  const [archiveModalIncident, setArchiveModalIncident] = useState(null);

  /* ── Filters & Search & Sort ── */
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("All");
  const [severityFilter, setSeverityFilter] = useState("All");
  const [attackTypeFilter, setAttackTypeFilter] = useState("All");
  const [threatCategoryFilter, setThreatCategoryFilter] = useState("All");
  const [analystFilter, setAnalystFilter] = useState("All");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [sortBy, setSortBy] = useState("newest"); // newest | oldest | risk | severity

  const toastTimerRef = useRef(null);

  /* Toast Helper */
  const showToast = (type, msg) => {
    setToastMessage({ type, msg });
    setTimeout(() => setToastMessage(null), 3500);
  };

  /* Live Event Toast */
  const showLiveIncidentToast = (incident) => {
    if (toastTimerRef.current) clearTimeout(toastTimerRef.current);
    setLiveEventToast(incident);
    toastTimerRef.current = setTimeout(() => setLiveEventToast(null), 6500);
  };

  /* Copy to clipboard */
  const handleCopy = (text, key) => {
    navigator.clipboard.writeText(text);
    setCopiedKey(key);
    setTimeout(() => setCopiedKey(null), 2000);
  };

  /* Fetch Analysts */
  const fetchAnalysts = useCallback(async () => {
    try {
      const res = await getEligibleAnalysts();
      setAnalysts(res.analysts || []);
    } catch (err) {
      console.warn("Could not load analyst directory:", err);
    }
  }, []);

  /* Fetch Incidents */
  const fetchIncidentsData = useCallback(async (page = 1) => {
    setLoading(true);
    setApiError(null);
    try {
      const data = await getIncidents({
        page,
        limit: 20,
        status: statusFilter,
        severity: severityFilter,
        attackType: attackTypeFilter,
        threatCategory: threatCategoryFilter,
        assignedTo: analystFilter,
        startDate,
        endDate,
        search: searchQuery,
        sort: sortBy,
      });

      setIncidents(data.incidents || []);
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
      console.error("Failed to fetch incidents:", err);
      setApiError("Failed to communicate with Incident Management API. Please check connection.");
      showToast("error", "Failed to fetch incidents.");
    } finally {
      setLoading(false);
    }
  }, [
    statusFilter,
    severityFilter,
    attackTypeFilter,
    threatCategoryFilter,
    analystFilter,
    startDate,
    endDate,
    searchQuery,
    sortBy,
  ]);

  useEffect(() => {
    fetchIncidentsData(1);
  }, [fetchIncidentsData]);

  useEffect(() => {
    fetchAnalysts();
  }, [fetchAnalysts]);

  /* Handle Deep-Linking Route: /admin/incidents/:id */
  useEffect(() => {
    if (routeIncidentId) {
      getIncidentById(routeIncidentId)
        .then((res) => {
          if (res?.incident) {
            setDetailModalIncident(res.incident);
          }
        })
        .catch((err) => {
          console.warn("Could not load route incident:", err);
        });
    }
  }, [routeIncidentId]);

  /* ── Socket.IO Real-Time Stream Listener ── */
  useEffect(() => {
    const socket = getSocket();

    const handleConnect = () => setIsConnected(true);
    const handleDisconnect = () => setIsConnected(false);

    // 1. New Incident Emitted
    const handleNewIncident = (newInc) => {
      console.log("[SOCKET] Real-time incident:new received:", newInc.incidentId);

      // Prepend to incidents table immediately without refreshing browser
      setIncidents((prev) => {
        const exists = prev.some((i) => i.incidentId === newInc.incidentId || i._id === newInc._id);
        if (exists) return prev;
        return [newInc, ...prev.slice(0, 49)];
      });

      // Update counters immediately
      setStats((prev) => {
        const sev = (newInc.severity || "LOW").toUpperCase();
        return {
          ...prev,
          total: prev.total + 1,
          new: prev.new + 1,
          critical: sev === "CRITICAL" ? prev.critical + 1 : prev.critical,
          high:     sev === "HIGH"     ? prev.high + 1     : prev.high,
        };
      });

      // Highlight new row
      setNewEventFlash(newInc.incidentId);
      setTimeout(() => setNewEventFlash(null), 3500);

      // Notification
      showLiveIncidentToast(newInc);
    };

    // 2. Incident Status/Assignment Updated
    const handleIncidentUpdated = (updatedInc) => {
      console.log("[SOCKET] Real-time incident:updated received:", updatedInc.incidentId);

      setIncidents((prev) =>
        prev.map((i) =>
          i.incidentId === updatedInc.incidentId || i._id === updatedInc._id ? updatedInc : i
        )
      );

      // If viewing detail modal, keep it updated
      setDetailModalIncident((cur) => {
        if (cur && (cur.incidentId === updatedInc.incidentId || cur._id === updatedInc._id)) {
          return updatedInc;
        }
        return cur;
      });

      // Re-fetch stats in background
      fetchIncidentsData(pagination.page);
    };

    setIsConnected(socket.connected);
    socket.on("connect", handleConnect);
    socket.on("disconnect", handleDisconnect);
    socket.on("incident:new", handleNewIncident);
    socket.on("incident:updated", handleIncidentUpdated);

    return () => {
      socket.off("connect", handleConnect);
      socket.off("disconnect", handleDisconnect);
      socket.off("incident:new", handleNewIncident);
      socket.off("incident:updated", handleIncidentUpdated);
    };
  }, [fetchIncidentsData, pagination.page]);

  /* ── Action Handlers ── */
  const handleAssignSubmit = async ({ analystId, note }) => {
    if (!assignModalIncident) return;
    const id = assignModalIncident.incidentId || assignModalIncident._id;
    setActionLoading(true);
    try {
      const res = await assignIncident(id, { analystId, note });
      showToast("success", res.message || "Incident assignment updated.");
      setAssignModalIncident(null);
      fetchIncidentsData(pagination.page);
    } catch (err) {
      showToast("error", err.response?.data?.message || "Failed to assign incident.");
    } finally {
      setActionLoading(false);
    }
  };

  const handleInvestigateSubmit = async ({ notes }) => {
    if (!investigateModalIncident) return;
    const id = investigateModalIncident.incidentId || investigateModalIncident._id;
    setActionLoading(true);
    try {
      const res = await investigateIncident(id, { notes });
      showToast("success", res.message || "Investigation status activated.");
      setInvestigateModalIncident(null);
      fetchIncidentsData(pagination.page);
    } catch (err) {
      showToast("error", err.response?.data?.message || "Failed to start investigation.");
    } finally {
      setActionLoading(false);
    }
  };

  const handleResolveSubmit = async ({ resolutionSummary, rootCause, actionTaken }) => {
    if (!resolveModalIncident) return;
    const id = resolveModalIncident.incidentId || resolveModalIncident._id;
    setActionLoading(true);
    try {
      const res = await resolveIncident(id, { resolutionSummary, rootCause, actionTaken });
      showToast("success", res.message || "Incident resolved successfully.");
      setResolveModalIncident(null);
      fetchIncidentsData(pagination.page);
    } catch (err) {
      showToast("error", err.response?.data?.message || "Failed to resolve incident.");
    } finally {
      setActionLoading(false);
    }
  };

  const handleArchiveSubmit = async ({ note }) => {
    if (!archiveModalIncident) return;
    const id = archiveModalIncident.incidentId || archiveModalIncident._id;
    setActionLoading(true);
    try {
      const res = await archiveIncident(id, { note });
      showToast("success", res.message || "Incident archived successfully.");
      setArchiveModalIncident(null);
      fetchIncidentsData(pagination.page);
    } catch (err) {
      showToast("error", err.response?.data?.message || "Failed to archive incident.");
    } finally {
      setActionLoading(false);
    }
  };

  /* Reset Filters */
  const handleResetFilters = () => {
    setSearchQuery("");
    setStatusFilter("All");
    setSeverityFilter("All");
    setAttackTypeFilter("All");
    setThreatCategoryFilter("All");
    setAnalystFilter("All");
    setStartDate("");
    setEndDate("");
    setSortBy("newest");
  };

  /* Quick Summary Card Filter */
  const handleCardFilter = (key, val) => {
    if (key === "status") {
      setStatusFilter((cur) => (cur === val ? "All" : val));
    } else if (key === "severity") {
      setSeverityFilter((cur) => (cur === val ? "All" : val));
    } else if (key === "assignedTo") {
      setAnalystFilter((cur) => (cur === val ? "All" : val));
    }
  };

  const userRole = user?.role || "Admin";
  const canManage = userRole === "Admin" || userRole === "Analyst";
  const isAdmin = userRole === "Admin";

  /* Summary Card Definitions */
  const summaryCards = [
    { label: "Total Incidents", val: stats.total, color: "var(--text-primary)", accent: "var(--color-gold)", icon: "📊" },
    { label: "Waiting Assign", val: stats.new, color: "var(--state-critical)", accent: "var(--state-critical)", icon: "⏳", filterKey: "assignedTo", filterVal: "unassigned" },
    { label: "New Status", val: stats.new, color: "#818cf8", accent: "#6366f1", icon: "✨", filterKey: "status", filterVal: "NEW" },
    { label: "Assigned", val: stats.assigned, color: "#c084fc", accent: "#a855f7", icon: "👤", filterKey: "status", filterVal: "ASSIGNED" },
    { label: "Investigating", val: stats.investigating, color: "var(--state-investigating)", accent: "var(--state-investigating)", icon: "🔍", filterKey: "status", filterVal: "INVESTIGATING" },
    { label: "Resolved", val: stats.resolved, color: "var(--state-verified)", accent: "var(--state-verified)", icon: "✅", filterKey: "status", filterVal: "RESOLVED" },
    { label: "Archived", val: stats.archived, color: "var(--text-secondary)", accent: "var(--border-subtle)", icon: "📦", filterKey: "status", filterVal: "ARCHIVED" },
    { label: "Critical", val: stats.critical, color: "var(--state-critical)", accent: "var(--state-critical)", icon: "🚨", filterKey: "severity", filterVal: "CRITICAL" },
    { label: "High Risk", val: stats.high, color: "#fb923c", accent: "#ea580c", icon: "⚠️", filterKey: "severity", filterVal: "HIGH" },
  ];

  return (
    <>
      <style>{`
        @keyframes newRowFlash { 0% { background-color: rgba(244, 197, 66, 0.25); } 100% { background-color: transparent; } }
        @keyframes toastSlideIn { from { transform: translateY(-20px) scale(0.95); opacity: 0; } to { transform: translateY(0) scale(1); opacity: 1; } }
        .incident-table tr:hover td { background-color: rgba(244, 197, 66, 0.04); }
        .row-flash { animation: newRowFlash 2.5s ease-out; }
        .stat-card-btn {
          cursor: pointer; text-align: left; border-radius: 8px; padding: 14px 16px;
          transition: all 0.2s ease; border: 1px solid var(--border-subtle); background: var(--bg-surface);
          font-family: inherit;
        }
        .stat-card-btn:hover { transform: translateY(-2px); border-color: var(--color-gold-border); box-shadow: 0 4px 16px rgba(0,0,0,0.5); }
        .filter-select {
          padding: 8px 12px; border-radius: 6px; border: 1px solid var(--border-subtle);
          font-size: 0.8125rem; font-family: inherit; background: var(--bg-secondary); color: var(--text-primary); font-weight: 600;
        }
        .filter-select:focus { border-color: var(--color-gold); outline: none; }
        .table-action-btn {
          border: 1px solid var(--border-subtle); border-radius: 4px; padding: 4px 8px; font-size: 0.72rem;
          font-weight: 700; cursor: pointer; display: inline-flex; align-items: center;
          gap: 4px; font-family: var(--font-mono); transition: all 0.15s; background: rgba(255, 255, 255, 0.04);
          color: var(--text-primary);
        }
        .table-action-btn:hover { border-color: var(--color-gold); color: var(--color-gold); }
      `}</style>

      <DashboardLayout
        activeSection="incidents"
        title="Incident Command"
        onRefresh={() => fetchIncidentsData(pagination.page)}
        loading={loading}
        headerActions={
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            {/* Live Indicator */}
            <div style={{
              display: "flex", alignItems: "center", gap: 6,
              background: isConnected ? "var(--state-verified-bg, rgba(54, 214, 174, 0.12))" : "rgba(255, 77, 79, 0.12)",
              border: `1px solid ${isConnected ? "var(--state-verified-border, rgba(54, 214, 174, 0.4))" : "rgba(255, 77, 79, 0.4)"}`,
              padding: "4px 10px", borderRadius: 20, fontSize: "0.72rem", fontWeight: 800,
              color: isConnected ? "var(--state-verified)" : "var(--state-critical)", letterSpacing: "0.05em",
              fontFamily: "var(--font-mono)",
            }}>
              {isConnected ? "🟢 LIVE" : "🔴 OFFLINE"}
            </div>

            {/* Refresh Button */}
            <button
              onClick={() => fetchIncidentsData(pagination.page)}
              disabled={loading}
              style={{
                display: "inline-flex", alignItems: "center", gap: 6,
                background: "var(--color-gold)", color: "var(--text-inverse)",
                border: "none", borderRadius: 8, padding: "6px 12px",
                fontSize: "0.78rem", fontWeight: 800, cursor: loading ? "not-allowed" : "pointer",
                fontFamily: "var(--font-heading)",
                boxShadow: "0 0 10px var(--color-gold-glow)",
              }}
            >
              <RefreshIcon size={13} /> {loading ? "Syncing..." : "Sync"}
            </button>
          </div>
        }
      >
        {/* ── Main Container ── */}
        <div style={{ maxWidth: 1440, margin: "0 auto", padding: "0.5rem 0" }}>

          {/* ── 1. SUMMARY CARDS (8 CARDS) ── */}
          <div style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(135px, 1fr))",
            gap: 12, marginBottom: "1.75rem",
          }}>
            {summaryCards.map((c, i) => {
              const isSelected =
                (c.filterKey === "status" && statusFilter === c.filterVal) ||
                (c.filterKey === "severity" && severityFilter === c.filterVal) ||
                (c.filterKey === "assignedTo" && analystFilter === c.filterVal);

              return (
                <button
                  key={i}
                  className="stat-card-btn"
                  onClick={() => c.filterKey && handleCardFilter(c.filterKey, c.filterVal)}
                  style={{
                    borderColor: isSelected ? "var(--color-gold)" : "var(--border-subtle)",
                    boxShadow: isSelected ? `0 0 12px rgba(244, 197, 66, 0.3)` : "0 2px 8px rgba(0,0,0,0.3)",
                  }}
                >
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
                    <span style={{ fontSize: "0.72rem", fontWeight: 800, color: "var(--text-secondary)", fontFamily: "var(--font-mono)" }}>
                      {c.label}
                    </span>
                    <span style={{ fontSize: "0.95rem" }}>{c.icon}</span>
                  </div>
                  <div style={{ fontSize: "1.65rem", fontWeight: 900, color: c.color, fontFamily: "var(--font-mono)" }}>
                    {c.val}
                  </div>
                </button>
              );
            })}
          </div>

          {/* ── 2. SEARCH & FILTERS TOOLBAR ── */}
          <div style={{
            background: "var(--bg-surface)", borderRadius: 8, padding: "1.25rem 1.5rem",
            marginBottom: "1.5rem", border: "1px solid var(--border-subtle)",
            boxShadow: "0 4px 16px rgba(0,0,0,0.3)",
          }}>
            {/* Row 1: Search Bar & Sort */}
            <div style={{ display: "flex", gap: 12, alignItems: "center", flexWrap: "wrap", marginBottom: "1rem" }}>
              {/* Search */}
              <div style={{
                flex: 1, minWidth: 280, display: "flex", alignItems: "center", gap: 10,
                background: "#f8fafc", border: "1px solid #cbd5e1", borderRadius: 8,
                padding: "8px 14px",
              }}>
                <span style={{ color: "#64748b" }}><SearchIcon /></span>
                <input
                  type="text"
                  placeholder="Search by Incident ID, Threat Title, Attack Type, Source IP..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  style={{
                    border: "none", background: "transparent", outline: "none",
                    width: "100%", fontSize: "0.875rem", fontFamily: "inherit",
                  }}
                />
                {searchQuery && (
                  <button
                    onClick={() => setSearchQuery("")}
                    style={{ background: "none", border: "none", color: "#94a3b8", cursor: "pointer", fontSize: "0.9rem" }}
                  >
                    ✕
                  </button>
                )}
              </div>

              {/* Sort By */}
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <span style={{ fontSize: "0.8125rem", fontWeight: 700, color: "#64748b" }}>Sort:</span>
                <select
                  className="filter-select"
                  value={sortBy}
                  onChange={(e) => setSortBy(e.target.value)}
                >
                  <option value="newest">🕒 Newest First</option>
                  <option value="oldest">⌛ Oldest First</option>
                  <option value="risk">🔥 Highest Risk</option>
                  <option value="severity">🚨 Highest Severity</option>
                </select>
              </div>

              {/* Reset button */}
              <button
                onClick={handleResetFilters}
                style={{
                  background: "#f1f5f9", color: "#475569", border: "1px solid #cbd5e1",
                  borderRadius: 8, padding: "8px 14px", fontSize: "0.8125rem",
                  fontWeight: 700, cursor: "pointer", fontFamily: "inherit",
                }}
              >
                Reset Filters
              </button>
            </div>

            {/* Row 2: Detailed Filters */}
            <div style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center" }}>
              {/* Status Filter */}
              <select
                className="filter-select"
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
              >
                <option value="All">⚡ Active Incidents (Default)</option>
                <option value="NEW">✨ NEW</option>
                <option value="ASSIGNED">👤 ASSIGNED</option>
                <option value="INVESTIGATING">🔍 INVESTIGATING</option>
                <option value="RESOLVED">✅ RESOLVED</option>
                <option value="ARCHIVED">📦 ARCHIVED (Historical)</option>
              </select>

              {/* Severity Filter */}
              <select
                className="filter-select"
                value={severityFilter}
                onChange={(e) => setSeverityFilter(e.target.value)}
              >
                <option value="All">All Severities</option>
                <option value="CRITICAL">🚨 CRITICAL</option>
                <option value="HIGH">⚠️ HIGH</option>
                <option value="MEDIUM">⚡ MEDIUM</option>
                <option value="LOW">ℹ️ LOW</option>
              </select>

              {/* Attack Type Filter */}
              <select
                className="filter-select"
                value={attackTypeFilter}
                onChange={(e) => setAttackTypeFilter(e.target.value)}
              >
                <option value="All">All Attack Types</option>
                <option value="SQL_INJECTION">SQL Injection</option>
                <option value="XSS">Cross-Site Scripting (XSS)</option>
                <option value="BRUTE_FORCE">Brute Force</option>
                <option value="PORT_SCAN">Port Scan</option>
                <option value="DDoS">DDoS</option>
                <option value="COMMAND_INJECTION">Command Injection</option>
                <option value="PRIVILEGE_ESCALATION">Privilege Escalation</option>
                <option value="MALWARE">Malware</option>
                <option value="SUSPICIOUS_LOGIN">Suspicious Login</option>
                <option value="DATA_EXFILTRATION">Data Exfiltration</option>
              </select>

              {/* Threat Category Filter */}
              <select
                className="filter-select"
                value={threatCategoryFilter}
                onChange={(e) => setThreatCategoryFilter(e.target.value)}
              >
                <option value="All">All Threat Categories</option>
                <option value="Injection Attack">Injection Attack</option>
                <option value="Authentication">Authentication</option>
                <option value="Reconnaissance">Reconnaissance</option>
                <option value="Denial of Service">Denial of Service</option>
                <option value="Privilege Escalation">Privilege Escalation</option>
                <option value="Malware">Malware</option>
                <option value="Suspicious Activity">Suspicious Activity</option>
              </select>

              {/* Analyst Filter */}
              <select
                className="filter-select"
                value={analystFilter}
                onChange={(e) => setAnalystFilter(e.target.value)}
              >
                <option value="All">All Assignees</option>
                <option value="unassigned">-- Unassigned Only --</option>
                {analysts.map((a) => (
                  <option key={a._id} value={a._id}>
                    {a.name} ({a.role})
                  </option>
                ))}
              </select>

              {/* Quick Unassigned Toggle */}
              <button
                type="button"
                onClick={() => setAnalystFilter((cur) => (cur === "unassigned" ? "All" : "unassigned"))}
                style={{
                  display: "inline-flex", alignItems: "center", gap: 6,
                  background: analystFilter === "unassigned" ? "#ffe4e6" : "#fff",
                  color: analystFilter === "unassigned" ? "#e11d48" : "#475569",
                  border: analystFilter === "unassigned" ? "1.5px solid #f43f5e" : "1px solid #cbd5e1",
                  borderRadius: 8, padding: "6px 12px", fontSize: "0.8125rem", fontWeight: 700,
                  cursor: "pointer", transition: "all 0.15s ease",
                }}
                title="Filter unassigned incidents waiting for assignment"
              >
                <span>⏳</span> Waiting Assignment ({stats.new})
              </button>

              {/* Quick Archived Toggle */}
              <button
                type="button"
                onClick={() => setStatusFilter((cur) => (cur === "ARCHIVED" ? "All" : "ARCHIVED"))}
                style={{
                  display: "inline-flex", alignItems: "center", gap: 6,
                  background: statusFilter === "ARCHIVED" ? "#0f172a" : "#fff",
                  color: statusFilter === "ARCHIVED" ? "#f8fafc" : "#475569",
                  border: statusFilter === "ARCHIVED" ? "1.5px solid #0f172a" : "1px solid #cbd5e1",
                  borderRadius: 8, padding: "6px 12px", fontSize: "0.8125rem", fontWeight: 700,
                  cursor: "pointer", transition: "all 0.15s ease",
                }}
                title="View archived incidents preserved for audit compliance"
              >
                <span>📦</span> Archived Incidents ({stats.archived || 0})
              </button>

              {/* Date Range Start */}
              <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                <span style={{ fontSize: "0.75rem", color: "#64748b", fontWeight: 700 }}>From:</span>
                <input
                  type="date"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                  className="filter-select"
                  style={{ padding: "6px 10px" }}
                />
              </div>

              {/* Date Range End */}
              <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                <span style={{ fontSize: "0.75rem", color: "#64748b", fontWeight: 700 }}>To:</span>
                <input
                  type="date"
                  value={endDate}
                  onChange={(e) => setEndDate(e.target.value)}
                  className="filter-select"
                  style={{ padding: "6px 10px" }}
                />
              </div>
            </div>
          </div>

          {/* ── 3. INCIDENTS TABLE ── */}
          <div style={{
            background: "var(--bg-surface)", borderRadius: 8, border: "1px solid var(--border-subtle)",
            boxShadow: "0 4px 20px rgba(0,0,0,0.4)", overflow: "hidden",
          }}>
            {/* API Error Banner */}
            {apiError && (
              <div style={{
                background: "rgba(255, 77, 79, 0.15)", color: "var(--state-critical)", padding: "12px 1.5rem",
                display: "flex", justifyContent: "space-between", alignItems: "center",
                borderBottom: "1px solid rgba(255, 77, 79, 0.4)", fontSize: "0.85rem", fontWeight: 700,
                fontFamily: "var(--font-mono)",
              }}>
                <span>⚠️ {apiError}</span>
                <button
                  onClick={() => fetchIncidentsData(pagination.page)}
                  style={{
                    background: "var(--state-critical)", color: "#080907", border: "none",
                    borderRadius: 4, padding: "5px 12px", cursor: "pointer", fontWeight: 800,
                  }}
                >
                  Retry
                </button>
              </div>
            )}

            {/* Table or Empty/Loading State */}
            {loading ? (
              <div style={{
                padding: "4rem", textAlign: "center", color: "var(--color-gold)",
                display: "flex", flexDirection: "column", alignItems: "center", gap: 12,
              }}>
                <div style={{
                  width: 38, height: 38, border: "3px solid rgba(244, 197, 66, 0.2)",
                  borderTopColor: "var(--color-gold)", borderRadius: "50%",
                  animation: "spin 0.7s linear infinite",
                }} />
                <span style={{ fontSize: "0.9rem", fontWeight: 700, fontFamily: "var(--font-mono)" }}>
                  Syncing Incident Records with Ledger...
                </span>
              </div>
            ) : incidents.length === 0 ? (
              <div style={{ padding: "4rem 2rem", textAlign: "center" }}>
                <div style={{ fontSize: "2.5rem", marginBottom: 8 }}>🦉</div>
                <h3 style={{ color: "var(--text-primary)", fontFamily: "var(--font-heading)", margin: "0 0 6px" }}>No Incidents Found</h3>
                <p style={{ color: "var(--text-secondary)", fontSize: "0.875rem", margin: "0 0 16px" }}>
                  {searchQuery || statusFilter !== "All" || severityFilter !== "All"
                    ? "No incidents matched your query and active filters."
                    : "No security threat incidents have been flagged yet. Telemetry ingested by the pipeline will automatically appear here."}
                </p>
                {(searchQuery || statusFilter !== "All" || severityFilter !== "All") && (
                  <button
                    onClick={handleResetFilters}
                    style={{
                      background: "rgba(244, 197, 66, 0.15)", color: "var(--color-gold)", border: "1px solid rgba(244, 197, 66, 0.4)",
                      borderRadius: 6, padding: "8px 16px", fontWeight: 700, cursor: "pointer", fontFamily: "var(--font-heading)",
                    }}
                  >
                    Clear Active Filters
                  </button>
                )}
              </div>
            ) : (
              <div style={{ overflowX: "auto" }}>
                <table className="incident-table" style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.8125rem" }}>
                  <thead>
                    <tr style={{ background: "var(--bg-secondary)", borderBottom: "1px solid var(--border-subtle)", textAlign: "left", color: "var(--color-gold)", fontFamily: "var(--font-mono)", fontSize: "0.72rem", textTransform: "uppercase", letterSpacing: "0.06em" }}>
                      <th style={{ padding: "12px 14px", fontWeight: 800 }}>Incident ID</th>
                      <th style={{ padding: "12px 14px", fontWeight: 800 }}>Date / Time</th>
                      <th style={{ padding: "12px 14px", fontWeight: 800 }}>Threat Description</th>
                      <th style={{ padding: "12px 14px", fontWeight: 800 }}>Threat Category</th>
                      <th style={{ padding: "12px 14px", fontWeight: 800 }}>Attack Vector</th>
                      <th style={{ padding: "12px 14px", fontWeight: 800 }}>Severity</th>
                      <th style={{ padding: "12px 14px", fontWeight: 800 }}>Risk Score</th>
                      <th style={{ padding: "12px 14px", fontWeight: 800 }}>Telemetry Source</th>
                      <th style={{ padding: "12px 14px", fontWeight: 800 }}>Source IP</th>
                      <th style={{ padding: "12px 14px", fontWeight: 800 }}>Assigned Analyst</th>
                      <th style={{ padding: "12px 14px", fontWeight: 800 }}>Status</th>
                      <th style={{ padding: "12px 14px", fontWeight: 800, textAlign: "right" }}>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {incidents.map((inc) => {
                      const isNew = newEventFlash === inc.incidentId;
                      const status = (inc.status || "NEW").toUpperCase();

                      return (
                        <tr
                          key={inc.incidentId || inc._id}
                          className={isNew ? "row-flash" : ""}
                          style={{
                            borderBottom: "1px solid var(--border-subtle)",
                            transition: "background 0.15s",
                          }}
                        >
                          {/* 1. Incident ID */}
                          <td style={{ padding: "12px 14px", whiteSpace: "nowrap" }}>
                            <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                              <button
                                onClick={() => setDetailModalIncident(inc)}
                                style={{
                                  background: "none", border: "none", padding: 0,
                                  color: "var(--color-gold)", fontWeight: 800, fontFamily: "var(--font-mono)",
                                  fontSize: "0.8125rem", cursor: "pointer", textDecoration: "underline",
                                }}
                              >
                                {inc.incidentId}
                              </button>
                              <button
                                onClick={() => handleCopy(inc.incidentId, inc.incidentId)}
                                title="Copy Incident ID"
                                style={{
                                  background: "none", border: "none", color: "var(--text-muted)",
                                  cursor: "pointer", padding: 2, display: "flex",
                                }}
                              >
                                <CopyIcon />
                              </button>
                              {copiedKey === inc.incidentId && (
                                <span style={{ fontSize: "0.6875rem", color: "var(--state-verified)", fontWeight: 800 }}>✓</span>
                              )}
                            </div>
                          </td>

                          {/* 2. Date / Time */}
                          <td style={{ padding: "12px 14px", whiteSpace: "nowrap", color: "var(--text-secondary)", fontFamily: "var(--font-mono)", fontSize: "0.78rem" }}>
                            {formatDate(inc.timestamp || inc.createdAt)}
                          </td>

                          {/* 3. Threat (Title) */}
                          <td style={{ padding: "12px 14px", fontWeight: 700, color: "var(--text-primary)", maxWidth: 200, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                            {inc.title || "Threat Detected"}
                          </td>

                          {/* 4. Threat Category */}
                          <td style={{ padding: "12px 14px", color: "var(--text-secondary)" }}>
                            {inc.threatCategory || "General"}
                          </td>

                          {/* 5. Attack Type */}
                          <td style={{ padding: "12px 14px" }}>
                            <span style={{
                              background: "rgba(255, 255, 255, 0.05)", color: "var(--text-primary)", padding: "2px 8px",
                              borderRadius: 4, fontWeight: 700, fontSize: "0.72rem", border: "1px solid var(--border-subtle)",
                              fontFamily: "var(--font-mono)",
                            }}>
                              {inc.attackType}
                            </span>
                          </td>

                          {/* 6. Severity */}
                          <td style={{ padding: "12px 14px" }}>
                            <SeverityBadge severity={inc.severity} />
                          </td>

                          {/* 7. Risk Score */}
                          <td style={{ padding: "12px 14px" }}>
                            <span style={{
                              fontWeight: 900,
                              fontFamily: "var(--font-mono)",
                              color: inc.riskScore >= 75 ? "var(--state-critical)" : inc.riskScore >= 40 ? "var(--state-investigating)" : "var(--state-verified)",
                            }}>
                              {inc.riskScore || 0}
                            </span>
                          </td>

                          {/* 8. Source */}
                          <td style={{ padding: "12px 14px", color: "var(--text-secondary)", fontFamily: "var(--font-mono)", fontSize: "0.78rem" }}>
                            {inc.source || "Monitor"}
                          </td>

                          {/* 9. Source IP */}
                          <td style={{ padding: "12px 14px", fontFamily: "var(--font-mono)", color: "var(--text-primary)", fontSize: "0.78rem" }}>
                            {inc.sourceIP || "—"}
                          </td>

                          {/* 10. Assigned Analyst */}
                          <td style={{ padding: "12px 14px" }}>
                            {inc.assignedTo ? (
                              <span style={{
                                display: "inline-flex", alignItems: "center", gap: 4,
                                color: "#c084fc", fontWeight: 700, background: "rgba(168, 85, 247, 0.12)",
                                padding: "2px 8px", borderRadius: 4, border: "1px solid rgba(168, 85, 247, 0.35)",
                                fontSize: "0.72rem",
                              }}>
                                <UserIcon /> {inc.assignedTo.name || "Assigned"}
                              </span>
                            ) : (
                              <span style={{ color: "var(--text-muted)", fontStyle: "italic", fontSize: "0.75rem" }}>
                                Unassigned
                              </span>
                            )}
                          </td>

                          {/* 11. Status */}
                          <td style={{ padding: "12px 14px" }}>
                            <StatusBadge status={inc.status} />
                          </td>

                          {/* 12. Actions */}
                          <td style={{ padding: "12px 14px", textAlign: "right", whiteSpace: "nowrap" }}>
                            <div style={{ display: "inline-flex", gap: 6, justifyContent: "flex-end" }}>
                              {/* View Action */}
                              <button
                                onClick={() => setDetailModalIncident(inc)}
                                className="table-action-btn"
                                style={{ background: "rgba(244, 197, 66, 0.08)", color: "var(--color-gold)", borderColor: "rgba(244, 197, 66, 0.3)" }}
                                title="View Complete Incident Details"
                              >
                                <EyeIcon /> View
                              </button>

                              {/* Workspace Action */}
                              <Link
                                to={`/analyst/incidents/${inc.incidentId || inc._id}`}
                                className="table-action-btn"
                                style={{
                                  background: "rgba(255, 255, 255, 0.04)", color: "var(--text-primary)",
                                  textDecoration: "none", display: "inline-flex", alignItems: "center", gap: 4,
                                }}
                                title="Open Full Incident Investigation Workspace"
                              >
                                <span style={{ fontSize: "0.75rem" }}>🔍</span> Workspace
                              </Link>

                              {/* Assign Action */}
                              {canManage && status !== "ARCHIVED" && (
                                <button
                                  onClick={() => setAssignModalIncident(inc)}
                                  className="table-action-btn"
                                  style={{ background: "rgba(168, 85, 247, 0.1)", color: "#c084fc", borderColor: "rgba(168, 85, 247, 0.3)" }}
                                  title="Assign / Reassign to Analyst"
                                >
                                  <UserIcon /> Assign
                                </button>
                              )}

                              {/* Investigate Action */}
                              {canManage && (status === "NEW" || status === "ASSIGNED") && (
                                <button
                                  onClick={() => setInvestigateModalIncident(inc)}
                                  className="table-action-btn"
                                  style={{ background: "rgba(255, 181, 71, 0.1)", color: "var(--state-investigating)", borderColor: "rgba(255, 181, 71, 0.3)" }}
                                  title="Start Investigation"
                                >
                                  <BoltIcon /> Investigate
                                </button>
                              )}

                              {/* Resolve Action */}
                              {canManage && (status === "INVESTIGATING" || status === "ASSIGNED") && (
                                <button
                                  onClick={() => setResolveModalIncident(inc)}
                                  className="table-action-btn"
                                  style={{ background: "rgba(54, 214, 174, 0.1)", color: "var(--state-verified)", borderColor: "rgba(54, 214, 174, 0.3)" }}
                                  title="Resolve Incident"
                                >
                                  <CheckCircleIcon /> Resolve
                                </button>
                              )}

                              {/* Archive Action */}
                              {isAdmin && status === "RESOLVED" && (
                                <button
                                  onClick={() => setArchiveModalIncident(inc)}
                                  className="table-action-btn"
                                  style={{ background: "rgba(255, 255, 255, 0.05)", color: "var(--text-secondary)" }}
                                  title="Archive Incident Record"
                                >
                                  <ArchiveIcon /> Archive
                                </button>
                              )}
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}

            {/* Pagination Controls */}
            {!loading && pagination.totalPages > 1 && (
              <div style={{
                display: "flex", justifyContent: "space-between", alignItems: "center",
                padding: "1rem 1.5rem", background: "var(--bg-secondary)", borderTop: "1px solid var(--border-subtle)",
              }}>
                <span style={{ fontSize: "0.8125rem", color: "var(--text-secondary)", fontFamily: "var(--font-mono)" }}>
                  Page <strong style={{ color: "var(--color-gold)" }}>{pagination.page}</strong> of <strong>{pagination.totalPages}</strong> ({pagination.total} incidents)
                </span>
                <div style={{ display: "flex", gap: 8 }}>
                  <button
                    disabled={pagination.page <= 1}
                    onClick={() => fetchIncidentsData(pagination.page - 1)}
                    style={{
                      padding: "6px 12px", borderRadius: 4, border: "1px solid var(--border-subtle)",
                      background: "rgba(255, 255, 255, 0.05)", color: "var(--text-primary)", fontSize: "0.8125rem", fontWeight: 700,
                      cursor: pagination.page <= 1 ? "not-allowed" : "pointer",
                      opacity: pagination.page <= 1 ? 0.4 : 1,
                    }}
                  >
                    Previous
                  </button>
                  <button
                    disabled={pagination.page >= pagination.totalPages}
                    onClick={() => fetchIncidentsData(pagination.page + 1)}
                    style={{
                      padding: "6px 12px", borderRadius: 4, border: "1px solid var(--border-subtle)",
                      background: "rgba(255, 255, 255, 0.05)", color: "var(--text-primary)", fontSize: "0.8125rem", fontWeight: 700,
                      cursor: pagination.page >= pagination.totalPages ? "not-allowed" : "pointer",
                      opacity: pagination.page >= pagination.totalPages ? 0.4 : 1,
                    }}
                  >
                    Next
                  </button>
                </div>
              </div>
            )}
          </div>

        </div>

        {/* ── REAL-TIME TOAST ALERT (SOCKET.IO INCIDENT:NEW) ── */}
        {liveEventToast && (
          <div style={{
            position: "fixed", bottom: 24, right: 24, zIndex: 9999,
            background: "var(--bg-surface)", color: "var(--text-primary)", borderRadius: 8, padding: "1rem 1.25rem",
            boxShadow: "0 10px 35px rgba(0,0,0,0.8), 0 0 15px rgba(244, 197, 66, 0.15)", maxWidth: 420,
            border: "1px solid var(--border-subtle)",
            borderLeft: `4px solid ${liveEventToast.severity === "CRITICAL" ? "var(--state-critical)" : "var(--state-investigating)"}`,
            animation: "toastSlideIn 0.3s ease-out",
          }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 6 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 6, fontWeight: 800, color: "var(--color-gold)", fontSize: "0.85rem", fontFamily: "var(--font-mono)" }}>
                <span>🚨</span> LIVE INCIDENT DETECTED
              </div>
              <button
                onClick={() => setLiveEventToast(null)}
                style={{ background: "none", border: "none", color: "var(--text-muted)", cursor: "pointer", fontSize: "0.8rem" }}
              >
                ✕
              </button>
            </div>
            <div style={{ fontWeight: 800, fontSize: "0.925rem", color: "var(--text-primary)", fontFamily: "var(--font-heading)" }}>
              {liveEventToast.incidentId} — {liveEventToast.title}
            </div>
            <div style={{ fontSize: "0.78rem", color: "var(--text-secondary)", marginTop: 4, fontFamily: "var(--font-mono)" }}>
              Attack: <strong style={{ color: "var(--text-primary)" }}>{liveEventToast.attackType}</strong> · Severity: <strong style={{ color: liveEventToast.severity === "CRITICAL" ? "var(--state-critical)" : "var(--state-investigating)" }}>{liveEventToast.severity}</strong> · Risk: <strong>{liveEventToast.riskScore || 0}/100</strong>
            </div>
            <div style={{ marginTop: 10, display: "flex", justifyContent: "flex-end" }}>
              <button
                onClick={() => {
                  setDetailModalIncident(liveEventToast);
                  setLiveEventToast(null);
                }}
                style={{
                  background: "var(--color-gold)", color: "#080907", border: "none",
                  borderRadius: 4, padding: "5px 12px", fontSize: "0.75rem",
                  fontWeight: 800, cursor: "pointer", fontFamily: "var(--font-heading)",
                }}
              >
                View Incident Details →
              </button>
            </div>
          </div>
        )}


        {/* ── STANDARD TOAST ── */}
        {toastMessage && (
          <div style={{
            position: "fixed", bottom: 24, left: 24, zIndex: 9999,
            background: toastMessage.type === "success" ? "#0a7d55" : "#c0392b",
            color: "#fff", borderRadius: 10, padding: "10px 18px",
            fontSize: "0.875rem", fontWeight: 600, boxShadow: "0 4px 20px rgba(0,0,0,0.2)",
            display: "flex", alignItems: "center", gap: 8,
          }}>
            <span>{toastMessage.type === "success" ? "✓" : "⚠"}</span>
            {toastMessage.msg}
          </div>
        )}

        {/* ── MODALS ── */}
        {/* 1. Detail Modal */}
        {detailModalIncident && (
          <IncidentDetailsModal
            incident={detailModalIncident}
            onClose={() => {
              setDetailModalIncident(null);
              if (routeIncidentId) navigate("/admin/incidents");
            }}
            userRole={userRole}
            onOpenAssign={(inc) => setAssignModalIncident(inc)}
            onOpenInvestigate={(inc) => setInvestigateModalIncident(inc)}
            onOpenResolve={(inc) => setResolveModalIncident(inc)}
            onOpenArchive={(inc) => setArchiveModalIncident(inc)}
          />
        )}

        {/* 2. Assign Modal */}
        {assignModalIncident && (
          <AssignModal
            incident={assignModalIncident}
            analysts={analysts}
            onClose={() => setAssignModalIncident(null)}
            onSubmit={handleAssignSubmit}
            loading={actionLoading}
          />
        )}

        {/* 3. Investigate Modal */}
        {investigateModalIncident && (
          <InvestigateModal
            incident={investigateModalIncident}
            onClose={() => setInvestigateModalIncident(null)}
            onSubmit={handleInvestigateSubmit}
            loading={actionLoading}
          />
        )}

        {/* 4. Resolve Modal */}
        {resolveModalIncident && (
          <ResolveModal
            incident={resolveModalIncident}
            onClose={() => setResolveModalIncident(null)}
            onSubmit={handleResolveSubmit}
            loading={actionLoading}
          />
        )}

        {/* 5. Archive Modal */}
        {archiveModalIncident && (
          <ArchiveModal
            incident={archiveModalIncident}
            onClose={() => setArchiveModalIncident(null)}
            onSubmit={handleArchiveSubmit}
            loading={actionLoading}
          />
        )}
      </DashboardLayout>
    </>
  );
};

export default Incidents;
