"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";
import { useTheme } from "next-themes";
import { ThemeProvider } from "@/components/theme-provider";
import { PrimarySidebar } from "@/components/navigation/primary-sidebar";
import { TopNavigation } from "@/components/navigation/top-navigation";
import { ElectionProvider } from "@/context/ElectionContext";
import { SettingsProvider } from "@/context/SettingsContext";
import { useSettings } from "@/context/SettingsContext";

function ShellContent({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const { settings } = useSettings();
  const { setTheme } = useTheme();
  const isLogin = pathname === "/login";
  const sidebarCollapsed = settings.sidebarDefault === "Collapsed";

  useEffect(() => {
    setTheme(settings.theme.toLowerCase());
  }, [settings.theme, setTheme]);

  if (isLogin) return children;
  return <><PrimarySidebar /><TopNavigation /><main className={`pt-[72px] min-h-screen transition-all duration-300 ${sidebarCollapsed ? "pl-[80px]" : "pl-[260px]"}`}>{children}</main></>;
}

export function AppShell({ children }: { children: React.ReactNode }) {
  return (
    <ThemeProvider attribute="data-theme" defaultTheme="system" enableSystem>
      <ElectionProvider>
        <SettingsProvider><ShellContent>{children}</ShellContent></SettingsProvider>
      </ElectionProvider>
    </ThemeProvider>
  );
}
