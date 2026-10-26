"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Brain, Loader2, Send, Sparkles } from "lucide-react";
import { PremiumCard } from "@/components/ds/premium-card";

export type AIResult = { response: string; caveats: string[]; sources: { label: string; path: string }[]; cached: boolean; cost_usd: number; model: string; gis: { year: 2017 | 2022; query_type: string; party: string; codes: string[]; count: number } };
type Turn = { role: "user" | "assistant"; content: string; result?: AIResult };
type Status = { configured: boolean; model: string; requests_today: number; estimated_usd_today: number; daily_budget_usd: number; daily_request_limit: number };

export function AIUsage() {
  const [status, setStatus] = useState<Status | null>(null);
  const [error, setError] = useState("");
  useEffect(() => { const controller = new AbortController(); fetch("/api/ai/status", { cache: "no-store", signal: controller.signal }).then(async response => {
    const data = await response.json(); if (!response.ok) throw new Error(typeof data.detail === "string" ? data.detail : "AI status is unavailable"); setStatus(data);
  }).catch((cause: Error) => { if (cause.name !== "AbortError") setError(cause.message); }); return () => controller.abort(); }, []);
  return <PremiumCard className="p-6"><h2 className="font-serif text-lg font-bold flex items-center gap-2"><Brain size={20} />AI service & usage</h2>
    {error ? <p className="mt-3 text-sm text-amber-600" role="alert">{error}</p> : !status ? <p className="mt-3 text-sm">Checking AI service…</p> : <div className="mt-3 space-y-2 text-sm"><p>{status.configured ? "Connected" : "Not configured"} · {status.model}</p><p>Estimated usage today (UTC): ${status.estimated_usd_today.toFixed(5)} / ${status.daily_budget_usd.toFixed(2)} allowance.</p><p>{status.requests_today} / {status.daily_request_limit} questions today. Repeated answers are cached.</p><p className="text-[var(--text-secondary)]">AI runs when you ask a question. Browsing pages and maps does not spend AI credits. Credentials are managed on the server.</p></div>}
  </PremiumCard>;
}

export function AssistantPanel({ mode = "chat", electionYear = 2022, onResult }: { mode?: "chat" | "gis"; electionYear?: 2017 | 2022; onResult?: (value: AIResult) => void }) {
  const [input, setInput] = useState("");
  const [turns, setTurns] = useState<Turn[]>([]);
  const [busy, setBusy] = useState(false);
  const [pending, setPending] = useState("");
  const [error, setError] = useState("");
  const suggestions = mode === "gis" ? ["Show SP seats won by fewer than 5,000 votes in 2022", "Show the 10 highest-turnout seats in 2017"] : ["Which party gained the most vote share between 2017 and 2022?", "Who won Lucknow Central in 2022?", "Show the five closest contests in 2022"];
  async function send(question = input) {
    if (busy || question.trim().length < 2) return;
    setBusy(true); setPending(question.trim()); setError("");
    try {
      const response = await fetch(`/api/ai/${mode}`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ query: question.trim(), election_year: electionYear, history: turns.slice(-6).map(turn => ({ role: turn.role, content: turn.content.slice(0, 1600) })) }) });
      const data = await response.json();
      if (!response.ok) throw new Error(typeof data.detail === "string" ? data.detail : "Unable to answer this question. Please retry.");
      const result = data as AIResult;
      setTurns(current => [...current, { role: "user", content: question.trim() }, { role: "assistant", content: result.response, result }]);
      setInput(""); onResult?.(result);
    } catch (cause) { setError(cause instanceof Error ? cause.message : "AI is unavailable. Please retry."); setInput(question); }
    finally { setBusy(false); setPending(""); }
  }
  return <PremiumCard className="p-6 space-y-5">
    <div><h2 className="font-serif text-lg font-bold flex items-center gap-2"><Sparkles size={19} />{mode === "gis" ? "Ask the map" : "ElectionIntel AI"}</h2><p className="text-sm mt-2 text-[var(--text-secondary)]">{mode === "gis" ? "Describe the seats you want to see. Matching constituencies are highlighted from your loaded results." : "Ask about your loaded 2017 and 2022 election results, or the saved forecast. Answers include data references."}</p></div>
    {turns.length === 0 && <div className="flex flex-wrap gap-2">{suggestions.map(question => <button type="button" key={question} disabled={busy} onClick={() => send(question)} className="text-left text-sm rounded-lg border border-[var(--border-subtle)] px-3 py-2 hover:border-[var(--accent-primary)] disabled:opacity-50">{question}</button>)}</div>}
    <div aria-live="polite" aria-busy={busy} className="space-y-4 max-h-[640px] overflow-y-auto">{turns.map((turn, index) => <div key={index} className={`rounded-xl p-4 ${turn.role === "user" ? "ml-8 bg-[var(--accent-primary)]/10" : "border border-[var(--border-subtle)] bg-[var(--bg-app)]"}`}>
      <p className="text-xs font-semibold mb-2 text-[var(--text-secondary)]">{turn.role === "user" ? "You" : "ElectionIntel AI"}</p><p className="text-sm whitespace-pre-wrap leading-relaxed">{turn.content}</p>
      {turn.result && <div className="mt-3 space-y-2 text-xs text-[var(--text-secondary)]">{turn.result.caveats.map((caveat, item) => <p key={item}>{caveat}</p>)}<div className="flex flex-wrap gap-3">{turn.result.sources.map(source => <Link className="underline" key={source.path} href={source.path}>{source.label}</Link>)}</div><p>{turn.result.cached ? "Saved answer" : `Estimated API cost: $${turn.result.cost_usd.toFixed(5)}`}</p></div>}
    </div>)}{busy && <p role="status" className="text-sm flex items-center gap-2"><Loader2 size={18} className="animate-spin" />Checking the data for “{pending}”…</p>}</div>
    {error && <p role="alert" className="text-sm text-rose-500">{error}</p>}
    <form onSubmit={event => { event.preventDefault(); send(); }} className="flex gap-3 items-end"><label className="flex-1"><span className="sr-only">{mode === "gis" ? "Map question" : "Election question"}</span><textarea value={input} onChange={event => setInput(event.target.value)} disabled={busy} maxLength={1500} rows={2} placeholder={mode === "gis" ? "For example: BJP seats in Lucknow with a margin below 10,000" : "Ask a question about UP elections…"} className="w-full resize-y rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-app)] p-3 text-sm outline-none focus:border-[var(--accent-primary)]" /></label><button type="submit" aria-label="Send question" disabled={busy || input.trim().length < 2} className="mb-1 rounded-lg bg-[var(--accent-primary)] p-3 text-[var(--bg-app)] disabled:opacity-40">{busy ? <Loader2 size={20} className="animate-spin" /> : <Send size={20} />}</button></form>
    <p className="text-xs text-[var(--text-tertiary)]">AI can make mistakes. Check the linked data. Missing data is not inferred.</p>
  </PremiumCard>;
}
