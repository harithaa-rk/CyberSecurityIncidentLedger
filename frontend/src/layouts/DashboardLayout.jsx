import React, { useState, useEffect } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import CommandPalette from "../components/CommandPalette";
import ThemeSelector from "../components/ThemeSelector";

/* ── Inline Futuristic SVGs ── */
const GridIcon = ({ size = 18 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/>
    <rect x="14" y="14" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/>
  </svg>
);

const ActivityIcon = ({ size = 18 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/>
  </svg>
);

const AlertTriangleIcon = ({ size = 18 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/>
    <line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/>
  </svg>
);

const FileTextIcon = ({ size = 18 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
    <polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/>
  </svg>
);

const UsersIcon = ({ size = 18 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/>
    <circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/>
    <path d="M16 3.13a4 4 0 0 1 0 7.75"/>
  </svg>
);

const BuildingIcon = ({ size = 18 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <line x1="18" y1="20" x2="18" y2="10"/><line x1="12" y1="20" x2="12" y2="4"/>
    <line x1="6" y1="20" x2="6" y2="14"/><rect x="2" y="20" width="20" height="2"/>
  </svg>
);

const LinkIcon = ({ size = 18 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/>
    <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/>
  </svg>
);

const ChevronLeftIcon = ({ size = 16 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="15 18 9 12 15 6"/>
  </svg>
);

const ArrowLeftIcon = ({ size = 16 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
    <line x1="19" y1="12" x2="5" y2="12"/><polyline points="12 19 5 12 12 5"/>
  </svg>
);

const ChevronRightIcon = ({ size = 16 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="9 18 15 12 9 6"/>
  </svg>
);

const SidebarToggleIcon = ({ size = 16, collapsed = false }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <rect x="3" y="3" width="18" height="18" rx="2" ry="2"/>
    <line x1="9" y1="3" x2="9" y2="21"/>
    {collapsed ? (
      <polyline points="13 9 16 12 13 15"/>
    ) : (
      <polyline points="16 9 13 12 16 15"/>
    )}
  </svg>
);

const MenuIcon = ({ size = 20 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <line x1="3" y1="12" x2="21" y2="12"/><line x1="3" y1="6" x2="21" y2="6"/><line x1="3" y1="18" x2="21" y2="18"/>
  </svg>
);

const LogoutIcon = ({ size = 16 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/>
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
    style={{ animation: spinning ? "sidebarSpin 0.8s linear infinite" : "none" }}
  >
    <polyline points="23 4 23 10 17 10"/><path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10"/>
  </svg>
);

export default function DashboardLayout({
  activeSection = "all",
  onSectionChange,
  onRefresh,
  loading = false,
  stats = null,
  backTo,
  backLabel,
  onBack,
  title,
  headerActions,
  children,
}) {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const [collapsed, setCollapsed] = useState(() => localStorage.getItem("owlyx_sidebar_collapsed") === "true");
  const [mobileOpen, setMobileOpen] = useState(false);
  const [currentTime, setCurrentTime] = useState("");
  const [commandPaletteOpen, setCommandPaletteOpen] = useState(false);

  // UTC Live Military SOC Clock
  useEffect(() => {
    const updateTime = () => {
      const now = new Date();
      setCurrentTime(now.toUTCString().slice(17, 25) + " UTC");
    };
    updateTime();
    const interval = setInterval(updateTime, 1000);
    return () => clearInterval(interval);
  }, []);

  const toggleCollapse = () => {
    setCollapsed((prev) => {
      const next = !prev;
      localStorage.setItem("owlyx_sidebar_collapsed", String(next));
      return next;
    });
  };

  // Keyboard shortcut Ctrl+B / Cmd+B to toggle sidebar hide/expose
  useEffect(() => {
    const handleKeyDown = (e) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "b") {
        e.preventDefault();
        toggleCollapse();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  const handleLogout = () => {
    logout();
    navigate("/login");
  };

  // ── Universal Back Navigation Logic ──
  const isRootDashboard =
    location.pathname === "/admin-dashboard" ||
    (user?.role === "Analyst" && location.pathname === "/analyst/incidents" && activeSection === "all");

  const handleGoBack = () => {
    if (onBack) {
      onBack();
      return;
    }

    if (backTo) {
      navigate(backTo);
      return;
    }

    // Check if browser history has an entry within current session
    if (window.history.state && window.history.state.idx > 0) {
      navigate(-1);
      return;
    }

    // Intelligent role & route fallback
    if (location.pathname.startsWith("/analyst/incidents/")) {
      navigate("/analyst/incidents");
    } else if (location.pathname.startsWith("/admin/incidents/")) {
      navigate("/admin/incidents");
    } else if (location.pathname.startsWith("/admin/")) {
      navigate("/admin-dashboard");
    } else if (user?.role === "Analyst") {
      navigate("/analyst/incidents");
    } else {
      navigate("/admin-dashboard");
    }
  };

  // ── Breadcrumbs Generation ──
  const generateBreadcrumbs = () => {
    const crumbs = [];
    const isAnalyst = user?.role === "Analyst";

    // Primary Home / Root link
    if (isAnalyst) {
      crumbs.push({ label: "Analyst Portal", path: "/analyst/incidents" });
    } else {
      crumbs.push({ label: "Command Center", path: "/admin-dashboard" });
    }

    const path = location.pathname;

    if (path === "/admin/incidents") {
      crumbs.push({ label: "Incident Management", path: "/admin/incidents", isLast: true });
    } else if (path.startsWith("/admin/incidents/")) {
      crumbs.push({ label: "Incidents", path: "/admin/incidents" });
      const id = path.split("/").pop();
      crumbs.push({ label: `INC-${id.slice(0, 8)}`, isLast: true });
    } else if (path === "/admin/live-security-logs") {
      crumbs.push({ label: "Live Telemetry", path: "/admin/live-security-logs", isLast: true });
    } else if (path === "/admin/security-logs") {
      crumbs.push({ label: "Security Ledger", path: "/admin/security-logs", isLast: true });
    } else if (path === "/analyst/incidents") {
      crumbs.push({ label: "Assigned Incidents", path: "/analyst/incidents", isLast: true });
    } else if (path.startsWith("/analyst/incidents/")) {
      crumbs.push({ label: "Assigned Incidents", path: "/analyst/incidents" });
      const id = path.split("/").pop();
      crumbs.push({ label: `Investigation (${id.slice(0, 8)})`, isLast: true });
    } else if (path.startsWith("/verify/")) {
      crumbs.push({ label: "Report Verification", isLast: true });
    } else if (path === "/admin-dashboard") {
      if (activeSection && activeSection !== "all") {
        const sectionLabels = {
          constellation: "Threat Constellation",
          evidence: "Evidence Ledger",
          analytics: "Telemetry Analytics",
          feeds: "Live Feeds",
          users: "User Governance",
          organizations: "Tenant Organizations",
        };
        crumbs.push({ label: sectionLabels[activeSection] || activeSection, isLast: true });
      } else {
        crumbs[0].isLast = true;
      }
    } else if (title) {
      crumbs.push({ label: title, isLast: true });
    }

    return crumbs;
  };

  const breadcrumbs = generateBreadcrumbs();

  // ── Role-Aware Sidebar Navigation Sections ──
  const isAdmin = user?.role === "Admin";
  const isAnalyst = user?.role === "Analyst";

  const adminNavSections = [
    {
      group: "Command Center",
      items: [
        { id: "all", label: "Overview Center", icon: GridIcon, type: "filter", sectionId: "all" },
        { id: "constellation", label: "Threat Constellation", icon: ActivityIcon, type: "filter", sectionId: "constellation" },
        { id: "evidence", label: "Evidence Integrity", icon: LinkIcon, type: "filter", sectionId: "evidence" },
      ],
    },
    {
      group: "Operations & Telemetry",
      items: [
        {
          id: "incidents",
          label: "Incidents",
          icon: AlertTriangleIcon,
          type: "link",
          path: "/admin/incidents",
          badge: stats?.openIncidents ?? (stats?.totalIncidents ? `${stats.totalIncidents}` : null),
          badgeColor: "#FF4D4F",
        },
        {
          id: "live-security-logs",
          label: "Live Telemetry",
          icon: ActivityIcon,
          type: "link",
          path: "/admin/live-security-logs",
          badge: "REAL",
          badgeColor: "#36D6AE",
        },
        {
          id: "security-logs",
          label: "Security Ledger",
          icon: FileTextIcon,
          type: "link",
          path: "/admin/security-logs",
          badge: "Fabric",
          badgeColor: "var(--color-gold)",
        },
      ],
    },
    {
      group: "Administration & Audit",
      items: [
        { id: "users", label: "User Governance", icon: UsersIcon, type: "filter", sectionId: "users" },
        { id: "organizations", label: "Tenant Orgs", icon: BuildingIcon, type: "filter", sectionId: "organizations" },
        { id: "verify", label: "Report Verification", icon: LinkIcon, type: "link", path: "/verify/DEMO" },
      ],
    },
  ];

  const analystNavSections = [
    {
      group: "Analyst Operations",
      items: [
        {
          id: "analyst-incidents",
          label: "My Incidents",
          icon: AlertTriangleIcon,
          type: "link",
          path: "/analyst/incidents",
          badge: stats?.openIncidents ?? (stats?.totalIncidents ? `${stats.totalIncidents}` : null),
          badgeColor: "#FF4D4F",
        },
        {
          id: "live-security-logs",
          label: "Live Telemetry",
          icon: ActivityIcon,
          type: "link",
          path: "/admin/live-security-logs",
          badge: "REAL",
          badgeColor: "#36D6AE",
        },
        {
          id: "security-logs",
          label: "Security Ledger",
          icon: FileTextIcon,
          type: "link",
          path: "/admin/security-logs",
          badge: "Fabric",
          badgeColor: "var(--color-gold)",
        },
      ],
    },
    {
      group: "Forensics & Audit",
      items: [
        { id: "verify", label: "Report Verification", icon: LinkIcon, type: "link", path: "/verify/DEMO" },
      ],
    },
  ];

  const genericNavSections = [
    {
      group: "Security Telemetry",
      items: [
        {
          id: "security-logs",
          label: "Security Ledger",
          icon: FileTextIcon,
          type: "link",
          path: "/admin/security-logs",
        },
        {
          id: "live-security-logs",
          label: "Live Telemetry",
          icon: ActivityIcon,
          type: "link",
          path: "/admin/live-security-logs",
        },
        {
          id: "verify",
          label: "Report Verification",
          icon: LinkIcon,
          type: "link",
          path: "/verify/DEMO",
        },
      ],
    },
  ];

  const navSections = isAnalyst
    ? analystNavSections
    : isAdmin
    ? adminNavSections
    : genericNavSections;

  const sidebarWidth = collapsed ? 74 : 264;

  return (
    <>
      <style>{`
        @keyframes sidebarSpin { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } }
        @keyframes owlPulse {
          0%, 100% { filter: drop-shadow(0 0 10px var(--color-gold-glow)); transform: scale(1); }
          50% { filter: drop-shadow(0 0 22px var(--color-gold-glow)); transform: scale(1.03); }
        }
        @keyframes radarSweep { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } }
        @keyframes pulseDot { 0%, 100% { opacity: 1; transform: scale(1); } 50% { opacity: 0.4; transform: scale(0.85); } }

        .owlyx-sidebar {
          scrollbar-width: thin;
          scrollbar-color: var(--border-subtle) var(--bg-primary);
        }
        .owlyx-nav-item:hover {
          background: var(--color-gold-soft) !important;
          color: var(--color-gold) !important;
          border-left-color: var(--color-gold) !important;
        }
        #sidebar-edge-toggle {
          position: absolute;
          top: 24px;
          right: -13px;
          width: 26px;
          height: 26px;
          border-radius: 50%;
          background: var(--bg-surface);
          border: 1px solid var(--border-subtle);
          color: var(--text-secondary);
          cursor: pointer;
          display: flex;
          align-items: center;
          justify-content: center;
          z-index: 120;
          box-shadow: 0 2px 8px rgba(0, 0, 0, 0.25);
          transition: all 0.16s ease;
        }
        #sidebar-edge-toggle:hover {
          border-color: var(--color-gold);
          color: var(--color-gold);
          transform: scale(1.15);
          box-shadow: 0 0 12px var(--color-gold-glow);
        }
        @media (max-width: 900px) {
          #sidebar-edge-toggle {
            display: none !important;
          }
          #sidebar-toggle-topbar {
            display: none !important;
          }
          .owlyx-sidebar {
            position: fixed !important;
            top: 0; bottom: 0; left: 0;
            z-index: 1000 !important;
            transform: translateX(-100%);
            transition: transform 0.25s cubic-bezier(0.4, 0, 0.2, 1) !important;
          }
          .owlyx-sidebar.mobile-open {
            transform: translateX(0) !important;
          }
          .owlyx-main-content {
            margin-left: 0 !important;
            width: 100% !important;
          }
          .mobile-menu-trigger {
            display: inline-flex !important;
          }
        }
      `}</style>

      {/* Global Command Palette */}
      <CommandPalette isOpen={commandPaletteOpen} onClose={() => setCommandPaletteOpen(false)} />

      <div style={{ display: "flex", minHeight: "100vh", background: "var(--bg-primary)", color: "var(--text-primary)" }}>
        {/* Mobile Backdrop */}
        {mobileOpen && (
          <div
            onClick={() => setMobileOpen(false)}
            style={{
              position: "fixed",
              inset: 0,
              background: "rgba(0, 0, 0, 0.7)",
              backdropFilter: "blur(6px)",
              zIndex: 999,
            }}
          />
        )}

        {/* ── PERSISTENT SIDEBAR THROUGHOUT ALL PAGES ── */}
        <aside
          className={`owlyx-sidebar ${mobileOpen ? "mobile-open" : ""}`}
          style={{
            width: sidebarWidth,
            minWidth: sidebarWidth,
            background: "linear-gradient(180deg, var(--bg-primary) 0%, var(--bg-secondary) 100%)",
            color: "var(--text-primary)",
            display: "flex",
            flexDirection: "column",
            position: "fixed",
            top: 0,
            bottom: 0,
            left: 0,
            zIndex: 90,
            borderRight: "1px solid var(--border-subtle)",
            boxShadow: "var(--shadow-obsidian)",
            transition: "width 0.22s ease, min-width 0.22s ease",
            overflow: "visible",
          }}
        >
          {/* Floating Edge Hide / Expose Toggle Button (Desktop Rail Edge) */}
          <button
            id="sidebar-edge-toggle"
            onClick={toggleCollapse}
            title={collapsed ? "Expose Sidebar (Ctrl+B)" : "Hide Sidebar (Ctrl+B)"}
            aria-label={collapsed ? "Expose sidebar" : "Hide sidebar"}
          >
            {collapsed ? <ChevronRightIcon size={13} /> : <ChevronLeftIcon size={13} />}
          </button>

          {/* Brand Header with Owl Mascot & Gold Glow */}
          <div
            style={{
              height: 72,
              display: "flex",
              alignItems: "center",
              justifyContent: collapsed ? "center" : "space-between",
              padding: collapsed ? "0" : "0 18px",
              borderBottom: "1px solid var(--border-subtle)",
              background: "var(--bg-primary)",
            }}
          >
            <Link
              to={isAnalyst ? "/analyst/incidents" : "/admin-dashboard"}
              title={collapsed ? "Click to expose sidebar" : "Owlyx Command Center"}
              onClick={(e) => {
                if (collapsed) {
                  toggleCollapse();
                }
              }}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 12,
                textDecoration: "none",
                color: "inherit",
              }}
            >
              {/* Golden Owl Logo with Orbital Halo */}
              <div
                style={{
                  position: "relative",
                  width: 42,
                  height: 42,
                  borderRadius: 10,
                  background: "var(--bg-surface)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  boxShadow: "0 4px 16px rgba(0,0,0,0.25)",
                  border: "1px solid var(--color-gold-border)",
                  flexShrink: 0,
                  padding: 2,
                }}
              >
                <img
                  src="/logo.png"
                  alt="Owlyx Mascot"
                  style={{
                    width: "100%",
                    height: "100%",
                    objectFit: "contain",
                    animation: "owlPulse 4s ease-in-out infinite",
                  }}
                />
              </div>

              {!collapsed && (
                <div>
                  <div
                    style={{
                      fontFamily: "var(--font-display)",
                      fontWeight: 800,
                      fontSize: "1.15rem",
                      letterSpacing: "-0.02em",
                      color: "var(--text-primary)",
                      lineHeight: 1.1,
                      display: "flex",
                      alignItems: "center",
                      gap: 6,
                    }}
                  >
                    Owlyx{" "}
                    <span
                      style={{
                        color: "var(--color-gold)",
                        fontSize: "0.72rem",
                        fontFamily: "var(--font-mono)",
                        fontWeight: 500,
                        letterSpacing: "0.05em",
                      }}
                    >
                      {isAnalyst ? "SOC-OPS" : "SOC"}
                    </span>
                  </div>
                  <div
                    style={{
                      color: "var(--text-muted)",
                      fontSize: "0.6rem",
                      letterSpacing: "0.08em",
                      fontWeight: 500,
                      textTransform: "uppercase",
                      fontFamily: "var(--font-mono)",
                    }}
                  >
                    Silent Watch. Unbreakable Proof.
                  </div>
                </div>
              )}
            </Link>

            {!collapsed && (
              <button
                onClick={toggleCollapse}
                title="Hide / Collapse sidebar (Ctrl+B)"
                style={{
                  color: "var(--text-secondary)",
                  background: "var(--bg-surface)",
                  border: "1px solid var(--border-subtle)",
                  borderRadius: 6,
                  padding: "4px",
                  cursor: "pointer",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  transition: "all 0.15s ease",
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.color = "var(--color-gold)";
                  e.currentTarget.style.borderColor = "var(--color-gold)";
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.color = "var(--text-secondary)";
                  e.currentTarget.style.borderColor = "var(--border-subtle)";
                }}
              >
                <ChevronLeftIcon size={14} />
              </button>
            )}
          </div>

          {/* Real Backend Health Strip */}
          {!collapsed ? (
            <div
              style={{
                margin: "12px 14px",
                padding: "10px 12px",
                background: "var(--bg-surface)",
                border: "1px solid var(--border-subtle)",
                borderRadius: 8,
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
              }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <span
                  style={{
                    width: 7,
                    height: 7,
                    borderRadius: "50%",
                    background: "var(--state-verified, #36D6AE)",
                    boxShadow: "0 0 8px var(--state-verified, #36D6AE)",
                    animation: "pulseDot 2s infinite ease-in-out",
                  }}
                />
                <div>
                  <div style={{ fontSize: "0.72rem", fontWeight: 700, color: "var(--text-primary)", fontFamily: "var(--font-heading)" }}>
                    Hyperledger Fabric
                  </div>
                  <div style={{ fontSize: "0.65rem", color: "var(--text-secondary)", fontFamily: "var(--font-mono)" }}>
                    incidentchannel · Consented
                  </div>
                </div>
              </div>
              <span
                style={{
                  background: "var(--state-verified-bg, rgba(54, 214, 174, 0.12))",
                  color: "var(--state-verified, #36D6AE)",
                  padding: "2px 6px",
                  borderRadius: 4,
                  fontSize: "0.62rem",
                  fontWeight: 700,
                  fontFamily: "var(--font-mono)",
                }}
              >
                VERIFIED
              </span>
            </div>
          ) : (
            <div style={{ display: "flex", justifyContent: "center", padding: "12px 0" }} title="Fabric Consensus Live">
              <span
                style={{
                  width: 8,
                  height: 8,
                  borderRadius: "50%",
                  background: "var(--state-verified, #36D6AE)",
                  boxShadow: "0 0 8px var(--state-verified, #36D6AE)",
                  animation: "pulseDot 2s infinite ease-in-out",
                }}
              />
            </div>
          )}

          {/* Navigation Links */}
          <div
            style={{
              flex: 1,
              overflowY: "auto",
              padding: collapsed ? "8px 8px" : "8px 12px",
              display: "flex",
              flexDirection: "column",
              gap: 16,
            }}
          >
            {navSections.map((sec, idx) => (
              <div key={idx}>
                {!collapsed && (
                  <div
                    style={{
                      fontSize: "0.65rem",
                      fontWeight: 700,
                      textTransform: "uppercase",
                      letterSpacing: "0.08em",
                      color: "var(--text-muted)",
                      fontFamily: "var(--font-mono)",
                      marginBottom: 6,
                      paddingLeft: 8,
                    }}
                  >
                    {sec.group}
                  </div>
                )}
                <div style={{ display: "flex", flexDirection: "column", gap: 3 }}>
                  {sec.items.map((item) => {
                    const isLink = item.type === "link";
                    const isFilter = item.type === "filter";

                    let isActive = false;
                    if (isLink) {
                      isActive = location.pathname === item.path;
                    } else if (isFilter) {
                      isActive = location.pathname === "/admin-dashboard" && activeSection === item.sectionId;
                    }

                    const IconComp = item.icon;

                    const handleClick = () => {
                      if (isFilter) {
                        if (location.pathname === "/admin-dashboard" && onSectionChange) {
                          onSectionChange(item.sectionId);
                        } else {
                          // User is on another page; navigate to admin-dashboard with section
                          navigate(`/admin-dashboard?section=${item.sectionId}`);
                        }
                        if (mobileOpen) setMobileOpen(false);
                      }
                    };

                    const content = (
                      <div
                        className="owlyx-nav-item"
                        onClick={handleClick}
                        title={collapsed ? item.label : undefined}
                        style={{
                          display: "flex",
                          alignItems: "center",
                          justifyContent: collapsed ? "center" : "space-between",
                          padding: collapsed ? "10px" : "9px 12px",
                          borderRadius: 8,
                          cursor: "pointer",
                          color: isActive ? "var(--color-gold)" : "var(--text-secondary)",
                          background: isActive ? "var(--color-gold-soft)" : "transparent",
                          borderLeft: isActive ? "3px solid var(--color-gold)" : "3px solid transparent",
                          border: isActive ? "1px solid var(--color-gold-border)" : "1px solid transparent",
                          transition: "all 0.15s ease",
                        }}
                      >
                        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                          <span style={{ color: isActive ? "var(--color-gold)" : "var(--text-secondary)" }}>
                            <IconComp size={17} />
                          </span>
                          {!collapsed && (
                            <span
                              style={{
                                fontSize: "0.83rem",
                                fontFamily: "var(--font-heading)",
                                fontWeight: isActive ? 700 : 500,
                              }}
                            >
                              {item.label}
                            </span>
                          )}
                        </div>

                        {!collapsed && item.badge && (
                          <span
                            style={{
                              fontSize: "0.68rem",
                              fontFamily: "var(--font-mono)",
                              fontWeight: 600,
                              padding: "2px 6px",
                              borderRadius: 4,
                              background: item.badgeColor ? `${item.badgeColor}22` : "var(--color-gold-soft)",
                              color: item.badgeColor || "var(--color-gold)",
                              border: `1px solid ${item.badgeColor || "var(--color-gold)"}55`,
                            }}
                          >
                            {item.badge}
                          </span>
                        )}
                      </div>
                    );

                    return isLink ? (
                      <Link
                        key={item.id}
                        to={item.path}
                        style={{ textDecoration: "none" }}
                        onClick={() => mobileOpen && setMobileOpen(false)}
                      >
                        {content}
                      </Link>
                    ) : (
                      <div key={item.id}>{content}</div>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>

          {/* User Profile & Sidebar Footer */}
          <div
            style={{
              padding: collapsed ? "12px 8px" : "12px 14px",
              borderTop: "1px solid var(--border-subtle)",
              background: "var(--bg-primary)",
              display: "flex",
              alignItems: "center",
              justifyContent: collapsed ? "center" : "space-between",
              gap: 10,
            }}
          >
            {!collapsed ? (
              <>
                <div style={{ display: "flex", alignItems: "center", gap: 10, minWidth: 0 }}>
                  <div
                    style={{
                      width: 32,
                      height: 32,
                      borderRadius: 8,
                      background: "var(--color-gold-soft)",
                      border: "1px solid var(--color-gold-border)",
                      color: "var(--color-gold)",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      fontWeight: 800,
                      fontSize: "0.8rem",
                      fontFamily: "var(--font-display)",
                    }}
                  >
                    {user?.name ? user.name.slice(0, 2).toUpperCase() : (isAnalyst ? "AN" : "AD")}
                  </div>
                  <div style={{ minWidth: 0 }}>
                    <div
                      style={{
                        fontWeight: 700,
                        fontSize: "0.82rem",
                        color: "var(--text-primary)",
                        fontFamily: "var(--font-heading)",
                        whiteSpace: "nowrap",
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                      }}
                    >
                      {user?.name || (isAnalyst ? "Analyst" : "Administrator")}
                    </div>
                    <div
                      style={{
                        fontSize: "0.68rem",
                        color: "var(--color-gold)",
                        fontFamily: "var(--font-mono)",
                        fontWeight: 600,
                        textTransform: "uppercase",
                      }}
                    >
                      {user?.role || "Admin"}
                    </div>
                  </div>
                </div>

                <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
                  <button
                    onClick={handleLogout}
                    title="Sign Out"
                    style={{
                      background: "var(--bg-surface)",
                      border: "1px solid var(--border-subtle)",
                      color: "var(--text-secondary)",
                      padding: "6px",
                      borderRadius: 6,
                      cursor: "pointer",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      transition: "all 0.15s ease",
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.color = "#FF4D4F";
                      e.currentTarget.style.borderColor = "#FF4D4F";
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.color = "var(--text-secondary)";
                      e.currentTarget.style.borderColor = "var(--border-subtle)";
                    }}
                  >
                    <LogoutIcon size={14} />
                  </button>
                </div>
              </>
            ) : (
              <button
                onClick={handleLogout}
                title="Sign Out"
                style={{ color: "var(--text-secondary)", padding: "6px", cursor: "pointer" }}
                onMouseEnter={(e) => (e.currentTarget.style.color = "#FF4D4F")}
                onMouseLeave={(e) => (e.currentTarget.style.color = "var(--text-secondary)")}
              >
                <LogoutIcon size={16} />
              </button>
            )}
          </div>
        </aside>

        {/* ── MAIN CONTENT WRAPPER ── */}
        <div
          className="owlyx-main-content"
          style={{
            marginLeft: sidebarWidth,
            flex: 1,
            minWidth: 0,
            display: "flex",
            flexDirection: "column",
            transition: "margin-left 0.22s ease",
            background: "var(--bg-primary)",
          }}
        >
          {/* Top Operational Command Bar */}
          <header
            style={{
              height: 70,
              background: "var(--bg-secondary)",
              borderBottom: "1px solid var(--border-subtle)",
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              padding: "0 1.5rem",
              position: "sticky",
              top: 0,
              zIndex: 80,
              boxShadow: "0 4px 20px rgba(0, 0, 0, 0.25)",
              gap: 12,
            }}
          >
            {/* Left Zone: Mobile Trigger + Back Button + Breadcrumb Trail */}
            <div style={{ display: "flex", alignItems: "center", gap: 12, minWidth: 0, flex: 1 }}>
              <button
                onClick={() => setMobileOpen(true)}
                style={{
                  display: "none",
                  color: "var(--color-gold)",
                  cursor: "pointer",
                  padding: "6px",
                  background: "var(--bg-surface)",
                  border: "1px solid var(--border-subtle)",
                  borderRadius: 6,
                }}
                className="mobile-menu-trigger"
                aria-label="Open navigation menu"
              >
                <MenuIcon size={20} />
              </button>

              {/* ── Dedicated Sidebar Hide / Expose Toggle Button ── */}
              <button
                id="sidebar-toggle-topbar"
                onClick={toggleCollapse}
                title={collapsed ? "Expose Sidebar (Ctrl+B)" : "Hide Sidebar (Ctrl+B)"}
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 7,
                  padding: "7px 12px",
                  borderRadius: 8,
                  background: "var(--bg-surface)",
                  border: "1px solid var(--border-subtle)",
                  color: collapsed ? "var(--color-gold)" : "var(--text-secondary)",
                  fontSize: "0.8125rem",
                  fontWeight: 600,
                  cursor: "pointer",
                  transition: "all 0.16s ease",
                  fontFamily: "var(--font-heading)",
                  boxShadow: "0 2px 6px rgba(0, 0, 0, 0.12)",
                  flexShrink: 0,
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.borderColor = "var(--color-gold)";
                  e.currentTarget.style.color = "var(--color-gold)";
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.borderColor = "var(--border-subtle)";
                  e.currentTarget.style.color = collapsed ? "var(--color-gold)" : "var(--text-secondary)";
                }}
                aria-label={collapsed ? "Expose sidebar" : "Hide sidebar"}
              >
                <SidebarToggleIcon size={15} collapsed={collapsed} />
                <span className="sidebar-toggle-text" style={{ fontSize: "0.78rem" }}>
                  {collapsed ? "Expose Sidebar" : "Hide Sidebar"}
                </span>
              </button>

              {/* ── Dedicated Universal Back Navigation Button ── */}
              <button
                id="universal-back-btn"
                onClick={handleGoBack}
                title="Go back to previous page"
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 6,
                  padding: "7px 13px",
                  borderRadius: 8,
                  background: "var(--bg-surface)",
                  border: "1px solid var(--border-subtle)",
                  color: "var(--text-primary)",
                  fontSize: "0.8125rem",
                  fontWeight: 700,
                  cursor: "pointer",
                  transition: "all 0.16s ease",
                  fontFamily: "var(--font-heading)",
                  boxShadow: "0 2px 6px rgba(0,0,0,0.12)",
                  flexShrink: 0,
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.borderColor = "var(--color-gold)";
                  e.currentTarget.style.color = "var(--color-gold)";
                  e.currentTarget.style.transform = "translateX(-2px)";
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.borderColor = "var(--border-subtle)";
                  e.currentTarget.style.color = "var(--text-primary)";
                  e.currentTarget.style.transform = "translateX(0)";
                }}
              >
                <ArrowLeftIcon size={14} />
                <span>{backLabel || "Back"}</span>
              </button>

              {/* ── Dynamic Breadcrumbs Navigation Trail ── */}
              <nav
                aria-label="Breadcrumb navigation"
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 6,
                  fontSize: "0.8125rem",
                  overflow: "hidden",
                  whiteSpace: "nowrap",
                  textOverflow: "ellipsis",
                }}
              >
                {breadcrumbs.map((crumb, idx) => (
                  <React.Fragment key={crumb.path || idx}>
                    {idx > 0 && (
                      <span style={{ color: "var(--text-muted)", fontSize: "0.75rem", userSelect: "none" }}>
                        /
                      </span>
                    )}
                    {crumb.isLast ? (
                      <span
                        style={{
                          color: "var(--color-gold)",
                          fontWeight: 700,
                          fontFamily: "var(--font-heading)",
                          letterSpacing: "-0.01em",
                        }}
                      >
                        {crumb.label}
                      </span>
                    ) : (
                      <Link
                        to={crumb.path}
                        style={{
                          color: "var(--text-secondary)",
                          fontWeight: 600,
                          textDecoration: "none",
                          transition: "color 0.15s ease",
                          fontFamily: "var(--font-heading)",
                        }}
                        onMouseEnter={(e) => (e.currentTarget.style.color = "var(--color-gold)")}
                        onMouseLeave={(e) => (e.currentTarget.style.color = "var(--text-secondary)")}
                      >
                        {crumb.label}
                      </Link>
                    )}
                  </React.Fragment>
                ))}
              </nav>

              {/* Command Palette Trigger Button (Desktop) */}
              <button
                onClick={() => setCommandPaletteOpen(true)}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 8,
                  background: "var(--bg-surface)",
                  border: "1px solid var(--border-subtle)",
                  borderRadius: 8,
                  padding: "6px 12px",
                  color: "var(--text-secondary)",
                  fontSize: "0.78rem",
                  cursor: "pointer",
                  transition: "all 0.15s ease",
                  marginLeft: "auto",
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.borderColor = "var(--color-gold)";
                  e.currentTarget.style.color = "var(--text-primary)";
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.borderColor = "var(--border-subtle)";
                  e.currentTarget.style.color = "var(--text-secondary)";
                }}
              >
                <span style={{ color: "var(--color-gold)", fontSize: "0.95rem" }}>⌕</span>
                <span style={{ fontFamily: "var(--font-heading)" }}>Search telemetry...</span>
                <span
                  style={{
                    fontFamily: "var(--font-mono)",
                    fontSize: "0.65rem",
                    background: "var(--bg-primary)",
                    border: "1px solid var(--border-subtle)",
                    padding: "2px 5px",
                    borderRadius: 4,
                    color: "var(--color-gold)",
                    marginLeft: 6,
                  }}
                >
                  Ctrl+K
                </span>
              </button>
            </div>

            {/* Right Zone: Custom Header Actions + Theme Selector + Military Clock + Sync */}
            <div style={{ display: "flex", alignItems: "center", gap: 10, flexShrink: 0 }}>
              {/* Optional Custom Page Actions Slot */}
              {headerActions}

              {/* ── Multi-Theme Selector (Dark & Light Palettes) ── */}
              <ThemeSelector />

              {/* UTC Military Clock */}
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 6,
                  background: "var(--bg-surface)",
                  border: "1px solid var(--border-subtle)",
                  padding: "6px 12px",
                  borderRadius: 8,
                  fontSize: "0.75rem",
                  fontFamily: "var(--font-mono)",
                  fontWeight: 600,
                  color: "var(--text-primary)",
                }}
              >
                <span
                  style={{
                    width: 6,
                    height: 6,
                    borderRadius: "50%",
                    background: "var(--color-gold)",
                    boxShadow: "0 0 6px var(--color-gold)",
                  }}
                />
                {currentTime}
              </div>

              {/* Sync Live Button */}
              {onRefresh && (
                <button
                  onClick={onRefresh}
                  disabled={loading}
                  style={{
                    display: "inline-flex",
                    alignItems: "center",
                    gap: 8,
                    background: "var(--color-gold-soft)",
                    color: "var(--color-gold)",
                    border: "1px solid var(--color-gold-border)",
                    borderRadius: 8,
                    padding: "7px 13px",
                    fontSize: "0.8125rem",
                    fontWeight: 700,
                    fontFamily: "Space Grotesk, sans-serif",
                    cursor: loading ? "not-allowed" : "pointer",
                    transition: "all 0.15s ease",
                  }}
                  onMouseEnter={(e) => {
                    if (!loading) e.currentTarget.style.background = "var(--color-gold-glow)";
                  }}
                  onMouseLeave={(e) => {
                    if (!loading) e.currentTarget.style.background = "var(--color-gold-soft)";
                  }}
                >
                  <RefreshIcon size={14} spinning={loading} />
                  {loading ? "Syncing..." : "Sync Sentinel"}
                </button>
              )}
            </div>
          </header>

          {/* Children Viewport */}
          <main style={{ flex: 1, padding: "1.75rem", background: "var(--bg-primary)" }}>
            {children}
          </main>
        </div>
      </div>
    </>
  );
}
