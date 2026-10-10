import React, { useState } from "react";

const CloseIcon = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
  </svg>
);

const modalBackdropStyle = {
  position: "fixed", inset: 0, zIndex: 9500,
  background: "rgba(15, 39, 68, 0.6)", backdropFilter: "blur(4px)",
  display: "flex", alignItems: "center", justifyContent: "center", padding: "1.5rem",
};

const modalContainerStyle = {
  background: "#fff", borderRadius: 14, width: "100%", maxWidth: 520,
  boxShadow: "0 20px 50px rgba(0,0,0,0.25)", overflow: "hidden",
  animation: "modalFadeIn 0.2s ease-out",
};

const headerStyle = {
  background: "#0f2744", color: "#fff", padding: "1.1rem 1.5rem",
  display: "flex", alignItems: "center", justifyContent: "space-between",
};

/* ── ASSIGN MODAL ── */
export const AssignModal = ({ incident, analysts = [], onClose, onSubmit, loading }) => {
  const [selectedAnalystId, setSelectedAnalystId] = useState(
    incident?.assignedTo?._id || incident?.assignedTo || ""
  );
  const [note, setNote] = useState("");

  if (!incident) return null;

  const handleSubmit = (e) => {
    e.preventDefault();
    onSubmit({ analystId: selectedAnalystId || null, note });
  };

  return (
    <div style={modalBackdropStyle}>
      <div style={modalContainerStyle}>
        <div style={headerStyle}>
          <div style={{ fontWeight: 800, fontSize: "1rem" }}>
            👤 Assign Incident: {incident.incidentId}
          </div>
          <button onClick={onClose} style={{ background: "none", border: "none", color: "#fff", cursor: "pointer" }}>
            <CloseIcon />
          </button>
        </div>

        <form onSubmit={handleSubmit} style={{ padding: "1.5rem" }}>
          <div style={{ marginBottom: "1rem" }}>
            <label style={{ display: "block", fontSize: "0.8125rem", fontWeight: 700, color: "#334155", marginBottom: 6 }}>
              Select Analyst
            </label>
            <select
              value={selectedAnalystId}
              onChange={(e) => setSelectedAnalystId(e.target.value)}
              style={{
                width: "100%", padding: "10px 12px", borderRadius: 8,
                border: "1px solid #cbd5e1", fontSize: "0.875rem", fontFamily: "inherit",
              }}
            >
              <option value="">-- Unassigned --</option>
              {analysts.map((a) => (
                <option key={a._id} value={a._id}>
                  {a.name} ({a.email}) — [{a.role}]
                </option>
              ))}
            </select>
          </div>

          <div style={{ marginBottom: "1.25rem" }}>
            <label style={{ display: "block", fontSize: "0.8125rem", fontWeight: 700, color: "#334155", marginBottom: 6 }}>
              Assignment Note (Optional)
            </label>
            <textarea
              rows={3}
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="e.g. Please prioritize threat verification and isolate host IP..."
              style={{
                width: "100%", padding: "10px 12px", borderRadius: 8,
                border: "1px solid #cbd5e1", fontSize: "0.875rem", fontFamily: "inherit",
                resize: "vertical", boxSizing: "border-box",
              }}
            />
          </div>

          <div style={{ display: "flex", justifyContent: "flex-end", gap: 10 }}>
            <button
              type="button"
              onClick={onClose}
              disabled={loading}
              style={{
                background: "#f1f5f9", color: "#475569", border: "none",
                borderRadius: 8, padding: "8px 16px", fontWeight: 700, cursor: "pointer",
              }}
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading}
              style={{
                background: "linear-gradient(135deg, #0d7377, #14a8ad)",
                color: "#fff", border: "none", borderRadius: 8,
                padding: "8px 18px", fontWeight: 700, cursor: "pointer",
              }}
            >
              {loading ? "Assigning..." : "Confirm Assignment"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

/* ── INVESTIGATE MODAL ── */
export const InvestigateModal = ({ incident, onClose, onSubmit, loading }) => {
  const [notes, setNotes] = useState("");

  if (!incident) return null;

  const handleSubmit = (e) => {
    e.preventDefault();
    onSubmit({ notes });
  };

  return (
    <div style={modalBackdropStyle}>
      <div style={modalContainerStyle}>
        <div style={headerStyle}>
          <div style={{ fontWeight: 800, fontSize: "1rem" }}>
            🔍 Start Investigation: {incident.incidentId}
          </div>
          <button onClick={onClose} style={{ background: "none", border: "none", color: "#fff", cursor: "pointer" }}>
            <CloseIcon />
          </button>
        </div>

        <form onSubmit={handleSubmit} style={{ padding: "1.5rem" }}>
          <p style={{ margin: "0 0 1rem", fontSize: "0.875rem", color: "#475569", lineHeight: 1.5 }}>
            Transition this incident status to <strong>INVESTIGATING</strong>. You can record initial hypotheses or diagnostic steps below.
          </p>

          <div style={{ marginBottom: "1.25rem" }}>
            <label style={{ display: "block", fontSize: "0.8125rem", fontWeight: 700, color: "#334155", marginBottom: 6 }}>
              Investigation Notes
            </label>
            <textarea
              rows={4}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="e.g. Initiating packet trace analysis and host memory inspection..."
              style={{
                width: "100%", padding: "10px 12px", borderRadius: 8,
                border: "1px solid #cbd5e1", fontSize: "0.875rem", fontFamily: "inherit",
                resize: "vertical", boxSizing: "border-box",
              }}
            />
          </div>

          <div style={{ display: "flex", justifyContent: "flex-end", gap: 10 }}>
            <button
              type="button"
              onClick={onClose}
              disabled={loading}
              style={{
                background: "#f1f5f9", color: "#475569", border: "none",
                borderRadius: 8, padding: "8px 16px", fontWeight: 700, cursor: "pointer",
              }}
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading}
              style={{
                background: "#d97706", color: "#fff", border: "none",
                borderRadius: 8, padding: "8px 18px", fontWeight: 700, cursor: "pointer",
              }}
            >
              {loading ? "Starting..." : "Begin Investigation"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

/* ── RESOLVE MODAL ── */
export const ResolveModal = ({ incident, onClose, onSubmit, loading }) => {
  const [resolutionSummary, setResolutionSummary] = useState("");
  const [rootCause, setRootCause] = useState("");
  const [actionTaken, setActionTaken] = useState("");
  const [error, setError] = useState("");

  if (!incident) return null;

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!resolutionSummary.trim()) {
      setError("Resolution summary is required.");
      return;
    }
    onSubmit({ resolutionSummary, rootCause, actionTaken });
  };

  return (
    <div style={modalBackdropStyle}>
      <div style={{ ...modalContainerStyle, maxWidth: 560 }}>
        <div style={headerStyle}>
          <div style={{ fontWeight: 800, fontSize: "1rem" }}>
            ✅ Resolve Incident: {incident.incidentId}
          </div>
          <button onClick={onClose} style={{ background: "none", border: "none", color: "#fff", cursor: "pointer" }}>
            <CloseIcon />
          </button>
        </div>

        <form onSubmit={handleSubmit} style={{ padding: "1.5rem" }}>
          {error && (
            <div style={{
              background: "#fef2f2", color: "#b91c1c", padding: "8px 12px",
              borderRadius: 6, fontSize: "0.8125rem", marginBottom: 12, fontWeight: 600,
            }}>
              {error}
            </div>
          )}

          <div style={{ marginBottom: "1rem" }}>
            <label style={{ display: "block", fontSize: "0.8125rem", fontWeight: 700, color: "#334155", marginBottom: 6 }}>
              Resolution Summary <span style={{ color: "#dc2626" }}>*</span>
            </label>
            <input
              type="text"
              value={resolutionSummary}
              onChange={(e) => { setResolutionSummary(e.target.value); setError(""); }}
              placeholder="e.g. Attacker IP blocked and vulnerable endpoint patched"
              style={{
                width: "100%", padding: "10px 12px", borderRadius: 8,
                border: "1px solid #cbd5e1", fontSize: "0.875rem", fontFamily: "inherit",
                boxSizing: "border-box",
              }}
            />
          </div>

          <div style={{ marginBottom: "1rem" }}>
            <label style={{ display: "block", fontSize: "0.8125rem", fontWeight: 700, color: "#334155", marginBottom: 6 }}>
              Root Cause Analysis
            </label>
            <textarea
              rows={2}
              value={rootCause}
              onChange={(e) => setRootCause(e.target.value)}
              placeholder="e.g. Outdated Apache web application firewall rule allowing payload bypass"
              style={{
                width: "100%", padding: "10px 12px", borderRadius: 8,
                border: "1px solid #cbd5e1", fontSize: "0.875rem", fontFamily: "inherit",
                resize: "vertical", boxSizing: "border-box",
              }}
            />
          </div>

          <div style={{ marginBottom: "1.25rem" }}>
            <label style={{ display: "block", fontSize: "0.8125rem", fontWeight: 700, color: "#334155", marginBottom: 6 }}>
              Remediation Action Taken
            </label>
            <textarea
              rows={2}
              value={actionTaken}
              onChange={(e) => setActionTaken(e.target.value)}
              placeholder="e.g. Added IP to egress firewall drop list and updated ModSecurity rules"
              style={{
                width: "100%", padding: "10px 12px", borderRadius: 8,
                border: "1px solid #cbd5e1", fontSize: "0.875rem", fontFamily: "inherit",
                resize: "vertical", boxSizing: "border-box",
              }}
            />
          </div>

          <div style={{ display: "flex", justifyContent: "flex-end", gap: 10 }}>
            <button
              type="button"
              onClick={onClose}
              disabled={loading}
              style={{
                background: "#f1f5f9", color: "#475569", border: "none",
                borderRadius: 8, padding: "8px 16px", fontWeight: 700, cursor: "pointer",
              }}
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading}
              style={{
                background: "#059669", color: "#fff", border: "none",
                borderRadius: 8, padding: "8px 18px", fontWeight: 700, cursor: "pointer",
              }}
            >
              {loading ? "Resolving..." : "Confirm Resolution"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

/* ── ARCHIVE MODAL ── */
export const ArchiveModal = ({ incident, onClose, onSubmit, loading }) => {
  const [note, setNote] = useState("");

  if (!incident) return null;

  const handleSubmit = (e) => {
    e.preventDefault();
    onSubmit({ note });
  };

  return (
    <div style={modalBackdropStyle}>
      <div style={modalContainerStyle}>
        <div style={headerStyle}>
          <div style={{ fontWeight: 800, fontSize: "1rem" }}>
            📦 Archive Incident: {incident.incidentId}
          </div>
          <button onClick={onClose} style={{ background: "none", border: "none", color: "#fff", cursor: "pointer" }}>
            <CloseIcon />
          </button>
        </div>

        <form onSubmit={handleSubmit} style={{ padding: "1.5rem" }}>
          <div style={{
            background: "#fff7ed", border: "1px solid #fdba74", borderRadius: 8,
            padding: "12px 14px", marginBottom: "1.25rem", color: "#9a3412",
          }}>
            <div style={{ fontWeight: 800, fontSize: "0.9375rem", marginBottom: 4, display: "flex", alignItems: "center", gap: 6 }}>
              <span>⚠️</span> Archive this resolved incident?
            </div>
            <div style={{ fontSize: "0.8125rem", lineHeight: 1.5, color: "#7c2d12" }}>
              Archiving will lock <strong>{incident.incidentId}</strong> as a permanent, read-only record. It will <strong>NOT</strong> be deleted from MongoDB and will remain accessible in the Archived Incidents repository for historical review and audit compliance.
            </div>
          </div>

          <div style={{ marginBottom: "1.25rem" }}>
            <label style={{ display: "block", fontSize: "0.8125rem", fontWeight: 700, color: "#334155", marginBottom: 6 }}>
              Archival Audit Note (Optional)
            </label>
            <input
              type="text"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="e.g. Post-incident root cause documented, locked for compliance"
              style={{
                width: "100%", padding: "10px 12px", borderRadius: 8,
                border: "1px solid #cbd5e1", fontSize: "0.875rem", fontFamily: "inherit",
                boxSizing: "border-box",
              }}
            />
          </div>

          <div style={{ display: "flex", justifyContent: "flex-end", gap: 10 }}>
            <button
              type="button"
              onClick={onClose}
              disabled={loading}
              style={{
                background: "#f1f5f9", color: "#475569", border: "none",
                borderRadius: 8, padding: "8px 16px", fontWeight: 700, cursor: "pointer",
              }}
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading}
              style={{
                background: "#475569", color: "#fff", border: "none",
                borderRadius: 8, padding: "8px 18px", fontWeight: 700, cursor: "pointer",
              }}
            >
              {loading ? "Archiving..." : "Confirm Archive"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
