"use client";

import { useEffect, useState } from "react";

type Finding = { label: string; value: string; year: number | null; geography: string; caveat: string; source_urls: string[] };
type Event = { summary: string; geo_scope: string; published_at: string; source_urls: string[];
  reported_facts?: string; electoral_reasoning?: string; party_impacts?: Record<string, {direction: number; rationale: string}> };
type Research = { model: string; status: string; summary?: string; cutoff?: string; retrieved_at?: string;
  facts: Finding[]; events: Event[]; sources: {url: string; title: string}[]; missing_data: string[]; error_code?: string;
  corpus_analysis?: {submitted_count: number; assessed_count: number; event_link_count: number; unresolved_count: number} };

export function ResearchPanel({ endpoint, code, runId }: {endpoint: (path: string) => string; code: string; runId: string}) {
  const [value, setValue] = useState<{research: Research | null; message: string} | null>(null);
  const [error, setError] = useState("");
  useEffect(() => {
    const controller = new AbortController();
    fetch(endpoint(`/research/${encodeURIComponent(code)}?run_id=${encodeURIComponent(runId)}`), { cache: "no-store", signal: controller.signal })
      .then(response => { if (!response.ok) throw new Error("Saved AI research is unavailable"); return response.json(); })
      .then(setValue).catch(failure => { if (!controller.signal.aborted) setError(failure.message); });
    return () => controller.abort();
  }, [endpoint, code, runId]);
  const research = value?.research;
  function citations(urls: string[]) {
    return <span className="flex flex-wrap gap-3 text-xs mt-2">{urls.map((url, index) => <a key={url} href={url} target="_blank" rel="noopener noreferrer" className="underline">{research?.sources.find(source => source.url === url)?.title || `Source ${index + 1}`}</a>)}</span>;
  }
  return <section className="rounded-lg border p-4 space-y-3 text-sm" aria-label="Saved OpenAI research"><h3 className="font-semibold">Source-linked AI research</h3>
    {error ? <p role="alert">{error}</p> : !value ? <p>Loading saved research…</p> : !research ? <p>No OpenAI research has been run for this snapshot. Use Run to research all 403 constituencies; the historical data and discovery links remain available below. Refresh does not call OpenAI.</p> : <>
      <p className="text-xs">{research.model} · {research.status} · cut-off {research.cutoff ? new Date(research.cutoff).toLocaleString("en-IN") : "Not completed"}</p>
      {research.corpus_analysis && <p className="text-xs">Stored sources considered: {research.corpus_analysis.submitted_count} · assessed: {research.corpus_analysis.assessed_count} · supporting events: {research.corpus_analysis.event_link_count} · unresolved: {research.corpus_analysis.unresolved_count}</p>}
      {research.error_code && <p>Research could not finish: {research.error_code.replaceAll("_", " ")}. Existing official data retained.</p>}
      {research.summary && <p>{research.summary}</p>}
      <h4 className="font-medium">Additional demographic, economic and local context</h4>
      {research.facts.length ? research.facts.map((fact, index) => <article key={index} className="border-t pt-3"><p><strong>{fact.label}:</strong> {fact.value}</p><p className="text-xs mt-1">{fact.geography} · {fact.year ?? "Year not established"} · {fact.caveat}</p>{citations(fact.source_urls)}</article>) : <p>No additional cited facts passed validation.</p>}
      <h4 className="font-medium">Recent developments</h4>
      {research.events.length ? research.events.map((event, index) => <article key={index} className="border-t pt-3 space-y-2"><p className="font-medium">{event.summary}</p><p className="text-xs">{event.geo_scope} · {new Date(event.published_at).toLocaleDateString("en-IN")}</p>{event.reported_facts && <p><strong>Reported:</strong> {event.reported_facts}</p>}{event.electoral_reasoning && <p><strong>Analysis:</strong> {event.electoral_reasoning}</p>}{event.party_impacts && Object.entries(event.party_impacts).map(([party, impact]) => <p key={party}><strong>{party} · {impact.direction > 0 ? "positive" : impact.direction < 0 ? "negative" : "neutral"}:</strong> {impact.rationale}</p>)}{citations(event.source_urls)}</article>) : <p>No sufficiently sourced recent event passed validation. This does not establish that no event occurred.</p>}
      {!!research.missing_data.length && <div><h4 className="font-medium">Still unresolved</h4><ul className="list-disc pl-5 mt-2">{research.missing_data.map((item, index) => <li key={index}>{item}</li>)}</ul></div>}
    </>}
  </section>;
}
