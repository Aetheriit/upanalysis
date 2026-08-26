"use client";

import React from "react";
import { PageHeader } from "@/components/layout/page-header";
import { PremiumCard } from "@/components/ds/premium-card";
import { Brain, LineChart, Target, AlertTriangle, TrendingUp, ShieldCheck } from "lucide-react";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from "recharts";

const forecastData = [
  { party: "BJP", predicted: 240, low: 220, high: 265 },
  { party: "SP", predicted: 120, low: 100, high: 145 },
  { party: "BSP", predicted: 8, low: 2, high: 15 },
  { party: "INC", predicted: 5, low: 1, high: 10 },
  { party: "RLD", predicted: 12, low: 5, high: 18 },
  { party: "Others", predicted: 18, low: 10, high: 28 },
];

const modelMetrics = [
  { name: "Overall Accuracy", value: "89.2%", icon: Target, color: "text-emerald-500" },
  { name: "Constituency Precision", value: "84.7%", icon: ShieldCheck, color: "text-blue-500" },
  { name: "Confidence Interval", value: "±12 seats", icon: TrendingUp, color: "text-amber-500" },
  { name: "Data Freshness", value: "2 days", icon: AlertTriangle, color: "text-rose-500" },
];

export default function ForecastingPage() {
  return (
    <div className="p-8 max-w-[1920px] mx-auto min-h-screen space-y-6">
      <PageHeader
        title="Forecasting Engine"
        description="Predictive models for upcoming elections using historical patterns, demographic shifts, and polling data."
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

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Forecast Chart */}
        <PremiumCard className="p-6 lg:col-span-8 h-[450px] flex flex-col">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-serif font-bold text-[var(--text-primary)] flex items-center gap-2">
              <Brain className="w-5 h-5 text-[var(--accent-primary)]" /> Seat Forecast — Next Election Simulation
            </h2>
            <span className="text-xs text-[var(--text-tertiary)]">Based on 2017-2022 patterns</span>
          </div>
          <div className="flex-1 w-full min-h-0">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={forecastData} margin={{ top: 20, right: 30, left: -20, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border-subtle)" vertical={false} />
                <XAxis dataKey="party" stroke="var(--text-secondary)" tick={{ fill: 'var(--text-secondary)', fontSize: 12 }} axisLine={false} tickLine={false} />
                <YAxis stroke="var(--text-secondary)" tick={{ fill: 'var(--text-secondary)', fontSize: 12 }} axisLine={false} tickLine={false} />
                <Tooltip contentStyle={{ backgroundColor: 'var(--bg-surface)', border: '1px solid var(--border-subtle)', borderRadius: '8px', color: 'var(--text-primary)' }} />
                <Legend iconType="circle" wrapperStyle={{ fontSize: '12px' }} />
                <Bar dataKey="low" name="Low Estimate" fill="#D4AF37" fillOpacity={0.2} radius={[4, 4, 0, 0]} />
                <Bar dataKey="predicted" name="Predicted" fill="#D4AF37" radius={[4, 4, 0, 0]} />
                <Bar dataKey="high" name="High Estimate" fill="#D4AF37" fillOpacity={0.5} radius={[4, 4, 0, 0]} />
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
                { label: "Training Data", value: "2002-2022 (5 cycles)" },
                { label: "Features", value: "Vote share, Turnout, Caste, Urban/Rural" },
                { label: "Algorithm", value: "Gradient Boosting + Monte Carlo" },
                { label: "Simulations", value: "10,000 iterations" },
                { label: "Last Run", value: "2 hours ago" },
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
              {[
                "BJP likely to retain majority (220-265 seats)",
                "SP projected to maintain 2022 gains",
                "BSP may recover marginally (5-15 seats)",
                "Alliance dynamics critical in 88 seats",
                "Turnout expected to increase by 2-3%",
              ].map((pred, idx) => (
                <div key={idx} className="flex items-start gap-2 text-sm text-[var(--text-secondary)]">
                  <Brain className="w-4 h-4 text-[var(--accent-primary)] flex-shrink-0 mt-0.5" />
                  {pred}
                </div>
              ))}
            </div>
          </PremiumCard>
        </div>
      </div>
    </div>
  );
}
