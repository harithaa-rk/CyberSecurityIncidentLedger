import React, { useState, useRef, useEffect } from "react";
import { useTheme } from "../context/ThemeContext";

/* ── Inline SVG Icons ── */
const SunIcon = ({ size = 16 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="12" cy="12" r="5" />
    <line x1="12" y1="1" x2="12" y2="3" />
    <line x1="12" y1="21" x2="12" y2="23" />
    <line x1="4.22" y1="4.22" x2="5.64" y2="5.64" />
    <line x1="18.36" y1="18.36" x2="19.78" y2="19.78" />
    <line x1="1" y1="12" x2="3" y2="12" />
    <line x1="21" y1="12" x2="23" y2="12" />
    <line x1="4.22" y1="19.78" x2="5.64" y2="18.36" />
    <line x1="18.36" y1="5.64" x2="19.78" y2="4.22" />
  </svg>
);

const MoonIcon = ({ size = 16 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
  </svg>
);

const PaletteIcon = ({ size = 16 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="13.5" cy="6.5" r=".5" fill="currentColor" />
    <circle cx="17.5" cy="10.5" r=".5" fill="currentColor" />
    <circle cx="8.5" cy="7.5" r=".5" fill="currentColor" />
    <circle cx="6.5" cy="12.5" r=".5" fill="currentColor" />
    <path d="M12 2C6.5 2 2 6.5 2 12s4.5 10 10 10c.926 0 1.648-.746 1.648-1.688 0-.437-.18-.835-.437-1.125-.29-.289-.438-.652-.438-1.125a1.64 1.64 0 0 1 1.668-1.668h1.996c3.051 0 5.555-2.503 5.555-5.554C21.965 6.012 17.461 2 12 2z" />
  </svg>
);

const CheckIcon = ({ size = 14 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="20 6 9 17 4 12" />
  </svg>
);

export default function ThemeSelector({ compact = false }) {
  const { theme, themeConfig, setTheme, toggleMode, isDarkMode, themes } = useTheme();
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const dropdownRef = useRef(null);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (e) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target)) {
        setDropdownOpen(false);
      }
    };
    const handleKeyDown = (e) => {
      if (e.key === "Escape") setDropdownOpen(false);
    };

    if (dropdownOpen) {
      document.addEventListener("mousedown", handleClickOutside);
      document.addEventListener("keydown", handleKeyDown);
    }
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [dropdownOpen]);

  const darkThemes = themes.filter((t) => t.mode === "dark");
  const lightThemes = themes.filter((t) => t.mode === "light");

  return (
    <div style={{ position: "relative", display: "inline-flex", alignItems: "center", gap: 6 }} ref={dropdownRef}>
      {/* ── Quick Dark/Light Toggle Button ── */}
      <button
        type="button"
        onClick={toggleMode}
        title={isDarkMode ? "Switch to Light Mode" : "Switch to Dark Mode"}
        aria-label="Toggle dark/light mode"
        style={{
          display: "inline-flex",
          alignItems: "center",
          justifyContent: "center",
          width: 34,
          height: 34,
          borderRadius: 8,
          background: "var(--bg-surface)",
          border: "1px solid var(--border-subtle)",
          color: "var(--color-gold)",
          cursor: "pointer",
          transition: "all 0.18s ease",
          boxShadow: "0 2px 8px rgba(0,0,0,0.15)",
        }}
        onMouseEnter={(e) => {
          e.currentTarget.style.borderColor = "var(--color-gold)";
          e.currentTarget.style.transform = "scale(1.05)";
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.borderColor = "var(--border-subtle)";
          e.currentTarget.style.transform = "scale(1)";
        }}
      >
        {isDarkMode ? <SunIcon size={16} /> : <MoonIcon size={16} />}
      </button>

      {/* ── Multi-Theme Palette Menu Button ── */}
      <button
        type="button"
        onClick={() => setDropdownOpen((prev) => !prev)}
        title="Choose Theme Palette"
        aria-haspopup="true"
        aria-expanded={dropdownOpen}
        style={{
          display: "inline-flex",
          alignItems: "center",
          gap: 8,
          height: 34,
          padding: compact ? "0 8px" : "0 10px",
          borderRadius: 8,
          background: dropdownOpen ? "var(--bg-surface-elevated)" : "var(--bg-surface)",
          border: dropdownOpen ? "1px solid var(--color-gold)" : "1px solid var(--border-subtle)",
          color: "var(--text-primary)",
          fontSize: "0.78rem",
          fontWeight: 700,
          fontFamily: "var(--font-heading)",
          cursor: "pointer",
          transition: "all 0.18s ease",
          boxShadow: dropdownOpen ? "0 0 12px var(--color-gold-glow)" : "0 2px 8px rgba(0,0,0,0.15)",
        }}
        onMouseEnter={(e) => {
          e.currentTarget.style.borderColor = "var(--color-gold)";
        }}
        onMouseLeave={(e) => {
          if (!dropdownOpen) e.currentTarget.style.borderColor = "var(--border-subtle)";
        }}
      >
        {/* Color preview indicator dot */}
        <span
          style={{
            display: "inline-flex",
            alignItems: "center",
            justifyContent: "center",
            width: 14,
            height: 14,
            borderRadius: "50%",
            background: themeConfig.primaryColor,
            boxShadow: `0 0 6px ${themeConfig.primaryColor}`,
            border: "1.5px solid var(--bg-surface)",
            flexShrink: 0,
          }}
        />

        <PaletteIcon size={14} />

        {!compact && (
          <span style={{ whiteSpace: "nowrap" }}>
            {themeConfig.name}
          </span>
        )}

        <span style={{ fontSize: "0.65rem", color: "var(--text-muted)" }}>▼</span>
      </button>

      {/* ── Animated Theme Dropdown Popover ── */}
      {dropdownOpen && (
        <div
          role="menu"
          aria-label="Theme options"
          style={{
            position: "absolute",
            top: "calc(100% + 8px)",
            right: 0,
            width: 320,
            background: "var(--bg-surface)",
            border: "1px solid var(--border-highlight)",
            borderRadius: 12,
            boxShadow: "0 12px 40px rgba(0, 0, 0, 0.45), 0 0 20px var(--color-gold-glow)",
            padding: "10px",
            zIndex: 1000,
            animation: "modalFadeIn 0.2s cubic-bezier(0.16, 1, 0.3, 1)",
            backdropFilter: "blur(12px)",
          }}
        >
          {/* Header */}
          <div
            style={{
              padding: "6px 8px 10px 8px",
              borderBottom: "1px solid var(--border-subtle)",
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              marginBottom: 8,
            }}
          >
            <div>
              <div
                style={{
                  fontSize: "0.8125rem",
                  fontWeight: 800,
                  color: "var(--text-primary)",
                  fontFamily: "var(--font-heading)",
                }}
              >
                Display Themes
              </div>
              <div style={{ fontSize: "0.6875rem", color: "var(--text-muted)", marginTop: 2 }}>
                Instant live theme adaptation
              </div>
            </div>

            <span
              style={{
                fontSize: "0.65rem",
                fontWeight: 800,
                fontFamily: "var(--font-mono)",
                padding: "2px 6px",
                borderRadius: 4,
                background: isDarkMode ? "rgba(244, 197, 66, 0.15)" : "rgba(2, 132, 199, 0.15)",
                color: isDarkMode ? "var(--color-gold)" : "#0284c7",
                border: "1px solid var(--border-subtle)",
                textTransform: "uppercase",
              }}
            >
              {isDarkMode ? "🌙 DARK" : "☀️ LIGHT"}
            </span>
          </div>

          {/* ── Dark Themes List ── */}
          <div style={{ marginBottom: 10 }}>
            <div
              style={{
                fontSize: "0.65rem",
                fontWeight: 800,
                textTransform: "uppercase",
                letterSpacing: "0.08em",
                color: "var(--text-muted)",
                fontFamily: "var(--font-mono)",
                padding: "4px 8px",
                display: "flex",
                alignItems: "center",
                gap: 6,
              }}
            >
              <span>🌙 Dark Palettes ({darkThemes.length})</span>
            </div>

            <div style={{ display: "flex", flexDirection: "column", gap: 3 }}>
              {darkThemes.map((item) => {
                const isActive = theme === item.id;
                return (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => {
                      setTheme(item.id);
                      setDropdownOpen(false);
                    }}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "space-between",
                      padding: "8px 10px",
                      borderRadius: 8,
                      border: isActive ? "1px solid var(--color-gold)" : "1px solid transparent",
                      background: isActive ? "var(--color-gold-soft)" : "transparent",
                      cursor: "pointer",
                      textAlign: "left",
                      transition: "all 0.15s ease",
                      width: "100%",
                    }}
                    onMouseEnter={(e) => {
                      if (!isActive) e.currentTarget.style.background = "var(--bg-surface-elevated)";
                    }}
                    onMouseLeave={(e) => {
                      if (!isActive) e.currentTarget.style.background = "transparent";
                    }}
                  >
                    <div style={{ display: "flex", alignItems: "center", gap: 10, minWidth: 0 }}>
                      {/* Swatch */}
                      <div
                        style={{
                          width: 24,
                          height: 24,
                          borderRadius: 6,
                          background: item.bgColor,
                          border: "1px solid #333",
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                          flexShrink: 0,
                          boxShadow: "inset 0 0 4px rgba(0,0,0,0.5)",
                        }}
                      >
                        <span
                          style={{
                            width: 10,
                            height: 10,
                            borderRadius: "50%",
                            background: item.primaryColor,
                            boxShadow: `0 0 6px ${item.primaryColor}`,
                          }}
                        />
                      </div>

                      <div style={{ minWidth: 0 }}>
                        <div
                          style={{
                            fontSize: "0.78rem",
                            fontWeight: 700,
                            color: isActive ? "var(--color-gold)" : "var(--text-primary)",
                            fontFamily: "var(--font-heading)",
                            lineHeight: 1.2,
                          }}
                        >
                          {item.name}
                        </div>
                        <div
                          style={{
                            fontSize: "0.65rem",
                            color: "var(--text-muted)",
                            whiteSpace: "nowrap",
                            overflow: "hidden",
                            textOverflow: "ellipsis",
                          }}
                        >
                          {item.description}
                        </div>
                      </div>
                    </div>

                    {isActive && (
                      <span style={{ color: "var(--color-gold)", marginLeft: 6, flexShrink: 0 }}>
                        <CheckIcon size={14} />
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          </div>

          {/* ── Light Themes List ── */}
          <div>
            <div
              style={{
                fontSize: "0.65rem",
                fontWeight: 800,
                textTransform: "uppercase",
                letterSpacing: "0.08em",
                color: "var(--text-muted)",
                fontFamily: "var(--font-mono)",
                padding: "4px 8px",
                display: "flex",
                alignItems: "center",
                gap: 6,
              }}
            >
              <span>☀️ Light Palettes ({lightThemes.length})</span>
            </div>

            <div style={{ display: "flex", flexDirection: "column", gap: 3 }}>
              {lightThemes.map((item) => {
                const isActive = theme === item.id;
                return (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => {
                      setTheme(item.id);
                      setDropdownOpen(false);
                    }}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "space-between",
                      padding: "8px 10px",
                      borderRadius: 8,
                      border: isActive ? "1px solid var(--color-gold)" : "1px solid transparent",
                      background: isActive ? "var(--color-gold-soft)" : "transparent",
                      cursor: "pointer",
                      textAlign: "left",
                      transition: "all 0.15s ease",
                      width: "100%",
                    }}
                    onMouseEnter={(e) => {
                      if (!isActive) e.currentTarget.style.background = "var(--bg-surface-elevated)";
                    }}
                    onMouseLeave={(e) => {
                      if (!isActive) e.currentTarget.style.background = "transparent";
                    }}
                  >
                    <div style={{ display: "flex", alignItems: "center", gap: 10, minWidth: 0 }}>
                      {/* Swatch */}
                      <div
                        style={{
                          width: 24,
                          height: 24,
                          borderRadius: 6,
                          background: item.bgColor,
                          border: "1px solid #cbd5e1",
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                          flexShrink: 0,
                          boxShadow: "0 1px 3px rgba(0,0,0,0.1)",
                        }}
                      >
                        <span
                          style={{
                            width: 10,
                            height: 10,
                            borderRadius: "50%",
                            background: item.primaryColor,
                            boxShadow: `0 0 6px ${item.primaryColor}`,
                          }}
                        />
                      </div>

                      <div style={{ minWidth: 0 }}>
                        <div
                          style={{
                            fontSize: "0.78rem",
                            fontWeight: 700,
                            color: isActive ? "var(--color-gold)" : "var(--text-primary)",
                            fontFamily: "var(--font-heading)",
                            lineHeight: 1.2,
                          }}
                        >
                          {item.name}
                        </div>
                        <div
                          style={{
                            fontSize: "0.65rem",
                            color: "var(--text-muted)",
                            whiteSpace: "nowrap",
                            overflow: "hidden",
                            textOverflow: "ellipsis",
                          }}
                        >
                          {item.description}
                        </div>
                      </div>
                    </div>

                    {isActive && (
                      <span style={{ color: "var(--color-gold)", marginLeft: 6, flexShrink: 0 }}>
                        <CheckIcon size={14} />
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
