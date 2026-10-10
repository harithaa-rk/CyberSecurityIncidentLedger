import React, { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";

/**
 * CommandPalette Component
 * Futuristic keyboard-accessible command palette (Ctrl+K / Cmd+K).
 * Instant navigation and real-time query searching across incidents, logs, evidence, and actions.
 */
export default function CommandPalette({ isOpen, onClose }) {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [query, setQuery] = useState("");
  const [selectedIndex, setSelectedIndex] = useState(0);
  const inputRef = useRef(null);

  const baseCommands = [
    {
      category: "Operations Center",
      items: [
        { id: "dash", label: "Security Command Center", desc: "Main landing & Threat Constellation", path: "/admin-dashboard", icon: "🛡️" },
        { id: "incidents", label: "Incident Management Center", desc: "Review, assign, and respond to threats", path: "/admin/incidents", icon: "🚨" },
        { id: "live-logs", label: "Live Telemetry Monitor", desc: "Real Windows OS event streams (REAL origin)", path: "/admin/live-security-logs", icon: "🛰️" },
        { id: "ledger", label: "Security Logs Ledger", desc: "Immutable log archive with blockchain hashes", path: "/admin/security-logs", icon: "📜" },
      ]
    },
    {
      category: "Forensics & Blockchain",
      items: [
        { id: "analyst-inc", label: "Analyst Investigation Workspace", desc: "MITRE ATT&CK analysis & evidence capture", path: "/analyst/incidents", icon: "🔬" },
        { id: "verify-report", label: "Forensic Report Verification", desc: "Verify cryptographic signatures & QR seals", path: "/verify/DEMO", icon: "⛓️" },
        { id: "orgs", label: "Organization Governance", desc: "Manage SOC tenants and policies", path: "/admin-dashboard", icon: "🏢" },
      ]
    },
    {
      category: "Telemetry File Monitors (Project Root)",
      items: [
        { id: "file-system", label: "system-logs.log (Owlyx Intelligence)", desc: "Analyzed ledger with Incident IDs & Threats", action: () => alert("File active at: c:\\Users\\harit\\CyberSecurityIncidentLedger\\system-logs.log"), icon: "📄" },
        { id: "file-raw", label: "live-system-logs.log (Core System Telemetry)", desc: "Native Windows Event logs without extra features", action: () => alert("File active at: c:\\Users\\harit\\CyberSecurityIncidentLedger\\live-system-logs.log"), icon: "⚡" },
      ]
    }
  ];

  // Flatten items for filtering
  const allItems = baseCommands.flatMap((group) =>
    group.items.map((item) => ({ ...item, category: group.category }))
  );

  const filteredItems = allItems.filter(
    (item) =>
      item.label.toLowerCase().includes(query.toLowerCase()) ||
      item.desc.toLowerCase().includes(query.toLowerCase()) ||
      item.category.toLowerCase().includes(query.toLowerCase())
  );

  useEffect(() => {
    if (isOpen) {
      setQuery("");
      setSelectedIndex(0);
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [isOpen]);

  useEffect(() => {
    const handleKeyDown = (e) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        if (isOpen) onClose();
        else onClose(true); // toggle
      }
      if (!isOpen) return;

      if (e.key === "Escape") {
        e.preventDefault();
        onClose();
      } else if (e.key === "ArrowDown") {
        e.preventDefault();
        setSelectedIndex((prev) => (prev + 1) % (filteredItems.length || 1));
      } else if (e.key === "ArrowUp") {
        e.preventDefault();
        setSelectedIndex((prev) => (prev - 1 + (filteredItems.length || 1)) % (filteredItems.length || 1));
      } else if (e.key === "Enter" && filteredItems[selectedIndex]) {
        e.preventDefault();
        executeItem(filteredItems[selectedIndex]);
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, selectedIndex, filteredItems]);

  const executeItem = (item) => {
    onClose();
    if (item.action) {
      item.action();
    } else if (item.path) {
      navigate(item.path);
    }
  };

  if (!isOpen) return null;

  return (
    <div
      onClick={onClose}
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 99999,
        background: "rgba(8, 9, 7, 0.82)",
        backdropFilter: "blur(8px)",
        display: "flex",
        alignItems: "flex-start",
        justifyContent: "center",
        paddingTop: "12vh",
        animation: "modalFadeIn 0.18s ease-out",
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          width: "100%",
          maxWidth: 640,
          background: "var(--bg-secondary)",
          border: "1px solid var(--border-subtle)",
          borderRadius: 14,
          boxShadow: "var(--shadow-obsidian)",
          overflow: "hidden",
        }}
      >
        {/* Search Input Bar */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 12,
            padding: "16px 20px",
            borderBottom: "1px solid var(--border-subtle)",
            background: "var(--bg-primary)",
          }}
        >
          <span style={{ fontSize: "1.2rem", color: "var(--color-gold)" }}>⌕</span>
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setSelectedIndex(0);
            }}
            placeholder="Type a command or search telemetry (e.g. Incidents, Logs, Fabric)..."
            style={{
              flex: 1,
              background: "transparent",
              border: "none",
              outline: "none",
              color: "var(--text-primary)",
              fontFamily: "var(--font-heading)",
              fontSize: "1rem",
              fontWeight: 500,
            }}
          />
          <span
            style={{
              fontFamily: "var(--font-mono)",
              fontSize: "0.7rem",
              color: "var(--text-secondary)",
              background: "var(--bg-surface)",
              border: "1px solid var(--border-subtle)",
              padding: "2px 6px",
              borderRadius: 4,
            }}
          >
            ESC
          </span>
        </div>

        {/* Results List */}
        <div style={{ maxHeight: 380, overflowY: "auto", padding: "8px 0" }}>
          {filteredItems.length === 0 ? (
            <div style={{ padding: "32px 20px", textAlign: "center", color: "var(--text-secondary)" }}>
              No matching security commands or telemetry targets found for "{query}".
            </div>
          ) : (
            filteredItems.map((item, idx) => {
              const isSelected = idx === selectedIndex;
              return (
                <div
                  key={item.id}
                  onClick={() => executeItem(item)}
                  onMouseEnter={() => setSelectedIndex(idx)}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 14,
                    padding: "12px 20px",
                    cursor: "pointer",
                    background: isSelected ? "var(--color-gold-soft)" : "transparent",
                    borderLeft: isSelected ? "3px solid var(--color-gold)" : "3px solid transparent",
                    transition: "all 0.1s ease",
                  }}
                >
                  <span style={{ fontSize: "1.25rem" }}>{item.icon}</span>
                  <div style={{ flex: 1 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                      <span
                        style={{
                          color: isSelected ? "var(--color-gold)" : "var(--text-primary)",
                          fontFamily: "var(--font-heading)",
                          fontWeight: 700,
                          fontSize: "0.92rem",
                        }}
                      >
                        {item.label}
                      </span>
                      <span
                        style={{
                          fontSize: "0.68rem",
                          fontFamily: "var(--font-mono)",
                          color: "var(--text-secondary)",
                          background: "var(--bg-surface)",
                          padding: "1px 6px",
                          borderRadius: 4,
                          border: "1px solid var(--border-subtle)",
                        }}
                      >
                        {item.category}
                      </span>
                    </div>
                    <div style={{ fontSize: "0.78rem", color: "var(--text-secondary)", marginTop: 2 }}>
                      {item.desc}
                    </div>
                  </div>
                  {isSelected && (
                    <span
                      style={{
                        fontFamily: "var(--font-mono)",
                        fontSize: "0.7rem",
                        color: "var(--color-gold)",
                      }}
                    >
                      ↵ Execute
                    </span>
                  )}
                </div>
              );
            })
          )}
        </div>

        {/* Footer shortcuts */}
        <div
          style={{
            padding: "10px 20px",
            borderTop: "1px solid var(--border-subtle)",
            background: "var(--bg-primary)",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            fontSize: "0.75rem",
            color: "var(--text-muted)",
            fontFamily: "var(--font-mono)",
          }}
        >
          <div style={{ display: "flex", gap: 14 }}>
            <span>↑↓ Navigate</span>
            <span>↵ Select</span>
            <span>ESC Dismiss</span>
          </div>
          <span style={{ color: "var(--color-gold)", fontWeight: 600 }}>Owlyx Command Palette</span>
        </div>
      </div>
    </div>
  );
}
