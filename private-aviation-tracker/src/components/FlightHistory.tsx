"use client";

import { EmptyNote, SectionTitle, Spinner } from "@/components/ui";
import {
  formatAltitude,
  formatClock,
  formatDate,
  formatDistance,
  formatDuration,
} from "@/lib/format";
import type { AircraftHistory, TimelineEvent } from "@/lib/types";

const EVENT_COLOR: Record<TimelineEvent["kind"], string> = {
  departure: "#22d3ee",
  arrival: "#4ade80",
  cruise: "#a78bfa",
  climb: "#f5a524",
  descent: "#f5a524",
  observed: "#64748b",
};

function groupByDay(events: TimelineEvent[]) {
  const groups = new Map<string, TimelineEvent[]>();
  for (const event of events) {
    const day = new Date(event.at).toDateString();
    const bucket = groups.get(day);
    if (bucket) bucket.push(event);
    else groups.set(day, [event]);
  }
  return [...groups.entries()];
}

const WINDOWS: Array<{ minutes: number; label: string }> = [
  { minutes: 30, label: "30 min" },
  { minutes: 60, label: "1 hour" },
  { minutes: 120, label: "2 hours" },
  { minutes: 360, label: "6 hours" },
  { minutes: 1440, label: "24 hours" },
];

/**
 * Track-window selector. Windows with no recorded data are disabled rather
 * than hidden, so it is obvious that the range exists but this deployment has
 * not been watching long enough to fill it.
 */
function WindowPicker({
  value,
  available,
  onChange,
}: {
  value: number;
  available: number[];
  onChange: (minutes: number) => void;
}) {
  return (
    <div className="flex flex-wrap gap-1">
      {WINDOWS.map((w) => {
        const enabled = available.length === 0 || available.includes(w.minutes);
        return (
          <button
            key={w.minutes}
            type="button"
            disabled={!enabled}
            onClick={() => onChange(w.minutes)}
            title={enabled ? undefined : "No positions recorded over this period yet"}
            className={`rounded-sm border px-1.5 py-0.5 text-[10px] tracking-[0.08em] transition-colors ${
              value === w.minutes
                ? "border-cyan/50 bg-cyan/15 text-cyan"
                : enabled
                  ? "border-edge bg-panel-2 text-ink-2 hover:border-edge-2 hover:text-ink"
                  : "cursor-not-allowed border-edge/50 bg-panel-2/40 text-ink-3/40"
            }`}
          >
            {w.label}
          </button>
        );
      })}
    </div>
  );
}

export default function FlightHistory({
  history,
  loading,
  windowMinutes = 120,
  onWindowChange,
}: {
  history: AircraftHistory | null;
  loading: boolean;
  windowMinutes?: number;
  onWindowChange?: (minutes: number) => void;
}) {
  if (loading && !history) {
    return (
      <section className="border-t border-edge">
        <SectionTitle>Flight history</SectionTitle>
        <Spinner label="Loading recorded flights…" />
      </section>
    );
  }

  const timeline = history?.timeline ?? [];
  const flights = history?.flights ?? [];
  const positions = history?.recentPositions ?? [];

  return (
    <section className="border-t border-edge">
      <SectionTitle
        action={
          onWindowChange && (
            <WindowPicker
              value={windowMinutes}
              available={history?.availableWindows ?? []}
              onChange={onWindowChange}
            />
          )
        }
      >
        Flight path
      </SectionTitle>

      {onWindowChange && (
        <p className="px-4 pb-2 text-[10px] text-ink-3">
          {positions.length > 0
            ? `${positions.length} recorded position${positions.length === 1 ? "" : "s"} drawn on the map for the selected period.`
            : "No positions recorded for the selected period."}
        </p>
      )}

      {timeline.length === 0 && flights.length === 0 && (
        <EmptyNote>{history?.note ?? "No recorded flights for this aircraft."}</EmptyNote>
      )}

      {timeline.length > 0 && (
        <div className="px-4 pb-2">
          {groupByDay(timeline.slice(0, 24)).map(([day, events]) => (
            <div key={day} className="mb-3">
              <div className="mb-1.5 text-[10px] uppercase tracking-[0.14em] text-ink-3">
                {new Date(day).toDateString() === new Date().toDateString()
                  ? "Today"
                  : formatDate(day)}
              </div>
              <ul className="space-y-1.5 border-l border-edge pl-3">
                {events.map((event, index) => (
                  <li key={`${event.at}-${index}`} className="relative">
                    <span
                      className="absolute -left-[17px] top-1.5 h-1.5 w-1.5 rounded-full"
                      style={{ background: EVENT_COLOR[event.kind] }}
                    />
                    <div className="flex items-baseline gap-2.5">
                      <span className="tabular w-11 shrink-0 text-[11px] text-ink-3">
                        {formatClock(event.at)}
                      </span>
                      <span className="text-[12px] text-ink">{event.label}</span>
                    </div>
                    {event.detail && (
                      <div className="pl-[54px] text-[11px] text-ink-3">{event.detail}</div>
                    )}
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      )}

      {flights.length > 0 && (
        <>
          <SectionTitle>Previous flights</SectionTitle>
          <ul className="px-4 pb-4">
            {flights.slice(0, 10).map((flight) => (
              <li
                key={flight.id}
                className="mb-1.5 rounded-sm border border-edge bg-panel-2 px-3 py-2"
              >
                <div className="flex items-center justify-between gap-3">
                  <span className="tabular text-sm text-ink">
                    {flight.departureIcao ?? "????"}
                    <span className="px-1.5 text-ink-3">→</span>
                    {flight.arrivalIcao ?? (flight.status === "ACTIVE" ? "in flight" : "????")}
                  </span>
                  <span className="tabular text-[11px] text-ink-3">
                    {formatDate(flight.firstSeenAt)}
                  </span>
                </div>
                <div className="mt-1 flex flex-wrap gap-x-3 gap-y-0.5 text-[11px] text-ink-3">
                  {flight.callsign && <span className="tabular">{flight.callsign}</span>}
                  <span className="tabular">{formatDuration(flight.durationSec)}</span>
                  <span className="tabular">{formatDistance(flight.distanceNm)}</span>
                  <span className="tabular">{formatAltitude(flight.maxAltitudeFt)}</span>
                  {flight.status === "STALE" && (
                    <span className="text-amber">arrival not observed</span>
                  )}
                </div>
              </li>
            ))}
          </ul>
        </>
      )}

      {history?.note && (timeline.length > 0 || flights.length > 0) && (
        <p className="px-4 pb-4 text-[10px] leading-relaxed text-ink-3">{history.note}</p>
      )}
    </section>
  );
}
