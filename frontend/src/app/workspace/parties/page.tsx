"use client";

import React from "react";
import { PageHeader } from "@/components/layout/page-header";
import { PremiumCard } from "@/components/ds/premium-card";
import { Search, Download, MoreHorizontal, Flag } from "lucide-react";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from "recharts";

const PARTIES = [
  { name: "BJP", fullName: "Bharatiya Janata Party", seats2017: 312, seats2022: 255, voteShare2022: "41.3%", color: "#F97316", allies: "Apna Dal, NISHAD" },
  { name: "SP", fullName: "Samajwadi Party", seats2017: 47, seats2022: 111, voteShare2022: "32.1%", color: "#EF4444", allies: "RLD, SBSP, Mahan Dal" },
  { name: "BSP", fullName: "Bahujan Samaj Party", seats2017: 19, seats2022: 1, voteShare2022: "12.9%", color: "#2563EB", allies: "None" },
  { name: "INC", fullName: "Indian National Congress", seats2017: 7, seats2022: 2, voteShare2022: "2.3%", color: "#22C55E", allies: "None" },
  { name: "RLD", fullName: "Rashtriya Lok Dal", seats2017: 1, seats2022: 8, voteShare2022: "2.8%", color: "#EAB308", allies: "SP Alliance" },
  { name: "AIMIM", fullName: "All India MIM", seats2017: 0, seats2022: 0, voteShare2022: "0.4%", color: "#06B6D4", allies: "None" },
];

const seatData = PARTIES.map(p => ({ name: p.name, "2017": p.seats2017, "2022": p.seats2022 }));
const pieData = PARTIES.filter(p => p.seats2022 > 0).map(p => ({ name: p.name, value: p.seats2022, color: p.color }));

export default function PartiesPage() {
  return (
    <div className="p-8 max-w-[1920px] mx-auto min-h-screen space-y-6">
      <PageHeader
        title="Political Parties"
        description="Party performance, alliances, vote share footprint, and historical trajectory."
        breadcrumbs={[{ label: "Home", href: "/" }, { label: "Workspace" }, { label: "Parties" }]}
        action={<button className="px-4 py-2 bg-[var(--accent-primary)] text-[var(--bg-app)] hover:bg-[var(--accent-primary-hover)] rounded-lg text-sm font-medium transition-colors flex items-center gap-2"><Download className="w-4 h-4" /> Export</button>}
      />

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Seat Comparison */}
        <PremiumCard className="p-6 lg:col-span-8 h-[400px] flex flex-col">
          <h2 className="text-lg font-serif font-bold text-[var(--text-primary)] mb-4">Seat Comparison (2017 vs 2022)</h2>
          <div className="flex-1 w-full min-h-0">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={seatData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border-subtle)" vertical={false} />
                <XAxis dataKey="name" stroke="var(--text-secondary)" tick={{ fill: 'var(--text-secondary)', fontSize: 12 }} axisLine={false} tickLine={false} />
                <YAxis stroke="var(--text-secondary)" tick={{ fill: 'var(--text-secondary)', fontSize: 12 }} axisLine={false} tickLine={false} />
                <Tooltip contentStyle={{ backgroundColor: 'var(--bg-surface)', border: '1px solid var(--border-subtle)', borderRadius: '8px', color: 'var(--text-primary)' }} />
                <Bar dataKey="2017" fill="#D4AF37" fillOpacity={0.4} radius={[4, 4, 0, 0]} />
                <Bar dataKey="2022" fill="#D4AF37" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </PremiumCard>

        {/* Seat Share Pie */}
        <PremiumCard className="p-6 lg:col-span-4 h-[400px] flex flex-col">
          <h2 className="text-lg font-serif font-bold text-[var(--text-primary)] mb-4">2022 Seat Share</h2>
          <div className="flex-1 w-full min-h-0 relative">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie data={pieData} cx="50%" cy="50%" innerRadius={50} outerRadius={80} stroke="none" dataKey="value" label={({ name, value }) => `${name}: ${value}`}>
                  {pieData.map((entry, i) => <Cell key={i} fill={entry.color} />)}
                </Pie>
                <Tooltip contentStyle={{ backgroundColor: 'var(--bg-surface)', border: '1px solid var(--border-subtle)', borderRadius: '8px', color: 'var(--text-primary)' }} />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </PremiumCard>
      </div>

      {/* Party Table */}
      <PremiumCard className="p-0 overflow-hidden">
        <div className="p-4 border-b border-[var(--border-subtle)]">
          <div className="relative w-[300px]">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--text-tertiary)]" />
            <input type="text" placeholder="Search parties..." className="w-full pl-9 pr-4 py-2 bg-[var(--bg-app)] border border-[var(--border-subtle)] rounded-lg text-sm focus:outline-none focus:ring-1 focus:ring-[var(--accent-primary)] text-[var(--text-primary)]" />
          </div>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-[var(--bg-app)]/50 border-b border-[var(--border-subtle)]">
                {["Party", "Full Name", "Seats '17", "Seats '22", "Change", "Vote Share '22", "Alliance Partners"].map(h => (
                  <th key={h} className="px-6 py-3 text-xs font-semibold text-[var(--text-secondary)] uppercase tracking-wider whitespace-nowrap">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--border-subtle)]">
              {PARTIES.map(p => (
                <tr key={p.name} className="hover:bg-[var(--bg-app)]/30 transition-colors">
                  <td className="px-6 py-4"><span className="inline-flex items-center gap-2"><span className="w-3 h-3 rounded-full" style={{ backgroundColor: p.color }} /><span className="text-sm font-bold text-[var(--text-primary)]">{p.name}</span></span></td>
                  <td className="px-6 py-4 text-sm text-[var(--text-secondary)]">{p.fullName}</td>
                  <td className="px-6 py-4 text-sm font-mono text-[var(--text-primary)] text-center">{p.seats2017}</td>
                  <td className="px-6 py-4 text-sm font-mono font-bold text-[var(--text-primary)] text-center">{p.seats2022}</td>
                  <td className="px-6 py-4 text-sm font-medium text-center">
                    <span className={p.seats2022 > p.seats2017 ? "text-emerald-500" : "text-rose-500"}>
                      {p.seats2022 > p.seats2017 ? "↑" : "↓"} {Math.abs(p.seats2022 - p.seats2017)}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-sm font-mono text-[var(--text-primary)] text-center">{p.voteShare2022}</td>
                  <td className="px-6 py-4 text-sm text-[var(--text-secondary)]">{p.allies}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </PremiumCard>
    </div>
  );
}
