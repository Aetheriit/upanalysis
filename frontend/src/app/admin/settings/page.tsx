"use client";

import React from "react";
import { PageHeader } from "@/components/layout/page-header";
import { PremiumCard } from "@/components/ds/premium-card";
import { Settings2, User, Shield, Bell, Palette, Globe, Key, Monitor } from "lucide-react";

const settingSections = [
  {
    title: "Profile",
    icon: User,
    settings: [
      { label: "Display Name", value: "Shivam Kumar", type: "text" },
      { label: "Email", value: "shivam@electionintel.in", type: "text" },
      { label: "Role", value: "Senior Analyst", type: "text" },
      { label: "Organization", value: "ElectionIntel Research", type: "text" },
    ]
  },
  {
    title: "Appearance",
    icon: Palette,
    settings: [
      { label: "Theme", value: "System", type: "select", options: ["Light", "Dark", "System"] },
      { label: "Sidebar Default", value: "Expanded", type: "select", options: ["Expanded", "Collapsed"] },
      { label: "Chart Color Scheme", value: "Party Colors", type: "select", options: ["Party Colors", "Monochrome", "Accessibility"] },
      { label: "Font Size", value: "Medium", type: "select", options: ["Small", "Medium", "Large"] },
    ]
  },
  {
    title: "Notifications",
    icon: Bell,
    settings: [
      { label: "Email Notifications", value: true, type: "toggle" },
      { label: "Alert Notifications", value: true, type: "toggle" },
      { label: "Weekly Report Digest", value: false, type: "toggle" },
      { label: "Data Sync Alerts", value: true, type: "toggle" },
    ]
  },
  {
    title: "Security",
    icon: Shield,
    settings: [
      { label: "Two-Factor Authentication", value: true, type: "toggle" },
      { label: "Session Timeout", value: "30 minutes", type: "select", options: ["15 minutes", "30 minutes", "1 hour", "Never"] },
      { label: "API Key", value: "sk-••••••••••••", type: "text" },
    ]
  },
];

export default function SettingsPage() {
  return (
    <div className="p-8 max-w-[1920px] mx-auto min-h-screen space-y-6">
      <PageHeader
        title="System Settings"
        description="Configure application preferences, user profile, security, and access controls."
        breadcrumbs={[{ label: "Home", href: "/" }, { label: "Administration" }, { label: "Settings" }]}
      />

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {settingSections.map(section => (
          <PremiumCard key={section.title} className="p-6">
            <h2 className="text-lg font-serif font-bold text-[var(--text-primary)] mb-6 flex items-center gap-2">
              <section.icon className="w-5 h-5 text-[var(--accent-primary)]" />
              {section.title}
            </h2>
            <div className="space-y-5">
              {section.settings.map(s => (
                <div key={s.label} className="flex items-center justify-between">
                  <label className="text-sm font-medium text-[var(--text-secondary)]">{s.label}</label>
                  {s.type === "text" && (
                    <input
                      type="text"
                      defaultValue={s.value as string}
                      className="px-3 py-2 bg-[var(--bg-app)] border border-[var(--border-subtle)] rounded-lg text-sm text-[var(--text-primary)] w-[240px] text-right focus:outline-none focus:ring-1 focus:ring-[var(--accent-primary)]"
                    />
                  )}
                  {s.type === "select" && (
                    <select
                      defaultValue={s.value as string}
                      className="px-3 py-2 bg-[var(--bg-app)] border border-[var(--border-subtle)] rounded-lg text-sm text-[var(--text-primary)] w-[200px] focus:outline-none focus:ring-1 focus:ring-[var(--accent-primary)]"
                    >
                      {s.options?.map(o => <option key={o}>{o}</option>)}
                    </select>
                  )}
                  {s.type === "toggle" && (
                    <button
                      className={`relative w-12 h-7 rounded-full transition-colors ${
                        s.value ? 'bg-[var(--accent-primary)]' : 'bg-[var(--border-subtle)]'
                      }`}
                    >
                      <span
                        className={`absolute top-1 w-5 h-5 bg-white rounded-full shadow-sm transition-transform ${
                          s.value ? 'translate-x-6' : 'translate-x-1'
                        }`}
                      />
                    </button>
                  )}
                </div>
              ))}
            </div>
          </PremiumCard>
        ))}
      </div>

      <div className="flex justify-end gap-3">
        <button className="px-6 py-2.5 bg-[var(--bg-surface)] border border-[var(--border-subtle)] text-[var(--text-primary)] rounded-lg text-sm font-medium hover:bg-[var(--border-subtle)] transition-colors">
          Cancel
        </button>
        <button className="px-6 py-2.5 bg-[var(--accent-primary)] text-[var(--bg-app)] hover:bg-[var(--accent-primary-hover)] rounded-lg text-sm font-medium transition-colors">
          Save Changes
        </button>
      </div>
    </div>
  );
}
