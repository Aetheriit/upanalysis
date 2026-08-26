"use client";

import React, { useState, useEffect } from "react";
import { PageHeader } from "@/components/layout/page-header";
import { PremiumCard } from "@/components/ds/premium-card";
import { Search, Filter, Download, MoreHorizontal, ArrowUpDown } from "lucide-react";
import { useElectionContext } from "@/context/ElectionContext";

export default function ConstituenciesPage() {
  const { viewMode, isComparison, is2017, is2022 } = useElectionContext();
  const [searchTerm, setSearchTerm] = useState("");
  const [data, setData] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchData() {
      setLoading(true);
      try {
        if (isComparison) {
          const [res17, res22] = await Promise.all([
            fetch("http://localhost:8000/api/v1/analytics/constituencies?election_year=2017"),
            fetch("http://localhost:8000/api/v1/analytics/constituencies?election_year=2022")
          ]);
          const data17 = await res17.json();
          const data22 = await res22.json();
          
          // Merge by code
          const merged = data17.constituencies.map((c17: any) => {
            const c22 = data22.constituencies.find((c: any) => c.code === c17.code) || {};
            return {
              id: c17.id,
              name: c17.name,
              code: c17.code,
              district: c17.district,
              turnout17: c17.turnout_pct,
              margin17: c17.winning_margin,
              winner17: c17.winner_party,
              turnout22: c22.turnout_pct,
              margin22: c22.winning_margin,
              winner22: c22.winner_party,
              status: c17.winning_margin < 5000 ? "Close Contest" : "Safe"
            };
          });
          setData(merged);
        } else {
          const year = viewMode === "2017 Only" ? 2017 : 2022;
          const res = await fetch(`http://localhost:8000/api/v1/analytics/constituencies?election_year=${year}`);
          const json = await res.json();
          
          const formatted = json.constituencies.map((c: any) => ({
            id: c.id,
            name: c.name,
            code: c.code,
            district: c.district,
            turnout: c.turnout_pct,
            margin: c.winning_margin,
            winner: c.winner_party,
            status: c.winning_margin < 5000 ? "Close Contest" : "Safe"
          }));
          setData(formatted);
        }
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    }
    fetchData();
  }, [viewMode, isComparison]);

  const filteredData = data.filter(c => 
    c.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
    c.district.toLowerCase().includes(searchTerm.toLowerCase())
  );



  return (
    <div className="p-8 max-w-[1920px] mx-auto min-h-screen space-y-6">
      <PageHeader 
        title="Constituencies"
        description="Manage and analyze 403 assembly constituencies."
        breadcrumbs={[
          { label: "Home", href: "/" },
          { label: "Workspace" },
          { label: "Constituencies" }
        ]}
        action={
          <button className="px-4 py-2 bg-[var(--accent-primary)] text-[var(--bg-app)] hover:bg-[var(--accent-primary-hover)] rounded-lg text-sm font-medium transition-colors flex items-center gap-2">
            <Download className="w-4 h-4" /> Export Data
          </button>
        }
      />

      <PremiumCard className="p-0 overflow-hidden flex flex-col">
        {/* Table Toolbar */}
        <div className="p-4 border-b border-[var(--border-subtle)] flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="relative w-full sm:w-[320px]">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--text-tertiary)]" />
            <input 
              type="text" 
              placeholder="Search by constituency or district..." 
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-9 pr-4 py-2 bg-[var(--bg-app)] border border-[var(--border-subtle)] rounded-lg text-sm focus:outline-none focus:ring-1 focus:ring-[var(--accent-primary)] text-[var(--text-primary)]"
            />
          </div>
          <div className="flex items-center gap-3">
            <select className="px-3 py-2 bg-[var(--bg-app)] border border-[var(--border-subtle)] rounded-lg text-sm font-medium text-[var(--text-primary)]">
              <option>All Districts</option>
              <option>Saharanpur</option>
              <option>Shamli</option>
            </select>
            <select className="px-3 py-2 bg-[var(--bg-app)] border border-[var(--border-subtle)] rounded-lg text-sm font-medium text-[var(--text-primary)]">
              <option>All Statuses</option>
              <option>Safe</option>
              <option>Close Contest</option>
              <option>Critical Swing</option>
            </select>
            <button className="px-3 py-2 bg-[var(--bg-app)] border border-[var(--border-subtle)] rounded-lg text-sm font-medium text-[var(--text-primary)] hover:bg-[var(--border-subtle)] transition-colors">
              <Filter className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Data Table */}
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-[var(--bg-app)]/50 border-b border-[var(--border-subtle)]">
                <th className="px-6 py-4 text-xs font-semibold text-[var(--text-secondary)] uppercase tracking-wider whitespace-nowrap cursor-pointer hover:text-[var(--text-primary)] group">
                  <div className="flex items-center gap-2">ID <ArrowUpDown className="w-3 h-3 opacity-0 group-hover:opacity-100 transition-opacity" /></div>
                </th>
                <th className="px-6 py-4 text-xs font-semibold text-[var(--text-secondary)] uppercase tracking-wider whitespace-nowrap cursor-pointer hover:text-[var(--text-primary)] group">
                  <div className="flex items-center gap-2">Constituency <ArrowUpDown className="w-3 h-3 opacity-0 group-hover:opacity-100 transition-opacity" /></div>
                </th>
                <th className="px-6 py-4 text-xs font-semibold text-[var(--text-secondary)] uppercase tracking-wider whitespace-nowrap cursor-pointer hover:text-[var(--text-primary)] group">
                  <div className="flex items-center gap-2">District <ArrowUpDown className="w-3 h-3 opacity-0 group-hover:opacity-100 transition-opacity" /></div>
                </th>
                {isComparison ? (
                  <>
                    <th className="px-6 py-4 text-xs font-semibold text-[var(--text-secondary)] uppercase tracking-wider whitespace-nowrap text-right">Turnout '17</th>
                    <th className="px-6 py-4 text-xs font-semibold text-[var(--text-secondary)] uppercase tracking-wider whitespace-nowrap text-right">Turnout '22</th>
                    <th className="px-6 py-4 text-xs font-semibold text-[var(--text-secondary)] uppercase tracking-wider whitespace-nowrap text-right">Margin '17</th>
                    <th className="px-6 py-4 text-xs font-semibold text-[var(--text-secondary)] uppercase tracking-wider whitespace-nowrap text-right">Margin '22</th>
                    <th className="px-6 py-4 text-xs font-semibold text-[var(--text-secondary)] uppercase tracking-wider whitespace-nowrap">Winner '17</th>
                    <th className="px-6 py-4 text-xs font-semibold text-[var(--text-secondary)] uppercase tracking-wider whitespace-nowrap">Winner '22</th>
                  </>
                ) : (
                  <>
                    <th className="px-6 py-4 text-xs font-semibold text-[var(--text-secondary)] uppercase tracking-wider whitespace-nowrap text-right">Turnout</th>
                    <th className="px-6 py-4 text-xs font-semibold text-[var(--text-secondary)] uppercase tracking-wider whitespace-nowrap text-right">Margin</th>
                    <th className="px-6 py-4 text-xs font-semibold text-[var(--text-secondary)] uppercase tracking-wider whitespace-nowrap">Winner</th>
                  </>
                )}
                <th className="px-6 py-4 text-xs font-semibold text-[var(--text-secondary)] uppercase tracking-wider whitespace-nowrap">
                  Status
                </th>
                <th className="px-6 py-4 text-xs font-semibold text-[var(--text-secondary)] uppercase tracking-wider whitespace-nowrap text-right">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--border-subtle)]">
              {loading ? (
                <tr>
                  <td colSpan={10} className="px-6 py-8 text-center text-[var(--text-secondary)]">Loading data...</td>
                </tr>
              ) : filteredData.length === 0 ? (
                <tr>
                  <td colSpan={10} className="px-6 py-8 text-center text-[var(--text-secondary)]">No constituencies found.</td>
                </tr>
              ) : filteredData.slice(0, 50).map((row, idx) => (
                <tr key={idx} className="hover:bg-[var(--bg-app)]/30 transition-colors group">
                  <td className="px-6 py-4 text-sm font-medium text-[var(--text-tertiary)]">{row.code}</td>
                  <td className="px-6 py-4 text-sm font-semibold text-[var(--text-primary)]">{row.name}</td>
                  <td className="px-6 py-4 text-sm text-[var(--text-secondary)]">{row.district}</td>
                  
                  {isComparison ? (
                    <>
                      <td className="px-6 py-4 text-sm font-mono text-[var(--text-primary)] text-right">{row.turnout17}%</td>
                      <td className="px-6 py-4 text-sm font-mono text-[var(--text-primary)] text-right">{row.turnout22}%</td>
                      <td className="px-6 py-4 text-sm font-mono text-[var(--text-primary)] text-right">{row.margin17?.toLocaleString() || '-'}</td>
                      <td className="px-6 py-4 text-sm font-mono text-[var(--text-primary)] text-right">{row.margin22?.toLocaleString() || '-'}</td>
                      <td className="px-6 py-4">
                        <span className={`inline-flex items-center px-2 py-1 rounded text-xs font-bold
                          ${row.winner17 === 'BJP' ? 'bg-[#F97316]/10 text-[#F97316]' : 
                            row.winner17 === 'SP' ? 'bg-[#22C55E]/10 text-[#22C55E]' : 
                            row.winner17 === 'BSP' ? 'bg-[#1E3A8A]/10 text-[#1E3A8A]' : 
                            'bg-[#EAB308]/10 text-[#EAB308]'}
                        `}>{row.winner17 || '-'}</span>
                      </td>
                      <td className="px-6 py-4">
                        <span className={`inline-flex items-center px-2 py-1 rounded text-xs font-bold
                          ${row.winner22 === 'BJP' ? 'bg-[#F97316]/10 text-[#F97316]' : 
                            row.winner22 === 'SP' ? 'bg-[#22C55E]/10 text-[#22C55E]' : 
                            row.winner22 === 'BSP' ? 'bg-[#1E3A8A]/10 text-[#1E3A8A]' : 
                            'bg-[#EAB308]/10 text-[#EAB308]'}
                        `}>{row.winner22 || '-'}</span>
                      </td>
                    </>
                  ) : (
                    <>
                      <td className="px-6 py-4 text-sm font-mono text-[var(--text-primary)] text-right">{row.turnout}%</td>
                      <td className="px-6 py-4 text-sm font-mono text-[var(--text-primary)] text-right">{row.margin?.toLocaleString() || '-'}</td>
                      <td className="px-6 py-4">
                        <span className={`inline-flex items-center px-2 py-1 rounded text-xs font-bold
                          ${row.winner === 'BJP' ? 'bg-[#F97316]/10 text-[#F97316]' : 
                            row.winner === 'SP' ? 'bg-[#22C55E]/10 text-[#22C55E]' : 
                            row.winner === 'BSP' ? 'bg-[#1E3A8A]/10 text-[#1E3A8A]' : 
                            'bg-[#EAB308]/10 text-[#EAB308]'}
                        `}>{row.winner || '-'}</span>
                      </td>
                    </>
                  )}
                  
                  <td className="px-6 py-4">
                    <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium border
                      ${row.status === 'Safe' ? 'bg-emerald-500/10 text-emerald-500 border-emerald-500/20' : 
                        row.status === 'Close Contest' ? 'bg-amber-500/10 text-amber-500 border-amber-500/20' : 
                        row.status === 'Critical Swing' ? 'bg-rose-500/10 text-rose-500 border-rose-500/20' : 
                        'bg-[var(--border-subtle)] text-[var(--text-secondary)] border-[var(--border-subtle)]'}
                    `}>
                      <span className={`w-1.5 h-1.5 rounded-full 
                        ${row.status === 'Safe' ? 'bg-emerald-500' : 
                          row.status === 'Close Contest' ? 'bg-amber-500' : 
                          row.status === 'Critical Swing' ? 'bg-rose-500 animate-pulse' : 
                          'bg-[var(--text-tertiary)]'}
                      `} />
                      {row.status}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-right">
                    <button className="p-1.5 text-[var(--text-tertiary)] hover:text-[var(--text-primary)] rounded-md hover:bg-[var(--bg-app)] transition-colors opacity-0 group-hover:opacity-100 focus:opacity-100">
                      <MoreHorizontal className="w-5 h-5" />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        
        {/* Pagination */}
        <div className="p-4 border-t border-[var(--border-subtle)] flex items-center justify-between text-sm text-[var(--text-secondary)]">
          <span>Showing {Math.min(filteredData.length, 50)} of {filteredData.length} entries (capped at 50 for demo)</span>
          <div className="flex items-center gap-2">
            <button className="px-3 py-1.5 border border-[var(--border-subtle)] rounded hover:bg-[var(--bg-app)] transition-colors disabled:opacity-50" disabled>Previous</button>
            <button className="px-3 py-1.5 border border-[var(--border-subtle)] rounded bg-[var(--accent-primary)] text-[var(--bg-app)] font-medium">1</button>
            <button className="px-3 py-1.5 border border-[var(--border-subtle)] rounded hover:bg-[var(--bg-app)] transition-colors">2</button>
            <button className="px-3 py-1.5 border border-[var(--border-subtle)] rounded hover:bg-[var(--bg-app)] transition-colors">3</button>
            <span className="px-2">...</span>
            <button className="px-3 py-1.5 border border-[var(--border-subtle)] rounded hover:bg-[var(--bg-app)] transition-colors">Next</button>
          </div>
        </div>
      </PremiumCard>
    </div>
  );
}
