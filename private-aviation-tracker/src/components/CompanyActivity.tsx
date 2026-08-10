"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { formatDistance, formatDuration } from "@/lib/format";
import type { CompanyFleetEntry, CompanyFlightActivity } from "@/lib/types";

/**
 * Flight activity timeline for a company fleet, grouped by day.
 *
 * Filters (aircraft, airport, date) are applied server-side so the list is
 * never a partially-filtered view of a truncated page. Everything shown is an
 * observed flight; a leg whose airports could not be inferred says so rather
 * than being dropped or labelled with a guess.
 */

function dayLabel(iso: string): string {
  const date = new Date(iso);
  const today = new Date();
  const yesterday = new Date(today.getTime() - 86400000);
  if (date.toDateString() === today.toDateString()) return "Today";
  if (date.toDateString() === yesterday.toDateString()) return "Yesterday";
  return date.toLocaleDateString(undefined, { weekday: "long", day: "numeric", month: "long" });
}

function clock(iso: string | null): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" });
}

export default function CompanyActivity({
  slug,
  initial,
  fleet,
}: {
  slug: string;
  initial: CompanyFlightActivity;
  fleet: CompanyFleetEntry[];
}) {
  const [activity, setActivity] = useState(initial);
  const [registration, setRegistration] = useState("");
  const [airport, setAirport] = useState("");
  const [since, setSince] = useState("");
  const [loading, setLoading] = useState(false);

  const load = useCallback(async () => {
    const params = new URLSearchParams({ limit: "60" });
    if (registration) params.set("registration", registration);
    if (airport) params.set("airport", airport);
    if (since) params.set("since", new Date(since).toISOString());

    setLoading(true);
    try {
      const response = await fetch(`/api/company/${encodeURIComponent(slug)}/activity?${params}`);
      if (response.ok) setActivity(await response.json());
    } catch {
      /* keep the previous list on screen */
    } finally {
      setLoading(false);
    }
  }, [slug, registration, airport, since]);

  // Skip the initial render: the server already provided an unfiltered list.
  const filterKey = `${registration}|${airport}|${since}`;
  useEffect(() => {
    if (filterKey === "||") return;
    void load();
  }, [filterKey, load]);

  const days = useMemo(() => {
    const groups = new Map<string, CompanyFlightActivity["flights"]>();
    for (const flight of activity.flights) {
      const stamp = flight.departedAt ?? flight.arrivedAt;
      if (!stamp) continue;
      const key = new Date(stamp).toDateString();
      const bucket = groups.get(key);
      if (bucket) bucket.push(flight);
      else groups.set(key, [flight]);
    }
    return [...groups.entries()];
  }, [activity.flights]);

  const airportOptions = useMemo(() => {
    const codes = new Set<string>();
    for (const flight of activity.flights) {
      if (flight.departureIcao) codes.add(flight.departureIcao);
      if (flight.arrivalIcao) codes.add(flight.arrivalIcao);
    }
    return [...codes].sort();
  }, [activity.flights]);

  const selectClass =
    "rounded-sm border border-edge bg-panel-2 px-2 py-1 text-[11px] text-ink-2 focus:border-cyan/60 focus:outline-none";

  return (
    <section className="mt-8">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-[11px] font-semibold uppercase tracking-[0.18em] text-ink-3">
          Flight activity
        </h2>
        <div className="flex flex-wrap items-center gap-2">
          <select
            value={registration}
            onChange={(e) => setRegistration(e.target.value)}
            className={selectClass}
            aria-label="Filter by aircraft"
          >
            <option value="">All aircraft</option>
            {fleet.map((entry) => (
              <option key={entry.registration} value={entry.registration}>
                {entry.registration}
              </option>
            ))}
          </select>

          <select
            value={airport}
            onChange={(e) => setAirport(e.target.value)}
            className={selectClass}
            aria-label="Filter by airport"
          >
            <option value="">All airports</option>
            {airportOptions.map((code) => (
              <option key={code} value={code}>
                {code}
              </option>
            ))}
          </select>

          <input
            type="date"
            value={since}
            onChange={(e) => setSince(e.target.value)}
            className={selectClass}
            aria-label="Show flights from this date"
          />

          {(registration || airport || since) && (
            <button
              type="button"
              onClick={() => {
                setRegistration("");
                setAirport("");
                setSince("");
              }}
              className="rounded-sm border border-edge px-2 py-1 text-[10px] uppercase tracking-[0.12em] text-ink-3 hover:border-edge-2 hover:text-ink"
            >
              Clear
            </button>
          )}
          {loading && (
            <span className="h-3 w-3 animate-spin rounded-full border border-edge-2 border-t-cyan" />
          )}
        </div>
      </div>

      {days.length === 0 ? (
        <p className="rounded-sm border border-edge bg-panel-2 px-4 py-3 text-xs text-ink-3">
          {activity.note ?? "No flights match these filters."}
        </p>
      ) : (
        <div className="space-y-5">
          {days.map(([key, flights]) => (
            <div key={key}>
              <div className="mb-2 text-[10px] uppercase tracking-[0.16em] text-ink-3">
                {dayLabel(flights[0].departedAt ?? flights[0].arrivedAt!)}
              </div>
              <ul className="space-y-1.5">
                {flights.map((flight) => (
                  <li
                    key={flight.id}
                    className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1 rounded-sm border border-edge bg-panel-2 px-3 py-2"
                  >
                    <div className="min-w-0">
                      <div className="tabular text-sm text-ink">
                        {flight.departureIcao ?? "Unknown"} → {flight.arrivalIcao ?? (flight.status === "ACTIVE" ? "in flight" : "Unknown")}
                      </div>
                      <div className="text-[11px] text-ink-3">
                        {flight.registration}
                        {flight.callsign ? ` · ${flight.callsign}` : ""}
                      </div>
                    </div>
                    <div className="tabular text-right text-[11px] text-ink-2">
                      <div>
                        {clock(flight.departedAt)} → {clock(flight.arrivedAt)}
                      </div>
                      <div className="text-ink-3">
                        {[
                          flight.durationSec ? formatDuration(flight.durationSec) : null,
                          flight.distanceNm ? formatDistance(flight.distanceNm) : null,
                        ]
                          .filter(Boolean)
                          .join(" · ") || (flight.status === "ACTIVE" ? "airborne" : "")}
                      </div>
                    </div>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}
