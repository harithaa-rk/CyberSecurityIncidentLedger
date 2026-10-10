import React, { useState, useEffect } from "react";
import { useParams, Link, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import DashboardLayout from "../layouts/DashboardLayout";
import ThemeSelector from "../components/ThemeSelector";
import { publicVerifyReport } from "../services/reportService";

// ─────────────────────────────────────────────────────────────────────────────
// VerifyReport – Public Report Verification Page
//
// Accessible at /verify/:reportNumber — no authentication required.
// Activated when a user scans the QR code on a generated incident report.
// ─────────────────────────────────────────────────────────────────────────────

const ShieldIcon = ({ size = 32 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
    <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>
  </svg>
);

const CheckIcon = ({ size = 20 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="20 6 9 17 4 12"/>
  </svg>
);

const AlertIcon = ({ size = 20 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
    <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/>
  </svg>
);

const InfoRow = ({ label, value, mono = false }) => (
  <div style={{
    display: "flex", justifyContent: "space-between", alignItems: "flex-start",
    padding: "10px 0", borderBottom: "1px solid var(--border-subtle)", gap: 12,
  }}>
    <span style={{ color: "var(--text-secondary)", fontSize: "0.82rem", fontWeight: 600, minWidth: 150 }}>
      {label}
    </span>
    <span style={{
      color: "var(--text-primary)", fontSize: "0.85rem", fontWeight: 700,
      fontFamily: mono ? "var(--font-mono, monospace)" : "inherit",
      wordBreak: "break-all", textAlign: "right",
    }}>
      {value || "—"}
    </span>
  </div>
);

const fmt = (d) => {
  if (!d) return "Not Available";
  return new Date(d).toLocaleString("en-US", {
    year: "numeric", month: "long", day: "numeric",
    hour: "2-digit", minute: "2-digit", second: "2-digit",
    hour12: false, timeZoneName: "short",
  });
};

export default function VerifyReport() {
  const { reportNumber } = useParams();
  const [result, setResult]   = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError]     = useState(null);

  useEffect(() => {
    if (!reportNumber) {
      setError("No report number provided.");
      setLoading(false);
      return;
    }
    (async () => {
      try {
        const data = await publicVerifyReport(reportNumber);
        setResult(data);
      } catch (err) {
        setError(err?.response?.data?.message || err.message || "Report not found.");
      } finally {
        setLoading(false);
      }
    })();
  }, [reportNumber]);

  const { isAuthenticated, user } = useAuth();
  const navigate = useNavigate();

  const renderVerificationContent = () => (
    <>
      <style>{`
        @keyframes fadeUp { from { opacity: 0; transform: translateY(20px); } to { opacity: 1; transform: translateY(0); } }
        @keyframes spin  { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
        .verify-card { animation: fadeUp 0.4s ease-out; }
      `}</style>

      {/* ── Loading state ── */}
      {loading && (
        <div style={{ textAlign: "center", color: "var(--text-secondary)", marginTop: "4rem" }}>
          <div style={{
            width: 44, height: 44, borderRadius: "50%",
            border: "3px solid var(--border-subtle)", borderTopColor: "var(--color-gold)",
            animation: "spin 0.8s linear infinite", margin: "0 auto 1rem",
          }} />
          <div style={{ fontSize: "0.95rem", fontWeight: 700 }}>Verifying report authenticity…</div>
          <div style={{ fontSize: "0.78rem", marginTop: 4, fontFamily: "var(--font-mono)" }}>Report: {reportNumber}</div>
        </div>
      )}

      {/* ── Error state ── */}
      {!loading && error && (
        <div className="verify-card" style={{
          background: "var(--bg-surface)", border: "1.5px solid var(--state-critical)",
          borderRadius: 16, padding: "2rem", maxWidth: 560, width: "100%",
          textAlign: "center", boxShadow: "var(--shadow-card)", margin: "0 auto",
        }}>
          <div style={{ color: "var(--state-critical)", marginBottom: "1rem" }}>
            <AlertIcon size={44} />
          </div>
          <h2 style={{ color: "var(--state-critical)", margin: "0 0 0.5rem 0", fontSize: "1.2rem", fontFamily: "var(--font-heading)" }}>
            Verification Failed
          </h2>
          <p style={{ color: "var(--text-secondary)", fontSize: "0.9rem", margin: "0 0 1rem 0" }}>
            {error}
          </p>
          <div style={{ fontSize: "0.75rem", color: "var(--text-muted)", fontFamily: "var(--font-mono)" }}>
            Query: {reportNumber}
          </div>
        </div>
      )}

      {/* ── Success state ── */}
      {!loading && result && (
        <div className="verify-card" style={{ maxWidth: 680, width: "100%", margin: "0 auto" }}>
          {/* ── Integrity Badge ── */}
          <div style={{
            background: result.intact === true
              ? "var(--state-verified-bg, rgba(54, 214, 174, 0.12))"
              : result.intact === false
              ? "rgba(255, 77, 79, 0.12)"
              : "var(--bg-surface)",
            border: `2px solid ${result.intact === true ? "var(--state-verified, #36D6AE)" : result.intact === false ? "var(--state-critical, #FF4D4F)" : "var(--border-subtle)"}`,
            borderRadius: 20, padding: "2rem", marginBottom: "1.5rem",
            textAlign: "center", boxShadow: "var(--shadow-card)",
          }}>
            {result.intact === true && (
              <>
                <div style={{
                  display: "inline-flex", alignItems: "center", justifyContent: "center",
                  width: 64, height: 64, borderRadius: "50%",
                  background: "rgba(54, 214, 174, 0.2)", color: "var(--state-verified, #36D6AE)", marginBottom: "1rem",
                }}>
                  <CheckIcon size={34} />
                </div>
                <h1 style={{ color: "var(--state-verified, #36D6AE)", margin: "0 0 0.5rem 0", fontSize: "1.4rem", fontWeight: 900, fontFamily: "var(--font-heading)" }}>
                  ✅ Report Verified
                </h1>
                <p style={{ color: "var(--text-primary)", fontSize: "0.9rem", margin: 0 }}>
                  This report is authentic. The cryptographic seal matches the ledger record.
                </p>
              </>
            )}
            {result.intact === false && (
              <>
                <div style={{
                  display: "inline-flex", alignItems: "center", justifyContent: "center",
                  width: 64, height: 64, borderRadius: "50%",
                  background: "rgba(255, 77, 79, 0.2)", color: "var(--state-critical)", marginBottom: "1rem",
                }}>
                  <AlertIcon size={34} />
                </div>
                <h1 style={{ color: "var(--state-critical)", margin: "0 0 0.5rem 0", fontSize: "1.4rem", fontWeight: 900, fontFamily: "var(--font-heading)" }}>
                  🚨 Tamper Detected
                </h1>
                <p style={{ color: "var(--text-primary)", fontSize: "0.9rem", margin: 0 }}>
                  The PDF file hash does not match the reference hash stored at generation time.
                  This report may have been modified.
                </p>
              </>
            )}
            {result.intact === null && (
              <>
                <div style={{
                  display: "inline-flex", alignItems: "center", justifyContent: "center",
                  width: 64, height: 64, borderRadius: "50%",
                  background: "var(--color-gold-soft)", color: "var(--color-gold)", marginBottom: "1rem",
                }}>
                  <ShieldIcon size={34} />
                </div>
                <h1 style={{ color: "var(--text-primary)", margin: "0 0 0.5rem 0", fontSize: "1.4rem", fontWeight: 900, fontFamily: "var(--font-heading)" }}>
                  Report Found
                </h1>
                <p style={{ color: "var(--text-secondary)", fontSize: "0.9rem", margin: 0 }}>
                  Report metadata was found, but the PDF file was not available for integrity check.
                </p>
              </>
            )}
          </div>

          {/* ── Report Details Card ── */}
          <div style={{
            background: "var(--bg-surface)", border: "1px solid var(--border-subtle)",
            borderRadius: 16, padding: "1.5rem", marginBottom: "1rem",
            boxShadow: "var(--shadow-card)",
          }}>
            <h3 style={{ color: "var(--color-gold)", margin: "0 0 1rem 0", fontSize: "0.85rem", fontWeight: 800, letterSpacing: "0.08em", textTransform: "uppercase", fontFamily: "var(--font-heading)" }}>
              📋 Report Metadata
            </h3>
            <InfoRow label="Report Number"       value={result.reportNumber}       mono />
            <InfoRow label="Report ID"           value={result.reportId}           mono />
            <InfoRow label="Incident Identifier" value={result.incidentIdentifier} mono />
            <InfoRow label="Incident Title"      value={result.incidentTitle} />
            <InfoRow label="Severity"            value={result.severity} />
            <InfoRow label="Organization"        value={result.organizationName} />
            <InfoRow label="Generated By"        value={result.generatedByName} />
            <InfoRow label="Generated At"        value={fmt(result.generatedAt)} />
            <InfoRow label="Report Status"       value={result.status} />
          </div>

          {/* ── Authenticity IDs ── */}
          <div style={{
            background: "var(--bg-surface)", border: "1px solid var(--border-subtle)",
            borderRadius: 16, padding: "1.5rem", marginBottom: "1rem",
            boxShadow: "var(--shadow-card)",
          }}>
            <h3 style={{ color: "var(--color-gold)", margin: "0 0 1rem 0", fontSize: "0.85rem", fontWeight: 800, letterSpacing: "0.08em", textTransform: "uppercase", fontFamily: "var(--font-heading)" }}>
              🔏 Authenticity Identifiers
            </h3>
            <InfoRow label="Digital Seal ID"   value={result.digitalSealId}     mono />
            <InfoRow label="QR Verification ID" value={result.qrVerificationId} mono />
            <InfoRow label="Verified At"        value={fmt(result.verifiedAt)} />

            {(result.currentHash || result.storedHash) && (
              <>
                <div style={{ marginTop: "0.75rem", borderTop: "1px solid var(--border-subtle)", paddingTop: "0.75rem" }}>
                  <div style={{ color: "var(--text-muted)", fontSize: "0.72rem", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 6 }}>
                    SHA-256 Hash Comparison
                  </div>
                  <div style={{ fontSize: "0.7rem", color: "var(--text-secondary)", marginBottom: 4 }}>
                    <span style={{ color: "var(--text-muted)" }}>Reference (stored):</span><br />
                    <span style={{ fontFamily: "monospace", wordBreak: "break-all" }}>{result.storedHash || "—"}</span>
                  </div>
                  <div style={{ fontSize: "0.7rem", color: "var(--text-secondary)" }}>
                    <span style={{ color: "var(--text-muted)" }}>Current (computed):</span><br />
                    <span style={{
                      fontFamily: "monospace", wordBreak: "break-all",
                      color: result.intact ? "var(--state-verified, #22c55e)" : result.intact === false ? "var(--state-critical, #ef4444)" : "var(--text-secondary)",
                    }}>{result.currentHash || "—"}</span>
                  </div>
                </div>
              </>
            )}
          </div>

          {/* ── Disclaimer ── */}
          <div style={{
            background: "var(--bg-secondary)", border: "1px solid var(--border-subtle)",
            borderRadius: 10, padding: "1rem 1.25rem", fontSize: "0.72rem", color: "var(--text-secondary)", lineHeight: 1.6,
          }}>
            <strong style={{ color: "var(--color-gold)" }}>⚠️ Application Document Notice:</strong> This report is an
            automated record generated by the <em>Cybersecurity Incident Ledger</em> application.
            It is <strong>NOT</strong> a government-certified, court-admissible, or legally binding document.
            The digital seal and QR verification confirm only that this report was produced by this
            application and that the file content matches the hash recorded at generation time.
          </div>
        </div>
      )}
    </>
  );

  if (isAuthenticated) {
    return (
      <DashboardLayout
        activeSection="verify"
        title={`Verification: ${reportNumber || "Report"}`}
        backTo={user?.role === "Analyst" ? "/analyst/incidents" : "/admin-dashboard"}
        backLabel="Dashboard"
      >
        <div style={{ maxWidth: 760, margin: "0 auto", padding: "0.5rem 0" }}>
          {renderVerificationContent()}
        </div>
      </DashboardLayout>
    );
  }

  return (
    <div style={{
      minHeight: "100vh",
      background: "var(--bg-primary)",
      color: "var(--text-primary)",
      display: "flex", flexDirection: "column", alignItems: "center",
      justifyContent: "flex-start", padding: "2rem 1rem",
      fontFamily: "var(--font-sans, system-ui, sans-serif)",
    }}>
      {/* ── Public Top Bar ── */}
      <div style={{
        width: "100%", maxWidth: 680, display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "2rem",
      }}>
        <button
          onClick={() => navigate(-1)}
          style={{
            display: "inline-flex", alignItems: "center", gap: 6,
            background: "var(--bg-surface)", border: "1px solid var(--border-subtle)",
            borderRadius: 8, padding: "7px 14px", color: "var(--text-primary)",
            fontSize: "0.8125rem", fontWeight: 700, cursor: "pointer",
            fontFamily: "var(--font-heading)",
          }}
        >
          ← Back
        </button>

        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <ThemeSelector />
          <Link
            to="/login"
            style={{
              background: "var(--color-gold)", color: "var(--text-inverse)",
              padding: "7px 14px", borderRadius: 8, fontSize: "0.8125rem", fontWeight: 700,
              fontFamily: "var(--font-heading)", textDecoration: "none",
            }}
          >
            Portal Login
          </Link>
        </div>
      </div>

      {renderVerificationContent()}
    </div>
  );
}
