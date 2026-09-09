"use client";

import { usePathname } from "next/navigation";
import { ThemeProvider } from "@/components/theme-provider";
import { PrimarySidebar } from "@/components/navigation/primary-sidebar";
import { TopNavigation } from "@/components/navigation/top-navigation";
import { ElectionProvider } from "@/context/ElectionContext";

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const isLogin = pathname === "/login";

  return (
    <ThemeProvider attribute="data-theme" defaultTheme="light" enableSystem={false}>
      <ElectionProvider>
        {isLogin ? children : <><PrimarySidebar /><TopNavigation /><main className="pl-[260px] pt-[72px] min-h-screen transition-all duration-300">{children}</main></>}
      </ElectionProvider>
    </ThemeProvider>
  );
}
