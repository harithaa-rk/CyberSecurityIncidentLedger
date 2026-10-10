import React, { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { registerUser } from "../services/authService";
import { useAuth } from "../context/AuthContext";
import PasswordStrength from "../components/PasswordStrength";
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

const UserIcon = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/>
    <circle cx="12" cy="7" r="4"/>
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

const BadgeIcon = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/>
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

const CheckCircleIcon = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/>
    <polyline points="22 4 12 14.01 9 11.01"/>
  </svg>
);

/* ── Roles (Admin is not available for self-registration) ── */
const ROLES = [
  { value: "User",    label: "User",    desc: "Standard access — view incidents" },
  { value: "Analyst", label: "Analyst", desc: "Manage and respond to incidents" },
  { value: "Auditor", label: "Auditor", desc: "Read-only audit access" },
];

/* ── Component ── */
const RegisterPage = () => {
  const navigate = useNavigate();
  const { login } = useAuth();

  const [formData, setFormData] = useState({
    name:            "",
    email:           "",
    password:        "",
    confirmPassword: "",
    role:            "User",
  });

  const [showPassword,        setShowPassword]        = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [agreeTerms,          setAgreeTerms]          = useState(false);
  const [loading,             setLoading]             = useState(false);
  const [error,               setError]               = useState("");
  const [success,             setSuccess]             = useState("");
  const [fieldErrors,         setFieldErrors]         = useState({});

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
    // Clear field error on edit
    if (fieldErrors[name]) {
      setFieldErrors((prev) => ({ ...prev, [name]: "" }));
    }
    if (error) setError("");
  };

  const validate = () => {
    const errors = {};
    if (!formData.name.trim())
      errors.name = "Full name is required.";
    else if (formData.name.trim().length < 2)
      errors.name = "Name must be at least 2 characters.";

    if (!formData.email.trim())
      errors.email = "Email address is required.";
    else if (!/^\S+@\S+\.\S+$/.test(formData.email))
      errors.email = "Please enter a valid email address.";

    if (!formData.password)
      errors.password = "Password is required.";
    else if (formData.password.length < 8)
      errors.password = "Password must be at least 8 characters.";

    if (!formData.confirmPassword)
      errors.confirmPassword = "Please confirm your password.";
    else if (formData.password !== formData.confirmPassword)
      errors.confirmPassword = "Passwords do not match.";

    if (!agreeTerms)
      errors.terms = "You must agree to the terms to continue.";

    return errors;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    const errors = validate();
    if (Object.keys(errors).length > 0) {
      setFieldErrors(errors);
      if (errors.terms) setError(errors.terms);
      return;
    }

    setLoading(true);
    setError("");
    setSuccess("");

    try {
      const data = await registerUser({
        name:            formData.name.trim(),
        email:           formData.email.trim().toLowerCase(),
        password:        formData.password,
        confirmPassword: formData.confirmPassword,
        role:            formData.role,
      });

      setSuccess("Account created successfully! Redirecting…");
      login({ token: data.token, user: data.user }, true);

      setTimeout(() => navigate("/dashboard"), 1500);
    } catch (err) {
      setError(err.response?.data?.message || "Registration failed. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="auth-layout" style={{ position: "relative" }}>
      {/* ── Top Bar (Back & Theme) ── */}
      <div style={{
        position: "fixed",
        top: 16,
        left: 20,
        right: 20,
        zIndex: 100,
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        pointerEvents: "none",
      }}>
        <button
          onClick={() => navigate(-1)}
          style={{
            pointerEvents: "auto",
            display: "inline-flex",
            alignItems: "center",
            gap: 6,
            padding: "6px 14px",
            borderRadius: 8,
            fontSize: "0.8125rem",
            fontWeight: 700,
            fontFamily: "var(--font-heading)",
            background: "var(--bg-surface)",
            color: "var(--text-primary)",
            border: "1px solid var(--border-subtle)",
            boxShadow: "var(--shadow-card)",
            cursor: "pointer",
            transition: "all 0.15s ease",
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.borderColor = "var(--color-gold)";
            e.currentTarget.style.color = "var(--color-gold)";
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.borderColor = "var(--border-subtle)";
            e.currentTarget.style.color = "var(--text-primary)";
          }}
        >
          <span style={{ fontSize: "1rem" }}>←</span> Back
        </button>

        <div style={{ pointerEvents: "auto" }}>
          <ThemeSelector />
        </div>
      </div>

      {/* ── Brand Panel ── */}
      <div className="auth-brand">
        <div className="auth-brand-content">
          <div className="auth-brand-badge">New Account</div>
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
            <span>Identity Provisioning</span>
          </h2>
          <div style={{ color: "var(--color-gold)", fontSize: "0.85rem", fontWeight: 800, letterSpacing: "0.1em", textTransform: "uppercase", marginBottom: 14, fontFamily: "var(--font-mono)" }}>
            Silent Watch. Unbreakable Proof.
          </div>
          <p className="auth-brand-subtitle">
            Create analyst or administrative credentials to operate within Owlyx's
            futuristic cybersecurity incident and forensic verification network.
          </p>
          <div className="auth-brand-features">
            {[
              { icon: "🛡", text: "Role-based access: Admin, Analyst, Auditor" },
              { icon: "🔒", text: "Bcrypt salted cryptographic key derivation" },
              { icon: "🔑", text: "Cryptographically verified session tokens" },
              { icon: "⚡", text: "Direct telemetry & incident workflow authority" },
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
            <h1>Register Personnel</h1>
            <p>
              Already credentialed?{" "}
              <Link to="/login" style={{ color: "var(--color-gold)", fontWeight: 600 }}>Sign in to Command</Link>
            </p>
          </div>

          {/* Alerts */}
          {error && (
            <div className="alert alert-error" role="alert">
              <span className="alert-icon"><AlertIcon /></span>
              <span>{error}</span>
            </div>
          )}
          {success && (
            <div className="alert alert-success" role="status">
              <span className="alert-icon"><CheckCircleIcon /></span>
              <span>{success}</span>
            </div>
          )}

          {/* Form */}
          <form onSubmit={handleSubmit} noValidate>
            {/* Full Name */}
            <div className="form-group">
              <label className="form-label" htmlFor="reg-name">
                Full Name <span className="required">*</span>
              </label>
              <div className="input-wrapper">
                <span className="input-icon"><UserIcon /></span>
                <input
                  id="reg-name"
                  type="text"
                  name="name"
                  className={`form-input${fieldErrors.name ? " input-error" : ""}`}
                  placeholder="John Doe"
                  value={formData.name}
                  onChange={handleChange}
                  autoComplete="name"
                  autoFocus
                  disabled={loading}
                  aria-required="true"
                  aria-describedby={fieldErrors.name ? "name-error" : undefined}
                />
              </div>
              {fieldErrors.name && (
                <p id="name-error" className="field-error">⚠ {fieldErrors.name}</p>
              )}
            </div>

            {/* Email */}
            <div className="form-group">
              <label className="form-label" htmlFor="reg-email">
                Email Address <span className="required">*</span>
              </label>
              <div className="input-wrapper">
                <span className="input-icon"><EmailIcon /></span>
                <input
                  id="reg-email"
                  type="email"
                  name="email"
                  className={`form-input${fieldErrors.email ? " input-error" : ""}`}
                  placeholder="analyst@organisation.com"
                  value={formData.email}
                  onChange={handleChange}
                  autoComplete="email"
                  disabled={loading}
                  aria-required="true"
                  aria-describedby={fieldErrors.email ? "email-error" : undefined}
                />
              </div>
              {fieldErrors.email && (
                <p id="email-error" className="field-error">⚠ {fieldErrors.email}</p>
              )}
            </div>

            {/* Role */}
            <div className="form-group">
              <label className="form-label" htmlFor="reg-role">
                Account Role <span className="required">*</span>
              </label>
              <div className="input-wrapper">
                <span className="input-icon"><BadgeIcon /></span>
                <select
                  id="reg-role"
                  name="role"
                  className="form-select"
                  value={formData.role}
                  onChange={handleChange}
                  disabled={loading}
                  aria-required="true"
                >
                  {ROLES.map((r) => (
                    <option key={r.value} value={r.value}>
                      {r.label} — {r.desc}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {/* Password */}
            <div className="form-group">
              <label className="form-label" htmlFor="reg-password">
                Password <span className="required">*</span>
              </label>
              <div className="input-wrapper">
                <span className="input-icon"><LockIcon /></span>
                <input
                  id="reg-password"
                  type={showPassword ? "text" : "password"}
                  name="password"
                  className={`form-input has-right-icon${fieldErrors.password ? " input-error" : ""}`}
                  placeholder="Create a strong password"
                  value={formData.password}
                  onChange={handleChange}
                  autoComplete="new-password"
                  disabled={loading}
                  aria-required="true"
                  aria-describedby={fieldErrors.password ? "password-error" : undefined}
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
              {fieldErrors.password && (
                <p id="password-error" className="field-error">⚠ {fieldErrors.password}</p>
              )}
              <PasswordStrength password={formData.password} showRequirements />
            </div>

            {/* Confirm Password */}
            <div className="form-group">
              <label className="form-label" htmlFor="reg-confirm-password">
                Confirm Password <span className="required">*</span>
              </label>
              <div className="input-wrapper">
                <span className="input-icon"><LockIcon /></span>
                <input
                  id="reg-confirm-password"
                  type={showConfirmPassword ? "text" : "password"}
                  name="confirmPassword"
                  className={`form-input has-right-icon${
                    fieldErrors.confirmPassword
                      ? " input-error"
                      : formData.confirmPassword && formData.password === formData.confirmPassword
                      ? " input-success"
                      : ""
                  }`}
                  placeholder="Repeat your password"
                  value={formData.confirmPassword}
                  onChange={handleChange}
                  autoComplete="new-password"
                  disabled={loading}
                  aria-required="true"
                  aria-describedby={fieldErrors.confirmPassword ? "confirm-error" : undefined}
                />
                <button
                  type="button"
                  className="input-icon-right"
                  onClick={() => setShowConfirmPassword((v) => !v)}
                  aria-label={showConfirmPassword ? "Hide confirm password" : "Show confirm password"}
                  tabIndex={-1}
                >
                  {showConfirmPassword ? <EyeOffIcon /> : <EyeIcon />}
                </button>
              </div>
              {fieldErrors.confirmPassword && (
                <p id="confirm-error" className="field-error">⚠ {fieldErrors.confirmPassword}</p>
              )}
              {!fieldErrors.confirmPassword &&
                formData.confirmPassword &&
                formData.password === formData.confirmPassword && (
                  <p className="field-error" style={{ color: "var(--color-success)" }}>
                    ✓ Passwords match
                  </p>
                )}
            </div>

            {/* Terms */}
            <div className="form-group">
              <div className="form-checkbox-group">
                <input
                  id="agree-terms"
                  type="checkbox"
                  className="form-checkbox"
                  checked={agreeTerms}
                  onChange={(e) => {
                    setAgreeTerms(e.target.checked);
                    if (fieldErrors.terms) setFieldErrors((p) => ({ ...p, terms: "" }));
                    if (error === fieldErrors.terms) setError("");
                  }}
                  disabled={loading}
                  aria-required="true"
                />
                <label htmlFor="agree-terms" className="form-checkbox-label">
                  I agree to the{" "}
                  <a href="#">Terms of Service</a>{" "}
                  and{" "}
                  <a href="#">Privacy Policy</a>. I understand that
                  all activity is logged for security compliance.
                </label>
              </div>
            </div>

            {/* Submit */}
            <button
              id="register-submit"
              type="submit"
              className="btn-primary"
              disabled={loading}
            >
              {loading ? (
                <>
                  <span className="spinner" />
                  Creating account…
                </>
              ) : (
                <>
                  🛡 Create Secure Account
                </>
              )}
            </button>
          </form>

          {/* Security Info */}
          <div className="security-info" style={{ marginTop: "var(--space-6)" }}>
            <div className="security-info-title">🔒 Data Protection</div>
            <p className="security-info-text">
              Passwords are hashed with bcrypt (salt rounds: 12). Your data is
              never stored in plain text and all sessions use signed JWT tokens.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default RegisterPage;
