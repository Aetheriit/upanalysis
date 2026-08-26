"use client";

import React from "react";
import { PageHeader } from "@/components/layout/page-header";
import { PremiumCard } from "@/components/ds/premium-card";
import { Database, Upload, Download, RefreshCw, CheckCircle, AlertTriangle, Clock, HardDrive } from "lucide-react";

const datasets = [
  { name: "UP Assembly 2022 — Full Results", records: "403", size: "2.4 MB", lastUpdated: "Aug 15, 2026", status: "Synced" },
  { name: "UP Assembly 2017 — Full Results", records: "403", size: "2.1 MB", lastUpdated: "Aug 15, 2026", status: "Synced" },
  { name: "Booth-Level Data 2022", records: "1,63,335", size: "128 MB", lastUpdated: "Aug 12, 2026", status: "Synced" },
  { name: "Booth-Level Data 2017", records: "1,55,890", size: "112 MB", lastUpdated: "Aug 12, 2026", status: "Synced" },
  { name: "Candidate Profiles — All Years", records: "22,450", size: "45 MB", lastUpdated: "Aug 10, 2026", status: "Synced" },
  { name: "Demographic Census Data", records: "75", size: "8.2 MB", lastUpdated: "Aug 8, 2026", status: "Pending Update" },
  { name: "GIS Shapefiles — UP Constituencies", records: "403", size: "56 MB", lastUpdated: "Jul 28, 2026", status: "Synced" },
];

export default function DataCenterPage() {
  return (
    <div className="p-8 max-w-[1920px] mx-auto min-h-screen space-y-6">
      <PageHeader
        title="Data Center"
        description="Manage datasets, imports, API integrations, and data pipeline health."
        breadcrumbs={[{ label: "Home", href: "/" }, { label: "Administration" }, { label: "Data Center" }]}
        action={
          <button className="px-4 py-2 bg-[var(--accent-primary)] text-[var(--bg-app)] hover:bg-[var(--accent-primary-hover)] rounded-lg text-sm font-medium transition-colors flex items-center gap-2">
            <Upload className="w-4 h-4" /> Import Dataset
          </button>
        }
      />

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <PremiumCard padding="sm" className="text-center">
          <Database className="w-5 h-5 text-[var(--accent-primary)] mx-auto mb-2" />
          <div className="text-2xl font-bold text-[var(--text-primary)]">7</div>
          <div className="text-xs text-[var(--text-secondary)]">Active Datasets</div>
        </PremiumCard>
        <PremiumCard padding="sm" className="text-center">
          <HardDrive className="w-5 h-5 text-blue-500 mx-auto mb-2" />
          <div className="text-2xl font-bold text-[var(--text-primary)]">353 MB</div>
          <div className="text-xs text-[var(--text-secondary)]">Total Storage</div>
        </PremiumCard>
        <PremiumCard padding="sm" className="text-center">
          <CheckCircle className="w-5 h-5 text-emerald-500 mx-auto mb-2" />
          <div className="text-2xl font-bold text-emerald-500">6</div>
          <div className="text-xs text-[var(--text-secondary)]">Synced</div>
        </PremiumCard>
        <PremiumCard padding="sm" className="text-center">
          <AlertTriangle className="w-5 h-5 text-amber-500 mx-auto mb-2" />
          <div className="text-2xl font-bold text-amber-500">1</div>
          <div className="text-xs text-[var(--text-secondary)]">Pending Update</div>
        </PremiumCard>
      </div>

      <PremiumCard className="p-0 overflow-hidden">
        <div className="p-4 border-b border-[var(--border-subtle)] flex items-center justify-between">
          <h2 className="text-lg font-serif font-bold text-[var(--text-primary)]">All Datasets</h2>
          <button className="px-3 py-2 bg-[var(--bg-app)] border border-[var(--border-subtle)] rounded-lg text-sm font-medium text-[var(--text-primary)] hover:bg-[var(--border-subtle)] transition-colors flex items-center gap-2">
            <RefreshCw className="w-4 h-4" /> Sync All
          </button>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-[var(--bg-app)]/50 border-b border-[var(--border-subtle)]">
                {["Dataset", "Records", "Size", "Last Updated", "Status", "Actions"].map(h => (
                  <th key={h} className="px-6 py-3 text-xs font-semibold text-[var(--text-secondary)] uppercase tracking-wider whitespace-nowrap">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--border-subtle)]">
              {datasets.map(d => (
                <tr key={d.name} className="hover:bg-[var(--bg-app)]/30 transition-colors">
                  <td className="px-6 py-4 text-sm font-semibold text-[var(--text-primary)]">{d.name}</td>
                  <td className="px-6 py-4 text-sm font-mono text-[var(--text-primary)]">{d.records}</td>
                  <td className="px-6 py-4 text-sm text-[var(--text-secondary)]">{d.size}</td>
                  <td className="px-6 py-4 text-sm text-[var(--text-tertiary)] flex items-center gap-1"><Clock className="w-3 h-3" /> {d.lastUpdated}</td>
                  <td className="px-6 py-4">
                    <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                      d.status === 'Synced' ? 'bg-emerald-500/10 text-emerald-500' : 'bg-amber-500/10 text-amber-500'
                    }`}>{d.status}</span>
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-2">
                      <button className="p-1.5 text-[var(--text-tertiary)] hover:text-[var(--text-primary)] rounded-md hover:bg-[var(--bg-app)] transition-colors"><Download className="w-4 h-4" /></button>
                      <button className="p-1.5 text-[var(--text-tertiary)] hover:text-[var(--text-primary)] rounded-md hover:bg-[var(--bg-app)] transition-colors"><RefreshCw className="w-4 h-4" /></button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </PremiumCard>
    </div>
  );
}
