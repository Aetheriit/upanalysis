"use client";

import React, { useEffect, useState } from "react";
import { PageHeader } from "@/components/layout/page-header";
import { PremiumCard } from "@/components/ds/premium-card";
import { Brain, Target, AlertTriangle, TrendingUp, ShieldCheck, Loader2 } from "lucide-react";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend, Cell } from "recharts";
import { getPartyColor } from "@/lib/party-colors";
import { apiUrl } from "@/lib/api";

export default function ForecastingPage() {
  const [data, setData] = useState<any>(null);
  const [backtest, setBacktest] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function fetchData() {
      try {
        setLoading(true);
        const [forecastRes, backtestRes] = await Promise.all([
          fetch(apiUrl("/api/v1/analytics/forecast/predict")),
          fetch(apiUrl("/api/v1/analytics/forecast/backtest")),
        ]);
        if (!forecastRes.ok) throw new Error("Failed to run forecast simulation");
        if (!backtestRes.ok) throw new Error("Failed to validate forecast model");
        setData(await forecastRes.json());
        setBacktest(await backtestRes.json());
      } catch (err: any) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    }
    fetchData();
  }, []);

  const bjpPrediction = data?.forecast?.find((f: any) => f.party === "BJP");
  const spPrediction = data?.forecast?.find((f: any) => f.party === "SP");
  const bspPrediction = data?.forecast?.find((f: any) => f.party === "BSP");
  const validation = backtest?.validation;
  const intervalValues = validation?.seat_count_intervals
    ? Object.values(validation.seat_count_intervals) as Array<{ covered: boolean }>
    : [];
  const intervalCoverage = intervalValues.length
    ? `${Math.round(intervalValues.filter(v => v.covered).length / intervalValues.length * 100)}%`
    : "—";
  const modelMetrics = [
    { name: "Holdout Accuracy", value: validation ? `${validation.winner_accuracy}%` : "—", icon: Target, color: "text-emerald-500" },
    { name: "Constituency Precision", value: validation ? `${validation.constituency_precision}%` : "—", icon: ShieldCheck, color: "text-blue-500" },
    { name: "Interval Coverage", value: intervalCoverage, icon: TrendingUp, color: "text-amber-500" },
    { name: "Validation", value: validation ? `${validation.train_year} → ${validation.test_year}` : "—", icon: AlertTriangle, color: "text-rose-500" },
  ];

  return (
    <div className="p-8 max-w-[1920px] mx-auto min-h-screen space-y-6">
      <PageHeader
        title="Forecasting Engine"
        description="Predictive Monte Carlo models for upcoming elections using historical baseline volatility."
        breadcrumbs={[{ label: "Home", href: "/" }, { label: "AI & Forecasting" }, { label: "Forecasting" }]}
      />

      {/* Model Metrics */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {modelMetrics.map(m => (
          <PremiumCard key={m.name} padding="sm" className="text-center">
            <m.icon className={`w-5 h-5 ${m.color} mx-auto mb-2`} />
            <div className="text-2xl font-bold text-[var(--text-primary)]">{m.value}</div>
            <div className="text-xs text-[var(--text-secondary)]">{m.name}</div>
          </PremiumCard>
        ))}
      </div>

      {loading ? (
        <div className="h-64 flex items-center justify-center text-[var(--text-secondary)]">
          <Loader2 className="animate-spin w-8 h-8 text-[var(--accent-primary)]" />
        </div>
      ) : error ? (
        <div className="h-64 flex items-center justify-center text-red-500 gap-2">
          <AlertTriangle className="w-5 h-5" />
          <span>{error}</span>
        </div>
      ) : data && data.forecast ? (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* Forecast Chart */}
          <PremiumCard className="p-6 lg:col-span-8 h-[450px] flex flex-col">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-serif font-bold text-[var(--text-primary)] flex items-center gap-2">
                <Brain className="w-5 h-5 text-[var(--accent-primary)]" /> Seat Forecast — Next Election Simulation
              </h2>
              <span className="text-xs text-[var(--text-tertiary)]">Based on {data.base_year} baseline · validated {validation ? `${validation.train_year} → ${validation.test_year}` : "—"}</span>
            </div>
            <div className="flex-1 w-full min-h-0">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={data.forecast} margin={{ top: 20, right: 30, left: -20, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--border-subtle)" vertical={false} />
                  <XAxis dataKey="party" stroke="var(--text-secondary)" tick={{ fill: 'var(--text-secondary)', fontSize: 12 }} axisLine={false} tickLine={false} />
                  <YAxis stroke="var(--text-secondary)" tick={{ fill: 'var(--text-secondary)', fontSize: 12 }} axisLine={false} tickLine={false} />
                  <Tooltip contentStyle={{ backgroundColor: 'var(--bg-surface)', border: '1px solid var(--border-subtle)', borderRadius: '8px', color: 'var(--text-primary)' }} />
                  <Legend iconType="circle" wrapperStyle={{ fontSize: '12px' }} />
                  <Bar dataKey="low" name="Low Estimate" fillOpacity={0.2} radius={[4, 4, 0, 0]}>
                    {data.forecast.map((entry: any) => <Cell key={`low-${entry.party}`} fill={getPartyColor(entry.party)} />)}
                  </Bar>
                  <Bar dataKey="predicted" name="Predicted" radius={[4, 4, 0, 0]}>
                    {data.forecast.map((entry: any) => <Cell key={`predicted-${entry.party}`} fill={getPartyColor(entry.party)} />)}
                  </Bar>
                  <Bar dataKey="high" name="High Estimate" fillOpacity={0.5} radius={[4, 4, 0, 0]}>
                    {data.forecast.map((entry: any) => <Cell key={`high-${entry.party}`} fill={getPartyColor(entry.party)} />)}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </PremiumCard>

          {/* Model Details */}
          <div className="lg:col-span-4 flex flex-col gap-6">
            <PremiumCard className="p-6">
              <h3 className="text-sm font-bold text-[var(--text-primary)] uppercase tracking-wider mb-4">Model Parameters</h3>
              <div className="space-y-3">
                {[
                  { label: "Baseline Year", value: data.base_year },
                  { label: "Features", value: "Historical Momentum (2017->2022)" },
                  { label: "Algorithm", value: "Monte Carlo Normal Distribution" },
                  { label: "Simulations", value: `${data.iterations.toLocaleString()} iterations` },
                  { label: "Execution Time", value: "Real-time" },
                  { label: "Backtest", value: validation ? `${validation.matched_constituencies} constituencies (${validation.test_year} held out)` : "Unavailable" },
                ].map(p => (
                  <div key={p.label} className="flex justify-between items-center">
                    <span className="text-xs text-[var(--text-secondary)]">{p.label}</span>
                    <span className="text-xs font-medium text-[var(--text-primary)]">{p.value}</span>
                  </div>
                ))}
              </div>
            </PremiumCard>

            <PremiumCard className="p-6">
              <h3 className="text-sm font-bold text-[var(--text-primary)] uppercase tracking-wider mb-4">Key Predictions</h3>
              <div className="space-y-3">
                <div className="flex items-start gap-2 text-sm text-[var(--text-secondary)]">
                  <Brain className="w-4 h-4 text-[var(--accent-primary)] flex-shrink-0 mt-0.5" />
                  BJP {bjpPrediction?.predicted > 202 ? "likely to retain majority" : "might lose majority"} ({bjpPrediction?.low}-{bjpPrediction?.high} seats)
                </div>
                <div className="flex items-start gap-2 text-sm text-[var(--text-secondary)]">
                  <Brain className="w-4 h-4 text-[var(--accent-primary)] flex-shrink-0 mt-0.5" />
                  SP+ projected at {spPrediction?.predicted} seats ({spPrediction?.low}-{spPrediction?.high})
                </div>
                <div className="flex items-start gap-2 text-sm text-[var(--text-secondary)]">
                  <Brain className="w-4 h-4 text-[var(--accent-primary)] flex-shrink-0 mt-0.5" />
                  BSP modeled decay limits to {bspPrediction?.predicted} seats
                </div>
                <div className="flex items-start gap-2 text-sm text-[var(--text-secondary)]">
                  <Brain className="w-4 h-4 text-[var(--accent-primary)] flex-shrink-0 mt-0.5" />
                  Alliance dynamics critical for marginal seats
                </div>
              </div>
            </PremiumCard>
          </div>
        </div>
      ) : null}
    </div>
  );
}
