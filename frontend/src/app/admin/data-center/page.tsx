"use client";

import { ChangeEvent, useEffect, useMemo, useRef, useState } from "react";
import { AlertTriangle, CheckCircle, Clock, Database, Download, ExternalLink, FileSpreadsheet, FileText, Globe2, HardDrive, Map, RefreshCw, Upload } from "lucide-react";
import { PageHeader } from "@/components/layout/page-header";
import { PremiumCard } from "@/components/ds/premium-card";
import { apiUrl } from "@/lib/api";

type DatasetStatus = "Live" | "Reference" | "Imported" | "Syncing";
type Dataset = { name: string; records: string; size: string; lastUpdated: string; status: DatasetStatus; source?: string; sourceType?: "Live API" | "Uploaded" | "Reference" };

const acceptedTypes = [".csv", ".xls", ".xlsx", ".json"];

const localResources = [
  { name: "2017 election results master CSV", path: "backend/up_2017_results.csv", detail: "403 constituencies with winner/runner-up, party, votes and margins.", icon: FileSpreadsheet },
  { name: "2017 verified constituency audit ranges", path: "Supplied ranges: 1–100, 101–200, 201–300, 301–403", detail: "403-row verification input used to correct 2017 turnout, margin, district, winner party and winner name fields.", icon: CheckCircle },
  { name: "2022 election results cross-check CSV", path: "wiki_2022.csv", detail: "Constituency-level 2022 winner and party reference used during validation.", icon: FileSpreadsheet },
  { name: "2017 constituency and booth archive", path: "2017 data/upvidhansabha2017/", detail: "Source archive, constituency metadata, text extracts and processing notes.", icon: FileText },
  { name: "2017 booth workbooks", path: "2017 data/excel_outputs/*.xlsx", detail: "Booth-level XLS/XLSX workbooks processed into turnout and booth analytics.", icon: FileSpreadsheet },
  { name: "2022 booth result PDFs and workbooks", path: "2022 data/ and 2022 data 2/", detail: "District/constituency booth-level PDFs and extracted spreadsheets.", icon: FileText },
  { name: "GIS and generated map resources", path: "map_data.json, constituency_totals.json", detail: "Normalized map/analytics payloads used by the dashboard map and summaries.", icon: Map },
];

const externalSources = [
  { name: "UttarPradeshElection.com — UP results, 2017", url: "https://uttarpradeshelection.com/results?year=2017", detail: "Primary web cross-check for all 403 constituency winners, parties, vote margins and turnout values supplied for the 2017 correction.", kind: "2017 verification" },
  { name: "Election Commission of India — Statistical Reports", url: "https://www.eci.gov.in/statistical-reports", detail: "Primary source for official state election statistical reports, including Uttar Pradesh 2017 and 2022.", kind: "Official" },
  { name: "Election Commission of India — Results Portal", url: "https://results.eci.gov.in/", detail: "Constituency-wise candidate, party, vote and result verification portal.", kind: "Official" },
  { name: "CEO Uttar Pradesh — Form 20 archive", url: "http://ceouttarpradesh.nic.in/Form20.aspx", detail: "Legacy Uttar Pradesh Chief Electoral Officer source referenced for Form 20 and booth-level result material.", kind: "Official / legacy" },
  { name: "Elections.in — UP Assembly 2017 results", url: "https://www.elections.in/uttar-pradesh/assembly-constituencies/2017-election-results.html", detail: "Independent constituency-level cross-check used for the 2017 winner list.", kind: "Cross-check" },
  { name: "Wikipedia — 2022 Uttar Pradesh election", url: "https://en.wikipedia.org/wiki/2022_Uttar_Pradesh_Legislative_Assembly_election", detail: "Secondary constituency table used for comparison and data-quality checks, not the primary source.", kind: "Cross-check" },
  { name: "Election Analytics — UP results fallback", url: "https://election-analytics.ajaikumark.com/state/uttar-pradesh/2022/", detail: "Fallback constituency reference used when an ECI result page was unavailable.", kind: "Fallback" },
  { name: "Census of India", url: "https://censusindia.gov.in/", detail: "Reference portal for demographic and district-level context.", kind: "Context" },
  { name: "CARTO basemaps", url: "https://carto.com/basemaps/", detail: "Map tile provider used by the interactive constituency map.", kind: "Mapping" },
  { name: "OpenStreetMap", url: "https://www.openstreetmap.org/copyright", detail: "Map data attribution and geographic context for map layers.", kind: "Mapping" },
  { name: "Wikimedia Commons — Uttar Pradesh locator map", url: "https://commons.wikimedia.org/wiki/File:Uttar_Pradesh_in_India.svg", detail: "Reference locator artwork used in map views.", kind: "Mapping" },
];

