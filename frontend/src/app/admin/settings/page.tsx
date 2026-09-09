"use client";

import { useEffect, useState } from "react";
import { useTheme } from "next-themes";
import { Bell, Check, Copy, Key, Palette, Shield, User } from "lucide-react";
import { PageHeader } from "@/components/layout/page-header";
import { PremiumCard } from "@/components/ds/premium-card";
import { AppSettings, useSettings } from "@/context/SettingsContext";

function Toggle({ checked, onChange, label }: { checked: boolean; onChange: () => void; label: string }) {
  return <button type="button" role="switch" aria-checked={checked} aria-label={label} onClick={onChange} className={`relative h-7 w-12 rounded-full transition-colors ${checked ? "bg-[var(--accent-primary)]" : "bg-[var(--border-subtle)]"}`}><span className={`absolute top-1 h-5 w-5 rounded-full bg-white shadow-sm transition-transform ${checked ? "translate-x-6" : "translate-x-1"}`} /></button>;
}

function Select({ value, options, onChange }: { value: string; options: string[]; onChange: (value: string) => void }) {
  return <select value={value} onChange={(event) => onChange(event.target.value)} className="w-[210px] rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-app)] px-3 py-2 text-sm text-[var(--text-primary)] focus:outline-none focus:ring-1 focus:ring-[var(--accent-primary)]">{options.map((option) => <option key={option}>{option}</option>)}</select>;
}

