import React from "react";

/* Icons for cards */
const IconUsers = () => (
  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/>
  </svg>
);

const IconOrg = () => (
  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <rect x="2" y="7" width="20" height="14" rx="2" ry="2"/><path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16"/>
  </svg>
);

const IconLogs = () => (
  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/>
  </svg>
);

const IconCritical = () => (
  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <polygon points="12 2 2 7 12 12 22 7 12 2"/><polyline points="2 17 12 22 22 17"/><polyline points="2 12 12 17 22 12"/>
  </svg>
);

const IconHigh = () => (
  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/>
  </svg>
);

const IconMedium = () => (
  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/>
  </svg>
);

const IconLow = () => (
  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>
  </svg>
);

const IconVerified = () => (
  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/>
  </svg>
);

const IconTampered = () => (
  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/>
  </svg>
);

const IconBlockchain = () => (
  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <rect x="2" y="7" width="6" height="6" rx="1"/><rect x="16" y="7" width="6" height="6" rx="1"/><rect x="9" y="15" width="6" height="6" rx="1"/><path d="M5 13v3a2 2 0 0 0 2 2h2"/><path d="M19 13v3a2 2 0 0 1-2 2h-2"/>
  </svg>
);

const CARD_CONFIG = [
  { key: "totalUsers", label: "Registered Users", icon: <IconUsers />, color: "var(--color-gold)", bg: "var(--color-gold-soft)" },
  { key: "totalOrganizations", label: "Tenant Orgs", icon: <IconOrg />, color: "#B58B20", bg: "rgba(181, 139, 32, 0.12)" },
  { key: "totalLogs", label: "Ingested Logs", icon: <IconLogs />, color: "var(--color-gold)", bg: "var(--color-gold-soft)" },
  { key: "criticalIncidents", label: "Critical Threats", icon: <IconCritical />, color: "var(--state-critical)", bg: "rgba(255, 77, 79, 0.14)" },
  { key: "highIncidents", label: "High Threats", icon: <IconHigh />, color: "#FF7849", bg: "rgba(255, 120, 73, 0.14)" },
  { key: "mediumIncidents", label: "Medium Alerts", icon: <IconMedium />, color: "#FFB547", bg: "rgba(255, 181, 71, 0.14)" },
  { key: "lowIncidents", label: "Low Severities", icon: <IconLow />, color: "var(--state-verified)", bg: "rgba(54, 214, 174, 0.12)" },
  { key: "verifiedLogs", label: "Blockchain Verified", icon: <IconVerified />, color: "var(--state-verified)", bg: "rgba(54, 214, 174, 0.14)" },
  { key: "tamperedLogs", label: "Tampering Alerts", icon: <IconTampered />, color: "var(--state-critical)", bg: "rgba(255, 77, 79, 0.14)" },
  { key: "blockchainTransactions", label: "Fabric Block Txs", icon: <IconBlockchain />, color: "var(--color-gold)", bg: "var(--color-gold-soft)" },
];

const DashboardCards = ({ stats }) => {
  return (
    <div style={{
      display: "grid",
      gridTemplateColumns: "repeat(auto-fit, minmax(210px, 1fr))",
      gap: "1.25rem",
      marginBottom: "2rem",
      width: "100%",
    }}>
      {CARD_CONFIG.map((card) => {
        const val = stats?.[card.key] ?? "—";
        return (
          <div
            key={card.key}
            style={{
              background: "var(--bg-surface)",
              border: "1px solid var(--border-subtle)",
              borderRadius: "14px",
              padding: "1.25rem 1.25rem",
              display: "flex",
              alignItems: "center",
              gap: "1rem",
              boxShadow: "var(--shadow-card)",
              transition: "all 0.25s ease-in-out",
              position: "relative",
              overflow: "hidden",
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.transform = "translateY(-3px)";
              e.currentTarget.style.borderColor = card.color;
              e.currentTarget.style.boxShadow = `0 8px 24px ${card.color}25`;
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.transform = "translateY(0)";
              e.currentTarget.style.borderColor = "var(--border-subtle)";
              e.currentTarget.style.boxShadow = "var(--shadow-card)";
            }}
          >
            {/* Top decorative accent bar */}
            <div style={{
              position: "absolute",
              top: 0,
              left: 0,
              right: 0,
              height: "3px",
              background: card.color,
            }} />

            {/* Icon Avatar Container */}
            <div style={{
              width: 46,
              height: 46,
              borderRadius: "10px",
              background: card.bg,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              color: card.color,
              flexShrink: 0,
              border: `1px solid ${card.color}40`,
            }}>
              {card.icon}
            </div>

            {/* Content */}
            <div style={{ minWidth: 0, flex: 1 }}>
              <div style={{
                fontSize: "1.65rem",
                fontWeight: 800,
                color: "var(--text-primary)",
                lineHeight: 1.1,
                fontFamily: "var(--font-mono)",
                letterSpacing: "-0.02em",
              }}>
                {val}
              </div>
              <div style={{
                fontSize: "0.8rem",
                color: "var(--text-secondary)",
                fontFamily: "var(--font-heading)",
                fontWeight: 600,
                marginTop: 4,
                whiteSpace: "nowrap",
                overflow: "hidden",
                textOverflow: "ellipsis",
              }}>
                {card.label}
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
};

export default DashboardCards;
