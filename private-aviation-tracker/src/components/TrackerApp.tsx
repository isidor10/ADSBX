"use client";

import dynamic from "next/dynamic";
import { useCallback, useMemo, useState } from "react";
import AircraftPanel from "@/components/AircraftPanel";
import TopBar from "@/components/TopBar";
import type { MapViewport } from "@/components/MapView";
import { useLiveFeed } from "@/hooks/useLiveFeed";
import type { FilterKey, LiveAircraft, SearchHit } from "@/lib/types";

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

export default function TrackerApp() {
  const [viewport, setViewport] = useState<MapViewport | null>(null);
  const [filters, setFilters] = useState<FilterKey[]>(["business"]);
  const [selection, setSelection] = useState<Selection | null>(null);
  const [focus, setFocus] = useState<{ lat: number; lon: number; zoom?: number; key: number } | null>(
    null,
  );

  const feed = useLiveFeed(viewport, filters);
  const aircraft = useMemo(() => feed.data?.aircraft ?? [], [feed.data]);

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

  return (
    <main className="flex h-dvh w-full flex-col overflow-hidden bg-ground">
      <TopBar
        count={aircraft.length}
        totalObserved={feed.data?.totalObserved ?? 0}
        updatedAt={feed.data?.updatedAt ?? null}
        connected={feed.connected}
        simulated={feed.data?.simulated ?? false}
        stale={feed.data?.stale ?? false}
        transport={feed.transport}
        filters={filters}
        onFiltersChange={setFilters}
        onSearchSelect={handleSearchSelect}
      />

      <div className="relative flex-1 overflow-hidden">
        <MapView
          aircraft={aircraft}
          selectedIcao={selectedLive?.icao24 ?? selection?.icao24 ?? null}
          onSelect={handleSelect}
          onViewportChange={setViewport}
          focus={focus}
        />

        {feed.error && (
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
            No private or business aircraft in view — pan the map or widen the filters.
          </div>
        )}

        {selection && (
          <AircraftPanel
            live={selectedLive}
            registration={selection.registration}
            onClose={() => setSelection(null)}
            onLocate={handleLocate}
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
