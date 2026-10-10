import React, { useState, useEffect, useCallback } from "react";
import {
  generateReport,
  getReportsForIncident,
  downloadReportPdf,
  verifyReportIntegrity,
} from "../../services/reportService";

// ─────────────────────────────────────────────────────────────────────────────
// Inline SVG Icons
// ─────────────────────────────────────────────────────────────────────────────
const FileTextIcon = ({ size = 16 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/><polyline points="10 9 9 9 8 9"/>
  </svg>
);

const DownloadIcon = ({ size = 14 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/>
  </svg>
);

const ShieldCheckIcon = ({ size = 14 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/><polyline points="9 12 11 14 15 10"/>
  </svg>
);

const RefreshIcon = ({ size = 14 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="23 4 23 10 17 10"/><polyline points="1 20 1 14 7 14"/>
    <path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"/>
  </svg>
);

const AlertTriangleIcon = ({ size = 14 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/>
  </svg>
);

const CheckCircleIcon = ({ size = 14 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/>
  </svg>
);

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────
const fmt = (d) => {
  if (!d) return "—";
  return new Date(d).toLocaleString("en-US", {
    year: "numeric", month: "short", day: "numeric",
    hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: false,
  });
};

const statusStyle = (status) => {
  switch ((status || "").toUpperCase()) {
    case "GENERATED": return { bg: "#ecfdf5", color: "#059669", border: "#a7f3d0", label: "Generated" };
    case "VERIFIED":  return { bg: "#eff6ff", color: "#2563eb", border: "#bfdbfe", label: "Verified" };
    case "GENERATING":return { bg: "#fffbeb", color: "#d97706", border: "#fde68a", label: "Generating…" };
    case "REVOKED":   return { bg: "#fef2f2", color: "#dc2626", border: "#fca5a5", label: "Revoked" };
    default:          return { bg: "#f1f5f9", color: "#64748b", border: "#cbd5e1", label: status || "Unknown" };
  }
};

function triggerDownload(blob, filename) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

// ─────────────────────────────────────────────────────────────────────────────
// Sub-component: ReportCard
// ─────────────────────────────────────────────────────────────────────────────
const ReportCard = ({ report, userRole }) => {
  const [downloading, setDownloading] = useState(false);
  const [verifying, setVerifying]     = useState(false);
  const [integrityResult, setIntegrityResult] = useState(null);
  const [integrityError, setIntegrityError]   = useState(null);

  const isAuditorOrAdmin = userRole === "Admin" || userRole === "Auditor";
  const canDownload      = report.status === "GENERATED" || report.status === "VERIFIED";
  const ss               = statusStyle(report.status);

  const handleDownload = async () => {
    setDownloading(true);
    try {
      const { blob, filename } = await downloadReportPdf(report._id);
      triggerDownload(blob, filename);
    } catch (err) {
      alert(`Download failed: ${err?.response?.data?.message || err.message}`);
    } finally {
      setDownloading(false);
    }
  };

  const handleVerify = async () => {
    setVerifying(true);
    setIntegrityResult(null);
    setIntegrityError(null);
    try {
      const result = await verifyReportIntegrity(report._id);
      setIntegrityResult(result);
    } catch (err) {
      setIntegrityError(err?.response?.data?.message || err.message);
    } finally {
      setVerifying(false);
    }
  };

  return (
    <div style={{
      background: "#f8fafc", border: "1px solid #e2e8f0", borderRadius: 12,
      padding: "1.25rem", marginBottom: "1rem",
    }}>
      {/* ── Header ── */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: 8 }}>
        <div>
          <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
            <span style={{ fontFamily: "monospace", fontWeight: 800, fontSize: "0.95rem", color: "#0f2744" }}>
              {report.reportNumber}
            </span>
            <span style={{
              display: "inline-flex", alignItems: "center", gap: 4,
              padding: "2px 9px", borderRadius: 999, fontSize: "0.72rem",
              fontWeight: 800, background: ss.bg, color: ss.color, border: `1px solid ${ss.border}`,
            }}>
              {ss.label}
            </span>
          </div>
          <div style={{ fontSize: "0.78rem", color: "#64748b", marginTop: 3 }}>
            Generated by <strong>{report.generatedByName || "System"}</strong> · {fmt(report.generatedAt)}
          </div>
        </div>

        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          {canDownload && (
            <button onClick={handleDownload} disabled={downloading} style={{
              display: "flex", alignItems: "center", gap: 6,
              padding: "6px 14px", borderRadius: 8, border: "none",
              background: "#0d7377", color: "#fff", fontSize: "0.8rem",
              fontWeight: 700, cursor: downloading ? "not-allowed" : "pointer",
              opacity: downloading ? 0.7 : 1, fontFamily: "inherit",
            }}>
              <DownloadIcon /> {downloading ? "Downloading…" : "Download PDF"}
            </button>
          )}
          {isAuditorOrAdmin && canDownload && (
            <button onClick={handleVerify} disabled={verifying} style={{
              display: "flex", alignItems: "center", gap: 6,
              padding: "6px 14px", borderRadius: 8, border: "1px solid #cbd5e1",
              background: "#fff", color: "#475569", fontSize: "0.8rem",
              fontWeight: 700, cursor: verifying ? "not-allowed" : "pointer",
              opacity: verifying ? 0.7 : 1, fontFamily: "inherit",
            }}>
              <ShieldCheckIcon /> {verifying ? "Verifying…" : "Verify Integrity"}
            </button>
          )}
        </div>
      </div>

      {/* ── Details grid ── */}
      <div style={{
        display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
        gap: "8px 20px", marginTop: "0.9rem", paddingTop: "0.9rem",
        borderTop: "1px solid #e2e8f0",
      }}>
        {[
          ["Report ID",       report.reportId],
          ["Seal ID",         report.digitalSealId || "—"],
          ["QR Verify ID",    report.qrVerificationId || "—"],
          ["Evidence Items",  String(report.evidenceCount ?? 0)],
        ].map(([label, value]) => (
          <div key={label}>
            <div style={{ fontSize: "0.68rem", color: "#94a3b8", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.04em" }}>
              {label}
            </div>
            <div style={{ fontSize: "0.8rem", color: "#0f2744", fontWeight: 700, fontFamily: "monospace", marginTop: 2, wordBreak: "break-all" }}>
              {value}
            </div>
          </div>
        ))}
      </div>

      {/* ── Verification Result ── */}
      {integrityResult && (
        <div style={{
          marginTop: "0.9rem", padding: "0.75rem 1rem", borderRadius: 8,
          background: integrityResult.intact ? "#ecfdf5" : "#fef2f2",
          border: `1px solid ${integrityResult.intact ? "#a7f3d0" : "#fca5a5"}`,
        }}>
          <div style={{
            display: "flex", alignItems: "center", gap: 6,
            fontWeight: 800, fontSize: "0.85rem",
            color: integrityResult.intact ? "#059669" : "#dc2626",
          }}>
            {integrityResult.intact ? <CheckCircleIcon size={16} /> : <AlertTriangleIcon size={16} />}
            {integrityResult.intact
              ? "✅ Report integrity verified — PDF has not been tampered with."
              : "🚨 TAMPER DETECTED — PDF hash does not match stored reference."}
          </div>
          {!integrityResult.intact && (
            <div style={{ fontSize: "0.72rem", marginTop: 6, color: "#7f1d1d", fontFamily: "monospace" }}>
              <div>Stored hash:  {integrityResult.storedHash}</div>
              <div>Current hash: {integrityResult.currentHash}</div>
            </div>
          )}
          <div style={{ fontSize: "0.7rem", color: "#6b7280", marginTop: 4 }}>
            Verified at: {fmt(integrityResult.verifiedAt)}
          </div>
        </div>
      )}

      {integrityError && (
        <div style={{
          marginTop: "0.9rem", padding: "0.75rem 1rem", borderRadius: 8,
          background: "#fef2f2", border: "1px solid #fca5a5",
          fontSize: "0.82rem", color: "#dc2626", fontWeight: 600,
        }}>
          <AlertTriangleIcon size={13} /> Verification error: {integrityError}
        </div>
      )}
    </div>
  );
};

// ─────────────────────────────────────────────────────────────────────────────
// Main ReportPanel Component
// ─────────────────────────────────────────────────────────────────────────────
export default function ReportPanel({ incident, userRole = "Analyst" }) {
  const [reports, setReports]           = useState([]);
  const [loading, setLoading]           = useState(true);
  const [generating, setGenerating]     = useState(false);
  const [generateError, setGenerateError] = useState(null);
  const [generateSuccess, setGenerateSuccess] = useState(null);

  const canGenerate = userRole === "Admin" || userRole === "Analyst";

  const loadReports = useCallback(async () => {
    if (!incident?._id && !incident?.incidentId) return;
    setLoading(true);
    try {
      const id = incident._id || incident.incidentId;
      const data = await getReportsForIncident(id);
      setReports(data.reports || []);
    } catch {
      setReports([]);
    } finally {
      setLoading(false);
    }
  }, [incident]);

  useEffect(() => {
    loadReports();
  }, [loadReports]);

  const handleGenerate = async (forceRegenerate = false) => {
    setGenerating(true);
    setGenerateError(null);
    setGenerateSuccess(null);
    try {
      const id = incident._id || incident.incidentId;
      const result = await generateReport(id, forceRegenerate);
      setGenerateSuccess(`Report ${result.reportNumber} generated successfully.`);
      await loadReports();
    } catch (err) {
      setGenerateError(err?.response?.data?.message || err.message || "Failed to generate report.");
    } finally {
      setGenerating(false);
    }
  };

  const hasExisting = reports.length > 0;

  return (
    <div>
      <style>{`
        @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
      `}</style>

      {/* ── Header actions ── */}
      <div style={{
        display: "flex", justifyContent: "space-between", alignItems: "center",
        marginBottom: "1rem", flexWrap: "wrap", gap: 8,
      }}>
        <div>
          <h3 style={{ margin: 0, fontSize: "1rem", fontWeight: 800, color: "#0f2744" }}>
            📄 Incident Reports
          </h3>
          <p style={{ margin: "2px 0 0 0", fontSize: "0.8rem", color: "#64748b" }}>
            Automated, tamper-evident reports with digital seal and QR verification.
          </p>
        </div>

        {canGenerate && (
          <div style={{ display: "flex", gap: 8 }}>
            {hasExisting && (
              <button
                onClick={() => handleGenerate(true)}
                disabled={generating}
                style={{
                  display: "flex", alignItems: "center", gap: 6,
                  padding: "7px 14px", borderRadius: 8, border: "1px solid #cbd5e1",
                  background: "#fff", color: "#475569", fontSize: "0.82rem",
                  fontWeight: 700, cursor: generating ? "not-allowed" : "pointer",
                  opacity: generating ? 0.7 : 1, fontFamily: "inherit",
                }}
              >
                <RefreshIcon /> Regenerate
              </button>
            )}
            <button
              onClick={() => handleGenerate(false)}
              disabled={generating}
              style={{
                display: "flex", alignItems: "center", gap: 6,
                padding: "7px 16px", borderRadius: 8, border: "none",
                background: generating ? "#94a3b8" : "#0d7377",
                color: "#fff", fontSize: "0.82rem", fontWeight: 700,
                cursor: generating ? "not-allowed" : "pointer", fontFamily: "inherit",
              }}
            >
              {generating ? (
                <>
                  <span style={{
                    display: "inline-block", width: 12, height: 12,
                    border: "2px solid rgba(255,255,255,0.4)", borderTopColor: "#fff",
                    borderRadius: "50%", animation: "spin 0.7s linear infinite",
                  }} />
                  Generating…
                </>
              ) : (
                <><FileTextIcon size={14} /> Generate Report</>
              )}
            </button>
          </div>
        )}
      </div>

      {/* ── Success / Error banners ── */}
      {generateSuccess && (
        <div style={{
          marginBottom: "1rem", padding: "0.65rem 1rem", borderRadius: 8,
          background: "#ecfdf5", border: "1px solid #a7f3d0",
          color: "#059669", fontSize: "0.85rem", fontWeight: 600,
          display: "flex", alignItems: "center", gap: 6,
        }}>
          <CheckCircleIcon size={15} /> {generateSuccess}
        </div>
      )}
      {generateError && (
        <div style={{
          marginBottom: "1rem", padding: "0.65rem 1rem", borderRadius: 8,
          background: "#fef2f2", border: "1px solid #fca5a5",
          color: "#dc2626", fontSize: "0.85rem", fontWeight: 600,
          display: "flex", alignItems: "center", gap: 6,
        }}>
          <AlertTriangleIcon size={15} /> {generateError}
        </div>
      )}

      {/* ── Content ── */}
      {loading ? (
        <div style={{ textAlign: "center", padding: "2.5rem", color: "#94a3b8" }}>
          <div style={{
            display: "inline-block", width: 32, height: 32,
            border: "3px solid #e2e8f0", borderTopColor: "#0d7377",
            borderRadius: "50%", animation: "spin 0.7s linear infinite",
          }} />
          <div style={{ marginTop: 10, fontSize: "0.85rem" }}>Loading reports…</div>
        </div>
      ) : reports.length === 0 ? (
        <div style={{
          textAlign: "center", padding: "2.5rem 1rem",
          background: "#f8fafc", borderRadius: 12, border: "1px dashed #cbd5e1",
        }}>
          <div style={{ fontSize: "2.5rem", marginBottom: 8 }}>📄</div>
          <div style={{ fontWeight: 700, color: "#0f2744", fontSize: "0.95rem" }}>
            No reports generated yet
          </div>
          <div style={{ color: "#64748b", fontSize: "0.82rem", marginTop: 4 }}>
            {canGenerate
              ? 'Click "Generate Report" to create an automated, blockchain-anchored incident report.'
              : "Reports will appear here once generated by an Admin or Analyst."}
          </div>
        </div>
      ) : (
        reports.map((report) => (
          <ReportCard key={report._id} report={report} userRole={userRole} />
        ))
      )}

      {/* ── Disclaimer ── */}
      <div style={{
        marginTop: "1rem", padding: "0.6rem 0.9rem", borderRadius: 6,
        background: "#f1f5f9", border: "1px solid #e2e8f0", fontSize: "0.72rem", color: "#64748b",
      }}>
        ⚠️ <strong>Application Document:</strong> This report is an automated record generated by Cybersecurity Incident Ledger.
        It is NOT a government-certified or legally-binding document.
        The digital seal and QR code verify only that this report was generated by this application and has not been modified.
      </div>
    </div>
  );
}
