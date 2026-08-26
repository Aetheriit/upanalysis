"use client";

import React, { useState, useEffect, useRef } from "react";
import { useTheme } from "next-themes";
import { Search, Bell, MessageSquare, Sun, Moon, MapPin, User, LayoutGrid } from "lucide-react";
import Link from "next/link";
import { useElectionContext } from "@/context/ElectionContext";

export function TopNavigation() {
  const { theme, setTheme } = useTheme();
  
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [showDropdown, setShowDropdown] = useState(false);
  
  const { viewMode, setViewMode } = useElectionContext();
  
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Handle click outside to close dropdown
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setShowDropdown(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // Debounced search
  useEffect(() => {
    if (query.trim().length < 2) {
      setResults(null);
      return;
    }

    const timer = setTimeout(async () => {
      setLoading(true);
      try {
        const res = await fetch(`http://localhost:8000/api/v1/search?q=${encodeURIComponent(query.trim())}`);
        if (res.ok) {
          const data = await res.json();
          setResults(data);
          setShowDropdown(true);
        }
      } catch (err) {
        console.error("Search failed", err);
      } finally {
        setLoading(false);
      }
    }, 300);

    return () => clearTimeout(timer);
  }, [query]);

  return (
    <header className="fixed top-0 right-0 left-[260px] h-[72px] bg-[var(--bg-surface)]/80 backdrop-blur-xl border-b border-[var(--border-subtle)] z-40 transition-all duration-300 flex items-center justify-between px-6">
      
      {/* Search Bar */}
      <div className="relative w-[480px]" ref={dropdownRef}>
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--text-tertiary)]" />
        <input 
          type="text" 
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            setShowDropdown(true);
          }}
          onFocus={() => {
            if (query.trim().length >= 2) setShowDropdown(true);
          }}
          placeholder="Search constituencies, districts, candidates..." 
          className="w-full pl-9 pr-12 py-2.5 bg-[var(--bg-app)] border border-[var(--border-subtle)] rounded-full text-sm focus:outline-none focus:ring-2 focus:ring-[var(--accent-primary)] text-[var(--text-primary)] transition-shadow"
        />
        <div className="absolute right-3 top-1/2 -translate-y-1/2 flex items-center gap-1">
          {loading ? (
             <div className="w-4 h-4 border-2 border-[var(--text-tertiary)] border-t-[var(--accent-primary)] rounded-full animate-spin" />
          ) : (
            <>
              <kbd className="px-1.5 py-0.5 text-[10px] font-sans font-medium text-[var(--text-tertiary)] bg-[var(--bg-surface)] border border-[var(--border-subtle)] rounded shadow-sm">⌘</kbd>
              <kbd className="px-1.5 py-0.5 text-[10px] font-sans font-medium text-[var(--text-tertiary)] bg-[var(--bg-surface)] border border-[var(--border-subtle)] rounded shadow-sm">K</kbd>
            </>
          )}
        </div>
        
        {/* Search Results Dropdown */}
        {showDropdown && results && (
          <div className="absolute top-full mt-2 left-0 w-full bg-[var(--bg-surface)] border border-[var(--border-subtle)] rounded-xl shadow-xl overflow-hidden z-50 max-h-[400px] overflow-y-auto">
            {results.districts?.length > 0 && (
              <div className="p-2">
                <div className="text-xs font-semibold text-[var(--text-tertiary)] uppercase tracking-wider px-3 py-2">Districts</div>
                {results.districts.map((d: any, i: number) => (
                  <Link href={`/workspace/districts?name=${d.name}`} key={i} onClick={() => setShowDropdown(false)} className="flex items-center gap-3 px-3 py-2 hover:bg-[var(--bg-app)] rounded-lg cursor-pointer">
                    <LayoutGrid className="w-4 h-4 text-[var(--text-secondary)]" />
                    <span className="text-sm text-[var(--text-primary)] font-medium">{d.name}</span>
                  </Link>
                ))}
              </div>
            )}
            
            {results.constituencies?.length > 0 && (
              <div className="p-2 border-t border-[var(--border-subtle)]">
                <div className="text-xs font-semibold text-[var(--text-tertiary)] uppercase tracking-wider px-3 py-2">Constituencies</div>
                {results.constituencies.map((c: any, i: number) => (
                  <Link href={`/workspace/constituencies?id=${c.id}`} key={i} onClick={() => setShowDropdown(false)} className="flex items-center justify-between px-3 py-2 hover:bg-[var(--bg-app)] rounded-lg cursor-pointer">
                    <div className="flex items-center gap-3">
                      <MapPin className="w-4 h-4 text-[var(--accent-primary)]" />
                      <div>
                        <div className="text-sm text-[var(--text-primary)] font-medium">{c.name}</div>
                        <div className="text-xs text-[var(--text-secondary)]">{c.district} District</div>
                      </div>
                    </div>
                  </Link>
                ))}
              </div>
            )}
            
            {results.candidates?.length > 0 && (
              <div className="p-2 border-t border-[var(--border-subtle)]">
                <div className="text-xs font-semibold text-[var(--text-tertiary)] uppercase tracking-wider px-3 py-2">Candidates</div>
                {results.candidates.map((c: any, i: number) => (
                  <Link href={`/workspace/candidates?id=${c.id}`} key={i} onClick={() => setShowDropdown(false)} className="flex items-center gap-3 px-3 py-2 hover:bg-[var(--bg-app)] rounded-lg cursor-pointer">
                    <User className="w-4 h-4 text-[#F97316]" />
                    <span className="text-sm text-[var(--text-primary)] font-medium">{c.name}</span>
                  </Link>
                ))}
              </div>
            )}
            
            {results.districts?.length === 0 && results.constituencies?.length === 0 && results.candidates?.length === 0 && (
              <div className="p-8 text-center text-[var(--text-secondary)] text-sm">
                No results found for "{query}"
              </div>
            )}
          </div>
        )}
      </div>

      {/* Right Actions */}
      <div className="flex items-center gap-4">
        {/* Global Context Selector */}
        <select 
          value={viewMode} 
          onChange={(e) => setViewMode(e.target.value as any)} 
          className="hidden md:block px-3 py-1.5 bg-[var(--bg-surface)] border border-[var(--border-subtle)] rounded-lg text-sm font-medium text-[var(--text-primary)]"
        >
          <option value="Comparison (17 vs 22)">Comparison (17 vs 22)</option>
          <option value="2022 Only">2022 Only</option>
          <option value="2017 Only">2017 Only</option>
        </select>
        
        <div className="hidden md:block h-6 w-px bg-[var(--border-subtle)] mx-1" />

        {/* Status */}
        <div className="hidden md:flex items-center gap-2 text-xs font-medium text-[var(--text-secondary)] mr-4">
          <span>Last Updated: Today, 10:24 AM</span>
          <span className="flex items-center gap-1.5 px-2 py-1 bg-green-500/10 text-green-600 rounded-full border border-green-500/20">
            <span className="w-1.5 h-1.5 bg-green-500 rounded-full animate-pulse" />
            Live
          </span>
        </div>

        {/* Action Icons */}
        <div className="flex items-center gap-2">
          <button className="p-2 text-[var(--text-secondary)] hover:bg-[var(--border-subtle)] rounded-full relative transition-colors">
            <Bell className="w-5 h-5" />
            <span className="absolute top-1 right-1 w-2 h-2 bg-red-500 rounded-full border border-[var(--bg-surface)]" />
          </button>
          <button className="p-2 text-[var(--text-secondary)] hover:bg-[var(--border-subtle)] rounded-full transition-colors">
            <MessageSquare className="w-5 h-5" />
          </button>
          <button 
            onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
            className="p-2 text-[var(--text-secondary)] hover:bg-[var(--border-subtle)] rounded-full transition-colors"
          >
            {theme === "dark" ? <Sun className="w-5 h-5" /> : <Moon className="w-5 h-5" />}
          </button>
        </div>

        <div className="h-6 w-px bg-[var(--border-subtle)] mx-2" />

        {/* Profile */}
        <button className="flex items-center gap-3 p-1.5 pr-3 hover:bg-[var(--border-subtle)] rounded-full transition-colors">
          <div className="w-8 h-8 rounded-full bg-[#E5C365]/20 text-[#C5A028] flex items-center justify-center font-bold text-sm">
            SK
          </div>
          <div className="text-left hidden lg:block">
            <p className="text-sm font-semibold text-[var(--text-primary)] leading-tight">Shivam Kumar</p>
            <p className="text-xs text-[var(--text-tertiary)]">Analyst</p>
          </div>
        </button>
      </div>

    </header>
  );
}
