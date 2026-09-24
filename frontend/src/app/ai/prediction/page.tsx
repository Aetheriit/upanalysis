"use client";

import { useEffect, useMemo, useState } from "react";
import { AlertTriangle, ChevronLeft, ChevronRight, Download, ExternalLink, Loader2, RefreshCw, Search, X } from "lucide-react";
import { PageHeader } from "@/components/layout/page-header";
import { PremiumCard } from "@/components/ds/premium-card";
import { apiUrl } from "@/lib/api";
import { getPartyColor } from "@/lib/party-colors";
import { downloadCsv, downloadJson } from "@/lib/export";

const PARTIES = ["BJP", "SP", "BSP", "RLD", "INC", "IPT"] as const;
type Party = typeof PARTIES[number];
type Prediction = {
  code: string; name: string; district: string; predicted_party: Party;
  predicted_margin: number | null; predicted_vote_share: number | null;
  change: string; is_flip: boolean; confidence: number; confidence_label: string;
  probability_gap: number; historical_winner_2022: string;
  final: { probabilities: Record<Party, number>; weights: { statistical: number; atmosphere: number } };
  statistical: { key_factors: string[] };
  atmosphere: { scoring_status: string; sources_count: number };
  booth_audit: { current?: number; matched?: number; ambiguous?: number };
};
type StateResult = {
  run_id: string; status: string; created_at: string; quality_flags: string[];
  manifest: { evidence_snapshot_id?: string; evidence_cutoff?: string };
  summary: { total_seats: number; majority: number; quality: string; model: string;
    parties: { party: Party; predicted: number; low: number; high: number }[] };
  backtest: { status: string; accuracy?: number; log_loss?: number; brier?: number; limitations?: string[] };
};
type Scan = { snapshot_id?: string; status: string; expected: number; completed: number; seats_with_results?: number;
  queries_ok?: number; queries_failed?: number; unique_urls?: number; cutoff?: string; freshness_counts?: Record<string, number> };
type Source = { id: string; url: string; headline: string; publisher: string; published_at: string; retrieved_at: string;
  geo_scope: string; issue_tags: string[]; cluster_id: string; duplicate_count: number; content_basis: string };
type Link = { title: string; url: string };
type Evidence = { snapshot_id?: string; code: string; status: string; freshness: string; items: Source[]; cluster_count?: number;
  queries: { query: string; family: string; status: string; returned?: number; error_type?: string }[];
  context?: { status: string; limitations: string[]; references: Link[];
    demographics?: { district_2011: string; year: number; population: number; religion_pct: Record<string, number>;
      source_url: string; socioeconomic?: Record<string, number>; socioeconomic_source_url?: string };
    ugc_context: { summary: string; legal_status_note: string; sources: Link[] } } };
const externalApi = process.env.NEXT_PUBLIC_PREDICTION_API_URL?.replace(/\/$/, "");
const labelParty = (party: string) => party === "IPT" ? "Others / Independent (IPT)" : party;
const date = (value?: string) => value ? new Date(value).toLocaleString("en-IN") : "Unavailable";
const color = (party: string) => getPartyColor(party === "IPT" ? "Others" : party);

async function get<T>(path: string, signal?: AbortSignal): Promise<T> {
  const response = await fetch(externalApi ? `${externalApi}${path}` : apiUrl(`/api/v1/predictions${path}`), { cache: "no-store", signal });
  if (!response.ok) throw new Error(response.status === 503 ? "The model is being prepared. Evidence remains available; refresh to check the model run." : `Prediction service returned ${response.status}`);
  return response.json();
}

