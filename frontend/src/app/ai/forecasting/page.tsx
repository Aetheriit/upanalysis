"use client";

import { useEffect, useMemo, useState } from "react";
import { AlertTriangle, Brain, Loader2, ShieldCheck, Target, TrendingUp } from "lucide-react";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend, Cell } from "recharts";
import { PageHeader } from "@/components/layout/page-header";
import { PremiumCard } from "@/components/ds/premium-card";
import { getPartyColor } from "@/lib/party-colors";
import { apiUrl } from "@/lib/api";
import { RunControls } from "../prediction/run-controls";
import { ComputationAudit, type FusionAudit } from "../prediction/computation-audit";

const predictionEndpoint = (path: string) => apiUrl(`/api/v1/predictions${path}`);
type Party = "BJP" | "SP" | "BSP" | "RLD" | "INC" | "IPT";
type Forecast = { party: Party; predicted: number; mean?: number; low: number; high: number };
type State = { run_id: string; model_version: string; summary: { quality: string; parties: Forecast[] };
  simulation: { draws: number; seed?: number; max_mean_mc_se?: number; majority_threshold: number; convergence?: { status: string; max_mean_seat_delta?: number; within_diagnostic_tolerances?: boolean }; evidence_sensitivity?: { parties: {party: string; static: number; combined: number; change: number; change_mc_se: number}[] } };
  backtest: { accuracy?: number; log_loss?: number; brier?: number };
  manifest: { fusion_audit?: FusionAudit; evidence_snapshot_id?: string; evidence_cutoff?: string; research?: { model?: string; status?: string; completed?: number; failed?: number } | null } };

const partyLabel = (party: Party) => party === "IPT" ? "Others / Independent (IPT)" : party;
const date = (value?: string) => value ? new Date(value).toLocaleString("en-IN") : "Unavailable";

