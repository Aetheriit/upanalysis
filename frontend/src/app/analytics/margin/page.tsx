"use client";

import React from "react";
import { PageHeader } from "@/components/layout/page-header";
import { PremiumCard } from "@/components/ds/premium-card";
import { Download, Target, AlertTriangle, ShieldCheck } from "lucide-react";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from "recharts";

const marginDistribution = [
  { range: "0-1K", count: 18, label: "Razor Thin" },
  { range: "1K-5K", count: 45, label: "Close" },
  { range: "5K-10K", count: 62, label: "Competitive" },
  { range: "10K-25K", count: 98, label: "Comfortable" },
  { range: "25K-50K", count: 112, label: "Strong" },
  { range: "50K+", count: 68, label: "Dominant" },
];

const closeContests = [
  { constituency: "Meerapur", winner: "BJP", runnerUp: "RLD", margin: 1046, turnout: "71.2%" },
  { constituency: "Siwalkhas", winner: "BJP", runnerUp: "SP", margin: 1232, turnout: "68.4%" },
  { constituency: "Charthawal", winner: "SP", runnerUp: "BJP", margin: 1567, turnout: "72.1%" },
  { constituency: "Khatauli", winner: "SP", runnerUp: "BJP", margin: 1845, turnout: "69.8%" },
  { constituency: "Budhana", winner: "RLD", runnerUp: "BJP", margin: 2112, turnout: "74.2%" },
  { constituency: "Purqazi", winner: "SP", runnerUp: "BJP", margin: 2456, turnout: "67.5%" },
  { constituency: "Muzaffarnagar", winner: "BJP", runnerUp: "SP", margin: 2789, turnout: "65.3%" },
  { constituency: "Loni", winner: "BJP", runnerUp: "SP", margin: 3012, turnout: "58.9%" },
  { constituency: "Dhaulana", winner: "SP", runnerUp: "BJP", margin: 3234, turnout: "70.1%" },
  { constituency: "Hapur", winner: "BJP", runnerUp: "SP", margin: 3567, turnout: "63.7%" },
];

const partyColor: Record<string, string> = { BJP: "#F97316", SP: "#EF4444", BSP: "#2563EB", RLD: "#EAB308" };

export default function MarginPage() {
  return (
    <div className="p-8 max-w-[1920px] mx-auto min-h-screen space-y-6">
      <PageHeader
        title="Margin Analysis"
        description="Victory margins, close contest tracking, and vulnerability assessment across 403 constituencies."
        breadcrumbs={[{ label: "Home", href: "/" }, { label: "Analytics Lab" }, { label: "Margin Analysis" }]}
        action={<button className="px-4 py-2 bg-[var(--accent-primary)] text-[var(--bg-app)] hover:bg-[var(--accent-primary-hover)] rounded-lg text-sm font-medium transition-colors flex items-center gap-2"><Download className="w-4 h-4" /> Export</button>}
      />

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <PremiumCard padding="sm" className="text-center">
          <Target className="w-5 h-5 text-rose-500 mx-auto mb-2" />
          <div className="text-2xl font-bold text-[var(--text-primary)]">1,046</div>
          <div className="text-xs text-[var(--text-secondary)]">Smallest Margin (Meerapur)</div>
        </PremiumCard>
        <PremiumCard padding="sm" className="text-center">
          <ShieldCheck className="w-5 h-5 text-emerald-500 mx-auto mb-2" />
          <div className="text-2xl font-bold text-[var(--text-primary)]">1,06,453</div>
          <div className="text-xs text-[var(--text-secondary)]">Largest Margin (Karhal)</div>
        </PremiumCard>
        <PremiumCard padding="sm" className="text-center">
          <AlertTriangle className="w-5 h-5 text-amber-500 mx-auto mb-2" />
          <div className="text-2xl font-bold text-[var(--text-primary)]">63</div>
          <div className="text-xs text-[var(--text-secondary)]">Close Contests (&lt;5K)</div>
        </PremiumCard>
        <PremiumCard padding="sm" className="text-center">
          <Target className="w-5 h-5 text-[var(--accent-primary)] mx-auto mb-2" />
          <div className="text-2xl font-bold text-[var(--text-primary)]">18,456</div>
          <div className="text-xs text-[var(--text-secondary)]">Avg Winning Margin</div>
        </PremiumCard>
      </div>

      <PremiumCard className="p-6 h-[400px] flex flex-col">
        <h2 className="text-lg font-serif font-bold text-[var(--text-primary)] mb-4">Margin Distribution (2022)</h2>
        <div className="flex-1 w-full min-h-0">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={marginDistribution} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--border-subtle)" vertical={false} />
              <XAxis dataKey="range" stroke="var(--text-secondary)" tick={{ fill: 'var(--text-secondary)', fontSize: 12 }} axisLine={false} tickLine={false} />
              <YAxis stroke="var(--text-secondary)" tick={{ fill: 'var(--text-secondary)', fontSize: 12 }} axisLine={false} tickLine={false} />
              <Tooltip contentStyle={{ backgroundColor: 'var(--bg-surface)', border: '1px solid var(--border-subtle)', borderRadius: '8px', color: 'var(--text-primary)' }} />
              <Bar dataKey="count" fill="#D4AF37" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </PremiumCard>

      <PremiumCard className="p-0 overflow-hidden">
        <div className="p-4 border-b border-[var(--border-subtle)]">
          <h2 className="text-lg font-serif font-bold text-[var(--text-primary)]">Closest Contests (2022)</h2>
          <p className="text-xs text-[var(--text-secondary)]">Constituencies with winning margin under 5,000 votes</p>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-[var(--bg-app)]/50 border-b border-[var(--border-subtle)]">
                {["#", "Constituency", "Winner", "Runner-Up", "Margin", "Turnout"].map(h => (
                  <th key={h} className="px-6 py-3 text-xs font-semibold text-[var(--text-secondary)] uppercase tracking-wider whitespace-nowrap">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--border-subtle)]">
              {closeContests.map((c, i) => (
                <tr key={c.constituency} className="hover:bg-[var(--bg-app)]/30 transition-colors">
                  <td className="px-6 py-4 text-sm font-bold text-[var(--text-tertiary)]">{i + 1}</td>
                  <td className="px-6 py-4 text-sm font-semibold text-[var(--text-primary)]">{c.constituency}</td>
                  <td className="px-6 py-4"><span className="px-2 py-1 rounded text-xs font-bold" style={{ backgroundColor: `${partyColor[c.winner]}20`, color: partyColor[c.winner] }}>{c.winner}</span></td>
                  <td className="px-6 py-4"><span className="px-2 py-1 rounded text-xs font-bold" style={{ backgroundColor: `${partyColor[c.runnerUp]}20`, color: partyColor[c.runnerUp] }}>{c.runnerUp}</span></td>
                  <td className="px-6 py-4 text-sm font-mono font-bold text-rose-500">{c.margin.toLocaleString()}</td>
                  <td className="px-6 py-4 text-sm font-mono text-[var(--text-primary)]">{c.turnout}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </PremiumCard>
    </div>
  );
}
