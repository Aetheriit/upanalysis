"use client";

import { useEffect, useMemo, useState } from "react";
import { Download, Handshake, Loader2, Users, AlertTriangle } from "lucide-react";
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
  const chartData = useMemo(() => alliance && data ? data.regions.map(region => ({ region: region.region, standalone: Number(region[`${alliance.short_name}_standalone`] || 0), pooled: Number(region[`${alliance.short_name}_pooled`] || 0) })) : [], [data, alliance]);

  return <div className="p-8 max-w-[1920px] mx-auto min-h-screen space-y-6">
    <PageHeader title="Alliance Impact Analysis" description="Election-result-based alliance performance and transparent pooled-vote analysis." breadcrumbs={[{ label: "Home", href: "/" }, { label: "Analytics Lab" }, { label: "Alliance Impact" }]} action={<button onClick={() => alliance && data && downloadCsv(data, alliance)} disabled={!alliance} className="px-4 py-2 bg-[var(--accent-primary)] text-[var(--bg-app)] disabled:opacity-50 rounded-lg text-sm font-medium transition-colors flex items-center gap-2"><Download className="w-4 h-4" /> Export CSV</button>} />
    <div className="flex flex-wrap items-center gap-3">{[2017, 2022].map(option => <button key={option} onClick={() => setYear(option)} className={`px-4 py-2 rounded-lg border text-sm font-medium ${year === option ? "bg-[var(--accent-primary)] text-[var(--bg-app)] border-transparent" : "bg-[var(--bg-surface)] text-[var(--text-secondary)] border-[var(--border-subtle)]"}`}>{option} Results</button>)}{data && <select value={selectedIndex} onChange={e => setSelectedIndex(Number(e.target.value))} className="px-4 py-2 rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-surface)] text-[var(--text-primary)] text-sm">{data.alliances.map((item, index) => <option key={item.name} value={index}>{item.name}</option>)}</select>}</div>
    {(loading || !data || data.year !== year) && <div className="flex min-h-[50vh] items-center justify-center"><Loader2 className="w-8 h-8 animate-spin text-[var(--accent-primary)]" /></div>}
    {error && <PremiumCard className="p-8 text-center"><AlertTriangle className="mx-auto mb-3 text-red-500" /><p className="text-[var(--text-primary)]">{error}</p></PremiumCard>}
    {!loading && !error && data && data.year === year && alliance && <>
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4"><PremiumCard padding="sm" className="text-center"><Handshake className="w-5 h-5 text-[var(--accent-primary)] mx-auto mb-2" /><div className="text-2xl font-bold text-[var(--text-primary)]">{alliance.partners.length}</div><div className="text-xs text-[var(--text-secondary)]">Observed alliance parties</div></PremiumCard><PremiumCard padding="sm" className="text-center"><Users className="w-5 h-5 mx-auto mb-2" style={{ color: colorFor(alliance.main_party) }} /><div className="text-2xl font-bold text-[var(--text-primary)]">{alliance.actual_seats}</div><div className="text-xs text-[var(--text-secondary)]">Actual alliance seats</div></PremiumCard><PremiumCard padding="sm" className="text-center"><Users className="w-5 h-5 text-[var(--accent-primary)] mx-auto mb-2" /><div className="text-2xl font-bold text-[var(--text-primary)]">{alliance.pooled_seats}</div><div className="text-xs text-[var(--text-secondary)]">Pooled-vote seats</div></PremiumCard><PremiumCard padding="sm" className="text-center"><Handshake className="w-5 h-5 text-emerald-500 mx-auto mb-2" /><div className="text-2xl font-bold text-[var(--text-primary)]">{alliance.seat_change >= 0 ? "+" : ""}{alliance.seat_change}</div><div className="text-xs text-[var(--text-secondary)]">Counterfactual seat change</div></PremiumCard></div>
      <PremiumCard className="p-6 h-[440px] flex flex-col"><div className="flex flex-wrap justify-between gap-2 mb-4"><h2 className="text-lg font-serif font-bold text-[var(--text-primary)]">Standalone vs pooled vote share by region</h2><span className="text-xs text-[var(--text-secondary)]">{data.year} · {alliance.name}</span></div><div className="flex-1 min-h-0"><ResponsiveContainer width="100%" height="100%"><BarChart data={chartData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}><CartesianGrid strokeDasharray="3 3" stroke="var(--border-subtle)" vertical={false} /><XAxis dataKey="region" stroke="var(--text-secondary)" tick={{ fill: "var(--text-secondary)", fontSize: 11 }} axisLine={false} tickLine={false} /><YAxis stroke="var(--text-secondary)" tick={{ fill: "var(--text-secondary)", fontSize: 12 }} axisLine={false} tickLine={false} tickFormatter={value => `${value}%`} /><Tooltip formatter={value => `${Number(value).toFixed(2)}%`} contentStyle={{ backgroundColor: "var(--bg-surface)", border: "1px solid var(--border-subtle)", borderRadius: 8 }} /><Legend /><Bar dataKey="standalone" name={`${alliance.main_party} standalone`} fill={colorFor(alliance.main_party)} fillOpacity={0.4} radius={[4, 4, 0, 0]} /><Bar dataKey="pooled" name={`${alliance.short_name} pooled`} fill={colorFor(alliance.main_party)} radius={[4, 4, 0, 0]} /></BarChart></ResponsiveContainer></div></PremiumCard>
      <PremiumCard className="p-0 overflow-hidden"><div className="p-4 border-b border-[var(--border-subtle)]"><h2 className="text-lg font-serif font-bold text-[var(--text-primary)]">Alliance member performance</h2><p className="mt-1 text-xs text-[var(--text-secondary)]">Direct aggregation of recorded candidate votes and winners for {data.year}.</p></div><div className="overflow-x-auto"><table className="w-full text-left"><thead><tr className="bg-[var(--bg-app)]/50 border-b border-[var(--border-subtle)]">{["Party", "Seats contested", "Seats won", "Votes", "Vote share"].map(header => <th key={header} className="px-6 py-3 text-xs font-semibold text-[var(--text-secondary)] uppercase">{header}</th>)}</tr></thead><tbody className="divide-y divide-[var(--border-subtle)]">{alliance.partners.map(partner => <tr key={partner.party}><td className="px-6 py-4"><span className="px-2 py-1 rounded text-xs font-bold" style={{ backgroundColor: `${colorFor(partner.party)}20`, color: colorFor(partner.party) }}>{partner.party}</span></td><td className="px-6 py-4 text-sm text-[var(--text-primary)]">{partner.seats_contested}</td><td className="px-6 py-4 text-sm font-bold text-[var(--text-primary)]">{partner.seats_won}</td><td className="px-6 py-4 text-sm text-[var(--text-primary)]">{partner.votes.toLocaleString()}</td><td className="px-6 py-4 text-sm text-[var(--text-primary)]">{partner.vote_share.toFixed(2)}%</td></tr>)}</tbody></table></div></PremiumCard>
      <p className="text-xs leading-relaxed text-[var(--text-secondary)]">Methodology: {data.methodology}</p>
    </>}
  </div>;
}
