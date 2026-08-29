"use client";

import React from "react";
import { PageHeader } from "@/components/layout/page-header";
import { PremiumCard } from "@/components/ds/premium-card";
import { Download, ArrowRightLeft, TrendingUp, AlertTriangle } from "lucide-react";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ScatterChart, Scatter, ZAxis, Cell } from "recharts";

const swingData = [
  { constituency: "Phulpur", swing: 28.6, from: "SP", to: "BJP" },
  { constituency: "Prayagraj South", swing: 24.1, from: "BSP", to: "SP" },
  { constituency: "Kannauj", swing: 22.8, from: "BJP", to: "SP" },
  { constituency: "Azamgarh", swing: 21.5, from: "BJP", to: "SP" },
  { constituency: "Sultanpur", swing: 19.7, from: "SP", to: "BJP" },
  { constituency: "Amethi", swing: 18.4, from: "BJP", to: "SP" },
  { constituency: "Gorakhpur Rural", swing: 17.2, from: "SP", to: "BJP" },
  { constituency: "Mainpuri", swing: 16.9, from: "BJP", to: "SP" },
  { constituency: "Etawah", swing: 15.3, from: "BSP", to: "SP" },
  { constituency: "Basti", swing: 14.8, from: "SP", to: "BJP" },
];

const swingDistribution = [
  { range: "0-5%", toBJP: 45, toSP: 32, toBSP: 5, toOthers: 8 },
  { range: "5-10%", toBJP: 38, toSP: 28, toBSP: 2, toOthers: 4 },
  { range: "10-15%", toBJP: 22, toSP: 35, toBSP: 1, toOthers: 2 },
  { range: "15-20%", toBJP: 12, toSP: 18, toBSP: 0, toOthers: 1 },
  { range: "20%+", toBJP: 5, toSP: 8, toBSP: 0, toOthers: 0 },
];

export default function SwingPage() {
  return (
    <div className="p-8 max-w-[1920px] mx-auto min-h-screen space-y-6">
      <PageHeader
        title="Swing Analysis"
        description="Identify voting shifts, momentum changes, and constituency-level swing patterns between 2017 and 2022."
        breadcrumbs={[{ label: "Home", href: "/" }, { label: "Analytics Lab" }, { label: "Swing Analysis" }]}
        action={<button className="px-4 py-2 bg-[var(--accent-primary)] text-[var(--bg-app)] hover:bg-[var(--accent-primary-hover)] rounded-lg text-sm font-medium transition-colors flex items-center gap-2"><Download className="w-4 h-4" /> Export Report</button>}
      />

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <PremiumCard padding="sm" className="text-center">
          <ArrowRightLeft className="w-5 h-5 text-[var(--accent-primary)] mx-auto mb-2" />
          <div className="text-2xl font-bold text-[var(--text-primary)]">97</div>
          <div className="text-xs text-[var(--text-secondary)]">Seats Changed Hands</div>
        </PremiumCard>
        <PremiumCard padding="sm" className="text-center">
          <TrendingUp className="w-5 h-5 text-[#F97316] mx-auto mb-2" />
          <div className="text-2xl font-bold text-[var(--text-primary)]">28.6%</div>
          <div className="text-xs text-[var(--text-secondary)]">Max Swing (Phulpur)</div>
        </PremiumCard>
        <PremiumCard padding="sm" className="text-center">
          <TrendingUp className="w-5 h-5 text-emerald-500 mx-auto mb-2" />
          <div className="text-2xl font-bold text-[var(--text-primary)]">8.4%</div>
          <div className="text-xs text-[var(--text-secondary)]">Avg Swing</div>
        </PremiumCard>
        <PremiumCard padding="sm" className="text-center">
          <AlertTriangle className="w-5 h-5 text-amber-500 mx-auto mb-2" />
          <div className="text-2xl font-bold text-[var(--text-primary)]">143</div>
          <div className="text-xs text-[var(--text-secondary)]">High Swing (&gt;10%)</div>
        </PremiumCard>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <PremiumCard className="p-6 h-[420px] flex flex-col">
          <h2 className="text-lg font-serif font-bold text-[var(--text-primary)] mb-4">Swing Distribution by Party</h2>
          <div className="flex-1 w-full min-h-0">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={swingDistribution} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border-subtle)" vertical={false} />
                <XAxis dataKey="range" stroke="var(--text-secondary)" tick={{ fill: 'var(--text-secondary)', fontSize: 12 }} axisLine={false} tickLine={false} />
                <YAxis stroke="var(--text-secondary)" tick={{ fill: 'var(--text-secondary)', fontSize: 12 }} axisLine={false} tickLine={false} />
                <Tooltip contentStyle={{ backgroundColor: 'var(--bg-surface)', border: '1px solid var(--border-subtle)', borderRadius: '8px', color: 'var(--text-primary)' }} />
                <Bar dataKey="toBJP" name="To BJP" fill="#F97316" radius={[4, 4, 0, 0]} stackId="a" />
                <Bar dataKey="toSP" name="To SP" fill="#EF4444" radius={[0, 0, 0, 0]} stackId="a" />
                <Bar dataKey="toBSP" name="To BSP" fill="#2563EB" radius={[0, 0, 0, 0]} stackId="a" />
                <Bar dataKey="toOthers" name="To Others" fill="#94A3B8" radius={[4, 4, 0, 0]} stackId="a" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </PremiumCard>

        <PremiumCard className="p-6 h-[420px] flex flex-col">
          <h2 className="text-lg font-serif font-bold text-[var(--text-primary)] mb-4">Top 10 Swing Constituencies</h2>
          <div className="flex-1 overflow-y-auto space-y-3 pr-2">
            {swingData.map((s, i) => (
              <div key={s.constituency} className="flex items-center gap-4 p-3 rounded-xl bg-[var(--bg-app)] border border-[var(--border-subtle)]">
                <span className="text-lg font-bold text-[var(--text-tertiary)] w-8 text-center">#{i + 1}</span>
                <div className="flex-1">
                  <div className="text-sm font-semibold text-[var(--text-primary)]">{s.constituency}</div>
                  <div className="text-xs text-[var(--text-secondary)]">{s.from} → {s.to}</div>
                </div>
                <span className="text-lg font-bold text-rose-500">{s.swing}%</span>
              </div>
            ))}
          </div>
        </PremiumCard>
      </div>
    </div>
  );
}
