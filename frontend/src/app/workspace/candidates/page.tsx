"use client";

import React from "react";
import { PageHeader } from "@/components/layout/page-header";
import { PremiumCard } from "@/components/ds/premium-card";
import { Search, Download, MoreHorizontal, Users, Trophy, IndianRupee, Calendar } from "lucide-react";

import { useElectionContext } from "@/context/ElectionContext";

const CANDIDATES_2022 = [
  { name: "Akhilesh Yadav", party: "SP", constituency: "Karhal", district: "Mainpuri", result: "Won", margin: "67,504", voteShare: "64.2%", status: "Incumbent" },
  { name: "Yogi Adityanath", party: "BJP", constituency: "Gorakhpur Urban", district: "Gorakhpur", result: "Won", margin: "58,109", voteShare: "62.1%", status: "CM Candidate" },
  { name: "Swami Prasad Maurya", party: "SP", constituency: "Fazilnagar", district: "Kushinagar", result: "Lost", margin: "-7,337", voteShare: "44.8%", status: "Defector" },
  { name: "Keshav Prasad Maurya", party: "BJP", constituency: "Sirathu", district: "Kaushambi", result: "Lost", margin: "-7,644", voteShare: "45.1%", status: "Dy CM" },
  { name: "Azam Khan", party: "SP", constituency: "Rampur", district: "Rampur", result: "Won", margin: "55,164", voteShare: "58.7%", status: "Veteran" },
  { name: "Raghuraj Pratap Singh", party: "IND", constituency: "Kunda", district: "Pratapgarh", result: "Won", margin: "32,409", voteShare: "53.4%", status: "Independent" },
];

const CANDIDATES_2017 = [
  { name: "Akhilesh Yadav", party: "SP", constituency: "MLC", district: "N/A", result: "N/A", margin: "N/A", voteShare: "N/A", status: "CM" },
  { name: "Yogi Adityanath", party: "BJP", constituency: "MP", district: "Gorakhpur", result: "N/A", margin: "N/A", voteShare: "N/A", status: "MP" },
  { name: "Swami Prasad Maurya", party: "BJP", constituency: "Padrauna", district: "Kushinagar", result: "Won", margin: "40,552", voteShare: "52.3%", status: "Incumbent" },
  { name: "Keshav Prasad Maurya", party: "BJP", constituency: "MP", district: "Phulpur", result: "N/A", margin: "N/A", voteShare: "N/A", status: "MP" },
  { name: "Azam Khan", party: "SP", constituency: "Rampur", district: "Rampur", result: "Won", margin: "46,842", voteShare: "47.7%", status: "Veteran" },
];

const partyColor: Record<string, string> = { BJP: "#F97316", SP: "#EF4444", BSP: "#2563EB", INC: "#22C55E", AIMIM: "#06B6D4", IND: "#94A3B8" };

