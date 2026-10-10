import React, { useEffect, useState, useCallback } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import {
  getAdminStats,
  getDashboardCharts,
  getDashboardWidgets,
} from "../services/adminService";
import { getIncidents } from "../services/incidentService";
import DashboardLayout from "../layouts/DashboardLayout";
import DashboardCards from "../components/DashboardCards";
import DashboardCharts from "../components/DashboardCharts";
import DashboardWidgets from "../components/DashboardWidgets";
import ThreatConstellation from "../components/ThreatConstellation";
import BlockchainEvidenceLedger from "../components/BlockchainEvidenceLedger";
import UserManagement from "../components/UserManagement";
import OrganizationManagement from "../components/OrganizationManagement";

/* ── Inline SVG Icons ── */
const ShieldCheckIcon = ({ size = 22 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>
    <polyline points="9 12 11 14 15 10"/>
  </svg>
);

const FilterIcon = ({ size = 16 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <polygon points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3"/>
  </svg>
);

const ExternalLinkIcon = ({ size = 14 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/><polyline points="15 3 21 3 21 9"/><line x1="10" y1="14" x2="21" y2="3"/>
  </svg>
);

/* Spinner Component */
const Spinner = ({ size = 32, color = "var(--color-gold)" }) => (
  <div style={{
    width: size, height: size,
    border: `3px solid ${color}30`,
    borderTopColor: color,
    borderRadius: "50%",
    animation: "adminSpin 0.7s linear infinite",
    display: "inline-block",
  }} />
);

const AdminDashboard = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const urlSection = searchParams.get("section");

  const [stats, setStats] = useState(null);
  const [chartsData, setChartsData] = useState(null);
  const [widgetsData, setWidgetsData] = useState(null);
  const [incidents, setIncidents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeSection, setActiveSection] = useState(urlSection || "all");
  const [toast, setToast] = useState(null);

  useEffect(() => {
    if (urlSection && urlSection !== activeSection) {
      setActiveSection(urlSection);
    }
  }, [urlSection]);

  const handleSectionChange = (sec) => {
    setActiveSection(sec);
    setSearchParams(sec === "all" ? {} : { section: sec });
  };

  /* Toast Helper */
  const showToast = (type, msg) => {
    setToast({ type, msg });
    setTimeout(() => setToast(null), 3500);
  };

  /* Load All Dashboard Analytics & Incidents */
  const loadDashboardData = useCallback(async () => {
    setLoading(true);
    try {
      const [statsRes, chartsRes, widgetsRes, incRes] = await Promise.all([
        getAdminStats(),
        getDashboardCharts(),
        getDashboardWidgets(),
        getIncidents({ limit: 40 }).catch(() => ({ incidents: [] })),
      ]);

      setStats(statsRes.stats);
      setChartsData(chartsRes);
      setWidgetsData(widgetsRes);
      setIncidents(incRes.incidents || []);
    } catch (error) {
      console.error("Failed to load dashboard data:", error);
      showToast("error", "Failed to refresh command center data.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadDashboardData();
  }, [loadDashboardData]);

  const viewTabs = [
    { id: "all", label: "Full Command Center" },
    { id: "constellation", label: "Threat Constellation" },
    { id: "evidence", label: "Blockchain Evidence Ledger" },
    { id: "analytics", label: "Analytics & Telemetry" },
    { id: "feeds", label: "Live Feeds & Audits" },
    { id: "users", label: "User Governance" },
    { id: "organizations", label: "Tenant Organizations" },
  ];

  return (
    <>
      <style>{`
        @keyframes adminSpin { to { transform: rotate(360deg); } }
        @keyframes adminToastIn { from { opacity:0; transform:translateY(12px); } to { opacity:1; transform:translateY(0); } }
        @keyframes owlPulse {
          0%, 100% { filter: drop-shadow(0 0 10px rgba(244, 197, 66, 0.45)); transform: scale(1); }
          50% { filter: drop-shadow(0 0 24px rgba(244, 197, 66, 0.8)); transform: scale(1.03); }
        }
        .view-pill-btn {
          border: 1px solid var(--border-subtle);
          background: var(--bg-surface);
          color: var(--text-secondary);
          padding: 8px 16px;
          border-radius: 8px;
          font-size: 0.8125rem;
          font-weight: 700;
          cursor: pointer;
          font-family: 'Space Grotesk', sans-serif;
          transition: all 0.16s ease;
          display: inline-flex;
          align-items: center;
          gap: 6px;
        }
        .view-pill-btn:hover {
          background: var(--bg-surface-elevated);
          color: var(--color-gold);
          border-color: var(--color-gold-border);
        }
        .view-pill-btn.active {
          background: var(--color-gold-soft);
          color: var(--color-gold);
          border-color: var(--color-gold);
          box-shadow: 0 0 14px var(--color-gold-glow);
        }
        .section-anchor-box {
          margin-bottom: 2rem;
          animation: adminToastIn 0.25s ease;
        }
      `}</style>

      {/* Toast Alert */}
      {toast && (
        <div style={{
          position: "fixed", bottom: 24, right: 24, zIndex: 9999,
          background: toast.type === "success" ? "var(--bg-surface)" : "#2B1112",
          border: `1px solid ${toast.type === "success" ? "var(--state-verified, #36D6AE)" : "#FF4D4F"}`,
          color: "var(--text-primary)", borderRadius: 10, padding: "12px 20px",
          fontSize: "0.88rem", fontWeight: 600, boxShadow: "var(--shadow-obsidian)",
          animation: "adminToastIn 0.3s ease",
          display: "flex", alignItems: "center", gap: 10, maxWidth: 400,
        }}>
          <span style={{ color: toast.type === "success" ? "var(--state-verified, #36D6AE)" : "#FF4D4F", fontSize: "1.1rem" }}>
            {toast.type === "success" ? "✓" : "⚠"}
          </span>
          {toast.msg}
        </div>
      )}

      {/* Remodeled Command Center Layout */}
      <DashboardLayout
        activeSection={activeSection}
        onSectionChange={handleSectionChange}
        onRefresh={loadDashboardData}
        loading={loading}
        stats={stats}
      >
        {/* Command Center Hero Banner — Obsidian × Sentinel Gold */}
        <div style={{
          background: "radial-gradient(ellipse at 20% 50%, var(--bg-surface-elevated) 0%, var(--bg-secondary) 80%)",
          borderRadius: 16,
          padding: "2rem 2.25rem",
          color: "var(--text-primary)",
          marginBottom: "1.75rem",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          flexWrap: "wrap",
          gap: 20,
          boxShadow: "var(--shadow-card)",
          border: "1px solid var(--border-subtle)",
          position: "relative",
          overflow: "hidden",
        }}>
          {/* Subtle Cyber Grid Background Accent */}
          <div style={{
            position: "absolute", inset: 0,
            backgroundImage: "linear-gradient(rgba(244, 197, 66, 0.03) 1px, transparent 1px), linear-gradient(90deg, rgba(244, 197, 66, 0.03) 1px, transparent 1px)",
            backgroundSize: "36px 36px",
            pointerEvents: "none",
          }} />

          <div style={{ display: "flex", alignItems: "center", gap: 20, flex: 1, minWidth: 320, position: "relative", zIndex: 1 }}>
            <div style={{
              width: 64, height: 64, borderRadius: 14,
              background: "var(--bg-surface)",
              display: "flex", alignItems: "center", justifyContent: "center",
              boxShadow: "var(--shadow-card)",
              border: "1.5px solid var(--color-gold-border)",
              flexShrink: 0,
              padding: 4,
            }}>
              <img
                src="/logo.png"
                alt="Owlyx Mascot"
                style={{ width: "100%", height: "100%", objectFit: "contain", animation: "owlPulse 4s ease-in-out infinite" }}
              />
            </div>
            <div>
              <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 6 }}>
                <span style={{
                  background: "var(--color-gold-soft)",
                  color: "var(--color-gold)",
                  border: "1px solid var(--color-gold-border)",
                  padding: "3px 10px",
                  borderRadius: 4,
                  fontSize: "0.72rem",
                  fontWeight: 800,
                  fontFamily: "var(--font-mono)",
                  letterSpacing: "0.06em",
                  textTransform: "uppercase",
                }}>
                  SECURITY COMMAND CENTER
                </span>
                <span style={{ color: "var(--text-muted)" }}>•</span>
                <span style={{ color: "var(--text-secondary)", fontSize: "0.82rem", fontFamily: "var(--font-heading)" }}>
                  Officer in Command: <strong style={{ color: "var(--text-primary)" }}>{user?.name || "Administrator"}</strong>
                </span>
              </div>

              <h1 style={{ fontSize: "2rem", fontWeight: 800, margin: 0, letterSpacing: "-0.02em", lineHeight: 1.15, fontFamily: "var(--font-heading)", color: "var(--text-primary)" }}>
                Owlyx <span style={{ color: "var(--color-gold)", fontSize: "1.2rem", fontWeight: 700, marginLeft: 6 }}>· Silent Watch. Unbreakable Proof.</span>
              </h1>
              <p style={{ color: "var(--text-secondary)", fontSize: "0.9rem", margin: "6px 0 0", maxWidth: 680, fontFamily: "var(--font-sans)" }}>
                Next-generation cybersecurity command center combining real-time Windows event telemetry, AI threat analysis, IPFS forensic evidence, and Hyperledger Fabric immutable ledger consensus.
              </p>
            </div>
          </div>

          {/* Quick Action Shortcuts */}
          <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap", position: "relative", zIndex: 1 }}>
            <button
              onClick={() => navigate("/admin/incidents")}
              style={{
                background: "linear-gradient(135deg, #F4C542 0%, #B58B20 100%)",
                color: "#080907", border: "none", borderRadius: 8,
                padding: "10px 18px", fontSize: "0.875rem", fontWeight: 800,
                cursor: "pointer", display: "inline-flex", alignItems: "center", gap: 8,
                boxShadow: "0 4px 16px rgba(244, 197, 66, 0.3)",
                fontFamily: "var(--font-heading)",
                transition: "all 0.15s ease",
              }}
              onMouseEnter={(e) => e.currentTarget.style.filter = "brightness(1.1)"}
              onMouseLeave={(e) => e.currentTarget.style.filter = "brightness(1.0)"}
            >
              <span>Manage Incidents</span>
              <ExternalLinkIcon size={14} />
            </button>

            <button
              onClick={() => navigate("/admin/live-security-logs")}
              style={{
                background: "var(--bg-surface)",
                color: "var(--state-verified)",
                border: "1px solid rgba(54, 214, 174, 0.4)",
                borderRadius: 8,
                padding: "10px 18px", fontSize: "0.875rem", fontWeight: 700,
                cursor: "pointer", display: "inline-flex", alignItems: "center", gap: 8,
                fontFamily: "var(--font-heading)",
                transition: "all 0.15s ease",
              }}
              onMouseEnter={(e) => e.currentTarget.style.background = "rgba(54, 214, 174, 0.1)"}
              onMouseLeave={(e) => e.currentTarget.style.background = "var(--bg-surface)"}
            >
              <span style={{ width: 8, height: 8, borderRadius: "50%", background: "var(--state-verified)", boxShadow: "0 0 8px var(--state-verified)" }} />
              <span>Live Telemetry (REAL)</span>
              <ExternalLinkIcon size={14} />
            </button>

            <button
              onClick={() => navigate("/admin/security-logs")}
              style={{
                background: "var(--bg-surface)",
                color: "var(--text-primary)", border: "1px solid var(--border-subtle)",
                borderRadius: 8, padding: "10px 16px", fontSize: "0.875rem", fontWeight: 600,
                cursor: "pointer", display: "inline-flex", alignItems: "center", gap: 8,
                fontFamily: "var(--font-heading)",
                transition: "all 0.15s ease",
              }}
              onMouseEnter={(e) => e.currentTarget.style.borderColor = "var(--color-gold)"}
              onMouseLeave={(e) => e.currentTarget.style.borderColor = "var(--border-subtle)"}
            >
              <span>Security Logs Ledger</span>
              <ExternalLinkIcon size={14} />
            </button>
          </div>
        </div>

        {/* Horizontal Navigation Pills */}
        <div style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          flexWrap: "wrap",
          gap: 12,
          marginBottom: "1.75rem",
          paddingBottom: "0.75rem",
          borderBottom: "1px solid #292B22",
        }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
            <span style={{ fontSize: "0.8125rem", fontWeight: 700, color: "#9B9D91", marginRight: 4, display: "flex", alignItems: "center", gap: 4, fontFamily: "Space Grotesk, sans-serif" }}>
              <FilterIcon size={14} /> View Filter:
            </span>
            {viewTabs.map((tab) => (
              <button
                key={tab.id}
                className={`view-pill-btn ${activeSection === tab.id ? "active" : ""}`}
                onClick={() => setActiveSection(tab.id)}
              >
                {tab.label}
              </button>
            ))}
          </div>

          <div style={{ fontSize: "0.8rem", color: "#686B60", fontFamily: "JetBrains Mono, monospace" }}>
            {activeSection === "all" ? "Showing all command center modules" : `Filtered to ${activeSection}`}
          </div>
        </div>

        {/* Main Content Sections */}
        {loading && !stats ? (
          <div style={{
            display: "flex", flexDirection: "column",
            justifyContent: "center", alignItems: "center",
            height: "360px", gap: 16,
          }}>
            <Spinner size={44} color="#F4C542" />
            <div style={{ color: "#9B9D91", fontSize: "0.9375rem", fontWeight: 600, fontFamily: "Space Grotesk, sans-serif" }}>
              Synchronizing with Owlyx Sentinel Engine & Hyperledger Fabric...
            </div>
          </div>
        ) : (
          <>
            {/* 1. HIGH-VALUE METRIC CARDS (10 Cards) */}
            {(activeSection === "all" || activeSection === "analytics") && (
              <div className="section-anchor-box">
                <DashboardCards stats={stats} />
              </div>
            )}

            {/* 2. SIGNATURE CENTERPIECE: THREAT CONSTELLATION GRAPH */}
            {(activeSection === "all" || activeSection === "constellation") && (
              <div className="section-anchor-box">
                <ThreatConstellation incidents={incidents} logs={[]} />
              </div>
            )}

            {/* 3. SIGNATURE BLOCKCHAIN EVIDENCE INTEGRITY LEDGER */}
            {(activeSection === "all" || activeSection === "evidence") && (
              <div className="section-anchor-box">
                <BlockchainEvidenceLedger incidents={incidents} />
              </div>
            )}

            {/* 4. CHARTS SECTION (5 Charts) */}
            {(activeSection === "all" || activeSection === "analytics") && (
              <div className="section-anchor-box">
                <DashboardCharts chartsData={chartsData} />
              </div>
            )}

            {/* 5. WIDGETS SECTION (4 Feeds/Widgets) */}
            {(activeSection === "all" || activeSection === "feeds") && (
              <div className="section-anchor-box">
                <DashboardWidgets widgetsData={widgetsData} />
              </div>
            )}

            {/* 6. USER MANAGEMENT SECTION */}
            {(activeSection === "all" || activeSection === "users") && (
              <div className="section-anchor-box">
                <UserManagement onUserUpdated={loadDashboardData} />
              </div>
            )}

            {/* 7. ORGANIZATION MANAGEMENT SECTION */}
            {(activeSection === "all" || activeSection === "organizations") && (
              <div className="section-anchor-box">
                <OrganizationManagement onOrgUpdated={loadDashboardData} />
              </div>
            )}

            {/* Cryptographic Proof Footer Banner */}
            <div style={{
              marginTop: "2.5rem",
              padding: "1.25rem 1.75rem",
              background: "var(--bg-surface)",
              borderRadius: 14,
              display: "flex",
              alignItems: "center",
              gap: 16,
              boxShadow: "var(--shadow-card)",
              border: "1px solid var(--border-subtle)",
            }}>
              <div style={{
                width: 44, height: 44, borderRadius: 10,
                background: "var(--color-gold-soft)",
                border: "1px solid var(--color-gold-border)",
                display: "flex", alignItems: "center", justifyContent: "center",
                color: "var(--color-gold)", flexShrink: 0,
              }}>
                <ShieldCheckIcon size={24} />
              </div>
              <div style={{ flex: 1 }}>
                <div style={{ color: "var(--color-gold)", fontWeight: 800, fontSize: "0.95rem", fontFamily: "var(--font-heading)" }}>
                  Cryptographic Integrity & Fabric Consensus Active
                </div>
                <p style={{ color: "var(--text-secondary)", fontSize: "0.82rem", margin: "3px 0 0", lineHeight: 1.4, fontFamily: "var(--font-sans)" }}>
                  All security incident mutations, evidence SHA-256 hashes, Pinata IPFS CIDs, and administrative changes are permanently recorded to the Hyperledger Fabric channel <code style={{ color: "var(--color-gold)", background: "var(--bg-secondary)", padding: "1px 6px", borderRadius: 4, fontFamily: "var(--font-mono)" }}>incidentchannel</code>.
                </p>
              </div>
              <span style={{
                background: "rgba(54, 214, 174, 0.12)",
                color: "#36D6AE",
                border: "1px solid rgba(54, 214, 174, 0.4)",
                padding: "4px 12px",
                borderRadius: 9999,
                fontSize: "0.75rem",
                fontWeight: 800,
                fontFamily: "JetBrains Mono, monospace",
                letterSpacing: "0.04em",
                whiteSpace: "nowrap",
              }}>
                ✓ UNBREAKABLE PROOF
              </span>
            </div>
          </>
        )}
      </DashboardLayout>
    </>
  );
};

export default AdminDashboard;