function formatSize(bytes: number) {
  if (bytes < 1024 * 1024) return `${Math.max(1, Math.round(bytes / 1024))} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function formatDate(date = new Date()) {
  return date.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

function statusClass(status: DatasetStatus) {
  if (status === "Live" || status === "Imported") return "bg-emerald-500/10 text-emerald-500";
  if (status === "Syncing") return "bg-blue-500/10 text-blue-500";
  return "bg-slate-500/10 text-slate-500";
}

export default function DataCenterPage() {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [datasets, setDatasets] = useState<Dataset[]>([]);
  const [loading, setLoading] = useState(true);
  const [notice, setNotice] = useState<{ type: "success" | "error"; text: string } | null>(null);

  const loadRegistry = async () => {
    setLoading(true);
    const live: Dataset[] = [];
    const constituencyYears = await Promise.all([2017, 2022].map(async (year) => {
      try {
        const response = await fetch(apiUrl(`/api/v1/analytics/constituencies?election_year=${year}`), { cache: "no-store" });
        const payload = await response.json();
        const isMock = payload.constituencies?.some((item: { name?: string }) => item.name?.startsWith("Mock "));
        return !isMock && response.ok && payload.total ? { year, total: payload.total } : null;
      } catch { return null; }
    }));
    constituencyYears.filter(Boolean).forEach((item) => live.push({ name: `UP Assembly ${item!.year} — Constituency Results API`, records: String(item!.total), size: "Live API", lastUpdated: "Live from backend", status: "Live", sourceType: "Live API" }));
    try {
      const response = await fetch(apiUrl("/api/v1/analytics/candidates?election_year=2017&limit=1"), { cache: "no-store" });
      const payload = await response.json();
      if (response.ok && payload.total) live.push({ name: "UP Assembly 2017 — Candidate Results API", records: String(payload.total), size: "Live API", lastUpdated: "Live from backend", status: "Live", sourceType: "Live API" });
    } catch { /* Keep the registry honest when the API is unavailable. */ }
    try {
      const response = await fetch(apiUrl("/api/v1/upload/files"), { cache: "no-store" });
      const payload = await response.json();
      const uploaded: Dataset[] = (response.ok ? payload.files || [] : []).map((file: { filename: string; size: number; created: string }) => ({ name: file.filename, records: "Uploaded", size: formatSize(file.size), lastUpdated: formatDate(new Date(file.created)), status: "Imported", source: "Uploaded", sourceType: "Uploaded" }));
      live.push(...uploaded);
    } catch { /* Upload registry is optional while the backend is offline. */ }
    live.push({ name: "2022 election validation export", records: "Repository file", size: "CSV", lastUpdated: "Versioned in repository", status: "Reference", source: "wiki_2022.csv", sourceType: "Reference" });
    setDatasets(live);
    setLoading(false);
  };

  useEffect(() => { loadRegistry(); }, []);

  useEffect(() => {
    if (!notice) return;
    const timer = window.setTimeout(() => setNotice(null), 3500);
    return () => window.clearTimeout(timer);
  }, [notice]);

  const summary = useMemo(() => ({
    active: datasets.length,
    synced: datasets.filter((dataset) => dataset.status === "Live" || dataset.status === "Imported").length,
    pending: datasets.filter((dataset) => dataset.status === "Reference").length,
    storage: datasets.reduce((total, dataset) => total + (Number.parseFloat(dataset.size.replace(/[^0-9.]/g, "")) || 0), 0),
  }), [datasets]);

  const downloadManifest = (dataset: Dataset) => {
    const blob = new Blob([JSON.stringify({ ...dataset, exportedAt: new Date().toISOString() }, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `${dataset.name.toLowerCase().replace(/[^a-z0-9]+/g, "-")}-manifest.json`;
    anchor.click();
    URL.revokeObjectURL(url);
    setNotice({ type: "success", text: `${dataset.name} manifest downloaded.` });
  };

  const importDataset = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    const extension = `.${file.name.split(".").pop()?.toLowerCase()}`;
    if (!acceptedTypes.includes(extension)) {
      setNotice({ type: "error", text: "Unsupported file type. Use CSV, XLS, XLSX or JSON." });
      return;
    }
    const formData = new FormData();
    formData.append("file", file);
    setNotice({ type: "success", text: `Uploading ${file.name}...` });
    try {
      const response = await fetch(apiUrl("/api/v1/upload/"), { method: "POST", body: formData });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(payload.detail || "Upload failed");
      const imported: Dataset = { name: file.name, records: payload.detected_schema?.rows ? String(payload.detected_schema.rows) : "Uploaded", size: formatSize(payload.file_size || file.size), lastUpdated: formatDate(), status: "Imported", source: "Uploaded", sourceType: "Uploaded" };
      setDatasets((current) => [imported, ...current.filter((dataset) => dataset.name !== file.name)]);
      setNotice({ type: "success", text: `${file.name} was uploaded and schema-detected.` });
    } catch (error) {
      setNotice({ type: "error", text: error instanceof Error ? error.message : "The dataset upload failed." });
    }
  };

  return <div className="mx-auto min-h-screen max-w-[1920px] space-y-6 p-8">
    <PageHeader title="Data Center" description="Manage datasets, imports, API integrations, and data pipeline health." breadcrumbs={[{ label: "Home", href: "/" }, { label: "Administration" }, { label: "Data Center" }]} action={<><input ref={fileInputRef} type="file" accept={acceptedTypes.join(",")} className="hidden" onChange={importDataset} /><button onClick={() => fileInputRef.current?.click()} className="flex items-center gap-2 rounded-lg bg-[var(--accent-primary)] px-4 py-2 text-sm font-medium text-[var(--bg-app)] transition-colors hover:bg-[var(--accent-primary-hover)]"><Upload className="h-4 w-4" />Import Dataset</button></>} />

    {notice && <div role="status" className={`rounded-lg border px-4 py-3 text-sm ${notice.type === "success" ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-500" : "border-rose-500/30 bg-rose-500/10 text-rose-500"}`}>{notice.text}</div>}

    <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
      <PremiumCard padding="sm" className="text-center"><Database className="mx-auto mb-2 h-5 w-5 text-[var(--accent-primary)]" /><div className="text-2xl font-bold text-[var(--text-primary)]">{summary.active}</div><div className="text-xs text-[var(--text-secondary)]">Active Datasets</div></PremiumCard>
      <PremiumCard padding="sm" className="text-center"><HardDrive className="mx-auto mb-2 h-5 w-5 text-blue-500" /><div className="text-2xl font-bold text-[var(--text-primary)]">{summary.storage.toFixed(1)} MB</div><div className="text-xs text-[var(--text-secondary)]">Registered Storage</div></PremiumCard>
      <PremiumCard padding="sm" className="text-center"><CheckCircle className="mx-auto mb-2 h-5 w-5 text-emerald-500" /><div className="text-2xl font-bold text-emerald-500">{summary.synced}</div><div className="text-xs text-[var(--text-secondary)]">Live / Imported</div></PremiumCard>
      <PremiumCard padding="sm" className="text-center"><AlertTriangle className="mx-auto mb-2 h-5 w-5 text-amber-500" /><div className="text-2xl font-bold text-amber-500">{summary.pending}</div><div className="text-xs text-[var(--text-secondary)]">References</div></PremiumCard>
    </div>

    <PremiumCard className="overflow-hidden p-0"><div className="flex items-center justify-between border-b border-[var(--border-subtle)] p-4"><div><h2 className="text-lg font-serif font-bold text-[var(--text-primary)]">Live Data Registry</h2><p className="mt-1 text-xs text-[var(--text-secondary)]">Only backend API responses, uploaded files, and versioned repository references are listed.</p></div><button onClick={() => loadRegistry()} disabled={loading} className="flex items-center gap-2 rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-app)] px-3 py-2 text-sm font-medium text-[var(--text-primary)] transition-colors hover:bg-[var(--border-subtle)] disabled:cursor-wait disabled:opacity-60"><RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />{loading ? "Loading..." : "Refresh Registry"}</button></div><div className="overflow-x-auto"><table className="w-full border-collapse text-left"><thead><tr className="border-b border-[var(--border-subtle)] bg-[var(--bg-app)]/50">{["Dataset", "Records", "Size", "Last Updated", "Status", "Actions"].map((header) => <th key={header} className="whitespace-nowrap px-6 py-3 text-xs font-semibold uppercase tracking-wider text-[var(--text-secondary)]">{header}</th>)}</tr></thead><tbody className="divide-y divide-[var(--border-subtle)]">{loading ? <tr><td colSpan={6} className="px-6 py-12 text-center text-sm text-[var(--text-secondary)]">Reading live sources...</td></tr> : datasets.length === 0 ? <tr><td colSpan={6} className="px-6 py-12 text-center text-sm text-[var(--text-secondary)]">No live or uploaded data sources are available.</td></tr> : datasets.map((dataset) => <tr key={dataset.name} className="transition-colors hover:bg-[var(--bg-app)]/30"><td className="px-6 py-4 text-sm font-semibold text-[var(--text-primary)]">{dataset.name}{dataset.source && <span className="ml-2 rounded-full bg-blue-500/10 px-2 py-0.5 text-[10px] font-medium text-blue-500">{dataset.source}</span>}</td><td className="px-6 py-4 text-sm font-mono text-[var(--text-primary)]">{dataset.records}</td><td className="px-6 py-4 text-sm text-[var(--text-secondary)]">{dataset.size}</td><td className="flex items-center gap-1 px-6 py-4 text-sm text-[var(--text-tertiary)]"><Clock className="h-3 w-3" />{dataset.lastUpdated}</td><td className="px-6 py-4"><span className={`rounded-full px-2 py-1 text-xs font-medium ${statusClass(dataset.status)}`}>{dataset.status}</span></td><td className="px-6 py-4"><div className="flex items-center gap-2"><button aria-label={`Download ${dataset.name} manifest`} onClick={() => downloadManifest(dataset)} className="rounded-md p-1.5 text-[var(--text-tertiary)] transition-colors hover:bg-[var(--bg-app)] hover:text-[var(--text-primary)]"><Download className="h-4 w-4" /></button><button aria-label={`Refresh ${dataset.name}`} onClick={() => loadRegistry()} disabled={loading} className="rounded-md p-1.5 text-[var(--text-tertiary)] transition-colors hover:bg-[var(--bg-app)] hover:text-[var(--text-primary)] disabled:cursor-wait disabled:opacity-50"><RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} /></button></div></td></tr>)}</tbody></table></div></PremiumCard>

    <div className="grid grid-cols-1 gap-6 lg:grid-cols-2"><PremiumCard className="p-6"><div className="mb-5 flex items-start justify-between gap-4"><div><h2 className="flex items-center gap-2 text-lg font-serif font-bold text-[var(--text-primary)]"><FileSpreadsheet className="h-5 w-5 text-[var(--accent-primary)]" />Local Data Resources</h2><p className="mt-1 text-sm text-[var(--text-secondary)]">Files and folders used by the project pipeline.</p></div><span className="rounded-full bg-[var(--accent-primary)]/10 px-2.5 py-1 text-xs font-medium text-[var(--accent-primary)]">6 groups</span></div><div className="space-y-3">{localResources.map((resource) => <div key={resource.path} className="rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-app)]/60 p-4"><div className="flex items-start gap-3"><resource.icon className="mt-0.5 h-4 w-4 shrink-0 text-[var(--accent-primary)]" /><div className="min-w-0"><p className="text-sm font-semibold text-[var(--text-primary)]">{resource.name}</p><p className="mt-1 break-all font-mono text-xs text-[var(--text-tertiary)]">{resource.path}</p><p className="mt-2 text-xs leading-5 text-[var(--text-secondary)]">{resource.detail}</p></div></div></div>)}</div></PremiumCard><PremiumCard className="p-6"><div className="mb-5 flex items-start justify-between gap-4"><div><h2 className="flex items-center gap-2 text-lg font-serif font-bold text-[var(--text-primary)]"><Globe2 className="h-5 w-5 text-[var(--accent-primary)]" />External Sources & References</h2><p className="mt-1 text-sm text-[var(--text-secondary)]">Source links used for collection, validation, context and mapping.</p></div><span className="rounded-full bg-[var(--accent-primary)]/10 px-2.5 py-1 text-xs font-medium text-[var(--accent-primary)]">{externalSources.length} links</span></div><div className="space-y-3">{externalSources.map((source) => <a key={source.url} href={source.url} target="_blank" rel="noreferrer" className="group block rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-app)]/60 p-4 transition-colors hover:border-[var(--accent-primary)]/50 hover:bg-[var(--accent-primary)]/5"><div className="flex items-start justify-between gap-3"><div><div className="flex items-center gap-2"><p className="text-sm font-semibold text-[var(--text-primary)] group-hover:text-[var(--accent-primary)]">{source.name}</p><ExternalLink className="h-3.5 w-3.5 text-[var(--text-tertiary)]" /></div><p className="mt-1 break-all font-mono text-xs text-[var(--text-tertiary)]">{source.url}</p><p className="mt-2 text-xs leading-5 text-[var(--text-secondary)]">{source.detail}</p></div><span className="shrink-0 rounded-full border border-[var(--border-subtle)] px-2 py-0.5 text-[10px] font-medium text-[var(--text-tertiary)]">{source.kind}</span></div></a>)}</div></PremiumCard></div>
    <PremiumCard className="p-6"><div className="flex items-start gap-3"><FileText className="mt-0.5 h-5 w-5 shrink-0 text-[var(--accent-primary)]" /><div><h2 className="text-lg font-serif font-bold text-[var(--text-primary)]">Data lineage & verification note</h2><p className="mt-2 max-w-4xl text-sm leading-6 text-[var(--text-secondary)]">Election results are treated as official only when supported by Election Commission of India material. Secondary sources are retained for cross-checking names, constituency labels and missing pages. Booth and demographic resources support analytics and context rather than determining the official winner.</p></div></div></PremiumCard>
  </div>;
}
