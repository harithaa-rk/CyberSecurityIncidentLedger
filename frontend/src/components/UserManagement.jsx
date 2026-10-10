import React, { useState, useEffect, useCallback } from "react";
import { useAuth } from "../context/AuthContext";
import {
  getAllUsers,
  createUser,
  updateUser,
  assignUserRole,
  resetUserPassword,
  toggleUserActive,
  deleteUser,
  getAllOrganizations,
} from "../services/adminService";
import PasswordStrength from "./PasswordStrength";

/* Inline SVG Icons */
const SearchIcon = ({ size = 16 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
  </svg>
);

const UserPlusIcon = ({ size = 16 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M16 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="8.5" cy="7" r="4"/><line x1="20" y1="8" x2="20" y2="14"/><line x1="23" y1="11" x2="17" y2="11"/>
  </svg>
);

const EditIcon = ({ size = 15 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
  </svg>
);

const KeyIcon = ({ size = 15 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M21 2l-2 2m-7.61 7.61a5.5 5.5 0 1 1-7.778 7.778 5.5 5.5 0 0 1 7.777-7.777zm0 0L15.5 7.5m0 0l3 3L22 7l-3-3m-3.5 3.5L19 4"/>
  </svg>
);

const ShieldIcon = ({ size = 15 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>
  </svg>
);

const ToggleIcon = ({ size = 15 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <rect x="1" y="5" width="22" height="14" rx="7" ry="7"/><circle cx="16" cy="12" r="3"/>
  </svg>
);

const TrashIcon = ({ size = 15 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/><path d="M10 11v6M14 11v6"/><path d="M9 6V4h6v2"/>
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

/* Role Badge Styles */
const ROLE_STYLES = {
  Admin:   { bg: "#fef2f2", color: "#b91c1c", border: "#fecaca" },
  Analyst: { bg: "#eff6ff", color: "#1d4ed8", border: "#bfdbfe" },
  Auditor: { bg: "#f0fdf4", color: "#15803d", border: "#bbf7d0" },
  User:    { bg: "#f8fafc", color: "#475569", border: "#e2e8f0" },
};

const RoleBadge = ({ role }) => {
  const s = ROLE_STYLES[role] || ROLE_STYLES.User;
  return (
    <span style={{
      padding: "3px 10px", borderRadius: 999,
      fontSize: "0.75rem", fontWeight: 700, letterSpacing: "0.03em",
      background: s.bg, color: s.color, border: `1px solid ${s.border}`,
      display: "inline-flex", alignItems: "center", gap: 4,
    }}>
      {role === "Admin" && "🛡 "}
      {role === "Analyst" && "🔍 "}
      {role === "Auditor" && "📋 "}
      {role === "User" && "👤 "}
      {role}
    </span>
  );
};

/* Spinner */
const Spinner = ({ size = 20, color = "#0d7377" }) => (
  <div style={{
    width: size, height: size,
    border: `2.5px solid ${color}30`,
    borderTopColor: color,
    borderRadius: "50%",
    animation: "umSpin 0.7s linear infinite",
    display: "inline-block",
  }} />
);

const UserManagement = ({ onUserUpdated }) => {
  const { user: currentUser } = useAuth();

  /* State */
  const [users, setUsers] = useState([]);
  const [pagination, setPagination] = useState({ page: 1, totalPages: 1, total: 0 });
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState({});
  const [toast, setToast] = useState(null);

  /* Filters */
  const [searchQuery, setSearchQuery] = useState("");
  const [roleFilter, setRoleFilter] = useState("All");
  const [statusFilter, setStatusFilter] = useState("All");

  /* Modals State */
  const [addModalOpen, setAddModalOpen] = useState(false);
  const [editUserModal, setEditUserModal] = useState(null);
  const [roleModalUser, setRoleModalUser] = useState(null);
  const [resetModalUser, setResetModalUser] = useState(null);
  const [confirmDeleteUser, setConfirmDeleteUser] = useState(null);

  /* Form Data */
  const [addForm, setAddForm] = useState({ name: "", email: "", organization: "", role: "User", password: "" });
  const [editForm, setEditForm] = useState({ name: "", email: "", organization: "" });
  const [selectedRole, setSelectedRole] = useState("User");
  const [newPassword, setNewPassword] = useState("");

  /* Toast notification handler */
  const showToast = (type, msg) => {
    setToast({ type, msg });
    setTimeout(() => setToast(null), 3500);
  };

  const [organizationsList, setOrganizationsList] = useState([]);

  /* Fetch users with filters and pagination */
  const fetchUsers = useCallback(async (page = 1) => {
    setLoading(true);
    try {
      const data = await getAllUsers(page, 10, searchQuery, roleFilter, statusFilter);
      setUsers(data.users);
      setPagination({
        page: data.pagination.page,
        totalPages: data.pagination.totalPages,
        total: data.pagination.total,
      });
    } catch (err) {
      console.error("Failed to fetch users:", err);
      showToast("error", "Failed to load user records.");
    } finally {
      setLoading(false);
    }
  }, [searchQuery, roleFilter, statusFilter]);

  const fetchOrgs = useCallback(async () => {
    try {
      const data = await getAllOrganizations(1, 100);
      setOrganizationsList(data.organizations || []);
    } catch (err) {
      console.error("Failed to fetch organizations list for user assignment:", err);
    }
  }, []);

  useEffect(() => {
    fetchUsers(1);
    fetchOrgs();
  }, [fetchUsers, fetchOrgs]);

  const notifyChange = () => {
    if (onUserUpdated) onUserUpdated();
  };

  /* 1. Add User */
  const handleAddSubmit = async (e) => {
    e.preventDefault();
    if (!addForm.name || !addForm.email || !addForm.password) {
      showToast("error", "Please fill in all required fields.");
      return;
    }
    if (addForm.password.length < 8) {
      showToast("error", "Password must be at least 8 characters.");
      return;
    }

    setActionLoading((prev) => ({ ...prev, add: true }));
    try {
      const res = await createUser(addForm);
      showToast("success", res.message || "User created successfully.");
      setAddModalOpen(false);
      setAddForm({ name: "", email: "", organization: "", role: "User", password: "" });
      fetchUsers(1);
      notifyChange();
    } catch (err) {
      showToast("error", err.response?.data?.message || "Failed to create user.");
    } finally {
      setActionLoading((prev) => ({ ...prev, add: false }));
    }
  };

  /* 2. Edit User */
  const openEditModal = (user) => {
    setEditUserModal(user);
    setEditForm({
      name: user.name || "",
      email: user.email || "",
      organization: user.organization?._id || user.organization || "",
    });
  };

  const handleEditSubmit = async (e) => {
    e.preventDefault();
    if (!editForm.name || !editForm.email) {
      showToast("error", "Name and Email are required.");
      return;
    }

    setActionLoading((prev) => ({ ...prev, [editUserModal._id]: true }));
    try {
      const res = await updateUser(editUserModal._id, editForm);
      showToast("success", res.message || "User updated successfully.");
      setUsers((prev) =>
        prev.map((u) =>
          u._id === editUserModal._id
            ? { ...u, name: res.user?.name || editForm.name, email: res.user?.email || editForm.email, organization: res.user?.organization || editForm.organization }
            : u
        )
      );
      setEditUserModal(null);
      fetchUsers(pagination.page);
      notifyChange();
    } catch (err) {
      showToast("error", err.response?.data?.message || "Failed to update user.");
    } finally {
      setActionLoading((prev) => ({ ...prev, [editUserModal._id]: false }));
    }
  };

  /* 3. Assign Role */
  const openRoleModal = (user) => {
    setRoleModalUser(user);
    setSelectedRole(user.role || "User");
  };

  const handleRoleSubmit = async (e) => {
    e.preventDefault();
    setActionLoading((prev) => ({ ...prev, [roleModalUser._id]: true }));
    try {
      const res = await assignUserRole(roleModalUser._id, selectedRole);
      showToast("success", res.message || "Role updated successfully.");
      setUsers((prev) =>
        prev.map((u) => (u._id === roleModalUser._id ? { ...u, role: selectedRole } : u))
      );
      setRoleModalUser(null);
      fetchUsers(pagination.page);
      notifyChange();
    } catch (err) {
      showToast("error", err.response?.data?.message || "Failed to assign role.");
    } finally {
      setActionLoading((prev) => ({ ...prev, [roleModalUser._id]: false }));
    }
  };

  /* 4. Reset Password */
  const openResetModal = (user) => {
    setResetModalUser(user);
    setNewPassword("");
  };

  const handleResetSubmit = async (e) => {
    e.preventDefault();
    if (!newPassword || newPassword.length < 8) {
      showToast("error", "New password must be at least 8 characters.");
      return;
    }

    setActionLoading((prev) => ({ ...prev, [resetModalUser._id]: true }));
    try {
      const res = await resetUserPassword(resetModalUser._id, newPassword);
      showToast("success", res.message || "Password reset successfully.");
      setResetModalUser(null);
      setNewPassword("");
    } catch (err) {
      showToast("error", err.response?.data?.message || "Failed to reset password.");
    } finally {
      setActionLoading((prev) => ({ ...prev, [resetModalUser._id]: false }));
    }
  };

  /* 5. Activate / Deactivate */
  const handleToggle = async (user) => {
    setActionLoading((prev) => ({ ...prev, [user._id]: true }));
    try {
      const res = await toggleUserActive(user._id);
      showToast("success", res.message);
      setUsers((prev) =>
        prev.map((u) => (u._id === user._id ? { ...u, isActive: res.isActive } : u))
      );
      notifyChange();
    } catch (err) {
      showToast("error", err.response?.data?.message || "Status toggle failed.");
    } finally {
      setActionLoading((prev) => ({ ...prev, [user._id]: false }));
    }
  };

  /* 6. Delete User */
  const handleDelete = async (user) => {
    setConfirmDeleteUser(null);
    setActionLoading((prev) => ({ ...prev, [user._id]: true }));
    try {
      const res = await deleteUser(user._id);
      showToast("success", res.message);
      fetchUsers(pagination.page);
      notifyChange();
    } catch (err) {
      showToast("error", err.response?.data?.message || "Delete failed.");
    } finally {
      setActionLoading((prev) => ({ ...prev, [user._id]: false }));
    }
  };

  const fmtDateTime = (iso) => {
    if (!iso) return "Never logged in";
    const d = new Date(iso);
    return (
      d.toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" }) +
      " " +
      d.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" })
    );
  };

  return (
    <>
      <style>{`
        @keyframes umSpin { to { transform: rotate(360deg); } }
        @keyframes umToastIn { from { opacity:0; transform:translateY(12px); } to { opacity:1; transform:translateY(0); } }
        @keyframes umModalIn { from { opacity:0; transform:scale(0.96) translateY(10px); } to { opacity:1; transform:scale(1) translateY(0); } }
        
        .um-table tr:hover td { background: var(--color-gold-soft, rgba(244, 197, 66, 0.08)) !important; }
        .um-table th { color: var(--text-muted) !important; background: var(--bg-secondary) !important; border-bottom: 1px solid var(--border-subtle) !important; font-family: var(--font-mono) !important; }
        .um-table td { border-bottom: 1px solid var(--border-subtle) !important; color: var(--text-primary) !important; }
        .um-table tr { background: var(--bg-surface); }
        .um-action-btn { cursor:pointer; border:none; border-radius:6px; padding:6px 10px;
          display:inline-flex; align-items:center; gap:5px; font-size:0.78125rem; font-weight:600;
          font-family:var(--font-heading); transition:all 0.15s ease; outline:none; }
        .um-action-btn:hover:not(:disabled) { opacity:0.88; transform:translateY(-1px); }
        .um-action-btn:disabled { opacity:0.5; cursor:not-allowed; }
        
        .um-page-btn { cursor:pointer; border:1px solid var(--border-subtle); background:var(--bg-surface); border-radius:8px;
          padding:6px 12px; font-size:0.8125rem; font-weight:600; font-family:var(--font-heading);
          color:var(--text-primary); transition:all 0.15s; }
        .um-page-btn:hover:not(:disabled) { background:var(--bg-secondary); border-color:var(--color-gold); color:var(--color-gold); }
        .um-page-btn:disabled { opacity:0.4; cursor:not-allowed; }
        .um-page-btn.active { background:var(--color-gold); color:var(--text-inverse); border-color:var(--color-gold); }

        .um-form-input {
          width: 100%; padding: 0.65rem 0.85rem; font-size: 0.875rem;
          border: 1px solid var(--border-subtle); border-radius: 8px; outline: none;
          transition: border-color 0.2s, box-shadow 0.2s; background: var(--bg-secondary);
          color: var(--text-primary); font-family: var(--font-sans);
        }
        .um-form-input:focus {
          border-color: var(--color-gold); background: var(--bg-surface);
          box-shadow: 0 0 0 3px var(--color-gold-soft);
        }
        .um-modal-box {
          background: var(--bg-surface) !important;
          border: 1px solid var(--border-subtle) !important;
          color: var(--text-primary) !important;
          box-shadow: var(--shadow-obsidian) !important;
        }
      `}</style>

      {/* Toast Alert */}
      {toast && (
        <div style={{
          position: "fixed", bottom: 24, right: 24, zIndex: 9999,
          background: toast.type === "success" ? "#0a7d55" : "#c0392b",
          color: "#fff", borderRadius: 10, padding: "12px 20px",
          fontSize: "0.9rem", fontWeight: 600, boxShadow: "0 6px 24px rgba(0,0,0,0.25)",
          animation: "umToastIn 0.3s ease",
          display: "flex", alignItems: "center", gap: 10, maxWidth: 400,
        }}>
          <span>{toast.type === "success" ? "✓" : "⚠"}</span>
          {toast.msg}
        </div>
      )}

      {/* Main Container */}
      <div style={{
        background: "var(--bg-surface)", borderRadius: 16,
        border: "1px solid var(--border-subtle)",
        boxShadow: "var(--shadow-card)",
        overflow: "hidden",
        marginBottom: "2rem",
      }}>

        {/* Component Header / Controls Bar */}
        <div style={{
          padding: "1.5rem", borderBottom: "1px solid var(--border-subtle)",
          display: "flex", flexDirection: "column", gap: 16,
        }}>
          {/* Title Row */}
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 16 }}>
            <div>
              <h2 style={{ fontSize: "1.25rem", fontWeight: 800, color: "var(--text-primary)", margin: 0, display: "flex", alignItems: "center", gap: 8, fontFamily: "var(--font-heading)" }}>
                <ShieldIcon size={20} /> User Accounts & Role Ledger
              </h2>
              <p style={{ fontSize: "0.8125rem", color: "var(--text-secondary)", margin: "4px 0 0" }}>
                Manage user access, role assignments, passwords, and organization associations ({pagination.total} account{pagination.total !== 1 ? "s" : ""})
              </p>
            </div>

            {/* Add User Button */}
            <button
              className="um-action-btn"
              style={{
                background: "var(--color-gold)",
                color: "var(--text-inverse)", padding: "9px 18px", borderRadius: 10, fontSize: "0.875rem",
                boxShadow: "0 4px 12px rgba(244, 197, 66, 0.25)",
                fontFamily: "var(--font-heading)",
              }}
              onClick={() => setAddModalOpen(true)}
            >
              <UserPlusIcon /> Add User
            </button>
          </div>

          {/* Search & Filter Toolbar */}
          <div style={{
            display: "flex", alignItems: "center", justifyContent: "space-between",
            flexWrap: "wrap", gap: 12, background: "var(--bg-secondary)", padding: "10px 14px", borderRadius: 10,
            border: "1px solid var(--border-subtle)",
          }}>
            {/* Search Input */}
            <div style={{
              display: "flex", alignItems: "center", gap: 8,
              background: "var(--bg-surface)", border: "1px solid var(--border-subtle)",
              borderRadius: 8, padding: "6px 12px", minWidth: 260, flex: "1 1 260px",
            }}>
              <SearchIcon />
              <input
                type="text"
                placeholder="Search by name, email, or organization..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                style={{
                  border: "none", outline: "none", background: "transparent",
                  fontSize: "0.8125rem", color: "var(--text-primary)", width: "100%",
                }}
              />
            </div>

            {/* Role & Status Filters */}
            <div style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
              {/* Role Filter */}
              <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                <span style={{ fontSize: "0.78125rem", fontWeight: 700, color: "#475569" }}>Role:</span>
                <select
                  value={roleFilter}
                  onChange={(e) => setRoleFilter(e.target.value)}
                  style={{
                    padding: "6px 10px", borderRadius: 8, border: "1px solid #cbd5e1",
                    background: "#fff", fontSize: "0.8125rem", color: "#0f2744", fontWeight: 600,
                    outline: "none", cursor: "pointer",
                  }}
                >
                  <option value="All">All Roles</option>
                  <option value="Admin">Admin</option>
                  <option value="Analyst">Analyst</option>
                  <option value="Auditor">Auditor</option>
                  <option value="User">User</option>
                </select>
              </div>

              {/* Status Filter */}
              <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                <span style={{ fontSize: "0.78125rem", fontWeight: 700, color: "#475569" }}>Status:</span>
                <select
                  value={statusFilter}
                  onChange={(e) => setStatusFilter(e.target.value)}
                  style={{
                    padding: "6px 10px", borderRadius: 8, border: "1px solid #cbd5e1",
                    background: "#fff", fontSize: "0.8125rem", color: "#0f2744", fontWeight: 600,
                    outline: "none", cursor: "pointer",
                  }}
                >
                  <option value="All">All Statuses</option>
                  <option value="Active">Active</option>
                  <option value="Inactive">Inactive</option>
                </select>
              </div>

              {/* Refresh Button */}
              <button
                className="um-action-btn"
                style={{ background: "#fff", color: "#0f2744", border: "1px solid #cbd5e1", padding: "7px 12px" }}
                onClick={() => fetchUsers(pagination.page)}
                disabled={loading}
                title="Refresh user list"
              >
                <RefreshIcon />
              </button>
            </div>
          </div>
        </div>

        {/* Users Table */}
        <div style={{ overflowX: "auto" }}>
          <table className="um-table" style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead>
              <tr style={{ background: "#f8fafc", borderBottom: "1px solid #e2e8f0" }}>
                {["User Name", "Email Address", "Organization", "Role", "Status", "Last Login", "Actions"].map((h) => (
                  <th key={h} style={{
                    padding: "12px 16px", textAlign: "left",
                    fontSize: "0.75rem", fontWeight: 700, color: "#475569",
                    letterSpacing: "0.05em", textTransform: "uppercase", whiteSpace: "nowrap",
                  }}>
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={7} style={{ padding: "3rem", textAlign: "center" }}>
                    <Spinner size={32} />
                  </td>
                </tr>
              ) : users.length === 0 ? (
                <tr>
                  <td colSpan={7} style={{
                    padding: "3rem", textAlign: "center",
                    color: "#64748b", fontSize: "0.9375rem",
                  }}>
                    No users found matching your search or filter criteria.
                  </td>
                </tr>
              ) : (
                users.map((u) => {
                  const isSelf = currentUser?.id === u._id || currentUser?.email?.toLowerCase() === u.email?.toLowerCase();
                  return (
                    <tr key={u._id} style={{ borderBottom: "1px solid #f1f5f9", transition: "background 0.1s" }}>
                      {/* Name */}
                      <td style={{ padding: "12px 16px" }}>
                        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                          <div style={{
                            width: 36, height: 36, borderRadius: "50%",
                            background: "linear-gradient(135deg, #0d7377, #14a8ad)",
                            display: "flex", alignItems: "center", justifyContent: "center",
                            color: "#fff", fontWeight: 700, fontSize: "0.875rem", flexShrink: 0,
                          }}>
                            {u.name?.charAt(0).toUpperCase()}
                          </div>
                          <div>
                            <div style={{ fontWeight: 700, color: "#0f2744", fontSize: "0.875rem", display: "flex", alignItems: "center", gap: 6 }}>
                              {u.name}
                              {isSelf && (
                                <span style={{
                                  fontSize: "0.6875rem", color: "#b91c1c", fontWeight: 800,
                                  padding: "1px 6px", background: "#fef2f2", borderRadius: 4,
                                  border: "1px solid #fecaca", letterSpacing: "0.02em",
                                }}>
                                  (Primary Admin)
                                </span>
                              )}
                            </div>
                            <div style={{ fontSize: "0.7rem", color: "#64748b", fontFamily: "monospace" }}>
                              ID: {u._id.slice(-6)}
                            </div>
                          </div>
                        </div>
                      </td>

                      {/* Email */}
                      <td style={{ padding: "12px 16px", color: "#475569", fontSize: "0.84375rem" }}>
                        {u.email}
                      </td>

                      {/* Organization */}
                      <td style={{ padding: "12px 16px", color: "#0f2744", fontSize: "0.84375rem", fontWeight: 600 }}>
                        {u.organization?.name ? (
                          <span style={{ display: "inline-flex", alignItems: "center", gap: 5 }}>
                            🏢 {u.organization.name}
                          </span>
                        ) : typeof u.organization === "string" && u.organization ? (
                          u.organization
                        ) : (
                          <span style={{ color: "#94a3b8", fontStyle: "italic", fontWeight: 400 }}>
                            Unassigned
                          </span>
                        )}
                      </td>

                      {/* Role */}
                      <td style={{ padding: "12px 16px" }}>
                        <RoleBadge role={u.role} />
                      </td>

                      {/* Status */}
                      <td style={{ padding: "12px 16px" }}>
                        <span style={{
                          padding: "2px 10px", borderRadius: 999,
                          fontSize: "0.75rem", fontWeight: 700,
                          background: u.isActive ? "#f0fdf4" : "#fdecea",
                          color:      u.isActive ? "#15803d" : "#b91c1c",
                          border: `1px solid ${u.isActive ? "#bbf7d0" : "#fecaca"}`,
                          display: "inline-flex", alignItems: "center", gap: 5,
                        }}>
                          <span style={{
                            width: 6, height: 6, borderRadius: "50%",
                            background: u.isActive ? "#22c55e" : "#ef4444",
                          }} />
                          {u.isActive ? "Active" : "Inactive"}
                        </span>
                      </td>

                      {/* Last Login */}
                      <td style={{ padding: "12px 16px", color: "#64748b", fontSize: "0.78125rem", whiteSpace: "nowrap" }}>
                        {fmtDateTime(u.lastLogin)}
                      </td>

                      {/* Actions */}
                      <td style={{ padding: "12px 16px" }}>
                        {isSelf ? (
                          <span style={{ fontSize: "0.8125rem", color: "#94a3b8", fontStyle: "italic", fontWeight: 600 }}>
                            (Primary Admin) — No Edit/Delete
                          </span>
                        ) : (
                          <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                            {/* Edit User Button */}
                            <button
                              className="um-action-btn"
                              style={{ background: "#e0f2fe", color: "#0369a1" }}
                              onClick={() => openEditModal(u)}
                              title="Edit User Details"
                            >
                              <EditIcon /> Edit
                            </button>

                            {/* Assign Role Button */}
                            <button
                              className="um-action-btn"
                              style={{ background: "#f0fdf4", color: "#166534" }}
                              onClick={() => openRoleModal(u)}
                              title="Assign Role"
                            >
                              <ShieldIcon /> Role
                            </button>

                            {/* Reset Password Button */}
                            <button
                              className="um-action-btn"
                              style={{ background: "#fef3c7", color: "#92400e" }}
                              onClick={() => openResetModal(u)}
                              title="Reset Password"
                            >
                              <KeyIcon /> Reset
                            </button>

                            {/* Activate / Deactivate Toggle Button */}
                            <button
                              className="um-action-btn"
                              style={{
                                background: u.isActive ? "#fee2e2" : "#dcfce7",
                                color:      u.isActive ? "#991b1b" : "#166534",
                              }}
                              onClick={() => handleToggle(u)}
                              disabled={!!actionLoading[u._id]}
                              title={u.isActive ? "Deactivate User" : "Activate User"}
                            >
                              {actionLoading[u._id] ? <Spinner size={12} color="currentColor" /> : <ToggleIcon />}
                              {u.isActive ? "Deactivate" : "Activate"}
                            </button>

                            {/* Delete Button */}
                            {u.role === "Admin" ? null : (
                              <button
                                className="um-action-btn"
                                style={{ background: "#fdecea", color: "#b91c1c" }}
                                onClick={() => setConfirmDeleteUser(u)}
                                disabled={!!actionLoading[u._id]}
                                title="Delete User Account"
                              >
                                <TrashIcon /> Delete
                              </button>
                            )}
                          </div>
                        )}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination Footer */}
        {pagination.totalPages > 1 && (
          <div style={{
            padding: "1rem 1.5rem", borderTop: "1px solid #e2e8f0",
            display: "flex", alignItems: "center", justifyContent: "space-between",
            gap: 12, flexWrap: "wrap", background: "#f8fafc",
          }}>
            <span style={{ fontSize: "0.8125rem", color: "#64748b" }}>
              Showing Page {pagination.page} of {pagination.totalPages} ({pagination.total} total users)
            </span>
            <div style={{ display: "flex", gap: 8 }}>
              <button
                className="um-page-btn"
                disabled={pagination.page <= 1}
                onClick={() => fetchUsers(pagination.page - 1)}
              >
                ← Prev
              </button>
              {Array.from({ length: pagination.totalPages }, (_, i) => i + 1)
                .filter((p) => Math.abs(p - pagination.page) <= 2)
                .map((p) => (
                  <button
                    key={p}
                    className={`um-page-btn${p === pagination.page ? " active" : ""}`}
                    onClick={() => fetchUsers(p)}
                  >
                    {p}
                  </button>
                ))}
              <button
                className="um-page-btn"
                disabled={pagination.page >= pagination.totalPages}
                onClick={() => fetchUsers(pagination.page + 1)}
              >
                Next →
              </button>
            </div>
          </div>
        )}
      </div>

      {/* ── MODAL 1: ADD USER ── */}
      {addModalOpen && (
        <div style={{
          position: "fixed", inset: 0, background: "rgba(15, 39, 68, 0.6)",
          display: "flex", alignItems: "center", justifyContent: "center", zIndex: 9990, backdropFilter: "blur(4px)",
        }} onClick={() => setAddModalOpen(false)}>
          <div style={{
            background: "#fff", borderRadius: 16, padding: "2rem",
            maxWidth: 480, width: "90%", boxShadow: "0 20px 60px rgba(0,0,0,0.25)",
            animation: "umModalIn 0.25s ease",
          }} onClick={(e) => e.stopPropagation()}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1.25rem" }}>
              <h3 style={{ fontSize: "1.25rem", fontWeight: 800, color: "#0f2744", margin: 0, display: "flex", alignItems: "center", gap: 8 }}>
                <UserPlusIcon size={20} /> Add New User Account
              </h3>
              <button onClick={() => setAddModalOpen(false)} style={{ background: "none", border: "none", cursor: "pointer", color: "#64748b" }}>
                <CloseIcon />
              </button>
            </div>

            <form onSubmit={handleAddSubmit} style={{ display: "flex", flexDirection: "column", gap: 14 }}>
              <div>
                <label style={{ display: "block", fontSize: "0.8125rem", fontWeight: 700, color: "#0f2744", marginBottom: 4 }}>
                  Full Name <span style={{ color: "#c0392b" }}>*</span>
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Sarah Connor"
                  value={addForm.name}
                  onChange={(e) => setAddForm({ ...addForm, name: e.target.value })}
                  className="um-form-input"
                />
              </div>

              <div>
                <label style={{ display: "block", fontSize: "0.8125rem", fontWeight: 700, color: "#0f2744", marginBottom: 4 }}>
                  Email Address <span style={{ color: "#c0392b" }}>*</span>
                </label>
                <input
                  type="email"
                  required
                  placeholder="e.g. sarah.connor@cybersec.org"
                  value={addForm.email}
                  onChange={(e) => setAddForm({ ...addForm, email: e.target.value })}
                  className="um-form-input"
                />
              </div>

              <div>
                <label style={{ display: "block", fontSize: "0.8125rem", fontWeight: 700, color: "#0f2744", marginBottom: 4 }}>
                  Assigned Organization
                </label>
                <select
                  value={addForm.organization}
                  onChange={(e) => setAddForm({ ...addForm, organization: e.target.value })}
                  className="um-form-input"
                  style={{ cursor: "pointer" }}
                >
                  <option value="">-- Unassigned (No Organization) --</option>
                  {organizationsList.map((org) => (
                    <option key={org._id} value={org._id}>
                      {org.name} ({org.type || org.sector || "Org"})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label style={{ display: "block", fontSize: "0.8125rem", fontWeight: 700, color: "#0f2744", marginBottom: 4 }}>
                  System Role
                </label>
                <select
                  value={addForm.role}
                  onChange={(e) => setAddForm({ ...addForm, role: e.target.value })}
                  className="um-form-input"
                  style={{ cursor: "pointer" }}
                >
                  <option value="User">User — Basic ledger access</option>
                  <option value="Analyst">Analyst — Security log analysis & reports</option>
                  <option value="Auditor">Auditor — Compliance & blockchain verification</option>
                  <option value="Admin">Admin — Full system operations</option>
                </select>
              </div>

              <div>
                <label style={{ display: "block", fontSize: "0.8125rem", fontWeight: 700, color: "#0f2744", marginBottom: 4 }}>
                  Initial Password <span style={{ color: "#c0392b" }}>*</span>
                </label>
                <input
                  type="password"
                  required
                  placeholder="Minimum 8 characters"
                  value={addForm.password}
                  onChange={(e) => setAddForm({ ...addForm, password: e.target.value })}
                  className="um-form-input"
                />
                <PasswordStrength password={addForm.password} />
              </div>

              <div style={{ display: "flex", gap: 12, marginTop: 10 }}>
                <button
                  type="button"
                  onClick={() => setAddModalOpen(false)}
                  style={{
                    flex: 1, padding: "10px", borderRadius: 8, border: "1px solid #cbd5e1",
                    background: "#f4f7fc", color: "#0f2744", fontWeight: 600, fontSize: "0.875rem", cursor: "pointer",
                  }}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={actionLoading.add}
                  style={{
                    flex: 1, padding: "10px", borderRadius: 8, border: "none",
                    background: "linear-gradient(135deg, #0d7377, #14a8ad)", color: "#fff",
                    fontWeight: 700, fontSize: "0.875rem", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
                  }}
                >
                  {actionLoading.add ? <Spinner size={16} color="#fff" /> : "Create Account"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── MODAL 2: EDIT USER ── */}
      {editUserModal && (
        <div style={{
          position: "fixed", inset: 0, background: "rgba(15, 39, 68, 0.6)",
          display: "flex", alignItems: "center", justifyContent: "center", zIndex: 9990, backdropFilter: "blur(4px)",
        }} onClick={() => setEditUserModal(null)}>
          <div style={{
            background: "#fff", borderRadius: 16, padding: "2rem",
            maxWidth: 440, width: "90%", boxShadow: "0 20px 60px rgba(0,0,0,0.25)",
            animation: "umModalIn 0.25s ease",
          }} onClick={(e) => e.stopPropagation()}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1.25rem" }}>
              <h3 style={{ fontSize: "1.2rem", fontWeight: 800, color: "#0f2744", margin: 0, display: "flex", alignItems: "center", gap: 8 }}>
                <EditIcon size={18} /> Edit User Details
              </h3>
              <button onClick={() => setEditUserModal(null)} style={{ background: "none", border: "none", cursor: "pointer", color: "#64748b" }}>
                <CloseIcon />
              </button>
            </div>

            <form onSubmit={handleEditSubmit} style={{ display: "flex", flexDirection: "column", gap: 14 }}>
              <div>
                <label style={{ display: "block", fontSize: "0.8125rem", fontWeight: 700, color: "#0f2744", marginBottom: 4 }}>
                  Full Name
                </label>
                <input
                  type="text"
                  required
                  value={editForm.name}
                  onChange={(e) => setEditForm({ ...editForm, name: e.target.value })}
                  className="um-form-input"
                />
              </div>

              <div>
                <label style={{ display: "block", fontSize: "0.8125rem", fontWeight: 700, color: "#0f2744", marginBottom: 4 }}>
                  Email Address
                </label>
                <input
                  type="email"
                  required
                  value={editForm.email}
                  onChange={(e) => setEditForm({ ...editForm, email: e.target.value })}
                  className="um-form-input"
                />
              </div>

              <div>
                <label style={{ display: "block", fontSize: "0.8125rem", fontWeight: 700, color: "#0f2744", marginBottom: 4 }}>
                  Assigned Organization
                </label>
                <select
                  value={editForm.organization}
                  onChange={(e) => setEditForm({ ...editForm, organization: e.target.value })}
                  className="um-form-input"
                  style={{ cursor: "pointer" }}
                >
                  <option value="">-- Unassigned (No Organization) --</option>
                  {organizationsList.map((org) => (
                    <option key={org._id} value={org._id}>
                      {org.name} ({org.type || org.sector || "Org"})
                    </option>
                  ))}
                </select>
              </div>

              <div style={{ display: "flex", gap: 12, marginTop: 10 }}>
                <button
                  type="button"
                  onClick={() => setEditUserModal(null)}
                  style={{
                    flex: 1, padding: "10px", borderRadius: 8, border: "1px solid #cbd5e1",
                    background: "#f4f7fc", color: "#0f2744", fontWeight: 600, fontSize: "0.875rem", cursor: "pointer",
                  }}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={actionLoading[editUserModal._id]}
                  style={{
                    flex: 1, padding: "10px", borderRadius: 8, border: "none",
                    background: "#0d7377", color: "#fff", fontWeight: 700, fontSize: "0.875rem", cursor: "pointer",
                    display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
                  }}
                >
                  {actionLoading[editUserModal._id] ? <Spinner size={16} color="#fff" /> : "Save Changes"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── MODAL 3: ASSIGN ROLE ── */}
      {roleModalUser && (
        <div style={{
          position: "fixed", inset: 0, background: "rgba(15, 39, 68, 0.6)",
          display: "flex", alignItems: "center", justifyContent: "center", zIndex: 9990, backdropFilter: "blur(4px)",
        }} onClick={() => setRoleModalUser(null)}>
          <div style={{
            background: "#fff", borderRadius: 16, padding: "2rem",
            maxWidth: 440, width: "90%", boxShadow: "0 20px 60px rgba(0,0,0,0.25)",
            animation: "umModalIn 0.25s ease",
          }} onClick={(e) => e.stopPropagation()}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1rem" }}>
              <h3 style={{ fontSize: "1.2rem", fontWeight: 800, color: "#0f2744", margin: 0, display: "flex", alignItems: "center", gap: 8 }}>
                <ShieldIcon size={18} /> Assign System Role
              </h3>
              <button onClick={() => setRoleModalUser(null)} style={{ background: "none", border: "none", cursor: "pointer", color: "#64748b" }}>
                <CloseIcon />
              </button>
            </div>

            <p style={{ fontSize: "0.84375rem", color: "#475569", marginBottom: "1.25rem" }}>
              Select a new role for <strong>{roleModalUser.name}</strong> ({roleModalUser.email}).
            </p>

            <form onSubmit={handleRoleSubmit} style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              {[
                { role: "Admin", label: "Admin", desc: "Full administrative & user management permissions" },
                { role: "Analyst", label: "Analyst", desc: "Security log analysis, incident tracking & exporting" },
                { role: "Auditor", label: "Auditor", desc: "Read-only ledger audit & blockchain hash verification" },
                { role: "User", label: "User", desc: "Standard ledger user access" },
              ].map((r) => (
                <label
                  key={r.role}
                  style={{
                    display: "flex", alignItems: "flex-start", gap: 12, padding: "10px 14px",
                    borderRadius: 10, border: `1.5px solid ${selectedRole === r.role ? "#0d7377" : "#e2e8f0"}`,
                    background: selectedRole === r.role ? "#f0fdfa" : "#fafafa", cursor: "pointer",
                    transition: "all 0.15s ease",
                  }}
                >
                  <input
                    type="radio"
                    name="role"
                    value={r.role}
                    checked={selectedRole === r.role}
                    onChange={() => setSelectedRole(r.role)}
                    style={{ marginTop: 3, accentColor: "#0d7377" }}
                  />
                  <div>
                    <div style={{ fontSize: "0.875rem", fontWeight: 700, color: "#0f2744" }}>
                      {r.label}
                    </div>
                    <div style={{ fontSize: "0.78125rem", color: "#64748b" }}>
                      {r.desc}
                    </div>
                  </div>
                </label>
              ))}

              <div style={{ display: "flex", gap: 12, marginTop: 10 }}>
                <button
                  type="button"
                  onClick={() => setRoleModalUser(null)}
                  style={{
                    flex: 1, padding: "10px", borderRadius: 8, border: "1px solid #cbd5e1",
                    background: "#f4f7fc", color: "#0f2744", fontWeight: 600, fontSize: "0.875rem", cursor: "pointer",
                  }}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={actionLoading[roleModalUser._id]}
                  style={{
                    flex: 1, padding: "10px", borderRadius: 8, border: "none",
                    background: "#0d7377", color: "#fff", fontWeight: 700, fontSize: "0.875rem", cursor: "pointer",
                    display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
                  }}
                >
                  {actionLoading[roleModalUser._id] ? <Spinner size={16} color="#fff" /> : "Update Role"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── MODAL 4: RESET PASSWORD ── */}
      {resetModalUser && (
        <div style={{
          position: "fixed", inset: 0, background: "rgba(15, 39, 68, 0.6)",
          display: "flex", alignItems: "center", justifyContent: "center", zIndex: 9990, backdropFilter: "blur(4px)",
        }} onClick={() => setResetModalUser(null)}>
          <div style={{
            background: "#fff", borderRadius: 16, padding: "2rem",
            maxWidth: 440, width: "90%", boxShadow: "0 20px 60px rgba(0,0,0,0.25)",
            animation: "umModalIn 0.25s ease",
          }} onClick={(e) => e.stopPropagation()}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1rem" }}>
              <h3 style={{ fontSize: "1.2rem", fontWeight: 800, color: "#0f2744", margin: 0, display: "flex", alignItems: "center", gap: 8 }}>
                <KeyIcon size={18} /> Reset Account Password
              </h3>
              <button onClick={() => setResetModalUser(null)} style={{ background: "none", border: "none", cursor: "pointer", color: "#64748b" }}>
                <CloseIcon />
              </button>
            </div>

            <p style={{ fontSize: "0.84375rem", color: "#475569", marginBottom: "1.25rem" }}>
              Set a new secure password for <strong>{resetModalUser.name}</strong> ({resetModalUser.email}).
            </p>

            <form onSubmit={handleResetSubmit} style={{ display: "flex", flexDirection: "column", gap: 14 }}>
              <div>
                <label style={{ display: "block", fontSize: "0.8125rem", fontWeight: 700, color: "#0f2744", marginBottom: 4 }}>
                  New Password <span style={{ color: "#c0392b" }}>*</span>
                </label>
                <input
                  type="password"
                  required
                  placeholder="At least 8 characters"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  className="um-form-input"
                />
                <PasswordStrength password={newPassword} />
              </div>

              <div style={{ display: "flex", gap: 12, marginTop: 10 }}>
                <button
                  type="button"
                  onClick={() => setResetModalUser(null)}
                  style={{
                    flex: 1, padding: "10px", borderRadius: 8, border: "1px solid #cbd5e1",
                    background: "#f4f7fc", color: "#0f2744", fontWeight: 600, fontSize: "0.875rem", cursor: "pointer",
                  }}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={actionLoading[resetModalUser._id]}
                  style={{
                    flex: 1, padding: "10px", borderRadius: 8, border: "none",
                    background: "#b45309", color: "#fff", fontWeight: 700, fontSize: "0.875rem", cursor: "pointer",
                    display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
                  }}
                >
                  {actionLoading[resetModalUser._id] ? <Spinner size={16} color="#fff" /> : "Reset Password"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── MODAL 5: DELETE CONFIRMATION ── */}
      {confirmDeleteUser && (
        <div style={{
          position: "fixed", inset: 0, background: "rgba(15, 39, 68, 0.6)",
          display: "flex", alignItems: "center", justifyContent: "center", zIndex: 9990, backdropFilter: "blur(4px)",
        }} onClick={() => setConfirmDeleteUser(null)}>
          <div style={{
            background: "#fff", borderRadius: 16, padding: "2rem",
            maxWidth: 420, width: "90%", boxShadow: "0 20px 60px rgba(0,0,0,0.25)",
            animation: "umModalIn 0.25s ease",
          }} onClick={(e) => e.stopPropagation()}>
            <div style={{ fontSize: "1.35rem", fontWeight: 800, color: "#0f2744", marginBottom: 8 }}>
              🗑 Delete Account?
            </div>
            <p style={{ color: "#4a607a", fontSize: "0.875rem", lineHeight: 1.5, marginBottom: "1.5rem" }}>
              Are you sure you want to permanently delete the account for <strong>{confirmDeleteUser.name}</strong> ({confirmDeleteUser.email})? This action cannot be undone.
            </p>
            <div style={{ display: "flex", gap: 12 }}>
              <button
                className="um-action-btn"
                style={{ background: "#c0392b", color: "#fff", flex: 1, justifyContent: "center", padding: "10px", borderRadius: 8, fontSize: "0.875rem" }}
                onClick={() => handleDelete(confirmDeleteUser)}
              >
                Yes, Delete User
              </button>
              <button
                className="um-action-btn"
                style={{ background: "#f4f7fc", color: "#0d1b2e", flex: 1, justifyContent: "center", padding: "10px", borderRadius: 8, fontSize: "0.875rem", border: "1px solid #cbd5e1" }}
                onClick={() => setConfirmDeleteUser(null)}
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};

export default UserManagement;
