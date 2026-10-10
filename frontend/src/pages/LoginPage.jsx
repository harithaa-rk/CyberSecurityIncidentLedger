import React, { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { loginUser } from "../services/authService";
import { useAuth } from "../context/AuthContext";
import ThemeSelector from "../components/ThemeSelector";

/* ── SVG Icons ── */
const ShieldIcon = () => (
  <svg viewBox="0 0 88 88" fill="none" xmlns="http://www.w3.org/2000/svg" className="auth-brand-icon">
    <path d="M44 6L10 20v24c0 20.9 14.5 40.4 34 46 19.5-5.6 34-25.1 34-46V20L44 6z"
      fill="rgba(13,115,119,0.25)" stroke="#14a8ad" strokeWidth="2.5" strokeLinejoin="round"/>
    <path d="M44 18L18 29v17c0 14.7 10.2 28.4 26 32.3C59.8 74.4 70 60.7 70 46V29L44 18z"
      fill="rgba(13,115,119,0.15)" stroke="#14a8ad" strokeWidth="2" strokeLinejoin="round"/>
    <path d="M34 43l8 8 14-14" stroke="#14a8ad" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"/>
  </svg>
);

const EmailIcon = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <rect x="2" y="4" width="20" height="16" rx="2"/>
    <path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7"/>
  </svg>
);

const LockIcon = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <rect x="3" y="11" width="18" height="11" rx="2" ry="2"/>
    <path d="M7 11V7a5 5 0 0 1 10 0v4"/>
  </svg>
);

const EyeIcon = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M2 12s3-7 10-7 10 7 10 7-3 7-10 7-10-7-10-7z"/>
    <circle cx="12" cy="12" r="3"/>
  </svg>
);

const EyeOffIcon = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M9.88 9.88a3 3 0 1 0 4.24 4.24"/>
    <path d="M10.73 5.08A10.43 10.43 0 0 1 12 5c7 0 10 7 10 7a13.16 13.16 0 0 1-1.67 2.68"/>
    <path d="M6.61 6.61A13.526 13.526 0 0 0 2 12s3 7 10 7a9.74 9.74 0 0 0 5.39-1.61"/>
    <line x1="2" y1="2" x2="22" y2="22"/>
  </svg>
);

const AlertIcon = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="12" cy="12" r="10"/>
    <line x1="12" y1="8" x2="12" y2="12"/>
    <line x1="12" y1="16" x2="12.01" y2="16"/>
  </svg>
);

const LockClockIcon = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M12 22C6.5 22 2 17.5 2 12S6.5 2 12 2s10 4.5 10 10"/>
    <polyline points="12 6 12 12 16 14"/>
    <path d="M18 15l2 2 4-4"/>
  </svg>
);

