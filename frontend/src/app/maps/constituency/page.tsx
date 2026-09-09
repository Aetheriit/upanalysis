"use client";

import React, { useCallback, useEffect, useMemo, useState } from "react";
import { PageHeader } from "@/components/layout/page-header";
import { PremiumCard } from "@/components/ds/premium-card";
import UPMap from "@/components/UPMap";
import { apiUrl } from "@/lib/api";
import { getPartyColor } from "@/lib/party-colors";
import { Info, Layers, RefreshCw, Search, ZoomIn } from "lucide-react";

type MapLayerKey = "districts" | "highways" | "urban" | "rivers" | "railways";
type SelectedConstituency = { name: string; district?: string; winner?: string; winnerName?: string; margin?: number; code?: number };
const layerOptions: { key: MapLayerKey; label: string }[] = [
  { key: "districts", label: "District Boundaries" }, { key: "highways", label: "Highway Network" },
  { key: "urban", label: "Urban Areas" }, { key: "rivers", label: "River Systems" }, { key: "railways", label: "Railway Lines" },
];
const normalize = (value: string) => value.toLowerCase().replace(/\[[^\]]*\]/g, "").replace(/\s*\((?:sc|st)\)\s*/g, " ").replace(/\s+/g, " ").trim();

export default function ConstituencyMapPage() {
  const [year, setYear] = useState<"2017" | "2022">("2022");
  const [region, setRegion] = useState("All Regions");
  const [selected, setSelected] = useState<SelectedConstituency | null>(null);
  const [search, setSearch] = useState("");
  const [layers, setLayers] = useState<Record<MapLayerKey, boolean>>({ districts: true, highways: false, urban: false, rivers: false, railways: false });
  const [mapData, setMapData] = useState<Record<string, any>>({});
  const [refreshing, setRefreshing] = useState(false);

  const loadMapData = useCallback(async () => {
    setRefreshing(true);
    try {
      const response = await fetch(apiUrl(`/api/v1/analytics/constituencies-map?election_year=${year}`), { cache: "no-store" });
      const payload = await response.json();
      setMapData(payload.constituencies || {});
    } finally { setRefreshing(false); }
  }, [year]);
  useEffect(() => { loadMapData(); }, [loadMapData]);
  const partyCounts = useMemo(() => Object.values(mapData).reduce((counts: Record<string, number>, item: any) => { const party = item.winner || "Others"; counts[party] = (counts[party] || 0) + 1; return counts; }, {}), [mapData]);
  const handleSelect = useCallback((value: SelectedConstituency) => setSelected(value), []);

  useEffect(() => {
    if (!search.trim()) return;
    const match = Object.entries(mapData).find(([key, value]: [string, any]) => key.includes(normalize(search)) || String(value.original_name || "").toLowerCase().includes(search.toLowerCase()));
    if (match) setSelected({ name: match[1].original_name || match[0], winner: match[1].winner, winnerName: match[1].winner_name, margin: match[1].margin });
  }, [search, mapData]);

  return <div className="p-8 max-w-[1920px] mx-auto min-h-screen space-y-6">
    <PageHeader title="Constituency Map" description="Geospatial visualization of election results across 403 assembly constituencies." breadcrumbs={[{ label: "Home", href: "/" }, { label: "Maps & GIS" }, { label: "Constituency Map" }]} />
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
      <div className="lg:col-span-9"><PremiumCard className="p-0 overflow-hidden h-[700px] flex flex-col">
        <div className="p-4 border-b border-[var(--border-subtle)] flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3"><select aria-label="Election year" value={year} onChange={(e) => { setYear(e.target.value as "2017" | "2022"); setSelected(null); }} className="px-3 py-2 bg-[var(--bg-app)] border border-[var(--border-subtle)] rounded-lg text-sm font-medium text-[var(--text-primary)]"><option value="2022">2022 Results</option><option value="2017">2017 Results</option></select>
            <select aria-label="Region" value={region} onChange={(e) => setRegion(e.target.value)} className="px-3 py-2 bg-[var(--bg-app)] border border-[var(--border-subtle)] rounded-lg text-sm font-medium text-[var(--text-primary)]"><option>All Regions</option><option>Western UP</option><option>Rohilkhand</option><option>Awadh</option><option>Bundelkhand</option><option>Purvanchal</option></select>
            <div className="hidden md:flex items-center gap-2 border border-[var(--border-subtle)] rounded-lg px-3 py-2"><Search className="w-4 h-4 text-[var(--text-tertiary)]" /><input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Find constituency" className="w-40 bg-transparent outline-none text-sm text-[var(--text-primary)]" /></div>
          </div><div className="flex items-center gap-2"><button title="Refresh map data" onClick={loadMapData} className="p-2 text-[var(--text-secondary)] hover:bg-[var(--border-subtle)] rounded-lg transition-colors"><RefreshCw className={`w-4 h-4 ${refreshing ? "animate-spin" : ""}`} /></button><button title="Zoom to Uttar Pradesh" onClick={() => window.dispatchEvent(new CustomEvent("up-map-fit"))} className="p-2 text-[var(--text-secondary)] hover:bg-[var(--border-subtle)] rounded-lg transition-colors"><ZoomIn className="w-4 h-4" /></button><Layers className="w-4 h-4 text-[var(--text-secondary)]" /></div>
        </div><div className="flex-1 bg-[var(--bg-app)] min-h-0"><UPMap electionYear={year} region={region} selectedName={selected?.name} activeLayers={layers} onSelect={handleSelect} /></div>
      </PremiumCard></div>
      <div className="lg:col-span-3 flex flex-col gap-6">
        <PremiumCard className="p-6"><h3 className="text-sm font-bold text-[var(--text-primary)] uppercase tracking-wider mb-4">Legend — {year} Winners</h3><div className="space-y-3">{["BJP", "SP", "BSP", "INC", "RLD", "Others"].map((party) => <div key={party} className="flex items-center justify-between"><div className="flex items-center gap-2"><span className="w-4 h-4 rounded" style={{ backgroundColor: getPartyColor(party) }} /><span className="text-sm font-medium text-[var(--text-primary)]">{party}</span></div><span className="text-sm font-bold text-[var(--text-primary)]">{partyCounts[party] || 0}</span></div>)}</div></PremiumCard>
        <PremiumCard className="p-6"><h3 className="text-sm font-bold text-[var(--text-primary)] uppercase tracking-wider mb-4 flex items-center gap-2"><Info className="w-4 h-4" /> Selected Constituency</h3>{selected ? <div className="space-y-3"><div><p className="text-lg font-semibold text-[var(--text-primary)]">{selected.name}</p><p className="text-sm text-[var(--text-secondary)]">{selected.district || "Uttar Pradesh"}{selected.code ? ` · AC ${selected.code}` : ""}</p></div><div className="flex items-center gap-2"><span className="w-3 h-3 rounded-full" style={{ backgroundColor: getPartyColor(selected.winner) }} /><span className="text-sm text-[var(--text-primary)]">{selected.winnerName || "Winner unavailable"}</span><span className="text-xs font-semibold text-[var(--text-secondary)]">{selected.winner || "OTH"}</span></div>{selected.margin !== undefined && <p className="text-sm text-[var(--text-secondary)]">Winning margin: <span className="font-semibold text-[var(--text-primary)]">{Number(selected.margin).toLocaleString()}</span></p>}</div> : <div className="text-center py-8"><p className="text-sm text-[var(--text-secondary)]">Click a constituency on the map to see its winner, party, district, and margin.</p></div>}</PremiumCard>
        <PremiumCard className="p-6"><h3 className="text-sm font-bold text-[var(--text-primary)] uppercase tracking-wider mb-4">Map Layers</h3><div className="space-y-3">{layerOptions.map(({ key, label }) => <label key={key} className="flex items-center gap-3 cursor-pointer"><input type="checkbox" checked={layers[key]} onChange={(e) => setLayers((current) => ({ ...current, [key]: e.target.checked }))} className="w-4 h-4 rounded border-[var(--border-subtle)] accent-[var(--accent-primary)]" /><span className="text-sm text-[var(--text-secondary)]">{label}</span></label>)}</div></PremiumCard>
      </div>
    </div>
  </div>;
}
