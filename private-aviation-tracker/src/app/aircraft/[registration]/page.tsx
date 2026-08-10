import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import FlightHistory from "@/components/FlightHistory";
import OwnershipSection from "@/components/OwnershipSection";
import { CategoryBadge, Field } from "@/components/ui";
import { getAircraftDetail } from "@/lib/aircraft/service";
import { normalizeRegistration, registryFor } from "@/lib/aircraft/registration";
import {
  flightStatusLabel,
  formatAltitude,
  formatCoordinate,
  formatHeading,
  formatRelative,
  formatSpeed,
  formatVerticalRate,
} from "@/lib/format";
import { getHistory } from "@/lib/history/service";

export const dynamic = "force-dynamic";

interface PageProps {
  params: Promise<{ registration: string }>;
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { registration } = await params;
  const reg = normalizeRegistration(decodeURIComponent(registration)) ?? registration.toUpperCase();
  return {
    title: `${reg} — Private Aviation Tracker`,
    description: `Aircraft profile, ownership research and flight history for ${reg}.`,
  };
}

export default async function AircraftProfilePage({ params }: PageProps) {
  const { registration: raw } = await params;
  const registration = normalizeRegistration(decodeURIComponent(raw));
  if (!registration) notFound();

  const [detail, history] = await Promise.all([
    getAircraftDetail(registration, { includeOwnership: true }),
    getHistory(registration),
  ]);

  if (!detail) notFound();

  const { identity, live, lastKnownPosition, ownership } = detail;
  const registry = registryFor(registration);

  return (
    <div className="min-h-dvh bg-ground">
      <header className="sticky top-0 z-10 border-b border-edge bg-ground/92 backdrop-blur-md">
        <div className="mx-auto flex max-w-5xl items-center justify-between gap-4 px-5 py-3">
          <Link
            href="/"
            className="flex items-center gap-2 text-[11px] uppercase tracking-[0.16em] text-ink-3 transition-colors hover:text-cyan"
          >
            <svg viewBox="0 0 16 16" className="h-3 w-3" aria-hidden>
              <path
                d="M10 3L5 8l5 5"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.6"
                strokeLinecap="round"
              />
            </svg>
            Live map
          </Link>
          <div className="text-[11px] tracking-[0.16em] text-ink-3">PRIVATE AVIATION TRACKER</div>
        </div>
      </header>

      <main className="mx-auto max-w-5xl px-5 pb-16">
        <section className="grid gap-6 border-b border-edge py-7 md:grid-cols-[220px_1fr]">
          {identity.photo ? (
            <figure>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={identity.photo.url}
                alt={`${registration} aircraft photograph`}
                className="h-40 w-full rounded-sm border border-edge object-cover"
              />
              <figcaption className="mt-1.5 text-[10px] text-ink-3">
                {identity.photo.link ? (
                  <a href={identity.photo.link} target="_blank" rel="noopener noreferrer">
                    {identity.photo.credit}
                  </a>
                ) : (
                  identity.photo.credit
                )}
              </figcaption>
            </figure>
          ) : (
            <div className="flex h-40 items-center justify-center rounded-sm border border-dashed border-edge text-[11px] text-ink-3">
              No public photo found
            </div>
          )}

          <div>
            <h1 className="tabular text-4xl font-semibold leading-none text-ink">{registration}</h1>
            <p className="mt-2 text-sm text-ink-2">
              {[identity.manufacturer, identity.model].filter(Boolean).join(" ") ||
                "Aircraft type not identified"}
              {identity.typeCode ? ` · ${identity.typeCode}` : ""}
            </p>
            <div className="mt-3 flex flex-wrap items-center gap-2">
              <CategoryBadge category={identity.category} />
              {live ? (
                <span className="rounded-sm border border-lime/40 bg-lime/10 px-2 py-0.5 text-[10px] uppercase tracking-[0.12em] text-lime">
                  airborne now
                </span>
              ) : (
                <span className="rounded-sm border border-edge px-2 py-0.5 text-[10px] uppercase tracking-[0.12em] text-ink-3">
                  not currently tracked
                </span>
              )}
            </div>

            <div className="mt-5 grid grid-cols-2 gap-4 sm:grid-cols-4">
              <Field label="ICAO hex" value={(identity.icao24 ?? "—").toUpperCase()} />
              <Field label="Serial number" value={identity.serialNumber ?? "—"} />
              <Field label="Year built" value={identity.yearBuilt ?? "—"} />
              <Field label="Registry" value={identity.registryCountry ?? "—"} mono={false} />
            </div>

            {registry && (
              <a
                href={registry.searchUrl(registration)}
                target="_blank"
                rel="noopener noreferrer"
                className="mt-4 inline-flex items-center gap-2 rounded-sm border border-edge bg-panel-2 px-3 py-1.5 text-[11px] text-ink-2 transition-colors hover:border-cyan/40 hover:text-cyan"
              >
                Look up in {registry.authority}
              </a>
            )}
          </div>
        </section>

        <section className="border-b border-edge py-6">
          <h2 className="mb-3 text-[11px] font-semibold uppercase tracking-[0.18em] text-ink-3">
            Current location
          </h2>
          {live ? (
            <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
              <Field label="Altitude" value={formatAltitude(live.altBaroFt)} accent="#22d3ee" />
              <Field label="Ground speed" value={formatSpeed(live.groundSpeedKt)} />
              <Field label="Heading" value={formatHeading(live.trackDeg)} />
              <Field label="Vertical rate" value={formatVerticalRate(live.verticalRateFpm)} />
              <Field label="Latitude" value={formatCoordinate(live.lat, "lat")} />
              <Field label="Longitude" value={formatCoordinate(live.lon, "lon")} />
              <Field label="Callsign" value={live.callsign ?? "—"} />
              <Field label="Status" value={flightStatusLabel(live.flightStatus)} mono={false} />
            </div>
          ) : lastKnownPosition ? (
            <div>
              <p className="mb-3 text-[12px] text-ink-2">
                Not currently airborne. Last position recorded{" "}
                {formatRelative(lastKnownPosition.seenAt)}.
              </p>
              <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
                <Field label="Altitude" value={formatAltitude(lastKnownPosition.altBaroFt)} />
                <Field label="Ground speed" value={formatSpeed(lastKnownPosition.groundSpeedKt)} />
                <Field label="Latitude" value={formatCoordinate(lastKnownPosition.lat, "lat")} />
                <Field label="Longitude" value={formatCoordinate(lastKnownPosition.lon, "lon")} />
              </div>
            </div>
          ) : (
            <p className="text-[12px] text-ink-3">
              No position has been observed for this aircraft by this deployment.
            </p>
          )}
        </section>

        <div className="-mx-5 sm:mx-0">
          <OwnershipSection registration={registration} initial={ownership} />
          <FlightHistory history={history} loading={false} />
        </div>

        <p className="mt-6 border-t border-edge pt-4 text-[10px] leading-relaxed text-ink-3">
          Last updated {formatRelative(Date.now())}. Position data is sourced from ADS-B and is
          provided as observed; ownership data is aggregated from public registries and web
          sources and may be incomplete or out of date.
        </p>
      </main>
    </div>
  );
}