function EvidencePanel({ row, close }: { row: Prediction; close: () => void }) {
  const [evidence, setEvidence] = useState<Evidence | null>(null);
  const [error, setError] = useState("");
  const [issue, setIssue] = useState("");
  const [scope, setScope] = useState("");
  const [page, setPage] = useState(1);
  useEffect(() => {
    const controller = new AbortController();
    get<Evidence>(`/evidence/${encodeURIComponent(row.code)}`, controller.signal).then(setEvidence).catch((error: Error) => {
      if (error.name !== "AbortError") setError(error.message);
    });
    return () => controller.abort();
  }, [row.code]);
  const tags = useMemo(() => [...new Set(evidence?.items.flatMap(item => item.issue_tags) || [])].sort(), [evidence]);
  const filtered = useMemo(() => evidence?.items.filter(item => (!issue || item.issue_tags.includes(issue)) && (!scope || item.geo_scope === scope)) || [], [evidence, issue, scope]);
  const demographic = evidence?.context?.demographics;
  return <section aria-labelledby="seat-detail-title" className="space-y-5 rounded-xl border border-[var(--border-subtle)] p-5 bg-[var(--bg-card)]">
    <div className="flex justify-between gap-3"><div><h2 id="seat-detail-title" className="text-xl font-semibold">{row.name} · AC {row.code}</h2><p className="text-sm text-[var(--text-secondary)]">{row.district} · 2022 winner: {row.historical_winner_2022} · {row.change}</p></div><button onClick={close} aria-label="Close constituency detail" className="p-2 self-start"><X size={20} /></button></div>
    <div className="grid grid-cols-2 md:grid-cols-6 gap-3">{PARTIES.map(party => <div key={party} className="p-3 rounded-lg bg-[var(--bg-app)]"><div className="text-xs">{party}</div><div className="font-semibold">{(100 * row.final.probabilities[party]).toFixed(1)}%</div><div className="text-xs text-[var(--text-tertiary)]">model win probability</div></div>)}</div>
    <p className="text-sm">Probability gap: {(row.probability_gap * 100).toFixed(1)} points. Atmosphere weight: {(row.final.weights.atmosphere * 100).toFixed(1)}%. Matched booths: {row.booth_audit.matched?.toLocaleString() ?? "—"} / {row.booth_audit.current?.toLocaleString() ?? "—"}.</p>
    <p className="text-xs text-[var(--text-secondary)]">{row.statistical.key_factors.join(" ")} Search coverage is separate from scored evidence. Latest discovery results below may be newer than the model&apos;s pinned evidence snapshot.</p>
    {error && <p role="alert" className="text-rose-500">{error}</p>}
    {!evidence && !error && <p role="status" className="flex gap-2"><Loader2 className="animate-spin" size={18} /> Loading evidence…</p>}
    {evidence && <>
      <div className="flex flex-wrap justify-between gap-3"><div><h3 className="font-semibold">Evidence explorer</h3><p className="text-xs text-[var(--text-secondary)]">{evidence.status} · {evidence.freshness} · {evidence.cluster_count ?? 0} headline clusters · snapshot {evidence.snapshot_id}</p></div><button className="text-sm underline" onClick={() => downloadJson(`evidence-ac-${row.code}.json`, evidence)}>Export evidence JSON</button></div>
      <p className="text-sm rounded-lg p-3 bg-amber-500/10 text-amber-700 dark:text-amber-300">Discovery only: headlines are unreviewed, not polling. Party-impact scoring is bypassed without a source-checked API. Location matches and duplicate clustering require review; no automatic electoral swing is inferred.</p>
      <div className="flex gap-3 flex-wrap"><select aria-label="Filter evidence by issue" value={issue} onChange={event => { setIssue(event.target.value); setPage(1); }} className="p-2 rounded border bg-[var(--bg-app)]"><option value="">All issues</option>{tags.map(tag => <option key={tag}>{tag}</option>)}</select><select aria-label="Filter evidence by geographic scope" value={scope} onChange={event => { setScope(event.target.value); setPage(1); }} className="p-2 rounded border bg-[var(--bg-app)]"><option value="">All locations</option><option value="constituency">Constituency mention</option><option value="district">District mention</option><option value="unknown">Location unverified</option></select></div>
      <div className="divide-y divide-[var(--border-subtle)]">{filtered.slice((page - 1) * 10, page * 10).map(item => <article key={item.id} className="py-4 space-y-2"><a href={item.url} target="_blank" rel="noopener noreferrer" className="font-medium hover:underline">{item.headline} <ExternalLink className="inline" size={13} /></a><p className="text-xs text-[var(--text-secondary)]">{item.publisher} · Published {date(item.published_at)} · Retrieved {date(item.retrieved_at)}</p><p className="text-xs">{item.geo_scope} (unverified) · {item.issue_tags.join(", ") || "Unclassified"} · {item.duplicate_count} item(s) in cluster</p><details className="text-xs text-[var(--text-tertiary)]"><summary>Provenance</summary>{item.content_basis} · cluster {item.cluster_id} · item {item.id}</details></article>)}</div>
      {!filtered.length && <p>No matching sources. Missing coverage does not mean no local events occurred.</p>}
      <div className="flex gap-4 items-center text-sm"><button disabled={page === 1} onClick={() => setPage(page - 1)} className="disabled:opacity-30">Previous sources</button><span>{page} / {Math.max(1, Math.ceil(filtered.length / 10))} · {filtered.length} results</span><button disabled={page * 10 >= filtered.length} onClick={() => setPage(page + 1)} className="disabled:opacity-30">Next sources</button></div>
      <details className="text-sm"><summary className="cursor-pointer font-medium">Search audit ({evidence.queries.length} queries)</summary>{evidence.queries.map(query => <p key={query.family} className="my-2 text-xs">{query.status}: {query.query} · returned {query.returned ?? "—"} {query.error_type}</p>)}</details>
      <details className="text-sm"><summary className="cursor-pointer font-medium">Official demographic and economic context</summary><p className="my-3">{demographic ? `${demographic.district_2011} district · Census ${demographic.year} · population ${demographic.population.toLocaleString()}` : "No verified matching district data available."}</p>{demographic && <><div className="flex flex-wrap gap-4">{Object.entries(demographic.religion_pct).map(([key, value]) => <span key={key}>{key}: {value.toFixed(2)}%</span>)}</div><div className="flex flex-wrap gap-4 mt-3">{Object.entries(demographic.socioeconomic || {}).map(([key, value]) => <span key={key}>{key.replaceAll("_", " ")}: {value.toFixed(2)}%</span>)}</div></>}<p className="mt-3 text-amber-700 dark:text-amber-300">{evidence.context?.limitations.join(" ")}</p><div className="flex flex-col gap-2 mt-3">{evidence.context?.references.map(link => <a className="underline" key={link.url} href={link.url} target="_blank" rel="noopener noreferrer">{link.title}</a>)}</div></details>
      <details className="text-sm"><summary className="cursor-pointer font-medium">UGC example — fact check and limitations</summary><p className="mt-3">{evidence.context?.ugc_context.summary}</p><p className="my-3">{evidence.context?.ugc_context.legal_status_note}</p>{evidence.context?.ugc_context.sources.map(link => <a key={link.url} href={link.url} target="_blank" rel="noopener noreferrer" className="block underline my-2">{link.title}</a>)}</details>
    </>}
  </section>;
}

