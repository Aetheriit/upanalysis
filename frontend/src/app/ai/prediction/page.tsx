"use client";

import { useEffect, useMemo, useState } from "react";
import { AlertTriangle, ChevronLeft, ChevronRight, Download, Loader2, Search, Target, RefreshCw } from "lucide-react";
import { PageHeader } from "@/components/layout/page-header";
import { PremiumCard } from "@/components/ds/premium-card";
import { apiUrl } from "@/lib/api";
import { getPartyColor } from "@/lib/party-colors";
import { downloadCsv } from "@/lib/export";

type Party = "BJP" | "SP" | "BSP" | "RLD" | "INC" | "IPT";
const PARTIES: Party[] = ["BJP", "SP", "BSP", "RLD", "INC", "IPT"];
const externalApi = process.env.NEXT_PUBLIC_PREDICTION_API_URL?.replace(/\/$/, "");

async function predictionFetch(path: string) {
  const url = externalApi ? `${externalApi}${path}` : apiUrl(`/api/v1/predictions${path}`);
  const response = await fetch(url, { cache: "no-store" });
  if (!response.ok) throw new Error(`Prediction API returned ${response.status}`);
  return response.json();
}

function labelParty(party: string) { return party === "IPT" ? "Others / Independent (IPT)" : party; }

