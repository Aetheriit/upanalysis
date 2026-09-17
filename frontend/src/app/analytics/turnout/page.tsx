"use client";

import React, { useEffect, useState } from "react";
import { PageHeader } from "@/components/layout/page-header";
import { PremiumCard } from "@/components/ds/premium-card";
import { Download, Users, TrendingUp, ArrowDown, ArrowUp, AlertTriangle } from "lucide-react";
import { BarChart, Bar, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from "recharts";
import { apiUrl } from "@/lib/api";
import { useElectionContext } from "@/context/ElectionContext";
import { downloadCsv } from "@/lib/export";

type TurnoutData = {
  year: number;
  overall_turnout: number;
  change_from_prev: number;
  highest: { name: string; turnout: number };
  lowest: { name: string; turnout: number };
  historical: { year: string; turnout: number }[];
  regional: { region: string; [year: string]: number | string }[];
  gender: { category: string; [year: string]: number | string }[];
};

export default function TurnoutPage() {
  const { is2017 } = useElectionContext();
  const [data, setData] = useState<TurnoutData | null>(null);
  const [loading, setLoading] = useState(true);

  const selectedYear = is2017 ? 2017 : 2022;
  const prevYear = is2017 ? 2012 : 2017;

  useEffect(() => {
    let cancelled = false;
    async function loadTurnout() {
      setLoading(true);
      try {
        const res = await fetch(apiUrl(`/api/v1/analytics/turnout?election_year=${selectedYear}`), { cache: "no-store" });
        if (!res.ok) throw new Error("Failed to load turnout data");
        const json = await res.json();
        if (!cancelled) {
          setData(json);
        }
      } catch (err) {
        console.error(err);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    loadTurnout();
    return () => { cancelled = true; };
  }, [selectedYear]);

  const changeIsPositive = (data?.change_from_prev || 0) >= 0;
  // Turnout is displayed as a percentage throughout the app. Older API/cache
  // responses can contain the equivalent fraction (0.6129), so normalize it
  // before plotting to prevent a misleading 0.x/1.x axis.
  const historicalChartData = (data?.historical || []).map((point) => ({
    ...point,
    turnout: point.turnout > 0 && point.turnout <= 1.5 ? point.turnout * 100 : point.turnout,
  }));
  const exportTurnout = () => data && downloadCsv(`turnout-${selectedYear}.csv`, [
    ...(data.regional || []), ...(data.gender || []), ...(data.historical || []),
  ]);

  return (
    <div className="p-8 max-w-[1920px] mx-auto min-h-screen space-y-6">
      <PageHeader
        title="Turnout Analytics"
        description={`Voter participation analysis by region, gender, urban/rural, and historical trends for the ${selectedYear} election.`}
        breadcrumbs={[{ label: "Home", href: "/" }, { label: "Analytics Lab" }, { label: "Turnout Analysis" }]}
        action={<button onClick={exportTurnout} disabled={!data} className="px-4 py-2 bg-[var(--accent-primary)] text-[var(--bg-app)] hover:bg-[var(--accent-primary-hover)] disabled:opacity-50 rounded-lg text-sm font-medium transition-colors flex items-center gap-2"><Download className="w-4 h-4" /> Export Report</button>}
      />

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <PremiumCard padding="sm" className="text-center">
          <Users className="w-5 h-5 text-[var(--accent-primary)] mx-auto mb-2" />
          <div className="text-2xl font-bold text-[var(--text-primary)]">
            {loading ? "—" : `${data?.overall_turnout ?? 0}%`}
          </div>
          <div className="text-xs text-[var(--text-secondary)]">Overall Turnout {selectedYear}</div>
        </PremiumCard>
        <PremiumCard padding="sm" className="text-center">
          {changeIsPositive ? <ArrowUp className="w-5 h-5 text-emerald-500 mx-auto mb-2" /> : <ArrowDown className="w-5 h-5 text-rose-500 mx-auto mb-2" />}
          <div className={`text-2xl font-bold ${changeIsPositive ? 'text-emerald-500' : 'text-rose-500'}`}>
            {loading ? "—" : `${changeIsPositive ? '+' : ''}${data?.change_from_prev ?? 0}%`}
          </div>
          <div className="text-xs text-[var(--text-secondary)]">Change from {prevYear}</div>
        </PremiumCard>
        <PremiumCard padding="sm" className="text-center">
          <TrendingUp className="w-5 h-5 text-blue-500 mx-auto mb-2" />
          <div className="text-2xl font-bold text-[var(--text-primary)]">
            {loading ? "—" : `${data?.highest.turnout ?? 0}%`}
          </div>
          <div className="text-xs text-[var(--text-secondary)]">Highest ({data?.highest.name ?? "N/A"})</div>
        </PremiumCard>
        <PremiumCard padding="sm" className="text-center">
          <ArrowDown className="w-5 h-5 text-rose-500 mx-auto mb-2" />
          <div className="text-2xl font-bold text-[var(--text-primary)]">
            {loading ? "—" : `${data?.lowest.turnout ?? 0}%`}
          </div>
          <div className="text-xs text-[var(--text-secondary)]">Lowest ({data?.lowest.name ?? "N/A"})</div>
        </PremiumCard>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <PremiumCard className="p-6 h-[400px] flex flex-col">
          <h2 className="text-lg font-serif font-bold text-[var(--text-primary)] mb-4">Regional Turnout ({prevYear} vs {selectedYear})</h2>
          <div className="flex-1 w-full min-h-0">
            {loading ? (
               <div className="h-full flex items-center justify-center text-[var(--text-secondary)] text-sm gap-2">
                 Loading regional turnout...
               </div>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={data?.regional || []} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--border-subtle)" vertical={false} />
                  <XAxis dataKey="region" stroke="var(--text-secondary)" tick={{ fill: 'var(--text-secondary)', fontSize: 11 }} axisLine={false} tickLine={false} />
                  <YAxis stroke="var(--text-secondary)" tick={{ fill: 'var(--text-secondary)', fontSize: 12 }} axisLine={false} tickLine={false} domain={['auto', 'auto']} tickFormatter={(v) => `${v}%`} />
                  <Tooltip contentStyle={{ backgroundColor: 'var(--bg-surface)', border: '1px solid var(--border-subtle)', borderRadius: '8px', color: 'var(--text-primary)' }} />
                  <Legend iconType="circle" wrapperStyle={{ fontSize: '12px' }} />
                  <Bar dataKey={String(prevYear)} name={`${prevYear} Turnout`} fill="#D4AF37" fillOpacity={0.4} radius={[4, 4, 0, 0]} />
                  <Bar dataKey={String(selectedYear)} name={`${selectedYear} Turnout`} fill="#D4AF37" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </div>
        </PremiumCard>

        <PremiumCard className="p-6 h-[400px] flex flex-col">
          <h2 className="text-lg font-serif font-bold text-[var(--text-primary)] mb-4">Historical Turnout Trend</h2>
          <div className="flex-1 w-full min-h-0">
            {loading ? (
               <div className="h-full flex items-center justify-center text-[var(--text-secondary)] text-sm gap-2">
                 Loading historical trend...
               </div>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={historicalChartData} margin={{ top: 10, right: 30, left: 8, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--border-subtle)" vertical={false} />
                  <XAxis dataKey="year" stroke="var(--text-secondary)" tick={{ fill: 'var(--text-secondary)', fontSize: 12 }} axisLine={false} tickLine={false} />
                  <YAxis width={50} stroke="var(--text-secondary)" tick={{ fill: 'var(--text-secondary)', fontSize: 12 }} axisLine={false} tickLine={false} domain={['dataMin - 1', 'dataMax + 1']} tickFormatter={(v) => `${Number(v).toFixed(1)}%`} />
                  <Tooltip contentStyle={{ backgroundColor: 'var(--bg-surface)', border: '1px solid var(--border-subtle)', borderRadius: '8px', color: 'var(--text-primary)' }} />
                  <Line type="monotone" name="Turnout %" dataKey="turnout" stroke="#D4AF37" strokeWidth={3} dot={{ fill: '#D4AF37', r: 6 }} activeDot={{ r: 8 }} />
                </LineChart>
              </ResponsiveContainer>
            )}
          </div>
        </PremiumCard>
      </div>

      <PremiumCard className="p-6 h-[350px] flex flex-col">
        <h2 className="text-lg font-serif font-bold text-[var(--text-primary)] mb-4">Gender-wise Turnout Comparison</h2>
        <div className="flex-1 w-full min-h-0">
          {loading ? (
               <div className="h-full flex items-center justify-center text-[var(--text-secondary)] text-sm gap-2">
                 Loading gender breakdown...
               </div>
          ) : (
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={data?.gender || []} layout="vertical" margin={{ top: 10, right: 30, left: 20, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border-subtle)" horizontal={false} />
                <XAxis type="number" stroke="var(--text-secondary)" tick={{ fill: 'var(--text-secondary)', fontSize: 12 }} axisLine={false} tickLine={false} domain={[0, 'auto']} tickFormatter={(v) => `${v}%`} />
                <YAxis type="category" dataKey="category" stroke="var(--text-secondary)" tick={{ fill: 'var(--text-secondary)', fontSize: 12 }} axisLine={false} tickLine={false} width={100} />
                <Tooltip contentStyle={{ backgroundColor: 'var(--bg-surface)', border: '1px solid var(--border-subtle)', borderRadius: '8px', color: 'var(--text-primary)' }} />
                <Legend iconType="circle" wrapperStyle={{ fontSize: '12px' }} />
                <Bar dataKey={String(prevYear)} name={`${prevYear} Turnout`} fill="#D4AF37" fillOpacity={0.4} radius={[0, 4, 4, 0]} barSize={20} />
                <Bar dataKey={String(selectedYear)} name={`${selectedYear} Turnout`} fill="#D4AF37" radius={[0, 4, 4, 0]} barSize={20} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>
      </PremiumCard>
    </div>
  );
}