export default function ForecastingPage() {
  const [state, setState] = useState<State | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [refresh, setRefresh] = useState(0);

  useEffect(() => {
    const controller = new AbortController();
    fetch(predictionEndpoint("/statewide"), { cache: "no-store", signal: controller.signal })
      .then(response => { if (!response.ok) throw new Error("No explicit prediction run is available yet. Press Run to create one."); return response.json(); })
      .then(value => { if (!controller.signal.aborted) { setState(value); setError(null); } })
      .catch(failure => { if (failure.name !== "AbortError") setError(failure.message); })
      .finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
  }, [refresh]);

  const forecast = useMemo(() => state?.summary.parties || [], [state]);
  const bjp = forecast.find(item => item.party === "BJP");
  const sp = forecast.find(item => item.party === "SP");
  const bsp = forecast.find(item => item.party === "BSP");
  const research = state?.manifest.research;
  const scoredSeats = state?.manifest.fusion_audit?.scored_seats ?? 0;
  const metrics = [
    { name: "2017→2022 held-out accuracy", value: state?.backtest.accuracy == null ? "—" : `${state.backtest.accuracy.toFixed(1)}%`, icon: Target, color: "text-emerald-500" },
    { name: "Simulation draws", value: state ? state.simulation.draws.toLocaleString() : "—", icon: Brain, color: "text-blue-500" },
    { name: "Evidence layer", value: scoredSeats ? `${scoredSeats} seats scored` : "No scored evidence", icon: ShieldCheck, color: "text-amber-500" },
    { name: "Run status", value: state?.summary.quality || "—", icon: TrendingUp, color: "text-rose-500" },
  ];

  return <div className="p-8 max-w-[1920px] mx-auto min-h-screen space-y-6">
    <PageHeader title="Forecasting Engine" description="2027 seat simulations combining 2017/2022 booth history with explicitly researched, source-linked web evidence." breadcrumbs={[{ label: "Home", href: "/" }, { label: "AI & Forecasting" }, { label: "Forecasting" }]} />
    <RunControls endpoint={predictionEndpoint} onComplete={() => setRefresh(value => value + 1)} />
    <p className="text-xs text-[var(--text-secondary)]">Forecasting and Prediction share one immutable run. Opening, refreshing or filtering this page only reads the saved run. Every explicit Run executes exactly 10,000 stochastic seat draws after historical and available web evidence are fused.</p>

    {loading ? <div className="h-64 flex items-center justify-center text-[var(--text-secondary)]"><Loader2 className="animate-spin w-8 h-8 text-[var(--accent-primary)]" /></div> : error ? <div className="rounded-lg border border-amber-500/40 p-6 flex items-center gap-2 text-amber-700 dark:text-amber-300"><AlertTriangle className="w-5 h-5" /><span>{error}</span></div> : state && <>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">{metrics.map(metric => <PremiumCard key={metric.name} padding="sm" className="text-center"><metric.icon className={`w-5 h-5 ${metric.color} mx-auto mb-2`} /><div className="text-2xl font-bold text-[var(--text-primary)]">{metric.value}</div><div className="text-xs text-[var(--text-secondary)]">{metric.name}</div></PremiumCard>)}</div>
      <div className="rounded-xl border border-[var(--border-subtle)] p-4 text-sm"><p className="font-semibold">Review snapshot — not an approved publication</p><p className="text-xs text-[var(--text-secondary)]">Run {state.run_id} · {state.model_version} · {state.summary.quality} · evidence cut-off {date(state.manifest.evidence_cutoff)}</p><p className="text-xs text-[var(--text-secondary)]">{research ? `${research.model || "gpt-6-luna"} research status: ${research.status || "completed"}; ${research.completed ?? 0} seats processed, ${research.failed ?? 0} failed.` : "No dynamic web research was included in this saved run."}</p></div>
      <ComputationAudit audit={state.manifest.fusion_audit} simulation={state.simulation} />
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        <PremiumCard className="p-6 lg:col-span-8 h-[450px] flex flex-col"><div className="flex items-center justify-between mb-4"><h2 className="text-lg font-serif font-bold text-[var(--text-primary)] flex items-center gap-2"><Brain className="w-5 h-5 text-[var(--accent-primary)]" /> Seat forecast — 2027</h2><span className="text-xs text-[var(--text-tertiary)]">{state.simulation.draws.toLocaleString()} correlated draws</span></div><div className="flex-1 w-full min-h-0"><ResponsiveContainer width="100%" height="100%"><BarChart data={forecast} margin={{ top: 20, right: 30, left: -20, bottom: 0 }}><CartesianGrid strokeDasharray="3 3" stroke="var(--border-subtle)" vertical={false} /><XAxis dataKey="party" stroke="var(--text-secondary)" tick={{ fill: "var(--text-secondary)", fontSize: 12 }} axisLine={false} tickLine={false} tickFormatter={party => partyLabel(party as Party)} /><YAxis stroke="var(--text-secondary)" tick={{ fill: "var(--text-secondary)", fontSize: 12 }} axisLine={false} tickLine={false} /><Tooltip contentStyle={{ backgroundColor: "var(--bg-surface)", border: "1px solid var(--border-subtle)", borderRadius: "8px", color: "var(--text-primary)" }} /><Legend iconType="circle" wrapperStyle={{ fontSize: "12px" }} /><Bar dataKey="low" name="5th percentile" fillOpacity={0.2} radius={[4, 4, 0, 0]}>{forecast.map(entry => <Cell key={`low-${entry.party}`} fill={getPartyColor(entry.party === "IPT" ? "Others" : entry.party)} />)}</Bar><Bar dataKey="predicted" name="Mean seats" radius={[4, 4, 0, 0]}>{forecast.map(entry => <Cell key={`mean-${entry.party}`} fill={getPartyColor(entry.party === "IPT" ? "Others" : entry.party)} />)}</Bar><Bar dataKey="high" name="95th percentile" fillOpacity={0.5} radius={[4, 4, 0, 0]}>{forecast.map(entry => <Cell key={`high-${entry.party}`} fill={getPartyColor(entry.party === "IPT" ? "Others" : entry.party)} />)}</Bar></BarChart></ResponsiveContainer></div></PremiumCard>
        <div className="lg:col-span-4 flex flex-col gap-6"><PremiumCard className="p-6"><h3 className="text-sm font-bold uppercase tracking-wider mb-4">Model inputs</h3><div className="space-y-3 text-xs"><div className="flex justify-between"><span>Historical data</span><span>2017 + 2022 booths/ECI</span></div><div className="flex justify-between"><span>Web evidence</span><span>{scoredSeats ? `${scoredSeats} seats, quality gated` : "Not included"}</span></div><div className="flex justify-between"><span>Simulation</span><span>{state.simulation.draws.toLocaleString()} real draws</span></div><div className="flex justify-between"><span>Majority reference</span><span>{state.simulation.majority_threshold} seats</span></div><div className="flex justify-between"><span>Seed</span><span>{state.simulation.seed ?? "Archived"}</span></div></div></PremiumCard><PremiumCard className="p-6"><h3 className="text-sm font-bold uppercase tracking-wider mb-4">Key outcomes</h3><div className="space-y-3 text-sm text-[var(--text-secondary)]"><p>BJP: {bjp?.predicted} seats ({bjp?.low}–{bjp?.high})</p><p>SP: {sp?.predicted} seats ({sp?.low}–{sp?.high})</p><p>BSP: {bsp?.predicted} seats ({bsp?.low}–{bsp?.high})</p><p>Seat ranges are simulation outputs, not observed results or calibrated future guarantees.</p></div></PremiumCard></div>
      </div>
      <div className="rounded-lg bg-amber-500/10 p-4 text-sm"><AlertTriangle className="inline mr-2" size={18} />Web evidence is a noisy, source-linked atmosphere signal, not representative polling. It affects fused probabilities only when the explicit run successfully validates citations and quality gates. Demographic context is not treated as party preference.</div>
    </>}
  </div>;
}
