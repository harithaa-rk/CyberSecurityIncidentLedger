import React, { createContext, useContext, useState, useEffect } from "react";

export const THEMES = [
  {
    id: "dark-obsidian",
    name: "Obsidian Gold",
    mode: "dark",
    description: "Tactical SOC void with Sentinel Gold",
    primaryColor: "#F4C542",
    bgColor: "#080907",
    surfaceColor: "#141610",
    badge: "DEFAULT",
  },
  {
    id: "dark-midnight",
    name: "Midnight Cyber",
    mode: "dark",
    description: "Deep oceanic navy with Electric Cyan",
    primaryColor: "#38BDF8",
    bgColor: "#060B14",
    surfaceColor: "#0F192C",
  },
  {
    id: "dark-emerald",
    name: "Matrix Terminal",
    mode: "dark",
    description: "Carbon black with Phosphor Emerald",
    primaryColor: "#10B981",
    bgColor: "#060C08",
    surfaceColor: "#0F1E15",
  },
  {
    id: "dark-crimson",
    name: "Crimson Threat",
    mode: "dark",
    description: "Tactical charcoal with Ruby Red alert",
    primaryColor: "#F43F5E",
    bgColor: "#0C0708",
    surfaceColor: "#190F11",
  },
  {
    id: "light-slate",
    name: "Sentinel Light",
    mode: "light",
    description: "Clean enterprise slate with Amber Gold",
    primaryColor: "#D97706",
    bgColor: "#F8FAFC",
    surfaceColor: "#FFFFFF",
    badge: "CLEAN",
  },
  {
    id: "light-ice",
    name: "Nordic Frost",
    mode: "light",
    description: "Crisp ice-white with Royal Sapphire",
    primaryColor: "#0284C7",
    bgColor: "#F0F4F8",
    surfaceColor: "#FFFFFF",
  },
  {
    id: "light-emerald",
    name: "Clean Botanical",
    mode: "light",
    description: "Fresh pearl white with Mint Emerald",
    primaryColor: "#059669",
    bgColor: "#F2FBF6",
    surfaceColor: "#FFFFFF",
  },
];

const ThemeContext = createContext(null);

export const ThemeProvider = ({ children }) => {
  const [currentThemeId, setCurrentThemeId] = useState(() => {
    try {
      const saved = localStorage.getItem("owlyx_theme");
      if (saved && THEMES.some((t) => t.id === saved)) {
        return saved;
      }
    } catch {
      // fallback
    }
    return "dark-obsidian";
  });

  const activeTheme = THEMES.find((t) => t.id === currentThemeId) || THEMES[0];
  const isDarkMode = activeTheme.mode === "dark";

  useEffect(() => {
    try {
      localStorage.setItem("owlyx_theme", currentThemeId);
    } catch (e) {
      console.warn("Could not save theme to localStorage:", e);
    }

    const root = document.documentElement;
    root.setAttribute("data-theme", currentThemeId);
    root.setAttribute("data-mode", activeTheme.mode);
    root.style.colorScheme = activeTheme.mode;
  }, [currentThemeId, activeTheme.mode]);

  const setTheme = (themeId) => {
    if (THEMES.some((t) => t.id === themeId)) {
      setCurrentThemeId(themeId);
    }
  };

  const toggleMode = () => {
    if (isDarkMode) {
      // switch to default light theme
      setCurrentThemeId("light-slate");
    } else {
      // switch to default dark theme
      setCurrentThemeId("dark-obsidian");
    }
  };

  return (
    <ThemeContext.Provider
      value={{
        theme: currentThemeId,
        themeConfig: activeTheme,
        setTheme,
        toggleMode,
        isDarkMode,
        mode: activeTheme.mode,
        themes: THEMES,
      }}
    >
      {children}
    </ThemeContext.Provider>
  );
};

export const useTheme = () => {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error("useTheme must be used within a ThemeProvider");
  }
  return context;
};
