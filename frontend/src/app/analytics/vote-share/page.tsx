"use client";

import React from "react";
import { PageHeader } from "@/components/layout/page-header";
import { PremiumCard } from "@/components/ds/premium-card";
import { 
  BarChart, Bar, LineChart, Line, AreaChart, Area,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
  RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis, Radar
} from "recharts";
import { Download, Filter, Share2 } from "lucide-react";

// Mock Data
const regionalData = [
  { region: "Western UP", BJP: 43.2, SP: 38.1, BSP: 12.4, INC: 3.1, RLD: 2.1 },
  { region: "Purvanchal", BJP: 39.5, SP: 35.8, BSP: 14.2, INC: 5.5, RLD: 0.8 },
  { region: "Awadh", BJP: 41.8, SP: 33.2, BSP: 11.9, INC: 8.2, RLD: 0.5 },
  { region: "Bundelkhand", BJP: 46.5, SP: 28.4, BSP: 15.6, INC: 4.1, RLD: 0.2 },
  { region: "Rohilkhand", BJP: 40.1, SP: 41.5, BSP: 10.2, INC: 4.8, RLD: 1.1 },
];

const historicalTrendData = [
  { year: "2007", BJP: 16.9, SP: 25.4, BSP: 30.4, INC: 8.6 },
  { year: "2012", BJP: 15.0, SP: 29.1, BSP: 25.9, INC: 11.6 },
  { year: "2017", BJP: 39.7, SP: 21.8, BSP: 22.2, INC: 6.2 },
  { year: "2022", BJP: 41.3, SP: 32.1, BSP: 12.9, INC: 2.3 },
];

const demographicRadarData = [
  { subject: 'Youth (18-25)', BJP: 85, SP: 90, BSP: 45, fullMark: 100 },
  { subject: 'Women', BJP: 95, SP: 70, BSP: 60, fullMark: 100 },
  { subject: 'Urban', BJP: 98, SP: 65, BSP: 40, fullMark: 100 },
  { subject: 'Rural', BJP: 75, SP: 85, BSP: 70, fullMark: 100 },
  { subject: 'First-time', BJP: 80, SP: 88, BSP: 50, fullMark: 100 },
];

const COLORS = {
  BJP: "#F97316",
  SP: "#22C55E",
  BSP: "#1E3A8A",
  INC: "#3B82F6",
  RLD: "#EAB308",
};

