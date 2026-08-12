"use client";

import dynamic from "next/dynamic";
import { useCallback, useMemo, useState } from "react";
import AircraftPanel from "@/components/AircraftPanel";
import DataSources from "@/components/DataSources";
import StatusLegend from "@/components/StatusLegend";
import TopBar from "@/components/TopBar";
import type { MapViewport } from "@/components/MapView";
import { useLiveFeed } from "@/hooks/useLiveFeed";
import type {
  CompanySummary,
  DataStatus,
  FilterKey,
  LiveAircraft,
  SearchHit,
  SelectedRoute,
} from "@/lib/types";

// MapLibre touches `window` at import time, so the map is client-only.
const MapView = dynamic(() => import("@/components/MapView"), {
  ssr: false,
  loading: () => (
    <div className="flex h-full w-full items-center justify-center bg-ground">
      <div className="flex items-center gap-3 text-xs tracking-[0.16em] text-ink-3">
        <span className="h-3 w-3 animate-spin rounded-full border border-edge-2 border-t-cyan" />
        INITIALISING MAP
      </div>
    </div>
  ),
});

interface Selection {
  icao24: string | null;
  registration: string | null;
}

/** Company whose fleet the map is pinned to, if any. */
interface CompanyFilter {
  slug: string;
  name: string;
  registrations: Set<string>;
}

