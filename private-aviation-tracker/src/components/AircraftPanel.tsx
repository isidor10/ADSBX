"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import {
  CurrentFlightSection,
  LastLandingSection,
  NextTripSection,
} from "@/components/CurrentFlight";
import FlightHistory from "@/components/FlightHistory";
import OwnerIntelligence from "@/components/OwnerIntelligence";
import CostEstimateSection from "@/components/CostEstimate";
import CostedHistorySection from "@/components/CostedHistory";
import RegistrySection from "@/components/RegistrySection";
import PhotoGallery from "@/components/PhotoGallery";
import WebNews from "@/components/WebNews";
import { CategoryBadge, Divider, EmptyNote, Field, SectionTitle } from "@/components/ui";
import {
  flightStatusLabel,
  formatAltitude,
  formatCoordinate,
  formatHeading,
  formatRelative,
  formatSpeed,
  formatVerticalRate,
} from "@/lib/format";
import type {
  AircraftDetail,
  AircraftHistory,
  AircraftPhoto,
  CurrentFlight,
  LandingSummary,
  LiveAircraft,
  NextTrip,
  OwnershipResult,
  ResearchReport,
  SelectedRoute,
} from "@/lib/types";

/**
 * Slide-in detail panel.
 *
 * The live contact renders immediately from the map data; identity, ownership
 * and history load in parallel behind it so the ownership research never
 * blocks the rest of the panel.
 */
