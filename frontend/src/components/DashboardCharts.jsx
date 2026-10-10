import React, { useState } from "react";

/* ─────────────────────────────────────────────
   1. Daily Incidents Chart (Line / Area SVG)
───────────────────────────────────────────── */
const DailyIncidentsChart = ({ data = [] }) => {
  const [hoverIndex, setHoverIndex] = useState(null);
  const maxVal = Math.max(...data.map((d) => d.incidents), 40);

  // Calculate SVG point coordinates
  const width = 450;
  const height = 180;
  const padding = 30;

  const points = data.map((d, i) => {
    const x = padding + (i / (data.length - 1 || 1)) * (width - 2 * padding);
    const y = height - padding - (d.incidents / maxVal) * (height - 2 * padding);
    return { x, y, ...d };
  });

  const pathD = points.length
    ? `M ${points[0].x} ${points[0].y} ` +
      points
        .slice(1)
        .map((p, i) => {
          const prev = points[i];
          const cx1 = prev.x + (p.x - prev.x) / 2;
          const cy1 = prev.y;
          const cx2 = prev.x + (p.x - prev.x) / 2;
          const cy2 = p.y;
          return `C ${cx1} ${cy1}, ${cx2} ${cy2}, ${p.x} ${p.y}`;
        })
        .join(" ")
    : "";

  const areaD = points.length
    ? `${pathD} L ${points[points.length - 1].x} ${height - padding} L ${points[0].x} ${height - padding} Z`
    : "";

  return (
    <div style={{ position: "relative", width: "100%" }}>
      <svg viewBox={`0 0 ${width} ${height}`} style={{ width: "100%", height: "auto", overflow: "visible" }}>
        <defs>
          <linearGradient id="dailyGradient" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#2563eb" stopOpacity="0.35" />
            <stop offset="100%" stopColor="#2563eb" stopOpacity="0.0" />
          </linearGradient>
        </defs>

        {/* Grid lines */}
        {[0, 0.33, 0.66, 1].map((ratio, idx) => (
          <line
            key={idx}
            x1={padding}
            y1={height - padding - ratio * (height - 2 * padding)}
            x2={width - padding}
            y2={height - padding - ratio * (height - 2 * padding)}
            stroke="#e2e8f0"
            strokeDasharray="4 4"
          />
        ))}

        {/* Gradient Area Fill */}
        <path d={areaD} fill="url(#dailyGradient)" />

        {/* Smooth Curve Line */}
        <path d={pathD} fill="none" stroke="#2563eb" strokeWidth="3" strokeLinecap="round" />

        {/* Data points & X labels */}
        {points.map((p, i) => (
          <g key={i} onMouseEnter={() => setHoverIndex(i)} onMouseLeave={() => setHoverIndex(null)} style={{ cursor: "pointer" }}>
            <circle cx={p.x} cy={p.y} r={hoverIndex === i ? "6" : "4"} fill="#ffffff" stroke="#2563eb" strokeWidth="2.5" />
            <text x={p.x} y={height - 8} textAnchor="middle" fontSize="11" fill="#64748b" fontWeight="600">
              {p.day}
            </text>
          </g>
        ))}
      </svg>

      {/* Hover Tooltip */}
      {hoverIndex !== null && (
        <div style={{
          position: "absolute",
          top: points[hoverIndex].y - 38,
          left: `${(points[hoverIndex].x / width) * 100}%`,
          transform: "translateX(-50%)",
          background: "#0f2744",
          color: "#fff",
          padding: "4px 8px",
          borderRadius: "6px",
          fontSize: "0.75rem",
          fontWeight: 700,
          whiteSpace: "nowrap",
          pointerEvents: "none",
          boxShadow: "0 4px 12px rgba(0,0,0,0.15)",
        }}>
          {points[hoverIndex].incidents} incidents ({points[hoverIndex].critical} critical)
        </div>
      )}
    </div>
  );
};

