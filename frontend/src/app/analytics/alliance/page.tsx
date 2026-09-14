"use client";

import { useEffect, useMemo, useState } from "react";
import { Download, Handshake, Loader2, Users, AlertTriangle, AlertCircle } from "lucide-react";
import { Bar, BarChart, CartesianGrid, Legend, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { PageHeader } from "@/components/layout/page-header";
import { PremiumCard } from "@/components/ds/premium-card";
import { apiUrl } from "@/lib/api";

type Partner = { party: string; seats_contested: number; seats_won: number; votes: number; vote_share: number };
type Alliance = { name: string; short_name: string; main_party: string; members: string[]; actual_seats: number; pooled_seats: number; seat_change: number; votes: number; vote_share: number; partners: Partner[] };
type AllianceResponse = { year: number; constituencies: number; total_votes: number; alliances: Alliance[]; regions: Record<string, string | number>[]; methodology: string };

const PARTY_COLORS: Record<string, string> = { BJP: "#F97316", SP: "#EF4444", INC: "#22C55E", BSP: "#2563EB", RLD: "#EAB308", SBSP: "#A855F7", "AD(S)": "#0EA5E9", NISHAD: "#14B8A6", "MAHAN DAL": "#8B5CF6", PSPL: "#EC4899" };
const colorFor = (party: string) => PARTY_COLORS[party] || "#64748B";

function downloadCsv(data: AllianceResponse, alliance: Alliance) {
  const rows = [["Election year", "Alliance", "Party", "Seats contested", "Seats won", "Votes", "Vote share"], ...alliance.partners.map(p => [data.year, alliance.name, p.party, p.seats_contested, p.seats_won, p.votes, `${p.vote_share}%`])];
  const csv = rows.map(row => row.map(value => `"${String(value).replaceAll('"', '""')}"`).join(",")).join("\n");
  const url = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" }));
  const link = document.createElement("a"); link.href = url; link.download = `alliance-analysis-${data.year}.csv`; link.click(); URL.revokeObjectURL(url);
}

export default function AlliancePage() {
  const [year, setYear] = useState(2022);
  const [data, setData] = useState<any>(null);
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
  const chartData = useMemo(() => alliance && data ? data.regions.map((region: any) => ({ region: region.region, standalone: Number(region[`${alliance.short_name}_standalone`] || 0), pooled: Number(region[`${alliance.short_name}_pooled`] || 0) })) : [], [data, alliance]);

  return (
    <div className="p-8 max-w-[1920px] mx-auto min-h-screen space-y-6">
      <PageHeader
        title="Alliance Impact Analysis"
        description={`Simulate and analyze pre-poll alliance effects on seat tallies and vote shares for ${year}.`}
        breadcrumbs={[{ label: "Home", href: "/" }, { label: "Analytics Lab" }, { label: "Alliance Impact" }]}
        action={<button className="px-4 py-2 bg-[var(--accent-primary)] text-[var(--bg-app)] hover:bg-[var(--accent-primary-hover)] rounded-lg text-sm font-medium transition-colors flex items-center gap-2"><Download className="w-4 h-4" /> Export</button>}
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
              <div className="text-2xl font-bold text-[var(--text-primary)]">{data.totalPartners}</div>
              <div className="text-xs text-[var(--text-secondary)]">Alliance Partners</div>
            </PremiumCard>
            <PremiumCard padding="sm" className="text-center">
              <Users className="w-5 h-5 text-[#F97316] mx-auto mb-2" />
              <div className="text-2xl font-bold text-[var(--text-primary)]">NDA: {data.ndaSeats}</div>
              <div className="text-xs text-[var(--text-secondary)]">Alliance Seats Won</div>
            </PremiumCard>
            <PremiumCard padding="sm" className="text-center">
              <Users className="w-5 h-5 text-[#EF4444] mx-auto mb-2" />
              <div className="text-2xl font-bold text-[var(--text-primary)]">SP+: {data.indiaSeats}</div>
              <div className="text-xs text-[var(--text-secondary)]">Alliance Seats Won</div>
            </PremiumCard>
            <PremiumCard padding="sm" className="text-center">
              <Handshake className="w-5 h-5 text-emerald-500 mx-auto mb-2" />
              <div className="text-2xl font-bold text-[var(--text-primary)]">{data.impactSeats}</div>
              <div className="text-xs text-[var(--text-secondary)]">Alliance Impact Seats</div>
            </PremiumCard>
          </div>

          <PremiumCard className="p-6 h-[420px] flex flex-col">
            <h2 className="text-lg font-serif font-bold text-[var(--text-primary)] mb-4">Vote Share: Standalone vs Alliance ({year})</h2>
            <div className="flex-1 w-full min-h-0">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={data.regionalImpact} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--border-subtle)" vertical={false} />
                  <XAxis dataKey="region" stroke="var(--text-secondary)" tick={{ fill: 'var(--text-secondary)', fontSize: 11 }} axisLine={false} tickLine={false} />
                  <YAxis stroke="var(--text-secondary)" tick={{ fill: 'var(--text-secondary)', fontSize: 12 }} axisLine={false} tickLine={false} tickFormatter={(v) => `${v}%`} />
                  <Tooltip contentStyle={{ backgroundColor: 'var(--bg-surface)', border: '1px solid var(--border-subtle)', borderRadius: '8px', color: 'var(--text-primary)' }} />
                  <Legend iconType="circle" wrapperStyle={{ fontSize: '11px' }} />
                  <Bar dataKey="bjpAlone" name="BJP Standalone" fill="#F97316" fillOpacity={0.4} radius={[4, 4, 0, 0]} />
                  <Bar dataKey="bjpAlliance" name="NDA Alliance" fill="#F97316" radius={[4, 4, 0, 0]} />
                  <Bar dataKey="spAlone" name="SP Standalone" fill="#EF4444" fillOpacity={0.4} radius={[4, 4, 0, 0]} />
                  <Bar dataKey="spAlliance" name="SP+ Alliance" fill="#EF4444" radius={[4, 4, 0, 0]} />
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
                  {data.partners?.map((a: any) => (
                    <tr key={a.ally} className="hover:bg-[var(--bg-app)]/30 transition-colors">
                      <td className="px-6 py-4"><span className="px-2 py-1 rounded text-xs font-bold" style={{ backgroundColor: `${colorFor(a.mainParty)}20`, color: colorFor(a.mainParty) }}>{a.mainParty}</span></td>
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
        </>
      ) : (
        <div className="h-64 flex items-center justify-center text-[var(--text-secondary)]">No data found</div>
      )}
    </div>
  );
}
