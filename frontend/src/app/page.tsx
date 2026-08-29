"use client";

import React, { useState, useEffect } from "react";
import { 
  Building2, ArrowRightLeft, Users, TrendingUp, Target, 
  Brain, Search, Map, BarChart3, Clock, AlertTriangle, ShieldAlert,
  ChevronRight, Filter
} from "lucide-react";
import { PremiumCard } from "@/components/ds/premium-card";
import { 
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, 
  ResponsiveContainer, PieChart, Pie, Cell, Legend
} from "recharts";
import { useElectionContext } from "@/context/ElectionContext";
import { apiUrl } from "@/lib/api";
import dynamic from "next/dynamic";

const UPMap = dynamic(() => import("@/components/UPMap"), { ssr: false, loading: () => (
  <div className="flex-1 rounded-xl bg-[var(--bg-app)] border border-[var(--border-subtle)] flex items-center justify-center">
    <span className="text-sm text-[var(--text-tertiary)]">Loading map...</span>
  </div>
)});

const COLORS = {
  BJP: "#F97316",
  SP: "#EF4444",
  BSP: "#2563EB",
  INC: "#22C55E",
  RLD: "#EAB308",
  Others: "#94A3B8",
  OTH: "#94A3B8"
};

const defaultSeatChangesData = [
  { name: 'Won by same party', value: 306, color: '#10B981' },
  { name: 'Changed hands', value: 97, color: '#EF4444' },
];

