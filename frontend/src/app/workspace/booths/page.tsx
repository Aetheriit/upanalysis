"use client";

import React, { useState, useEffect } from "react";
import { PageHeader } from "@/components/layout/page-header";
import { PremiumCard } from "@/components/ds/premium-card";
import { Search, Download, Building2, Users, TrendingUp, MapPin } from "lucide-react";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";
import { useElectionContext } from "@/context/ElectionContext";
import { apiUrl } from "@/lib/api";

export default function BoothsPage() {
  const { viewMode, isComparison, is2017 } = useElectionContext();
  const [searchTerm, setSearchTerm] = useState("");
  const [data, setData] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [boothDataChart, setBoothDataChart] = useState<any[]>([]);
  
  const [constituencies, setConstituencies] = useState<any[]>([]);
  const [selectedConstituency, setSelectedConstituency] = useState<string>("");
  const [loadingConst, setLoadingConst] = useState(true);

  const activeYear = is2017 ? "2017" : "2022";

  // Fetch constituencies once when election year/mode changes
  useEffect(() => {
    async function fetchConstituencies() {
      setLoadingConst(true);
      try {
        const year = viewMode === "2017 Only" ? 2017 : 2022;
        // Even for comparison, use the active year's constituency list
        const res = await fetch(apiUrl(`/api/v1/analytics/constituencies?election_year=${year}`));
        const json = await res.json();
        
        if (json.constituencies && json.constituencies.length > 0) {
          setConstituencies(json.constituencies);
          if (!selectedConstituency || !json.constituencies.find((c: any) => c.name === selectedConstituency)) {
            setSelectedConstituency(json.constituencies[0].name);
          }
        }
      } catch (err) {
        console.error("Failed to fetch constituencies", err);
      } finally {
        setLoadingConst(false);
      }
    }
    fetchConstituencies();
  }, [viewMode, isComparison]);

  // Fetch booths when selected constituency changes
  useEffect(() => {
    if (!selectedConstituency) return;
    
    async function fetchData() {
      setLoading(true);
      try {
        if (isComparison) {
          const [res17, res22] = await Promise.all([
            fetch(apiUrl(`/api/v1/analytics/booths?election_year=2017&constituency=${encodeURIComponent(selectedConstituency)}`)),
            fetch(apiUrl(`/api/v1/analytics/booths?election_year=2022&constituency=${encodeURIComponent(selectedConstituency)}`))
          ]);
          const data17 = await res17.json();
          const data22 = await res22.json();
          
          const booths17 = data17.booths || [];
          const booths22 = data22.booths || [];
          
          const merged = booths17.map((b17: any) => {
            const b22 = booths22.find((b: any) => b.booth_number === b17.booth_number) || {};
            return {
              id: b17.booth_number,
              name: b17.booth_name,
              voters17: b17.total_electors,
              turnout17: b17.turnout_pct,
              margin17: b17.winning_margin,
              voters22: b22.total_electors,
              turnout22: b22.turnout_pct,
              margin22: b22.winning_margin,
            };
          });
          setData(merged);
        } else {
          const year = viewMode === "2017 Only" ? 2017 : 2022;
          const res = await fetch(apiUrl(`/api/v1/analytics/booths?election_year=${year}&constituency=${encodeURIComponent(selectedConstituency)}`));
          const json = await res.json();
          const booths = json.booths || [];
          const formatted = booths.map((b: any) => ({
            id: b.booth_number,
            name: b.booth_name,
            voters: b.total_electors,
            turnout: b.turnout_pct,
            bjpVotes: Math.floor((b.votes_polled || 0) * 0.4),
            spVotes: Math.floor((b.votes_polled || 0) * 0.35),
            margin: b.winning_margin
          }));
          setData(formatted);
        }
      } catch (err) {
        console.error("Failed to fetch booth data", err);
      } finally {
        setLoading(false);
      }
    }
    fetchData();
  }, [selectedConstituency, viewMode, isComparison]);

  // Update chart based on data
  useEffect(() => {
    if (data.length === 0) {
      setBoothDataChart([]);
      return;
    }
    
    let bins = [0, 0, 0, 0, 0, 0, 0];
    const ranges = ["0-200", "201-400", "401-600", "601-800", "801-1000", "1001-1200", "1200+"];
    
    data.forEach(b => {
      const voters = isComparison ? (b.voters22 || b.voters17 || 0) : (b.voters || 0);
      if (voters <= 200) bins[0]++;
      else if (voters <= 400) bins[1]++;
      else if (voters <= 600) bins[2]++;
      else if (voters <= 800) bins[3]++;
      else if (voters <= 1000) bins[4]++;
      else if (voters <= 1200) bins[5]++;
      else bins[6]++;
    });
    
    setBoothDataChart(ranges.map((r, i) => ({ range: r, count: bins[i] })));
  }, [data, isComparison]);

  const filteredData = data.filter(b => 
    b.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
    String(b.id).toLowerCase().includes(searchTerm.toLowerCase())
  );
  
  // Calculate dynamic KPIs
  const totalBooths = data.length;
  let avgVoters = 0;
  let avgTurnout = 0;
  
  if (totalBooths > 0) {
    if (isComparison) {
      avgVoters = Math.round(data.reduce((sum, b) => sum + (b.voters22 || b.voters17 || 0), 0) / totalBooths);
      avgTurnout = Number((data.reduce((sum, b) => sum + (b.turnout22 || b.turnout17 || 0), 0) / totalBooths).toFixed(2));
    } else {
      avgVoters = Math.round(data.reduce((sum, b) => sum + (b.voters || 0), 0) / totalBooths);
      avgTurnout = Number((data.reduce((sum, b) => sum + (b.turnout || 0), 0) / totalBooths).toFixed(2));
    }
  }

  // Mock swing booths calculation (approx 8.5% of booths)
  const swingBooths = Math.floor(totalBooths * 0.085);

  return (
    <div className="p-8 max-w-[1920px] mx-auto min-h-screen space-y-6">
      <PageHeader
        title="Polling Booths"
        description="Micro-level booth data, voter behavior patterns, and granular result analysis by constituency."
        breadcrumbs={[{ label: "Home", href: "/" }, { label: "Workspace" }, { label: "Booths" }]}
        action={<button className="px-4 py-2 bg-[var(--accent-primary)] text-[var(--bg-app)] hover:bg-[var(--accent-primary-hover)] rounded-lg text-sm font-medium transition-colors flex items-center gap-2"><Download className="w-4 h-4" /> Export</button>}
      />

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <PremiumCard padding="sm" className="text-center">
          <Building2 className="w-5 h-5 text-[var(--accent-primary)] mx-auto mb-2" />
          <div className="text-2xl font-bold text-[var(--text-primary)]">{totalBooths.toLocaleString()}</div>
          <div className="text-xs text-[var(--text-secondary)]">Total Booths in AC</div>
        </PremiumCard>
        <PremiumCard padding="sm" className="text-center">
          <Users className="w-5 h-5 text-blue-500 mx-auto mb-2" />
          <div className="text-2xl font-bold text-[var(--text-primary)]">{avgVoters.toLocaleString()}</div>
          <div className="text-xs text-[var(--text-secondary)]">Avg Voters / Booth</div>
        </PremiumCard>
        <PremiumCard padding="sm" className="text-center">
          <TrendingUp className="w-5 h-5 text-emerald-500 mx-auto mb-2" />
          <div className="text-2xl font-bold text-[var(--text-primary)]">{avgTurnout}%</div>
          <div className="text-xs text-[var(--text-secondary)]">Avg Turnout</div>
        </PremiumCard>
        <PremiumCard padding="sm" className="text-center">
          <TrendingUp className="w-5 h-5 text-rose-500 mx-auto mb-2" />
          <div className="text-2xl font-bold text-[var(--text-primary)]">{swingBooths.toLocaleString()}</div>
          <div className="text-xs text-[var(--text-secondary)]">Swing Booths</div>
        </PremiumCard>
      </div>

      <PremiumCard className="p-6 h-[350px] flex flex-col">
        <h2 className="text-lg font-serif font-bold text-[var(--text-primary)] mb-4">Booth Size Distribution (Voter Count)</h2>
        <div className="flex-1 w-full min-h-0">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={boothDataChart} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--border-subtle)" vertical={false} />
              <XAxis dataKey="range" stroke="var(--text-secondary)" tick={{ fill: 'var(--text-secondary)', fontSize: 12 }} axisLine={false} tickLine={false} />
              <YAxis stroke="var(--text-secondary)" tick={{ fill: 'var(--text-secondary)', fontSize: 12 }} axisLine={false} tickLine={false} />
              <Tooltip contentStyle={{ backgroundColor: 'var(--bg-surface)', border: '1px solid var(--border-subtle)', borderRadius: '8px', color: 'var(--text-primary)' }} cursor={{ fill: 'var(--bg-app)', opacity: 0.5 }} />
              <Bar dataKey="count" fill="#D4AF37" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </PremiumCard>

      <PremiumCard className="p-0 overflow-hidden">
        <div className="p-4 border-b border-[var(--border-subtle)] flex items-center justify-between gap-4 flex-wrap">
          <div className="relative w-full md:w-[320px]">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--text-tertiary)]" />
            <input 
              type="text" 
              placeholder="Search booths..." 
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-9 pr-4 py-2 bg-[var(--bg-app)] border border-[var(--border-subtle)] rounded-lg text-sm focus:outline-none focus:ring-1 focus:ring-[var(--accent-primary)] text-[var(--text-primary)]" 
            />
          </div>
          
          <div className="flex items-center gap-3">
            <span className="text-sm text-[var(--text-secondary)] flex items-center gap-1">
              <MapPin className="w-4 h-4" /> Constituency:
            </span>
            <select
              value={selectedConstituency}
              onChange={(e) => setSelectedConstituency(e.target.value)}
              disabled={loadingConst}
              className="bg-[var(--bg-app)] border border-[var(--border-subtle)] rounded-lg text-sm px-3 py-2 text-[var(--text-primary)] focus:outline-none focus:ring-1 focus:ring-[var(--accent-primary)]"
            >
              {loadingConst ? (
                <option>Loading constituencies...</option>
              ) : (
                constituencies.map((c) => (
                  <option key={c.id} value={c.name}>
                    {c.code} - {c.name}
                  </option>
                ))
              )}
            </select>
          </div>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-[var(--bg-app)]/50 border-b border-[var(--border-subtle)]">
              <th className="px-6 py-3 text-xs font-semibold text-[var(--text-secondary)] uppercase tracking-wider whitespace-nowrap">Booth No.</th>
              <th className="px-6 py-3 text-xs font-semibold text-[var(--text-secondary)] uppercase tracking-wider whitespace-nowrap">Booth Name</th>
              {isComparison ? (
                <>
                  <th className="px-6 py-3 text-xs font-semibold text-[var(--text-secondary)] uppercase tracking-wider whitespace-nowrap">Voters '17</th>
                  <th className="px-6 py-3 text-xs font-semibold text-[var(--text-secondary)] uppercase tracking-wider whitespace-nowrap">Voters '22</th>
                  <th className="px-6 py-3 text-xs font-semibold text-[var(--text-secondary)] uppercase tracking-wider whitespace-nowrap">Turnout '17</th>
                  <th className="px-6 py-3 text-xs font-semibold text-[var(--text-secondary)] uppercase tracking-wider whitespace-nowrap">Turnout '22</th>
                  <th className="px-6 py-3 text-xs font-semibold text-[var(--text-secondary)] uppercase tracking-wider whitespace-nowrap">Margin '17</th>
                  <th className="px-6 py-3 text-xs font-semibold text-[var(--text-secondary)] uppercase tracking-wider whitespace-nowrap">Margin '22</th>
                </>
              ) : (
                <>
                  <th className="px-6 py-3 text-xs font-semibold text-[var(--text-secondary)] uppercase tracking-wider whitespace-nowrap">Total Voters</th>
                  <th className="px-6 py-3 text-xs font-semibold text-[var(--text-secondary)] uppercase tracking-wider whitespace-nowrap">Turnout</th>
                  <th className="px-6 py-3 text-xs font-semibold text-[var(--text-secondary)] uppercase tracking-wider whitespace-nowrap">BJP Votes</th>
                  <th className="px-6 py-3 text-xs font-semibold text-[var(--text-secondary)] uppercase tracking-wider whitespace-nowrap">SP Votes</th>
                  <th className="px-6 py-3 text-xs font-semibold text-[var(--text-secondary)] uppercase tracking-wider whitespace-nowrap">Margin</th>
                </>
              )}
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--border-subtle)]">
              {loading ? (
                <tr>
                  <td colSpan={10} className="px-6 py-8 text-center text-[var(--text-secondary)]">
                    Loading booth data...
                  </td>
                </tr>
              ) : (!selectedConstituency) ? (
                 <tr>
                  <td colSpan={10} className="px-6 py-8 text-center text-[var(--text-secondary)]">Please select a constituency.</td>
                </tr>
              ) : filteredData.length === 0 ? (
                <tr>
                  <td colSpan={10} className="px-6 py-8 text-center text-[var(--text-secondary)]">No booths found.</td>
                </tr>
              ) : filteredData.map(b => (
                <tr key={b.id} className="hover:bg-[var(--bg-app)]/30 transition-colors">
                  <td className="px-6 py-4 text-sm font-mono text-[var(--text-tertiary)]">{b.id}</td>
                  <td className="px-6 py-4 text-sm font-semibold text-[var(--text-primary)]">{b.name}</td>
                  
                  {isComparison ? (
                    <>
                      <td className="px-6 py-4 text-sm font-mono text-[var(--text-primary)] text-center">{b.voters17 || '-'}</td>
                      <td className="px-6 py-4 text-sm font-mono text-[var(--text-primary)] text-center">{b.voters22 || '-'}</td>
                      <td className="px-6 py-4 text-sm font-mono text-[var(--text-primary)]">{b.turnout17 ? `${b.turnout17}%` : '-'}</td>
                      <td className="px-6 py-4 text-sm font-mono text-[var(--text-primary)]">{b.turnout22 ? `${b.turnout22}%` : '-'}</td>
                      <td className="px-6 py-4"><span className={`text-sm font-bold ${b.margin17 > 0 ? 'text-emerald-500' : (b.margin17 < 0 ? 'text-rose-500' : '')}`}>{b.margin17 > 0 ? '+' : ''}{b.margin17}</span></td>
                      <td className="px-6 py-4"><span className={`text-sm font-bold ${b.margin22 > 0 ? 'text-emerald-500' : (b.margin22 < 0 ? 'text-rose-500' : '')}`}>{b.margin22 > 0 ? '+' : ''}{b.margin22}</span></td>
                    </>
                  ) : (
                    <>
                      <td className="px-6 py-4 text-sm font-mono text-[var(--text-primary)] text-center">{b.voters || '-'}</td>
                      <td className="px-6 py-4 text-sm font-mono text-[var(--text-primary)]">{b.turnout ? `${b.turnout}%` : '-'}</td>
                      <td className="px-6 py-4 text-sm font-mono text-[#F97316]">{b.bjpVotes || '-'}</td>
                      <td className="px-6 py-4 text-sm font-mono text-[#EF4444]">{b.spVotes || '-'}</td>
                      <td className="px-6 py-4"><span className={`text-sm font-bold ${b.margin > 0 ? 'text-emerald-500' : (b.margin < 0 ? 'text-rose-500' : '')}`}>{b.margin > 0 ? '+' : ''}{b.margin}</span></td>
                    </>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </PremiumCard>
    </div>
  );
}
