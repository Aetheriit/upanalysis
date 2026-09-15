"use client";

import React, { useEffect, useState } from "react";
import { PageHeader } from "@/components/layout/page-header";
import { PremiumCard } from "@/components/ds/premium-card";
import { Download, Target, AlertTriangle, ShieldCheck, Loader2 } from "lucide-react";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";
import { useElectionContext } from "@/context/ElectionContext";
import { apiUrl } from "@/lib/api";
import { downloadCsv } from "@/lib/export";

const partyColor: Record<string, string> = { 
  BJP: "#F97316", SP: "#EF4444", BSP: "#2563EB", RLD: "#EAB308", 
  INC: "#10B981", ADAL: "#8B5CF6", IND: "#6B7280"
};

export default function MarginPage() {
  const { viewMode, is2017 } = useElectionContext();
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function fetchMarginData() {
      try {
        setLoading(true);
        setError(null);
        const year = is2017 ? 2017 : 2022;
        const response = await fetch(apiUrl(`/api/v1/analytics/margin?election_year=${year}`));
        
        if (!response.ok) {
          throw new Error("Failed to fetch margin data");
        }
        
        const result = await response.json();
        setData(result);
      } catch (err: any) {
        setError(err.message || "An error occurred");
      } finally {
        setLoading(false);
      }
    }

    fetchMarginData();
  }, [viewMode]);

  const exportMargin = () => data && downloadCsv(`margin-analysis-${is2017 ? 2017 : 2022}.csv`, [
    ...(data.closest_contests || []), ...(data.distribution || []),
  ]);

  return (
    <div className="p-8 max-w-[1920px] mx-auto min-h-screen space-y-6">
      <PageHeader
        title="Margin Analysis"
        description={`Victory margins, close contest tracking, and vulnerability assessment across 403 constituencies for ${viewMode}.`}
        breadcrumbs={[{ label: "Home", href: "/" }, { label: "Analytics Lab" }, { label: "Margin Analysis" }]}
        action={<button onClick={exportMargin} disabled={!data} className="px-4 py-2 bg-[var(--accent-primary)] text-[var(--bg-app)] hover:bg-[var(--accent-primary-hover)] disabled:opacity-50 rounded-lg text-sm font-medium transition-colors flex items-center gap-2"><Download className="w-4 h-4" /> Export</button>}
      />

      {loading ? (
        <div className="h-64 flex flex-col items-center justify-center">
          <Loader2 className="w-8 h-8 animate-spin text-[var(--accent-primary)] mb-4" />
          <p className="text-[var(--text-secondary)]">Loading margin analytics for {viewMode}...</p>
        </div>
      ) : error ? (
        <PremiumCard className="p-8 text-center text-rose-500 border-rose-500/20 bg-rose-500/5">
          <AlertTriangle className="w-8 h-8 mx-auto mb-4 opacity-80" />
          <h3 className="font-bold text-lg mb-2">Failed to load data</h3>
          <p className="text-sm opacity-80">{error}</p>
        </PremiumCard>
      ) : data ? (
        <>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <PremiumCard padding="sm" className="text-center">
              <Target className="w-5 h-5 text-rose-500 mx-auto mb-2" />
              <div className="text-2xl font-bold text-[var(--text-primary)]">
                {data.smallest_margin?.margin?.toLocaleString() || "0"}
              </div>
              <div className="text-xs text-[var(--text-secondary)]">
                Smallest Margin ({data.smallest_margin?.constituency || "N/A"})
              </div>
            </PremiumCard>
            <PremiumCard padding="sm" className="text-center">
              <ShieldCheck className="w-5 h-5 text-emerald-500 mx-auto mb-2" />
              <div className="text-2xl font-bold text-[var(--text-primary)]">
                {data.largest_margin?.margin?.toLocaleString() || "0"}
              </div>
              <div className="text-xs text-[var(--text-secondary)]">
                Largest Margin ({data.largest_margin?.constituency || "N/A"})
              </div>
            </PremiumCard>
            <PremiumCard padding="sm" className="text-center">
              <AlertTriangle className="w-5 h-5 text-amber-500 mx-auto mb-2" />
              <div className="text-2xl font-bold text-[var(--text-primary)]">
                {data.close_contests_count || 0}
              </div>
              <div className="text-xs text-[var(--text-secondary)]">Close Contests (&lt;5K)</div>
            </PremiumCard>
            <PremiumCard padding="sm" className="text-center">
              <Target className="w-5 h-5 text-[var(--accent-primary)] mx-auto mb-2" />
              <div className="text-2xl font-bold text-[var(--text-primary)]">
                {data.avg_margin?.toLocaleString() || "0"}
              </div>
              <div className="text-xs text-[var(--text-secondary)]">Avg Winning Margin</div>
            </PremiumCard>
          </div>

          <PremiumCard className="p-6 h-[400px] flex flex-col">
            <h2 className="text-lg font-serif font-bold text-[var(--text-primary)] mb-4">Margin Distribution ({viewMode})</h2>
            <div className="flex-1 w-full min-h-0">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={data.distribution || []} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
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
              <h2 className="text-lg font-serif font-bold text-[var(--text-primary)]">Closest Contests ({viewMode})</h2>
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
                  {(data.closest_contests || []).map((c: any, i: number) => (
                    <tr key={c.constituency} className="hover:bg-[var(--bg-app)]/30 transition-colors">
                      <td className="px-6 py-4 text-sm font-bold text-[var(--text-tertiary)]">{i + 1}</td>
                      <td className="px-6 py-4 text-sm font-semibold text-[var(--text-primary)]">{c.constituency}</td>
                      <td className="px-6 py-4">
                        <span className="px-2 py-1 rounded text-xs font-bold" style={{ backgroundColor: `${partyColor[c.winner] || '#6B7280'}20`, color: partyColor[c.winner] || '#6B7280' }}>
                          {c.winner}
                        </span>
                      </td>
                      <td className="px-6 py-4">
                        <span className="px-2 py-1 rounded text-xs font-bold" style={{ backgroundColor: `${partyColor[c.runnerUp] || '#6B7280'}20`, color: partyColor[c.runnerUp] || '#6B7280' }}>
                          {c.runnerUp}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-sm font-mono font-bold text-rose-500">{c.margin?.toLocaleString()}</td>
                      <td className="px-6 py-4 text-sm font-mono text-[var(--text-primary)]">{c.turnout}</td>
                    </tr>
                  ))}
                  {data.closest_contests?.length === 0 && (
                    <tr>
                      <td colSpan={6} className="px-6 py-8 text-center text-sm text-[var(--text-secondary)]">
                        No contests with margin under 5,000 votes found.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </PremiumCard>
        </>
      ) : null}
    </div>
  );
}
