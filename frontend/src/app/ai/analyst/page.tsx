"use client";
import { PageHeader } from "@/components/layout/page-header";
import { AssistantPanel, AIUsage } from "@/components/ai/assistant-panel";
import { useElectionContext } from "@/context/ElectionContext";

export default function AIAnalystPage() {
  const { viewMode } = useElectionContext();
  const year = viewMode === "2017 Only" ? 2017 : 2022;
  return <div className="p-8 max-w-[1920px] mx-auto min-h-screen space-y-6">
    <PageHeader title="AI Analyst" description="Explore your election data with questions, comparisons, and source-linked answers." breadcrumbs={[{label:"Home",href:"/"},{label:"AI & Forecasting"},{label:"AI Analyst"}]} />
    <div className="grid grid-cols-1 xl:grid-cols-[minmax(0,1fr)_320px] gap-6 items-start"><AssistantPanel electionYear={year} /><AIUsage /></div>
  </div>;
}
