"use client";

import React, { createContext, useContext, useEffect, useMemo, useState } from "react";

export type ThemePreference = "Light" | "Dark" | "System";
export type SidebarPreference = "Expanded" | "Collapsed";
export type ChartColorScheme = "Party Colors" | "Monochrome" | "Accessibility";
export type FontSizePreference = "Small" | "Medium" | "Large";
export type SessionTimeout = "15 minutes" | "30 minutes" | "1 hour" | "Never";

export interface AppSettings {
  displayName: string;
  email: string;
  role: string;
  organization: string;
  theme: ThemePreference;
  sidebarDefault: SidebarPreference;
  chartColorScheme: ChartColorScheme;
  fontSize: FontSizePreference;
  emailNotifications: boolean;
  alertNotifications: boolean;
  weeklyReportDigest: boolean;
  dataSyncAlerts: boolean;
  twoFactorAuthentication: boolean;
  sessionTimeout: SessionTimeout;
  apiKey: string;
}

export const DEFAULT_SETTINGS: AppSettings = {
  displayName: "Shivam Kumar",
  email: "shivam@electionintel.in",
  role: "Senior Analyst",
  organization: "ElectionIntel Research",
  theme: "System",
  sidebarDefault: "Expanded",
  chartColorScheme: "Party Colors",
  fontSize: "Medium",
  emailNotifications: true,
  alertNotifications: true,
  weeklyReportDigest: false,
  dataSyncAlerts: true,
  twoFactorAuthentication: true,
  sessionTimeout: "30 minutes",
  apiKey: "sk-••••••••••••",
};

interface SettingsContextValue {
  settings: AppSettings;
  saveSettings: (next: AppSettings) => void;
  setSidebarCollapsed: (collapsed: boolean) => void;
}

const SettingsContext = createContext<SettingsContextValue | undefined>(undefined);
const STORAGE_KEY = "ei_settings";

function applySettings(settings: AppSettings) {
  const root = document.documentElement;
  root.dataset.fontSize = settings.fontSize.toLowerCase();
  root.dataset.chartScheme = settings.chartColorScheme.toLowerCase().replace(" ", "-");
}

export function SettingsProvider({ children }: { children: React.ReactNode }) {
  const [settings, setSettings] = useState<AppSettings>(DEFAULT_SETTINGS);

  useEffect(() => {
    // 1. Quick initial load from local storage
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) setSettings({ ...DEFAULT_SETTINGS, ...JSON.parse(stored) });
    } catch {
      // Keep defaults
    }

    // 2. Fetch real settings from backend API
    const fetchSettings = async () => {
      try {
        const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000'}/api/v1/settings`);
        if (response.ok) {
          const data = await response.json();
          const serverSettings = { ...DEFAULT_SETTINGS, ...data };
          setSettings(serverSettings);
          localStorage.setItem(STORAGE_KEY, JSON.stringify(serverSettings));
        }
      } catch (error) {
        console.error("Failed to fetch settings from server:", error);
      }
    };
    fetchSettings();
  }, []);

  useEffect(() => {
    applySettings(settings);
  }, [settings]);

  const value = useMemo<SettingsContextValue>(() => ({
    settings,
    saveSettings: async (next) => {
      // Optimistic update
      setSettings(next);
      localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
      window.dispatchEvent(new CustomEvent("ei-settings-updated", { detail: next }));

      // Persist to backend
      try {
        await fetch(`${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000'}/api/v1/settings`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(next),
        });
      } catch (error) {
        console.error("Failed to save settings to server:", error);
      }
    },
    setSidebarCollapsed: async (collapsed) => {
      let nextSettings: AppSettings | null = null;
      setSettings((current) => {
        nextSettings = { ...current, sidebarDefault: collapsed ? "Collapsed" : "Expanded" } as AppSettings;
        localStorage.setItem(STORAGE_KEY, JSON.stringify(nextSettings));
        return nextSettings;
      });
      
      if (nextSettings) {
        try {
          await fetch(`${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000'}/api/v1/settings`, {
            method: "PUT",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ sidebarDefault: collapsed ? "Collapsed" : "Expanded" }),
          });
        } catch (error) {
          console.error("Failed to save sidebar state to server:", error);
        }
      }
    },
  }), [settings]);

  return <SettingsContext.Provider value={value}>{children}</SettingsContext.Provider>;
}

export function useSettings() {
  const context = useContext(SettingsContext);
  if (!context) throw new Error("useSettings must be used within a SettingsProvider");
  return context;
}
