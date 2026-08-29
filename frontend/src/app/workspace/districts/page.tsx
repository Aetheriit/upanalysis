"use client";

import React from "react";
import { PageHeader } from "@/components/layout/page-header";
import { PremiumCard } from "@/components/ds/premium-card";
import { Search, Download, ArrowUpDown, MoreHorizontal, Users, TrendingUp, MapPin } from "lucide-react";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";

const DISTRICTS = [
  { name: "Lucknow", constituencies: 9, turnout2017: "57.2%", turnout2022: "59.8%", bjp: 7, sp: 2, swing: "+2.6%", population: "45.9L" },
  { name: "Varanasi", constituencies: 8, turnout2017: "55.1%", turnout2022: "58.4%", bjp: 6, sp: 2, swing: "+3.3%", population: "36.8L" },
  { name: "Allahabad", constituencies: 12, turnout2017: "52.3%", turnout2022: "56.1%", bjp: 8, sp: 3, swing: "+3.8%", population: "59.5L" },
  { name: "Agra", constituencies: 9, turnout2017: "60.4%", turnout2022: "62.1%", bjp: 7, sp: 1, swing: "+1.7%", population: "44.2L" },
  { name: "Meerut", constituencies: 7, turnout2017: "63.8%", turnout2022: "65.2%", bjp: 4, sp: 2, swing: "+1.4%", population: "34.4L" },
  { name: "Gorakhpur", constituencies: 9, turnout2017: "54.6%", turnout2022: "57.9%", bjp: 7, sp: 2, swing: "+3.3%", population: "44.4L" },
  { name: "Kanpur Nagar", constituencies: 9, turnout2017: "51.2%", turnout2022: "54.8%", bjp: 6, sp: 3, swing: "+3.6%", population: "45.8L" },
  { name: "Bareilly", constituencies: 7, turnout2017: "58.9%", turnout2022: "61.3%", bjp: 5, sp: 2, swing: "+2.4%", population: "44.5L" },
  { name: "Moradabad", constituencies: 6, turnout2017: "62.1%", turnout2022: "64.7%", bjp: 2, sp: 4, swing: "+2.6%", population: "47.7L" },
  { name: "Saharanpur", constituencies: 7, turnout2017: "69.5%", turnout2022: "71.2%", bjp: 3, sp: 3, swing: "+1.7%", population: "34.6L" },
];

const turnoutComparison = [
  { name: "Lucknow", "2017": 57.2, "2022": 59.8 },
  { name: "Varanasi", "2017": 55.1, "2022": 58.4 },
  { name: "Allahabad", "2017": 52.3, "2022": 56.1 },
  { name: "Agra", "2017": 60.4, "2022": 62.1 },
  { name: "Meerut", "2017": 63.8, "2022": 65.2 },
  { name: "Gorakhpur", "2017": 54.6, "2022": 57.9 },
];

