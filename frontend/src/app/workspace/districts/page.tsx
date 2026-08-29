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
              turnout2017_sum: 0,
              turnout2022_sum: 0,
              bjp17: 0, sp17: 0,
              bjp22: 0, sp22: 0,
              population: "N/A" // Real population not in DB
            };
          }
          const d = districtMap[c.district];
          d.constituencies += 1;
          d.turnout2017_sum += c.turnout_pct || 0;
          if (c.winner_party === "BJP") d.bjp17 += 1;
          if (c.winner_party === "SP") d.sp17 += 1;
        });

        // Process 2022
        data22.constituencies.forEach((c: any) => {
          if (districtMap[c.district]) {
            const d = districtMap[c.district];
            d.turnout2022_sum += c.turnout_pct || 0;
            if (c.winner_party === "BJP") d.bjp22 += 1;
            if (c.winner_party === "SP") d.sp22 += 1;
          }
        });

        const finalDistricts = Object.values(districtMap).map((d: any) => {
          const t17 = d.constituencies ? (d.turnout2017_sum / d.constituencies) : 0;
          const t22 = d.constituencies ? (d.turnout2022_sum / d.constituencies) : 0;
          return {
            name: d.name,
            constituencies: d.constituencies,
            turnout2017: t17.toFixed(1),
            turnout2022: t22.toFixed(1),
            bjp17: d.bjp17,
            sp17: d.sp17,
            bjp22: d.bjp22,
            sp22: d.sp22,
            swing: (t22 - t17).toFixed(1) + "%",
            population: d.population,
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

  // Take top 10 for chart
  const turnoutComparison = districts.slice(0, 10);

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
      <PremiumCard className="p-6 h-[350px] flex flex-col">
        <h2 className="text-lg font-serif font-bold text-[var(--text-primary)] mb-4">
          {isComparison ? "District Turnout Comparison (2017 vs 2022)" : `District Turnout (${activeYear})`}
        </h2>
        <div className="flex-1 w-full min-h-0">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={turnoutComparison} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--border-subtle)" vertical={false} />
              <XAxis dataKey="name" stroke="var(--text-secondary)" tick={{ fill: 'var(--text-secondary)', fontSize: 12 }} axisLine={false} tickLine={false} />
              <YAxis stroke="var(--text-secondary)" tick={{ fill: 'var(--text-secondary)', fontSize: 12 }} axisLine={false} tickLine={false} domain={[45, 75]} tickFormatter={(v) => `${v}%`} />
              <Tooltip contentStyle={{ backgroundColor: 'var(--bg-surface)', border: '1px solid var(--border-subtle)', borderRadius: '8px', color: 'var(--text-primary)' }} />
              {(isComparison || is2017) && (
                <Bar dataKey="2017" fill="#D4AF37" fillOpacity={isComparison ? 0.5 : 1} radius={[4, 4, 0, 0]} />
              )}
              {(isComparison || is2022) && (
                <Bar dataKey="2022" fill="#D4AF37" fillOpacity={1} radius={[4, 4, 0, 0]} />
              )}
            </BarChart>
          </ResponsiveContainer>
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
              <tr className="bg-[var(--bg-app)]/50 border-b border-[var(--border-subtle)]">
                <th className="px-6 py-3 text-xs font-semibold text-[var(--text-secondary)] uppercase tracking-wider whitespace-nowrap">District</th>
                <th className="px-6 py-3 text-xs font-semibold text-[var(--text-secondary)] uppercase tracking-wider whitespace-nowrap">Constituencies</th>
                <th className="px-6 py-3 text-xs font-semibold text-[var(--text-secondary)] uppercase tracking-wider whitespace-nowrap">Population</th>
                
                {(isComparison || is2017) && <th className="px-6 py-3 text-xs font-semibold text-[var(--text-secondary)] uppercase tracking-wider whitespace-nowrap">Turnout '17</th>}
                {(isComparison || is2022) && <th className="px-6 py-3 text-xs font-semibold text-[var(--text-secondary)] uppercase tracking-wider whitespace-nowrap">Turnout '22</th>}
                
                {isComparison && <th className="px-6 py-3 text-xs font-semibold text-[var(--text-secondary)] uppercase tracking-wider whitespace-nowrap">Swing</th>}
                
                <th className="px-6 py-3 text-xs font-semibold text-[var(--text-secondary)] uppercase tracking-wider whitespace-nowrap">BJP Seats</th>
                <th className="px-6 py-3 text-xs font-semibold text-[var(--text-secondary)] uppercase tracking-wider whitespace-nowrap">SP Seats</th>
                <th className="px-6 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--border-subtle)]">
              {filteredDistricts.map(d => (
                <tr key={d.name} className="hover:bg-[var(--bg-app)]/30 transition-colors group">
                  <td className="px-6 py-4 text-sm font-semibold text-[var(--text-primary)]">{d.name}</td>
                  <td className="px-6 py-4 text-sm text-[var(--text-secondary)] text-center">{d.constituencies}</td>
                  <td className="px-6 py-4 text-sm text-[var(--text-secondary)]">{d.population}</td>
                  
                  {(isComparison || is2017) && <td className="px-6 py-4 text-sm font-mono text-[var(--text-primary)]">{d.turnout2017}%</td>}
                  {(isComparison || is2022) && <td className="px-6 py-4 text-sm font-mono text-[var(--text-primary)]">{d.turnout2022}%</td>}
                  
                  {isComparison && <td className="px-6 py-4 text-sm font-medium text-emerald-500">{Number(d.swing.replace('%','')) > 0 ? '+' : ''}{d.swing}</td>}
                  
                  <td className="px-6 py-4"><span className="px-2 py-1 rounded text-xs font-bold bg-[#F97316]/10 text-[#F97316]">{is2017 ? d.bjp17 : d.bjp22}</span></td>
                  <td className="px-6 py-4"><span className="px-2 py-1 rounded text-xs font-bold bg-[#EF4444]/10 text-[#EF4444]">{is2017 ? d.sp17 : d.sp22}</span></td>
                  <td className="px-6 py-4 text-right"><button className="p-1.5 text-[var(--text-tertiary)] hover:text-[var(--text-primary)] rounded-md hover:bg-[var(--bg-app)] transition-colors opacity-0 group-hover:opacity-100"><MoreHorizontal className="w-5 h-5" /></button></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="p-4 border-t border-[var(--border-subtle)] flex items-center justify-between text-sm text-[var(--text-secondary)]">
          <span>Showing {filteredDistricts.length} districts</span>
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
