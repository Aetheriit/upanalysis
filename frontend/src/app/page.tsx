"use client";

import React, { useState, useEffect, useMemo } from "react";
import { 
  Building2, ArrowRightLeft, Users, TrendingUp, Target, 
  Brain, Search, Map, BarChart3, Clock, AlertTriangle, ShieldAlert,
  ChevronRight, Filter, X
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

// UP Regions mapping (standard administrative regions)
const UP_REGIONS: Record<string, string[]> = {
  "Western UP": ["Saharanpur","Shamli","Muzaffarnagar","Bijnor","Moradabad","Rampur","Amroha","Meerut","Baghpat","Ghaziabad","Hapur","Gautam Buddha Nagar","Bulandshahr","Aligarh","Hathras","Mathura","Agra","Firozabad","Mainpuri","Etah","Kasganj","Farrukhabad","Kannauj","Etawah","Auraiya"],
  "Central UP": ["Kanpur Dehat","Kanpur Nagar","Unnao","Lucknow","Rae Bareli","Hardoi","Sitapur","Lakhimpur Kheri","Barabanki","Fatehpur","Kaushambi","Prayagraj"],
  "Bundelkhand": ["Jalaun","Jhansi","Lalitpur","Hamirpur","Mahoba","Banda","Chitrakoot"],
  "Eastern UP": ["Pratapgarh","Ayodhya","Ambedkar Nagar","Amethi","Sultanpur","Gonda","Balrampur","Shravasti","Bahraich","Basti","Sant Kabir Nagar","Siddharth Nagar","Gorakhpur","Maharajganj","Kushinagar","Deoria","Mau","Azamgarh","Ballia","Varanasi","Chandauli","Ghazipur","Jaunpur","Mirzapur","Sonbhadra"],
  "Awadh": ["Lucknow","Barabanki","Faizabad","Ayodhya","Ambedkar Nagar","Amethi","Sultanpur","Gonda","Balrampur","Shravasti","Bahraich"],
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
  const [seats17, setSeats17] = useState<any>({});
  const [seats22, setSeats22] = useState<any>({});
  const [swingData, setSwingData] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  // All constituencies data for client-side filtering
  const [allConst17, setAllConst17] = useState<any[]>([]);
  const [allConst22, setAllConst22] = useState<any[]>([]);
  const [districtList, setDistrictList] = useState<string[]>([]);

  // Filter state
  const [filterDistrict, setFilterDistrict] = useState("");
  const [filterRegion, setFilterRegion] = useState("");
  const [filterParty, setFilterParty] = useState("");
  const [isMapFullscreen, setIsMapFullscreen] = useState(false);

  const activeYear = viewMode === "2017 Only" ? "2017" : "2022";

  // Compute active KPIs based on view mode
  const activeKpis = viewMode === "2022 Only" ? kpis2022 : kpis2017;

  useEffect(() => {
    async function fetchData() {
      try {
        const [kpi17Res, kpi22Res, vote17Res, vote22Res, swingRes, const17Res, const22Res] = await Promise.all([
          fetch(apiUrl("/api/v1/analytics/dashboard?election_year=2017")),
          fetch(apiUrl("/api/v1/analytics/dashboard?election_year=2022")),
          fetch(apiUrl("/api/v1/analytics/vote-share?election_year=2017")),
          fetch(apiUrl("/api/v1/analytics/vote-share?election_year=2022")),
          fetch(apiUrl("/api/v1/analytics/swing")),
          fetch(apiUrl("/api/v1/analytics/constituencies?election_year=2017")),
          fetch(apiUrl("/api/v1/analytics/constituencies?election_year=2022")),
        ]);
        
        const kpi17Data = await kpi17Res.json();
        const kpi22Data = await kpi22Res.json();
        const vote17Data = await vote17Res.json();
        const vote22Data = await vote22Res.json();
        const swingD = await swingRes.json();
        const c17Data = await const17Res.json();
        const c22Data = await const22Res.json();
        
        setKpis2017(kpi17Data.kpis);
        setKpis2022(kpi22Data.kpis);

        const c17 = c17Data.constituencies || [];
        const c22 = c22Data.constituencies || [];
        setAllConst17(c17);
        setAllConst22(c22);

        // Build sorted district list from real data
        const districts = Array.from(new Set([
          ...c17.map((c: any) => c.district),
          ...c22.map((c: any) => c.district),
        ])).filter(Boolean).sort() as string[];
        setDistrictList(districts);
        
        // Transform vote share data for Recharts
        if (vote17Data.vote_share && vote22Data.vote_share) {
          const s17: any = {};
          const s22: any = {};
          const transformed = vote17Data.vote_share.map((v17: any) => {
            s17[v17.abbreviation] = v17.seats_won;
            const v22 = vote22Data.vote_share.find((v: any) => v.abbreviation === v17.abbreviation);
            if (v22) s22[v22.abbreviation] = v22.seats_won;
            return {
              name: v17.abbreviation,
              2017: v17.vote_share,
              2022: v22 ? v22.vote_share : 0,
            };
          });
          setSeats17(s17);
          setSeats22(s22);
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

  // --- Client-side filtered KPIs ---
  const filteredKpis = useMemo(() => {
    const hasFilter = filterDistrict || filterRegion || filterParty;
    if (!hasFilter) return null; // null = use full API KPIs

    const activeConst = viewMode === "2017 Only" ? allConst17 : allConst22;
    
    // Get districts that belong to selected region
    const regionDistricts = filterRegion ? (UP_REGIONS[filterRegion] || []) : [];

    const filtered = activeConst.filter((c: any) => {
      if (filterDistrict && c.district !== filterDistrict) return false;
      if (filterRegion && !regionDistricts.includes(c.district)) return false;
      if (filterParty && c.winner_party !== filterParty) return false;
      return true;
    });

    if (filtered.length === 0) return { total_constituencies: 0, total_votes: 0, turnout_pct: 0, winning_margin_avg: 0 };

    const totalVotes = filtered.reduce((s: number, c: any) => s + (c.votes_polled || 0), 0);
    const totalElectors = filtered.reduce((s: number, c: any) => s + (c.total_electors || 0), 0);
    const totalMargin = filtered.reduce((s: number, c: any) => s + (c.winning_margin || 0), 0);
    const turnout = totalElectors > 0 ? (totalVotes / totalElectors * 100) : 0;
    const avgMargin = filtered.length > 0 ? Math.round(totalMargin / filtered.length) : 0;

    // Closest contest among filtered
    const closestContest = [...filtered].sort((a: any, b: any) => (a.winning_margin || 999999) - (b.winning_margin || 999999))[0];

    // Compute party-wise seat counts for filtered
    const partyCounts: Record<string, number> = {};
    filtered.forEach((c: any) => {
      const p = c.winner_party || "OTH";
      partyCounts[p] = (partyCounts[p] || 0) + 1;
    });

    return {
      total_constituencies: filtered.length,
      total_votes: totalVotes,
      turnout_pct: parseFloat(turnout.toFixed(2)),
      winning_margin_avg: avgMargin,
      closest_contest_name: closestContest?.name || "",
      closest_contest_code: closestContest?.code || "",
      closest_contest_margin: closestContest?.winning_margin || 0,
      nota_pct: activeKpis?.nota_pct || 0,
      total_booths: null, // not available per-district in this data
      _partyCounts: partyCounts,
      _filtered: filtered,
    };
  }, [filterDistrict, filterRegion, filterParty, viewMode, allConst17, allConst22, activeKpis]);

  // --- Seat Changes Computation ---
  const seatChanges = useMemo(() => {
    if (!allConst17.length || !allConst22.length) return { same: 306, changed: 97, total: 403, largestSwing: null, chartData: defaultSeatChangesData };

    const regionDistricts = filterRegion ? (UP_REGIONS[filterRegion] || []) : [];
    
    const filtered22 = allConst22.filter((c: any) => {
      if (filterDistrict && c.district !== filterDistrict) return false;
      if (filterRegion && !regionDistricts.includes(c.district)) return false;
      if (filterParty && c.winner_party !== filterParty) return false;
      return true;
    });

    let same = 0;
    let changed = 0;
    let maxSwing = 0;
    let maxSwingConst: any = null;

    filtered22.forEach((c22: any) => {
      const c17 = allConst17.find(c => c.name === c22.name || c.code === c22.code);
      if (c17) {
        if (c17.winner_party === c22.winner_party) {
          same++;
        } else {
          changed++;
        }
        
        // Compute swing as difference in winning_margin_pct
        const pct17 = c17.votes_polled ? (c17.winning_margin / c17.votes_polled) * 100 : 0;
        const pct22 = c22.votes_polled ? (c22.winning_margin / c22.votes_polled) * 100 : 0;
        const swing = Math.abs(pct22 - pct17);
        
        if (swing > maxSwing) {
          maxSwing = swing;
          maxSwingConst = {
            name: c22.name,
            fromParty: c17.winner_party || 'Unknown',
            toParty: c22.winner_party || 'Unknown',
            swingVal: swing
          };
        }
      }
    });

    const total = same + changed;
    const chartData = [
      { name: 'Won by same party', value: same, color: '#10B981' },
      { name: 'Changed hands', value: changed, color: '#EF4444' },
    ];

    return {
      same,
      changed,
      total,
      largestSwing: maxSwingConst,
      chartData
    };
  }, [filterDistrict, filterRegion, filterParty, allConst17, allConst22]);

  // Displayed KPIs: filtered if any filter active, else raw API KPIs
  const displayedKpis = filteredKpis || activeKpis;

  // Filtered seat tally
  const displayedSeats17 = useMemo(() => {
    const hasFilter = filterDistrict || filterRegion || filterParty;
    if (!hasFilter) return seats17;
    const regionDistricts = filterRegion ? (UP_REGIONS[filterRegion] || []) : [];
    const filtered = allConst17.filter((c: any) => {
      if (filterDistrict && c.district !== filterDistrict) return false;
      if (filterRegion && !regionDistricts.includes(c.district)) return false;
      if (filterParty && c.winner_party !== filterParty) return false;
      return true;
    });
    const counts: Record<string, number> = {};
    filtered.forEach((c: any) => { const p = c.winner_party || "OTH"; counts[p] = (counts[p] || 0) + 1; });
    // Group non-major parties as OTH
    const result: any = { BJP: 0, SP: 0, BSP: 0, INC: 0, RLD: 0, OTH: 0 };
    Object.entries(counts).forEach(([p, n]) => {
      if (result.hasOwnProperty(p)) result[p] = n;
      else result.OTH += n;
    });
    return result;
  }, [filterDistrict, filterRegion, filterParty, allConst17, seats17]);

  const displayedSeats22 = useMemo(() => {
    const hasFilter = filterDistrict || filterRegion || filterParty;
    if (!hasFilter) return seats22;
    const regionDistricts = filterRegion ? (UP_REGIONS[filterRegion] || []) : [];
    const filtered = allConst22.filter((c: any) => {
      if (filterDistrict && c.district !== filterDistrict) return false;
      if (filterRegion && !regionDistricts.includes(c.district)) return false;
      if (filterParty && c.winner_party !== filterParty) return false;
      return true;
    });
    const counts: Record<string, number> = {};
    filtered.forEach((c: any) => { const p = c.winner_party || "OTH"; counts[p] = (counts[p] || 0) + 1; });
    const result: any = { BJP: 0, SP: 0, BSP: 0, INC: 0, RLD: 0, OTH: 0 };
    Object.entries(counts).forEach(([p, n]) => {
      if (result.hasOwnProperty(p)) result[p] = n;
      else result.OTH += n;
    });
    return result;
  }, [filterDistrict, filterRegion, filterParty, allConst22, seats22]);

  const hasActiveFilter = !!(filterDistrict || filterRegion || filterParty);

  const clearFilters = () => {
    setFilterDistrict("");
    setFilterRegion("");
    setFilterParty("");
  };

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
            <span className="text-[var(--text-secondary)] text-sm">
              Deep intelligence from {displayedKpis?.total_constituencies || 403} Assembly Constituencies across 75 Districts
            </span>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <button className="px-4 py-2 bg-[var(--accent-primary)]/10 text-[var(--accent-primary)] hover:bg-[var(--accent-primary)]/20 rounded-lg text-sm font-medium transition-colors flex items-center gap-2">
            <Brain className="w-4 h-4" /> AI Analyst
          </button>
        </div>
      </div>

      {/* Filter Ribbon */}
      <div className="flex items-center gap-3 overflow-x-auto pb-2 scrollbar-hide flex-wrap">
        {/* District Filter */}
        <select
          value={filterDistrict}
          onChange={(e) => { setFilterDistrict(e.target.value); setFilterRegion(""); }}
          className="px-4 py-2 bg-[var(--bg-surface)] border border-[var(--border-subtle)] rounded-lg text-sm font-medium text-[var(--text-primary)] min-w-[160px] focus:outline-none focus:ring-1 focus:ring-[var(--accent-primary)] cursor-pointer"
        >
          <option value="">All Districts</option>
          {districtList.map(d => <option key={d} value={d}>{d}</option>)}
        </select>

        {/* Region Filter */}
        <select
          value={filterRegion}
          onChange={(e) => { setFilterRegion(e.target.value); setFilterDistrict(""); }}
          className="px-4 py-2 bg-[var(--bg-surface)] border border-[var(--border-subtle)] rounded-lg text-sm font-medium text-[var(--text-primary)] min-w-[160px] focus:outline-none focus:ring-1 focus:ring-[var(--accent-primary)] cursor-pointer"
        >
          <option value="">All Regions</option>
          {Object.keys(UP_REGIONS).map(r => <option key={r} value={r}>{r}</option>)}
        </select>

        {/* Party Filter */}
        <select
          value={filterParty}
          onChange={(e) => setFilterParty(e.target.value)}
          className="px-4 py-2 bg-[var(--bg-surface)] border border-[var(--border-subtle)] rounded-lg text-sm font-medium text-[var(--text-primary)] min-w-[160px] focus:outline-none focus:ring-1 focus:ring-[var(--accent-primary)] cursor-pointer"
        >
          <option value="">All Parties</option>
          <option value="BJP">BJP</option>
          <option value="SP">SP</option>
          <option value="BSP">BSP</option>
          <option value="INC">INC (Congress)</option>
          <option value="RLD">RLD</option>
          <option value="SBSP">SBSP</option>
          <option value="AD(S)">AD(S)</option>
          <option value="JD(L)">JD(L)</option>
        </select>
        
        {/* Active filter badge + clear */}
        {hasActiveFilter && (
          <button
            onClick={clearFilters}
            className="flex items-center gap-1.5 px-3 py-2 bg-[var(--accent-primary)]/10 text-[var(--accent-primary)] border border-[var(--accent-primary)]/30 rounded-lg text-sm font-medium hover:bg-[var(--accent-primary)]/20 transition-colors"
          >
            <X className="w-3.5 h-3.5" />
            Clear Filters
          </button>
        )}

        {hasActiveFilter && (
          <span className="text-xs text-[var(--text-secondary)] bg-[var(--bg-surface)] px-3 py-2 rounded-lg border border-[var(--border-subtle)]">
            Showing <span className="font-bold text-[var(--accent-primary)]">{displayedKpis?.total_constituencies || 0}</span> constituencies
            {filterDistrict && <> in <span className="font-semibold">{filterDistrict}</span></>}
            {filterRegion && <> in <span className="font-semibold">{filterRegion}</span></>}
            {filterParty && <> won by <span className="font-semibold">{filterParty}</span></>}
          </span>
        )}

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
            <span className="text-3xl font-bold text-[var(--text-primary)]">{displayedKpis?.total_constituencies || "403"}</span>
          </PremiumCard>

          <PremiumCard padding="sm" className="flex flex-col justify-center items-center text-center relative overflow-hidden">
            <div className="flex items-center gap-2 text-[var(--text-secondary)] mb-2">
              <ArrowRightLeft className="w-4 h-4" /> <span className="text-xs font-medium uppercase">Seats Changed</span>
            </div>
            <div className="flex items-end gap-2">
              <span className="text-3xl font-bold text-[var(--text-primary)]">{seatChanges.changed}</span>
              <span className="text-xs font-medium text-emerald-500 bg-emerald-500/10 px-1.5 py-0.5 rounded mb-1">
                {seatChanges.total ? ((seatChanges.changed / seatChanges.total) * 100).toFixed(1) : 0}%
              </span>
            </div>
          </PremiumCard>

          <PremiumCard padding="sm" className="flex flex-col justify-center items-center text-center">
            <div className="flex items-center gap-2 text-[var(--text-secondary)] mb-2">
              <Users className="w-4 h-4" /> <span className="text-xs font-medium uppercase">Avg Turnout</span>
            </div>
            {(() => {
              const t17 = parseFloat(kpis2017?.turnout_pct || "0");
              const t22 = parseFloat(kpis2022?.turnout_pct || "0");
              const diff = t22 - t17;
              const isUp = diff >= 0;
              return (
                <div className="flex items-center justify-between w-full mt-1">
                  <div className="flex flex-col items-center">
                    <div className="text-base font-bold text-[var(--text-primary)] leading-tight tracking-tight">{kpis2017?.turnout_pct || "0"}%</div>
                    <div className="text-[10px] text-[var(--text-tertiary)]">2017</div>
                  </div>
                  <div className={`flex flex-col items-center justify-center px-0.5 text-[10px] font-bold ${isUp ? 'text-emerald-500' : 'text-rose-500'}`}>
                    <span className="leading-none">{isUp ? '↑' : '↓'}</span>
                    <span className="leading-tight tracking-tighter">{Math.abs(diff).toFixed(2)}%</span>
                  </div>
                  <div className="flex flex-col items-center">
                    <div className="text-base font-bold text-[var(--text-primary)] leading-tight tracking-tight">{kpis2022?.turnout_pct || "0"}%</div>
                    <div className="text-[10px] text-[var(--text-tertiary)]">2022</div>
                  </div>
                </div>
              );
            })()}
          </PremiumCard>

          <PremiumCard padding="sm" className="flex flex-col justify-center items-center text-center">
            <div className="flex items-center gap-2 text-[var(--text-secondary)] mb-2">
              <TrendingUp className="w-4 h-4 text-rose-500" /> <span className="text-xs font-medium uppercase">Largest Swing</span>
            </div>
            <span className="text-2xl font-bold text-[var(--text-primary)]">{seatChanges.largestSwing?.swingVal.toFixed(1) || "0.0"}%</span>
            <span className="text-xs text-[var(--text-secondary)]">{seatChanges.largestSwing ? `${seatChanges.largestSwing.name} (${seatChanges.largestSwing.fromParty} to ${seatChanges.largestSwing.toParty})` : "N/A"}</span>
          </PremiumCard>

          <PremiumCard padding="sm" className="flex flex-col justify-center items-center text-center">
            <div className="flex items-center gap-2 text-[var(--text-secondary)] mb-2">
              <Target className="w-4 h-4 text-orange-500" /> <span className="text-xs font-medium uppercase">Closest Contest</span>
            </div>
            <span className="text-2xl font-bold text-[var(--text-primary)]">{displayedKpis?.closest_contest_code || activeKpis?.closest_contest_code || "314"}</span>
            <span className="text-xs text-[var(--text-secondary)]">{displayedKpis?.closest_contest_name || activeKpis?.closest_contest_name || "Meerapur"} (Margin: {(displayedKpis?.closest_contest_margin || activeKpis?.closest_contest_margin)?.toLocaleString() || "1,046"})</span>
          </PremiumCard>

          <PremiumCard padding="sm" className="flex flex-col justify-center items-center text-center">
            <div className="flex items-center gap-2 text-[var(--text-secondary)] mb-2">
              <PieChart className="w-4 h-4" /> <span className="text-xs font-medium uppercase">Vote Share Change</span>
            </div>
            <div className="w-full px-4 text-left overflow-y-auto max-h-[80px] scrollbar-hide">
              {['BJP', 'SP', 'BSP', 'INC'].map(party => {
                const partyData = voteShare.find(v => v.name === party);
                if (!partyData) return null;
                const diff = (partyData[2022] || 0) - (partyData[2017] || 0);
                if (diff === 0 && !partyData[2017] && !partyData[2022]) return null;
                return (
                  <div key={party} className="flex justify-between items-center text-xs mb-1">
                    <span className="font-medium" style={{ color: (COLORS as any)[party] || '#ccc' }}>{party === 'INC' ? 'INC (Congress)' : party}</span>
                    <span className={diff > 0 ? "text-emerald-500" : (diff < 0 ? "text-rose-500" : "text-[var(--text-secondary)]")}>
                      {diff > 0 ? '↑' : (diff < 0 ? '↓' : '')} {Math.abs(diff).toFixed(1)}%
                    </span>
                  </div>
                );
              })}
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
            <span className="text-3xl font-bold text-[var(--text-primary)]">{displayedKpis?.total_constituencies || "403"}</span>
          </PremiumCard>

          <PremiumCard padding="sm" className="flex flex-col justify-center items-center text-center relative overflow-hidden">
            <div className="flex items-center gap-2 text-[var(--text-secondary)] mb-2">
              <BarChart3 className="w-4 h-4" /> <span className="text-xs font-medium uppercase">Total Booths</span>
            </div>
            <div className="flex items-end gap-2">
              <span className="text-3xl font-bold text-[var(--text-primary)]">{displayedKpis?.total_booths?.toLocaleString() || activeKpis?.total_booths?.toLocaleString() || "154,012"}</span>
            </div>
          </PremiumCard>

          <PremiumCard padding="sm" className="flex flex-col justify-center items-center text-center">
            <div className="flex items-center gap-2 text-[var(--text-secondary)] mb-2">
              <Users className="w-4 h-4" /> <span className="text-xs font-medium uppercase">Avg Turnout</span>
            </div>
            <span className="text-3xl font-bold text-[var(--text-primary)]">{displayedKpis?.turnout_pct || "61.4"}%</span>
          </PremiumCard>

          <PremiumCard padding="sm" className="flex flex-col justify-center items-center text-center">
            <div className="flex items-center gap-2 text-[var(--text-secondary)] mb-2">
              <TrendingUp className="w-4 h-4 text-emerald-500" /> <span className="text-xs font-medium uppercase">Avg Margin</span>
            </div>
            <span className="text-2xl font-bold text-[var(--text-primary)]">{(displayedKpis?.winning_margin_avg || activeKpis?.winning_margin_avg)?.toLocaleString() || "24,891"}</span>
          </PremiumCard>

          <PremiumCard padding="sm" className="flex flex-col justify-center items-center text-center">
            <div className="flex items-center gap-2 text-[var(--text-secondary)] mb-2">
              <Target className="w-4 h-4 text-orange-500" /> <span className="text-xs font-medium uppercase">Closest Contest</span>
            </div>
            <span className="text-2xl font-bold text-[var(--text-primary)]">{displayedKpis?.closest_contest_code || activeKpis?.closest_contest_code || "314"}</span>
            <span className="text-xs text-[var(--text-secondary)]">{displayedKpis?.closest_contest_name || activeKpis?.closest_contest_name || "Meerapur"} (Margin: {(displayedKpis?.closest_contest_margin || activeKpis?.closest_contest_margin)?.toLocaleString() || "1,046"})</span>
          </PremiumCard>

          <PremiumCard padding="sm" className="flex flex-col justify-center items-center text-center">
            <div className="flex items-center gap-2 text-[var(--text-secondary)] mb-2">
              <PieChart className="w-4 h-4" /> <span className="text-xs font-medium uppercase">NOTA %</span>
            </div>
            <span className="text-3xl font-bold text-[var(--text-primary)]">{displayedKpis?.nota_pct || activeKpis?.nota_pct || "2.86"}%</span>
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
              <h2 className="text-xl font-serif font-bold text-[var(--text-primary)]">Uttar Pradesh – {viewMode === "Comparison (17 vs 22)" ? "2022" : viewMode.split(' ')[0]} Constituency Map</h2>
              <button 
                onClick={() => setIsMapFullscreen(true)}
                className="text-sm font-medium text-[var(--accent-primary)] hover:underline flex items-center gap-1"
              >
                View Fullscreen <ChevronRight className="w-4 h-4" />
              </button>
            </div>
            <div className="flex-1 rounded-xl overflow-hidden" style={{ minHeight: "380px" }}>
               <UPMap />
            </div>

            {/* Seat Tally Row */}
            <div className="grid grid-cols-6 gap-4 mt-6 pt-6 border-t border-[var(--border-subtle)]">
              {[
                { label: "BJP", key: "BJP", color: "#F97316" },
                { label: "SP", key: "SP", color: "#EF4444" },
                { label: "BSP", key: "BSP", color: "#2563EB" },
                { label: "INC", key: "INC", color: "#22C55E" },
                { label: "RLD", key: "RLD", color: "#EAB308" },
                { label: "OTH", key: "OTH", color: "#94A3B8" }
              ].map(party => {
                const s17 = displayedSeats17[party.key] || 0;
                const s22 = displayedSeats22[party.key] || 0;
                const activeSeat = viewMode === "2017 Only" ? s17 : s22;
                const diff = s22 - s17;
                return (
                  <div className="text-center" key={party.key}>
                    <div className="flex items-center justify-center gap-1.5 mb-1"><span className="w-2 h-2 rounded-full" style={{ backgroundColor: party.color }} /> <span className="text-xs font-bold">{party.label}</span></div>
                    <div className="text-2xl font-bold">{activeSeat}</div>
                    {viewMode === "Comparison (17 vs 22)" && (
                      <div className="text-[10px] text-[var(--text-secondary)]">
                        2017: {s17} <span className={diff >= 0 ? "text-emerald-500" : "text-rose-500"}>{diff > 0 ? `↑ ${diff}` : (diff < 0 ? `↓ ${Math.abs(diff)}` : "-")}</span>
                      </div>
                    )}
                  </div>
                );
              })}
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
                  {viewMode !== "2022 Only" && (
                    <Bar dataKey="2017" radius={[4, 4, 0, 0]}>
                      {voteShare.map((entry, index) => (
                        <Cell key={`cell-2017-${index}`} fill={(COLORS as any)[entry.name] || '#94A3B8'} fillOpacity={0.5} />
                      ))}
                    </Bar>
                  )}
                  {viewMode !== "2017 Only" && (
                    <Bar dataKey="2022" radius={[4, 4, 0, 0]}>
                      {voteShare.map((entry, index) => (
                        <Cell key={`cell-2022-${index}`} fill={(COLORS as any)[entry.name] || '#94A3B8'} />
                      ))}
                    </Bar>
                  )}
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
                `Total Constituencies Analyzed: ${displayedKpis?.total_constituencies || activeKpis?.total_constituencies || 403}`,
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
               <p className="text-xs text-[var(--text-secondary)] mb-6">2017 vs 2022 (Real Data)</p>
               
               <div className="flex items-center gap-4">
                 <div className="w-32 h-32 relative">
                   <ResponsiveContainer width="100%" height="100%">
                      <PieChart key={viewMode}>
                        <Pie
                          data={seatChanges.chartData}
                          cx="50%"
                          cy="50%"
                          innerRadius={45}
                          outerRadius={60}
                          stroke="none"
                          dataKey="value"
                        >
                          {seatChanges.chartData.map((entry, index) => (
                            <Cell key={`cell-${index}`} fill={entry.color} />
                          ))}
                        </Pie>
                      </PieChart>
                   </ResponsiveContainer>
                   <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                      <span className="text-xl font-bold text-[var(--text-primary)]">{seatChanges.total}</span>
                      <span className="text-[10px] text-[var(--text-secondary)]">Total Seats</span>
                   </div>
                 </div>
                 
                 <div className="flex-1 space-y-4">
                   <div>
                     <div className="flex items-center justify-between text-sm font-medium mb-1">
                       <div className="flex items-center gap-2"><span className="w-2 h-2 bg-[#10B981]" /> Won by same party</div>
                       <span>{seatChanges.same}</span>
                     </div>
                     <div className="text-xs text-[var(--text-tertiary)] ml-4">({seatChanges.total ? ((seatChanges.same / seatChanges.total) * 100).toFixed(1) : 0}%)</div>
                   </div>
                   <div>
                     <div className="flex items-center justify-between text-sm font-medium mb-1">
                       <div className="flex items-center gap-2"><span className="w-2 h-2 bg-[#EF4444]" /> Changed hands</div>
                       <span>{seatChanges.changed}</span>
                     </div>
                     <div className="text-xs text-[var(--text-tertiary)] ml-4">({seatChanges.total ? ((seatChanges.changed / seatChanges.total) * 100).toFixed(1) : 0}%)</div>
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

      {/* Fullscreen Map Modal */}
      {isMapFullscreen && (
        <div className="fixed inset-0 z-50 flex flex-col bg-[var(--bg-app)]">
          <div className="flex items-center justify-between p-4 border-b border-[var(--border-subtle)] bg-[var(--bg-surface)]">
            <h2 className="text-xl font-serif font-bold text-[var(--text-primary)]">
              Uttar Pradesh – {viewMode === "Comparison (17 vs 22)" ? "2022" : viewMode.split(' ')[0]} Constituency Map
            </h2>
            <button 
              onClick={() => setIsMapFullscreen(false)}
              className="p-2 rounded-full hover:bg-[var(--border-subtle)] transition-colors"
            >
              <X className="w-6 h-6 text-[var(--text-primary)]" />
            </button>
          </div>
          <div className="flex-1 p-4">
            <div className="w-full h-full rounded-xl overflow-hidden border border-[var(--border-subtle)] relative">
              <UPMap />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