export default function DistrictsPage() {
  return (
    <div className="p-8 max-w-[1920px] mx-auto min-h-screen space-y-6">
      <PageHeader
        title="Districts"
        description="District-level aggregations, demographics, and comparative turnout analysis across 75 districts."
        breadcrumbs={[
          { label: "Home", href: "/" },
          { label: "Workspace" },
          { label: "Districts" }
        ]}
        action={
          <button className="px-4 py-2 bg-[var(--accent-primary)] text-[var(--bg-app)] hover:bg-[var(--accent-primary-hover)] rounded-lg text-sm font-medium transition-colors flex items-center gap-2">
            <Download className="w-4 h-4" /> Export
          </button>
        }
      />

      {/* KPI Row */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <PremiumCard padding="sm" className="text-center">
          <MapPin className="w-5 h-5 text-[var(--accent-primary)] mx-auto mb-2" />
          <div className="text-2xl font-bold text-[var(--text-primary)]">75</div>
          <div className="text-xs text-[var(--text-secondary)]">Total Districts</div>
        </PremiumCard>
        <PremiumCard padding="sm" className="text-center">
          <Users className="w-5 h-5 text-blue-500 mx-auto mb-2" />
          <div className="text-2xl font-bold text-[var(--text-primary)]">15.02 Cr</div>
          <div className="text-xs text-[var(--text-secondary)]">Total Voters (2022)</div>
        </PremiumCard>
        <PremiumCard padding="sm" className="text-center">
          <TrendingUp className="w-5 h-5 text-emerald-500 mx-auto mb-2" />
          <div className="text-2xl font-bold text-[var(--text-primary)]">61.65%</div>
          <div className="text-xs text-[var(--text-secondary)]">Avg Turnout 2022</div>
        </PremiumCard>
        <PremiumCard padding="sm" className="text-center">
          <TrendingUp className="w-5 h-5 text-rose-500 mx-auto mb-2" />
          <div className="text-2xl font-bold text-emerald-500">+1.58%</div>
          <div className="text-xs text-[var(--text-secondary)]">Turnout Change</div>
        </PremiumCard>
      </div>

      {/* Chart */}
      <PremiumCard className="p-6 h-[350px] flex flex-col">
        <h2 className="text-lg font-serif font-bold text-[var(--text-primary)] mb-4">District Turnout Comparison (2017 vs 2022)</h2>
        <div className="flex-1 w-full min-h-0">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={turnoutComparison} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--border-subtle)" vertical={false} />
              <XAxis dataKey="name" stroke="var(--text-secondary)" tick={{ fill: 'var(--text-secondary)', fontSize: 12 }} axisLine={false} tickLine={false} />
              <YAxis stroke="var(--text-secondary)" tick={{ fill: 'var(--text-secondary)', fontSize: 12 }} axisLine={false} tickLine={false} domain={[45, 70]} tickFormatter={(v) => `${v}%`} />
              <Tooltip contentStyle={{ backgroundColor: 'var(--bg-surface)', border: '1px solid var(--border-subtle)', borderRadius: '8px', color: 'var(--text-primary)' }} />
              <Bar dataKey="2017" fill="#D4AF37" fillOpacity={0.5} radius={[4, 4, 0, 0]} />
              <Bar dataKey="2022" fill="#D4AF37" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </PremiumCard>

      {/* Table */}
      <PremiumCard className="p-0 overflow-hidden">
        <div className="p-4 border-b border-[var(--border-subtle)] flex items-center justify-between">
          <div className="relative w-[300px]">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--text-tertiary)]" />
            <input type="text" placeholder="Search districts..." className="w-full pl-9 pr-4 py-2 bg-[var(--bg-app)] border border-[var(--border-subtle)] rounded-lg text-sm focus:outline-none focus:ring-1 focus:ring-[var(--accent-primary)] text-[var(--text-primary)]" />
          </div>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-[var(--bg-app)]/50 border-b border-[var(--border-subtle)]">
                {["District", "Constituencies", "Population", "Turnout '17", "Turnout '22", "Swing", "BJP Seats", "SP Seats"].map(h => (
                  <th key={h} className="px-6 py-3 text-xs font-semibold text-[var(--text-secondary)] uppercase tracking-wider whitespace-nowrap">{h}</th>
                ))}
                <th className="px-6 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--border-subtle)]">
              {DISTRICTS.map(d => (
                <tr key={d.name} className="hover:bg-[var(--bg-app)]/30 transition-colors group">
                  <td className="px-6 py-4 text-sm font-semibold text-[var(--text-primary)]">{d.name}</td>
                  <td className="px-6 py-4 text-sm text-[var(--text-secondary)] text-center">{d.constituencies}</td>
                  <td className="px-6 py-4 text-sm text-[var(--text-secondary)]">{d.population}</td>
                  <td className="px-6 py-4 text-sm font-mono text-[var(--text-primary)]">{d.turnout2017}</td>
                  <td className="px-6 py-4 text-sm font-mono text-[var(--text-primary)]">{d.turnout2022}</td>
                  <td className="px-6 py-4 text-sm font-medium text-emerald-500">{d.swing}</td>
                  <td className="px-6 py-4"><span className="px-2 py-1 rounded text-xs font-bold bg-[#F97316]/10 text-[#F97316]">{d.bjp}</span></td>
                  <td className="px-6 py-4"><span className="px-2 py-1 rounded text-xs font-bold bg-[#EF4444]/10 text-[#EF4444]">{d.sp}</span></td>
                  <td className="px-6 py-4 text-right"><button className="p-1.5 text-[var(--text-tertiary)] hover:text-[var(--text-primary)] rounded-md hover:bg-[var(--bg-app)] transition-colors opacity-0 group-hover:opacity-100"><MoreHorizontal className="w-5 h-5" /></button></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="p-4 border-t border-[var(--border-subtle)] flex items-center justify-between text-sm text-[var(--text-secondary)]">
          <span>Showing 1 to 10 of 75 districts</span>
          <div className="flex items-center gap-2">
            <button className="px-3 py-1.5 border border-[var(--border-subtle)] rounded hover:bg-[var(--bg-app)] transition-colors disabled:opacity-50" disabled>Previous</button>
            <button className="px-3 py-1.5 border border-[var(--border-subtle)] rounded bg-[var(--accent-primary)] text-[var(--bg-app)] font-medium">1</button>
            <button className="px-3 py-1.5 border border-[var(--border-subtle)] rounded hover:bg-[var(--bg-app)] transition-colors">2</button>
            <button className="px-3 py-1.5 border border-[var(--border-subtle)] rounded hover:bg-[var(--bg-app)] transition-colors">Next</button>
          </div>
        </div>
      </PremiumCard>
    </div>
  );
}
