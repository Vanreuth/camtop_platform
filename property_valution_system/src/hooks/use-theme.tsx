"use client";

import { useEffect, useState } from "react";

export type ThemePreset =
  | "default"
  | "ocean"
  | "forest"
  | "sunset"
  | "purple"
  | "rose";

const themePresets: Record<ThemePreset, Record<string, string>> = {
  default: {
    "--primary": "oklch(0.205 0 0)",
    "--primary-foreground": "oklch(0.985 0 0)",
    "--accent": "oklch(0.97 0 0)",
    "--accent-foreground": "oklch(0.205 0 0)",
    "--sidebar-primary": "oklch(0.205 0 0)",
  },
  ocean: {
    "--primary": "oklch(0.5 0.15 240)",
    "--primary-foreground": "oklch(0.985 0 0)",
    "--accent": "oklch(0.7 0.12 220)",
    "--accent-foreground": "oklch(0.145 0 0)",
    "--sidebar-primary": "oklch(0.5 0.15 240)",
  },
  forest: {
    "--primary": "oklch(0.45 0.12 150)",
    "--primary-foreground": "oklch(0.985 0 0)",
    "--accent": "oklch(0.65 0.1 140)",
    "--accent-foreground": "oklch(0.145 0 0)",
    "--sidebar-primary": "oklch(0.45 0.12 150)",
  },
  sunset: {
    "--primary": "oklch(0.6 0.2 40)",
    "--primary-foreground": "oklch(0.985 0 0)",
    "--accent": "oklch(0.7 0.15 60)",
    "--accent-foreground": "oklch(0.145 0 0)",
    "--sidebar-primary": "oklch(0.6 0.2 40)",
  },
  purple: {
    "--primary": "oklch(0.5 0.2 280)",
    "--primary-foreground": "oklch(0.985 0 0)",
    "--accent": "oklch(0.7 0.15 290)",
    "--accent-foreground": "oklch(0.145 0 0)",
    "--sidebar-primary": "oklch(0.5 0.2 280)",
  },
  rose: {
    "--primary": "oklch(0.55 0.18 350)",
    "--primary-foreground": "oklch(0.985 0 0)",
    "--accent": "oklch(0.75 0.12 10)",
    "--accent-foreground": "oklch(0.145 0 0)",
    "--sidebar-primary": "oklch(0.55 0.18 350)",
  },
};

export function useTheme() {
  const [theme, setTheme] = useState<ThemePreset>("default");
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    const savedTheme = localStorage.getItem("theme-preset") as ThemePreset;
    if (savedTheme && themePresets[savedTheme]) {
      setTheme(savedTheme);
      applyTheme(savedTheme);
    }
  }, []);

  const applyTheme = (preset: ThemePreset) => {
    const root = document.documentElement;
    const colors = themePresets[preset];

    Object.entries(colors).forEach(([key, value]) => {
      root.style.setProperty(key, value);
    });
  };

  const changeTheme = (preset: ThemePreset) => {
    setTheme(preset);
    applyTheme(preset);
    localStorage.setItem("theme-preset", preset);
  };

  return { theme, changeTheme, mounted };
}
