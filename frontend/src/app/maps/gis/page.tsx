"use client";

import React, { useCallback, useEffect, useMemo, useState } from "react";
import { PageHeader } from "@/components/layout/page-header";
import { PremiumCard } from "@/components/ds/premium-card";
import UPMap from "@/components/UPMap";
import { apiUrl } from "@/lib/api";
import { getPartyColor } from "@/lib/party-colors";
import { BarChart3, CheckCircle2, Database, Layers, Search } from "lucide-react";

type QueryType = "Constituencies by party" | "Turnout heatmap" | "Margin heatmap" | "Demographic overlay" | "Swing corridors";
type Selected = { name: string; district?: string; winner?: string; winnerName?: string; margin?: number; code?: number };
type ActiveLayers = { party: boolean; districts: boolean; demographics: boolean; turnout: boolean; swing: boolean; urban: boolean };

const initialLayers: ActiveLayers = { party: true, districts: true, demographics: false, turnout: false, swing: false, urban: false };

export default function GISExplorerPage() {
  const [queryType, setQueryType] = useState<QueryType>("Constituencies by party");
  const [year, setYear] = useState<"2017" | "2022">("2022");
  const [party, setParty] = useState("All Parties");
  const [demographic, setDemographic] = useState("None");
  const [applied, setApplied] = useState({ queryType, year, party, demographic });
  const [layers, setLayers] = useState<ActiveLayers>(initialLayers);
  const [selected, setSelected] = useState<Selected | null>(null);
  const [mapData, setMapData] = useState<Record<string, any>>({});
  const [loading, setLoading] = useState(false);

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const response = await fetch(apiUrl(`/api/v1/analytics/constituencies-map?election_year=${applied.year}`), { cache: "no-store" });
      const payload = await response.json();
      setMapData(payload.constituencies || {});
    } finally { setLoading(false); }
  }, [applied.year]);
  useEffect(() => { loadData(); }, [loadData]);

  const resultCount = useMemo(() => Object.values(mapData).filter((item: any) => applied.party === "All Parties" || item.winner === applied.party).length, [mapData, applied.party]);
  const activeCount = Object.values(layers).filter(Boolean).length;
  const mapLayers = { districts: layers.districts, highways: layers.swing, urban: layers.urban, rivers: layers.demographics, railways: layers.turnout };
  const runQuery = () => { setApplied({ queryType, year, party, demographic }); setSelected(null); };
  const toggle = (key: keyof ActiveLayers) => setLayers((current) => ({ ...current, [key]: !current[key] }));

  return <div className="p-8 max-w-[1920px] mx-auto min-h-screen space-y-6">
    <PageHeader title="GIS Explorer" description="Run spatial queries, inspect live constituency results, and compare map overlays." breadcrumbs={[{ label: "Home", href: "/" }, { label: "Maps & GIS" }, { label: "GIS Explorer" }]} />
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
      <div className="lg:col-span-3 flex flex-col gap-6">
        <PremiumCard className="p-6"><h3 className="text-sm font-bold text-[var(--text-primary)] uppercase tracking-wider mb-4 flex items-center gap-2"><Search className="w-4 h-4" /> Spatial Query</h3><div className="space-y-4">
          <label className="block"><span className="text-xs font-medium text-[var(--text-secondary)] mb-1 block">Query Type</span><select value={queryType} onChange={(e) => setQueryType(e.target.value as QueryType)} className="w-full px-3 py-2 bg-[var(--bg-app)] border border-[var(--border-subtle)] rounded-lg text-sm text-[var(--text-primary)]"><option>Constituencies by party</option><option>Turnout heatmap</option><option>Margin heatmap</option><option>Demographic overlay</option><option>Swing corridors</option></select></label>
          <label className="block"><span className="text-xs font-medium text-[var(--text-secondary)] mb-1 block">Year</span><select value={year} onChange={(e) => setYear(e.target.value as "2017" | "2022")} className="w-full px-3 py-2 bg-[var(--bg-app)] border border-[var(--border-subtle)] rounded-lg text-sm text-[var(--text-primary)]"><option value="2022">2022</option><option value="2017">2017</option></select></label>
          <label className="block"><span className="text-xs font-medium text-[var(--text-secondary)] mb-1 block">Filter by Party</span><select value={party} onChange={(e) => setParty(e.target.value)} className="w-full px-3 py-2 bg-[var(--bg-app)] border border-[var(--border-subtle)] rounded-lg text-sm text-[var(--text-primary)]"><option>All Parties</option><option>BJP</option><option>SP</option><option>BSP</option><option>INC</option><option>RLD</option><option>Others</option></select></label>
          <label className="block"><span className="text-xs font-medium text-[var(--text-secondary)] mb-1 block">Demographic Layer</span><select value={demographic} onChange={(e) => setDemographic(e.target.value)} className="w-full px-3 py-2 bg-[var(--bg-app)] border border-[var(--border-subtle)] rounded-lg text-sm text-[var(--text-primary)]"><option>None</option><option>SC/ST Population</option><option>Muslim Population</option><option>Yadav Population</option><option>Urban/Rural Mix</option><option>Literacy Rate</option></select></label>
          <button onClick={runQuery} className="w-full py-2.5 bg-[var(--accent-primary)] text-[var(--bg-app)] hover:bg-[var(--accent-primary-hover)] rounded-lg text-sm font-medium transition-colors">Run Query</button>
        </div></PremiumCard>
        <PremiumCard className="p-6"><h3 className="text-sm font-bold text-[var(--text-primary)] uppercase tracking-wider mb-4 flex items-center gap-2"><Layers className="w-4 h-4" /> Active Layers</h3><div className="space-y-3">
          {([ ["party", "Party Winners"], ["districts", "District Boundaries"], ["demographics", "SC/ST Demographics"], ["turnout", "Turnout Heatmap"], ["swing", "Swing Corridors"], ["urban", "Urban Clusters"] ] as [keyof ActiveLayers, string][]).map(([key, label]) => <label key={key} className="flex items-center gap-3 cursor-pointer"><input type="checkbox" checked={layers[key]} onChange={() => toggle(key)} className="w-4 h-4 rounded border-[var(--border-subtle)] accent-[var(--accent-primary)]" /><span className="text-sm text-[var(--text-secondary)]">{label}</span></label>)}
        </div></PremiumCard>
      </div>
      <div className="lg:col-span-9"><PremiumCard className="p-0 overflow-hidden h-[760px] flex flex-col">
        <div className="p-4 border-b border-[var(--border-subtle)] flex items-center justify-between"><div className="flex items-center gap-2 text-sm text-[var(--text-secondary)]"><Database className="w-4 h-4" /><span>GIS Engine: {loading ? "Loading" : "Ready"}</span><span className={`w-1.5 h-1.5 ${loading ? "bg-amber-500" : "bg-emerald-500"} rounded-full`} /></div><div className="flex items-center gap-3 text-xs text-[var(--text-tertiary)]"><span>Layers: {activeCount}</span><span>Results: {resultCount || 0}</span><span className="flex items-center gap-1"><CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" /> Live API</span></div></div>
        <div className="flex-1 min-h-0 bg-[var(--bg-app)]"><UPMap electionYear={applied.year} partyFilter={applied.party} queryType={applied.queryType} showPartyWinners={layers.party} activeLayers={mapLayers} onSelect={setSelected} /></div>
        <div className="px-5 py-3 border-t border-[var(--border-subtle)] flex items-center justify-between text-xs text-[var(--text-secondary)]"><span>{applied.queryType}{applied.demographic !== "None" ? ` · ${applied.demographic}` : ""} · {applied.year}</span><span>{selected ? `Selected: ${selected.name}` : "Click a constituency to inspect it"}</span></div>
      </PremiumCard></div>
    </div>
    {selected && <PremiumCard className="p-5"><div className="flex items-center gap-4"><BarChart3 className="w-5 h-5" style={{ color: getPartyColor(selected.winner) }} /><div><p className="font-semibold text-[var(--text-primary)]">{selected.name}</p><p className="text-sm text-[var(--text-secondary)]">{selected.district || "Uttar Pradesh"} · {selected.winnerName || "Winner unavailable"} · {selected.winner || "OTH"}{selected.margin !== undefined ? ` · Margin ${Number(selected.margin).toLocaleString()}` : ""}</p></div></div></PremiumCard>}
  </div>;
}
