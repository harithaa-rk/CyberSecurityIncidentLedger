import React from "react";

/* Helper date formatter */
const formatTimeAgo = (isoDate) => {
  if (!isoDate) return "Just now";
  const diffSec = Math.floor((new Date() - new Date(isoDate)) / 1000);
  if (diffSec < 60) return "Just now";
  if (diffSec < 3600) return `${Math.floor(diffSec / 60)}m ago`;
  if (diffSec < 86400) return `${Math.floor(diffSec / 3600)}h ago`;
  return `${Math.floor(diffSec / 86400)}d ago`;
};

/* Severity badge for logs */
const SeverityBadge = ({ severity }) => {
  const styles = {
    Critical: { bg: "#fef2f2", color: "#b91c1c", border: "#fecaca" },
    High:     { bg: "#fff7ed", color: "#c2410c", border: "#ffedd5" },
    Medium:   { bg: "#fffbeb", color: "#b45309", border: "#fef3c7" },
    Low:      { bg: "#f0fdf4", color: "#15803d", border: "#bbf7d0" },
  };
  const s = styles[severity] || styles.Low;
  return (
    <span style={{
      padding: "2px 8px", borderRadius: 999, fontSize: "0.7rem", fontWeight: 700,
      background: s.bg, color: s.color, border: `1px solid ${s.border}`,
    }}>
      {severity}
    </span>
  );
};

/* Log verification status badge */
const LogStatusBadge = ({ status }) => {
  const isVerified = status === "Verified";
  const isTampered = status === "Tampered";
  return (
    <span style={{
      padding: "2px 8px", borderRadius: 999, fontSize: "0.7rem", fontWeight: 700,
      background: isVerified ? "#ecfdf5" : isTampered ? "#fff1f2" : "#f8fafc",
      color:      isVerified ? "#059669" : isTampered ? "#e11d48" : "#64748b",
      border: `1px solid ${isVerified ? "#a7f3d0" : isTampered ? "#fecdd3" : "#e2e8f0"}`,
      display: "inline-flex", alignItems: "center", gap: 4,
    }}>
      {isVerified ? "✓ Verified" : isTampered ? "⚠️ Tampered" : "Unverified"}
    </span>
  );
};

/* ─────────────────────────────────────────────
   Widget 1: Recent Activities Timeline
───────────────────────────────────────────── */
const EmptyState = ({ message }) => (
  <div style={{
    textAlign: "center", padding: "2rem 1rem",
    color: "#94a3b8", fontSize: "0.875rem", fontWeight: 500,
  }}>
    <div style={{ fontSize: "1.75rem", marginBottom: 8 }}>📭</div>
    {message}
  </div>
);

const RecentActivitiesWidget = ({ activities = [] }) => {
  if (!activities.length) return <EmptyState message="No activity records in the database yet." />;
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
      {activities.slice(0, 5).map((act, i) => (
        <div key={act._id || i} style={{
          display: "flex", alignItems: "flex-start", gap: 12,
          paddingBottom: 10, borderBottom: i !== 4 ? "1px solid var(--border-subtle)" : "none",
        }}>
          <div style={{
            width: 32, height: 32, borderRadius: "50%",
            background: "var(--color-gold-soft)", color: "var(--color-gold)",
            display: "flex", alignItems: "center", justifyContent: "center",
            fontWeight: 700, fontSize: "0.8rem", flexShrink: 0, marginTop: 2,
          }}>
            {act.userName?.charAt(0) || "A"}
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: "0.8125rem", color: "var(--text-primary)", fontWeight: 600, lineHeight: 1.3 }}>
              {act.action}
            </div>
            <div style={{ fontSize: "0.75rem", color: "var(--text-secondary)", marginTop: 2 }}>
              by <strong style={{ color: "var(--color-gold)" }}>{act.userName}</strong> • {formatTimeAgo(act.createdAt)}
            </div>
          </div>
        </div>
      ))}
    </div>
  );
};

