"use client";

import React from "react";
import { PageHeader } from "@/components/layout/page-header";
import { PremiumCard } from "@/components/ds/premium-card";
import { FileText, Download, Clock, BarChart3, Users, MapPin, Plus } from "lucide-react";

const reports = [
  { title: "Executive Summary — 2022 Results", type: "Summary", date: "Aug 15, 2026", pages: 24, status: "Complete" },
  { title: "Western UP Regional Deep Dive", type: "Regional", date: "Aug 12, 2026", pages: 45, status: "Complete" },
  { title: "Caste Dynamics & Voting Patterns", type: "Analysis", date: "Aug 10, 2026", pages: 32, status: "Complete" },
  { title: "Alliance Impact Assessment — NDA vs INDIA", type: "Strategic", date: "Aug 8, 2026", pages: 18, status: "Complete" },
  { title: "Booth-Level Anomaly Report", type: "Forensic", date: "Aug 5, 2026", pages: 56, status: "Draft" },
  { title: "Turnout Surge Analysis", type: "Analysis", date: "Aug 2, 2026", pages: 15, status: "Complete" },
];

const typeColor: Record<string, string> = {
  Summary: "bg-blue-500/10 text-blue-500",
  Regional: "bg-emerald-500/10 text-emerald-500",
  Analysis: "bg-amber-500/10 text-amber-500",
  Strategic: "bg-purple-500/10 text-purple-500",
  Forensic: "bg-rose-500/10 text-rose-500",
};

export default function ReportsPage() {
  return (
    <div className="p-8 max-w-[1920px] mx-auto min-h-screen space-y-6">
      <PageHeader
        title="Custom Reports"
        description="Generate, manage, and export tailored intelligence briefs and detailed analysis reports."
        breadcrumbs={[{ label: "Home", href: "/" }, { label: "Reports" }]}
        action={
          <button className="px-4 py-2 bg-[var(--accent-primary)] text-[var(--bg-app)] hover:bg-[var(--accent-primary-hover)] rounded-lg text-sm font-medium transition-colors flex items-center gap-2">
            <Plus className="w-4 h-4" /> New Report
          </button>
        }
      />

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <PremiumCard padding="sm" className="text-center">
          <FileText className="w-5 h-5 text-[var(--accent-primary)] mx-auto mb-2" />
          <div className="text-2xl font-bold text-[var(--text-primary)]">24</div>
          <div className="text-xs text-[var(--text-secondary)]">Total Reports</div>
        </PremiumCard>
        <PremiumCard padding="sm" className="text-center">
          <BarChart3 className="w-5 h-5 text-blue-500 mx-auto mb-2" />
          <div className="text-2xl font-bold text-[var(--text-primary)]">8</div>
          <div className="text-xs text-[var(--text-secondary)]">Analytics Reports</div>
        </PremiumCard>
        <PremiumCard padding="sm" className="text-center">
          <MapPin className="w-5 h-5 text-emerald-500 mx-auto mb-2" />
          <div className="text-2xl font-bold text-[var(--text-primary)]">6</div>
          <div className="text-xs text-[var(--text-secondary)]">Regional Reports</div>
        </PremiumCard>
        <PremiumCard padding="sm" className="text-center">
          <Clock className="w-5 h-5 text-amber-500 mx-auto mb-2" />
          <div className="text-2xl font-bold text-[var(--text-primary)]">3</div>
          <div className="text-xs text-[var(--text-secondary)]">Drafts</div>
        </PremiumCard>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {reports.map(r => (
          <PremiumCard key={r.title} className="p-6 flex flex-col justify-between hover:shadow-lg transition-shadow cursor-pointer group">
            <div>
              <div className="flex items-center justify-between mb-3">
                <span className={`px-2 py-1 rounded text-xs font-medium ${typeColor[r.type] || 'bg-[var(--border-subtle)] text-[var(--text-secondary)]'}`}>{r.type}</span>
                <span className={`text-xs font-medium ${r.status === 'Complete' ? 'text-emerald-500' : 'text-amber-500'}`}>{r.status}</span>
              </div>
              <h3 className="text-base font-semibold text-[var(--text-primary)] mb-2 group-hover:text-[var(--accent-primary)] transition-colors">{r.title}</h3>
              <div className="flex items-center gap-4 text-xs text-[var(--text-tertiary)]">
                <span className="flex items-center gap-1"><Clock className="w-3 h-3" /> {r.date}</span>
                <span className="flex items-center gap-1"><FileText className="w-3 h-3" /> {r.pages} pages</span>
              </div>
            </div>
            <button className="mt-4 w-full py-2 bg-[var(--bg-app)] border border-[var(--border-subtle)] rounded-lg text-sm font-medium text-[var(--text-primary)] hover:bg-[var(--border-subtle)] transition-colors flex items-center justify-center gap-2">
              <Download className="w-4 h-4" /> Download PDF
            </button>
          </PremiumCard>
        ))}
      </div>
    </div>
  );
}
