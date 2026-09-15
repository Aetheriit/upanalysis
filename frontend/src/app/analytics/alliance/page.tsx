"use client";

import { useEffect, useMemo, useState } from "react";
import { Download, Handshake, Loader2, Users, AlertTriangle, AlertCircle } from "lucide-react";
import { Bar, BarChart, CartesianGrid, Legend, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { PageHeader } from "@/components/layout/page-header";
import { PremiumCard } from "@/components/ds/premium-card";
import { apiUrl } from "@/lib/api";
import { downloadCsv as downloadCsvFile } from "@/lib/export";

type Partner = { party: string; seats_contested: number; seats_won: number; votes: number; vote_share: number };
type Alliance = { name: string; short_name: string; main_party: string; members: string[]; actual_seats: number; pooled_seats: number; seat_change: number; votes: number; vote_share: number; partners: Partner[] };
type AllianceResponse = { year: number; constituencies: number; total_votes: number; alliances: Alliance[]; regions: Record<string, string | number>[]; methodology: string; error?: string };

const PARTY_COLORS: Record<string, string> = { BJP: "#F97316", SP: "#EF4444", INC: "#22C55E", BSP: "#2563EB", RLD: "#EAB308", SBSP: "#A855F7", "AD(S)": "#0EA5E9", NISHAD: "#14B8A6", "MAHAN DAL": "#8B5CF6", PSPL: "#EC4899" };
const colorFor = (party: string) => PARTY_COLORS[party] || "#64748B";

export default function AlliancePage() {
  const [year, setYear] = useState(2022);
  const [data, setData] = useState<AllianceResponse | null>(null);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetch(apiUrl(`/api/v1/analytics/alliance?election_year=${year}`), { cache: "no-store" })
      .then(async response => { if (!response.ok) throw new Error(`Alliance data request failed (${response.status})`); return response.json(); })
      .then(json => { if (!cancelled) { setData(json); setSelectedIndex(0); setError(null); } })
      .catch(err => { if (!cancelled) setError(err.message || "Unable to load alliance data"); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [year]);

  const alliance = data?.alliances[selectedIndex];
  const nda = data?.alliances.find(item => item.main_party === "BJP");
  const spAlliance = data?.alliances.find(item => item.main_party === "SP");
  const chartData = useMemo(() => alliance && data ? data.regions.map(region => ({ region: region.region, standalone: Number(region[`${alliance.short_name}_standalone`] || 0), pooled: Number(region[`${alliance.short_name}_pooled`] || 0) })) : [], [data, alliance]);
  const exportAlliance = () => alliance && downloadCsvFile(`alliance-analysis-${year}.csv`, alliance.partners.map((p: Partner) => ({
    year, alliance: alliance.name, party: p.party, seats_contested: p.seats_contested,
    seats_won: p.seats_won, votes: p.votes, vote_share: p.vote_share,
  })));

  return (
    <div className="p-8 max-w-[1920px] mx-auto min-h-screen space-y-6">
      <PageHeader
        title="Alliance Impact Analysis"
        description={`Simulate and analyze pre-poll alliance effects on seat tallies and vote shares for ${year}.`}
        breadcrumbs={[{ label: "Home", href: "/" }, { label: "Analytics Lab" }, { label: "Alliance Impact" }]}
        action={<button onClick={exportAlliance} disabled={!alliance} className="px-4 py-2 bg-[var(--accent-primary)] text-[var(--bg-app)] hover:bg-[var(--accent-primary-hover)] disabled:opacity-50 rounded-lg text-sm font-medium transition-colors flex items-center gap-2"><Download className="w-4 h-4" /> Export</button>}
      />

      {loading ? (
        <div className="h-64 flex items-center justify-center text-[var(--text-secondary)]">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[var(--accent-primary)]"></div>
        </div>
      ) : error ? (
        <div className="h-64 flex items-center justify-center text-red-500 gap-2">
          <AlertCircle className="w-5 h-5" />
          <span>{error}</span>
        </div>
      ) : data && !data.error ? (
        <>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <PremiumCard padding="sm" className="text-center">
              <Handshake className="w-5 h-5 text-[var(--accent-primary)] mx-auto mb-2" />
              <div className="text-2xl font-bold text-[var(--text-primary)]">{data.alliances.reduce((total, item) => total + item.partners.length, 0)}</div>
              <div className="text-xs text-[var(--text-secondary)]">Alliance Partners</div>
            </PremiumCard>
            <PremiumCard padding="sm" className="text-center">
              <Users className="w-5 h-5 text-[#F97316] mx-auto mb-2" />
              <div className="text-2xl font-bold text-[var(--text-primary)]">NDA: {nda?.actual_seats ?? 0}</div>
              <div className="text-xs text-[var(--text-secondary)]">Alliance Seats Won</div>
            </PremiumCard>
            <PremiumCard padding="sm" className="text-center">
              <Users className="w-5 h-5 text-[#EF4444] mx-auto mb-2" />
              <div className="text-2xl font-bold text-[var(--text-primary)]">SP+: {spAlliance?.actual_seats ?? 0}</div>
              <div className="text-xs text-[var(--text-secondary)]">Alliance Seats Won</div>
            </PremiumCard>
            <PremiumCard padding="sm" className="text-center">
              <Handshake className="w-5 h-5 text-emerald-500 mx-auto mb-2" />
              <div className="text-2xl font-bold text-[var(--text-primary)]">{data.alliances.reduce((total, item) => total + Math.max(0, item.seat_change), 0)}</div>
              <div className="text-xs text-[var(--text-secondary)]">Modeled Seat Gain</div>
            </PremiumCard>
          </div>

          <PremiumCard className="p-6 h-[420px] flex flex-col">
            <div className="mb-4 flex items-center justify-between gap-4"><h2 className="text-lg font-serif font-bold text-[var(--text-primary)]">Vote Share: Standalone vs Alliance ({year})</h2><select value={selectedIndex} onChange={event => setSelectedIndex(Number(event.target.value))} className="rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-app)] px-3 py-2 text-sm text-[var(--text-primary)]">{data.alliances.map((item, index) => <option key={item.short_name} value={index}>{item.name}</option>)}</select></div>
            <div className="flex-1 w-full min-h-0">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={chartData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--border-subtle)" vertical={false} />
                  <XAxis dataKey="region" stroke="var(--text-secondary)" tick={{ fill: 'var(--text-secondary)', fontSize: 11 }} axisLine={false} tickLine={false} />
                  <YAxis stroke="var(--text-secondary)" tick={{ fill: 'var(--text-secondary)', fontSize: 12 }} axisLine={false} tickLine={false} tickFormatter={(v) => `${v}%`} />
                  <Tooltip contentStyle={{ backgroundColor: 'var(--bg-surface)', border: '1px solid var(--border-subtle)', borderRadius: '8px', color: 'var(--text-primary)' }} />
                  <Legend iconType="circle" wrapperStyle={{ fontSize: '11px' }} />
                  <Bar dataKey="standalone" name={`${alliance?.main_party || "Party"} Standalone`} fill={colorFor(alliance?.main_party || "")} fillOpacity={0.4} radius={[4, 4, 0, 0]} />
                  <Bar dataKey="pooled" name={`${alliance?.short_name || "Alliance"} Pooled`} fill={colorFor(alliance?.main_party || "")} radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </PremiumCard>

          <PremiumCard className="p-0 overflow-hidden">
            <div className="p-4 border-b border-[var(--border-subtle)]">
              <h2 className="text-lg font-serif font-bold text-[var(--text-primary)]">Alliance Partner Performance ({year})</h2>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-[var(--bg-app)]/50 border-b border-[var(--border-subtle)]">
                    {["Main Party", "Alliance Partner", "Seats Contested", "Seats Won", "Statewide Vote Share", "Impact Seats"].map(h => (
                      <th key={h} className="px-6 py-3 text-xs font-semibold text-[var(--text-secondary)] uppercase tracking-wider whitespace-nowrap">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-[var(--border-subtle)]">
                  {alliance?.partners.map((partner) => (
                    <tr key={partner.party} className="hover:bg-[var(--bg-app)]/30 transition-colors">
                      <td className="px-6 py-4"><span className="px-2 py-1 rounded text-xs font-bold" style={{ backgroundColor: `${colorFor(alliance.main_party)}20`, color: colorFor(alliance.main_party) }}>{alliance.main_party}</span></td>
                      <td className="px-6 py-4 text-sm font-semibold text-[var(--text-primary)]">{partner.party}</td>
                      <td className="px-6 py-4 text-sm font-mono text-[var(--text-primary)] text-center">{partner.seats_contested}</td>
                      <td className="px-6 py-4 text-sm font-mono font-bold text-[var(--text-primary)] text-center">{partner.seats_won}</td>
                      <td className="px-6 py-4 text-sm font-mono text-[var(--text-primary)]">{partner.vote_share}%</td>
                      <td className="px-6 py-4 text-sm font-bold text-emerald-500 text-center">—</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </PremiumCard>
        </>
      ) : (
        <div className="h-64 flex items-center justify-center text-[var(--text-secondary)]">No data found</div>
      )}
    </div>
  );
}
