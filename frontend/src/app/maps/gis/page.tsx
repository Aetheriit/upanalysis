"use client";

import React from "react";
import { PageHeader } from "@/components/layout/page-header";
import { PremiumCard } from "@/components/ds/premium-card";
import { Database, Map, Layers, Search, BarChart3 } from "lucide-react";

export default function GISExplorerPage() {
  return (
    <div className="p-8 max-w-[1920px] mx-auto min-h-screen space-y-6">
      <PageHeader
        title="GIS Explorer"
        description="Advanced spatial queries, demographic overlay mapping, and multi-layer analysis."
        breadcrumbs={[{ label: "Home", href: "/" }, { label: "Maps & GIS" }, { label: "GIS Explorer" }]}
      />

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Query Panel */}
        <div className="lg:col-span-3 flex flex-col gap-6">
          <PremiumCard className="p-6">
            <h3 className="text-sm font-bold text-[var(--text-primary)] uppercase tracking-wider mb-4 flex items-center gap-2"><Search className="w-4 h-4" /> Spatial Query</h3>
            <div className="space-y-4">
              <div>
                <label className="text-xs font-medium text-[var(--text-secondary)] mb-1 block">Query Type</label>
                <select className="w-full px-3 py-2 bg-[var(--bg-app)] border border-[var(--border-subtle)] rounded-lg text-sm text-[var(--text-primary)]">
                  <option>Constituencies by party</option>
                  <option>Turnout heatmap</option>
                  <option>Margin heatmap</option>
                  <option>Demographic overlay</option>
                  <option>Swing corridors</option>
                </select>
              </div>
              <div>
                <label className="text-xs font-medium text-[var(--text-secondary)] mb-1 block">Year</label>
                <select className="w-full px-3 py-2 bg-[var(--bg-app)] border border-[var(--border-subtle)] rounded-lg text-sm text-[var(--text-primary)]">
                  <option>2022</option><option>2017</option><option>Comparison</option>
                </select>
              </div>
              <div>
                <label className="text-xs font-medium text-[var(--text-secondary)] mb-1 block">Filter by Party</label>
                <select className="w-full px-3 py-2 bg-[var(--bg-app)] border border-[var(--border-subtle)] rounded-lg text-sm text-[var(--text-primary)]">
                  <option>All Parties</option><option>BJP</option><option>SP</option><option>BSP</option><option>INC</option><option>RLD</option>
                </select>
              </div>
              <div>
                <label className="text-xs font-medium text-[var(--text-secondary)] mb-1 block">Demographic Layer</label>
                <select className="w-full px-3 py-2 bg-[var(--bg-app)] border border-[var(--border-subtle)] rounded-lg text-sm text-[var(--text-primary)]">
                  <option>None</option><option>SC/ST Population</option><option>Muslim Population</option><option>Yadav Population</option><option>Urban/Rural Mix</option><option>Literacy Rate</option>
                </select>
              </div>
              <button className="w-full py-2.5 bg-[var(--accent-primary)] text-[var(--bg-app)] hover:bg-[var(--accent-primary-hover)] rounded-lg text-sm font-medium transition-colors">
                Run Query
              </button>
            </div>
          </PremiumCard>

          <PremiumCard className="p-6">
            <h3 className="text-sm font-bold text-[var(--text-primary)] uppercase tracking-wider mb-4 flex items-center gap-2"><Layers className="w-4 h-4" /> Active Layers</h3>
            <div className="space-y-3">
              {[
                { name: "Party Winners", active: true },
                { name: "District Boundaries", active: true },
                { name: "SC/ST Demographics", active: false },
                { name: "Turnout Heatmap", active: false },
                { name: "Swing Corridors", active: false },
                { name: "Urban Clusters", active: false },
              ].map(layer => (
                <label key={layer.name} className="flex items-center gap-3 cursor-pointer">
                  <input type="checkbox" className="w-4 h-4 rounded border-[var(--border-subtle)] accent-[var(--accent-primary)]" defaultChecked={layer.active} />
                  <span className="text-sm text-[var(--text-secondary)]">{layer.name}</span>
                </label>
              ))}
            </div>
          </PremiumCard>
        </div>

        {/* Map Area */}
        <div className="lg:col-span-9">
          <PremiumCard className="p-0 overflow-hidden h-[700px] flex flex-col">
            <div className="p-4 border-b border-[var(--border-subtle)] flex items-center justify-between">
              <div className="flex items-center gap-2 text-sm text-[var(--text-secondary)]">
                <Database className="w-4 h-4" /> <span>GIS Engine: Ready</span>
                <span className="w-1.5 h-1.5 bg-emerald-500 rounded-full" />
              </div>
              <div className="flex items-center gap-2 text-xs text-[var(--text-tertiary)]">
                <span>Zoom: 100%</span> | <span>Layers: 2</span> | <span>Results: 403</span>
              </div>
            </div>
            <div className="flex-1 bg-[var(--bg-app)] relative flex items-center justify-center">
              <div className="absolute inset-0 opacity-10 pointer-events-none" style={{ backgroundImage: "url('https://upload.wikimedia.org/wikipedia/commons/thumb/1/14/Uttar_Pradesh_locator_map.svg/1200px-Uttar_Pradesh_locator_map.svg.png')", backgroundSize: 'contain', backgroundPosition: 'center', backgroundRepeat: 'no-repeat' }} />
              <div className="text-center z-10">
                <Map className="w-16 h-16 text-[var(--accent-primary)]/30 mx-auto mb-4" />
                <h3 className="text-lg font-semibold text-[var(--text-primary)]">GIS Explorer Canvas</h3>
                <p className="text-sm text-[var(--text-secondary)] max-w-sm mx-auto mt-2">
                  Run a spatial query from the left panel to render demographic overlays, heatmaps, and corridor analyses on the map.
                </p>
              </div>
            </div>
          </PremiumCard>
        </div>
      </div>
    </div>
  );
}
