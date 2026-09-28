"use client";

export type FusionAudit = {
  version: string; scored_seats: number; changed_probability_seats: number; changed_leaders: number;
  max_probability_change_pp: number;
  expected_seats_before_shocks: { party: string; static: number; combined: number; change: number }[];
};
export type SimulationAudit = {
  draws: number; seed?: number; max_mean_mc_se?: number;
  convergence?: { status: string; max_mean_seat_delta?: number; within_diagnostic_tolerances?: boolean };
  evidence_sensitivity?: { parties: { party: string; static: number; combined: number; change: number; change_mc_se: number }[] };
};
export type ResearchAudit = {
  analysis_mode?: string; coverage_status?: string; reviewed_event_count?: number; provider_calls?: number;
  corpus_analysis?: { unique_links_submitted: number; unique_links_metadata_screened?: number;
    unique_links_assessed: number; unique_links_used_in_events: number; unique_articles_cited: number;
    unique_links_unresolved: number; unique_links_historical_context?: number; unique_links_duplicate?: number };
};
export const formatWebChange = (value: number) => `${value > 0 ? "+" : ""}${value !== 0 && Math.abs(value) < .00005 ? value.toExponential(2) : value.toFixed(4)}`;

export function ComputationAudit({ audit, simulation, research }: { audit?: FusionAudit; simulation?: SimulationAudit; research?: ResearchAudit }) {
  const effects = simulation?.evidence_sensitivity?.parties;
  const corpus = research?.corpus_analysis;
  const offline = research?.analysis_mode === "offline_no_provider_calls";
  return <section className="rounded-xl border border-[var(--border-subtle)] p-5 space-y-3" aria-label="Calculation audit">
    <h2 className="font-semibold">What actually entered this calculation</h2>
    <p className="text-sm">{simulation ? `${simulation.draws.toLocaleString()} completed election simulations` : "Simulation count unavailable in this archived snapshot"}
      {audit && ` · ${audit.scored_seats} / 403 seats with scored web evidence · ${audit.changed_leaders} leaders changed by evidence`}.</p>
    {corpus && <div className="text-sm space-y-2 border-t border-[var(--border-subtle)] pt-3">
      <p className="font-medium">{offline ? "Stored-corpus analysis · no OpenAI calls" : "Source analysis coverage"}</p>
      <p>{(corpus.unique_links_metadata_screened ?? corpus.unique_links_submitted).toLocaleString()} links {offline ? "metadata-screened" : "submitted"} · {corpus.unique_articles_cited.toLocaleString()} source articles cited{research?.reviewed_event_count != null && ` · ${research.reviewed_event_count} reviewed events`}.</p>
      {offline && <p className="text-xs text-[var(--text-secondary)]">Article review is partial: {corpus.unique_links_historical_context?.toLocaleString()} links outside the 90-day scoring window · {corpus.unique_links_duplicate?.toLocaleString()} exact headline/date duplicates · {corpus.unique_links_unresolved.toLocaleString()} links unresolved. Screening a headline is not reading its article. District events have reduced, shared relevance across their district; they are not separate local confirmations.</p>}
    </div>}
    {!audit?.scored_seats && <p className="text-sm text-amber-700 dark:text-amber-300">This saved forecast has no eligible directional web evidence in its calculation. Discovery links and AI background facts do not count as electoral signals. Use Run with web research enabled to collect and evaluate fresh evidence; unverified or neutral findings will not force a change.</p>}
    {audit && <p className="text-xs text-[var(--text-secondary)]">Probabilities changed in {audit.changed_probability_seats} seats; largest change {audit.max_probability_change_pp.toFixed(4)} percentage points. Neutral evidence leaves the historical model unchanged. Method: {audit.version}.</p>}
    {effects && <details><summary className="cursor-pointer text-sm font-medium">Static versus combined — measured web contribution</summary>
      <div className="overflow-x-auto mt-3"><table className="w-full text-sm text-left"><caption className="text-left text-xs mb-2 text-[var(--text-secondary)]">Expected seats integrated over the same shocks, without drawing another election. These fractional expectations isolate the web contribution; the headline cards use sampled seat counts.</caption>
        <thead><tr>{["Party", "Static expectation", "Combined expectation", "Web change", "Change MC error (±1 SE)"].map(label => <th key={label} scope="col" className="p-2">{label}</th>)}</tr></thead>
        <tbody>{effects.map(row => <tr key={row.party}><th scope="row" className="p-2 font-medium">{row.party}</th><td className="p-2">{row.static.toFixed(6)}</td><td className="p-2">{row.combined.toFixed(6)}</td><td className="p-2">{formatWebChange(row.change)}</td><td className="p-2">{row.change_mc_se !== 0 && row.change_mc_se < .000005 ? row.change_mc_se.toExponential(2) : row.change_mc_se.toFixed(5)}</td></tr>)}</tbody>
      </table></div></details>}
    {simulation?.max_mean_mc_se != null && <p className="text-xs text-[var(--text-secondary)]">Largest seat-mean Monte Carlo standard error: ±{simulation.max_mean_mc_se.toFixed(3)} seats. Four independent streams; seed {simulation.seed}. This measures simulation noise, not election forecast accuracy.</p>}
    {simulation?.convergence?.within_diagnostic_tolerances === false && <p className="text-sm text-amber-700 dark:text-amber-300">Independent-stream numerical checks exceeded the diagnostic tolerance. Interpret seat ranges cautiously; no extra draws were silently added.</p>}
  </section>;
}