export default function SettingsPage() {
  const { settings, saveSettings } = useSettings();
  const { setTheme } = useTheme();
  const [draft, setDraft] = useState<AppSettings>(settings);
  const [saved, setSaved] = useState(false);
  const [copied, setCopied] = useState(false);
  useEffect(() => setDraft(settings), [settings]);
  const update = <K extends keyof AppSettings>(key: K, value: AppSettings[K]) => setDraft((current) => ({ ...current, [key]: value }));
  const save = () => { saveSettings(draft); setTheme(draft.theme.toLowerCase()); setSaved(true); window.setTimeout(() => setSaved(false), 2200); };
  const cancel = () => setDraft(settings);
  const copyApiKey = async () => { await navigator.clipboard?.writeText(draft.apiKey); setCopied(true); window.setTimeout(() => setCopied(false), 1600); };
  const fieldClass = "w-[240px] rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-app)] px-3 py-2 text-right text-sm text-[var(--text-primary)] focus:outline-none focus:ring-1 focus:ring-[var(--accent-primary)]";

  return <div className="mx-auto min-h-screen max-w-[1920px] space-y-6 p-8">
    <PageHeader title="System Settings" description="Configure application preferences, user profile, security, and access controls." breadcrumbs={[{ label: "Home", href: "/" }, { label: "Administration" }, { label: "Settings" }]} />
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
      <PremiumCard className="p-6"><h2 className="mb-6 flex items-center gap-2 text-lg font-serif font-bold text-[var(--text-primary)]"><User className="h-5 w-5 text-[var(--accent-primary)]" />Profile</h2><div className="space-y-5">{([['Display Name', 'displayName'], ['Email', 'email'], ['Role', 'role'], ['Organization', 'organization']] as const).map(([label, key]) => <div key={key} className="flex items-center justify-between gap-4"><label className="text-sm font-medium text-[var(--text-secondary)]">{label}</label><input value={draft[key]} onChange={(event) => update(key, event.target.value)} className={fieldClass} /></div>)}</div></PremiumCard>
      <PremiumCard className="p-6"><h2 className="mb-6 flex items-center gap-2 text-lg font-serif font-bold text-[var(--text-primary)]"><Palette className="h-5 w-5 text-[var(--accent-primary)]" />Appearance</h2><div className="space-y-5"><div className="flex items-center justify-between"><label className="text-sm font-medium text-[var(--text-secondary)]">Theme</label><Select value={draft.theme} options={['Light', 'Dark', 'System']} onChange={(value) => update('theme', value as AppSettings['theme'])} /></div><div className="flex items-center justify-between"><label className="text-sm font-medium text-[var(--text-secondary)]">Sidebar Default</label><Select value={draft.sidebarDefault} options={['Expanded', 'Collapsed']} onChange={(value) => update('sidebarDefault', value as AppSettings['sidebarDefault'])} /></div><div className="flex items-center justify-between"><label className="text-sm font-medium text-[var(--text-secondary)]">Chart Color Scheme</label><Select value={draft.chartColorScheme} options={['Party Colors', 'Monochrome', 'Accessibility']} onChange={(value) => update('chartColorScheme', value as AppSettings['chartColorScheme'])} /></div><div className="flex items-center justify-between"><label className="text-sm font-medium text-[var(--text-secondary)]">Font Size</label><Select value={draft.fontSize} options={['Small', 'Medium', 'Large']} onChange={(value) => update('fontSize', value as AppSettings['fontSize'])} /></div></div></PremiumCard>
      <PremiumCard className="p-6"><h2 className="mb-6 flex items-center gap-2 text-lg font-serif font-bold text-[var(--text-primary)]"><Bell className="h-5 w-5 text-[var(--accent-primary)]" />Notifications</h2><div className="space-y-5">{([['Email Notifications', 'emailNotifications'], ['Alert Notifications', 'alertNotifications'], ['Weekly Report Digest', 'weeklyReportDigest'], ['Data Sync Alerts', 'dataSyncAlerts']] as const).map(([label, key]) => <div key={key} className="flex items-center justify-between"><label className="text-sm font-medium text-[var(--text-secondary)]">{label}</label><Toggle label={label} checked={draft[key]} onChange={() => update(key, !draft[key])} /></div>)}</div></PremiumCard>
      <PremiumCard className="p-6"><h2 className="mb-6 flex items-center gap-2 text-lg font-serif font-bold text-[var(--text-primary)]"><Shield className="h-5 w-5 text-[var(--accent-primary)]" />Security</h2><div className="space-y-5"><div className="flex items-center justify-between"><label className="text-sm font-medium text-[var(--text-secondary)]">Two-Factor Authentication</label><Toggle label="Two-Factor Authentication" checked={draft.twoFactorAuthentication} onChange={() => update('twoFactorAuthentication', !draft.twoFactorAuthentication)} /></div><div className="flex items-center justify-between"><label className="text-sm font-medium text-[var(--text-secondary)]">Session Timeout</label><Select value={draft.sessionTimeout} options={['15 minutes', '30 minutes', '1 hour', 'Never']} onChange={(value) => update('sessionTimeout', value as AppSettings['sessionTimeout'])} /></div><div className="flex items-center justify-between"><label className="text-sm font-medium text-[var(--text-secondary)]">API Key</label><button type="button" onClick={copyApiKey} className="flex w-[240px] items-center justify-between rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-app)] px-3 py-2 text-sm text-[var(--text-secondary)] hover:text-[var(--text-primary)]"><span className="flex items-center gap-2"><Key className="h-4 w-4" />{draft.apiKey}</span>{copied ? <Check className="h-4 w-4 text-emerald-500" /> : <Copy className="h-4 w-4" />}</button></div></div></PremiumCard>
    </div>
    <div className="flex items-center justify-end gap-3"><button type="button" onClick={cancel} className="rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-surface)] px-6 py-2.5 text-sm font-medium text-[var(--text-primary)] transition-colors hover:bg-[var(--border-subtle)]">Cancel</button><button type="button" onClick={save} className="flex items-center gap-2 rounded-lg bg-[var(--accent-primary)] px-6 py-2.5 text-sm font-medium text-[var(--bg-app)] transition-colors hover:bg-[var(--accent-primary-hover)]">{saved && <Check className="h-4 w-4" />}{saved ? 'Saved' : 'Save Changes'}</button></div>
  </div>;
}
