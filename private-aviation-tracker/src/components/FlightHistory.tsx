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

export default function FlightHistory({
  history,
  loading,
}: {
  history: AircraftHistory | null;
  loading: boolean;
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

  return (
    <section className="border-t border-edge">
      <SectionTitle>Flight history</SectionTitle>

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