export default function AircraftPanel({
  live,
  registration,
  onClose,
  onLocate,
  onRouteChange,
}: {
  live: LiveAircraft | null;
  registration: string | null;
  onClose: () => void;
  onLocate: (lat: number, lon: number) => void;
  /** Hands the route geometry up so the map can draw it. */
  onRouteChange?: (route: SelectedRoute | null) => void;
}) {
  const [detail, setDetail] = useState<AircraftDetail | null>(null);
  const [ownership, setOwnership] = useState<OwnershipResult | null>(null);
  const [history, setHistory] = useState<AircraftHistory | null>(null);
  const [flight, setFlight] = useState<CurrentFlight | null>(null);
  const [lastLanding, setLastLanding] = useState<LandingSummary | null>(null);
  const [nextTrip, setNextTrip] = useState<NextTrip | null>(null);
  const [photos, setPhotos] = useState<AircraftPhoto[]>([]);
  const [photoNote, setPhotoNote] = useState<string | null>(null);
  const [research, setResearch] = useState<ResearchReport | null>(null);
  const [windowMinutes, setWindowMinutes] = useState(120);
  const [loadingDetail, setLoadingDetail] = useState(false);
  const [loadingOwnership, setLoadingOwnership] = useState(false);
  const [loadingHistory, setLoadingHistory] = useState(false);
  const [loadingFlight, setLoadingFlight] = useState(false);
  const [loadingPhotos, setLoadingPhotos] = useState(false);
  const [loadingResearch, setLoadingResearch] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const routeCallback = useRef(onRouteChange);
  routeCallback.current = onRouteChange;

  // ---- route + flight: reloaded when the track window changes -------------
  useEffect(() => {
    if (!registration) {
      setFlight(null);
      setLastLanding(null);
      setNextTrip(null);
      routeCallback.current?.(null);
      return;
    }

    const controller = new AbortController();
    setLoadingFlight(true);

    void (async () => {
      try {
        const response = await fetch(
          `/api/aircraft/${encodeURIComponent(registration)}/flight?minutes=${windowMinutes}`,
          { signal: controller.signal },
        );
        if (!response.ok) return;
        const body = (await response.json()) as {
          current: CurrentFlight;
          route: SelectedRoute | null;
          lastLanding: LandingSummary | null;
          nextTrip: NextTrip;
        };
        setFlight(body.current);
        setLastLanding(body.lastLanding);
        setNextTrip(body.nextTrip);
        routeCallback.current?.(body.route);
      } catch {
        /* the section renders its own empty state */
      } finally {
        setLoadingFlight(false);
      }
    })();

    return () => controller.abort();
  }, [registration, windowMinutes]);

  // Clear the map route when the panel closes.
  useEffect(() => () => routeCallback.current?.(null), []);

  useEffect(() => {
    setDetail(null);
    setOwnership(null);
    setHistory(null);
    setPhotos([]);
    setPhotoNote(null);
    setResearch(null);
    setError(null);
    if (!registration) return;

    const controller = new AbortController();
    const reg = encodeURIComponent(registration);

    setLoadingDetail(true);
    setLoadingOwnership(true);
    setLoadingHistory(true);

    void (async () => {
      try {
        const response = await fetch(`/api/aircraft/${reg}`, { signal: controller.signal });
        if (response.ok) setDetail(await response.json());
        else if (response.status !== 404) setError("Aircraft information temporarily unavailable.");
      } catch (err) {
        if ((err as Error).name !== "AbortError") setError("Aircraft information temporarily unavailable.");
      } finally {
        setLoadingDetail(false);
      }
    })();

    // Ownership research starts automatically — the user never has to search.
    void (async () => {
      try {
        const response = await fetch(`/api/aircraft/${reg}/ownership`, { signal: controller.signal });
        if (response.ok) setOwnership(await response.json());
      } catch {
        /* handled by the panel's empty state */
      } finally {
        setLoadingOwnership(false);
      }
    })();

    void (async () => {
      try {
        const response = await fetch(`/api/aircraft/${reg}/history`, { signal: controller.signal });
        if (response.ok) setHistory(await response.json());
      } catch {
        /* handled by the panel's empty state */
      } finally {
        setLoadingHistory(false);
      }
    })();

    // Photographs and web coverage: both hit external services, so they load
    // independently and neither can hold up the rest of the panel.
    setLoadingPhotos(true);
    void (async () => {
      try {
        const response = await fetch(`/api/aircraft/${reg}/photos`, { signal: controller.signal });
        if (response.ok) {
          const body = (await response.json()) as { photos: AircraftPhoto[]; note: string | null };
          setPhotos(body.photos);
          setPhotoNote(body.note);
        }
      } catch {
        /* the gallery renders its own empty state */
      } finally {
        setLoadingPhotos(false);
      }
    })();

    setLoadingResearch(true);
    void (async () => {
      try {
        const response = await fetch(`/api/aircraft/${reg}/research`, { signal: controller.signal });
        if (response.ok) setResearch(await response.json());
      } catch {
        /* the section renders its own empty state */
      } finally {
        setLoadingResearch(false);
      }
    })();

    return () => controller.abort();
  }, [registration]);

  const refreshOwnership = useCallback(async () => {
    if (!registration) return;
    setRefreshing(true);
    try {
      const response = await fetch(
        `/api/aircraft/${encodeURIComponent(registration)}/ownership/refresh`,
        { method: "POST" },
      );
      if (response.ok) setOwnership(await response.json());
    } catch {
      /* leave the previous result on screen */
    } finally {
      setRefreshing(false);
    }
  }, [registration]);

  const identity = detail?.identity ?? null;
  const position = live ?? null;
  const title =
    registration ?? live?.registration ?? live?.callsign ?? live?.icao24.toUpperCase() ?? "Aircraft";
  const category = live?.category ?? identity?.category ?? "unknown";

  return (
    <aside className="animate-panel-in panel-scroll pointer-events-auto absolute right-0 top-0 z-20 flex h-full w-full max-w-full flex-col overflow-y-auto border-l border-edge bg-panel/95 backdrop-blur-md sm:w-[420px]">
      <div className="sticky top-0 z-10 border-b border-edge bg-panel/95 px-4 py-3 backdrop-blur-md">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="tabular truncate text-xl font-semibold leading-tight text-ink">
              {title}
            </div>
            <div className="mt-1 truncate text-[12px] text-ink-2">
              {[identity?.manufacturer ?? live?.manufacturer, identity?.model ?? live?.model]
                .filter(Boolean)
                .join(" ") || "Type not identified"}
              {live?.typeCode ? ` · ${live.typeCode}` : ""}
            </div>
            <div className="mt-2 flex flex-wrap items-center gap-1.5">
              <CategoryBadge category={category} />
              {live?.isBlocked && (
                <span className="rounded-sm border border-amber/40 bg-amber/10 px-2 py-0.5 text-[10px] uppercase tracking-[0.12em] text-amber">
                  privacy programme
                </span>
              )}
              {live?.emergency && (
                <span className="rounded-sm border border-rose/50 bg-rose/15 px-2 py-0.5 text-[10px] uppercase tracking-[0.12em] text-rose">
                  {live.emergency}
                </span>
              )}
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            aria-label="Close aircraft panel"
            className="rounded-sm border border-edge p-1.5 text-ink-3 transition-colors hover:border-edge-2 hover:text-ink"
          >
            <svg viewBox="0 0 14 14" className="h-3 w-3" aria-hidden>
              <path d="M2 2l10 10M12 2L2 12" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
            </svg>
          </button>
        </div>
      </div>

      {error && (
        <p className="border-b border-rose/30 bg-rose/10 px-4 py-2 text-[11px] text-rose">{error}</p>
      )}

      {identity?.photo && (
        <figure className="border-b border-edge">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={identity.photo.url}
            alt={`${title} aircraft photograph`}
            className="h-40 w-full object-cover"
            loading="lazy"
          />
          <figcaption className="px-4 py-1.5 text-[10px] text-ink-3">
            {identity.photo.link ? (
              <a
                href={identity.photo.link}
                target="_blank"
                rel="noopener noreferrer"
                className="hover:text-ink-2"
              >
                {identity.photo.credit}
              </a>
            ) : (
              identity.photo.credit
            )}
          </figcaption>
        </figure>
      )}

      {/* ---- live telemetry ---- */}
      <section>
        <SectionTitle
          action={
            position && (
              <button
                type="button"
                onClick={() => onLocate(position.lat, position.lon)}
                className="rounded-sm border border-edge bg-panel-2 px-2 py-1 text-[10px] uppercase tracking-[0.12em] text-ink-2 transition-colors hover:border-cyan/50 hover:text-cyan"
              >
                Centre map
              </button>
            )
          }
        >
          Live position
        </SectionTitle>

        {position ? (
          <div className="grid grid-cols-3 gap-3 px-4 pb-1">
            <Field label="Altitude" value={formatAltitude(position.altBaroFt)} accent="#22d3ee" />
            <Field label="Ground speed" value={formatSpeed(position.groundSpeedKt)} />
            <Field label="Heading" value={formatHeading(position.trackDeg)} />
            <Field label="Vertical rate" value={formatVerticalRate(position.verticalRateFpm)} />
            <Field label="Squawk" value={position.squawk ?? "—"} />
            <Field label="Status" value={flightStatusLabel(position.flightStatus)} mono={false} />
            <Field label="Latitude" value={formatCoordinate(position.lat, "lat")} />
            <Field label="Longitude" value={formatCoordinate(position.lon, "lon")} />
            <Field label="Last seen" value={formatRelative(position.seenAt)} mono={false} />
          </div>
        ) : detail?.lastKnownPosition ? (
          <div className="px-4 pb-1">
            <p className="mb-2 rounded-sm border border-edge bg-panel-2 px-3 py-2 text-[11px] text-ink-2">
              Not currently airborne. Showing the last position recorded by this deployment.
            </p>
            <div className="grid grid-cols-3 gap-3">
              <Field label="Altitude" value={formatAltitude(detail.lastKnownPosition.altBaroFt)} />
              <Field label="Ground speed" value={formatSpeed(detail.lastKnownPosition.groundSpeedKt)} />
              <Field label="Heading" value={formatHeading(detail.lastKnownPosition.trackDeg)} />
              <Field label="Latitude" value={formatCoordinate(detail.lastKnownPosition.lat, "lat")} />
              <Field label="Longitude" value={formatCoordinate(detail.lastKnownPosition.lon, "lon")} />
              <Field label="Last seen" value={formatRelative(detail.lastKnownPosition.seenAt)} mono={false} />
            </div>
          </div>
        ) : (
          <EmptyNote>
            {loadingDetail
              ? "Checking live traffic…"
              : "This aircraft is not currently transmitting a position in view."}
          </EmptyNote>
        )}
      </section>

      <Divider />

      {/* ---- identity ---- */}
      <section>
        <SectionTitle>Aircraft</SectionTitle>
        <div className="grid grid-cols-2 gap-3 px-4 pb-4">
          <Field label="Registration" value={identity?.registration ?? live?.registration ?? "—"} />
          <Field label="ICAO hex" value={(identity?.icao24 ?? live?.icao24 ?? "—").toUpperCase()} />
          <Field label="Type" value={identity?.typeCode ?? live?.typeCode ?? "—"} />
          <Field label="Callsign" value={live?.callsign ?? "—"} />
          <Field label="Manufacturer" value={identity?.manufacturer ?? "—"} mono={false} />
          <Field label="Model" value={identity?.model ?? "—"} mono={false} />
          <Field label="Serial number" value={identity?.serialNumber ?? "—"} />
          <Field label="Year built" value={identity?.yearBuilt ?? "—"} />
          <Field label="Registry" value={identity?.registryCountry ?? "—"} mono={false} />
          <Field label="Feed operator" value={live?.feedOperator ?? "—"} mono={false} />
        </div>
      </section>

      <RegistrySection registration={registration} />

      <Divider />
      <CurrentFlightSection flight={flight} loading={loadingFlight} />
      <LastLandingSection landing={lastLanding} />
      <NextTripSection trip={nextTrip} />

      <OwnerIntelligence
        ownership={ownership}
        loading={loadingOwnership}
        refreshing={refreshing}
        onRefresh={refreshOwnership}
      />

      <CostEstimateSection registration={registration} visible={Boolean(registration)} />

      <CostedHistorySection registration={registration} />

      <PhotoGallery photos={photos} loading={loadingPhotos} note={photoNote} />

      <FlightHistory
        history={history}
        loading={loadingHistory}
        windowMinutes={windowMinutes}
        onWindowChange={setWindowMinutes}
      />

      <WebNews report={research} loading={loadingResearch} />

      {registration && (
        <div className="mt-auto border-t border-edge px-4 py-3">
          <Link
            href={`/aircraft/${encodeURIComponent(registration)}`}
            className="flex items-center justify-center gap-2 rounded-sm border border-cyan/40 bg-cyan/10 px-3 py-2 text-[11px] font-semibold uppercase tracking-[0.14em] text-cyan transition-colors hover:bg-cyan/20"
          >
            Open full aircraft profile
          </Link>
        </div>
      )}
    </aside>
  );
}