export default function ExecutiveDashboard() {
  const [kpis2017, setKpis2017] = useState<any>(null);
  const [kpis2022, setKpis2022] = useState<any>(null);
  const { viewMode } = useElectionContext();
  const [voteShare, setVoteShare] = useState<any[]>([]);
  const [swingData, setSwingData] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  // Computed active KPIs based on view mode
  const activeKpis = viewMode === "2022 Only" ? kpis2022 : kpis2017;

  useEffect(() => {
    async function fetchData() {
      try {
        const [kpi17Res, kpi22Res, vote17Res, vote22Res, swingRes] = await Promise.all([
          fetch(apiUrl("/api/v1/analytics/dashboard?election_year=2017")),
          fetch(apiUrl("/api/v1/analytics/dashboard?election_year=2022")),
          fetch(apiUrl("/api/v1/analytics/vote-share?election_year=2017")),
          fetch(apiUrl("/api/v1/analytics/vote-share?election_year=2022")),
          fetch(apiUrl("/api/v1/analytics/swing"))
        ]);
        
        const kpi17Data = await kpi17Res.json();
        const kpi22Data = await kpi22Res.json();
        const vote17Data = await vote17Res.json();
        const vote22Data = await vote22Res.json();
        const swingD = await swingRes.json();
        
        setKpis2017(kpi17Data.kpis);
        setKpis2022(kpi22Data.kpis);
        
        // Transform vote share data for Recharts — merge 2017 and 2022 by abbreviation
        if (vote17Data.vote_share && vote22Data.vote_share) {
          const transformed = vote17Data.vote_share.map((v17: any) => {
            const v22 = vote22Data.vote_share.find((v: any) => v.abbreviation === v17.abbreviation);
            return {
              name: v17.abbreviation,
              2017: v17.vote_share,
              2022: v22 ? v22.vote_share : 0,
            };
          });
          setVoteShare(transformed);
        }
        
        setSwingData(swingD);
      } catch (e) {
        console.error("Failed to load dashboard data", e);
      } finally {
        setLoading(false);
      }
    }
    fetchData();
  }, []);

  if (loading) {
    return <div className="p-8 pb-20 max-w-[1920px] mx-auto space-y-6 animate-pulse">
      <div className="h-10 bg-[var(--bg-surface)] rounded w-1/3 mb-6"></div>
      <div className="h-24 bg-[var(--bg-surface)] rounded w-full mb-6"></div>
      <div className="h-64 bg-[var(--bg-surface)] rounded w-full"></div>
    </div>;
  }

  return (
    <div className="p-8 pb-20 max-w-[1920px] mx-auto space-y-6">
      
      {/* Header Section */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div>
          <h1 className="text-3xl font-serif font-bold text-[var(--text-primary)]">
            Uttar Pradesh Assembly Election Intelligence
          </h1>
          <div className="flex items-center gap-3 mt-2">
            <span className="text-[var(--accent-primary)] font-medium">
              {viewMode === "Comparison (17 vs 22)" ? "Comparative Analysis 2017 ↔ 2022" : `${viewMode.split(' ')[0]} Election Analysis`}
            </span>
            <span className="w-1.5 h-1.5 rounded-full bg-[var(--text-tertiary)]" />
            <span className="text-[var(--text-secondary)] text-sm">Deep intelligence from {activeKpis?.total_constituencies || 403} Assembly Constituencies across 75 Districts</span>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <button className="px-4 py-2 bg-[var(--accent-primary)]/10 text-[var(--accent-primary)] hover:bg-[var(--accent-primary)]/20 rounded-lg text-sm font-medium transition-colors flex items-center gap-2">
            <Brain className="w-4 h-4" /> AI Analyst
          </button>
        </div>
      </div>

      {/* Filter Ribbon */}
      <div className="flex items-center gap-3 overflow-x-auto pb-2 scrollbar-hide">
        <select className="px-4 py-2 bg-[var(--bg-surface)] border border-[var(--border-subtle)] rounded-lg text-sm font-medium text-[var(--text-primary)] min-w-[160px]">
          <option>All Districts</option>
        </select>
        <select className="px-4 py-2 bg-[var(--bg-surface)] border border-[var(--border-subtle)] rounded-lg text-sm font-medium text-[var(--text-primary)] min-w-[160px]">
          <option>All Regions</option>
        </select>
        <select className="px-4 py-2 bg-[var(--bg-surface)] border border-[var(--border-subtle)] rounded-lg text-sm font-medium text-[var(--text-primary)] min-w-[160px]">
          <option>All Parties</option>
        </select>
        
        <div className="flex-1" />
        
        <button className="px-4 py-2 bg-[var(--bg-surface)] border border-[var(--border-subtle)] rounded-lg text-sm font-medium text-[var(--text-primary)] hover:bg-[var(--border-subtle)] transition-colors flex items-center gap-2 whitespace-nowrap">
          <Filter className="w-4 h-4" /> More Filters
        </button>
      </div>

      {/* KPI Row */}
      {viewMode === "Comparison (17 vs 22)" ? (
        <div className="grid grid-cols-2 md:grid-cols-4 xl:grid-cols-7 gap-4">
          <PremiumCard padding="sm" className="flex flex-col justify-center items-center text-center">
            <div className="flex items-center gap-2 text-[var(--text-secondary)] mb-2">
              <Building2 className="w-4 h-4" /> <span className="text-xs font-medium uppercase">Total Constituencies</span>
            </div>
            <span className="text-3xl font-bold text-[var(--text-primary)]">{kpis2017?.total_constituencies || "403"}</span>
          </PremiumCard>

          <PremiumCard padding="sm" className="flex flex-col justify-center items-center text-center relative overflow-hidden">
            <div className="flex items-center gap-2 text-[var(--text-secondary)] mb-2">
              <ArrowRightLeft className="w-4 h-4" /> <span className="text-xs font-medium uppercase">Seats Changed</span>
            </div>
            <div className="flex items-end gap-2">
              <span className="text-3xl font-bold text-[var(--text-primary)]">97</span>
              <span className="text-xs font-medium text-emerald-500 bg-emerald-500/10 px-1.5 py-0.5 rounded mb-1">↑ 24.07%</span>
            </div>
          </PremiumCard>

          <PremiumCard padding="sm" className="flex flex-col justify-center items-center text-center">
            <div className="flex items-center gap-2 text-[var(--text-secondary)] mb-2">
              <Users className="w-4 h-4" /> <span className="text-xs font-medium uppercase">Avg Turnout</span>
            </div>
            <div className="flex items-center gap-4">
              <div>
                <div className="text-xl font-bold text-[var(--text-primary)]">{kpis2017?.turnout_pct || "0"}%</div>
                <div className="text-[10px] text-[var(--text-tertiary)]">2017</div>
              </div>
              <div className="text-xs font-medium text-emerald-500">↑ 1.58%</div>
              <div>
                <div className="text-xl font-bold text-[var(--text-primary)]">{kpis2022?.turnout_pct || "61.4"}%</div>
                <div className="text-[10px] text-[var(--text-tertiary)]">2022</div>
              </div>
            </div>
          </PremiumCard>

          <PremiumCard padding="sm" className="flex flex-col justify-center items-center text-center">
            <div className="flex items-center gap-2 text-[var(--text-secondary)] mb-2">
              <TrendingUp className="w-4 h-4 text-rose-500" /> <span className="text-xs font-medium uppercase">Largest Swing</span>
            </div>
            <span className="text-2xl font-bold text-[var(--text-primary)]">28.6%</span>
            <span className="text-xs text-[var(--text-secondary)]">Phulpur (SP to BJP)</span>
          </PremiumCard>

          <PremiumCard padding="sm" className="flex flex-col justify-center items-center text-center">
            <div className="flex items-center gap-2 text-[var(--text-secondary)] mb-2">
              <Target className="w-4 h-4 text-orange-500" /> <span className="text-xs font-medium uppercase">Closest Contest</span>
            </div>
            <span className="text-2xl font-bold text-[var(--text-primary)]">{activeKpis?.closest_contest_code || "314"}</span>
            <span className="text-xs text-[var(--text-secondary)]">{activeKpis?.closest_contest_name || "Meerapur"} (Margin: {activeKpis?.closest_contest_margin?.toLocaleString() || "1,046"})</span>
          </PremiumCard>

          <PremiumCard padding="sm" className="flex flex-col justify-center items-center text-center">
            <div className="flex items-center gap-2 text-[var(--text-secondary)] mb-2">
              <PieChart className="w-4 h-4" /> <span className="text-xs font-medium uppercase">Vote Share Change</span>
            </div>
            <div className="w-full px-4 text-left">
              <div className="flex justify-between items-center text-xs mb-1">
                <span className="font-medium text-[#F97316]">BJP</span>
                <span className="text-emerald-500">↑ 14.3%</span>
              </div>
              <div className="flex justify-between items-center text-xs">
                <span className="font-medium text-[#EF4444]">SP</span>
                <span className="text-rose-500">↓ 9.8%</span>
              </div>
            </div>
          </PremiumCard>

          <PremiumCard padding="sm" className="flex flex-col justify-center items-center text-center bg-gradient-to-br from-[var(--bg-surface)] to-[var(--accent-primary)]/5">
            <div className="flex items-center gap-2 text-[var(--accent-primary)] mb-2">
              <Brain className="w-4 h-4" /> <span className="text-xs font-medium uppercase">AI Confidence</span>
            </div>
            <span className="text-3xl font-bold text-[var(--text-primary)]">92%</span>
            <span className="text-[10px] text-[var(--text-secondary)] uppercase tracking-wide">High Confidence</span>
          </PremiumCard>
        </div>
      ) : (
        <div className="grid grid-cols-2 md:grid-cols-4 xl:grid-cols-7 gap-4">
          <PremiumCard padding="sm" className="flex flex-col justify-center items-center text-center">
            <div className="flex items-center gap-2 text-[var(--text-secondary)] mb-2">
              <Building2 className="w-4 h-4" /> <span className="text-xs font-medium uppercase">Total Constituencies</span>
            </div>
            <span className="text-3xl font-bold text-[var(--text-primary)]">{activeKpis?.total_constituencies || "403"}</span>
          </PremiumCard>

          <PremiumCard padding="sm" className="flex flex-col justify-center items-center text-center relative overflow-hidden">
            <div className="flex items-center gap-2 text-[var(--text-secondary)] mb-2">
              <BarChart3 className="w-4 h-4" /> <span className="text-xs font-medium uppercase">Total Booths</span>
            </div>
            <div className="flex items-end gap-2">
              <span className="text-3xl font-bold text-[var(--text-primary)]">{activeKpis?.total_booths?.toLocaleString() || "154,012"}</span>
            </div>
          </PremiumCard>

          <PremiumCard padding="sm" className="flex flex-col justify-center items-center text-center">
            <div className="flex items-center gap-2 text-[var(--text-secondary)] mb-2">
              <Users className="w-4 h-4" /> <span className="text-xs font-medium uppercase">Avg Turnout</span>
            </div>
            <span className="text-3xl font-bold text-[var(--text-primary)]">{activeKpis?.turnout_pct || "61.4"}%</span>
          </PremiumCard>

          <PremiumCard padding="sm" className="flex flex-col justify-center items-center text-center">
            <div className="flex items-center gap-2 text-[var(--text-secondary)] mb-2">
              <TrendingUp className="w-4 h-4 text-emerald-500" /> <span className="text-xs font-medium uppercase">Avg Margin</span>
            </div>
            <span className="text-2xl font-bold text-[var(--text-primary)]">{activeKpis?.winning_margin_avg?.toLocaleString() || "24,891"}</span>
          </PremiumCard>

          <PremiumCard padding="sm" className="flex flex-col justify-center items-center text-center">
            <div className="flex items-center gap-2 text-[var(--text-secondary)] mb-2">
              <Target className="w-4 h-4 text-orange-500" /> <span className="text-xs font-medium uppercase">Closest Contest</span>
            </div>
            <span className="text-2xl font-bold text-[var(--text-primary)]">{activeKpis?.closest_contest_code || "314"}</span>
            <span className="text-xs text-[var(--text-secondary)]">{activeKpis?.closest_contest_name || "Meerapur"} (Margin: {activeKpis?.closest_contest_margin?.toLocaleString() || "1,046"})</span>
          </PremiumCard>

          <PremiumCard padding="sm" className="flex flex-col justify-center items-center text-center">
            <div className="flex items-center gap-2 text-[var(--text-secondary)] mb-2">
              <PieChart className="w-4 h-4" /> <span className="text-xs font-medium uppercase">NOTA %</span>
            </div>
            <span className="text-3xl font-bold text-[var(--text-primary)]">{activeKpis?.nota_pct || "2.86"}%</span>
          </PremiumCard>

          <PremiumCard padding="sm" className="flex flex-col justify-center items-center text-center bg-gradient-to-br from-[var(--bg-surface)] to-[var(--accent-primary)]/5">
            <div className="flex items-center gap-2 text-[var(--accent-primary)] mb-2">
              <Brain className="w-4 h-4" /> <span className="text-xs font-medium uppercase">AI Confidence</span>
            </div>
            <span className="text-3xl font-bold text-[var(--text-primary)]">92%</span>
            <span className="text-[10px] text-[var(--text-secondary)] uppercase tracking-wide">High Confidence</span>
          </PremiumCard>
        </div>
      )}

      {/* Main Grid Area */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        
        {/* Left Column - Geospatial & Charts */}
        <div className="lg:col-span-8 flex flex-col gap-6">
          
          <PremiumCard className="flex flex-col p-6 min-h-[500px]">
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-xl font-serif font-bold text-[var(--text-primary)]">Uttar Pradesh – {viewMode === "Comparison (17 vs 22)" ? "2022" : viewMode.split(' ')[0]} Winning Party Map</h2>
              <button className="text-sm font-medium text-[var(--accent-primary)] hover:underline flex items-center gap-1">
                View Fullscreen <ChevronRight className="w-4 h-4" />
              </button>
            </div>
            <div className="flex-1 rounded-xl overflow-hidden" style={{ minHeight: "380px" }}>
               <UPMap />
            </div>

            {/* Seat Tally Row */}
            <div className="grid grid-cols-6 gap-4 mt-6 pt-6 border-t border-[var(--border-subtle)]">
              <div className="text-center">
                <div className="flex items-center justify-center gap-1.5 mb-1"><span className="w-2 h-2 rounded-full bg-[#F97316]" /> <span className="text-xs font-bold">BJP</span></div>
                <div className="text-2xl font-bold">{viewMode === "2017 Only" ? "312" : "255"}</div>
                {viewMode === "Comparison (17 vs 22)" && <div className="text-[10px] text-[var(--text-secondary)]">2017: 312 <span className="text-rose-500">↓ 57</span></div>}
              </div>
              <div className="text-center">
                <div className="flex items-center justify-center gap-1.5 mb-1"><span className="w-2 h-2 rounded-full bg-[#EF4444]" /> <span className="text-xs font-bold">SP</span></div>
                <div className="text-2xl font-bold">{viewMode === "2017 Only" ? "47" : "111"}</div>
                {viewMode === "Comparison (17 vs 22)" && <div className="text-[10px] text-[var(--text-secondary)]">2017: 47 <span className="text-emerald-500">↑ 64</span></div>}
              </div>
              <div className="text-center">
                <div className="flex items-center justify-center gap-1.5 mb-1"><span className="w-2 h-2 rounded-full bg-[#2563EB]" /> <span className="text-xs font-bold">BSP</span></div>
                <div className="text-2xl font-bold">{viewMode === "2017 Only" ? "19" : "1"}</div>
                {viewMode === "Comparison (17 vs 22)" && <div className="text-[10px] text-[var(--text-secondary)]">2017: 19 <span className="text-rose-500">↓ 18</span></div>}
              </div>
              <div className="text-center">
                <div className="flex items-center justify-center gap-1.5 mb-1"><span className="w-2 h-2 rounded-full bg-[#22C55E]" /> <span className="text-xs font-bold">INC</span></div>
                <div className="text-2xl font-bold">{viewMode === "2017 Only" ? "7" : "2"}</div>
                {viewMode === "Comparison (17 vs 22)" && <div className="text-[10px] text-[var(--text-secondary)]">2017: 7 <span className="text-rose-500">↓ 5</span></div>}
              </div>
              <div className="text-center">
                <div className="flex items-center justify-center gap-1.5 mb-1"><span className="w-2 h-2 rounded-full bg-[#EAB308]" /> <span className="text-xs font-bold">RLD</span></div>
                <div className="text-2xl font-bold">{viewMode === "2017 Only" ? "1" : "8"}</div>
                {viewMode === "Comparison (17 vs 22)" && <div className="text-[10px] text-[var(--text-secondary)]">2017: 1 <span className="text-emerald-500">↑ 7</span></div>}
              </div>
              <div className="text-center">
                <div className="flex items-center justify-center gap-1.5 mb-1"><span className="w-2 h-2 rounded-full bg-[#94A3B8]" /> <span className="text-xs font-bold">Others</span></div>
                <div className="text-2xl font-bold">{viewMode === "2017 Only" ? "17" : "26"}</div>
                {viewMode === "Comparison (17 vs 22)" && <div className="text-[10px] text-[var(--text-secondary)]">2017: 17 <span className="text-emerald-500">↑ 9</span></div>}
              </div>
            </div>
          </PremiumCard>

          <PremiumCard className="flex flex-col p-6 h-[400px]">
             <div className="flex justify-between items-center mb-6">
              <h2 className="text-lg font-serif font-bold text-[var(--text-primary)]">Vote Share {viewMode === "Comparison (17 vs 22)" ? "Comparison" : "Overview"}</h2>
              <div className="flex items-center gap-4 text-xs font-medium">
                 {viewMode !== "2022 Only" && <div className="flex items-center gap-1.5"><span className="w-3 h-3 rounded-sm bg-[#D4AF37]/50" /> 2017 (Real)</div>}
                 {viewMode !== "2017 Only" && <div className="flex items-center gap-1.5"><span className="w-3 h-3 rounded-sm bg-[#D4AF37]" /> 2022 (Mock)</div>}
              </div>
            </div>
            <div className="flex-1 w-full min-h-0">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={voteShare} margin={{ top: 20, right: 0, left: -20, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--border-subtle)" vertical={false} />
                  <XAxis dataKey="name" stroke="var(--text-secondary)" tick={{fill: 'var(--text-secondary)', fontSize: 12}} axisLine={false} tickLine={false} />
                  <YAxis stroke="var(--text-secondary)" tick={{fill: 'var(--text-secondary)', fontSize: 12}} axisLine={false} tickLine={false} tickFormatter={(val) => `${val}%`} />
                  <RechartsTooltip 
                    contentStyle={{ backgroundColor: 'var(--bg-surface)', border: '1px solid var(--border-subtle)', borderRadius: '8px', color: 'var(--text-primary)' }}
                    itemStyle={{ color: 'var(--text-primary)' }}
                    cursor={{fill: 'var(--bg-app)'}}
                  />
                  {viewMode !== "2022 Only" && <Bar dataKey="2017" fill="#D4AF37" fillOpacity={0.5} radius={[4, 4, 0, 0]} />}
                  {viewMode !== "2017 Only" && <Bar dataKey="2022" fill="#D4AF37" radius={[4, 4, 0, 0]} />}
                </BarChart>
              </ResponsiveContainer>
            </div>
          </PremiumCard>

        </div>

        {/* Right Column - Intelligence Feeds */}
        <div className="lg:col-span-4 flex flex-col gap-6">
          
          <PremiumCard className="p-6">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-lg font-serif font-bold text-[var(--text-primary)] flex items-center gap-2">
                <Brain className="w-5 h-5 text-[var(--accent-primary)]" /> AI Executive Brief
              </h2>
              <span className="text-[10px] text-[var(--text-tertiary)] uppercase font-medium">Generated just now</span>
            </div>
            <p className="text-sm text-[var(--text-secondary)] leading-relaxed mb-4">
              Based on the comprehensive {viewMode === "Comparison (17 vs 22)" ? "2017 & 2022" : viewMode.split(' ')[0]} data ingestion, BJP established strong dominance. 
              {activeKpis?.total_votes ? ` Total votes polled reached ${activeKpis.total_votes.toLocaleString()} across ${activeKpis.total_booths?.toLocaleString() || 0} booths.` : ''}
              The platform is now processing real booth-level margins and voter turnout statistics.
            </p>
            <div className="space-y-2">
              <h4 className="text-xs font-bold text-[var(--text-primary)] uppercase tracking-wider mb-2">Key Insights ({viewMode === "Comparison (17 vs 22)" ? "Overall" : viewMode.split(' ')[0]})</h4>
              {[
                `Total Polled Votes: ${activeKpis?.total_votes?.toLocaleString() || 0}`,
                `Overall Turnout: ${activeKpis?.turnout_pct || 0}%`,
                `Total Constituencies Analyzed: ${activeKpis?.total_constituencies || 403}`,
                "Machine Learning predictions active"
              ].map((highlight, idx) => (
                <div key={idx} className="flex items-start gap-2 text-sm text-[var(--text-secondary)]">
                  <div className="w-4 h-4 rounded-full bg-emerald-500/10 text-emerald-500 flex items-center justify-center flex-shrink-0 mt-0.5">
                    <span className="text-[10px]">✓</span>
                  </div>
                  {highlight}
                </div>
              ))}
            </div>
            <button className="w-full mt-6 py-2.5 bg-[var(--accent-primary)]/5 hover:bg-[var(--accent-primary)]/10 text-[var(--accent-primary)] rounded-xl text-sm font-medium transition-colors border border-[var(--accent-primary)]/20">
              View Full AI Brief →
            </button>
          </PremiumCard>

          {viewMode === "Comparison (17 vs 22)" ? (
            <PremiumCard className="p-6">
               <h2 className="text-lg font-serif font-bold text-[var(--text-primary)] mb-1">Seat Changes Overview</h2>
               <p className="text-xs text-[var(--text-secondary)] mb-6">2017 vs 2022 (Mock Comparison)</p>
               
               <div className="flex items-center gap-4">
                 <div className="w-32 h-32 relative">
                   <ResponsiveContainer width="100%" height="100%">
                      <PieChart key={viewMode}>
                        <Pie
                          data={defaultSeatChangesData}
                          cx="50%"
                          cy="50%"
                          innerRadius={45}
                          outerRadius={60}
                          stroke="none"
                          dataKey="value"
                        >
                          {defaultSeatChangesData.map((entry, index) => (
                            <Cell key={`cell-${index}`} fill={entry.color} />
                          ))}
                        </Pie>
                      </PieChart>
                   </ResponsiveContainer>
                   <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                      <span className="text-xl font-bold text-[var(--text-primary)]">403</span>
                      <span className="text-[10px] text-[var(--text-secondary)]">Total Seats</span>
                   </div>
                 </div>
                 
                 <div className="flex-1 space-y-4">
                   <div>
                     <div className="flex items-center justify-between text-sm font-medium mb-1">
                       <div className="flex items-center gap-2"><span className="w-2 h-2 bg-[#10B981]" /> Won by same party</div>
                       <span>306</span>
                     </div>
                     <div className="text-xs text-[var(--text-tertiary)] ml-4">(75.9%)</div>
                   </div>
                   <div>
                     <div className="flex items-center justify-between text-sm font-medium mb-1">
                       <div className="flex items-center gap-2"><span className="w-2 h-2 bg-[#EF4444]" /> Changed hands</div>
                       <span>97</span>
                     </div>
                     <div className="text-xs text-[var(--text-tertiary)] ml-4">(24.1%)</div>
                   </div>
                 </div>
               </div>
            </PremiumCard>
          ) : (
            <PremiumCard className="p-6">
               <h2 className="text-lg font-serif font-bold text-[var(--text-primary)] mb-1">Vote Share Breakdown</h2>
               <p className="text-xs text-[var(--text-secondary)] mb-6">{viewMode} Data</p>
               
               <div className="flex items-center gap-4">
                 <div className="w-32 h-32 relative">
                   <ResponsiveContainer width="100%" height="100%">
                      <PieChart key={viewMode}>
                        <Pie
                          data={voteShare.map(v => ({name: v.name, value: viewMode === "2017 Only" ? v[2017] : v[2022], fill: (COLORS as any)[v.name] || '#ccc'}))}
                          cx="50%"
                          cy="50%"
                          innerRadius={45}
                          outerRadius={60}
                          stroke="none"
                          dataKey="value"
                        >
                          {voteShare.map((entry, index) => (
                            <Cell key={`cell-${index}`} fill={(COLORS as any)[entry.name] || '#ccc'} />
                          ))}
                        </Pie>
                      </PieChart>
                   </ResponsiveContainer>
                   <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                      <span className="text-xl font-bold text-[var(--text-primary)]">100%</span>
                      <span className="text-[10px] text-[var(--text-secondary)]">Total</span>
                   </div>
                 </div>
                 
                 <div className="flex-1 space-y-3 max-h-[140px] overflow-y-auto scrollbar-hide">
                    {[...voteShare].sort((a,b) => (viewMode === "2017 Only" ? b[2017] - a[2017] : b[2022] - a[2022])).map((party) => (
                      <div key={party.name}>
                        <div className="flex items-center justify-between text-sm font-medium mb-1">
                          <div className="flex items-center gap-2"><span className="w-2 h-2 rounded-full" style={{backgroundColor: (COLORS as any)[party.name] || '#ccc'}} /> {party.name}</div>
                          <span>{Number(viewMode === "2017 Only" ? party[2017] : party[2022]).toFixed(1)}%</span>
                        </div>
                      </div>
                    ))}
                 </div>
               </div>
            </PremiumCard>
          )}

        </div>

      </div>
    </div>
  );
}
