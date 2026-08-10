"use client";

import { useEffect, useState } from "react";
import { Divider, EmptyNote, SectionTitle, Spinner } from "@/components/ui";
import type { CostedHistory } from "@/lib/types";

/**
 * Historical flights with an estimated cost per flight.
 *
 * The coverage bar is the important part of this component: history is built
 * only from what this deployment observed, so a 90-day request on an aircraft
 * first seen last week covers a week. Showing three flights under a "90 days"
 * heading without that context would read as "this aircraft barely flies",
 * which would be wrong.
 */

const RANGES = [
  { days: 1, label: "24h" },
  { days: 3, label: "3d" },
  { days: 7, label: "7d" },
  { days: 30, label: "30d" },
  { days: 90, label: "90d" },
];

function money(value: number): string {
  if (value >= 1000) return `€${Math.round(value / 1000)}k`;
  return `€${Math.round(value)}`;
}

function duration(seconds: number | null): string {
  if (!seconds) return "—";
  return `${Math.floor(seconds / 3600)}h ${Math.round((seconds % 3600) / 60)}m`;
}

function clock(iso: string | null): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" });
}

export default function CostedHistorySection({ registration }: { registration: string | null }) {
  const [days, setDays] = useState(7);
  const [data, setData] = useState<CostedHistory | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!registration) return;
    const controller = new AbortController();
    setLoading(true);
    void (async () => {
      try {
        const response = await fetch(
          `/api/aircraft/${encodeURIComponent(registration)}/history/costed?days=${days}`,
          { signal: controller.signal },
        );
        if (response.ok) setData(await response.json());
      } catch {
        /* renders its own empty state */
      } finally {
        setLoading(false);
      }
    })();
    return () => controller.abort();
  }, [registration, days]);

  // Group by calendar day, newest first.
  const byDay = new Map<string, CostedHistory["flights"]>();
  for (const flight of data?.flights ?? []) {
    const key = new Date(flight.departedAt).toDateString();
    const list = byDay.get(key) ?? [];
    list.push(flight);
    byDay.set(key, list);
  }

  return (
    <>
      <Divider />
      <section>
        <SectionTitle
          action={
            <div className="flex gap-1">
              {RANGES.map((r) => (
                <button
                  key={r.days}
                  type="button"
                  onClick={() => setDays(r.days)}
                  className={`rounded-sm border px-1.5 py-0.5 text-[10px] transition-colors ${
                    days === r.days
                      ? "border-cyan/50 bg-cyan/15 text-cyan"
                      : "border-edge bg-panel-2 text-ink-2 hover:text-ink"
                  }`}
                >
                  {r.label}
                </button>
              ))}
            </div>
          }
        >
          Flight history &amp; cost
        </SectionTitle>

        {loading && !data && <Spinner label="Loading recorded flights…" />}

        {data && (
          <div className="px-4 pb-4">
            {/* ---- coverage, stated up front ---- */}
            <div className="mb-3 rounded-sm border border-edge bg-panel-2 px-3 py-2">
              <div className="flex items-center justify-between text-[10px] uppercase tracking-[0.12em]">
                <span className="text-ink-3">Historical coverage</span>
                <span
                  className={
                    data.coveragePercent >= 90
                      ? "text-lime"
                      : data.coveragePercent >= 40
                        ? "text-amber"
                        : "text-ink-3"
                  }
                >
                  {data.coveragePercent}%
                </span>
              </div>
              <div className="mt-1.5 h-1 w-full overflow-hidden rounded-full bg-panel-3">
                <div
                  className="h-full rounded-full bg-cyan"
                  style={{ width: `${Math.max(1, data.coveragePercent)}%` }}
                />
              </div>
              {data.note && (
                <p className="mt-1.5 text-[10px] leading-relaxed text-ink-3">{data.note}</p>
              )}
            </div>

            {data.flights.length === 0 ? (
              <EmptyNote>
                No flights recorded in this period. Historical data unavailable for this range.
              </EmptyNote>
            ) : (
              <>
                {/* ---- totals ---- */}
                <div className="mb-3 grid grid-cols-4 gap-2 rounded-sm border border-edge bg-panel-2 px-3 py-2 text-center">
                  <div>
                    <div className="tabular text-sm text-ink">{data.totals.flights}</div>
                    <div className="text-[9px] uppercase tracking-[0.1em] text-ink-3">flights</div>
                  </div>
                  <div>
                    <div className="tabular text-sm text-ink">{data.totals.hours}h</div>
                    <div className="text-[9px] uppercase tracking-[0.1em] text-ink-3">hours</div>
                  </div>
                  <div>
                    <div className="tabular text-sm text-ink">
                      {(data.totals.fuelLitres / 1000).toFixed(1)}kL
                    </div>
                    <div className="text-[9px] uppercase tracking-[0.1em] text-ink-3">fuel</div>
                  </div>
                  <div>
                    <div className="tabular text-sm text-cyan">
                      {money(data.totals.cost.likely)}
                    </div>
                    <div className="text-[9px] uppercase tracking-[0.1em] text-ink-3">est. cost</div>
                  </div>
                </div>

                {/* ---- flights by day ---- */}
                <div className="space-y-3">
                  {[...byDay.entries()].map(([day, flights]) => (
                    <div key={day}>
                      <div className="mb-1 text-[10px] uppercase tracking-[0.14em] text-ink-3">
                        {new Date(day).toLocaleDateString(undefined, {
                          day: "numeric",
                          month: "short",
                          year: "numeric",
                        })}
                      </div>
                      <ul className="space-y-1">
                        {flights.map((flight) => (
                          <li
                            key={flight.id}
                            className="rounded-sm border border-edge bg-panel-2 px-2.5 py-1.5"
                          >
                            <div className="flex items-start justify-between gap-3">
                              <div className="min-w-0">
                                <div className="tabular text-xs text-ink">
                                  {flight.departure?.icao ?? "Unknown"} →{" "}
                                  {flight.arrival?.icao ??
                                    (flight.status === "ACTIVE" ? "in flight" : "Unknown")}
                                </div>
                                <div className="tabular text-[10px] text-ink-3">
                                  {clock(flight.departedAt)} → {clock(flight.arrivedAt)} ·{" "}
                                  {duration(flight.durationSec)}
                                  {flight.distanceNm
                                    ? ` · ${Math.round(flight.distanceNm)} NM`
                                    : ""}
                                </div>
                              </div>
                              <div className="shrink-0 text-right">
                                {flight.cost ? (
                                  <>
                                    <div className="tabular text-xs text-cyan">
                                      {money(flight.cost.likely)}
                                    </div>
                                    <div className="tabular text-[9px] text-ink-3">
                                      {flight.fuelLitres?.toLocaleString()} L
                                    </div>
                                  </>
                                ) : (
                                  <div className="text-[9px] uppercase tracking-[0.1em] text-ink-3">
                                    no estimate
                                  </div>
                                )}
                              </div>
                            </div>
                            {flight.positioningCost ? (
                              <div className="mt-1 text-[9px] text-amber">
                                + {money(flight.positioningCost)} estimated positioning
                              </div>
                            ) : null}
                            {flight.costNote && (
                              <div className="mt-1 text-[9px] leading-relaxed text-ink-3">
                                {flight.costNote}
                              </div>
                            )}
                          </li>
                        ))}
                      </ul>
                    </div>
                  ))}
                </div>

                <p className="mt-3 border-t border-edge pt-2 text-[10px] leading-relaxed text-ink-3">
                  Costs are estimates from class performance data, not actual figures. Flights are
                  those this deployment observed; a flight outside ADS-B coverage is absent from
                  this list but was still flown.
                </p>
              </>
            )}
          </div>
        )}
      </section>
    </>
  );
}
