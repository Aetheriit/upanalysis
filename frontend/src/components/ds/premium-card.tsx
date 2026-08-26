import React from "react";
import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

interface PremiumCardProps extends React.HTMLAttributes<HTMLDivElement> {
  children: React.ReactNode;
  padding?: "none" | "sm" | "md" | "lg";
  glass?: boolean;
}

export function PremiumCard({ 
  children, 
  className, 
  padding = "md",
  glass = false,
  ...props 
}: PremiumCardProps) {
  return (
    <div
      className={cn(
        "rounded-2xl transition-all duration-300",
        glass ? "glassmorphism" : "claymorphism",
        {
          "p-0": padding === "none",
          "p-3": padding === "sm",
          "p-5": padding === "md",
          "p-8": padding === "lg",
        },
        className
      )}
      {...props}
    >
      {children}
    </div>
  );
}
