"use client";

import React, { useCallback, useEffect, useMemo, useState } from "react";
import { PageHeader } from "@/components/layout/page-header";
import { PremiumCard } from "@/components/ds/premium-card";
import UPMap from "@/components/UPMap";
import { apiUrl } from "@/lib/api";
import { getPartyColor } from "@/lib/party-colors";
import { Info, Layers, RefreshCw, Search, ZoomIn } from "lucide-react";
import { useElectionContext } from "@/context/ElectionContext";

type MapLayerKey = "districts" | "highways" | "urban" | "rivers" | "railways";
type SelectedConstituency = { name: string; district?: string; winner?: string; winnerName?: string; margin?: number; code?: number; turnout?: number; totalElectors?: number; spoiler?: boolean; runnerUp?: string; swing?: number };
const layerOptions: { key: MapLayerKey; label: string }[] = [
  { key: "districts", label: "District Boundaries" }, { key: "highways", label: "Roads & Highways" },
  { key: "urban", label: "Urban Areas" }, { key: "rivers", label: "River Systems" }, { key: "railways", label: "Railway Lines" },
];
const normalize = (value: string) => value.toLowerCase().replace(/\[[^\]]*\]/g, "").replace(/\s*\((?:sc|st)\)\s*/g, " ").replace(/[^a-z0-9]/g, " ").replace(/\s+/g, " ").trim();

