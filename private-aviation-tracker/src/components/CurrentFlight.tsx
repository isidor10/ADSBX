"use client";

import { Divider, EmptyNote, Field, SectionTitle, Spinner } from "@/components/ui";
import { formatRelative } from "@/lib/format";
import type { AirportRef, CurrentFlight, LandingSummary, NextTrip } from "@/lib/types";

/**
 * CURRENT FLIGHT / LAST LANDING / NEXT TRIP.
 *
 * The one rule running through this component: every airport shown says where
 * it came from. A filed route reads as a plain destination; a trajectory
 * estimate is badged ESTIMATED with its confidence; anything unsupported is
 * "Unknown" with a sentence explaining why, never an empty space the reader
 * fills in with an assumption.
 */

function airportLine(airport: AirportRef | null): string {
  if (!airport) return "Unknown";
  const code = airport.icao ?? airport.iata;
  const place = airport.city ?? airport.name;
  return code && place && code !== place ? `${code} ${place}` : (code ?? place);
}

function timeOfDay(iso: string | null): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" });
}

function EstimateBadge({ confidence }: { confidence: number | null }) {
  return (
    <span className="ml-1.5 inline-flex items-center gap-1 rounded-sm border border-amber/40 bg-amber/10 px-1.5 py-0.5 align-middle text-[9px] font-semibold uppercase tracking-[0.12em] text-amber">
      estimated{confidence !== null ? ` ${confidence}%` : ""}
    </span>
  );
}

function ProgressBar({ pct }: { pct: number }) {
  return (
    <div className="mt-3 px-4">
      <div className="relative h-1 w-full rounded-full bg-panel-3">
        <div
          className="absolute inset-y-0 left-0 rounded-full bg-cyan"
          style={{ width: `${Math.min(100, Math.max(0, pct))}%` }}
        />
        <div
          className="absolute -top-1 h-3 w-3 -translate-x-1/2 rounded-full border border-ground bg-ink"
          style={{ left: `${Math.min(100, Math.max(0, pct))}%` }}
        />
      </div>
    </div>
  );
}

export function CurrentFlightSection({
  flight,
  loading,
}: {
  flight: CurrentFlight | null;
  loading: boolean;
}) {
  if (loading && !flight) {
    return (
      <section>
        <SectionTitle>Current flight</SectionTitle>
        <Spinner label="Resolving route…" />
      </section>
    );
  }
  if (!flight) return null;

  const estimated = flight.destinationSource === "TRAJECTORY_ESTIMATE";

  return (
    <section>
      <SectionTitle>Current flight</SectionTitle>

      <div className="grid grid-cols-2 gap-3 px-4">
        <Field label="From" value={airportLine(flight.departure)} mono={false} />
        <Field
          label="To"
          value={
            <span className="flex items-center">
              <span className="truncate">{airportLine(flight.destination)}</span>
              {estimated && <EstimateBadge confidence={flight.destinationConfidence} />}
            </span>
          }
          mono={false}
        />
        <Field
          label="ETA"
          value={flight.etaAt ? timeOfDay(flight.etaAt) : "—"}
          accent={flight.etaAt ? "#22d3ee" : undefined}
        />
        <Field
          label="Distance remaining"
          value={flight.distanceRemainingNm !== null ? `${flight.distanceRemainingNm} NM` : "—"}
        />
      </div>

      {flight.progressPct !== null && <ProgressBar pct={flight.progressPct} />}

      {flight.departedAt && (
        <div className="px-4 pt-3">
          <Field label="Departed" value={formatRelative(flight.departedAt)} mono={false} />
        </div>
      )}

      {flight.note && (
        <p className="px-4 pt-3 text-[11px] leading-relaxed text-ink-3">{flight.note}</p>
      )}
      <div className="pb-4" />
    </section>
  );
}

export function LastLandingSection({ landing }: { landing: LandingSummary | null }) {
  return (
    <>
      <Divider />
      <section>
        <SectionTitle>Last landing</SectionTitle>
        {landing ? (
          <div className="px-4 pb-4">
            <div className="tabular text-sm text-ink">
              {airportLine(landing.departure)} → {airportLine(landing.arrival)}
            </div>
            <div className="mt-2 grid grid-cols-2 gap-3">
              <Field
                label="Landed"
                value={landing.arrivedAt ? formatRelative(landing.arrivedAt) : "—"}
                mono={false}
              />
              <Field label="Airport" value={airportLine(landing.arrival)} mono={false} />
              <Field
                label="Flight time"
                value={
                  landing.durationSec
                    ? `${Math.floor(landing.durationSec / 3600)}h ${Math.round((landing.durationSec % 3600) / 60)}m`
                    : "—"
                }
              />
              <Field
                label="Distance"
                value={landing.distanceNm ? `${Math.round(landing.distanceNm)} NM` : "—"}
              />
            </div>
          </div>
        ) : (
          <EmptyNote>
            No completed flight has been observed for this aircraft yet. Landings are recorded
            only when this deployment tracks an aircraft from the air onto the ground.
          </EmptyNote>
        )}
      </section>
    </>
  );
}

export function NextTripSection({ trip }: { trip: NextTrip | null }) {
  return (
    <>
      <Divider />
      <section>
        <SectionTitle>Next trip</SectionTitle>
        {trip?.known ? (
          <div className="px-4 pb-4">
            <div className="mb-2 inline-flex items-center gap-1.5 rounded-sm border border-amber/40 bg-amber/10 px-2 py-0.5 text-[9px] font-semibold uppercase tracking-[0.14em] text-amber">
              estimated next trip · {trip.confidence} confidence
            </div>
            <div className="tabular text-sm text-ink">
              {airportLine(trip.departure)} → {airportLine(trip.destination)}
            </div>
            {trip.window && <div className="mt-1 text-xs text-ink-2">{trip.window}</div>}
            <p className="mt-2 text-[11px] leading-relaxed text-ink-3">{trip.note}</p>
          </div>
        ) : (
          <div className="px-4 pb-4">
            <div className="tabular text-sm text-ink-2">Unknown</div>
            <p className="mt-2 text-[11px] leading-relaxed text-ink-3">
              {trip?.note ??
                "No future flight can be established. Private flight plans are not published in advance."}
            </p>
          </div>
        )}
      </section>
    </>
  );
}
