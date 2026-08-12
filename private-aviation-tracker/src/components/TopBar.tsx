"use client";

import { useEffect, useState } from "react";
import FilterBar from "@/components/FilterBar";
import SearchBar from "@/components/SearchBar";
import { formatRelative } from "@/lib/format";
import type { AirportHit, CompanySummary, FilterKey, SearchHit } from "@/lib/types";

interface TopBarProps {
  count: number;
  totalObserved: number;
  updatedAt: number | null;
  connected: boolean;
  simulated: boolean;
  /** Data is real but not from the selected provider (open-feed fallback). */
  notice?: string | null;
  stale: boolean;
  transport: "stream" | "poll" | "idle";
  filters: FilterKey[];
  onFiltersChange: (filters: FilterKey[]) => void;
  onSearchSelect: (hit: SearchHit) => void;
  onCompanySelect?: (company: CompanySummary) => void;
  onAirportSelect?: (airport: AirportHit) => void;
  searchViewport?: { lat: number; lon: number; radiusNm: number } | null;
}

export default function TopBar({
  count,
  totalObserved,
  updatedAt,
  connected,
  simulated,
  notice,
  stale,
  transport,
  filters,
  onFiltersChange,
  onSearchSelect,
  onCompanySelect,
  onAirportSelect,
  searchViewport,
}: TopBarProps) {
  const [showFilters, setShowFilters] = useState(false);
  const [, forceTick] = useState(0);

  // Keep the "updated Xs ago" readout honest between pushes.
  useEffect(() => {
    const timer = setInterval(() => forceTick((t) => t + 1), 1000);
    return () => clearInterval(timer);
  }, []);

  const live = connected && !stale;

  return (
    <header className="pad-top-safe relative z-30 shrink-0 border-b border-edge bg-ground/92 backdrop-blur-md">
      <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 px-3 py-2 sm:px-4 sm:py-2.5">
        <div className="flex items-center gap-2.5">
          <svg viewBox="0 0 24 24" className="h-5 w-5 text-cyan" aria-hidden>
            <path
              d="M12 2l1.8 6.4L22 12v1.6l-8.2-2.4L13 18l2.6 1.9V22L12 20.6 8.4 22v-2.1L11 18l-.8-6.8L2 13.6V12l8.2-3.6z"
              fill="currentColor"
            />
          </svg>
          <div className="leading-none">
            <div className="text-[12px] font-semibold tracking-[0.14em] text-ink sm:text-[13px] sm:tracking-[0.16em]">
              <span className="sm:hidden">PRIVATE AVIATION</span>
              <span className="hidden sm:inline">PRIVATE AVIATION TRACKER</span>
            </div>
            <div className="mt-0.5 hidden text-[10px] tracking-[0.14em] text-ink-3 sm:block">
              ADS-B · REGISTRY · OWNERSHIP INTELLIGENCE
            </div>
          </div>
        </div>

        {/* Below lg (which includes iPad portrait at 820px) the search takes its
            own full-width row — inline it gets squeezed to a few characters. */}
        <div className="order-3 w-full lg:order-none lg:w-auto lg:flex-1">
          <SearchBar
            onSelect={onSearchSelect}
            onCompanySelect={onCompanySelect}
            onAirportSelect={onAirportSelect}
            viewport={searchViewport}
          />
        </div>

        <button
          type="button"
          onClick={() => setShowFilters((value) => !value)}
          aria-expanded={showFilters}
          className={`flex items-center gap-2 rounded-sm border px-3 py-1.5 text-[11px] font-medium transition-colors ${
            showFilters
              ? "border-cyan/60 bg-cyan/10 text-cyan"
              : "border-edge bg-panel-2 text-ink-2 hover:text-ink"
          }`}
        >
          <svg viewBox="0 0 16 16" className="h-3 w-3" aria-hidden>
            <path
              d="M2 4h12M4.5 8h7M7 12h2"
              stroke="currentColor"
              strokeWidth="1.5"
              strokeLinecap="round"
            />
          </svg>
          Filters
          <span className="tabular rounded-sm bg-panel-3 px-1.5 text-[10px] text-ink-2">
            {filters.includes("all") ? "ALL" : filters.length}
          </span>
        </button>

        <div className="flex items-center gap-4">
          <div className="text-right">
            <div className="flex items-center justify-end gap-1.5">
              <span
                className={`h-1.5 w-1.5 rounded-full ${
                  live ? "live-dot bg-lime" : stale ? "bg-amber" : "bg-rose"
                }`}
              />
              <span
                className={`text-[10px] font-semibold tracking-[0.18em] ${
                  live ? "text-lime" : stale ? "text-amber" : "text-rose"
                }`}
              >
                {live ? "LIVE" : stale ? "STALE" : "OFFLINE"}
              </span>
            </div>
            <div className="tabular text-[10px] text-ink-3">
              {updatedAt ? formatRelative(updatedAt) : "awaiting data"}
              {transport === "poll" && live ? " · polling" : ""}
            </div>
          </div>

          <div className="border-l border-edge pl-4 text-right">
            <div className="tabular text-lg font-semibold leading-none text-ink">
              {count.toLocaleString("en-US")}
            </div>
            <div className="text-[10px] tracking-[0.14em] text-ink-3">
              {filters.includes("all") ? "AIRCRAFT" : "PRIVATE AIRCRAFT"}
              {totalObserved > count ? ` · ${totalObserved.toLocaleString("en-US")} SEEN` : ""}
            </div>
          </div>
        </div>
      </div>

      {showFilters && (
        <div className="border-t border-edge bg-panel/60 px-4 py-2.5">
          <FilterBar filters={filters} onChange={onFiltersChange} />
          <p className="mt-2 text-[10px] leading-relaxed text-ink-3">
            Commercial airline traffic and light general aviation are excluded unless “All
            aircraft” is selected. Classification is based on ICAO type designator, operator
            callsign and feed flags — it is a best-effort filter, not an authoritative one.
          </p>
        </div>
      )}

      {simulated && (
        <div className="border-t border-amber/40 bg-amber/15 px-4 py-1.5 text-center text-[11px] font-semibold tracking-[0.14em] text-amber">
          SIMULATED DATA — ADSB_PROVIDER=demo. These aircraft are not real.
        </div>
      )}

      {!simulated && notice && (
        <div className="border-t border-edge bg-panel/70 px-4 py-1.5 text-center text-[11px] leading-relaxed text-ink-3">
          {notice}
        </div>
      )}
    </header>
  );
}
