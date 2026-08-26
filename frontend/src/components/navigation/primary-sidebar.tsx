"use client";

import React, { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { 
  LayoutDashboard, Users, MapPin, Flag, Building2,
  PieChart, TrendingUp, BarChart3, Target, History, Settings2,
  Map, Database, Brain, LineChart, FileText, FolderOpen,
  ChevronLeft, ChevronRight, Activity
} from "lucide-react";
import clsx from "clsx";

const NAV_GROUPS = [
  {
    label: "EXECUTIVE",
    items: [
      { name: "Dashboard", href: "/", icon: LayoutDashboard },
    ]
  },
  {
    label: "ELECTION WORKSPACE",
    items: [
      { name: "Constituencies", href: "/workspace/constituencies", icon: MapPin },
      { name: "Districts", href: "/workspace/districts", icon: Database },
      { name: "Parties", href: "/workspace/parties", icon: Flag },
      { name: "Candidates", href: "/workspace/candidates", icon: Users },
      { name: "Booths", href: "/workspace/booths", icon: Building2 },
    ]
  },
  {
    label: "ANALYTICS LAB",
    items: [
      { name: "Vote Share", href: "/analytics/vote-share", icon: PieChart },
      { name: "Swing Analysis", href: "/analytics/swing", icon: TrendingUp },
      { name: "Turnout Analysis", href: "/analytics/turnout", icon: Activity },
      { name: "Margin Analysis", href: "/analytics/margin", icon: Target },
      { name: "Historical Trends", href: "/analytics/trends", icon: History },
      { name: "Alliance Analysis", href: "/analytics/alliance", icon: BarChart3 },
    ]
  },
  {
    label: "MAPS & GIS",
    items: [
      { name: "Constituency Map", href: "/maps/constituency", icon: Map },
      { name: "GIS Explorer", href: "/maps/gis", icon: Database },
    ]
  },
  {
    label: "AI & FORECASTING",
    items: [
      { name: "AI Analyst", href: "/ai/analyst", icon: Brain },
      { name: "Forecasting", href: "/ai/forecasting", icon: LineChart },
    ]
  },
  {
    label: "REPORTS & PROJECTS",
    items: [
      { name: "Reports", href: "/reports", icon: FileText },
      { name: "Projects", href: "/projects", icon: FolderOpen },
    ]
  },
  {
    label: "ADMINISTRATION",
    items: [
      { name: "Data Center", href: "/admin/data-center", icon: Database },
      { name: "Settings", href: "/admin/settings", icon: Settings2 },
    ]
  }
];

export function PrimarySidebar() {
  const pathname = usePathname();
  const [isCollapsed, setIsCollapsed] = useState(false);

  return (
    <aside 
      className={clsx(
        "fixed left-0 top-0 h-screen bg-[#0B0D12] border-r border-[#222631] text-[#94A3B8] transition-all duration-300 z-50 flex flex-col",
        isCollapsed ? "w-[80px]" : "w-[260px]"
      )}
    >
      {/* Brand Header */}
      <div className="h-[72px] flex items-center px-4 border-b border-[#222631]">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-gradient-to-br from-[#E5C365] to-[#D4AF37] flex items-center justify-center text-[#0B0D12] font-serif font-bold text-xl flex-shrink-0">
            EI
          </div>
          {!isCollapsed && (
            <div className="overflow-hidden whitespace-nowrap">
              <h2 className="font-serif text-lg font-bold text-white tracking-wide">ElectionIntel</h2>
              <p className="text-[10px] uppercase tracking-wider text-[#E5C365]">Political Intelligence</p>
            </div>
          )}
        </div>
      </div>

      {/* Navigation Links */}
      <div className="flex-1 overflow-y-auto py-6 px-3 scrollbar-hide space-y-8">
        {NAV_GROUPS.map((group, idx) => (
          <div key={idx}>
            {!isCollapsed && (
              <h3 className="px-3 mb-2 text-xs font-semibold text-[#475569] uppercase tracking-wider">
                {group.label}
              </h3>
            )}
            <ul className="space-y-1">
              {group.items.map((item) => {
                const isActive = pathname === item.href;
                return (
                  <li key={item.name}>
                    <Link
                      href={item.href}
                      className={clsx(
                        "flex items-center gap-3 px-3 py-2 rounded-lg transition-colors group relative",
                        isActive 
                          ? "bg-[#E5C365]/10 text-[#E5C365]" 
                          : "hover:bg-[#13161C] hover:text-white"
                      )}
                      title={isCollapsed ? item.name : undefined}
                    >
                      <item.icon className={clsx("w-5 h-5 flex-shrink-0", isActive ? "text-[#E5C365]" : "text-[#475569] group-hover:text-white")} />
                      {!isCollapsed && (
                        <span className="text-sm font-medium whitespace-nowrap">
                          {item.name}
                        </span>
                      )}
                      {isActive && !isCollapsed && (
                        <div className="absolute left-0 top-1/2 -translate-y-1/2 w-1 h-5 bg-[#E5C365] rounded-r-full" />
                      )}
                    </Link>
                  </li>
                );
              })}
            </ul>
          </div>
        ))}
      </div>

      {/* Footer Collapse Toggle */}
      <div className="p-4 border-t border-[#222631]">
        <button
          onClick={() => setIsCollapsed(!isCollapsed)}
          className="w-full flex items-center gap-3 px-3 py-2 rounded-lg hover:bg-[#13161C] text-[#475569] hover:text-white transition-colors"
        >
          {isCollapsed ? <ChevronRight className="w-5 h-5 mx-auto" /> : <><ChevronLeft className="w-5 h-5" /><span className="text-sm font-medium">Collapse</span></>}
        </button>
      </div>
    </aside>
  );
}
