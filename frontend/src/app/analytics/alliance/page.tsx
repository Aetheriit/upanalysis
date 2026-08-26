"use client";

import React from "react";
import { PageHeader } from "@/components/layout/page-header";
import { PremiumCard } from "@/components/ds/premium-card";
import { Download, Users, Handshake } from "lucide-react";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from "recharts";

const allianceImpact = [
  { region: "Western UP", bjpAlone: 38.2, bjpAlliance: 43.1, spAlone: 28.5, spAlliance: 38.4 },
  { region: "Purvanchal", bjpAlone: 35.1, bjpAlliance: 39.5, spAlone: 25.8, spAlliance: 35.8 },
  { region: "Awadh", bjpAlone: 37.5, bjpAlliance: 41.8, spAlone: 27.2, spAlliance: 33.2 },
  { region: "Bundelkhand", bjpAlone: 40.2, bjpAlliance: 46.5, spAlone: 22.1, spAlliance: 28.4 },
  { region: "Rohilkhand", bjpAlone: 34.8, bjpAlliance: 40.1, spAlone: 32.5, spAlliance: 41.5 },
];

const alliancePartners = [
  { mainParty: "BJP", ally: "Apna Dal (S)", seatsContested: 17, seatsWon: 12, voteShare: "1.8%", impactSeats: 14 },
  { mainParty: "BJP", ally: "NISHAD Party", seatsContested: 16, seatsWon: 6, voteShare: "1.2%", impactSeats: 22 },
  { mainParty: "SP", ally: "RLD", seatsContested: 33, seatsWon: 8, voteShare: "2.8%", impactSeats: 28 },
  { mainParty: "SP", ally: "SBSP", seatsContested: 17, seatsWon: 6, voteShare: "1.4%", impactSeats: 18 },
  { mainParty: "SP", ally: "Mahan Dal", seatsContested: 7, seatsWon: 0, voteShare: "0.3%", impactSeats: 4 },
  { mainParty: "SP", ally: "PSPL", seatsContested: 2, seatsWon: 1, voteShare: "0.1%", impactSeats: 2 },
];

const partyColor: Record<string, string> = { BJP: "#F97316", SP: "#22C55E" };

export default function AlliancePage() {
  return (
    <div className="p-8 max-w-[1920px] mx-auto min-h-screen space-y-6">
      <PageHeader
        title="Alliance Impact Analysis"
        description="Simulate and analyze pre/post poll alliance effects on seat tallies and vote shares."
        breadcrumbs={[{ label: "Home", href: "/" }, { label: "Analytics Lab" }, { label: "Alliance Impact" }]}
        action={<button className="px-4 py-2 bg-[var(--accent-primary)] text-[var(--bg-app)] hover:bg-[var(--accent-primary-hover)] rounded-lg text-sm font-medium transition-colors flex items-center gap-2"><Download className="w-4 h-4" /> Export</button>}
      />

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <PremiumCard padding="sm" className="text-center">
          <Handshake className="w-5 h-5 text-[var(--accent-primary)] mx-auto mb-2" />
          <div className="text-2xl font-bold text-[var(--text-primary)]">6</div>
          <div className="text-xs text-[var(--text-secondary)]">Alliance Partners</div>
        </PremiumCard>
        <PremiumCard padding="sm" className="text-center">
          <Users className="w-5 h-5 text-[#F97316] mx-auto mb-2" />
          <div className="text-2xl font-bold text-[var(--text-primary)]">NDA: 273</div>
          <div className="text-xs text-[var(--text-secondary)]">Alliance Seats Won</div>
        </PremiumCard>
        <PremiumCard padding="sm" className="text-center">
          <Users className="w-5 h-5 text-[#22C55E] mx-auto mb-2" />
          <div className="text-2xl font-bold text-[var(--text-primary)]">INDIA: 126</div>
          <div className="text-xs text-[var(--text-secondary)]">Alliance Seats Won</div>
        </PremiumCard>
        <PremiumCard padding="sm" className="text-center">
          <Handshake className="w-5 h-5 text-emerald-500 mx-auto mb-2" />
          <div className="text-2xl font-bold text-[var(--text-primary)]">88</div>
          <div className="text-xs text-[var(--text-secondary)]">Alliance Impact Seats</div>
        </PremiumCard>
      </div>

      <PremiumCard className="p-6 h-[420px] flex flex-col">
        <h2 className="text-lg font-serif font-bold text-[var(--text-primary)] mb-4">Vote Share: Standalone vs Alliance</h2>
        <div className="flex-1 w-full min-h-0">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={allianceImpact} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--border-subtle)" vertical={false} />
              <XAxis dataKey="region" stroke="var(--text-secondary)" tick={{ fill: 'var(--text-secondary)', fontSize: 11 }} axisLine={false} tickLine={false} />
              <YAxis stroke="var(--text-secondary)" tick={{ fill: 'var(--text-secondary)', fontSize: 12 }} axisLine={false} tickLine={false} tickFormatter={(v) => `${v}%`} />
              <Tooltip contentStyle={{ backgroundColor: 'var(--bg-surface)', border: '1px solid var(--border-subtle)', borderRadius: '8px', color: 'var(--text-primary)' }} />
              <Legend iconType="circle" wrapperStyle={{ fontSize: '11px' }} />
              <Bar dataKey="bjpAlone" name="BJP Standalone" fill="#F97316" fillOpacity={0.4} radius={[4, 4, 0, 0]} />
              <Bar dataKey="bjpAlliance" name="NDA Alliance" fill="#F97316" radius={[4, 4, 0, 0]} />
              <Bar dataKey="spAlone" name="SP Standalone" fill="#22C55E" fillOpacity={0.4} radius={[4, 4, 0, 0]} />
              <Bar dataKey="spAlliance" name="INDIA Alliance" fill="#22C55E" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </PremiumCard>

      <PremiumCard className="p-0 overflow-hidden">
        <div className="p-4 border-b border-[var(--border-subtle)]">
          <h2 className="text-lg font-serif font-bold text-[var(--text-primary)]">Alliance Partner Performance</h2>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-[var(--bg-app)]/50 border-b border-[var(--border-subtle)]">
                {["Main Party", "Alliance Partner", "Seats Contested", "Seats Won", "Vote Share", "Impact Seats"].map(h => (
                  <th key={h} className="px-6 py-3 text-xs font-semibold text-[var(--text-secondary)] uppercase tracking-wider whitespace-nowrap">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--border-subtle)]">
              {alliancePartners.map(a => (
                <tr key={a.ally} className="hover:bg-[var(--bg-app)]/30 transition-colors">
                  <td className="px-6 py-4"><span className="px-2 py-1 rounded text-xs font-bold" style={{ backgroundColor: `${partyColor[a.mainParty]}20`, color: partyColor[a.mainParty] }}>{a.mainParty}</span></td>
                  <td className="px-6 py-4 text-sm font-semibold text-[var(--text-primary)]">{a.ally}</td>
                  <td className="px-6 py-4 text-sm font-mono text-[var(--text-primary)] text-center">{a.seatsContested}</td>
                  <td className="px-6 py-4 text-sm font-mono font-bold text-[var(--text-primary)] text-center">{a.seatsWon}</td>
                  <td className="px-6 py-4 text-sm font-mono text-[var(--text-primary)]">{a.voteShare}</td>
                  <td className="px-6 py-4 text-sm font-bold text-emerald-500 text-center">{a.impactSeats}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </PremiumCard>
    </div>
  );
}
