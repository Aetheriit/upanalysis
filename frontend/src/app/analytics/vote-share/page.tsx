"use client";

import React, { useState, useEffect } from "react";
import { PageHeader } from "@/components/layout/page-header";
import { PremiumCard } from "@/components/ds/premium-card";
import { 
  BarChart, Bar, AreaChart, Area,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer
} from "recharts";
import { Download, Share2, Loader2, AlertTriangle } from "lucide-react";
import { useElectionContext } from "@/context/ElectionContext";
import { apiUrl } from "@/lib/api";
import { downloadCsv } from "@/lib/export";

const COLORS = {
  BJP: "#F97316",
  SP: "#EF4444",
  BSP: "#2563EB",
  INC: "#22C55E",
  RLD: "#EAB308",
  Other: "#64748B"
};

export default function VoteShareAnalytics() {
  const { is2017 } = useElectionContext();
  const [regionalData, setRegionalData] = useState<any[]>([]);
  const [historicalTrendData, setHistoricalTrendData] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function fetchVoteShareData() {
      try {
        setLoading(true);
        setError(null);
        const year = is2017 ? 2017 : 2022;
        
        // Fetch regional data for current selected year
        const regionalResponse = await fetch(apiUrl(`/api/v1/analytics/regional-vote-share?election_year=${year}`));
        const regionalJson = await regionalResponse.json();
        
        // Fetch overall vote share for 2017 and 2022 for historical trend
        const vs2017Resp = await fetch(apiUrl("/api/v1/analytics/vote-share?election_year=2017"));
        const vs2017Json = await vs2017Resp.json();
        
        const vs2022Resp = await fetch(apiUrl("/api/v1/analytics/vote-share?election_year=2022"));
        const vs2022Json = await vs2022Resp.json();

        // Process Regional
        setRegionalData(regionalJson.regions || []);

        // Process Historical
        const getPartyPct = (data: any, partyAbbr: string) => {
          if (!data || !data.vote_share) return 0;
          const party = data.vote_share.find((p: any) => p.abbreviation === partyAbbr);
          return party ? party.vote_share : 0;
        };
        
        setHistoricalTrendData([
          { 
            year: "2017", 
            BJP: getPartyPct(vs2017Json, "BJP"), 
            SP: getPartyPct(vs2017Json, "SP"), 
            BSP: getPartyPct(vs2017Json, "BSP"), 
            INC: getPartyPct(vs2017Json, "INC") 
          },
          { 
            year: "2022", 
            BJP: getPartyPct(vs2022Json, "BJP"), 
            SP: getPartyPct(vs2022Json, "SP"), 
            BSP: getPartyPct(vs2022Json, "BSP"), 
            INC: getPartyPct(vs2022Json, "INC") 
          },
        ]);
        
      } catch (err: any) {
        setError(err.message || "Failed to fetch data");
      } finally {
        setLoading(false);
      }
    }

    fetchVoteShareData();
  }, [is2017]);

  // Derived Insights
  const bjp2022 = historicalTrendData.find(d => d.year === "2022")?.BJP || 0;
  const sp2022 = historicalTrendData.find(d => d.year === "2022")?.SP || 0;
  const bjp2017 = historicalTrendData.find(d => d.year === "2017")?.BJP || 0;
  const sp2017 = historicalTrendData.find(d => d.year === "2017")?.SP || 0;
  
  const combinedTop2 = (bjp2022 + sp2022).toFixed(1);
  const spSwing = (sp2022 - sp2017).toFixed(1);
  const bjpSwing = (bjp2022 - bjp2017).toFixed(1);
  const exportVoteShare = () => downloadCsv(`vote-share-${is2017 ? 2017 : 2022}.csv`, [
    ...regionalData,
    ...historicalTrendData,
  ]);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="flex flex-col items-center gap-4">
          <Loader2 className="w-8 h-8 animate-spin text-[var(--accent-primary)]" />
          <p className="text-[var(--text-secondary)] font-medium">Loading vote share data...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-8 max-w-[1920px] mx-auto min-h-[60vh] flex items-center justify-center">
        <PremiumCard className="p-8 max-w-md w-full text-center border-red-500/20 bg-red-500/5">
          <AlertTriangle className="w-12 h-12 text-red-500 mx-auto mb-4" />
          <h2 className="text-xl font-bold text-[var(--text-primary)] mb-2">Error Loading Data</h2>
          <p className="text-[var(--text-secondary)]">{error}</p>
        </PremiumCard>
      </div>
    );
  }

  return (
    <div className="p-8 max-w-[1920px] mx-auto min-h-screen space-y-6">
      <PageHeader 
        title="Vote Share Analytics"
        description="Deep dive into vote share distributions, regional variations, and macro trends."
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
            <button onClick={exportVoteShare} disabled={!regionalData.length && !historicalTrendData.length} className="px-4 py-2 bg-[var(--accent-primary)] text-[var(--bg-app)] hover:bg-[var(--accent-primary-hover)] disabled:opacity-50 rounded-lg text-sm font-medium transition-colors flex items-center gap-2">
              <Download className="w-4 h-4" /> Export Report
            </button>
          </>
        }
      />

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Regional Breakdown Bar Chart */}
        <PremiumCard className="p-6 h-[450px] flex flex-col">
          <div className="flex justify-between items-center mb-6">
            <h2 className="text-lg font-serif font-bold text-[var(--text-primary)]">Regional Vote Share ({is2017 ? '2017' : '2022'})</h2>
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
                <Bar dataKey="INC" fill={COLORS.INC} radius={[4, 4, 0, 0]} maxBarSize={40} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </PremiumCard>

        {/* Historical Trend Area Chart */}
        <PremiumCard className="p-6 h-[450px] flex flex-col">
          <div className="flex justify-between items-center mb-6">
            <h2 className="text-lg font-serif font-bold text-[var(--text-primary)]">Historical Vote Share Trend (2017-2022)</h2>
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

      <div className="grid grid-cols-1 lg:grid-cols-1 gap-6">
        {/* Insights Panel */}
        <PremiumCard className="p-6 h-[400px] flex flex-col bg-[var(--bg-surface)]">
          <h2 className="text-lg font-serif font-bold text-[var(--text-primary)] mb-6">Vote Share Intelligence Insights</h2>
          
          <div className="space-y-4 overflow-y-auto pr-2 custom-scrollbar">
            <div className="p-4 rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-app)]">
              <div className="flex items-center justify-between mb-2">
                <h4 className="font-semibold text-sm text-[var(--text-primary)]">Bipolar Contest Solidification</h4>
                <span className="text-xs font-medium px-2 py-1 bg-[var(--accent-primary)]/10 text-[var(--accent-primary)] rounded">Macro Trend</span>
              </div>
              <p className="text-sm text-[var(--text-secondary)] leading-relaxed">
                The combined vote share for the top two parties (BJP + SP) in 2022 was {combinedTop2}%. This marks a structural shift toward a heavily bipolar electoral landscape in Uttar Pradesh, largely absorbing smaller vote blocks.
              </p>
            </div>

            <div className="p-4 rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-app)]">
              <div className="flex items-center justify-between mb-2">
                <h4 className="font-semibold text-sm text-[var(--text-primary)]">SP's Vote Share Swing</h4>
                <span className="text-xs font-medium px-2 py-1 bg-emerald-500/10 text-emerald-500 rounded">Party Shift</span>
              </div>
              <p className="text-sm text-[var(--text-secondary)] leading-relaxed">
                Samajwadi Party achieved a {(parseFloat(spSwing) > 0 ? "+" : "")}{spSwing}% vote share swing between 2017 and 2022, signaling heavy consolidation. Concurrently, the BJP's vote share shifted by {(parseFloat(bjpSwing) > 0 ? "+" : "")}{bjpSwing}%, keeping the overall dynamic highly competitive.
              </p>
            </div>

            <div className="p-4 rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-app)]">
              <div className="flex items-center justify-between mb-2">
                <h4 className="font-semibold text-sm text-[var(--text-primary)]">Regional Strongholds</h4>
                <span className="text-xs font-medium px-2 py-1 bg-blue-500/10 text-blue-500 rounded">Geographic Split</span>
              </div>
              <p className="text-sm text-[var(--text-secondary)] leading-relaxed">
                The regional variance indicates sharp divides. Analysis of Purvanchal and Western UP highlights how alliance arithmetic and regional leaders drove heavily localized swings over macro-state trends.
              </p>
            </div>
          </div>
        </PremiumCard>
      </div>

    </div>
  );
}