/* ── Component ── */
const LoginPage = () => {
  const navigate = useNavigate();
  const { login } = useAuth();

  const [formData, setFormData] = useState({ email: "", password: "" });
  const [rememberMe,   setRememberMe]   = useState(true);
  const [showPassword, setShowPassword] = useState(false);
  const [loading,      setLoading]      = useState(false);
  const [error,        setError]        = useState("");
  const [isLocked,     setIsLocked]     = useState(false);
  const [lockUntil,    setLockUntil]    = useState(null);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
    if (error) setError("");
  };

  const validate = () => {
    if (!formData.email.trim()) return "Email address is required.";
    if (!/^\S+@\S+\.\S+$/.test(formData.email)) return "Please enter a valid email address.";
    if (!formData.password)     return "Password is required.";
    return null;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    const validationError = validate();
    if (validationError) { setError(validationError); return; }

    setLoading(true);
    setError("");
    setIsLocked(false);

    try {
      const data = await loginUser({
        email:    formData.email.trim().toLowerCase(),
        password: formData.password,
      });

      login({ token: data.token, user: data.user }, rememberMe);
      // Admin gets their own dashboard automatically
      if (data.user?.role === "Admin") {
        navigate("/admin-dashboard");
      } else {
        navigate("/dashboard");
      }
    } catch (err) {
      const msg      = err.response?.data?.message || "Login failed. Please try again.";
      const locked   = err.response?.data?.locked   || false;
      const lockTime = err.response?.data?.lockUntil || null;

      setError(msg);
      setIsLocked(locked);
      if (lockTime) setLockUntil(new Date(lockTime));
    } finally {
      setLoading(false);
    }
  };

  const formatLockTime = (date) => {
    if (!date) return "";
    const diff = Math.max(0, date - Date.now());
    const mins = Math.ceil(diff / 60000);
    return `${mins} minute${mins !== 1 ? "s" : ""}`;
  };

  return (
    <div className="auth-layout" style={{ position: "relative" }}>
      {/* ── Top Bar Theme Selector ── */}
      <div style={{
        position: "fixed",
        top: 16,
        right: 20,
        zIndex: 100,
        display: "flex",
        alignItems: "center",
        gap: 10,
      }}>
        <ThemeSelector />
      </div>

      {/* ── Brand Panel ── */}
      <div className="auth-brand">
        <div className="auth-brand-content">
          <div className="auth-brand-badge">Secure Platform</div>
          <img
            src="/logo.png"
            alt="CSIL Security Logo"
            className="auth-brand-icon"
            style={{
              width: 84,
              height: 84,
              objectFit: "contain",
              filter: "drop-shadow(0 6px 20px rgba(0,0,0,0.45))",
              borderRadius: 16,
              marginBottom: "1rem",
            }}
          />
          <h2 className="auth-brand-title">
            Owlyx<br />
            <span>Command Center</span>
          </h2>
          <div style={{ color: "var(--color-gold)", fontSize: "0.85rem", fontWeight: 800, letterSpacing: "0.1em", textTransform: "uppercase", marginBottom: 14, fontFamily: "var(--font-mono)" }}>
            Silent Watch. Unbreakable Proof.
          </div>
          <p className="auth-brand-subtitle">
            Futuristic cyber-intelligence and forensic ledger powered by Hyperledger Fabric,
            IPFS evidence storage, and SHA-256 cryptographic verification.
          </p>
          <div className="auth-brand-features">
            {[
              { icon: "🦉", text: "Autonomous threat detection & live OS telemetry" },
              { icon: "⛓",  text: "Hyperledger Fabric tamper-proof audit trail" },
              { icon: "📦",  text: "IPFS decentralized forensic evidence storage" },
              { icon: "🔐",  text: "SHA-256 real-time cryptographic integrity" },
            ].map((f) => (
              <div key={f.text} className="auth-brand-feature">
                <div className="auth-brand-feature-icon">{f.icon}</div>
                <span className="auth-brand-feature-text">{f.text}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* ── Form Panel ── */}
      <div className="auth-form-panel">
        <div className="auth-form-container">
          {/* Logo */}
          <div className="auth-form-logo">
            <div style={{
              width: 48,
              height: 48,
              borderRadius: "12px",
              background: "#080907",
              border: "1.5px solid rgba(244, 197, 66, 0.45)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              padding: 4,
              boxShadow: "0 0 16px rgba(244, 197, 66, 0.2)",
            }}>
              <img
                src="/logo.png"
                alt="Owlyx Logo"
                style={{ width: "100%", height: "100%", objectFit: "contain" }}
              />
            </div>
            <div className="auth-form-logo-text">
              OWLYX
              <small>Silent Watch. Unbreakable Proof.</small>
            </div>
          </div>

          {/* Header */}
          <div className="auth-form-header">
            <h1>Command Access</h1>
            <p>
              Authenticate to access sentinel telemetry & forensics.{" "}
              <Link to="/register" style={{ color: "var(--color-gold)", fontWeight: 600 }}>Create an account</Link>
            </p>
          </div>

          {/* Error Banner */}
          {error && (
            <div className={`alert ${isLocked ? "alert-warning" : "alert-error"}`} role="alert">
              <span className="alert-icon">
                {isLocked ? <LockClockIcon /> : <AlertIcon />}
              </span>
              <span>{error}</span>
            </div>
          )}

          {/* Form */}
          <form onSubmit={handleSubmit} noValidate>
            {/* Email */}
            <div className="form-group">
              <label className="form-label" htmlFor="login-email">
                Email Address <span className="required">*</span>
              </label>
              <div className="input-wrapper">
                <span className="input-icon"><EmailIcon /></span>
                <input
                  id="login-email"
                  type="email"
                  name="email"
                  className="form-input"
                  placeholder="analyst@organisation.com"
                  value={formData.email}
                  onChange={handleChange}
                  autoComplete="email"
                  autoFocus
                  disabled={loading}
                  aria-required="true"
                />
              </div>
            </div>

            {/* Password */}
            <div className="form-group">
              <label className="form-label" htmlFor="login-password">
                Password <span className="required">*</span>
              </label>
              <div className="input-wrapper">
                <span className="input-icon"><LockIcon /></span>
                <input
                  id="login-password"
                  type={showPassword ? "text" : "password"}
                  name="password"
                  className="form-input has-right-icon"
                  placeholder="Enter your password"
                  value={formData.password}
                  onChange={handleChange}
                  autoComplete="current-password"
                  disabled={loading}
                  aria-required="true"
                />
                <button
                  type="button"
                  className="input-icon-right"
                  onClick={() => setShowPassword((v) => !v)}
                  aria-label={showPassword ? "Hide password" : "Show password"}
                  tabIndex={-1}
                >
                  {showPassword ? <EyeOffIcon /> : <EyeIcon />}
                </button>
              </div>
            </div>

            {/* Remember Me + Forgot */}
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "var(--space-2)" }}>
              <div className="form-checkbox-group">
                <input
                  id="remember-me"
                  type="checkbox"
                  className="form-checkbox"
                  checked={rememberMe}
                  onChange={(e) => setRememberMe(e.target.checked)}
                  disabled={loading}
                />
                <label htmlFor="remember-me" className="form-checkbox-label">
                  Remember me
                </label>
              </div>
              <a href="#" className="form-link">Forgot password?</a>
            </div>

            {/* Submit */}
            <button
              id="login-submit"
              type="submit"
              className="btn-primary"
              disabled={loading || isLocked}
            >
              {loading ? (
                <>
                  <span className="spinner" />
                  Authenticating…
                </>
              ) : (
                <>
                  🔐 Sign In Securely
                </>
              )}
            </button>
          </form>

          {/* Security Info */}
          <div className="security-info" style={{ marginTop: "var(--space-6)" }}>
            <div className="security-info-title">🛡 Security Notice</div>
            <p className="security-info-text">
              Your session is protected by JWT authentication. Accounts are
              automatically locked after 5 failed login attempts for 15 minutes.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default LoginPage;
