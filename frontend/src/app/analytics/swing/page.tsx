"use client";

import React, { useEffect, useMemo, useState } from "react";
import { PageHeader } from "@/components/layout/page-header";
import { PremiumCard } from "@/components/ds/premium-card";
import { Download, ArrowRightLeft, TrendingUp, AlertTriangle } from "lucide-react";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";
import { apiUrl } from "@/lib/api";
import { useElectionContext } from "@/context/ElectionContext";

type Constituency = {
  code: string | number;
  name: string;
  winner_party?: string;
  votes_polled?: number;
  winning_margin?: number;
};

type SwingRow = { constituency: string; swing: number; from: string; to: string };
type DistributionRow = { range: string; toBJP: number; toSP: number; toBSP: number; toOthers: number };

const normalizeParty = (party?: string) => {
  if (!party) return "Others";
  if (["BJP", "SP", "BSP", "INC"].includes(party)) return party;
  return "Others";
};

const marginShare = (c: Constituency) => {
  const votes = Number(c.votes_polled) || 0;
  const margin = Math.abs(Number(c.winning_margin) || 0);
  return votes > 0 ? (margin / votes) * 100 : 0;
};

export default function SwingPage() {
  const { viewMode, is2017, isComparison } = useElectionContext();
  const [rows, setRows] = useState<SwingRow[]>([]);
  const [distribution, setDistribution] = useState<DistributionRow[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    async function loadSwingData() {
      try {
        const [r17, r22] = await Promise.all([
          fetch(apiUrl("/api/v1/analytics/constituencies?election_year=2017"), { cache: "no-store" }),
          fetch(apiUrl("/api/v1/analytics/constituencies?election_year=2022"), { cache: "no-store" })
        ]);
        if (!r17.ok || !r22.ok) throw new Error("Unable to load election results");
        const [d17, d22] = await Promise.all([r17.json(), r22.json()]);
        const byCode17 = new Map<string, Constituency>(
          (d17.constituencies || []).map((c: Constituency) => [String(c.code), c])
        );
        const rows17: SwingRow[] = (d17.constituencies || [])
          .map((c: Constituency) => ({ constituency: c.name, swing: marginShare(c), from: "—", to: normalizeParty(c.winner_party) }))
          .sort((a: SwingRow, b: SwingRow) => b.swing - a.swing);
        const rows22: SwingRow[] = (d22.constituencies || [])
          .map((c: Constituency) => ({ constituency: c.name, swing: marginShare(c), from: "—", to: normalizeParty(c.winner_party) }))
          .sort((a: SwingRow, b: SwingRow) => b.swing - a.swing);
        const comparisons = (d22.constituencies || [])
          .map((c22: Constituency) => {
            const c17 = byCode17.get(String(c22.code));
            if (!c17) return null;
            return {
              constituency: c22.name,
              swing: Math.abs(marginShare(c22) - marginShare(c17)),
              from: normalizeParty(c17.winner_party),
              to: normalizeParty(c22.winner_party)
            } satisfies SwingRow;
          })
          .filter((row: SwingRow | null): row is SwingRow => row !== null)
          .sort((a: SwingRow, b: SwingRow) => b.swing - a.swing);
        const selectedRows = isComparison ? comparisons : (is2017 ? rows17 : rows22);

        const ranges = ["0-5%", "5-10%", "10-15%", "15-20%", "20%+"];
        const buckets = ranges.map((range) => ({ range, toBJP: 0, toSP: 0, toBSP: 0, toOthers: 0 }));
        selectedRows.forEach((row: SwingRow) => {
          const index = row.swing < 5 ? 0 : row.swing < 10 ? 1 : row.swing < 15 ? 2 : row.swing < 20 ? 3 : 4;
          const key = row.to === "BJP" ? "toBJP" : row.to === "SP" ? "toSP" : row.to === "BSP" ? "toBSP" : "toOthers";
          buckets[index][key] += 1;
        });

        if (!cancelled) {
          setRows(selectedRows);
          setDistribution(buckets);
        }
      } catch (error) {
        console.error("Failed to load swing analysis", error);
        if (!cancelled) { setRows([]); setDistribution([]); }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    loadSwingData();
    return () => { cancelled = true; };
  }, [is2017, isComparison]);

  const changedHands = useMemo(() => rows.filter((row) => row.from !== "—" && row.from !== row.to).length, [rows]);
  const maxSwing = rows[0];
  const averageSwing = rows.length ? rows.reduce((sum, row) => sum + row.swing, 0) / rows.length : 0;
  const highSwing = rows.filter((row) => row.swing > 10).length;

  return (
    <div className="p-8 max-w-[1920px] mx-auto min-h-screen space-y-6">
      <PageHeader
        title="Swing Analysis"
        description={isComparison ? "Real constituency-level change in winning-margin share between the 2017 and 2022 results." : `Real ${is2017 ? "2017" : "2022"} constituency winning-margin analysis.`}
        breadcrumbs={[{ label: "Home", href: "/" }, { label: "Analytics Lab" }, { label: "Swing Analysis" }]}
        action={<button className="px-4 py-2 bg-[var(--accent-primary)] text-[var(--bg-app)] hover:bg-[var(--accent-primary-hover)] rounded-lg text-sm font-medium transition-colors flex items-center gap-2"><Download className="w-4 h-4" /> Export Report</button>}
      />

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <PremiumCard padding="sm" className="text-center"><ArrowRightLeft className="w-5 h-5 text-[var(--accent-primary)] mx-auto mb-2" /><div className="text-2xl font-bold text-[var(--text-primary)]">{loading ? "—" : isComparison ? changedHands : rows.length}</div><div className="text-xs text-[var(--text-secondary)]">{isComparison ? "Seats Changed Hands" : "Seats Analyzed"}</div></PremiumCard>
        <PremiumCard padding="sm" className="text-center"><TrendingUp className="w-5 h-5 text-[#F97316] mx-auto mb-2" /><div className="text-2xl font-bold text-[var(--text-primary)]">{loading ? "—" : `${maxSwing?.swing.toFixed(1) ?? "0.0"}%`}</div><div className="text-xs text-[var(--text-secondary)]">{isComparison ? "Max Swing" : "Max Margin Share"}{maxSwing ? ` (${maxSwing.constituency})` : ""}</div></PremiumCard>
        <PremiumCard padding="sm" className="text-center"><TrendingUp className="w-5 h-5 text-emerald-500 mx-auto mb-2" /><div className="text-2xl font-bold text-[var(--text-primary)]">{loading ? "—" : `${averageSwing.toFixed(1)}%`}</div><div className="text-xs text-[var(--text-secondary)]">{isComparison ? "Avg Swing" : "Avg Margin Share"}</div></PremiumCard>
        <PremiumCard padding="sm" className="text-center"><AlertTriangle className="w-5 h-5 text-amber-500 mx-auto mb-2" /><div className="text-2xl font-bold text-[var(--text-primary)]">{loading ? "—" : highSwing}</div><div className="text-xs text-[var(--text-secondary)]">{isComparison ? "High Swing (>10%)" : "High Margin Share (>10%)"}</div></PremiumCard>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <PremiumCard className="p-6 h-[420px] flex flex-col">
          <h2 className="text-lg font-serif font-bold text-[var(--text-primary)] mb-1">{isComparison ? "Swing Distribution by 2022 Winner" : `${is2017 ? "2017" : "2022"} Margin Distribution by Winner`}</h2>
          <p className="text-xs text-[var(--text-secondary)] mb-4">{isComparison ? "Change in winning-margin share of votes" : "Winning-margin share of votes"}</p>
          <div className="flex-1 w-full min-h-0"><ResponsiveContainer width="100%" height="100%"><BarChart data={distribution} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}><CartesianGrid strokeDasharray="3 3" stroke="var(--border-subtle)" vertical={false} /><XAxis dataKey="range" stroke="var(--text-secondary)" tick={{ fill: "var(--text-secondary)", fontSize: 12 }} axisLine={false} tickLine={false} /><YAxis stroke="var(--text-secondary)" tick={{ fill: "var(--text-secondary)", fontSize: 12 }} axisLine={false} tickLine={false} /><Tooltip contentStyle={{ backgroundColor: "var(--bg-surface)", border: "1px solid var(--border-subtle)", borderRadius: "8px", color: "var(--text-primary)" }} /><Bar dataKey="toBJP" name={`${isComparison ? "2022" : is2017 ? "2017" : "2022"} BJP winners`} fill="#F97316" stackId="a" /><Bar dataKey="toSP" name={`${isComparison ? "2022" : is2017 ? "2017" : "2022"} SP winners`} fill="#EF4444" stackId="a" /><Bar dataKey="toBSP" name={`${isComparison ? "2022" : is2017 ? "2017" : "2022"} BSP winners`} fill="#2563EB" stackId="a" /><Bar dataKey="toOthers" name="Other winners" fill="#94A3B8" radius={[4, 4, 0, 0]} stackId="a" /></BarChart></ResponsiveContainer></div>
        </PremiumCard>

        <PremiumCard className="p-6 h-[420px] flex flex-col">
          <h2 className="text-lg font-serif font-bold text-[var(--text-primary)] mb-4">Top 10 {isComparison ? "Swing" : "Margin Share"} Constituencies</h2>
          <div className="flex-1 overflow-y-auto space-y-3 pr-2">
            {loading ? <div className="text-sm text-[var(--text-secondary)]">Loading live election results…</div> : rows.slice(0, 10).map((row, index) => <div key={row.constituency} className="flex items-center gap-4 p-3 rounded-xl bg-[var(--bg-app)] border border-[var(--border-subtle)]"><span className="text-lg font-bold text-[var(--text-tertiary)] w-8 text-center">#{index + 1}</span><div className="flex-1"><div className="text-sm font-semibold text-[var(--text-primary)]">{row.constituency}</div><div className="text-xs text-[var(--text-secondary)]">{isComparison ? `${row.from} → ${row.to}` : `Winner: ${row.to}`}</div></div><span className="text-lg font-bold text-rose-500">{row.swing.toFixed(1)}%</span></div>)}
            {!loading && rows.length === 0 && <div className="text-sm text-[var(--text-secondary)]">No comparable constituency results found.</div>}
          </div>
        </PremiumCard>
      </div>
    </div>
  );
}
