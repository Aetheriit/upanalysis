"use client";

import React, { useState } from "react";
import { PageHeader } from "@/components/layout/page-header";
import { PremiumCard } from "@/components/ds/premium-card";
import { Brain, Send, Sparkles, BarChart3, MapPin, TrendingUp } from "lucide-react";

const suggestedQueries = [
  { icon: BarChart3, text: "Which party gained the most vote share between 2017 and 2022?" },
  { icon: MapPin, text: "Show me all constituencies where the margin was less than 2000 votes" },
  { icon: TrendingUp, text: "Analyze turnout increase in Western UP between elections" },
  { icon: Brain, text: "What was BSP's vote transfer pattern in 2022?" },
];

const sampleConversation = [
  {
    role: "user",
    text: "Which constituencies had the highest swing from BJP to SP in 2022?"
  },
  {
    role: "assistant",
    text: `Based on my analysis of the 2017 vs 2022 results, here are the top 5 constituencies with the highest swing from BJP to SP:

1. **Kannauj** — Swing: 22.8% (BJP → SP)
2. **Azamgarh** — Swing: 21.5% (BJP → SP)  
3. **Amethi** — Swing: 18.4% (BJP → SP)
4. **Mainpuri** — Swing: 16.9% (BJP → SP)
5. **Etawah** — Swing: 15.3% (BSP → SP)

**Key Pattern:** The highest swings toward SP were concentrated in the Yadav heartland of Central UP (Mainpuri, Etawah, Kannauj corridor), suggesting a strong consolidation of the Yadav vote base combined with alliance partners pulling non-Yadav OBC and Muslim votes.`
  }
];

export default function AIAnalystPage() {
  const [input, setInput] = useState("");

  return (
    <div className="p-8 max-w-[1920px] mx-auto min-h-screen space-y-6">
      <PageHeader
        title="AI Analyst"
        description="Ask questions in natural language to query, analyze, and visualize election data."
        breadcrumbs={[{ label: "Home", href: "/" }, { label: "AI & Forecasting" }, { label: "AI Analyst" }]}
      />

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Chat Area */}
        <div className="lg:col-span-8 flex flex-col gap-6">
          <PremiumCard className="p-6 flex flex-col min-h-[600px]">
            {/* Messages */}
            <div className="flex-1 space-y-6 overflow-y-auto pr-2 mb-6">
              {sampleConversation.map((msg, idx) => (
                <div key={idx} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                  <div className={`max-w-[80%] rounded-2xl px-5 py-4 ${
                    msg.role === 'user' 
                      ? 'bg-[var(--accent-primary)] text-[var(--bg-app)]' 
                      : 'bg-[var(--bg-app)] border border-[var(--border-subtle)] text-[var(--text-primary)]'
                  }`}>
                    {msg.role === 'assistant' && (
                      <div className="flex items-center gap-2 mb-3">
                        <Brain className="w-4 h-4 text-[var(--accent-primary)]" />
                        <span className="text-xs font-semibold text-[var(--accent-primary)]">ElectionIntel AI</span>
                      </div>
                    )}
                    <div className="text-sm leading-relaxed whitespace-pre-line">{msg.text}</div>
                  </div>
                </div>
              ))}
            </div>

            {/* Input */}
            <div className="relative">
              <input
                type="text"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                placeholder="Ask anything about UP elections..."
                className="w-full pl-5 pr-14 py-4 bg-[var(--bg-app)] border border-[var(--border-subtle)] rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[var(--accent-primary)] text-[var(--text-primary)]"
              />
              <button className="absolute right-3 top-1/2 -translate-y-1/2 p-2 bg-[var(--accent-primary)] text-[var(--bg-app)] rounded-lg hover:bg-[var(--accent-primary-hover)] transition-colors">
                <Send className="w-4 h-4" />
              </button>
            </div>
          </PremiumCard>
        </div>

        {/* Suggestions */}
        <div className="lg:col-span-4 flex flex-col gap-6">
          <PremiumCard className="p-6">
            <h3 className="text-sm font-bold text-[var(--text-primary)] uppercase tracking-wider mb-4 flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-[var(--accent-primary)]" /> Suggested Queries
            </h3>
            <div className="space-y-3">
              {suggestedQueries.map((q, idx) => (
                <button key={idx} className="w-full text-left p-3 rounded-xl bg-[var(--bg-app)] border border-[var(--border-subtle)] hover:border-[var(--accent-primary)] transition-colors group">
                  <div className="flex items-start gap-3">
                    <q.icon className="w-4 h-4 text-[var(--text-tertiary)] group-hover:text-[var(--accent-primary)] mt-0.5 flex-shrink-0" />
                    <span className="text-sm text-[var(--text-secondary)] group-hover:text-[var(--text-primary)]">{q.text}</span>
                  </div>
                </button>
              ))}
            </div>
          </PremiumCard>

          <PremiumCard className="p-6">
            <h3 className="text-sm font-bold text-[var(--text-primary)] uppercase tracking-wider mb-4">AI Capabilities</h3>
            <div className="space-y-3">
              {[
                "Natural language querying of election data",
                "Constituency-level deep dive analysis",
                "Vote share and swing pattern detection",
                "Demographic correlation analysis",
                "Historical trend comparison",
                "Alliance impact simulation",
              ].map((cap, idx) => (
                <div key={idx} className="flex items-start gap-2 text-sm text-[var(--text-secondary)]">
                  <span className="text-emerald-500 mt-0.5">✓</span>
                  {cap}
                </div>
              ))}
            </div>
          </PremiumCard>
        </div>
      </div>
    </div>
  );
}
