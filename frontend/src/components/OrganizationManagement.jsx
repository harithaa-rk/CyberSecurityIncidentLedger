import React, { useState, useEffect, useCallback } from "react";
import {
  getAllOrganizations,
  getOrganizationById,
  createOrganization,
  updateOrganization,
  toggleOrganizationStatus,
  deleteOrganization,
} from "../services/adminService";

/* ── Inline SVG Icons ── */
const SearchIcon = ({ size = 16 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
  </svg>
);

const PlusIcon = ({ size = 16 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>
  </svg>
);

const EditIcon = ({ size = 15 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
  </svg>
);

const TrashIcon = ({ size = 15 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/><path d="M10 11v6M14 11v6"/><path d="M9 6V4h6v2"/>
  </svg>
);

const EyeIcon = ({ size = 15 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/>
  </svg>
);

const ToggleIcon = ({ size = 15 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <rect x="1" y="5" width="22" height="14" rx="7" ry="7"/><circle cx="16" cy="12" r="3"/>
  </svg>
);

const RefreshIcon = ({ size = 15 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="23 4 23 10 17 10"/><path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10"/>
  </svg>
);

const CloseIcon = ({ size = 18 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
  </svg>
);

const BuildingIcon = ({ size = 16 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <rect x="4" y="2" width="16" height="20" rx="2" ry="2"/><path d="M9 22v-4h6v4M8 6h.01M16 6h.01M12 6h.01M12 10h.01M12 14h.01M16 10h.01M16 14h.01M8 10h.01M8 14h.01"/>
  </svg>
);

/* ── Constants ── */
const ORG_TYPES = ["Government", "Private", "Non-Profit", "Educational", "Healthcare", "Financial", "Technology", "Defense", "Other"];
const STATUS_OPTIONS = ["Active", "Inactive", "Pending"];

/* ── Status & Type Badge Styles ── */
const STATUS_STYLES = {
  Active:   { bg: "#ecfdf5", color: "#059669", border: "#a7f3d0" },
  Inactive: { bg: "#fef2f2", color: "#dc2626", border: "#fecaca" },
  Pending:  { bg: "#fffbeb", color: "#d97706", border: "#fde68a" },
};

const TYPE_STYLES = {
  Government:   { bg: "#eff6ff", color: "#1d4ed8", border: "#bfdbfe" },
  Private:      { bg: "#f8fafc", color: "#475569", border: "#e2e8f0" },
  "Non-Profit": { bg: "#faf5ff", color: "#7c3aed", border: "#ddd6fe" },
  Educational:  { bg: "#fefce8", color: "#a16207", border: "#fef08a" },
  Healthcare:   { bg: "#f0fdf4", color: "#15803d", border: "#bbf7d0" },
  Financial:    { bg: "#fff7ed", color: "#c2410c", border: "#fed7aa" },
  Technology:   { bg: "#ecfeff", color: "#0891b2", border: "#a5f3fc" },
  Defense:      { bg: "#fef2f2", color: "#b91c1c", border: "#fecaca" },
  Other:        { bg: "#f1f5f9", color: "#64748b", border: "#cbd5e1" },
};

const StatusBadge = ({ status }) => {
  const s = STATUS_STYLES[status] || STATUS_STYLES.Pending;
  return (
    <span style={{
      padding: "3px 10px", borderRadius: 999,
      fontSize: "0.75rem", fontWeight: 700, letterSpacing: "0.03em",
      background: s.bg, color: s.color, border: `1px solid ${s.border}`,
      display: "inline-flex", alignItems: "center", gap: 4,
    }}>
      <span style={{ width: 6, height: 6, borderRadius: "50%", background: s.color }} />
      {status}
    </span>
  );
};

const TypeBadge = ({ type }) => {
  const s = TYPE_STYLES[type] || TYPE_STYLES.Other;
  return (
    <span style={{
      padding: "3px 10px", borderRadius: 999,
      fontSize: "0.75rem", fontWeight: 700, letterSpacing: "0.03em",
      background: s.bg, color: s.color, border: `1px solid ${s.border}`,
    }}>
      {type}
    </span>
  );
};

/* ── Spinner ── */
const Spinner = ({ size = 20, color = "#0d7377" }) => (
  <div style={{
    width: size, height: size,
    border: `2.5px solid ${color}30`,
    borderTopColor: color,
    borderRadius: "50%",
    animation: "orgSpin 0.7s linear infinite",
    display: "inline-block",
  }} />
);

/* ── Modal Overlay ── */
const ModalOverlay = ({ children, onClose }) => (
  <div
    onClick={onClose}
    style={{
      position: "fixed", inset: 0, zIndex: 1000,
      background: "rgba(15,39,68,0.55)", backdropFilter: "blur(4px)",
      display: "flex", alignItems: "center", justifyContent: "center",
      animation: "orgFadeIn 0.2s ease",
    }}
  >
    <div onClick={(e) => e.stopPropagation()} style={{
      background: "#fff", borderRadius: 16, padding: "2rem",
      width: "95%", maxWidth: 560, maxHeight: "90vh", overflowY: "auto",
      boxShadow: "0 20px 60px rgba(0,0,0,0.25)",
      animation: "orgSlideUp 0.3s ease",
    }}>
      {children}
    </div>
  </div>
);

/* ── Form Field ── */
const FormField = ({ label, required, children }) => (
  <div style={{ marginBottom: "1rem" }}>
    <label style={{ display: "block", fontSize: "0.8125rem", fontWeight: 700, color: "#374151", marginBottom: 4 }}>
      {label} {required && <span style={{ color: "#dc2626" }}>*</span>}
    </label>
    {children}
  </div>
);

const inputStyle = {
  width: "100%", padding: "10px 14px",
  border: "1.5px solid #d1daea", borderRadius: 10,
  fontSize: "0.875rem", fontFamily: "inherit",
  background: "#f8fafc", transition: "border-color 0.15s",
  outline: "none", boxSizing: "border-box",
};

const selectStyle = { ...inputStyle, cursor: "pointer" };

/* ═══════════════════════════════════════════════
   ORGANIZATION MANAGEMENT COMPONENT
   ═══════════════════════════════════════════════ */
const OrganizationManagement = ({ onOrgUpdated }) => {
  /* State */
  const [organizations, setOrganizations] = useState([]);
  const [pagination, setPagination] = useState({ page: 1, totalPages: 1, total: 0 });
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState({});
  const [toast, setToast] = useState(null);

  /* Filters */
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("All");
  const [typeFilter, setTypeFilter] = useState("All");

  /* Modals */
  const [addModalOpen, setAddModalOpen] = useState(false);
  const [editModalOrg, setEditModalOrg] = useState(null);
  const [detailModalOrg, setDetailModalOrg] = useState(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [confirmDeleteOrg, setConfirmDeleteOrg] = useState(null);

  /* Form state */
  const emptyForm = {
    name: "", type: "Private", contactPerson: "", contactEmail: "",
    phone: "", address: "", sector: "Cybersecurity", status: "Active",
  };
  const [addForm, setAddForm] = useState({ ...emptyForm });
  const [editForm, setEditForm] = useState({ ...emptyForm });

  /* Toast */
  const showToast = (type, msg) => {
    setToast({ type, msg });
    setTimeout(() => setToast(null), 3500);
  };

  /* Fetch organizations */
  const fetchOrganizations = useCallback(async (page = 1) => {
    setLoading(true);
    try {
      const data = await getAllOrganizations(page, 10, searchQuery, statusFilter, typeFilter);
      setOrganizations(data.organizations);
      setPagination({
        page: data.pagination.page,
        totalPages: data.pagination.totalPages,
        total: data.pagination.total,
      });
    } catch (err) {
      console.error("Failed to fetch organizations:", err);
      showToast("error", "Failed to load organizations.");
    } finally {
      setLoading(false);
    }
  }, [searchQuery, statusFilter, typeFilter]);

  useEffect(() => {
    fetchOrganizations(1);
  }, [fetchOrganizations]);

  const notifyChange = () => {
    if (onOrgUpdated) onOrgUpdated();
  };

  /* ── 1. CREATE ── */
  const handleCreateSubmit = async (e) => {
    e.preventDefault();
    if (!addForm.name || !addForm.contactEmail) {
      showToast("error", "Organization name and contact email are required.");
      return;
    }
    setActionLoading((p) => ({ ...p, add: true }));
    try {
      const res = await createOrganization(addForm);
      showToast("success", res.message || "Organization created.");
      setAddModalOpen(false);
      setAddForm({ ...emptyForm });
      fetchOrganizations(1);
      notifyChange();
    } catch (err) {
      showToast("error", err.response?.data?.message || "Failed to create organization.");
    } finally {
      setActionLoading((p) => ({ ...p, add: false }));
    }
  };

  /* ── 2. VIEW DETAILS ── */
  const handleViewDetails = async (orgId) => {
    setDetailLoading(true);
    setDetailModalOrg(null);
    try {
      const data = await getOrganizationById(orgId);
      setDetailModalOrg(data.organization);
    } catch (err) {
      showToast("error", "Failed to load organization details.");
    } finally {
      setDetailLoading(false);
    }
  };

  /* ── 3. EDIT ── */
  const openEditModal = (org) => {
    setEditModalOrg(org);
    setEditForm({
      name: org.name || "",
      type: org.type || "Private",
      contactPerson: org.contactPerson || "",
      contactEmail: org.contactEmail || "",
      phone: org.phone || "",
      address: org.address || "",
      sector: org.sector || "Cybersecurity",
      status: org.status || "Active",
    });
  };

  const handleEditSubmit = async (e) => {
    e.preventDefault();
    if (!editForm.name || !editForm.contactEmail) {
      showToast("error", "Organization name and contact email are required.");
      return;
    }
    setActionLoading((p) => ({ ...p, [`edit_${editModalOrg._id}`]: true }));
    try {
      const res = await updateOrganization(editModalOrg._id, editForm);
      showToast("success", res.message || "Organization updated.");
      setEditModalOrg(null);
      fetchOrganizations(pagination.page);
      notifyChange();
    } catch (err) {
      showToast("error", err.response?.data?.message || "Failed to update organization.");
    } finally {
      setActionLoading((p) => ({ ...p, [`edit_${editModalOrg._id}`]: false }));
    }
  };

  /* ── 4. TOGGLE STATUS ── */
  const handleToggleStatus = async (org) => {
    const newStatus = org.status === "Active" ? "Inactive" : "Active";
    setActionLoading((p) => ({ ...p, [`status_${org._id}`]: true }));
    try {
      const res = await toggleOrganizationStatus(org._id, newStatus);
      showToast("success", res.message || `Status changed to ${newStatus}.`);
      fetchOrganizations(pagination.page);
      notifyChange();
    } catch (err) {
      showToast("error", err.response?.data?.message || "Failed to toggle status.");
    } finally {
      setActionLoading((p) => ({ ...p, [`status_${org._id}`]: false }));
    }
  };

  /* ── 5. DELETE ── */
  const handleDelete = async () => {
    if (!confirmDeleteOrg) return;
    setActionLoading((p) => ({ ...p, [`del_${confirmDeleteOrg._id}`]: true }));
    try {
      const res = await deleteOrganization(confirmDeleteOrg._id);
      showToast("success", res.message || "Organization deleted.");
      setConfirmDeleteOrg(null);
      fetchOrganizations(1);
      notifyChange();
    } catch (err) {
      showToast("error", err.response?.data?.message || "Failed to delete organization.");
    } finally {
      setActionLoading((p) => ({ ...p, [`del_${confirmDeleteOrg?._id}`]: false }));
    }
  };

  /* ── Pagination ── */
  const renderPagination = () => {
    const pages = [];
    const { page, totalPages, total } = pagination;
    const start = Math.max(1, page - 2);
    const end = Math.min(totalPages, page + 2);
    for (let i = start; i <= end; i++) pages.push(i);
    return (
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 12, marginTop: "1.25rem" }}>
        <span style={{ fontSize: "0.8125rem", color: "#5a6e85", fontWeight: 600 }}>
          Showing {organizations.length} of {total} organization{total !== 1 ? "s" : ""}
        </span>
        <div style={{ display: "flex", gap: 4 }}>
          <button className="org-page-btn" disabled={page <= 1} onClick={() => fetchOrganizations(page - 1)}>← Prev</button>
          {pages.map((p) => (
            <button key={p} className={`org-page-btn ${p === page ? "active" : ""}`} onClick={() => fetchOrganizations(p)}>{p}</button>
          ))}
          <button className="org-page-btn" disabled={page >= totalPages} onClick={() => fetchOrganizations(page + 1)}>Next →</button>
        </div>
      </div>
    );
  };

  /* ── Format Date ── */
  const fmtDate = (d) => d ? new Date(d).toLocaleDateString("en-US", { year: "numeric", month: "short", day: "numeric" }) : "—";
  const fmtDateTime = (d) => d ? new Date(d).toLocaleString("en-US", { year: "numeric", month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" }) : "—";

  /* ═══════════ RENDER ═══════════ */
  return (
    <>
      <style>{`
        @keyframes orgSpin { to { transform: rotate(360deg); } }
        @keyframes orgFadeIn { from { opacity:0 } to { opacity:1 } }
        @keyframes orgSlideUp { from { opacity:0; transform:translateY(16px) } to { opacity:1; transform:translateY(0) } }
        @keyframes orgToastIn { from { opacity:0; transform:translateY(12px) } to { opacity:1; transform:translateY(0) } }
        .org-table tr:hover td { background: #f8fafc; }
        .org-action-btn { cursor:pointer; border:none; border-radius:8px; padding:5px 9px;
          display:inline-flex; align-items:center; gap:4px; font-size:0.75rem; font-weight:600;
          font-family:inherit; transition:all 0.15s ease; }
        .org-action-btn:hover:not(:disabled) { opacity:0.88; transform:translateY(-1px); }
        .org-action-btn:disabled { opacity:0.5; cursor:not-allowed; }
        .org-page-btn { cursor:pointer; border:1px solid #d1daea; background:#fff; border-radius:8px;
          padding:6px 14px; font-size:0.875rem; font-weight:600; font-family:inherit;
          color:#0d1b2e; transition:background 0.15s; }
        .org-page-btn:hover:not(:disabled) { background:#f4f7fc; }
        .org-page-btn:disabled { opacity:0.4; cursor:not-allowed; }
        .org-page-btn.active { background:#0d7377; color:#fff; border-color:#0d7377; }
        .org-stat-card { background:#fff; border-radius:12px; padding:1rem 1.25rem;
          border:1px solid #e8edf5; text-align:center; min-width:120px; }
        .org-stat-card .val { font-size:1.5rem; font-weight:800; color:#0f2744; }
        .org-stat-card .lbl { font-size:0.75rem; color:#5a6e85; font-weight:600; margin-top:2px; }
      `}</style>

      {/* Toast */}
      {toast && (
        <div style={{
          position: "fixed", bottom: 24, right: 24, zIndex: 9999,
          background: toast.type === "success" ? "#0a7d55" : "#c0392b",
          color: "#fff", borderRadius: 10, padding: "12px 20px",
          fontSize: "0.9rem", fontWeight: 600, boxShadow: "0 4px 20px rgba(0,0,0,0.2)",
          animation: "orgToastIn 0.3s ease",
          display: "flex", alignItems: "center", gap: 10, maxWidth: 380,
        }}>
          <span>{toast.type === "success" ? "✓" : "⚠"}</span>
          {toast.msg}
        </div>
      )}

      {/* ── Section Card ── */}
      <div style={{
        background: "#fff", borderRadius: 16,
        border: "1px solid #e8edf5",
        boxShadow: "0 2px 12px rgba(15,39,68,0.06)",
        marginTop: "2rem",
      }}>
        {/* Header */}
        <div style={{
          padding: "1.5rem 1.75rem 1rem",
          borderBottom: "1px solid #f0f3f8",
          display: "flex", alignItems: "center", justifyContent: "space-between",
          flexWrap: "wrap", gap: 12,
        }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <div style={{
              width: 36, height: 36, borderRadius: 10,
              background: "linear-gradient(135deg, #0d7377, #14a8ad)",
              display: "flex", alignItems: "center", justifyContent: "center",
              color: "#fff",
            }}>
              <BuildingIcon size={18} />
            </div>
            <div>
              <h2 style={{ fontSize: "1.25rem", fontWeight: 800, color: "#0f2744", margin: 0 }}>
                Organization Management
              </h2>
              <p style={{ fontSize: "0.8125rem", color: "#5a6e85", margin: 0 }}>
                {pagination.total} organization{pagination.total !== 1 ? "s" : ""} registered
              </p>
            </div>
          </div>
          <div style={{ display: "flex", gap: 8 }}>
            <button className="org-action-btn" style={{ background: "#f0f7f7", color: "#0d7377", padding: "8px 14px", borderRadius: 10 }}
              onClick={() => fetchOrganizations(pagination.page)} disabled={loading}>
              <RefreshIcon /> Refresh
            </button>
            <button className="org-action-btn" style={{ background: "#0d7377", color: "#fff", padding: "8px 14px", borderRadius: 10 }}
              onClick={() => setAddModalOpen(true)}>
              <PlusIcon /> Add Organization
            </button>
          </div>
        </div>

        {/* ── Filters Bar ── */}
        <div style={{
          padding: "1rem 1.75rem",
          borderBottom: "1px solid #f0f3f8",
          display: "flex", alignItems: "center", flexWrap: "wrap", gap: 10,
        }}>
          {/* Search */}
          <div style={{ position: "relative", flex: "1 1 220px", minWidth: 200 }}>
            <span style={{ position: "absolute", left: 12, top: "50%", transform: "translateY(-50%)", color: "#94a3b8" }}>
              <SearchIcon />
            </span>
            <input
              type="text" placeholder="Search organizations..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              style={{ ...inputStyle, paddingLeft: 38, background: "#f8fafc" }}
            />
          </div>
          {/* Status Filter */}
          <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}
            style={{ ...selectStyle, width: "auto", minWidth: 130 }}>
            <option value="All">All Status</option>
            {STATUS_OPTIONS.map((s) => <option key={s} value={s}>{s}</option>)}
          </select>
          {/* Type Filter */}
          <select value={typeFilter} onChange={(e) => setTypeFilter(e.target.value)}
            style={{ ...selectStyle, width: "auto", minWidth: 150 }}>
            <option value="All">All Types</option>
            {ORG_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
          </select>
        </div>

        {/* ── Table ── */}
        <div style={{ overflowX: "auto" }}>
          {loading ? (
            <div style={{ display: "flex", justifyContent: "center", padding: "3rem" }}>
              <Spinner size={32} />
            </div>
          ) : organizations.length === 0 ? (
            <div style={{ textAlign: "center", padding: "3rem 1rem", color: "#94a3b8" }}>
              <BuildingIcon size={40} />
              <p style={{ fontWeight: 600, marginTop: 12 }}>No organizations found</p>
            </div>
          ) : (
            <table className="org-table" style={{
              width: "100%", borderCollapse: "collapse",
              fontSize: "0.8375rem", fontFamily: "inherit",
            }}>
              <thead>
                <tr style={{ background: "#f8fafc" }}>
                  {["Organization", "Type", "Contact Person", "Email", "Phone", "Status", "Users", "Created", "Actions"].map((h) => (
                    <th key={h} style={{
                      padding: "10px 14px", textAlign: "left",
                      fontSize: "0.75rem", fontWeight: 700, color: "#64748b",
                      textTransform: "uppercase", letterSpacing: "0.05em",
                      borderBottom: "1px solid #e8edf5", whiteSpace: "nowrap",
                    }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {organizations.map((org) => (
                  <tr key={org._id}>
                    <td style={{ padding: "12px 14px", borderBottom: "1px solid #f0f3f8" }}>
                      <div style={{ fontWeight: 700, color: "#0f2744" }}>{org.name}</div>
                      <div style={{ fontSize: "0.7rem", color: "#94a3b8", fontFamily: "monospace" }}>{org.code}</div>
                    </td>
                    <td style={{ padding: "12px 14px", borderBottom: "1px solid #f0f3f8" }}>
                      <TypeBadge type={org.type || "Other"} />
                    </td>
                    <td style={{ padding: "12px 14px", borderBottom: "1px solid #f0f3f8", color: "#374151" }}>
                      {org.contactPerson || "—"}
                    </td>
                    <td style={{ padding: "12px 14px", borderBottom: "1px solid #f0f3f8", color: "#374151", fontSize: "0.8rem" }}>
                      {org.contactEmail}
                    </td>
                    <td style={{ padding: "12px 14px", borderBottom: "1px solid #f0f3f8", color: "#374151", whiteSpace: "nowrap" }}>
                      {org.phone || "—"}
                    </td>
                    <td style={{ padding: "12px 14px", borderBottom: "1px solid #f0f3f8" }}>
                      <StatusBadge status={org.status} />
                    </td>
                    <td style={{ padding: "12px 14px", borderBottom: "1px solid #f0f3f8", textAlign: "center" }}>
                      <span style={{
                        background: "#eff6ff", color: "#1d4ed8", fontWeight: 700,
                        padding: "2px 10px", borderRadius: 999, fontSize: "0.8rem",
                      }}>
                        {org.totalUsers || 0}
                      </span>
                    </td>
                    <td style={{ padding: "12px 14px", borderBottom: "1px solid #f0f3f8", color: "#64748b", fontSize: "0.8rem", whiteSpace: "nowrap" }}>
                      {fmtDate(org.createdAt)}
                    </td>
                    <td style={{ padding: "12px 14px", borderBottom: "1px solid #f0f3f8" }}>
                      <div style={{ display: "flex", gap: 4, flexWrap: "nowrap" }}>
                        {/* View */}
                        <button className="org-action-btn" title="View Details"
                          style={{ background: "#eff6ff", color: "#1d4ed8" }}
                          onClick={() => handleViewDetails(org._id)}>
                          <EyeIcon />
                        </button>
                        {/* Edit */}
                        <button className="org-action-btn" title="Edit"
                          style={{ background: "#f0fdf4", color: "#15803d" }}
                          onClick={() => openEditModal(org)}>
                          <EditIcon />
                        </button>
                        {/* Toggle Status */}
                        <button className="org-action-btn" title={org.status === "Active" ? "Deactivate" : "Activate"}
                          style={{ background: org.status === "Active" ? "#fffbeb" : "#ecfdf5", color: org.status === "Active" ? "#d97706" : "#059669" }}
                          onClick={() => handleToggleStatus(org)}
                          disabled={actionLoading[`status_${org._id}`]}>
                          {actionLoading[`status_${org._id}`] ? <Spinner size={13} /> : <ToggleIcon />}
                        </button>
                        {/* Delete */}
                        <button className="org-action-btn" title="Delete"
                          style={{ background: "#fef2f2", color: "#dc2626" }}
                          onClick={() => setConfirmDeleteOrg(org)}>
                          <TrashIcon />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        {/* Pagination */}
        {!loading && organizations.length > 0 && (
          <div style={{ padding: "0 1.75rem 1.25rem" }}>
            {renderPagination()}
          </div>
        )}
      </div>

      {/* ═══════ ADD MODAL ═══════ */}
      {addModalOpen && (
        <ModalOverlay onClose={() => setAddModalOpen(false)}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1.25rem" }}>
            <h3 style={{ fontSize: "1.125rem", fontWeight: 800, color: "#0f2744", margin: 0 }}>
              <BuildingIcon size={18} /> Create Organization
            </h3>
            <button onClick={() => setAddModalOpen(false)} style={{ background: "none", border: "none", cursor: "pointer", color: "#94a3b8" }}>
              <CloseIcon />
            </button>
          </div>
          <form onSubmit={handleCreateSubmit}>
            <FormField label="Organization Name" required>
              <input style={inputStyle} value={addForm.name}
                onChange={(e) => setAddForm({ ...addForm, name: e.target.value })}
                placeholder="Enter organization name" />
            </FormField>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
              <FormField label="Organization Type">
                <select style={selectStyle} value={addForm.type}
                  onChange={(e) => setAddForm({ ...addForm, type: e.target.value })}>
                  {ORG_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
                </select>
              </FormField>
              <FormField label="Sector">
                <input style={inputStyle} value={addForm.sector}
                  onChange={(e) => setAddForm({ ...addForm, sector: e.target.value })}
                  placeholder="e.g. Cybersecurity" />
              </FormField>
            </div>
            <FormField label="Contact Person">
              <input style={inputStyle} value={addForm.contactPerson}
                onChange={(e) => setAddForm({ ...addForm, contactPerson: e.target.value })}
                placeholder="Full name" />
            </FormField>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
              <FormField label="Contact Email" required>
                <input type="email" style={inputStyle} value={addForm.contactEmail}
                  onChange={(e) => setAddForm({ ...addForm, contactEmail: e.target.value })}
                  placeholder="email@example.com" />
              </FormField>
              <FormField label="Phone">
                <input style={inputStyle} value={addForm.phone}
                  onChange={(e) => setAddForm({ ...addForm, phone: e.target.value })}
                  placeholder="+1 (555) 000-0000" />
              </FormField>
            </div>
            <FormField label="Address">
              <input style={inputStyle} value={addForm.address}
                onChange={(e) => setAddForm({ ...addForm, address: e.target.value })}
                placeholder="Organization address" />
            </FormField>
            <FormField label="Status">
              <select style={selectStyle} value={addForm.status}
                onChange={(e) => setAddForm({ ...addForm, status: e.target.value })}>
                {STATUS_OPTIONS.map((s) => <option key={s} value={s}>{s}</option>)}
              </select>
            </FormField>
            <div style={{ display: "flex", gap: 10, justifyContent: "flex-end", marginTop: "1.25rem" }}>
              <button type="button" onClick={() => setAddModalOpen(false)}
                style={{ ...inputStyle, width: "auto", cursor: "pointer", fontWeight: 600, padding: "10px 20px", background: "#f1f5f9", border: "1px solid #d1daea" }}>
                Cancel
              </button>
              <button type="submit" disabled={actionLoading.add}
                style={{
                  padding: "10px 24px", background: "#0d7377", color: "#fff",
                  border: "none", borderRadius: 10, fontWeight: 700, fontSize: "0.875rem",
                  cursor: "pointer", fontFamily: "inherit",
                  display: "flex", alignItems: "center", gap: 8,
                }}>
                {actionLoading.add ? <Spinner size={16} color="#fff" /> : <PlusIcon />}
                Create Organization
              </button>
            </div>
          </form>
        </ModalOverlay>
      )}

      {/* ═══════ EDIT MODAL ═══════ */}
      {editModalOrg && (
        <ModalOverlay onClose={() => setEditModalOrg(null)}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1.25rem" }}>
            <h3 style={{ fontSize: "1.125rem", fontWeight: 800, color: "#0f2744", margin: 0 }}>
              <EditIcon size={18} /> Edit Organization
            </h3>
            <button onClick={() => setEditModalOrg(null)} style={{ background: "none", border: "none", cursor: "pointer", color: "#94a3b8" }}>
              <CloseIcon />
            </button>
          </div>
          <form onSubmit={handleEditSubmit}>
            <FormField label="Organization Name" required>
              <input style={inputStyle} value={editForm.name}
                onChange={(e) => setEditForm({ ...editForm, name: e.target.value })}
                placeholder="Enter organization name" />
            </FormField>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
              <FormField label="Organization Type">
                <select style={selectStyle} value={editForm.type}
                  onChange={(e) => setEditForm({ ...editForm, type: e.target.value })}>
                  {ORG_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
                </select>
              </FormField>
              <FormField label="Sector">
                <input style={inputStyle} value={editForm.sector}
                  onChange={(e) => setEditForm({ ...editForm, sector: e.target.value })}
                  placeholder="e.g. Cybersecurity" />
              </FormField>
            </div>
            <FormField label="Contact Person">
              <input style={inputStyle} value={editForm.contactPerson}
                onChange={(e) => setEditForm({ ...editForm, contactPerson: e.target.value })}
                placeholder="Full name" />
            </FormField>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
              <FormField label="Contact Email" required>
                <input type="email" style={inputStyle} value={editForm.contactEmail}
                  onChange={(e) => setEditForm({ ...editForm, contactEmail: e.target.value })}
                  placeholder="email@example.com" />
              </FormField>
              <FormField label="Phone">
                <input style={inputStyle} value={editForm.phone}
                  onChange={(e) => setEditForm({ ...editForm, phone: e.target.value })}
                  placeholder="+1 (555) 000-0000" />
              </FormField>
            </div>
            <FormField label="Address">
              <input style={inputStyle} value={editForm.address}
                onChange={(e) => setEditForm({ ...editForm, address: e.target.value })}
                placeholder="Organization address" />
            </FormField>
            <FormField label="Status">
              <select style={selectStyle} value={editForm.status}
                onChange={(e) => setEditForm({ ...editForm, status: e.target.value })}>
                {STATUS_OPTIONS.map((s) => <option key={s} value={s}>{s}</option>)}
              </select>
            </FormField>
            <div style={{ display: "flex", gap: 10, justifyContent: "flex-end", marginTop: "1.25rem" }}>
              <button type="button" onClick={() => setEditModalOrg(null)}
                style={{ ...inputStyle, width: "auto", cursor: "pointer", fontWeight: 600, padding: "10px 20px", background: "#f1f5f9", border: "1px solid #d1daea" }}>
                Cancel
              </button>
              <button type="submit" disabled={actionLoading[`edit_${editModalOrg._id}`]}
                style={{
                  padding: "10px 24px", background: "#0d7377", color: "#fff",
                  border: "none", borderRadius: 10, fontWeight: 700, fontSize: "0.875rem",
                  cursor: "pointer", fontFamily: "inherit",
                  display: "flex", alignItems: "center", gap: 8,
                }}>
                {actionLoading[`edit_${editModalOrg._id}`] ? <Spinner size={16} color="#fff" /> : <EditIcon />}
                Save Changes
              </button>
            </div>
          </form>
        </ModalOverlay>
      )}

      {/* ═══════ DETAILS MODAL ═══════ */}
      {(detailModalOrg || detailLoading) && (
        <ModalOverlay onClose={() => { setDetailModalOrg(null); setDetailLoading(false); }}>
          {detailLoading ? (
            <div style={{ display: "flex", justifyContent: "center", padding: "3rem" }}>
              <Spinner size={32} />
            </div>
          ) : detailModalOrg && (
            <>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1.25rem" }}>
                <h3 style={{ fontSize: "1.125rem", fontWeight: 800, color: "#0f2744", margin: 0 }}>
                  🏢 Organization Details
                </h3>
                <button onClick={() => setDetailModalOrg(null)} style={{ background: "none", border: "none", cursor: "pointer", color: "#94a3b8" }}>
                  <CloseIcon />
                </button>
              </div>

              {/* Stats Cards */}
              {detailModalOrg.stats && (
                <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 10, marginBottom: "1.5rem" }}>
                  <div className="org-stat-card">
                    <div className="val">{detailModalOrg.stats.totalUsers}</div>
                    <div className="lbl">Total Users</div>
                  </div>
                  <div className="org-stat-card">
                    <div className="val">{detailModalOrg.stats.activeUsers}</div>
                    <div className="lbl">Active Users</div>
                  </div>
                  <div className="org-stat-card">
                    <div className="val">{detailModalOrg.stats.totalSecurityLogs}</div>
                    <div className="lbl">Security Logs</div>
                  </div>
                  <div className="org-stat-card">
                    <div className="val" style={{ color: detailModalOrg.stats.criticalIncidents > 0 ? "#dc2626" : "#0f2744" }}>
                      {detailModalOrg.stats.criticalIncidents}
                    </div>
                    <div className="lbl">Critical</div>
                  </div>
                </div>
              )}

              {/* Detail Rows */}
              <div style={{ background: "#f8fafc", borderRadius: 12, padding: "1.25rem", border: "1px solid #e8edf5" }}>
                {[
                  ["Organization Name", detailModalOrg.name],
                  ["Code", <span style={{ fontFamily: "monospace", fontWeight: 700 }}>{detailModalOrg.code}</span>],
                  ["Type", <TypeBadge type={detailModalOrg.type || "Other"} />],
                  ["Status", <StatusBadge status={detailModalOrg.status} />],
                  ["Contact Person", detailModalOrg.contactPerson || "—"],
                  ["Email", detailModalOrg.contactEmail],
                  ["Phone", detailModalOrg.phone || "—"],
                  ["Address", detailModalOrg.address || "—"],
                  ["Sector", detailModalOrg.sector || "—"],
                  ["Created", fmtDateTime(detailModalOrg.createdAt)],
                  ["Last Updated", fmtDateTime(detailModalOrg.updatedAt)],
                ].map(([label, value], i) => (
                  <div key={label} style={{
                    display: "flex", justifyContent: "space-between", alignItems: "center",
                    padding: "8px 0",
                    borderBottom: i < 10 ? "1px solid #e8edf5" : "none",
                  }}>
                    <span style={{ fontSize: "0.8125rem", fontWeight: 600, color: "#64748b" }}>{label}</span>
                    <span style={{ fontSize: "0.875rem", fontWeight: 600, color: "#0f2744", textAlign: "right" }}>{value}</span>
                  </div>
                ))}
              </div>

              <div style={{ display: "flex", justifyContent: "flex-end", marginTop: "1.25rem" }}>
                <button onClick={() => setDetailModalOrg(null)}
                  style={{
                    padding: "10px 24px", background: "#0d7377", color: "#fff",
                    border: "none", borderRadius: 10, fontWeight: 700, fontSize: "0.875rem",
                    cursor: "pointer", fontFamily: "inherit",
                  }}>
                  Close
                </button>
              </div>
            </>
          )}
        </ModalOverlay>
      )}

      {/* ═══════ DELETE CONFIRM MODAL ═══════ */}
      {confirmDeleteOrg && (
        <ModalOverlay onClose={() => setConfirmDeleteOrg(null)}>
          <div style={{ textAlign: "center", padding: "1rem 0" }}>
            <div style={{
              width: 56, height: 56, borderRadius: "50%", margin: "0 auto 1rem",
              background: "#fef2f2", display: "flex", alignItems: "center", justifyContent: "center",
            }}>
              <TrashIcon size={24} />
            </div>
            <h3 style={{ fontSize: "1.125rem", fontWeight: 800, color: "#0f2744", margin: "0 0 0.5rem" }}>
              Delete Organization?
            </h3>
            <p style={{ color: "#64748b", fontSize: "0.875rem", margin: "0 0 0.25rem" }}>
              Are you sure you want to delete <strong>{confirmDeleteOrg.name}</strong>?
            </p>
            <p style={{ color: "#dc2626", fontSize: "0.8rem", fontWeight: 600, margin: "0 0 1.5rem" }}>
              All users assigned to this organization will be unlinked. This action cannot be undone.
            </p>
            <div style={{ display: "flex", gap: 10, justifyContent: "center" }}>
              <button onClick={() => setConfirmDeleteOrg(null)}
                style={{
                  padding: "10px 24px", background: "#f1f5f9", color: "#374151",
                  border: "1px solid #d1daea", borderRadius: 10, fontWeight: 600,
                  fontSize: "0.875rem", cursor: "pointer", fontFamily: "inherit",
                }}>
                Cancel
              </button>
              <button onClick={handleDelete} disabled={actionLoading[`del_${confirmDeleteOrg._id}`]}
                style={{
                  padding: "10px 24px", background: "#dc2626", color: "#fff",
                  border: "none", borderRadius: 10, fontWeight: 700, fontSize: "0.875rem",
                  cursor: "pointer", fontFamily: "inherit",
                  display: "flex", alignItems: "center", gap: 8,
                }}>
                {actionLoading[`del_${confirmDeleteOrg._id}`] ? <Spinner size={16} color="#fff" /> : <TrashIcon />}
                Delete
              </button>
            </div>
          </div>
        </ModalOverlay>
      )}
    </>
  );
};

export default OrganizationManagement;
