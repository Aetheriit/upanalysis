"use client";

import React, { useState, useEffect } from "react";
import { PageHeader } from "@/components/layout/page-header";
import { PremiumCard } from "@/components/ds/premium-card";
import { Search, Download, ArrowUpDown, MoreHorizontal, Users, TrendingUp, MapPin } from "lucide-react";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";
import { useElectionContext } from "@/context/ElectionContext";
import { apiUrl } from "@/lib/api";

export default function DistrictsPage() {
  const { viewMode, isComparison, is2017, is2022 } = useElectionContext();
  const activeYear = is2017 ? "2017" : "2022";
  
  const [districts, setDistricts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 50;

  useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm]);

  useEffect(() => {
    async function fetchData() {
      setLoading(true);
      try {
        const [res17, res22] = await Promise.all([
          fetch(apiUrl("/api/v1/analytics/constituencies?election_year=2017")),
          fetch(apiUrl("/api/v1/analytics/constituencies?election_year=2022"))
        ]);
        const data17 = await res17.json();
        const data22 = await res22.json();

        const districtMap: any = {};

        // Process 2017
        data17.constituencies.forEach((c: any) => {
          if (!districtMap[c.district]) {
            districtMap[c.district] = {
              name: c.district,
              constituencies: 0,
              votes17: 0, pop17: 0,
              votes22: 0, pop22: 0,
              bjp17: 0, sp17: 0, bsp17: 0, inc17: 0,
              bjp22: 0, sp22: 0, bsp22: 0, inc22: 0
            };
          }
          const d = districtMap[c.district];
          d.constituencies += 1;
          d.votes17 += c.votes_polled || 0;
          d.pop17 += c.total_electors || 0;
          if (c.winner_party === "BJP") d.bjp17 += 1;
          if (c.winner_party === "SP") d.sp17 += 1;
          if (c.winner_party === "BSP") d.bsp17 += 1;
          if (c.winner_party === "INC" || c.winner_party === "Congress") d.inc17 += 1;
        });

        // Process 2022
        data22.constituencies.forEach((c: any) => {
          if (!districtMap[c.district]) {
             // In case 2022 has districts not in 2017 (shouldn't happen but safe)
             districtMap[c.district] = {
              name: c.district,
              constituencies: 0,
              votes17: 0, pop17: 0,
              votes22: 0, pop22: 0,
              bjp17: 0, sp17: 0, bsp17: 0, inc17: 0,
              bjp22: 0, sp22: 0, bsp22: 0, inc22: 0
             };
          }
          const d = districtMap[c.district];
          d.votes22 += c.votes_polled || 0;
          d.pop22 += c.total_electors || 0;
          if (c.winner_party === "BJP") d.bjp22 += 1;
          if (c.winner_party === "SP") d.sp22 += 1;
          if (c.winner_party === "BSP") d.bsp22 += 1;
          if (c.winner_party === "INC" || c.winner_party === "Congress") d.inc22 += 1;
        });

        const finalDistricts = Object.values(districtMap).map((d: any) => {
          const t17 = d.pop17 > 0 ? (d.votes17 / d.pop17) * 100 : 0;
          const pop22ToUse = d.pop22 > 0 ? d.pop22 : d.pop17;
          const t22 = pop22ToUse > 0 ? (d.votes22 / pop22ToUse) * 100 : 0;
          return {
            name: d.name,
            constituencies: d.constituencies,
            turnout2017: t17.toFixed(1),
            turnout2022: t22.toFixed(1),
            bjp17: d.bjp17,
            sp17: d.sp17,
            bsp17: d.bsp17,
            inc17: d.inc17,
            bjp22: d.bjp22,
            sp22: d.sp22,
            bsp22: d.bsp22,
            inc22: d.inc22,
            swing: (t22 - t17).toFixed(1) + "%",
            pop17: d.pop17,
            pop22: pop22ToUse,
            "2017": parseFloat(t17.toFixed(1)),
            "2022": parseFloat(t22.toFixed(1))
          };
        }).sort((a: any, b: any) => a.name.localeCompare(b.name));

        setDistricts(finalDistricts);
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    }
    fetchData();
  }, []);

  const filteredDistricts = districts.filter(d => 
    d.name.toLowerCase().includes(searchTerm.toLowerCase())
  );

  // Show all districts for chart
  const turnoutComparison = districts;

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
          <div className="text-2xl font-bold text-[var(--text-primary)]">{districts.length || 75}</div>
          <div className="text-xs text-[var(--text-secondary)]">Total Districts</div>
        </PremiumCard>
        <PremiumCard padding="sm" className="text-center">
          <Users className="w-5 h-5 text-blue-500 mx-auto mb-2" />
          <div className="text-2xl font-bold text-[var(--text-primary)]">15.02 Cr</div>
          <div className="text-xs text-[var(--text-secondary)]">Total Voters ({activeYear})</div>
        </PremiumCard>
        <PremiumCard padding="sm" className="text-center">
          <TrendingUp className="w-5 h-5 text-emerald-500 mx-auto mb-2" />
          <div className="text-2xl font-bold text-[var(--text-primary)]">{is2017 ? '61.04%' : '61.65%'}</div>
          <div className="text-xs text-[var(--text-secondary)]">Avg Turnout {activeYear}</div>
        </PremiumCard>
        <PremiumCard padding="sm" className="text-center">
          <TrendingUp className="w-5 h-5 text-rose-500 mx-auto mb-2" />
          <div className="text-2xl font-bold text-emerald-500">+1.58%</div>
          <div className="text-xs text-[var(--text-secondary)]">Turnout Change</div>
        </PremiumCard>
      </div>

      {/* Chart */}
      <PremiumCard className="p-6 h-[400px] flex flex-col">
        <h2 className="text-lg font-serif font-bold text-[var(--text-primary)] mb-4">
          {isComparison ? "District Turnout Comparison (2017 vs 2022)" : `District Turnout (${activeYear})`}
        </h2>
        <div className="flex-1 w-full min-h-0 overflow-x-auto pb-4 [&::-webkit-scrollbar]:h-2 [&::-webkit-scrollbar-thumb]:bg-[var(--border-subtle)] [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-track]:bg-transparent">
          <div style={{ minWidth: '4000px', height: '100%' }}>
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={turnoutComparison} margin={{ top: 10, right: 10, left: -20, bottom: 40 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border-subtle)" vertical={false} />
                <XAxis dataKey="name" interval={0} stroke="var(--text-secondary)" tick={{ fill: 'var(--text-secondary)', fontSize: 11 }} axisLine={false} tickLine={false} angle={-45} textAnchor="end" />
                <YAxis stroke="var(--text-secondary)" tick={{ fill: 'var(--text-secondary)', fontSize: 12 }} axisLine={false} tickLine={false} domain={[40, 80]} tickFormatter={(v) => `${v}%`} />
                <Tooltip contentStyle={{ backgroundColor: 'var(--bg-surface)', border: '1px solid var(--border-subtle)', borderRadius: '8px', color: 'var(--text-primary)' }} cursor={{fill: 'var(--bg-app)'}} />
                {(isComparison || is2017) && (
                  <Bar dataKey="2017" fill="#D4AF37" fillOpacity={isComparison ? 0.5 : 1} radius={[4, 4, 0, 0]} />
                )}
                {(isComparison || is2022) && (
                  <Bar dataKey="2022" fill="#D4AF37" fillOpacity={1} radius={[4, 4, 0, 0]} />
                )}
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </PremiumCard>

      {/* Table */}
      <PremiumCard className="p-0 overflow-hidden">
        <div className="p-4 border-b border-[var(--border-subtle)] flex items-center justify-between">
          <div className="relative w-[300px]">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--text-tertiary)]" />
            <input 
              type="text" 
              placeholder="Search districts..." 
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-9 pr-4 py-2 bg-[var(--bg-app)] border border-[var(--border-subtle)] rounded-lg text-sm focus:outline-none focus:ring-1 focus:ring-[var(--accent-primary)] text-[var(--text-primary)]" 
            />
          </div>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr>
                <th className="px-6 py-4 border-b border-[var(--border-subtle)]" colSpan={3}>
                  <div className="flex items-center gap-2"><MapPin className="w-4 h-4 text-[var(--accent-primary)]"/> District Details</div>
                </th>
                <th className="px-6 py-4 border-b border-[var(--border-subtle)] text-center bg-[var(--bg-app)]/50" colSpan={isComparison ? 3 : (is2017 || is2022 ? 1 : 1)}>
                  <div className="flex items-center justify-center gap-2 font-serif text-[var(--text-primary)]">Turnout Stats</div>
                </th>
                <th className="px-6 py-4 border-b border-[var(--border-subtle)] text-center" colSpan={4}>
                  <div className="flex items-center justify-center gap-2 font-serif text-[var(--text-primary)]">BJP, SP, BSP & INC (Congress)</div>
                </th>
                <th className="px-6 py-4 border-b border-[var(--border-subtle)]"></th>
              </tr>
              <tr className="bg-[var(--bg-app)]/50 border-b border-[var(--border-subtle)]">
                <th className="px-6 py-3 text-xs font-semibold text-[var(--text-secondary)] uppercase tracking-wider whitespace-nowrap">District</th>
                <th className="px-6 py-3 text-xs font-semibold text-[var(--text-secondary)] uppercase tracking-wider whitespace-nowrap">Constituencies</th>
                <th className="px-6 py-3 text-xs font-semibold text-[var(--text-secondary)] uppercase tracking-wider whitespace-nowrap">Population</th>
                
                {(isComparison || is2017) && <th className="px-6 py-3 text-xs font-semibold text-[var(--text-secondary)] uppercase tracking-wider whitespace-nowrap">Turnout '17</th>}
                {(isComparison || is2022) && <th className="px-6 py-3 text-xs font-semibold text-[var(--text-secondary)] uppercase tracking-wider whitespace-nowrap">Turnout '22</th>}
                
                {isComparison && <th className="px-6 py-3 text-xs font-semibold text-[var(--text-secondary)] uppercase tracking-wider whitespace-nowrap">Swing</th>}
                
                <th className="px-6 py-3 text-xs font-semibold text-[var(--text-secondary)] uppercase tracking-wider whitespace-nowrap">BJP Seats</th>
                <th className="px-6 py-3 text-xs font-semibold text-[var(--text-secondary)] uppercase tracking-wider whitespace-nowrap">SP Seats</th>
                <th className="px-6 py-3 text-xs font-semibold text-[var(--text-secondary)] uppercase tracking-wider whitespace-nowrap">BSP Seats</th>
                <th className="px-6 py-3 text-xs font-semibold text-[var(--text-secondary)] uppercase tracking-wider whitespace-nowrap">INC (Congress)</th>
                <th className="px-6 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--border-subtle)]">
              {filteredDistricts.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage).map(d => (
                <tr key={d.name} className="hover:bg-[var(--bg-app)]/30 transition-colors group">
                  <td className="px-6 py-4 text-sm font-semibold text-[var(--text-primary)]">{d.name}</td>
                  <td className="px-6 py-4 text-sm text-[var(--text-secondary)] text-center">{d.constituencies}</td>
                  <td className="px-6 py-4 text-sm text-[var(--text-secondary)]">{(is2017 ? d.pop17 : d.pop22).toLocaleString()}</td>
                  
                  {(isComparison || is2017) && <td className="px-6 py-4 text-sm font-mono text-[var(--text-primary)]">{d.turnout2017}%</td>}
                  {(isComparison || is2022) && <td className="px-6 py-4 text-sm font-mono text-[var(--text-primary)]">{d.turnout2022}%</td>}
                  
                  {isComparison && <td className="px-6 py-4 text-sm font-medium text-emerald-500">{Number(d.swing.replace('%','')) > 0 ? '+' : ''}{d.swing}</td>}
                  
                  <td className="px-6 py-4"><span className="px-2 py-1 rounded text-xs font-bold bg-[#F97316]/10 text-[#F97316]">{is2017 ? d.bjp17 : d.bjp22}</span></td>
                  <td className="px-6 py-4"><span className="px-2 py-1 rounded text-xs font-bold bg-[#EF4444]/10 text-[#EF4444]">{is2017 ? d.sp17 : d.sp22}</span></td>
                  <td className="px-6 py-4"><span className="px-2 py-1 rounded text-xs font-bold bg-[#3B82F6]/10 text-[#3B82F6]">{is2017 ? d.bsp17 : d.bsp22}</span></td>
                  <td className="px-6 py-4"><span className="px-2 py-1 rounded text-xs font-bold bg-[#10B981]/10 text-[#10B981]">{is2017 ? d.inc17 : d.inc22}</span></td>
                  <td className="px-6 py-4 text-right"><button className="p-1.5 text-[var(--text-tertiary)] hover:text-[var(--text-primary)] rounded-md hover:bg-[var(--bg-app)] transition-colors opacity-0 group-hover:opacity-100"><MoreHorizontal className="w-5 h-5" /></button></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="p-4 border-t border-[var(--border-subtle)] flex flex-col sm:flex-row items-center justify-between gap-4 text-sm text-[var(--text-secondary)]">
          <span>
            Showing {filteredDistricts.length === 0 ? 0 : (currentPage - 1) * itemsPerPage + 1} to {Math.min(currentPage * itemsPerPage, filteredDistricts.length)} of {filteredDistricts.length} entries
          </span>
          <div className="flex items-center gap-2">
            <button 
              className="px-3 py-1.5 border border-[var(--border-subtle)] rounded hover:bg-[var(--border-subtle)] transition-colors disabled:opacity-50" 
              disabled={currentPage === 1}
              onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))}
            >
              Previous
            </button>
            
            {Array.from({ length: Math.ceil(filteredDistricts.length / itemsPerPage) }, (_, i) => i + 1)
              .filter(page => page === 1 || page === Math.ceil(filteredDistricts.length / itemsPerPage) || Math.abs(page - currentPage) <= 1)
              .map((page, i, arr) => (
                <React.Fragment key={page}>
                  {i > 0 && arr[i - 1] !== page - 1 && <span className="px-2">...</span>}
                  <button 
                    className={`px-3 py-1.5 border rounded transition-colors ${currentPage === page ? 'border-[var(--accent-primary)] bg-[var(--accent-primary)] text-[var(--bg-app)] font-medium' : 'border-[var(--border-subtle)] hover:bg-[var(--border-subtle)]'}`}
                    onClick={() => setCurrentPage(page)}
                  >
                    {page}
                  </button>
                </React.Fragment>
            ))}

            <button 
              className="px-3 py-1.5 border border-[var(--border-subtle)] rounded hover:bg-[var(--border-subtle)] transition-colors disabled:opacity-50" 
              disabled={currentPage === Math.ceil(filteredDistricts.length / itemsPerPage) || filteredDistricts.length === 0}
              onClick={() => setCurrentPage(prev => Math.min(prev + 1, Math.ceil(filteredDistricts.length / itemsPerPage)))}
            >
              Next
            </button>
          </div>
        </div>
      </PremiumCard>
    </div>
  );
}
