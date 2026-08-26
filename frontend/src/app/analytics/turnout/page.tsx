"use client";

import React from "react";
import { PageHeader } from "@/components/layout/page-header";
import { PremiumCard } from "@/components/ds/premium-card";
import { Download, Users, TrendingUp, ArrowDown, ArrowUp } from "lucide-react";
import { BarChart, Bar, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from "recharts";

const regionTurnout = [
  { region: "Western UP", "2017": 65.2, "2022": 67.1 },
  { region: "Purvanchal", "2017": 55.8, "2022": 58.4 },
  { region: "Awadh", "2017": 58.1, "2022": 60.3 },
  { region: "Bundelkhand", "2017": 62.4, "2022": 63.8 },
  { region: "Rohilkhand", "2017": 64.7, "2022": 66.2 },
];

const genderTurnout = [
  { category: "Male", "2017": 62.4, "2022": 63.8 },
  { category: "Female", "2017": 57.3, "2022": 59.1 },
  { category: "Third Gender", "2017": 34.2, "2022": 38.7 },
];

const historicalTurnout = [
  { year: "2002", turnout: 48.5 },
  { year: "2007", turnout: 46.1 },
  { year: "2012", turnout: 59.4 },
  { year: "2017", turnout: 60.1 },
  { year: "2022", turnout: 61.6 },
];

export default function TurnoutPage() {
  return (
    <div className="p-8 max-w-[1920px] mx-auto min-h-screen space-y-6">
      <PageHeader
        title="Turnout Analytics"
        description="Voter participation analysis by region, gender, urban/rural, and historical trends."
        breadcrumbs={[{ label: "Home", href: "/" }, { label: "Analytics Lab" }, { label: "Turnout Analysis" }]}
        action={<button className="px-4 py-2 bg-[var(--accent-primary)] text-[var(--bg-app)] hover:bg-[var(--accent-primary-hover)] rounded-lg text-sm font-medium transition-colors flex items-center gap-2"><Download className="w-4 h-4" /> Export Report</button>}
      />

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <PremiumCard padding="sm" className="text-center">
          <Users className="w-5 h-5 text-[var(--accent-primary)] mx-auto mb-2" />
          <div className="text-2xl font-bold text-[var(--text-primary)]">61.65%</div>
          <div className="text-xs text-[var(--text-secondary)]">Overall Turnout 2022</div>
        </PremiumCard>
        <PremiumCard padding="sm" className="text-center">
          <ArrowUp className="w-5 h-5 text-emerald-500 mx-auto mb-2" />
          <div className="text-2xl font-bold text-emerald-500">+1.58%</div>
          <div className="text-xs text-[var(--text-secondary)]">Change from 2017</div>
        </PremiumCard>
        <PremiumCard padding="sm" className="text-center">
          <TrendingUp className="w-5 h-5 text-blue-500 mx-auto mb-2" />
          <div className="text-2xl font-bold text-[var(--text-primary)]">78.4%</div>
          <div className="text-xs text-[var(--text-secondary)]">Highest (Kairana)</div>
        </PremiumCard>
        <PremiumCard padding="sm" className="text-center">
          <ArrowDown className="w-5 h-5 text-rose-500 mx-auto mb-2" />
          <div className="text-2xl font-bold text-[var(--text-primary)]">42.1%</div>
          <div className="text-xs text-[var(--text-secondary)]">Lowest (Lucknow Cantt)</div>
        </PremiumCard>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <PremiumCard className="p-6 h-[400px] flex flex-col">
          <h2 className="text-lg font-serif font-bold text-[var(--text-primary)] mb-4">Regional Turnout (2017 vs 2022)</h2>
          <div className="flex-1 w-full min-h-0">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={regionTurnout} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border-subtle)" vertical={false} />
                <XAxis dataKey="region" stroke="var(--text-secondary)" tick={{ fill: 'var(--text-secondary)', fontSize: 11 }} axisLine={false} tickLine={false} />
                <YAxis stroke="var(--text-secondary)" tick={{ fill: 'var(--text-secondary)', fontSize: 12 }} axisLine={false} tickLine={false} domain={[50, 70]} tickFormatter={(v) => `${v}%`} />
                <Tooltip contentStyle={{ backgroundColor: 'var(--bg-surface)', border: '1px solid var(--border-subtle)', borderRadius: '8px', color: 'var(--text-primary)' }} />
                <Legend iconType="circle" wrapperStyle={{ fontSize: '12px' }} />
                <Bar dataKey="2017" fill="#D4AF37" fillOpacity={0.4} radius={[4, 4, 0, 0]} />
                <Bar dataKey="2022" fill="#D4AF37" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </PremiumCard>

        <PremiumCard className="p-6 h-[400px] flex flex-col">
          <h2 className="text-lg font-serif font-bold text-[var(--text-primary)] mb-4">Historical Turnout Trend</h2>
          <div className="flex-1 w-full min-h-0">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={historicalTurnout} margin={{ top: 10, right: 30, left: -20, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border-subtle)" vertical={false} />
                <XAxis dataKey="year" stroke="var(--text-secondary)" tick={{ fill: 'var(--text-secondary)', fontSize: 12 }} axisLine={false} tickLine={false} />
                <YAxis stroke="var(--text-secondary)" tick={{ fill: 'var(--text-secondary)', fontSize: 12 }} axisLine={false} tickLine={false} domain={[40, 70]} tickFormatter={(v) => `${v}%`} />
                <Tooltip contentStyle={{ backgroundColor: 'var(--bg-surface)', border: '1px solid var(--border-subtle)', borderRadius: '8px', color: 'var(--text-primary)' }} />
                <Line type="monotone" dataKey="turnout" stroke="#D4AF37" strokeWidth={3} dot={{ fill: '#D4AF37', r: 6 }} activeDot={{ r: 8 }} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </PremiumCard>
      </div>

      <PremiumCard className="p-6 h-[350px] flex flex-col">
        <h2 className="text-lg font-serif font-bold text-[var(--text-primary)] mb-4">Gender-wise Turnout Comparison</h2>
        <div className="flex-1 w-full min-h-0">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={genderTurnout} layout="vertical" margin={{ top: 10, right: 30, left: 20, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--border-subtle)" horizontal={false} />
              <XAxis type="number" stroke="var(--text-secondary)" tick={{ fill: 'var(--text-secondary)', fontSize: 12 }} axisLine={false} tickLine={false} domain={[0, 70]} tickFormatter={(v) => `${v}%`} />
              <YAxis type="category" dataKey="category" stroke="var(--text-secondary)" tick={{ fill: 'var(--text-secondary)', fontSize: 12 }} axisLine={false} tickLine={false} width={100} />
              <Tooltip contentStyle={{ backgroundColor: 'var(--bg-surface)', border: '1px solid var(--border-subtle)', borderRadius: '8px', color: 'var(--text-primary)' }} />
              <Legend iconType="circle" wrapperStyle={{ fontSize: '12px' }} />
              <Bar dataKey="2017" fill="#D4AF37" fillOpacity={0.4} radius={[0, 4, 4, 0]} barSize={20} />
              <Bar dataKey="2022" fill="#D4AF37" radius={[0, 4, 4, 0]} barSize={20} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </PremiumCard>
    </div>
  );
}
