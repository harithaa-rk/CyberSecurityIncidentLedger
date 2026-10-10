import React from "react";

/**
 * Calculates password strength score 0–4.
 */
export const getPasswordStrength = (password) => {
  if (!password) return { score: 0, label: "", level: "" };

  let score = 0;
  const checks = {
    length:    password.length >= 8,
    longEnough: password.length >= 12,
    uppercase: /[A-Z]/.test(password),
    lowercase: /[a-z]/.test(password),
    number:    /[0-9]/.test(password),
    special:   /[^A-Za-z0-9]/.test(password),
  };

  if (checks.length)     score++;
  if (checks.longEnough) score++;
  if (checks.uppercase && checks.lowercase) score++;
  if (checks.number)     score++;
  if (checks.special)    score++;

  const clampedScore = Math.min(4, score);

  const levels = [
    { label: "",           level: "" },
    { label: "Weak",       level: "weak" },
    { label: "Fair",       level: "fair" },
    { label: "Good",       level: "good" },
    { label: "Very Strong",level: "strong" },
  ];

  return {
    score: clampedScore,
    label: levels[clampedScore]?.label || "",
    level: levels[clampedScore]?.level || "",
    checks,
  };
};

/**
 * PasswordStrength component
 * @param {{ password: string, showRequirements?: boolean }} props
 */
const PasswordStrength = ({ password, showRequirements = true }) => {
  const { score, label, level, checks } = getPasswordStrength(password);

  if (!password) return null;

  const requirements = [
    { key: "length",    text: "At least 8 characters",           met: checks?.length },
    { key: "uppercase", text: "One uppercase letter (A–Z)",       met: checks?.uppercase },
    { key: "lowercase", text: "One lowercase letter (a–z)",       met: checks?.lowercase },
    { key: "number",    text: "One number (0–9)",                 met: checks?.number },
    { key: "special",   text: "One special character (!@#$…)",   met: checks?.special },
  ];

  return (
    <div className="password-strength">
      <div className="strength-bars">
        {[1, 2, 3, 4].map((bar) => (
          <div
            key={bar}
            className={`strength-bar${score >= bar ? ` active ${level}` : ""}`}
          />
        ))}
      </div>

      {label && (
        <span className={`strength-label ${level}`}>
          {label}
        </span>
      )}

      {showRequirements && (
        <div className="strength-requirements">
          {requirements.map((req) => (
            <div key={req.key} className={`strength-req${req.met ? " met" : ""}`}>
              <span className="strength-req-dot" />
              {req.met ? "✓ " : ""}{req.text}
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default PasswordStrength;