export default function PredictionPage() {
  const [state, setState] = useState<StateResult | null>(null);
  const [scan, setScan] = useState<Scan | null>(null);
  const [rows, setRows] = useState<Prediction[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [party, setParty] = useState("");
  const [refresh, setRefresh] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [evidenceError, setEvidenceError] = useState("");
  const [selected, setSelected] = useState<Prediction | null>(null);
  useEffect(() => {
    const controller = new AbortController();
    const timer = setTimeout(() => {
      setLoading(true); setError("");
      const query = new URLSearchParams({ page: String(page), page_size: "50", search, party });
      get<StateResult>("/statewide", controller.signal)
        .then(async current => {
          query.set("run_id", current.run_id);
          const list = await get<{ predictions: Prediction[]; total: number }>(`/list?${query}`, controller.signal);
          if (!controller.signal.aborted) { setState(current); setRows(list.predictions); setTotal(list.total); }
        })
        .catch((error: Error) => { if (error.name !== "AbortError") setError(error.message); })
        .finally(() => { if (!controller.signal.aborted) setLoading(false); });
      get<Scan>("/evidence/status", controller.signal).then(value => { setScan(value); setEvidenceError(""); }).catch((error: Error) => { if (error.name !== "AbortError") setEvidenceError(error.message); });
    }, 200);
    return () => { clearTimeout(timer); controller.abort(); };
  }, [page, search, party, refresh]);
  const pages = Math.max(1, Math.ceil(total / 50));
  const exportPage = () => downloadCsv("up-2027-predictions-page.csv", rows.map(row => ({
    constituency_code: row.code, constituency_name: row.name, Winning_Party: row.predicted_party,
    Winning_margin: row.predicted_margin, Vote_share: row.predicted_vote_share, Change: row.change,
    win_probability: row.final.probabilities[row.predicted_party], run_id: state?.run_id, status: state?.status,
    evidence_snapshot_id: state?.manifest.evidence_snapshot_id, evidence_cutoff: state?.manifest.evidence_cutoff,
    atmosphere_weight: row.final.weights.atmosphere, caveat: "Model estimates; vote-share and margin model unavailable.",
  })));
  return <div className="p-4 md:p-8 max-w-[1920px] mx-auto min-h-screen space-y-6">
    <PageHeader title="2027 Prediction Engine" description="Historical booth analysis and traceable public evidence across 403 Uttar Pradesh assembly seats." breadcrumbs={[{ label: "Home", href: "/" }, { label: "Prediction" }]} action={<button disabled={!rows.length} onClick={exportPage} className="flex gap-2 items-center px-4 py-2 rounded-lg border disabled:opacity-40"><Download size={16} /> Export page</button>} />
    <div className="flex justify-between items-start gap-4 text-sm"><div>{state ? <><p className="font-semibold">Review snapshot — not an approved publication</p><p className="text-xs text-[var(--text-secondary)]">Run {state.run_id} · {date(state.created_at)} · {state.summary.quality}</p><p className="text-xs text-[var(--text-secondary)]">Model evidence cut-off: {date(state.manifest.evidence_cutoff)}</p></> : <p>2027 model workspace</p>}</div><button aria-label="Refresh prediction and evidence status" onClick={() => setRefresh(refresh + 1)} className="p-2 rounded-lg border"><RefreshCw size={18} /></button></div>
    {state && <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-4">{state.summary.parties.map(item => <PremiumCard key={item.party} padding="sm" className="border-t-4" style={{ borderTopColor: color(item.party) }}><div className="text-xs text-[var(--text-secondary)]">{labelParty(item.party)}</div><div className="text-3xl font-bold mt-2">{item.predicted}</div><div className="text-xs text-[var(--text-tertiary)]">simulated seats · 90% range {item.low}–{item.high}</div></PremiumCard>)}</div>}
    <PremiumCard className="p-5 space-y-2"><h2 className="font-semibold">Live evidence coverage</h2>{scan ? <><p>{scan.completed} / {scan.expected} constituencies searched · {scan.seats_with_results ?? 0} with results · {(scan.unique_urls ?? 0).toLocaleString()} unique links</p><p className="text-xs text-[var(--text-secondary)]">{scan.status} · {scan.queries_ok ?? 0} successful queries · {scan.queries_failed ?? 0} failed · cut-off {date(scan.cutoff)}</p></> : <p>{evidenceError || "Loading search coverage…"}</p>}<p className="text-xs text-[var(--text-secondary)]">Discovery coverage is not verified atmosphere coverage. News volume is not public opinion. Select a constituency to inspect sources, dates, geography and missing inputs.</p></PremiumCard>
    <div className="flex gap-2 text-sm p-4 rounded-lg bg-amber-500/10"><AlertTriangle size={20} className="shrink-0" /><p>Win probability is not vote share. Margin and vote-share estimates remain unavailable until a separately validated model exists. Seat ranges use provisional shock assumptions; demographic context is not used to assign party preferences.</p></div>
    {selected && <EvidencePanel key={selected.code} row={selected} close={() => setSelected(null)} />}
    <PremiumCard padding="none" className="overflow-hidden"><div className="p-4 border-b border-[var(--border-subtle)] flex flex-wrap gap-3 justify-between"><div className="relative"><Search size={16} className="absolute left-3 top-3" /><input aria-label="Search constituencies" value={search} onChange={event => { setSearch(event.target.value); setPage(1); }} placeholder="Constituency or district…" className="pl-9 pr-3 py-2 rounded border bg-[var(--bg-app)]" /></div><select aria-label="Filter by leading party" value={party} onChange={event => { setParty(event.target.value); setPage(1); }} className="p-2 border rounded bg-[var(--bg-app)]"><option value="">All parties</option>{PARTIES.map(party => <option key={party} value={party}>{labelParty(party)}</option>)}</select></div>
      {error && <p role="alert" className="p-6 text-rose-500">{error}</p>}
      {loading ? <div role="status" className="p-12 flex justify-center gap-3"><Loader2 className="animate-spin" /> Loading predictions…</div> : !error && <div className="overflow-x-auto"><table className="w-full text-left"><caption className="sr-only">2027 model predictions, 50 constituencies per page. Select a seat for evidence.</caption><thead className="bg-[var(--bg-app)]"><tr>{["Constituency", "Winning Party", "Winning Margin", "Vote Share", "Change"].map(label => <th scope="col" key={label} className="px-5 py-4 text-xs uppercase whitespace-nowrap">{label}</th>)}</tr></thead><tbody className="divide-y divide-[var(--border-subtle)]">{rows.map(row => <tr key={row.code}><td className="px-5 py-3"><button className="text-sm font-semibold underline underline-offset-4 text-left" onClick={() => setSelected(row)}>{row.name}</button><div className="text-xs text-[var(--text-tertiary)]">AC {row.code} · {row.district}</div></td><td className="px-5 py-3"><span className="font-semibold" style={{ color: color(row.predicted_party) }}>{row.predicted_party}</span><div className="text-xs text-[var(--text-secondary)]">{(row.final.probabilities[row.predicted_party] * 100).toFixed(1)}% win probability</div></td><td className="px-5 py-3 text-sm">{row.predicted_margin == null ? "Unavailable" : row.predicted_margin.toLocaleString()}</td><td className="px-5 py-3 text-sm">{row.predicted_vote_share == null ? "Unavailable" : `${row.predicted_vote_share.toFixed(1)}%`}</td><td className="px-5 py-3 text-sm">{row.change}</td></tr>)}</tbody></table>{!rows.length && <p className="p-6">No constituencies match these filters.</p>}</div>}
      <div className="p-4 border-t border-[var(--border-subtle)] flex flex-wrap justify-between items-center gap-3 text-sm"><span>Showing {total ? (page - 1) * 50 + 1 : 0}–{Math.min(page * 50, total)} of {total}</span><div className="flex items-center gap-3"><button aria-label="Previous constituency page" disabled={page === 1 || loading} onClick={() => setPage(page - 1)} className="p-2 border rounded disabled:opacity-30"><ChevronLeft size={16} /></button><span>Page {page} of {pages}</span><button aria-label="Next constituency page" disabled={page >= pages || loading} onClick={() => setPage(page + 1)} className="p-2 border rounded disabled:opacity-30"><ChevronRight size={16} /></button></div></div>
    </PremiumCard>
    {state && <details className="text-sm p-5 border rounded-xl"><summary className="font-semibold cursor-pointer">Model quality &amp; limitations</summary><p className="mt-3">{state.backtest.status} · winner accuracy {state.backtest.accuracy?.toFixed(1) ?? "—"}% · log loss {state.backtest.log_loss?.toFixed(3) ?? "—"} · Brier {state.backtest.brier?.toFixed(3) ?? "—"}</p><p className="mt-2">{state.backtest.limitations?.join(" ")}</p><p className="mt-2 text-xs">Release flags: {state.quality_flags.join(", ")}. Predictions are conditional model outputs, not election facts.</p></details>}
  </div>;
}