/* ─────────────────────────────────────────────
   2. Monthly Incidents Chart (Bar SVG)
───────────────────────────────────────────── */
const MonthlyIncidentsChart = ({ data = [] }) => {
  const [hoverIdx, setHoverIdx] = useState(null);
  const maxVal = Math.max(...data.map((d) => d.count), 100);
  const width = 450;
  const height = 180;
  const padding = 30;

  const barWidth = 32;
  const step = (width - 2 * padding) / data.length;

  return (
    <div style={{ position: "relative", width: "100%" }}>
      <svg viewBox={`0 0 ${width} ${height}`} style={{ width: "100%", height: "auto", overflow: "visible" }}>
        <defs>
          <linearGradient id="barGradient" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#0d7377" />
            <stop offset="100%" stopColor="#14a8ad" />
          </linearGradient>
        </defs>

        {data.map((d, i) => {
          const x = padding + i * step + step / 2 - barWidth / 2;
          const barH = (d.count / maxVal) * (height - 2 * padding);
          const y = height - padding - barH;
          const isHovered = hoverIdx === i;

          return (
            <g key={i} onMouseEnter={() => setHoverIdx(i)} onMouseLeave={() => setHoverIdx(null)} style={{ cursor: "pointer" }}>
              <rect
                x={x}
                y={y}
                width={barWidth}
                height={barH}
                rx="6"
                fill={isHovered ? "#0f2744" : "url(#barGradient)"}
                transition="all 0.2s"
              />
              <text x={x + barWidth / 2} y={height - 8} textAnchor="middle" fontSize="11" fill="#64748b" fontWeight="600">
                {d.month}
              </text>
              <text x={x + barWidth / 2} y={y - 6} textAnchor="middle" fontSize="11" fill="#0d1b2e" fontWeight="700">
                {d.count}
              </text>
            </g>
          );
        })}
      </svg>
    </div>
  );
};