export default function CandidatesPage() {
  const { viewMode, isComparison, is2017 } = useElectionContext();
  
  const currentCandidates = is2017 && !isComparison ? CANDIDATES_2017 : CANDIDATES_2022;
  return (
    <div className="p-8 max-w-[1920px] mx-auto min-h-screen space-y-6">
      <PageHeader
        title="Candidates"
        description="Candidate profiles, historical performance, criminal records, and financial declarations."
        breadcrumbs={[{ label: "Home", href: "/" }, { label: "Workspace" }, { label: "Candidates" }]}
        action={<button className="px-4 py-2 bg-[var(--accent-primary)] text-[var(--bg-app)] hover:bg-[var(--accent-primary-hover)] rounded-lg text-sm font-medium transition-colors flex items-center gap-2"><Download className="w-4 h-4" /> Export</button>}
      />

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <PremiumCard padding="sm" className="text-center">
          <Users className="w-5 h-5 text-[var(--accent-primary)] mx-auto mb-2" />
          <div className="text-2xl font-bold text-[var(--text-primary)]">4,442</div>
          <div className="text-xs text-[var(--text-secondary)]">Total Candidates (2022)</div>
        </PremiumCard>
        <PremiumCard padding="sm" className="text-center">
          <Trophy className="w-5 h-5 text-emerald-500 mx-auto mb-2" />
          <div className="text-2xl font-bold text-[var(--text-primary)]">403</div>
          <div className="text-xs text-[var(--text-secondary)]">Winners</div>
        </PremiumCard>
        <PremiumCard padding="sm" className="text-center">
          <IndianRupee className="w-5 h-5 text-blue-500 mx-auto mb-2" />
          <div className="text-2xl font-bold text-[var(--text-primary)]">₹14.2 Cr</div>
          <div className="text-xs text-[var(--text-secondary)]">Avg Winner Asset</div>
        </PremiumCard>
        <PremiumCard padding="sm" className="text-center">
          <Calendar className="w-5 h-5 text-amber-500 mx-auto mb-2" />
          <div className="text-2xl font-bold text-[var(--text-primary)]">159</div>
          <div className="text-xs text-[var(--text-secondary)]">Repeat Winners</div>
        </PremiumCard>
      </div>

      <PremiumCard className="p-0 overflow-hidden">
        <div className="p-4 border-b border-[var(--border-subtle)] flex items-center justify-between">
          <div className="relative w-[320px]">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--text-tertiary)]" />
            <input type="text" placeholder="Search candidates..." className="w-full pl-9 pr-4 py-2 bg-[var(--bg-app)] border border-[var(--border-subtle)] rounded-lg text-sm focus:outline-none focus:ring-1 focus:ring-[var(--accent-primary)] text-[var(--text-primary)]" />
          </div>
          <div className="flex items-center gap-3">
            <select className="px-3 py-2 bg-[var(--bg-app)] border border-[var(--border-subtle)] rounded-lg text-sm font-medium text-[var(--text-primary)]">
              <option>All Parties</option><option>BJP</option><option>SP</option><option>BSP</option><option>INC</option>
            </select>
            <select className="px-3 py-2 bg-[var(--bg-app)] border border-[var(--border-subtle)] rounded-lg text-sm font-medium text-[var(--text-primary)]">
              <option>All Results</option><option>Won</option><option>Lost</option>
            </select>
          </div>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-[var(--bg-app)]/50 border-b border-[var(--border-subtle)]">
                {["Candidate", "Party", "Constituency", "District", "Result", "Margin", "Vote Share", "Status"].map(h => (
                  <th key={h} className="px-6 py-3 text-xs font-semibold text-[var(--text-secondary)] uppercase tracking-wider whitespace-nowrap">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--border-subtle)]">
              {currentCandidates.map(c => (
                <tr key={c.name} className="hover:bg-[var(--bg-app)]/30 transition-colors group">
                  <td className="px-6 py-4 text-sm font-semibold text-[var(--text-primary)]">{c.name}</td>
                  <td className="px-6 py-4"><span className="px-2 py-1 rounded text-xs font-bold" style={{ backgroundColor: `${partyColor[c.party] || '#94A3B8'}20`, color: partyColor[c.party] || '#94A3B8' }}>{c.party}</span></td>
                  <td className="px-6 py-4 text-sm text-[var(--text-secondary)]">{c.constituency}</td>
                  <td className="px-6 py-4 text-sm text-[var(--text-secondary)]">{c.district}</td>
                  <td className="px-6 py-4"><span className={`px-2 py-1 rounded-full text-xs font-medium ${c.result === 'Won' ? 'bg-emerald-500/10 text-emerald-500' : c.result === 'Lost' ? 'bg-rose-500/10 text-rose-500' : 'bg-[var(--border-subtle)] text-[var(--text-tertiary)]'}`}>{c.result}</span></td>
                  <td className="px-6 py-4 text-sm font-mono text-[var(--text-primary)]">{c.margin}</td>
                  <td className="px-6 py-4 text-sm font-mono text-[var(--text-primary)]">{c.voteShare}</td>
                  <td className="px-6 py-4 text-sm text-[var(--text-secondary)]">{c.status}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </PremiumCard>
    </div>
  );
}