export default function TrackerApp() {
  const [viewport, setViewport] = useState<MapViewport | null>(null);
  const [filters, setFilters] = useState<FilterKey[]>(["business"]);
  const [selection, setSelection] = useState<Selection | null>(null);
  const [route, setRoute] = useState<SelectedRoute | null>(null);
  const [company, setCompany] = useState<CompanyFilter | null>(null);
  const [focus, setFocus] = useState<{ lat: number; lon: number; zoom?: number; key: number } | null>(
    null,
  );

  const [statusFilter, setStatusFilter] = useState<DataStatus | null>(null);

  const feed = useLiveFeed(viewport, filters);
  const allAircraft = useMemo(() => feed.data?.aircraft ?? [], [feed.data]);

  // Counts for the legend, taken from everything in view before the status
  // filter narrows it — otherwise selecting a status would zero the others and
  // the legend would stop being a summary.
  const statusCounts = useMemo(() => {
    const counts: Partial<Record<DataStatus, number>> = {};
    for (const a of allAircraft) {
      const key = a.dataStatus ?? "UNKNOWN";
      counts[key] = (counts[key] ?? 0) + 1;
    }
    return counts;
  }, [allAircraft]);

  // Company mode narrows the map to one fleet. Filtering happens here rather
  // than server-side so the live feed keeps streaming everything and toggling
  // the filter is instant.
  const aircraft = useMemo(() => {
    let list = allAircraft;
    if (company) {
      list = list.filter(
        (a) => a.registration && company.registrations.has(a.registration.toUpperCase()),
      );
    }
    if (statusFilter) {
      list = list.filter((a) => (a.dataStatus ?? "UNKNOWN") === statusFilter);
    }
    return list;
  }, [allAircraft, company, statusFilter]);

  const selectedLive = useMemo(() => {
    if (!selection) return null;
    return (
      aircraft.find(
        (a) =>
          (selection.icao24 && a.icao24 === selection.icao24) ||
          (selection.registration && a.registration === selection.registration),
      ) ?? null
    );
  }, [aircraft, selection]);

  const handleSelect = useCallback((a: LiveAircraft) => {
    setSelection({ icao24: a.icao24, registration: a.registration });
  }, []);

  const handleSearchSelect = useCallback((hit: SearchHit) => {
    setSelection({ icao24: hit.icao24, registration: hit.registration });
    if (hit.lat !== null && hit.lon !== null) {
      setFocus({ lat: hit.lat, lon: hit.lon, zoom: 9, key: Date.now() });
    }
  }, []);

  const handleLocate = useCallback((lat: number, lon: number) => {
    setFocus({ lat, lon, zoom: 10, key: Date.now() });
  }, []);

  /** "Show all company aircraft" — pin the map to one operator's fleet. */
  const handleCompanySelect = useCallback(async (summary: CompanySummary) => {
    try {
      const response = await fetch(`/api/company/${encodeURIComponent(summary.slug)}/fleet`);
      if (!response.ok) return;
      const body = (await response.json()) as { registrations: string[] };
      setCompany({
        slug: summary.slug,
        name: summary.name,
        registrations: new Set(body.registrations.map((r) => r.toUpperCase())),
      });
      setSelection(null);
    } catch {
      /* leave the map as it is */
    }
  }, []);

  return (
    <main className="flex h-dvh w-full flex-col overflow-hidden bg-ground">
      <TopBar
        count={aircraft.length}
        totalObserved={feed.data?.totalObserved ?? 0}
        updatedAt={feed.data?.updatedAt ?? null}
        connected={feed.connected}
        simulated={feed.data?.simulated ?? false}
        notice={feed.data?.notice ?? null}
        stale={feed.data?.stale ?? false}
        transport={feed.transport}
        filters={filters}
        onFiltersChange={setFilters}
        onSearchSelect={handleSearchSelect}
        onCompanySelect={handleCompanySelect}
        searchViewport={viewport}
      />

      <div className="relative flex-1 overflow-hidden">
        <MapView
          aircraft={aircraft}
          selectedIcao={selectedLive?.icao24 ?? selection?.icao24 ?? null}
          onSelect={handleSelect}
          onViewportChange={setViewport}
          focus={focus}
          route={route}
        />

        {company && (
          <div className="absolute left-1/2 top-4 z-20 flex -translate-x-1/2 items-center gap-3 rounded-sm border border-cyan/40 bg-panel/95 px-3 py-2 backdrop-blur-md">
            <span className="text-[11px] uppercase tracking-[0.14em] text-cyan">
              {company.name}
            </span>
            <span className="tabular text-[11px] text-ink-2">
              {aircraft.length} of {company.registrations.size} in view
            </span>
            <a
              href={`/company/${company.slug}`}
              className="text-[10px] uppercase tracking-[0.12em] text-ink-3 underline-offset-2 hover:text-cyan hover:underline"
            >
              Company page
            </a>
            <button
              type="button"
              onClick={() => setCompany(null)}
              className="rounded-sm border border-edge px-1.5 py-0.5 text-[10px] uppercase tracking-[0.12em] text-ink-3 transition-colors hover:border-edge-2 hover:text-ink"
            >
              Clear
            </button>
          </div>
        )}

        {/* Partial coverage: the view is wider than what was fetched. Said
            plainly, because an empty edge otherwise reads as empty sky. */}
        {!feed.error &&
          feed.data?.coveredRadiusNm != null &&
          feed.data.viewportRadiusNm != null &&
          feed.data.coveredRadiusNm < feed.data.viewportRadiusNm * 0.95 && (
            <div className="pointer-events-none absolute bottom-6 left-1/2 z-10 -translate-x-1/2 rounded-sm border border-edge bg-panel/90 px-3 py-1.5 text-[10px] text-ink-3 backdrop-blur-md">
              Showing the central {feed.data.coveredRadiusNm} NM of this view — zoom in for full
              coverage.
            </div>
          )}

        {/* A rate limit with data on screen is a notice, not a failure: the map
            is still usable, so it must not be covered by a red box. */}
        {feed.error && aircraft.length > 0 && (
          <div className="absolute left-1/2 top-4 z-20 w-[min(92vw,560px)] -translate-x-1/2 rounded-sm border border-amber/40 bg-amber/10 px-3 py-2 text-[11px] leading-relaxed text-amber backdrop-blur-md">
            {feed.error}
          </div>
        )}

        {feed.error && aircraft.length === 0 && (
          <div className="absolute left-1/2 top-6 z-20 w-[min(92vw,560px)] -translate-x-1/2 rounded-sm border border-rose/40 bg-rose/12 px-4 py-3 backdrop-blur-md">
            <div className="text-[12px] font-semibold text-rose">{feed.error}</div>
            {feed.errorDetail && (
              <div className="mt-1 text-[11px] leading-relaxed text-rose/80">{feed.errorDetail}</div>
            )}
            <button
              type="button"
              onClick={feed.refresh}
              className="mt-2 rounded-sm border border-rose/40 px-2 py-1 text-[10px] uppercase tracking-[0.12em] text-rose transition-colors hover:bg-rose/15"
            >
              Retry
            </button>
          </div>
        )}

        {!feed.error && feed.data && aircraft.length === 0 && (
          <div className="pointer-events-none absolute left-1/2 top-6 z-10 -translate-x-1/2 rounded-sm border border-edge bg-panel/90 px-4 py-2 text-[11px] text-ink-3 backdrop-blur-md">
            {company
              ? `No ${company.name} aircraft are currently airborne in this view.`
              : "No private or business aircraft in view — pan the map or widen the filters."}
          </div>
        )}

        {/* Legend and data sources share the bottom-left stack: both answer
            "can I trust what I am looking at", and keeping them together
            leaves the rest of the map clear. */}
        <div className="pointer-events-none absolute left-4 z-20 flex flex-col items-start gap-1.5 inset-bottom-safe">
          <StatusLegend counts={statusCounts} onFilter={setStatusFilter} active={statusFilter} />
          <DataSources
          providers={feed.data?.providers ?? []}
          servedBy={feed.data?.servedBy}
          degraded={feed.data?.degraded}
          updatedAt={feed.data?.updatedAt ?? null}
          aircraftCount={aircraft.length}
          degradedIdentityCount={feed.data?.degradedIdentityCount}
            lastKnownCount={feed.data?.lastKnownCount}
            positionSources={feed.data?.positionSources}
          />
        </div>

        {selection && (
          <AircraftPanel
            live={selectedLive}
            registration={selection.registration}
            onClose={() => {
              setSelection(null);
              setRoute(null);
            }}
            onLocate={handleLocate}
            onRouteChange={setRoute}
          />
        )}

        {selection && !selection.registration && (
          <div className="pointer-events-none absolute bottom-6 left-1/2 z-20 -translate-x-1/2 rounded-sm border border-amber/40 bg-amber/10 px-3 py-2 text-[11px] text-amber">
            This contact transmits no registration, so ownership cannot be researched.
          </div>
        )}
      </div>
    </main>
  );
}
