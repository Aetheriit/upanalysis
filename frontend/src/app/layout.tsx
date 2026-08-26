import type { Metadata } from "next";
import { ThemeProvider } from "@/components/theme-provider";
import { PrimarySidebar } from "@/components/navigation/primary-sidebar";
import { TopNavigation } from "@/components/navigation/top-navigation";
import { ElectionProvider } from "@/context/ElectionContext";
import "./globals.css";

export const metadata: Metadata = {
  title: "Uttar Pradesh Election Intelligence",
  description: "Enterprise-grade Political Intelligence Operating System.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className="antialiased">
        <ThemeProvider attribute="data-theme" defaultTheme="light" enableSystem={false}>
          <ElectionProvider>
            {/* OS Navigation & Shell */}
            <PrimarySidebar />
            <TopNavigation />

            {/* Main Content Workspace */}
            <main className="pl-[260px] pt-[72px] min-h-screen transition-all duration-300">
              {children}
            </main>
          </ElectionProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
