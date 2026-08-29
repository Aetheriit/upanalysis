"use client";

import React from "react";
import { PageHeader } from "@/components/layout/page-header";
import { PremiumCard } from "@/components/ds/premium-card";
import { Map, ZoomIn, Layers, Info } from "lucide-react";

const legendItems = [
  { party: "BJP", color: "#F97316", seats: 255 },
  { party: "SP", color: "#EF4444", seats: 111 },
  { party: "BSP", color: "#2563EB", seats: 1 },
  { party: "INC", color: "#22C55E", seats: 2 },
  { party: "RLD", color: "#EAB308", seats: 8 },
  { party: "Others", color: "#94A3B8", seats: 26 },
];

export default function ConstituencyMapPage() {
  return (
    <div className="p-8 max-w-[1920px] mx-auto min-h-screen space-y-6">
      <PageHeader
        title="Constituency Map"
        description="Geospatial visualization of election results across 403 assembly constituencies."
        breadcrumbs={[{ label: "Home", href: "/" }, { label: "Maps & GIS" }, { label: "Constituency Map" }]}
      />

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        <div className="lg:col-span-9">
          <PremiumCard className="p-0 overflow-hidden h-[700px] flex flex-col">
            {/* Map Toolbar */}
            <div className="p-4 border-b border-[var(--border-subtle)] flex items-center justify-between">
              <div className="flex items-center gap-3">
                <select className="px-3 py-2 bg-[var(--bg-app)] border border-[var(--border-subtle)] rounded-lg text-sm font-medium text-[var(--text-primary)]">
                  <option>2022 Results</option><option>2017 Results</option><option>Swing Map</option><option>Turnout Map</option>
                </select>
                <select className="px-3 py-2 bg-[var(--bg-app)] border border-[var(--border-subtle)] rounded-lg text-sm font-medium text-[var(--text-primary)]">
                  <option>All Regions</option><option>Western UP</option><option>Purvanchal</option><option>Awadh</option><option>Bundelkhand</option><option>Rohilkhand</option>
                </select>
              </div>
              <div className="flex items-center gap-2">
                <button className="p-2 text-[var(--text-secondary)] hover:bg-[var(--border-subtle)] rounded-lg transition-colors"><ZoomIn className="w-4 h-4" /></button>
                <button className="p-2 text-[var(--text-secondary)] hover:bg-[var(--border-subtle)] rounded-lg transition-colors"><Layers className="w-4 h-4" /></button>
              </div>
            </div>
            {/* Map Area */}
            <div className="flex-1 bg-[var(--bg-app)] relative flex items-center justify-center">
              <div className="absolute inset-0 opacity-15 pointer-events-none" style={{ backgroundImage: "url('https://upload.wikimedia.org/wikipedia/commons/thumb/1/14/Uttar_Pradesh_locator_map.svg/1200px-Uttar_Pradesh_locator_map.svg.png')", backgroundSize: 'contain', backgroundPosition: 'center', backgroundRepeat: 'no-repeat' }} />
              <div className="text-center z-10">
                <Map className="w-16 h-16 text-[var(--accent-primary)]/30 mx-auto mb-4" />
                <h3 className="text-lg font-semibold text-[var(--text-primary)]">Interactive GIS Map</h3>
                <p className="text-sm text-[var(--text-secondary)] max-w-sm mx-auto mt-2">
                  The full GIS layer will render constituency boundaries with party-colored fills. Click any constituency to drill down into booth-level data.
                </p>
              </div>
            </div>
          </PremiumCard>
        </div>

        {/* Sidebar Legend & Info */}
        <div className="lg:col-span-3 flex flex-col gap-6">
          <PremiumCard className="p-6">
            <h3 className="text-sm font-bold text-[var(--text-primary)] uppercase tracking-wider mb-4">Legend — 2022 Winners</h3>
            <div className="space-y-3">
              {legendItems.map(l => (
                <div key={l.party} className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="w-4 h-4 rounded" style={{ backgroundColor: l.color }} />
                    <span className="text-sm font-medium text-[var(--text-primary)]">{l.party}</span>
                  </div>
                  <span className="text-sm font-bold text-[var(--text-primary)]">{l.seats}</span>
                </div>
              ))}
            </div>
          </PremiumCard>

          <PremiumCard className="p-6">
            <h3 className="text-sm font-bold text-[var(--text-primary)] uppercase tracking-wider mb-4 flex items-center gap-2"><Info className="w-4 h-4" /> Selected Constituency</h3>
            <div className="text-center py-8">
              <p className="text-sm text-[var(--text-secondary)]">Click on a constituency on the map to see details here.</p>
            </div>
          </PremiumCard>

          <PremiumCard className="p-6">
            <h3 className="text-sm font-bold text-[var(--text-primary)] uppercase tracking-wider mb-4">Map Layers</h3>
            <div className="space-y-3">
              {["District Boundaries", "Highway Network", "Urban Areas", "River Systems", "Railway Lines"].map(layer => (
                <label key={layer} className="flex items-center gap-3 cursor-pointer">
                  <input type="checkbox" className="w-4 h-4 rounded border-[var(--border-subtle)] accent-[var(--accent-primary)]" defaultChecked={layer === "District Boundaries"} />
                  <span className="text-sm text-[var(--text-secondary)]">{layer}</span>
                </label>
              ))}
            </div>
          </PremiumCard>
        </div>
      </div>
    </div>
  );
}
