"use client";

import React from "react";
import { PageHeader } from "@/components/layout/page-header";
import { PremiumCard } from "@/components/ds/premium-card";
import { FolderOpen, Plus, Clock, Users, BarChart3, Star, MoreHorizontal } from "lucide-react";

const projects = [
  { name: "2022 Post-Mortem Analysis", owner: "Shivam Kumar", members: 4, lastEdited: "2 hours ago", saved: 12, status: "Active", starred: true },
  { name: "Western UP Alliance Impact", owner: "Priya Singh", members: 3, lastEdited: "1 day ago", saved: 8, status: "Active", starred: true },
  { name: "Caste Census Correlation", owner: "Shivam Kumar", members: 2, lastEdited: "3 days ago", saved: 5, status: "Active", starred: false },
  { name: "Booth-Level Swing Detection", owner: "Amit Verma", members: 5, lastEdited: "1 week ago", saved: 15, status: "Archived", starred: false },
  { name: "Turnout Prediction Model v2", owner: "Shivam Kumar", members: 3, lastEdited: "2 weeks ago", saved: 22, status: "Archived", starred: false },
];

export default function ProjectsPage() {
  return (
    <div className="p-8 max-w-[1920px] mx-auto min-h-screen space-y-6">
      <PageHeader
        title="Research Projects"
        description="Organize saved queries, collaborative workspaces, and research pipelines."
        breadcrumbs={[{ label: "Home", href: "/" }, { label: "Projects" }]}
        action={
          <button className="px-4 py-2 bg-[var(--accent-primary)] text-[var(--bg-app)] hover:bg-[var(--accent-primary-hover)] rounded-lg text-sm font-medium transition-colors flex items-center gap-2">
            <Plus className="w-4 h-4" /> New Project
          </button>
        }
      />

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <PremiumCard padding="sm" className="text-center">
          <FolderOpen className="w-5 h-5 text-[var(--accent-primary)] mx-auto mb-2" />
          <div className="text-2xl font-bold text-[var(--text-primary)]">5</div>
          <div className="text-xs text-[var(--text-secondary)]">Total Projects</div>
        </PremiumCard>
        <PremiumCard padding="sm" className="text-center">
          <BarChart3 className="w-5 h-5 text-emerald-500 mx-auto mb-2" />
          <div className="text-2xl font-bold text-[var(--text-primary)]">3</div>
          <div className="text-xs text-[var(--text-secondary)]">Active Projects</div>
        </PremiumCard>
        <PremiumCard padding="sm" className="text-center">
          <Users className="w-5 h-5 text-blue-500 mx-auto mb-2" />
          <div className="text-2xl font-bold text-[var(--text-primary)]">8</div>
          <div className="text-xs text-[var(--text-secondary)]">Team Members</div>
        </PremiumCard>
        <PremiumCard padding="sm" className="text-center">
          <Star className="w-5 h-5 text-amber-500 mx-auto mb-2" />
          <div className="text-2xl font-bold text-[var(--text-primary)]">62</div>
          <div className="text-xs text-[var(--text-secondary)]">Saved Queries</div>
        </PremiumCard>
      </div>

      <PremiumCard className="p-0 overflow-hidden">
        <div className="p-4 border-b border-[var(--border-subtle)] flex items-center justify-between">
          <h2 className="text-lg font-serif font-bold text-[var(--text-primary)]">All Projects</h2>
          <div className="flex items-center gap-3">
            <select className="px-3 py-2 bg-[var(--bg-app)] border border-[var(--border-subtle)] rounded-lg text-sm font-medium text-[var(--text-primary)]">
              <option>All Status</option><option>Active</option><option>Archived</option>
            </select>
          </div>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-[var(--bg-app)]/50 border-b border-[var(--border-subtle)]">
                {["", "Project Name", "Owner", "Members", "Saved Queries", "Last Edited", "Status"].map(h => (
                  <th key={h || "star"} className="px-6 py-3 text-xs font-semibold text-[var(--text-secondary)] uppercase tracking-wider whitespace-nowrap">{h}</th>
                ))}
                <th className="px-6 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--border-subtle)]">
              {projects.map(p => (
                <tr key={p.name} className="hover:bg-[var(--bg-app)]/30 transition-colors group cursor-pointer">
                  <td className="px-6 py-4"><Star className={`w-4 h-4 ${p.starred ? 'text-amber-500 fill-amber-500' : 'text-[var(--text-tertiary)]'}`} /></td>
                  <td className="px-6 py-4 text-sm font-semibold text-[var(--text-primary)] group-hover:text-[var(--accent-primary)] transition-colors">{p.name}</td>
                  <td className="px-6 py-4 text-sm text-[var(--text-secondary)]">{p.owner}</td>
                  <td className="px-6 py-4 text-sm text-[var(--text-primary)] text-center">{p.members}</td>
                  <td className="px-6 py-4 text-sm font-mono text-[var(--text-primary)] text-center">{p.saved}</td>
                  <td className="px-6 py-4 text-sm text-[var(--text-tertiary)]">{p.lastEdited}</td>
                  <td className="px-6 py-4"><span className={`px-2 py-1 rounded-full text-xs font-medium ${p.status === 'Active' ? 'bg-emerald-500/10 text-emerald-500' : 'bg-[var(--border-subtle)] text-[var(--text-tertiary)]'}`}>{p.status}</span></td>
                  <td className="px-6 py-4 text-right"><button className="p-1.5 text-[var(--text-tertiary)] hover:text-[var(--text-primary)] rounded-md hover:bg-[var(--bg-app)] transition-colors opacity-0 group-hover:opacity-100"><MoreHorizontal className="w-5 h-5" /></button></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </PremiumCard>
    </div>
  );
}
