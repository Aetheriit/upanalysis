"use client";

import React, { useState, useEffect } from "react";
import { PageHeader } from "@/components/layout/page-header";
import { PremiumCard } from "@/components/ds/premium-card";
import { Search, Download, Users, Trophy, IndianRupee, Calendar, MapPin, Loader2 } from "lucide-react";
import { useElectionContext } from "@/context/ElectionContext";
import { apiUrl } from "@/lib/api";

const partyColor: Record<string, string> = { BJP: "#F97316", SP: "#EF4444", BSP: "#2563EB", INC: "#22C55E", AIMIM: "#06B6D4", IND: "#94A3B8" };

export default function CandidatesPage() {
  const { is2017 } = useElectionContext();
  const activeYear = is2017 ? 2017 : 2022;
  
  const [candidates, setCandidates] = useState<any[]>([]);
  const [constituencies, setConstituencies] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedParty, setSelectedParty] = useState("All Parties");
  const [selectedResult, setSelectedResult] = useState("All Results");
  const [selectedConstituency, setSelectedConstituency] = useState("All Constituencies");

  useEffect(() => {
    // Fetch constituencies for the dropdown
    const fetchConstituencies = async () => {
      try {
        const res = await fetch(apiUrl(`/api/v1/analytics/constituencies?election_year=${activeYear}`));
        if (res.ok) {
          const data = await res.json();
          setConstituencies(data.constituencies || []);
        }
      } catch (err) {
        console.error("Failed to fetch constituencies:", err);
      }
    };
    fetchConstituencies();
  }, [activeYear]);

  useEffect(() => {
    const fetchCandidates = async () => {
      setLoading(true);
      try {
        // We'll pass the constituency ID if one is selected
        let url = apiUrl(`/api/v1/analytics/candidates?election_year=${activeYear}&limit=10000`);
        if (selectedConstituency !== "All Constituencies") {
          url += `&constituency_id=${selectedConstituency}`;
        }
        if (selectedParty !== "All Parties") {
          url += `&party=${selectedParty}`;
        }
        
        const res = await fetch(url);
        if (res.ok) {
          const data = await res.json();
          setCandidates(data.candidates || []);
        }
      } catch (err) {
        console.error("Failed to fetch candidates:", err);
      } finally {
        setLoading(false);
      }
    };
    
    fetchCandidates();
  }, [activeYear, selectedConstituency, selectedParty]);

  const filteredCandidates = candidates.filter(c => {
    if (searchQuery && !String(c.name || "").toLowerCase().includes(searchQuery.toLowerCase()) && !String(c.constituency || "").toLowerCase().includes(searchQuery.toLowerCase())) {
      return false;
    }
    if (selectedResult !== "All Results") {
      if (selectedResult === "Won" && !c.is_winner) return false;
      if (selectedResult === "Lost" && c.is_winner) return false;
      if (selectedResult === "Deposit Lost" && !c.deposit_lost) return false;
    }
    return true;
  });

  const uniqueParties = ["All Parties", ...Array.from(new Set(candidates.map(c => c.party))).sort()];

  return (
    <div className="p-8 max-w-[1920px] mx-auto min-h-screen space-y-6">
      <PageHeader
        title="Candidates"
        description="Candidate profiles, historical performance, and election results."
        breadcrumbs={[{ label: "Home", href: "/" }, { label: "Workspace" }, { label: "Candidates" }]}
        action={<button className="px-4 py-2 bg-[var(--accent-primary)] text-[var(--bg-app)] hover:bg-[var(--accent-primary-hover)] rounded-lg text-sm font-medium transition-colors flex items-center gap-2"><Download className="w-4 h-4" /> Export</button>}
      />

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <PremiumCard padding="sm" className="text-center">
          <Users className="w-5 h-5 text-[var(--accent-primary)] mx-auto mb-2" />
          <div className="text-2xl font-bold text-[var(--text-primary)]">
            {loading ? <Loader2 className="w-6 h-6 animate-spin mx-auto" /> : candidates.length}
          </div>
          <div className="text-xs text-[var(--text-secondary)]">Listed Candidates</div>
        </PremiumCard>
        <PremiumCard padding="sm" className="text-center">
          <Trophy className="w-5 h-5 text-emerald-500 mx-auto mb-2" />
          <div className="text-2xl font-bold text-[var(--text-primary)]">
            {loading ? <Loader2 className="w-6 h-6 animate-spin mx-auto" /> : candidates.filter(c => c.is_winner).length}
          </div>
          <div className="text-xs text-[var(--text-secondary)]">Winners</div>
        </PremiumCard>
        <PremiumCard padding="sm" className="text-center">
          <MapPin className="w-5 h-5 text-blue-500 mx-auto mb-2" />
            <div className="text-2xl font-bold text-[var(--text-primary)]">{constituencies.length}</div>
          <div className="text-xs text-[var(--text-secondary)]">Constituencies</div>
        </PremiumCard>
        <PremiumCard padding="sm" className="text-center">
          <IndianRupee className="w-5 h-5 text-rose-500 mx-auto mb-2" />
          <div className="text-2xl font-bold text-[var(--text-primary)]">
            {loading ? <Loader2 className="w-6 h-6 animate-spin mx-auto" /> : candidates.filter(c => c.deposit_lost).length}
          </div>
          <div className="text-xs text-[var(--text-secondary)]">Deposits Lost</div>
        </PremiumCard>
      </div>

      <PremiumCard className="p-0 overflow-hidden">
        <div className="p-4 border-b border-[var(--border-subtle)] flex flex-wrap items-center gap-4 justify-between">
          <div className="relative w-[320px]">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--text-tertiary)]" />
            <input 
              type="text" 
              placeholder="Search candidates..." 
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-4 py-2 bg-[var(--bg-app)] border border-[var(--border-subtle)] rounded-lg text-sm focus:outline-none focus:ring-1 focus:ring-[var(--accent-primary)] text-[var(--text-primary)]" 
            />
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <select 
              value={selectedConstituency}
              onChange={(e) => setSelectedConstituency(e.target.value)}
              className="px-3 py-2 bg-[var(--bg-app)] border border-[var(--border-subtle)] rounded-lg text-sm font-medium text-[var(--text-primary)] max-w-[200px]"
            >
              <option value="All Constituencies">All Constituencies</option>
              {constituencies.map((c: any) => (
                <option key={c.id} value={c.id}>{c.name} (AC {c.code})</option>
              ))}
            </select>
            
            <select 
              value={selectedParty}
              onChange={(e) => setSelectedParty(e.target.value)}
              className="px-3 py-2 bg-[var(--bg-app)] border border-[var(--border-subtle)] rounded-lg text-sm font-medium text-[var(--text-primary)]"
            >
              {uniqueParties.map(p => (
                <option key={p} value={p}>{p}</option>
              ))}
            </select>
            
            <select 
              value={selectedResult}
              onChange={(e) => setSelectedResult(e.target.value)}
              className="px-3 py-2 bg-[var(--bg-app)] border border-[var(--border-subtle)] rounded-lg text-sm font-medium text-[var(--text-primary)]"
            >
              <option>All Results</option>
              <option>Won</option>
              <option>Lost</option>
              <option>Deposit Lost</option>
            </select>
          </div>
        </div>
        
        <div className="overflow-x-auto min-h-[400px]">
          {loading ? (
            <div className="flex items-center justify-center h-full py-20">
              <Loader2 className="w-8 h-8 animate-spin text-[var(--accent-primary)]" />
            </div>
          ) : filteredCandidates.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-20 text-[var(--text-secondary)]">
              <Users className="w-12 h-12 mb-4 opacity-20" />
              <p>No candidates found matching your filters.</p>
            </div>
          ) : (
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-[var(--bg-app)]/50 border-b border-[var(--border-subtle)]">
                  {["Candidate", "Party", "Constituency", "Votes", "Margin", "Vote Share", "Result"].map(h => (
                    <th key={h} className="px-6 py-3 text-xs font-semibold text-[var(--text-secondary)] uppercase tracking-wider whitespace-nowrap">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--border-subtle)]">
                {filteredCandidates.map(c => (
                  <tr key={c.id} className="hover:bg-[var(--bg-app)]/30 transition-colors group">
                    <td className="px-6 py-4">
                      <div className="text-sm font-semibold text-[var(--text-primary)]">{c.name}</div>
                      {c.position > 0 && <div className="text-xs text-[var(--text-tertiary)]">Position: {c.position}</div>}
                    </td>
                    <td className="px-6 py-4">
                      <span className="px-2 py-1 rounded text-xs font-bold" style={{ backgroundColor: `${partyColor[c.party] || '#94A3B8'}20`, color: partyColor[c.party] || '#94A3B8' }}>
                        {c.party}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <div className="text-sm text-[var(--text-secondary)]">{c.constituency}</div>
                      <div className="text-xs text-[var(--text-tertiary)]">{c.district}</div>
                    </td>
                    <td className="px-6 py-4 text-sm font-mono text-[var(--text-primary)]">
                      {c.votes_received?.toLocaleString() || 0}
                    </td>
                    <td className="px-6 py-4 text-sm font-mono text-[var(--text-primary)]">
                      {c.margin > 0 ? (
                        <span className="text-emerald-500">+{c.margin.toLocaleString()}</span>
                      ) : (
                        <span className="text-rose-500">{c.margin.toLocaleString()}</span>
                      )}
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-mono text-[var(--text-primary)]">{Number(c.vote_share_pct || 0).toFixed(1)}%</span>
                        <div className="w-16 h-1.5 bg-[var(--border-subtle)] rounded-full overflow-hidden">
                          <div className="h-full rounded-full" style={{ width: `${Math.min(100, c.vote_share_pct)}%`, backgroundColor: partyColor[c.party] || '#94A3B8' }} />
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      {c.is_winner ? (
                        <span className="px-2 py-1 rounded-full text-xs font-medium bg-emerald-500/10 text-emerald-500">Won</span>
                      ) : c.deposit_lost ? (
                        <span className="px-2 py-1 rounded-full text-xs font-medium bg-rose-500/10 text-rose-500">Deposit Lost</span>
                      ) : (
                        <span className="px-2 py-1 rounded-full text-xs font-medium bg-[var(--border-subtle)] text-[var(--text-secondary)]">Lost</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </PremiumCard>
    </div>
  );
}
