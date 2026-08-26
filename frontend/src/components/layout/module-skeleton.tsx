import React from "react";
import { PremiumCard } from "@/components/ds/premium-card";
import { Construction, Loader2 } from "lucide-react";

export function ModuleSkeleton({ title }: { title: string }) {
  return (
    <div className="flex flex-col items-center justify-center py-20 px-4">
      <PremiumCard className="max-w-md w-full text-center flex flex-col items-center p-10">
        <div className="w-16 h-16 bg-[var(--accent-primary)]/10 text-[var(--accent-primary)] rounded-full flex items-center justify-center mb-6 relative">
          <Construction className="w-8 h-8" />
          <Loader2 className="w-4 h-4 absolute -bottom-1 -right-1 animate-spin text-[var(--text-secondary)]" />
        </div>
        <h2 className="text-xl font-serif font-bold text-[var(--text-primary)] mb-2">
          {title} Module
        </h2>
        <p className="text-sm text-[var(--text-secondary)] leading-relaxed">
          This intelligence module is currently being provisioned. Data pipelines and visualizations are spinning up.
        </p>
      </PremiumCard>
    </div>
  );
}