export default function ConstituencyMapPage() {
  const { viewMode } = useElectionContext();
  const year = viewMode === "2017 Only" ? "2017" : "2022";
  const isCompare = viewMode === "Comparison (17 vs 22)";
  
  const [region, setRegion] = useState("All Regions");
  const [mapMode, setMapMode] = useState<"winner" | "margin" | "spoiler" | "swing">("winner");
  const [selected, setSelected] = useState<SelectedConstituency | null>(null);
  const [search, setSearch] = useState("");
  const [layers, setLayers] = useState<Record<MapLayerKey, boolean>>({ districts: true, highways: false, urban: false, rivers: false, railways: false });
  const [mapData, setMapData] = useState<Record<string, any>>({});
  const [refreshing, setRefreshing] = useState(false);

  const loadMapData = useCallback(async () => {
    setRefreshing(true);
    try {
      const compareQuery = isCompare ? `&compare_year=2017` : "";
      const response = await fetch(apiUrl(`/api/v1/analytics/constituencies-map?election_year=${year}${compareQuery}`), { cache: "no-store" });
      const payload = await response.json();
      setMapData(payload.constituencies || {});
    } finally { setRefreshing(false); }
  }, [year, isCompare]);
  
  useEffect(() => { loadMapData(); }, [loadMapData]);
  
  const partyCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    Object.values(mapData).forEach((item: any) => {
      const party = item.winner || "Others";
      counts[party] = (counts[party] || 0) + 1;
    });
    // Sort and keep top 5, rest to Others
    const sorted = Object.entries(counts).sort((a, b) => b[1] - a[1]);
    const top = sorted.slice(0, 5);
    const topNames = top.map(x => x[0]);
    let others = sorted.slice(5).reduce((acc, curr) => acc + curr[1], 0);
    if (counts["Others"] && !topNames.includes("Others")) {
      others += counts["Others"];
    }
    const finalCounts: Record<string, number> = {};
    top.forEach(([p, c]) => { if (p !== "Others") finalCounts[p] = c; });
    if (others > 0) finalCounts["Others"] = others;
    return finalCounts;
  }, [mapData]);

  const handleSelect = useCallback((value: SelectedConstituency) => setSelected(value), []);

  useEffect(() => {
    if (!search.trim()) return;
    const match = Object.entries(mapData).find(([key, value]: [string, any]) => key.includes(normalize(search)) || String(value.original_name || "").toLowerCase().includes(search.toLowerCase()));
    if (match) setSelected({ 
      name: match[1].original_name || match[0], winner: match[1].winner, winnerName: match[1].winner_name, 
      margin: match[1].margin, turnout: match[1].turnout_pct, totalElectors: match[1].total_electors, 
      spoiler: match[1].is_spoiled, runnerUp: match[1].runner_up, swing: match[1].swing 
    });
  }, [search, mapData]);

  return <div className="p-8 max-w-[1920px] mx-auto min-h-screen space-y-6">
    <PageHeader title="Constituency Map" description="Geospatial visualization of election results, swing momentum, and spoiler effects." breadcrumbs={[{ label: "Home", href: "/" }, { label: "Maps & GIS" }, { label: "Constituency Map" }]} />
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
      <div className="lg:col-span-9"><PremiumCard className="p-0 overflow-hidden h-[700px] flex flex-col">
        <div className="p-4 border-b border-[var(--border-subtle)] flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <select aria-label="Map Mode" value={mapMode} onChange={(e) => setMapMode(e.target.value as any)} className="px-3 py-2 bg-[var(--bg-app)] border border-[var(--border-subtle)] rounded-lg text-sm font-medium text-[var(--text-primary)]">
              <option value="winner">Winner Party</option>
              <option value="margin">Margin Heatmap</option>
              <option value="spoiler">Spoiler Effect</option>
              {isCompare && <option value="swing">Swing Momentum (17 vs 22)</option>}
            </select>
            <select aria-label="Region" value={region} onChange={(e) => setRegion(e.target.value)} className="px-3 py-2 bg-[var(--bg-app)] border border-[var(--border-subtle)] rounded-lg text-sm font-medium text-[var(--text-primary)]"><option>All Regions</option><option>Western UP</option><option>Rohilkhand</option><option>Awadh</option><option>Bundelkhand</option><option>Purvanchal</option></select>
            <div className="hidden md:flex items-center gap-2 border border-[var(--border-subtle)] rounded-lg px-3 py-2"><Search className="w-4 h-4 text-[var(--text-tertiary)]" /><input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Find constituency" className="w-40 bg-transparent outline-none text-sm text-[var(--text-primary)]" /></div>
          </div>
          <div className="flex items-center gap-2">
            <button title="Refresh map data" onClick={loadMapData} className="p-2 text-[var(--text-secondary)] hover:bg-[var(--border-subtle)] rounded-lg transition-colors"><RefreshCw className={`w-4 h-4 ${refreshing ? "animate-spin" : ""}`} /></button>
            <button title="Zoom to Uttar Pradesh" onClick={() => window.dispatchEvent(new CustomEvent("up-map-fit"))} className="p-2 text-[var(--text-secondary)] hover:bg-[var(--border-subtle)] rounded-lg transition-colors"><ZoomIn className="w-4 h-4" /></button>
          </div>
        </div>
        <div className="flex-1 bg-[var(--bg-app)] min-h-0">
          <UPMap electionYear={year as "2017" | "2022"} region={region} selectedName={selected?.name} activeLayers={layers} onSelect={handleSelect} queryType={mapMode} preloadedData={mapData} />
        </div>
      </PremiumCard></div>
      <div className="lg:col-span-3 flex flex-col gap-6">
        <PremiumCard className="p-6">
          <h3 className="text-sm font-bold text-[var(--text-primary)] uppercase tracking-wider mb-4">Legend — {year} Winners</h3>
          <div className="space-y-3">
            {Object.keys(partyCounts).map((party) => (
              <div key={party} className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="w-4 h-4 rounded" style={{ backgroundColor: getPartyColor(party) }} />
                  <span className="text-sm font-medium text-[var(--text-primary)]">{party}</span>
                </div>
                <span className="text-sm font-bold text-[var(--text-primary)]">{partyCounts[party]}</span>
              </div>
            ))}
          </div>
        </PremiumCard>
        <PremiumCard className="p-6">
          <h3 className="text-sm font-bold text-[var(--text-primary)] uppercase tracking-wider mb-4 flex items-center gap-2"><Info className="w-4 h-4" /> Selected Details</h3>
          {selected ? (
            <div className="space-y-4">
              <div>
                <p className="text-lg font-semibold text-[var(--text-primary)]">{selected.name}</p>
                <p className="text-sm text-[var(--text-secondary)]">{selected.district || "Uttar Pradesh"}{selected.code ? ` · AC ${selected.code}` : ""}</p>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="bg-[var(--bg-app)] p-3 rounded-lg border border-[var(--border-subtle)]">
                  <p className="text-xs text-[var(--text-tertiary)] uppercase font-semibold mb-1">Turnout</p>
                  <p className="text-lg font-bold text-[var(--text-primary)]">{selected.turnout ? `${selected.turnout}%` : "N/A"}</p>
                  <p className="text-xs text-[var(--text-secondary)]">{selected.totalElectors ? (selected.totalElectors / 100000).toFixed(1) + "L Electors" : ""}</p>
                </div>
                <div className="bg-[var(--bg-app)] p-3 rounded-lg border border-[var(--border-subtle)]">
                  <p className="text-xs text-[var(--text-tertiary)] uppercase font-semibold mb-1">Margin</p>
                  <p className="text-lg font-bold text-[var(--text-primary)]">{selected.margin ? selected.margin.toLocaleString() : "N/A"}</p>
                  <p className="text-xs text-[var(--text-secondary)]">votes</p>
                </div>
              </div>
              <div className="flex items-center gap-3 bg-[var(--bg-app)] p-3 rounded-lg border border-[var(--border-subtle)]">
                <div className="flex-1">
                  <p className="text-xs text-[var(--text-tertiary)] uppercase font-semibold mb-1">Winner</p>
                  <div className="flex items-center gap-2">
                    <span className="w-3 h-3 rounded-full" style={{ backgroundColor: getPartyColor(selected.winner) }} />
                    <span className="text-sm font-bold text-[var(--text-primary)]">{selected.winner || "OTH"}</span>
                  </div>
                  <p className="text-xs text-[var(--text-secondary)] mt-1 truncate max-w-[120px]">{selected.winnerName || ""}</p>
                </div>
                {selected.runnerUp && (
                  <div className="flex-1 border-l border-[var(--border-subtle)] pl-3">
                    <p className="text-xs text-[var(--text-tertiary)] uppercase font-semibold mb-1">Runner Up</p>
                    <div className="flex items-center gap-2">
                      <span className="w-3 h-3 rounded-full" style={{ backgroundColor: getPartyColor(selected.runnerUp) }} />
                      <span className="text-sm font-bold text-[var(--text-primary)]">{selected.runnerUp}</span>
                    </div>
                  </div>
                )}
              </div>
              {selected.spoiler && (
                <div className="bg-red-500/10 border border-red-500/20 p-3 rounded-lg flex items-start gap-2">
                  <span className="text-red-500 text-lg">⚠️</span>
                  <p className="text-sm text-[var(--text-primary)]"><strong>Spoiler Effect Detected:</strong> The 3rd place party secured more votes than the winning margin, deciding the outcome.</p>
                </div>
              )}
              {selected.swing !== undefined && selected.swing !== null && isCompare && (
                <div className={`p-3 rounded-lg flex items-center justify-between border ${selected.swing > 0 ? "bg-green-500/10 border-green-500/20" : "bg-red-500/10 border-red-500/20"}`}>
                  <p className="text-sm font-semibold text-[var(--text-primary)]">Winner Swing (Since '17)</p>
                  <p className={`text-lg font-bold ${selected.swing > 0 ? "text-green-600" : "text-red-600"}`}>{selected.swing > 0 ? "+" : ""}{selected.swing}%</p>
                </div>
              )}
            </div>
          ) : (
            <div className="text-center py-12">
              <p className="text-sm text-[var(--text-secondary)]">Click a constituency on the map to see rich demographic and outcome details.</p>
            </div>
          )}
        </PremiumCard>
        <PremiumCard className="p-6">
          <h3 className="text-sm font-bold text-[var(--text-primary)] uppercase tracking-wider mb-4 flex items-center gap-2"><Layers className="w-4 h-4" /> Map Layers</h3>
          <div className="space-y-3">
            {layerOptions.map(({ key, label }) => (
              <label key={key} className="flex items-center gap-3 cursor-pointer group">
                <input type="checkbox" checked={layers[key]} onChange={(e) => setLayers((current) => ({ ...current, [key]: e.target.checked }))} className="w-4 h-4 rounded border-[var(--border-subtle)] accent-[var(--accent-primary)]" />
                <span className="text-sm text-[var(--text-secondary)] group-hover:text-[var(--text-primary)] transition-colors">{label}</span>
              </label>
            ))}
          </div>
        </PremiumCard>
      </div>
    </div>
  </div>;
}