export default function VoteShareAnalytics() {
  return (
    <div className="p-8 max-w-[1920px] mx-auto min-h-screen space-y-6">
      <PageHeader 
        title="Vote Share Analytics"
        description="Deep dive into vote share distributions, regional variations, and demographic shifts."
        breadcrumbs={[
          { label: "Home", href: "/" },
          { label: "Analytics Lab" },
          { label: "Vote Share" }
        ]}
        action={
          <>
            <button className="px-4 py-2 bg-[var(--bg-surface)] border border-[var(--border-subtle)] text-[var(--text-primary)] hover:bg-[var(--border-subtle)] rounded-lg text-sm font-medium transition-colors flex items-center gap-2">
              <Share2 className="w-4 h-4" /> Share
            </button>
            <button className="px-4 py-2 bg-[var(--accent-primary)] text-[var(--bg-app)] hover:bg-[var(--accent-primary-hover)] rounded-lg text-sm font-medium transition-colors flex items-center gap-2">
              <Download className="w-4 h-4" /> Export Report
            </button>
          </>
        }
      />

      {/* Filter Ribbon */}
      <div className="flex items-center gap-3 overflow-x-auto pb-2 scrollbar-hide">
        <select className="px-4 py-2 bg-[var(--bg-surface)] border border-[var(--border-subtle)] rounded-lg text-sm font-medium text-[var(--text-primary)] min-w-[200px]">
          <option>2022 Assembly Election</option>
          <option>2017 Assembly Election</option>
        </select>
        <select className="px-4 py-2 bg-[var(--bg-surface)] border border-[var(--border-subtle)] rounded-lg text-sm font-medium text-[var(--text-primary)] min-w-[160px]">
          <option>All Regions</option>
          <option>Western UP</option>
          <option>Purvanchal</option>
          <option>Awadh</option>
          <option>Bundelkhand</option>
        </select>
        
        <div className="flex-1" />
        
        <button className="px-4 py-2 bg-[var(--bg-surface)] border border-[var(--border-subtle)] rounded-lg text-sm font-medium text-[var(--text-primary)] hover:bg-[var(--border-subtle)] transition-colors flex items-center gap-2 whitespace-nowrap">
          <Filter className="w-4 h-4" /> More Filters
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Regional Breakdown Bar Chart */}
        <PremiumCard className="p-6 h-[450px] flex flex-col">
          <div className="flex justify-between items-center mb-6">
            <h2 className="text-lg font-serif font-bold text-[var(--text-primary)]">Regional Vote Share (2022)</h2>
          </div>
          <div className="flex-1 w-full min-h-0">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={regionalData} margin={{ top: 20, right: 30, left: -20, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border-subtle)" vertical={false} />
                <XAxis dataKey="region" stroke="var(--text-secondary)" tick={{fill: 'var(--text-secondary)', fontSize: 12}} axisLine={false} tickLine={false} />
                <YAxis stroke="var(--text-secondary)" tick={{fill: 'var(--text-secondary)', fontSize: 12}} axisLine={false} tickLine={false} tickFormatter={(val) => `${val}%`} />
                <Tooltip 
                  contentStyle={{ backgroundColor: 'var(--bg-surface)', border: '1px solid var(--border-subtle)', borderRadius: '8px', color: 'var(--text-primary)' }}
                  itemStyle={{ color: 'var(--text-primary)' }}
                  cursor={{fill: 'var(--bg-app)'}}
                />
                <Legend iconType="circle" wrapperStyle={{ fontSize: '12px', color: 'var(--text-secondary)' }} />
                <Bar dataKey="BJP" fill={COLORS.BJP} radius={[4, 4, 0, 0]} maxBarSize={40} />
                <Bar dataKey="SP" fill={COLORS.SP} radius={[4, 4, 0, 0]} maxBarSize={40} />
                <Bar dataKey="BSP" fill={COLORS.BSP} radius={[4, 4, 0, 0]} maxBarSize={40} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </PremiumCard>

        {/* Historical Trend Area Chart */}
        <PremiumCard className="p-6 h-[450px] flex flex-col">
          <div className="flex justify-between items-center mb-6">
            <h2 className="text-lg font-serif font-bold text-[var(--text-primary)]">Historical Vote Share Trend (2007-2022)</h2>
          </div>
          <div className="flex-1 w-full min-h-0">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={historicalTrendData} margin={{ top: 20, right: 30, left: -20, bottom: 5 }}>
                <defs>
                  {Object.entries(COLORS).map(([key, color]) => (
                    <linearGradient key={key} id={`color${key}`} x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor={color} stopOpacity={0.3}/>
                      <stop offset="95%" stopColor={color} stopOpacity={0}/>
                    </linearGradient>
                  ))}
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border-subtle)" vertical={false} />
                <XAxis dataKey="year" stroke="var(--text-secondary)" tick={{fill: 'var(--text-secondary)', fontSize: 12}} axisLine={false} tickLine={false} />
                <YAxis stroke="var(--text-secondary)" tick={{fill: 'var(--text-secondary)', fontSize: 12}} axisLine={false} tickLine={false} tickFormatter={(val) => `${val}%`} />
                <Tooltip 
                  contentStyle={{ backgroundColor: 'var(--bg-surface)', border: '1px solid var(--border-subtle)', borderRadius: '8px', color: 'var(--text-primary)' }}
                  itemStyle={{ color: 'var(--text-primary)' }}
                />
                <Legend iconType="circle" wrapperStyle={{ fontSize: '12px', color: 'var(--text-secondary)' }} />
                <Area type="monotone" dataKey="BJP" stroke={COLORS.BJP} fillOpacity={1} fill={`url(#colorBJP)`} strokeWidth={2} />
                <Area type="monotone" dataKey="SP" stroke={COLORS.SP} fillOpacity={1} fill={`url(#colorSP)`} strokeWidth={2} />
                <Area type="monotone" dataKey="BSP" stroke={COLORS.BSP} fillOpacity={1} fill={`url(#colorBSP)`} strokeWidth={2} />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </PremiumCard>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Demographic Radar */}
        <PremiumCard className="p-6 h-[400px] flex flex-col lg:col-span-1">
          <div className="flex justify-between items-center mb-2">
            <h2 className="text-lg font-serif font-bold text-[var(--text-primary)]">Demographic Alignment</h2>
          </div>
          <p className="text-xs text-[var(--text-secondary)] mb-4">Estimated appeal based on sample booth data.</p>
          <div className="flex-1 w-full min-h-0 relative -left-4">
            <ResponsiveContainer width="100%" height="100%">
              <RadarChart cx="50%" cy="50%" outerRadius="70%" data={demographicRadarData}>
                <PolarGrid stroke="var(--border-subtle)" />
                <PolarAngleAxis dataKey="subject" tick={{fill: 'var(--text-secondary)', fontSize: 11}} />
                <PolarRadiusAxis angle={30} domain={[0, 100]} tick={false} axisLine={false} />
                <Radar name="BJP" dataKey="BJP" stroke={COLORS.BJP} fill={COLORS.BJP} fillOpacity={0.3} />
                <Radar name="SP" dataKey="SP" stroke={COLORS.SP} fill={COLORS.SP} fillOpacity={0.3} />
                <Tooltip 
                  contentStyle={{ backgroundColor: 'var(--bg-surface)', border: '1px solid var(--border-subtle)', borderRadius: '8px', color: 'var(--text-primary)' }}
                />
                <Legend iconType="circle" wrapperStyle={{ fontSize: '11px' }} />
              </RadarChart>
            </ResponsiveContainer>
          </div>
        </PremiumCard>

        {/* Insights Panel */}
        <PremiumCard className="p-6 h-[400px] flex flex-col lg:col-span-2 bg-[var(--bg-surface)]">
          <h2 className="text-lg font-serif font-bold text-[var(--text-primary)] mb-6">Vote Share Intelligence Insights</h2>
          
          <div className="space-y-4 overflow-y-auto pr-2 custom-scrollbar">
            <div className="p-4 rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-app)]">
              <div className="flex items-center justify-between mb-2">
                <h4 className="font-semibold text-sm text-[var(--text-primary)]">Bipolar Contest Solidification</h4>
                <span className="text-xs font-medium px-2 py-1 bg-[var(--accent-primary)]/10 text-[var(--accent-primary)] rounded">Macro Trend</span>
              </div>
              <p className="text-sm text-[var(--text-secondary)] leading-relaxed">
                The 2022 election saw the highest ever combined vote share for the top two parties (BJP + SP = ~73.4%). The BSP's vote share collapsed to 12.9%, marking a structural shift toward a heavily bipolar electoral landscape in Uttar Pradesh.
              </p>
            </div>

            <div className="p-4 rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-app)]">
              <div className="flex items-center justify-between mb-2">
                <h4 className="font-semibold text-sm text-[var(--text-primary)]">SP's Purvanchal Surge</h4>
                <span className="text-xs font-medium px-2 py-1 bg-emerald-500/10 text-emerald-500 rounded">Regional Shift</span>
              </div>
              <p className="text-sm text-[var(--text-secondary)] leading-relaxed">
                Samajwadi Party achieved a +14% vote share swing in the Purvanchal region compared to 2017, heavily driven by strategic alliances with regional parties like SBSP. However, BJP's baseline remained high enough to limit seat losses.
              </p>
            </div>

            <div className="p-4 rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-app)]">
              <div className="flex items-center justify-between mb-2">
                <h4 className="font-semibold text-sm text-[var(--text-primary)]">Urban vs Rural Divide</h4>
                <span className="text-xs font-medium px-2 py-1 bg-blue-500/10 text-blue-500 rounded">Demographic Split</span>
              </div>
              <p className="text-sm text-[var(--text-secondary)] leading-relaxed">
                BJP maintained overwhelming dominance in urban centers (&gt;55% vote share in municipal corporation limits), while SP significantly closed the gap in rural constituencies, leading to much tighter margins in agricultural belts.
              </p>
            </div>
          </div>
        </PremiumCard>
      </div>

    </div>
  );
}
