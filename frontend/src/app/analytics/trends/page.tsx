"use client";

import React from "react";
import { PageHeader } from "@/components/layout/page-header";
import { PremiumCard } from "@/components/ds/premium-card";
import { Download, History } from "lucide-react";
import { LineChart, Line, AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from "recharts";

const seatTrend = [
  { year: "2002", BJP: 88, SP: 143, BSP: 98, INC: 25, Others: 49 },
  { year: "2007", BJP: 51, SP: 97, BSP: 206, INC: 22, Others: 27 },
  { year: "2012", BJP: 47, SP: 224, BSP: 80, INC: 28, Others: 24 },
  { year: "2017", BJP: 312, SP: 47, BSP: 19, INC: 7, Others: 18 },
  { year: "2022", BJP: 255, SP: 111, BSP: 1, INC: 2, Others: 34 },
];

const voteShareTrend = [
  { year: "2002", BJP: 20.1, SP: 25.0, BSP: 23.1, INC: 8.9 },
  { year: "2007", BJP: 16.9, SP: 25.4, BSP: 30.4, INC: 8.6 },
  { year: "2012", BJP: 15.0, SP: 29.1, BSP: 25.9, INC: 11.6 },
  { year: "2017", BJP: 39.7, SP: 21.8, BSP: 22.2, INC: 6.2 },
  { year: "2022", BJP: 41.3, SP: 32.1, BSP: 12.9, INC: 2.3 },
];

const COLORS: Record<string, string> = { BJP: "#F97316", SP: "#22C55E", BSP: "#1E3A8A", INC: "#3B82F6", Others: "#94A3B8" };

export default function TrendsPage() {
  return (
    <div className="p-8 max-w-[1920px] mx-auto min-h-screen space-y-6">
      <PageHeader
        title="Historical Trends"
        description="Long-term electoral patterns from 2002 to 2022 — five election cycles of seat and vote share data."
        breadcrumbs={[{ label: "Home", href: "/" }, { label: "Analytics Lab" }, { label: "Historical Trends" }]}
        action={<button className="px-4 py-2 bg-[var(--accent-primary)] text-[var(--bg-app)] hover:bg-[var(--accent-primary-hover)] rounded-lg text-sm font-medium transition-colors flex items-center gap-2"><Download className="w-4 h-4" /> Export</button>}
      />

      <PremiumCard className="p-6 h-[450px] flex flex-col">
        <h2 className="text-lg font-serif font-bold text-[var(--text-primary)] mb-4">Seat Tally Trend (2002–2022)</h2>
        <div className="flex-1 w-full min-h-0">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={seatTrend} margin={{ top: 10, right: 30, left: -20, bottom: 0 }}>
              <defs>
                {Object.entries(COLORS).map(([key, color]) => (
                  <linearGradient key={key} id={`grad-${key}`} x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor={color} stopOpacity={0.3} />
                    <stop offset="95%" stopColor={color} stopOpacity={0} />
                  </linearGradient>
                ))}
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--border-subtle)" vertical={false} />
              <XAxis dataKey="year" stroke="var(--text-secondary)" tick={{ fill: 'var(--text-secondary)', fontSize: 12 }} axisLine={false} tickLine={false} />
              <YAxis stroke="var(--text-secondary)" tick={{ fill: 'var(--text-secondary)', fontSize: 12 }} axisLine={false} tickLine={false} />
              <Tooltip contentStyle={{ backgroundColor: 'var(--bg-surface)', border: '1px solid var(--border-subtle)', borderRadius: '8px', color: 'var(--text-primary)' }} />
              <Legend iconType="circle" wrapperStyle={{ fontSize: '12px' }} />
              {Object.keys(COLORS).map(key => (
                <Area key={key} type="monotone" dataKey={key} stroke={COLORS[key]} fill={`url(#grad-${key})`} strokeWidth={2} />
              ))}
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </PremiumCard>

      <PremiumCard className="p-6 h-[450px] flex flex-col">
        <h2 className="text-lg font-serif font-bold text-[var(--text-primary)] mb-4">Vote Share Trend (2002–2022)</h2>
        <div className="flex-1 w-full min-h-0">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={voteShareTrend} margin={{ top: 10, right: 30, left: -20, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--border-subtle)" vertical={false} />
              <XAxis dataKey="year" stroke="var(--text-secondary)" tick={{ fill: 'var(--text-secondary)', fontSize: 12 }} axisLine={false} tickLine={false} />
              <YAxis stroke="var(--text-secondary)" tick={{ fill: 'var(--text-secondary)', fontSize: 12 }} axisLine={false} tickLine={false} tickFormatter={(v) => `${v}%`} />
              <Tooltip contentStyle={{ backgroundColor: 'var(--bg-surface)', border: '1px solid var(--border-subtle)', borderRadius: '8px', color: 'var(--text-primary)' }} />
              <Legend iconType="circle" wrapperStyle={{ fontSize: '12px' }} />
              {Object.entries(COLORS).filter(([k]) => k !== 'Others').map(([key, color]) => (
                <Line key={key} type="monotone" dataKey={key} stroke={color} strokeWidth={3} dot={{ fill: color, r: 5 }} activeDot={{ r: 8 }} />
              ))}
            </LineChart>
          </ResponsiveContainer>
        </div>
      </PremiumCard>

      <PremiumCard className="p-6">
        <h2 className="text-lg font-serif font-bold text-[var(--text-primary)] mb-4">Key Historical Insights</h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {[
            { title: "BJP's Meteoric Rise", desc: "From 51 seats in 2007 to 312 in 2017 — a 6x increase in just two election cycles, driven by Modi wave.", tag: "Structural Shift" },
            { title: "BSP's Collapse", desc: "From 206 seats in 2007 (majority) to 1 seat in 2022 — the most dramatic decline in UP electoral history.", tag: "Critical Decline" },
            { title: "SP's Consolidation", desc: "SP's vote share grew 10% between 2017-2022, indicating the opposition consolidation against BJP.", tag: "Opposition Trend" },
          ].map((insight) => (
            <div key={insight.title} className="p-4 rounded-xl bg-[var(--bg-app)] border border-[var(--border-subtle)]">
              <div className="flex items-center justify-between mb-2">
                <h4 className="text-sm font-semibold text-[var(--text-primary)]">{insight.title}</h4>
                <span className="text-[10px] font-medium px-2 py-1 bg-[var(--accent-primary)]/10 text-[var(--accent-primary)] rounded">{insight.tag}</span>
              </div>
              <p className="text-sm text-[var(--text-secondary)] leading-relaxed">{insight.desc}</p>
            </div>
          ))}
        </div>
      </PremiumCard>
    </div>
  );
}