/* ─────────────────────────────────────────────
   3. Severity Distribution (Donut SVG)
───────────────────────────────────────────── */
const SeverityDistributionChart = ({ data = [] }) => {
  const total = data.reduce((acc, d) => acc + d.value, 0) || 1;
  let cumulativeAngle = 0;

  const size = 160;
  const center = size / 2;
  const radius = 60;
  const strokeWidth = 24;

  const slices = data.map((d) => {
    const angle = (d.value / total) * 360;
    const startAngle = cumulativeAngle;
    cumulativeAngle += angle;

    const x1 = center + radius * Math.cos((Math.PI * startAngle) / 180);
    const y1 = center + radius * Math.sin((Math.PI * startAngle) / 180);
    const x2 = center + radius * Math.cos((Math.PI * (startAngle + angle)) / 180);
    const y2 = center + radius * Math.sin((Math.PI * (startAngle + angle)) / 180);

    const largeArc = angle > 180 ? 1 : 0;
    const pathData = `M ${x1} ${y1} A ${radius} ${radius} 0 ${largeArc} 1 ${x2} ${y2}`;

    return { ...d, pathData, percentage: Math.round((d.value / total) * 100) };
  });

  return (
    <div style={{ display: "flex", alignItems: "center", gap: "1.5rem", width: "100%", flexWrap: "wrap" }}>
      {/* SVG Donut */}
      <div style={{ position: "relative", width: 140, height: 140, flexShrink: 0, margin: "0 auto" }}>
        <svg viewBox={`0 0 ${size} ${size}`} style={{ width: "100%", height: "100%", transform: "rotate(-90deg)" }}>
          {slices.map((slice, i) => (
            <path
              key={i}
              d={slice.pathData}
              fill="none"
              stroke={slice.color}
              strokeWidth={strokeWidth}
              strokeLinecap="round"
            />
          ))}
        </svg>
        <div style={{
          position: "absolute", inset: 0, display: "flex",
          flexDirection: "column", alignItems: "center", justifyContent: "center",
          textAlign: "center",
        }}>
          <span style={{ fontSize: "1.25rem", fontWeight: 800, color: "var(--text-primary)", lineHeight: 1 }}>{total}</span>
          <span style={{ fontSize: "0.7rem", color: "var(--text-muted)", fontWeight: 600 }}>Total</span>
        </div>
      </div>

      {/* Legend list */}
      <div style={{ flex: 1, minWidth: 150, display: "flex", flexDirection: "column", gap: "8px" }}>
        {slices.map((d, i) => (
          <div key={i} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", fontSize: "0.8125rem" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <span style={{ width: 10, height: 10, borderRadius: "50%", background: d.color }} />
              <span style={{ color: "var(--text-secondary)", fontWeight: 600 }}>{d.name}</span>
            </div>
            <div style={{ fontWeight: 800, color: "var(--text-primary)" }}>
              {d.value} <span style={{ color: "var(--text-muted)", fontWeight: 500 }}>({d.percentage}%)</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

/* ─────────────────────────────────────────────
   4. Attack Types Breakdown Chart (Progress Bars)
───────────────────────────────────────────── */
const AttackTypesChart = ({ data = [] }) => {
  const maxVal = Math.max(...data.map((d) => d.count), 1);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "12px", width: "100%" }}>
      {data.map((item, i) => {
        const pct = Math.round((item.count / maxVal) * 100);
        return (
          <div key={i} style={{ width: "100%" }}>
            <div style={{ display: "flex", justifyContent: "space-between", fontSize: "0.8125rem", marginBottom: 4 }}>
              <span style={{ fontWeight: 600, color: "#1e293b" }}>{item.type}</span>
              <span style={{ fontWeight: 800, color: "#0f2744" }}>{item.count} incidents</span>
            </div>
            <div style={{ height: 8, background: "#f1f5f9", borderRadius: 999, overflow: "hidden" }}>
              <div style={{
                height: "100%",
                width: `${pct}%`,
                background: "linear-gradient(90deg, #7c3aed, #2563eb)",
                borderRadius: 999,
                transition: "width 0.6s ease-out",
              }} />
            </div>
          </div>
        );
      })}
    </div>
  );
};

/* ─────────────────────────────────────────────
   5. Upload Trend Chart (Area Ingest Velocity)
───────────────────────────────────────────── */
const UploadTrendChart = ({ data = [] }) => {
  const maxRate = Math.max(...data.map((d) => d.rate), 50);
  const width = 450;
  const height = 180;
  const padding = 30;

  const points = data.map((d, i) => {
    const x = padding + (i / (data.length - 1 || 1)) * (width - 2 * padding);
    const y = height - padding - (d.rate / maxRate) * (height - 2 * padding);
    return { x, y, ...d };
  });

  const pathD = points.length
    ? `M ${points[0].x} ${points[0].y} ` + points.slice(1).map((p) => `L ${p.x} ${p.y}`).join(" ")
    : "";

  const areaD = points.length
    ? `${pathD} L ${points[points.length - 1].x} ${height - padding} L ${points[0].x} ${height - padding} Z`
    : "";

  return (
    <div style={{ position: "relative", width: "100%" }}>
      <svg viewBox={`0 0 ${width} ${height}`} style={{ width: "100%", height: "auto", overflow: "visible" }}>
        <defs>
          <linearGradient id="uploadGradient" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#10b981" stopOpacity="0.4" />
            <stop offset="100%" stopColor="#10b981" stopOpacity="0.0" />
          </linearGradient>
        </defs>

        {/* Gradient fill */}
        <path d={areaD} fill="url(#uploadGradient)" />

        {/* Path line */}
        <path d={pathD} fill="none" stroke="#10b981" strokeWidth="3" />

        {/* Points & Labels */}
        {points.map((p, i) => (
          <g key={i}>
            <circle cx={p.x} cy={p.y} r="4" fill="#ffffff" stroke="#10b981" strokeWidth="2" />
            <text x={p.x} y={height - 8} textAnchor="middle" fontSize="11" fill="#64748b" fontWeight="600">
              {p.time}
            </text>
          </g>
        ))}
      </svg>
    </div>
  );
};

/* ─────────────────────────────────────────────
   Main Container with Auto-Aligned Responsive Grid
───────────────────────────────────────────── */
const DashboardCharts = ({ chartsData }) => {
  if (!chartsData) return null;

  const cardStyle = {
    background: "var(--bg-surface)",
    border: "1px solid var(--border-subtle)",
    borderRadius: "14px",
    padding: "1.5rem",
    boxShadow: "var(--shadow-card)",
    display: "flex",
    flexDirection: "column",
    justifyContent: "space-between",
    minWidth: 0,
  };

  const titleStyle = {
    fontSize: "1rem",
    fontWeight: 700,
    fontFamily: "var(--font-heading)",
    color: "var(--text-primary)",
    marginBottom: "1rem",
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
  };

  return (
    <div style={{
      display: "grid",
      gridTemplateColumns: "repeat(auto-fit, minmax(340px, 1fr))",
      gap: "1.25rem",
      marginBottom: "2.5rem",
      width: "100%",
    }}>
      {/* 1. Daily Incidents */}
      <div style={cardStyle}>
        <div style={titleStyle}>
          <span>📈 Daily Incidents Trend</span>
          <span style={{ fontSize: "0.75rem", background: "var(--bg-secondary)", color: "var(--color-gold)", border: "1px solid var(--border-subtle)", padding: "2px 8px", borderRadius: 999 }}>Past 7 Days</span>
        </div>
        <DailyIncidentsChart data={chartsData.dailyIncidents} />
      </div>

      {/* 2. Monthly Incidents */}
      <div style={cardStyle}>
        <div style={titleStyle}>
          <span>📊 Monthly Incidents Volume</span>
          <span style={{ fontSize: "0.75rem", background: "var(--bg-secondary)", color: "var(--color-gold)", border: "1px solid var(--border-subtle)", padding: "2px 8px", borderRadius: 999 }}>Last 6 Months</span>
        </div>
        <MonthlyIncidentsChart data={chartsData.monthlyIncidents} />
      </div>

      {/* 3. Severity Distribution */}
      <div style={cardStyle}>
        <div style={titleStyle}>
          <span>🎯 Severity Distribution</span>
          <span style={{ fontSize: "0.75rem", background: "rgba(255, 77, 79, 0.12)", color: "var(--state-critical)", border: "1px solid rgba(255, 77, 79, 0.3)", padding: "2px 8px", borderRadius: 999 }}>Categorized</span>
        </div>
        <SeverityDistributionChart data={chartsData.severityDistribution} />
      </div>

      {/* 4. Attack Types */}
      <div style={cardStyle}>
        <div style={titleStyle}>
          <span>🛡️ Top Attack Types</span>
          <span style={{ fontSize: "0.75rem", background: "rgba(147, 51, 234, 0.12)", color: "#a855f7", border: "1px solid rgba(147, 51, 234, 0.3)", padding: "2px 8px", borderRadius: 999 }}>Vector Breakdown</span>
        </div>
        <AttackTypesChart data={chartsData.attackTypes} />
      </div>

      {/* 5. Upload Trend */}
      <div style={{ ...cardStyle, gridColumn: "span 1" }}>
        <div style={titleStyle}>
          <span>⚡ Log Ingest Velocity (Upload Trend)</span>
          <span style={{ fontSize: "0.75rem", background: "rgba(54, 214, 174, 0.12)", color: "var(--state-verified)", border: "1px solid rgba(54, 214, 174, 0.3)", padding: "2px 8px", borderRadius: 999 }}>Logs / hr</span>
        </div>
        <UploadTrendChart data={chartsData.uploadTrend} />
      </div>
    </div>
  );
};

export default DashboardCharts;
