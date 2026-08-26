import React from "react";
import { ChevronRight } from "lucide-react";
import Link from "next/link";

interface PageHeaderProps {
  title: string;
  description: string;
  breadcrumbs: { label: string; href?: string }[];
  action?: React.ReactNode;
}

export function PageHeader({ title, description, breadcrumbs, action }: PageHeaderProps) {
  return (
    <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 mb-6">
      <div>
        <nav className="flex items-center gap-1.5 text-xs font-medium text-[var(--text-tertiary)] mb-2">
          {breadcrumbs.map((crumb, idx) => (
            <React.Fragment key={crumb.label}>
              {idx > 0 && <ChevronRight className="w-3 h-3" />}
              {crumb.href ? (
                <Link href={crumb.href} className="hover:text-[var(--text-primary)] transition-colors">
                  {crumb.label}
                </Link>
              ) : (
                <span className="text-[var(--text-secondary)]">{crumb.label}</span>
              )}
            </React.Fragment>
          ))}
        </nav>
        <h1 className="text-3xl font-serif font-bold text-[var(--text-primary)]">
          {title}
        </h1>
        <p className="text-sm text-[var(--text-secondary)] mt-1.5">
          {description}
        </p>
      </div>
      {action && (
        <div className="flex items-center gap-3">
          {action}
        </div>
      )}
    </div>
  );
}