export default function PredictionPage() {
  const [summary, setSummary] = useState<any>(null);
  const [rows, setRows] = useState<any[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [party, setParty] = useState("All Parties");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const pageSize = 50;

  async function load() {
    setLoading(true); setError(null);
    try {
      const query = new URLSearchParams({ page: String(page), page_size: String(pageSize) });
      if (search) query.set("search", search);
      if (party !== "All Parties") query.set("party", party);
      const [state, list] = await Promise.all([predictionFetch("/statewide"), predictionFetch(`/list?${query}`)]);
      setSummary(state.summary); setRows(list.predictions || []); setTotal(list.total || 0);
    } catch (e: any) { setError(e.message || "Unable to load predictions"); }
    finally { setLoading(false); }
  }

  useEffect(() => { load(); }, [page, search, party]);
  useEffect(() => { setPage(1); }, [search, party]);

  const pages = Math.max(1, Math.ceil(total / pageSize));
  const exportRows = useMemo(() => rows.map(row => ({
    constituency_name: row.name,
    Winning_Party: labelParty(row.predicted_party),
    Winning_margin: row.predicted_margin,
    Vote_share: `${row.predicted_vote_share}%`,
    Change: row.change,
  })), [rows]);

  return <div className="p-8 max-w-[1920px] mx-auto min-h-screen space-y-6">
    <PageHeader title="2027 Prediction Engine" description="Constituency-level forecast for all 403 Uttar Pradesh assembly seats." breadcrumbs={[{ label: "Home", href: "/" }, { label: "Prediction" }]} action={<button onClick={() => downloadCsv("up-2027-predictions.csv", exportRows)} className="px-4 py-2 bg-[var(--accent-primary)] text-[var(--bg-app)] rounded-lg text-sm font-medium flex items-center gap-2"><Download className="w-4 h-4" /> Export page</button>} />

    {summary && <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-4">
      {summary.parties.map((item: any) => <PremiumCard key={item.party} padding="sm" className="relative overflow-hidden"><div className="absolute left-0 top-0 bottom-0 w-1" style={{ backgroundColor: getPartyColor(item.party === "IPT" ? "Others" : item.party) }} /><div className="text-xs text-[var(--text-secondary)]">{labelParty(item.party)}</div><div className="text-3xl font-bold mt-2 text-[var(--text-primary)]">{item.predicted}</div><div className="text-xs text-[var(--text-tertiary)]">possible seats · {item.low}-{item.high}</div></PremiumCard>)}
    </div>}

    <PremiumCard className="p-6"><div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4"><div><div className="flex items-center gap-2 text-lg font-serif font-bold"><Target className="w-5 h-5 text-[var(--accent-primary)]" /> 2027 statewide projection</div><p className="text-xs text-[var(--text-secondary)] mt-1">{summary ? `${summary.total_seats} seats · majority ${summary.majority} · ${summary.model}` : "Loading model output..."}</p></div><div className="flex items-center gap-3 text-xs text-[var(--text-secondary)]"><span className="px-2 py-1 rounded-full bg-amber-500/10 text-amber-600">{externalApi ? "External API" : "Local ensemble"}</span><button onClick={load} className="p-2 rounded-lg border border-[var(--border-subtle)] hover:bg-[var(--bg-app)]"><RefreshCw className="w-4 h-4" /></button></div></div><div className="mt-5 h-3 rounded-full overflow-hidden flex bg-[var(--border-subtle)]">{summary?.parties.map((item: any) => <div key={item.party} style={{ width: `${(item.predicted / Math.max(summary.total_seats, 1)) * 100}%`, backgroundColor: getPartyColor(item.party === "IPT" ? "Others" : item.party) }} title={`${labelParty(item.party)}: ${item.predicted}`} />)}</div></PremiumCard>

    <PremiumCard padding="none" className="overflow-hidden"><div className="p-4 border-b border-[var(--border-subtle)] flex flex-col md:flex-row gap-3 md:items-center md:justify-between"><div className="relative w-full md:w-80"><Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--text-tertiary)]" /><input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search constituency or district..." className="w-full pl-9 pr-3 py-2 bg-[var(--bg-app)] border border-[var(--border-subtle)] rounded-lg text-sm outline-none" /></div><select value={party} onChange={e => setParty(e.target.value)} className="px-3 py-2 bg-[var(--bg-app)] border border-[var(--border-subtle)] rounded-lg text-sm"> <option>All Parties</option>{PARTIES.map(item => <option key={item} value={item}>{labelParty(item)}</option>)}</select></div><div className="overflow-x-auto">{loading ? <div className="h-64 flex items-center justify-center"><Loader2 className="w-7 h-7 animate-spin text-[var(--accent-primary)]" /></div> : error ? <div className="h-64 flex items-center justify-center gap-2 text-rose-500"><AlertTriangle className="w-5 h-5" />{error}</div> : <table className="w-full text-left"><thead><tr className="bg-[var(--bg-app)]/50 border-b border-[var(--border-subtle)]">{["Constituency", "Winning Party", "Winning Margin", "Vote Share", "Change"].map(header => <th key={header} className="px-5 py-4 text-xs uppercase tracking-wider text-[var(--text-secondary)] whitespace-nowrap">{header}</th>)}</tr></thead><tbody className="divide-y divide-[var(--border-subtle)]">{rows.map(row => <tr key={row.code || row.name} className="hover:bg-[var(--bg-app)]/30"><td className="px-5 py-3"><div className="text-sm font-semibold">{row.name}</div><div className="text-xs text-[var(--text-tertiary)]">{row.code} · {row.district}</div></td><td className="px-5 py-3"><span className="inline-flex px-2.5 py-1 rounded-full text-xs font-bold" style={{ color: getPartyColor(row.predicted_party === "IPT" ? "Others" : row.predicted_party), backgroundColor: `${getPartyColor(row.predicted_party === "IPT" ? "Others" : row.predicted_party)}18` }}>{labelParty(row.predicted_party)}</span></td><td className="px-5 py-3 text-sm font-mono">{Number(row.predicted_margin || 0).toLocaleString()}</td><td className="px-5 py-3 text-sm font-mono">{row.predicted_vote_share}%</td><td className={`px-5 py-3 text-sm font-medium ${row.is_flip ? "text-rose-500" : "text-emerald-500"}`}>{row.change}</td></tr>)}</tbody></table>}</div><div className="p-4 border-t border-[var(--border-subtle)] flex items-center justify-between text-sm text-[var(--text-secondary)]"><span>Showing {total ? (page - 1) * pageSize + 1 : 0}-{Math.min(page * pageSize, total)} of {total} constituencies</span><div className="flex gap-2"><button disabled={page === 1} onClick={() => setPage(value => value - 1)} className="px-3 py-1.5 border rounded disabled:opacity-40"><ChevronLeft className="w-4 h-4" /></button><span className="px-3 py-1.5">Page {page} of {pages}</span><button disabled={page >= pages} onClick={() => setPage(value => value + 1)} className="px-3 py-1.5 border rounded disabled:opacity-40"><ChevronRight className="w-4 h-4" /></button></div></div></PremiumCard>
  </div>;
}
