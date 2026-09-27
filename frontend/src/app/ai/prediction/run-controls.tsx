"use client";

import { useEffect, useRef, useState } from "react";
import { Loader2, Play } from "lucide-react";

type Job = { job_id?: string; status: string; phase?: string; completed?: number; expected?: number;
  researched?: number; failed?: number; scored_seats?: number; current_name?: string; error_code?: string; run_id?: string;
  provider_configured?: boolean; provider_model?: string; run_access_configured?: boolean; dynamic_research?: boolean;
  corpus_analysis?: {unique_links_submitted: number; unique_links_assessed: number; unique_links_used_in_events: number} };

export function RunControls({ endpoint, onComplete }: { endpoint: (path: string) => string; onComplete: () => void }) {
  const [job, setJob] = useState<Job | null>(null);
  const [open, setOpen] = useState(false);
  const [token, setToken] = useState("");
  const dynamic = true;
  const [resume, setResume] = useState(false);
  const [consent, setConsent] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [poll, setPoll] = useState(0);
  const requestId = useRef<string | null>(null);
  const submitting = useRef(false);
  const observed = useRef<string | null>(null);
  const complete = useRef(onComplete);
  useEffect(() => { complete.current = onComplete; }, [onComplete]);
  useEffect(() => {
    const controller = new AbortController();
    let timer: ReturnType<typeof setTimeout> | undefined;
    // This GET only reads durable status. There is deliberately no POST in an effect.
    async function status() {
      try {
        const response = await fetch(endpoint("/run/status"), { cache: "no-store", signal: controller.signal });
        if (!response.ok) throw new Error("Run status is unavailable. Saved predictions remain available.");
        const current: Job = await response.json();
        setJob(current);
        if (["queued", "running"].includes(current.status)) {
          observed.current = current.job_id ?? null;
          timer = setTimeout(status, 5000);
        } else if (current.job_id && observed.current === current.job_id) {
          observed.current = null;
          if (current.status === "review_completed") complete.current();
        }
      } catch (failure) {
        if (!controller.signal.aborted) setError(failure instanceof Error ? failure.message : "Status unavailable");
      }
    }
    void status();
    return () => { controller.abort(); if (timer) clearTimeout(timer); };
  }, [endpoint, poll]);

  async function run() {
    if (submitting.current || !token.trim() || (dynamic && job?.provider_configured && !consent)) return;
    if (token.trim().startsWith("sk-")) {
      setToken(""); setError("Use the separate operator run-access token, not your OpenAI API key. The API key belongs only on the server.");
      return;
    }
    submitting.current = true; setBusy(true); setError("");
    requestId.current ??= crypto.randomUUID();
    const access = token.trim(); setToken("");
    try {
      const response = await fetch(endpoint("/run"), { method: "POST", cache: "no-store",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${access}` },
        body: JSON.stringify({ request_id: requestId.current, dynamic_research: dynamic, confirm_api_usage: consent,
          resume_job_id: dynamic && resume && job?.dynamic_research && job.job_id && ["interrupted", "failed"].includes(job.status) ? job.job_id : null }) });
      if (!response.ok) {
        const detail = await response.json().catch(() => ({}));
        throw new Error(typeof detail.detail === "string" ? detail.detail : `Run request failed (${response.status})`);
      }
      const result: Job = await response.json();
      observed.current = result.job_id ?? null;
      setOpen(false); setConsent(false); setJob(previous => ({ ...previous, ...result }));
      requestId.current = null;
      setPoll(value => value + 1);
    } catch (failure) {
      setError(failure instanceof Error ? failure.message : "Run request failed. Retry uses the same request ID to avoid duplicate charges.");
    } finally { submitting.current = false; setBusy(false); }
  }
  const active = !!job && ["queued", "running"].includes(job.status);
  return <section aria-label="Prediction run controls" className="rounded-xl border border-[var(--border-subtle)] p-4 space-y-3">
    <div className="flex flex-wrap items-center justify-between gap-3"><div><h2 className="font-semibold">Run prediction &amp; web research</h2><p className="text-xs text-[var(--text-secondary)]">{job?.provider_model || "gpt-6-luna"} · {!job ? "Checking server configuration…" : job.provider_configured ? "OpenAI configured on server" : "OpenAI unavailable — static-only bypass"}. Reloads and refreshes read saved results only.</p></div>
      <button aria-expanded={open} disabled={active || busy || !job?.run_access_configured} onClick={() => { setOpen(!open); setToken(""); setConsent(false); }} className="flex items-center gap-2 border rounded-lg px-4 py-2 disabled:opacity-40"><Play size={16} />{active ? "Run in progress" : "Run"}</button></div>
    {!job?.run_access_configured && job && <p className="text-xs">An operator run-access token must be configured on the server before starting jobs.</p>}
    {open && <form onSubmit={event => { event.preventDefault(); void run(); }} className="space-y-3 border-t pt-3">
      <p className="text-sm font-medium">Analyse stored news and research all 403 constituencies</p>
      {dynamic && job?.dynamic_research && job.job_id && ["interrupted", "failed"].includes(job.status) && <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={resume} onChange={event => { setResume(event.target.checked); requestId.current = null; }} />Resume saved research checkpoints. Completed requests are not repeated; any request interrupted mid-flight is marked unresolved to avoid a possible duplicate charge.</label>}
      <p className="text-xs">Every new Run reviews the stored source list and current reporting for all 403 constituencies, combines supported party impacts with the 2017/2022 data, and performs 10,000 election simulations. Research uses one API request per constituency, up to four web-search calls and 12,000 output tokens per request. Previous results stay visible until completion.</p>
      {dynamic && job?.provider_configured && <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={consent} onChange={event => setConsent(event.target.checked)} />I authorize paid API research for this run.</label>}
      <label className="block text-sm">Operator run-access token (not your OpenAI API key)<input aria-label="Operator run-access token" type="password" autoComplete="off" value={token} onChange={event => setToken(event.target.value)} className="block mt-1 w-full max-w-lg rounded border p-2 bg-[var(--bg-app)]" /></label>
      <p className="text-xs text-[var(--text-secondary)]">The access token is held only in memory and cleared on submission. The OpenAI key never reaches this page.</p>
      <button disabled={busy || !token.trim() || (dynamic && !!job?.provider_configured && !consent)} className="border rounded px-4 py-2 disabled:opacity-40">{busy ? "Starting…" : "Confirm and run"}</button>
    </form>}
    {active && <div role="status" className="flex items-center gap-2 text-sm"><Loader2 className="animate-spin" size={16} />{job?.phase?.replaceAll("_", " ")} · {job?.completed ?? 0} / {job?.expected ?? 403} checked · {job?.researched ?? 0} researched · {job?.failed ?? 0} failed {job?.current_name && `· ${job.current_name}`}</div>}
    {active && job?.corpus_analysis && <p className="text-xs">{job.corpus_analysis.unique_links_submitted.toLocaleString()} stored links submitted · {job.corpus_analysis.unique_links_assessed.toLocaleString()} assessed · {job.corpus_analysis.unique_links_used_in_events.toLocaleString()} linked to derived events</p>}
    {active && typeof job?.scored_seats === "number" && <p className="text-xs">{job.scored_seats} constituencies with scored news signals ready for this Run.</p>}
    {job?.error_code && <p role="alert" className="text-sm text-amber-700 dark:text-amber-300">Last run: {job.status} — {job.error_code.replaceAll("_", " ")}. Saved results were retained. No automatic retry or fallback model is used.</p>}
    {error && <p role="alert" className="text-sm text-rose-500">{error} <button className="underline" onClick={() => { setError(""); setPoll(value => value + 1); }}>Check status</button></p>}
  </section>;
}
