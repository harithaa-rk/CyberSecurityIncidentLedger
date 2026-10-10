import React, { useState, useEffect, useCallback, useRef } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import { useAuth } from "../../context/AuthContext";
import DashboardLayout from "../../layouts/DashboardLayout";
import {
  getIncidentById,
  startInvestigation,
  addInvestigationNote,
  resolveIncident,
  archiveIncident,
} from "../../services/incidentService";
import { getSocket } from "../../services/socket";
import {
  StatusBadge,
  SeverityBadge,
} from "../../components/incident/IncidentDetailsModal";
import { ArchiveModal } from "../../components/incident/IncidentActionModals";
import EvidencePanel from "./EvidencePanel";
import ReportPanel from "../../components/incident/ReportPanel";

/* ── Inline SVG Icons ── */
const ShieldIcon = ({ size = 20 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>
  </svg>
);

const ArrowLeftIcon = ({ size = 16 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <line x1="19" y1="12" x2="5" y2="12"/><polyline points="12 19 5 12 12 5"/>
  </svg>
);

const PlayIcon = ({ size = 15 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor">
    <polygon points="5 3 19 12 5 21 5 3"/>
  </svg>
);

const CopyIcon = ({ size = 12 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <rect x="9" y="9" width="13" height="13" rx="2" ry="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/>
  </svg>
);

const LockIcon = ({ size = 48 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="#ef4444" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/>
  </svg>
);

const CheckCircleIcon = ({ size = 16 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/>
  </svg>
);

const formatDate = (dateStr) => {
  if (!dateStr) return "—";
  return new Date(dateStr).toLocaleString("en-US", {
    year: "numeric", month: "short", day: "numeric",
    hour: "2-digit", minute: "2-digit", second: "2-digit",
    hour12: false,
  });
};

const IncidentInvestigation = () => {
  const { id } = useParams();
  const { user } = useAuth();
  const navigate = useNavigate();

  const [incident, setIncident] = useState(null);
  const [loading, setLoading] = useState(true);
  const [authError, setAuthError] = useState(null);
  const [toastMessage, setToastMessage] = useState(null);
  const [copiedKey, setCopiedKey] = useState(null);

  // Note creation
  const [newNote, setNewNote] = useState("");
  const [submittingNote, setSubmittingNote] = useState(false);

  // Investigation action
  const [startingInvestigation, setStartingInvestigation] = useState(false);
  const [resolving, setResolving] = useState(false);
  const [archiving, setArchiving] = useState(false);
  const [showResolveModal, setShowResolveModal] = useState(false);
  const [showArchiveModal, setShowArchiveModal] = useState(false);
  const [resolutionSummary, setResolutionSummary] = useState("");
  const [rootCause, setRootCause] = useState("");
  const [actionTaken, setActionTaken] = useState("");

  const socketRef = useRef(null);

  const showToast = (type, msg) => {
    setToastMessage({ type, msg });
    setTimeout(() => setToastMessage(null), 3500);
  };

  const handleCopy = (text, key) => {
    if (!text) return;
    navigator.clipboard.writeText(text);
    setCopiedKey(key);
    setTimeout(() => setCopiedKey(null), 2000);
  };

  const loadIncident = useCallback(async () => {
    if (!id) return;
    setLoading(true);
    setAuthError(null);
    try {
      const res = await getIncidentById(id);
      setIncident(res.incident);
    } catch (err) {
      console.error("Error loading incident investigation:", err);
      if (err.response?.status === 403) {
        setAuthError(err.response?.data?.message || "Access denied. You are not authorized to view this incident.");
      } else if (err.response?.status === 404) {
        setAuthError("Incident not found.");
      } else {
        setAuthError(err.response?.data?.message || "Failed to load incident investigation.");
      }
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    loadIncident();
  }, [loadIncident]);

  // Live WebSocket sync
  useEffect(() => {
    const socket = getSocket();
    socketRef.current = socket;

    const onIncidentUpdated = (updated) => {
      if (
        updated &&
        (updated._id === incident?._id ||
          updated.incidentId === incident?.incidentId ||
          updated.incidentId === id ||
          updated._id === id)
      ) {
        setIncident(updated);
      }
    };

    socket.on("incident:updated", onIncidentUpdated);
    return () => {
      socket.off("incident:updated", onIncidentUpdated);
    };
  }, [incident?._id, incident?.incidentId, id]);

  const handleStartInvestigation = async () => {
    setStartingInvestigation(true);
    try {
      const incId = incident.incidentId || incident._id;
      const res = await startInvestigation(incId, {
        notes: "Investigation formally started by analyst.",
      });
      setIncident(res.incident);
      showToast("success", "Investigation started successfully.");
    } catch (err) {
      console.error("Start investigation failed:", err);
      showToast("error", err.response?.data?.message || "Failed to start investigation.");
    } finally {
      setStartingInvestigation(false);
    }
  };

  const handleAddNote = async (e) => {
    e.preventDefault();
    if (!newNote.trim()) return;

    setSubmittingNote(true);
    try {
      const incId = incident.incidentId || incident._id;
      const res = await addInvestigationNote(incId, { note: newNote });
      setIncident(res.incident);
      setNewNote("");
      showToast("success", "Investigation note recorded.");
    } catch (err) {
      console.error("Add note failed:", err);
      showToast("error", err.response?.data?.message || "Failed to record note.");
    } finally {
      setSubmittingNote(false);
    }
  };

  const handleResolve = async (e) => {
    e.preventDefault();
    if (!resolutionSummary.trim()) {
      showToast("error", "Resolution summary is required.");
      return;
    }

    setResolving(true);
    try {
      const incId = incident.incidentId || incident._id;
      const res = await resolveIncident(incId, {
        resolutionSummary,
        rootCause,
        actionTaken,
      });
      setIncident(res.incident);
      setShowResolveModal(false);
      showToast("success", "Incident resolved successfully.");
    } catch (err) {
      console.error("Resolve incident failed:", err);
      showToast("error", err.response?.data?.message || "Failed to resolve incident.");
    } finally {
      setResolving(false);
    }
  };

  const handleArchive = async ({ note }) => {
    setArchiving(true);
    try {
      const incId = incident.incidentId || incident._id;
      const res = await archiveIncident(incId, { note });
      setIncident(res.incident);
      setShowArchiveModal(false);
      showToast("success", "Incident archived and preserved for historical compliance.");
    } catch (err) {
      console.error("Archive incident failed:", err);
      showToast("error", err.response?.data?.message || "Failed to archive incident.");
    } finally {
      setArchiving(false);
    }
  };

  /* ── Unauthorized Access Guard Screen ── */
  if (authError) {
    return (
      <div style={{
        minHeight: "100vh", background: "#f8fafc",
        display: "flex", alignItems: "center", justifyContent: "center", padding: "2rem",
        fontFamily: "var(--font-sans, 'Outfit', sans-serif)",
      }}>
        <div style={{
          background: "#fff", borderRadius: 16, padding: "3rem 2rem",
          maxWidth: 540, width: "100%", textAlign: "center",
          boxShadow: "0 10px 40px rgba(0,0,0,0.08)", border: "1px solid #fee2e2",
        }}>
          <div style={{ marginBottom: "1.25rem" }}>
            <LockIcon />
          </div>
          <h2 style={{ fontSize: "1.5rem", fontWeight: 800, color: "#991b1b", margin: "0 0 0.5rem" }}>
            Unauthorized Access Blocked
          </h2>
          <p style={{ color: "#4b5563", fontSize: "0.9375rem", lineHeight: 1.6, marginBottom: "2rem" }}>
            {authError}
            <br />
            Security Ledger RBAC strictly prevents analysts from accessing incidents not assigned to their user ID.
          </p>
          <div style={{ display: "flex", gap: 12, justifyContent: "center" }}>
            <button
              onClick={() => navigate(user?.role === "Admin" ? "/admin/incidents" : "/analyst/incidents")}
              style={{
                background: "#0f2744", color: "#fff", border: "none",
                borderRadius: 10, padding: "10px 22px", fontWeight: 700,
                fontSize: "0.875rem", cursor: "pointer",
              }}
            >
              Return to My Incidents
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (loading || !incident) {
    return (
      <div style={{
        minHeight: "100vh", background: "#f8fafc", display: "flex",
        alignItems: "center", justifyContent: "center", color: "#64748b",
        fontFamily: "var(--font-sans, 'Outfit', sans-serif)",
      }}>
        <div style={{ textAlign: "center" }}>
          <div style={{
            width: 40, height: 40, border: "3px solid #cbd5e1",
            borderTopColor: "#0d7377", borderRadius: "50%",
            margin: "0 auto 12px", animation: "spin 0.7s linear infinite",
          }} />
          Loading investigation workspace...
        </div>
      </div>
    );
  }

  const secLog = incident.securityLogId && typeof incident.securityLogId === "object"
    ? incident.securityLogId
    : null;

  const rawLogContent = secLog?.fullLog || secLog?.rawLog || incident.description || "No raw log payload available.";
  const isAssigned = incident.status === "ASSIGNED";
  const isInvestigating = incident.status === "INVESTIGATING";
  const isResolved = incident.status === "RESOLVED";
  const isArchived = incident.status === "ARCHIVED";

  const assignedUserId = incident.assignedTo?._id?.toString() || incident.assignedTo?.toString();
  const isAssignedAnalyst = user?.role === "Analyst" && assignedUserId === user?.id?.toString();
  const canAddNote = (user?.role === "Admin" || isAssignedAnalyst) && !isArchived;

  return (
    <DashboardLayout
      activeSection="analyst-incidents"
      title={incident ? `Incident ${incident.incidentId}` : "Investigation"}
      backTo={user?.role === "Admin" ? "/admin/incidents" : "/analyst/incidents"}
      backLabel="Incidents"
      headerActions={
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          {isAssigned && (
            <button
              onClick={handleStartInvestigation}
              disabled={startingInvestigation}
              style={{
                display: "inline-flex", alignItems: "center", gap: 6,
                background: "linear-gradient(135deg, #0d7377, #14a8ad)",
                color: "#fff", border: "none", borderRadius: 8,
                padding: "7px 16px", fontWeight: 700, fontSize: "0.8125rem",
                cursor: "pointer", boxShadow: "0 2px 8px rgba(13,115,119,0.35)",
              }}
            >
              <PlayIcon />
              {startingInvestigation ? "Starting..." : "Start Investigation"}
            </button>
          )}

          {isInvestigating && (
            <button
              onClick={() => setShowResolveModal(true)}
              style={{
                display: "inline-flex", alignItems: "center", gap: 6,
                background: "#059669", color: "#fff", border: "none", borderRadius: 8,
                padding: "7px 16px", fontWeight: 700, fontSize: "0.8125rem",
                cursor: "pointer", boxShadow: "0 2px 8px rgba(5,150,105,0.3)",
              }}
            >
              <CheckCircleIcon />
              Resolve Incident
            </button>
          )}

          {isResolved && (user?.role === "Admin" || isAssignedAnalyst) && (
            <button
              onClick={() => setShowArchiveModal(true)}
              style={{
                display: "inline-flex", alignItems: "center", gap: 6,
                background: "var(--bg-surface)", color: "var(--text-primary)",
                border: "1px solid var(--border-subtle)", borderRadius: 8,
                padding: "7px 16px", fontWeight: 700, fontSize: "0.8125rem",
                cursor: "pointer",
              }}
            >
              <span>📦</span> Archive Incident
            </button>
          )}

          {isArchived && (
            <div style={{
              display: "inline-flex", alignItems: "center", gap: 6,
              background: "var(--color-gold-soft)", border: "1px solid var(--color-gold-border)",
              borderRadius: 8, padding: "5px 12px", fontSize: "0.78rem", fontWeight: 700,
              color: "var(--color-gold)",
            }}>
              <span>🔒</span> Archived
            </div>
          )}
        </div>
      }
    >
      {/* Toast Alert */}
      {toastMessage && (
        <div style={{
          position: "fixed", bottom: 24, right: 24, zIndex: 9999,
          background: toastMessage.type === "success" ? "#0a7d55" : toastMessage.type === "error" ? "#c0392b" : "var(--bg-surface)",
          color: "#fff", borderRadius: 10, padding: "12px 20px",
          fontSize: "0.9rem", fontWeight: 600, boxShadow: "var(--shadow-obsidian)",
          border: `1px solid ${toastMessage.type === "success" ? "rgba(54, 214, 174, 0.4)" : "rgba(255, 77, 79, 0.4)"}`,
          display: "flex", alignItems: "center", gap: 10,
        }}>
          <span>{toastMessage.type === "success" ? "✓" : toastMessage.type === "error" ? "⚠" : "ℹ"}</span>
          {toastMessage.msg}
        </div>
      )}

      {/* Main Workspace Layout */}
      <div style={{ maxWidth: 1320, margin: "0 auto", padding: "0.5rem 0" }}>
        {/* Incident Headline Card */}
        <div style={{
          background: "var(--bg-surface)",
          border: "1px solid var(--border-subtle)",
          borderRadius: 14,
          padding: "1.25rem 1.75rem",
          marginBottom: "1.5rem",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          flexWrap: "wrap",
          gap: 14,
          boxShadow: "var(--shadow-card)",
        }}>
          <div>
            <div style={{ fontSize: "1.25rem", fontWeight: 800, fontFamily: "var(--font-mono)", display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
              <span>{incident.incidentId}</span>
              <StatusBadge status={incident.status} />
              <SeverityBadge severity={incident.severity} />
            </div>
            <div style={{ color: "var(--text-secondary)", fontSize: "0.875rem", marginTop: 4, fontFamily: "var(--font-heading)" }}>
              {incident.title}
            </div>
          </div>
          <div style={{ fontSize: "0.78rem", color: "var(--text-muted)", fontFamily: "var(--font-mono)" }}>
            Assigned: <strong style={{ color: "var(--text-primary)" }}>{incident.assignedTo?.name || "Unassigned"}</strong>
          </div>
        </div>

        {/* Status Callout Banners */}
        {isArchived && (
          <div style={{
            background: "var(--bg-surface)", border: "1.5px solid var(--border-subtle)", borderRadius: 12,
            padding: "1.25rem 1.5rem", marginBottom: "1.5rem", display: "flex",
            alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 12,
            boxShadow: "var(--shadow-card)",
          }}>
            <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
              <span style={{ fontSize: "1.75rem" }}>📦</span>
              <div>
                <div style={{ fontWeight: 800, color: "#1e293b", fontSize: "1rem" }}>
                  ARCHIVED INCIDENT – READ-ONLY AUDIT RECORD
                </div>
                <div style={{ color: "#64748b", fontSize: "0.875rem", marginTop: 3 }}>
                  This incident was permanently archived by <strong>{incident.archivedBy?.name || incident.archivedBy?.email || "Admin"}</strong> on {formatDate(incident.archivedAt)}. It remains securely stored in MongoDB for historical and compliance review. All investigative notes, status changes, and severity metrics are locked.
                </div>
              </div>
            </div>
          </div>
        )}
        {isAssigned && (
          <div style={{
            background: "#eff6ff", border: "1px solid #bfdbfe", borderRadius: 12,
            padding: "1rem 1.5rem", marginBottom: "1.5rem", display: "flex",
            alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 12,
          }}>
            <div>
              <div style={{ fontWeight: 800, color: "#1e40af", fontSize: "0.9375rem" }}>
                ⏳ Ready for Investigation
              </div>
              <div style={{ color: "#3b82f6", fontSize: "0.8125rem", marginTop: 2 }}>
                This incident is currently assigned to you. Click "Start Investigation" to transition the status to INVESTIGATING and record your investigation start timestamp.
              </div>
            </div>
            <button
              onClick={handleStartInvestigation}
              disabled={startingInvestigation}
              style={{
                background: "#2563eb", color: "#fff", border: "none", borderRadius: 8,
                padding: "8px 16px", fontWeight: 700, fontSize: "0.8125rem", cursor: "pointer",
              }}
            >
              {startingInvestigation ? "Starting..." : "Start Investigation Now"}
            </button>
          </div>
        )}

        {isInvestigating && (
          <div style={{
            background: "#fffbeb", border: "1px solid #fde68a", borderRadius: 12,
            padding: "1rem 1.5rem", marginBottom: "1.5rem", display: "flex",
            alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 12,
          }}>
            <div>
              <div style={{ fontWeight: 800, color: "#b45309", fontSize: "0.9375rem", display: "flex", alignItems: "center", gap: 6 }}>
                <span style={{ width: 10, height: 10, borderRadius: "50%", background: "#f59e0b", display: "inline-block", animation: "pulse 1.5s infinite" }} />
                Investigation In Progress
              </div>
              <div style={{ color: "#78350f", fontSize: "0.8125rem", marginTop: 2 }}>
                Active investigation commenced at {formatDate(incident.investigationStartedAt)}. Record forensic findings in Investigation Notes below.
              </div>
            </div>
            <button
              onClick={() => setShowResolveModal(true)}
              style={{
                background: "#059669", color: "#fff", border: "none", borderRadius: 8,
                padding: "8px 16px", fontWeight: 700, fontSize: "0.8125rem", cursor: "pointer",
              }}
            >
              Mark as Resolved
            </button>
          </div>
        )}

        {/* 2-Column Grid */}
        <div style={{ display: "grid", gridTemplateColumns: "minmax(0, 1.9fr) minmax(0, 1.1fr)", gap: "1.5rem", alignItems: "start" }}>

          {/* LEFT COLUMN: Threat Context, AI Intelligence & Original Log */}
          <div style={{ display: "flex", flexDirection: "column", gap: "1.5rem" }}>

            {/* 1. Incident Threat Parameters & Network Context */}
            <div style={{ background: "#fff", borderRadius: 14, border: "1px solid #e2e8f0", padding: "1.5rem", boxShadow: "0 2px 8px rgba(0,0,0,0.03)" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", borderBottom: "1px solid #f1f5f9", paddingBottom: "1rem", marginBottom: "1rem" }}>
                <div>
                  <h3 style={{ margin: 0, fontSize: "1.05rem", fontWeight: 800, color: "#0f2744" }}>
                    Threat & Network Telemetry
                  </h3>
                  <div style={{ fontSize: "0.75rem", color: "#64748b" }}>Core forensic metadata captured by CSIL ingestion</div>
                </div>
                <div style={{
                  display: "inline-flex", alignItems: "center", gap: 6,
                  background: incident.threat ? "#fef2f2" : "#f0fdf4",
                  color: incident.threat ? "#b91c1c" : "#15803d",
                  padding: "4px 10px", borderRadius: 999, fontWeight: 800, fontSize: "0.75rem",
                  border: incident.threat ? "1px solid #fca5a5" : "1px solid #86efac",
                }}>
                  {incident.threat ? "⚠️ Active Threat Confirmed" : "Normal Event"}
                </div>
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: "1rem" }}>
                <div>
                  <div style={{ fontSize: "0.75rem", fontWeight: 700, color: "#64748b", textTransform: "uppercase" }}>Incident ID</div>
                  <div style={{ fontSize: "0.9375rem", fontWeight: 800, fontFamily: "monospace", color: "#0f2744", display: "flex", alignItems: "center", gap: 6 }}>
                    {incident.incidentId}
                    <button
                      onClick={() => handleCopy(incident.incidentId, "incId")}
                      style={{ background: "none", border: "none", cursor: "pointer", color: copiedKey === "incId" ? "#059669" : "#94a3b8" }}
                    >
                      {copiedKey === "incId" ? "✓" : <CopyIcon />}
                    </button>
                  </div>
                </div>

                <div>
                  <div style={{ fontSize: "0.75rem", fontWeight: 700, color: "#64748b", textTransform: "uppercase" }}>Attack Type</div>
                  <div style={{ fontSize: "0.9375rem", fontWeight: 700, color: "#0f2744" }}>{incident.attackType}</div>
                </div>

                <div>
                  <div style={{ fontSize: "0.75rem", fontWeight: 700, color: "#64748b", textTransform: "uppercase" }}>Threat Category</div>
                  <div style={{ fontSize: "0.9375rem", fontWeight: 700, color: "#0f2744" }}>{incident.threatCategory || "General"}</div>
                </div>

                <div>
                  <div style={{ fontSize: "0.75rem", fontWeight: 700, color: "#64748b", textTransform: "uppercase" }}>Risk Score</div>
                  <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 2 }}>
                    <span style={{ fontSize: "1.1rem", fontWeight: 800, color: incident.riskScore >= 70 ? "#b91c1c" : incident.riskScore >= 40 ? "#d97706" : "#059669" }}>
                      {incident.riskScore} / 100
                    </span>
                    <div style={{ width: 80, height: 7, background: "#e2e8f0", borderRadius: 4, overflow: "hidden" }}>
                      <div style={{
                        width: `${incident.riskScore}%`, height: "100%",
                        background: incident.riskScore >= 70 ? "#b91c1c" : incident.riskScore >= 40 ? "#d97706" : "#059669",
                      }} />
                    </div>
                  </div>
                </div>

                <div>
                  <div style={{ fontSize: "0.75rem", fontWeight: 700, color: "#64748b", textTransform: "uppercase" }}>Source Telemetry</div>
                  <div style={{ fontSize: "0.9375rem", fontWeight: 600, color: "#334155" }}>{incident.source || "Security Monitor"}</div>
                </div>

                <div>
                  <div style={{ fontSize: "0.75rem", fontWeight: 700, color: "#64748b", textTransform: "uppercase" }}>Event ID</div>
                  <div style={{ fontSize: "0.9375rem", fontWeight: 700, fontFamily: "monospace", color: "#334155" }}>
                    {incident.eventId || "N/A"}
                  </div>
                </div>

                <div>
                  <div style={{ fontSize: "0.75rem", fontWeight: 700, color: "#64748b", textTransform: "uppercase" }}>Source IP</div>
                  <div style={{ fontSize: "0.9375rem", fontWeight: 700, fontFamily: "monospace", color: "#b91c1c", display: "flex", alignItems: "center", gap: 6 }}>
                    {incident.sourceIP}
                    <button
                      onClick={() => handleCopy(incident.sourceIP, "srcIp")}
                      style={{ background: "none", border: "none", cursor: "pointer", color: copiedKey === "srcIp" ? "#059669" : "#94a3b8" }}
                    >
                      {copiedKey === "srcIp" ? "✓" : <CopyIcon />}
                    </button>
                  </div>
                </div>

                <div>
                  <div style={{ fontSize: "0.75rem", fontWeight: 700, color: "#64748b", textTransform: "uppercase" }}>Destination IP</div>
                  <div style={{ fontSize: "0.9375rem", fontWeight: 700, fontFamily: "monospace", color: "#0d7377", display: "flex", alignItems: "center", gap: 6 }}>
                    {incident.destinationIP}
                    <button
                      onClick={() => handleCopy(incident.destinationIP, "dstIp")}
                      style={{ background: "none", border: "none", cursor: "pointer", color: copiedKey === "dstIp" ? "#059669" : "#94a3b8" }}
                    >
                      {copiedKey === "dstIp" ? "✓" : <CopyIcon />}
                    </button>
                  </div>
                </div>
              </div>
            </div>

            {/* 2. AI Threat Explanation & Recommended Action */}
            <div style={{ background: "#fff", borderRadius: 14, border: "1px solid #e2e8f0", padding: "1.5rem", boxShadow: "0 2px 8px rgba(0,0,0,0.03)" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: "1rem" }}>
                <span style={{ fontSize: "1.25rem" }}>🤖</span>
                <h3 style={{ margin: 0, fontSize: "1.05rem", fontWeight: 800, color: "#0f2744" }}>
                  AI Security Intelligence Analysis
                </h3>
              </div>

              <div style={{ marginBottom: "1.25rem" }}>
                <div style={{ fontSize: "0.75rem", fontWeight: 800, color: "#0d7377", textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 6 }}>
                  AI Threat Explanation
                </div>
                <div style={{
                  background: "#f8fafc", borderRadius: 10, padding: "1rem",
                  border: "1px solid #e2e8f0", fontSize: "0.875rem", color: "#334155", lineHeight: 1.6,
                }}>
                  {incident.aiExplanation || secLog?.explanation || incident.description || "No AI explanation available for this security event."}
                </div>
              </div>

              <div>
                <div style={{ fontSize: "0.75rem", fontWeight: 800, color: "#d97706", textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 6 }}>
                  Recommended Action & Mitigation
                </div>
                <div style={{
                  background: "#fffbeb", borderRadius: 10, padding: "1rem",
                  border: "1px solid #fde68a", fontSize: "0.875rem", color: "#92400e", lineHeight: 1.6,
                }}>
                  {incident.recommendedAction || secLog?.recommendedAction || "Conduct host isolation, verify firewall access control lists, and inspect endpoint network sockets."}
                </div>
              </div>
            </div>

            {/* 3. Original Log Payload */}
            <div style={{ background: "#fff", borderRadius: 14, border: "1px solid #e2e8f0", padding: "1.5rem", boxShadow: "0 2px 8px rgba(0,0,0,0.03)" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "0.75rem" }}>
                <div>
                  <h3 style={{ margin: 0, fontSize: "1.05rem", fontWeight: 800, color: "#0f2744" }}>
                    Original Security Log Payload
                  </h3>
                  <div style={{ fontSize: "0.75rem", color: "#64748b" }}>Raw telemetry stream captured at ingestion time</div>
                </div>
                <button
                  onClick={() => handleCopy(rawLogContent, "rawLog")}
                  style={{
                    display: "inline-flex", alignItems: "center", gap: 5,
                    background: "#f1f5f9", border: "1px solid #cbd5e1", borderRadius: 6,
                    padding: "4px 10px", fontSize: "0.75rem", fontWeight: 700, color: "#334155", cursor: "pointer",
                  }}
                >
                  <CopyIcon />
                  {copiedKey === "rawLog" ? "Copied!" : "Copy Raw Log"}
                </button>
              </div>

              <pre style={{
                background: "#0f172a", color: "#38bdf8", padding: "1rem",
                borderRadius: 10, fontSize: "0.8125rem", fontFamily: "Consolas, monospace",
                overflowX: "auto", margin: 0, lineHeight: 1.5, whiteSpace: "pre-wrap", wordBreak: "break-all",
              }}>
                {rawLogContent}
              </pre>
            </div>

            {/* 4. Investigation Notes Section (Module 4) */}
            <div style={{ background: "#fff", borderRadius: 14, border: "1px solid #e2e8f0", padding: "1.5rem", boxShadow: "0 2px 8px rgba(0,0,0,0.03)" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "0.5rem" }}>
                <h3 style={{ margin: 0, fontSize: "1.05rem", fontWeight: 800, color: "#0f2744" }}>
                  Investigation Notes ({incident.notes?.length || (incident.investigationNotes ? 1 : 0)})
                </h3>
                <span style={{ fontSize: "0.75rem", color: "#64748b", fontWeight: 600 }}>
                  Chronological Forensic Record
                </span>
              </div>
              <div style={{ fontSize: "0.75rem", color: "#64748b", marginBottom: "1.25rem" }}>
                Diagnostic steps, artifact observations, and hypotheses recorded by authorized analysts
              </div>

              {/* Form to append new note (Strictly authorized) */}
              {canAddNote ? (
                <form onSubmit={handleAddNote} style={{ marginBottom: "1.75rem" }}>
                  <textarea
                    rows={3}
                    value={newNote}
                    onChange={(e) => setNewNote(e.target.value)}
                    placeholder="Enter diagnostic finding, decoded payload, or containment step (cannot be empty)..."
                    style={{
                      width: "100%", padding: "10px 12px", borderRadius: 8,
                      border: "1px solid #cbd5e1", fontSize: "0.875rem", fontFamily: "inherit",
                      boxSizing: "border-box", resize: "vertical", outline: "none",
                    }}
                  />
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: 8 }}>
                    <span style={{ fontSize: "0.75rem", color: "#94a3b8" }}>
                      Signed by: <strong>{user?.name}</strong> ({user?.role})
                    </span>
                    <button
                      type="submit"
                      disabled={submittingNote || !newNote.trim()}
                      style={{
                        background: "linear-gradient(135deg, #0d7377, #14a8ad)",
                        color: "#fff", border: "none", borderRadius: 8,
                        padding: "8px 18px", fontSize: "0.8125rem", fontWeight: 700,
                        cursor: submittingNote || !newNote.trim() ? "not-allowed" : "pointer",
                        opacity: submittingNote || !newNote.trim() ? 0.6 : 1,
                        boxShadow: "0 2px 6px rgba(13,115,119,0.3)",
                      }}
                    >
                      {submittingNote ? "Recording Note..." : "Add Note"}
                    </button>
                  </div>
                </form>
              ) : (
                <div style={{
                  background: "#f8fafc", border: "1px solid #e2e8f0", borderRadius: 8,
                  padding: "10px 14px", marginBottom: "1.5rem", fontSize: "0.8125rem", color: "#64748b",
                }}>
                  {isArchived
                    ? "🔒 Investigation notes are permanently locked for archived incidents. This record is read-only."
                    : <>🔒 Only the assigned Analyst (<strong>{incident.assignedTo?.name || "Assignee"}</strong>) or an Administrator can record investigation notes.</>}
                </div>
              )}

              {/* Display existing notes in chronological order */}
              {incident.notes && incident.notes.length > 0 ? (
                <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                  {incident.notes.map((n, i) => (
                    <div
                      key={n._id || i}
                      style={{
                        background: "#f8fafc", borderRadius: 10, padding: "1rem 1.25rem",
                        border: "1px solid #e2e8f0", borderLeft: "4px solid #0d7377",
                      }}
                    >
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
                        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                          <span style={{
                            width: 22, height: 22, borderRadius: "50%", background: "#0d7377",
                            color: "#fff", display: "inline-flex", alignItems: "center", justifyContent: "center",
                            fontSize: "0.7rem", fontWeight: 800,
                          }}>
                            {(n.author || "A")[0].toUpperCase()}
                          </span>
                          <span style={{ fontWeight: 800, fontSize: "0.875rem", color: "#0f2744" }}>
                            {n.author || "Analyst"}
                          </span>
                        </div>
                        <span style={{ fontSize: "0.75rem", color: "#64748b", fontWeight: 600 }}>
                          {formatDate(n.timestamp)}
                        </span>
                      </div>
                      <div style={{ fontSize: "0.875rem", color: "#1e293b", lineHeight: 1.6, whiteSpace: "pre-wrap" }}>
                        {n.note}
                      </div>
                    </div>
                  ))}
                </div>
              ) : incident.investigationNotes ? (
                <div style={{
                  background: "#f8fafc", borderRadius: 10, padding: "1rem",
                  border: "1px solid #e2e8f0", fontSize: "0.875rem", color: "#1e293b",
                  whiteSpace: "pre-wrap", lineHeight: 1.6,
                }}>
                  {incident.investigationNotes}
                </div>
              ) : (
                <div style={{ padding: "1.75rem", textAlign: "center", color: "#94a3b8", fontSize: "0.875rem", border: "1px dashed #cbd5e1", borderRadius: 10 }}>
                  No investigation notes recorded yet. Authorized analysts can use the form above to log observations.
                </div>
              )}
            </div>

          </div>

          {/* RIGHT COLUMN: Assignment Metadata & Activity Timeline */}
          <div style={{ display: "flex", flexDirection: "column", gap: "1.5rem" }}>

            {/* 1. Assignment & Status Card */}
            <div style={{ background: "#fff", borderRadius: 14, border: "1px solid #e2e8f0", padding: "1.5rem", boxShadow: "0 2px 8px rgba(0,0,0,0.03)" }}>
              <h3 style={{ margin: "0 0 1rem", fontSize: "1.05rem", fontWeight: 800, color: "#0f2744" }}>
                Assignment Information
              </h3>

              <div style={{ display: "flex", flexDirection: "column", gap: 12, fontSize: "0.875rem" }}>
                <div>
                  <div style={{ fontSize: "0.75rem", fontWeight: 700, color: "#64748b", textTransform: "uppercase" }}>Current Status</div>
                  <div style={{ marginTop: 4 }}>
                    <StatusBadge status={incident.status} />
                  </div>
                </div>

                <div>
                  <div style={{ fontSize: "0.75rem", fontWeight: 700, color: "#64748b", textTransform: "uppercase" }}>Assigned To</div>
                  <div style={{ fontWeight: 700, color: "#0f2744", marginTop: 2 }}>
                    {incident.assignedTo?.name || "Unassigned"}
                  </div>
                  {incident.assignedTo?.email && (
                    <div style={{ fontSize: "0.75rem", color: "#64748b" }}>{incident.assignedTo.email}</div>
                  )}
                </div>

                <div>
                  <div style={{ fontSize: "0.75rem", fontWeight: 700, color: "#64748b", textTransform: "uppercase" }}>Assigned By</div>
                  <div style={{ fontWeight: 600, color: "#334155", marginTop: 2 }}>
                    {incident.assignedBy?.name || incident.assignedBy?.email || "Admin"}
                  </div>
                </div>

                <div>
                  <div style={{ fontSize: "0.75rem", fontWeight: 700, color: "#64748b", textTransform: "uppercase" }}>Assigned At</div>
                  <div style={{ color: "#334155", marginTop: 2 }}>
                    {formatDate(incident.assignedAt)}
                  </div>
                </div>

                <div>
                  <div style={{ fontSize: "0.75rem", fontWeight: 700, color: "#64748b", textTransform: "uppercase" }}>Investigation Started At</div>
                  <div style={{ color: "#334155", marginTop: 2 }}>
                    {formatDate(incident.investigationStartedAt)}
                  </div>
                </div>

                {incident.resolvedAt && (
                  <div>
                    <div style={{ fontSize: "0.75rem", fontWeight: 700, color: "#64748b", textTransform: "uppercase" }}>Resolved At</div>
                    <div style={{ color: "#059669", fontWeight: 700, marginTop: 2 }}>
                      {formatDate(incident.resolvedAt)}
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* 2. Visual Activity Audit Timeline (Module 4) */}
            <div style={{ background: "#fff", borderRadius: 14, border: "1px solid #e2e8f0", padding: "1.5rem", boxShadow: "0 2px 8px rgba(0,0,0,0.03)" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "0.75rem" }}>
                <h3 style={{ margin: 0, fontSize: "1.05rem", fontWeight: 800, color: "#0f2744" }}>
                  Activity Timeline
                </h3>
                <span style={{ fontSize: "0.75rem", fontWeight: 700, color: "#0d7377", background: "#e6fffa", padding: "2px 8px", borderRadius: 999 }}>
                  Immutable Ledger
                </span>
              </div>
              <div style={{ fontSize: "0.75rem", color: "#64748b", marginBottom: "1.25rem" }}>
                Auditable chronological event log (Who · What · When)
              </div>

              <div style={{ position: "relative", paddingLeft: 20 }}>
                {/* Vertical connecting line */}
                <div style={{
                  position: "absolute", left: 7, top: 8, bottom: 8,
                  width: 2, background: "#e2e8f0",
                }} />

                {(incident.activityHistory || []).map((act, idx) => {
                  const isCreated = act.action === "INCIDENT_CREATED";
                  const isAssignedAction = act.action === "INCIDENT_ASSIGNED" || act.action === "INCIDENT_REASSIGNED";
                  const isInvestigateAction = act.action === "INVESTIGATION_STARTED";
                  const isNoteAction = act.action === "NOTE_ADDED";
                  const isResolvedAction = act.action === "INCIDENT_RESOLVED";
                  const isArchivedAction = act.action === "INCIDENT_ARCHIVED";

                  let bulletColor = "#64748b";
                  let actionLabel = act.action.replace(/_/g, " ");

                  if (isCreated) {
                    bulletColor = "#2563eb";
                    actionLabel = "Incident Created";
                  } else if (act.action === "INCIDENT_ASSIGNED") {
                    bulletColor = "#7c3aed";
                    actionLabel = "Assigned to Analyst";
                  } else if (act.action === "INCIDENT_REASSIGNED") {
                    bulletColor = "#9333ea";
                    actionLabel = "Reassigned to Analyst";
                  } else if (isInvestigateAction) {
                    bulletColor = "#d97706";
                    actionLabel = "Investigation Started";
                  } else if (isNoteAction) {
                    bulletColor = "#0d7377";
                    actionLabel = "Investigation Note Added";
                  } else if (isResolvedAction) {
                    bulletColor = "#059669";
                    actionLabel = "Incident Resolved";
                  } else if (isArchivedAction) {
                    bulletColor = "#475569";
                    actionLabel = "Incident Archived";
                  } else if (act.action === "EVIDENCE_ADDED") {
                    bulletColor = "#6366f1";
                    actionLabel = "Evidence Collected";
                  } else if (act.action === "EVIDENCE_DELETED") {
                    bulletColor = "#f97316";
                    actionLabel = "Evidence Deleted";
                  }

                  const when = act.performedAt || act.timestamp;
                  const whatDesc = act.description || act.note;
                  const who = act.performedBy || "System";

                  return (
                    <div key={idx} style={{ position: "relative", marginBottom: "1.25rem" }}>
                      {/* Bullet Dot */}
                      <span style={{
                        position: "absolute", left: -20, top: 4,
                        width: 12, height: 12, borderRadius: "50%",
                        background: bulletColor, border: "2px solid #fff",
                        boxShadow: `0 0 0 2px ${bulletColor}30`,
                      }} />

                      <div>
                        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8 }}>
                          <span style={{ fontWeight: 800, fontSize: "0.8125rem", color: bulletColor }}>
                            ● {actionLabel}
                          </span>
                          <span style={{ fontSize: "0.75rem", color: "#64748b", fontFamily: "monospace", fontWeight: 600 }}>
                            {formatDate(when)}
                          </span>
                        </div>

                        <div style={{ fontSize: "0.75rem", color: "#64748b", marginTop: 2 }}>
                          Who: <strong style={{ color: "#334155" }}>{who}</strong>
                        </div>

                        {whatDesc && (
                          <div style={{
                            fontSize: "0.78125rem", color: "#1e293b", marginTop: 4,
                            background: "#f8fafc", padding: "6px 10px", borderRadius: 6,
                            border: "1px solid #f1f5f9",
                          }}>
                            {whatDesc}
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

          </div>
        </div>
      </div>

      {/* ── Digital Evidence Panel (Phase 4 Module 1) ── */}
      <div style={{ maxWidth: 1320, margin: "0 auto", padding: "0 0 2rem" }}>
        <EvidencePanel incident={incident} onRefresh={loadIncident} />
      </div>

      {/* ── Automated Incident Reports (Phase 5) ── */}
      <div style={{ maxWidth: 1320, margin: "0 auto", padding: "0 0 2.5rem" }}>
        <div style={{ background: "var(--bg-surface)", borderRadius: 14, border: "1px solid var(--border-subtle)", padding: "1.5rem", boxShadow: "var(--shadow-card)" }}>
          <ReportPanel incident={incident} userRole={user?.role || "Analyst"} />
        </div>
      </div>

      {/* Resolve Incident Modal */}
      {showResolveModal && (
        <div style={{
          position: "fixed", inset: 0, zIndex: 9999,
          background: "rgba(15, 39, 68, 0.6)", backdropFilter: "blur(4px)",
          display: "flex", alignItems: "center", justifyContent: "center", padding: "1.5rem",
        }}>
          <div style={{
            background: "#fff", borderRadius: 14, width: "100%", maxWidth: 540,
            boxShadow: "0 20px 50px rgba(0,0,0,0.25)", overflow: "hidden",
          }}>
            <div style={{ background: "#0f2744", color: "#fff", padding: "1.1rem 1.5rem", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <div style={{ fontWeight: 800, fontSize: "1rem" }}>
                ✅ Resolve Incident: {incident.incidentId}
              </div>
              <button
                onClick={() => setShowResolveModal(false)}
                style={{ background: "none", border: "none", color: "#fff", cursor: "pointer", fontSize: "1.1rem" }}
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleResolve} style={{ padding: "1.5rem" }}>
              <div style={{ marginBottom: "1rem" }}>
                <label style={{ display: "block", fontSize: "0.8125rem", fontWeight: 700, color: "#334155", marginBottom: 6 }}>
                  Resolution Summary *
                </label>
                <textarea
                  rows={3}
                  required
                  value={resolutionSummary}
                  onChange={(e) => setResolutionSummary(e.target.value)}
                  placeholder="e.g. Attacker IP was blocked on edge firewall, malicious session terminated."
                  style={{ width: "100%", padding: "8px 12px", borderRadius: 8, border: "1px solid #cbd5e1", boxSizing: "border-box" }}
                />
              </div>

              <div style={{ marginBottom: "1rem" }}>
                <label style={{ display: "block", fontSize: "0.8125rem", fontWeight: 700, color: "#334155", marginBottom: 6 }}>
                  Identified Root Cause
                </label>
                <input
                  type="text"
                  value={rootCause}
                  onChange={(e) => setRootCause(e.target.value)}
                  placeholder="e.g. Vulnerable unauthenticated endpoint or brute-force dictionary attack"
                  style={{ width: "100%", padding: "8px 12px", borderRadius: 8, border: "1px solid #cbd5e1", boxSizing: "border-box" }}
                />
              </div>

              <div style={{ marginBottom: "1.5rem" }}>
                <label style={{ display: "block", fontSize: "0.8125rem", fontWeight: 700, color: "#334155", marginBottom: 6 }}>
                  Remediation Action Taken
                </label>
                <input
                  type="text"
                  value={actionTaken}
                  onChange={(e) => setActionTaken(e.target.value)}
                  placeholder="e.g. Patched endpoint, rotated API keys, added rate limit rule"
                  style={{ width: "100%", padding: "8px 12px", borderRadius: 8, border: "1px solid #cbd5e1", boxSizing: "border-box" }}
                />
              </div>

              <div style={{ display: "flex", justifyContent: "flex-end", gap: 10 }}>
                <button
                  type="button"
                  onClick={() => setShowResolveModal(false)}
                  style={{ background: "#f1f5f9", color: "#475569", border: "none", borderRadius: 8, padding: "8px 16px", fontWeight: 700, cursor: "pointer" }}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={resolving}
                  style={{
                    background: "#059669", color: "#fff", border: "none", borderRadius: 8,
                    padding: "8px 18px", fontWeight: 700, cursor: "pointer",
                  }}
                >
                  {resolving ? "Resolving..." : "Confirm Resolution"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Archive Modal (Confirmation) */}
      {showArchiveModal && (
        <ArchiveModal
          incident={incident}
          onClose={() => setShowArchiveModal(false)}
          onSubmit={handleArchive}
          loading={archiving}
        />
      )}
    </DashboardLayout>
  );
};

export default IncidentInvestigation;