/* ─────────────────────────────────────────────
   Widget 2: Latest Security Logs
───────────────────────────────────────────── */
const LatestLogsWidget = ({ logs = [] }) => {
  if (!logs.length) return <EmptyState message="No security logs found in the database." />;
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
      {logs.slice(0, 5).map((log) => (
        <div key={log._id || log.logId} style={{
          padding: "10px 12px", borderRadius: "10px", background: "var(--bg-secondary)",
          border: "1px solid var(--border-subtle)", display: "flex", alignItems: "center",
          justifyContent: "space-between", gap: 10,
        }}>
          <div style={{ minWidth: 0, flex: 1 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
              <span style={{ fontFamily: "var(--font-mono)", fontSize: "0.75rem", fontWeight: 700, color: "var(--color-gold)" }}>
                {log.logId}
              </span>
              <SeverityBadge severity={log.severity} />
            </div>
            <div style={{ fontSize: "0.8125rem", fontWeight: 600, color: "var(--text-primary)", marginTop: 4, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
              {log.title}
            </div>
          </div>
          <LogStatusBadge status={log.status} />
        </div>
      ))}
    </div>
  );
};

/* ─────────────────────────────────────────────
   Widget 3: Latest Users
───────────────────────────────────────────── */
const LatestUsersWidget = ({ users = [] }) => {
  if (!users.length) return <EmptyState message="No users registered in the database yet." />;
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
      {users.slice(0, 5).map((u) => (
        <div key={u._id} style={{
          display: "flex", alignItems: "center", justifyContent: "space-between",
          padding: "8px 10px", borderRadius: "10px", border: "1px solid var(--border-subtle)",
          background: "var(--bg-secondary)",
        }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <div style={{
              width: 32, height: 32, borderRadius: "50%",
              background: "linear-gradient(135deg, #0d7377, #14a8ad)",
              color: "#fff", display: "flex", alignItems: "center", justifyContent: "center",
              fontWeight: 700, fontSize: "0.8125rem", flexShrink: 0,
            }}>
              {u.name?.charAt(0).toUpperCase()}
            </div>
            <div>
              <div style={{ fontSize: "0.8125rem", fontWeight: 700, color: "var(--text-primary)" }}>{u.name}</div>
              <div style={{ fontSize: "0.75rem", color: "var(--text-secondary)" }}>{u.email}</div>
            </div>
          </div>
          <span style={{
            fontSize: "0.7rem", fontWeight: 700, padding: "2px 8px", borderRadius: 999,
            background: "var(--color-gold-soft)", color: "var(--color-gold)", border: "1px solid var(--color-gold-border)",
          }}>
            {u.role}
          </span>
        </div>
      ))}
    </div>
  );
};

/* ─────────────────────────────────────────────
   Widget 4: Latest Blockchain Transactions
───────────────────────────────────────────── */
const LatestTransactionsWidget = ({ transactions = [] }) => {
  if (!transactions.length) return <EmptyState message="No blockchain transactions recorded yet." />;
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
      {transactions.slice(0, 5).map((tx) => (
        <div key={tx._id || tx.txHash} style={{
          padding: "10px 12px", borderRadius: "10px", background: "var(--bg-secondary)",
          border: "1px solid var(--border-subtle)", display: "flex", alignItems: "center",
          justifyContent: "space-between", gap: 10,
        }}>
          <div>
            <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
              <span style={{ fontFamily: "var(--font-mono)", fontSize: "0.75rem", fontWeight: 700, color: "var(--color-gold)" }}>
                {tx.txHash ? `${tx.txHash.slice(0, 8)}...${tx.txHash.slice(-6)}` : "0x..."}
              </span>
              <span style={{ fontSize: "0.6875rem", background: "var(--color-gold-soft)", color: "var(--color-gold)", padding: "1px 6px", borderRadius: 4, fontWeight: 700 }}>
                Block #{tx.blockNumber}
              </span>
            </div>
            <div style={{ fontSize: "0.75rem", color: "var(--text-secondary)", marginTop: 4 }}>
              Linked: <strong style={{ color: "var(--text-primary)" }}>{tx.logId}</strong>
            </div>
          </div>
          <span style={{
            fontSize: "0.7rem", fontWeight: 700, color: "var(--state-verified)", background: "rgba(54, 214, 174, 0.12)",
            padding: "2px 8px", borderRadius: 999, border: "1px solid rgba(54, 214, 174, 0.3)",
          }}>
            ✓ Confirmed
          </span>
        </div>
      ))}
    </div>
  );
};

/* ─────────────────────────────────────────────
   Main Widgets Grid Container with Auto Alignment
───────────────────────────────────────────── */
const DashboardWidgets = ({ widgetsData }) => {
  if (!widgetsData) return null;

  const cardStyle = {
    background: "var(--bg-surface)",
    border: "1px solid var(--border-subtle)",
    borderRadius: "14px",
    padding: "1.5rem",
    boxShadow: "var(--shadow-card)",
    minWidth: 0,
  };

  const titleStyle = {
    fontSize: "1rem",
    fontWeight: 700,
    fontFamily: "var(--font-heading)",
    color: "var(--text-primary)",
    marginBottom: "1.25rem",
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
  };

  return (
    <div style={{
      display: "grid",
      gridTemplateColumns: "repeat(auto-fit, minmax(310px, 1fr))",
      gap: "1.25rem",
      marginBottom: "2.5rem",
      width: "100%",
    }}>
      {/* Widget 1: Recent Activities */}
      <div style={cardStyle}>
        <div style={titleStyle}>
          <span>🔔 Recent Activities</span>
          <span style={{ fontSize: "0.75rem", color: "var(--text-muted)" }}>Live Feed</span>
        </div>
        <RecentActivitiesWidget activities={widgetsData.recentActivities} />
      </div>

      {/* Widget 2: Latest Security Logs */}
      <div style={cardStyle}>
        <div style={titleStyle}>
          <span>📋 Latest Security Logs</span>
          <span style={{ fontSize: "0.75rem", color: "var(--color-gold)", fontWeight: 600 }}>Real-time</span>
        </div>
        <LatestLogsWidget logs={widgetsData.latestLogs} />
      </div>

      {/* Widget 3: Latest Users */}
      <div style={cardStyle}>
        <div style={titleStyle}>
          <span>👥 Latest Users</span>
          <span style={{ fontSize: "0.75rem", color: "var(--color-gold)", fontWeight: 600 }}>Newly Joined</span>
        </div>
        <LatestUsersWidget users={widgetsData.latestUsers} />
      </div>

      {/* Widget 4: Latest Blockchain Transactions */}
      <div style={cardStyle}>
        <div style={titleStyle}>
          <span>⛓️ Blockchain Ledger</span>
          <span style={{ fontSize: "0.75rem", color: "var(--state-verified)", fontWeight: 600 }}>Immutable</span>
        </div>
        <LatestTransactionsWidget transactions={widgetsData.latestTransactions} />
      </div>
    </div>
  );
};

export default DashboardWidgets;
