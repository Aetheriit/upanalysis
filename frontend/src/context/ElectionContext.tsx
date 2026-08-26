"use client";

import React, { createContext, useContext, useState, useEffect } from "react";

type ViewMode = "Comparison (17 vs 22)" | "2022 Only" | "2017 Only";

interface ElectionContextType {
  viewMode: ViewMode;
  setViewMode: (mode: ViewMode) => void;
  is2017: boolean;
  is2022: boolean;
  isComparison: boolean;
}

const ElectionContext = createContext<ElectionContextType | undefined>(undefined);

export function ElectionProvider({ children }: { children: React.ReactNode }) {
  const [viewMode, setViewModeState] = useState<ViewMode>("2022 Only");
  const [mounted, setMounted] = useState(false);

  // Load from local storage if available
  useEffect(() => {
    setMounted(true);
    const saved = localStorage.getItem("ei_viewMode") as ViewMode;
    if (saved && ["Comparison (17 vs 22)", "2022 Only", "2017 Only"].includes(saved)) {
      setViewModeState(saved);
    }
  }, []);

  const setViewMode = (mode: ViewMode) => {
    setViewModeState(mode);
    localStorage.setItem("ei_viewMode", mode);
  };

  const is2017 = viewMode === "2017 Only" || viewMode === "Comparison (17 vs 22)";
  const is2022 = viewMode === "2022 Only" || viewMode === "Comparison (17 vs 22)";
  const isComparison = viewMode === "Comparison (17 vs 22)";

  // We must return the Provider unconditionally so children don't crash
  // during SSR/initial hydration when trying to access useElectionContext.
  return (
    <ElectionContext.Provider value={{ viewMode, setViewMode, is2017, is2022, isComparison }}>
      {children}
    </ElectionContext.Provider>
  );
}

export function useElectionContext() {
  const context = useContext(ElectionContext);
  if (context === undefined) {
    throw new Error("useElectionContext must be used within an ElectionProvider");
  }
  return context;
}
