"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { formatAltitude, formatRelative } from "@/lib/format";
import type {
  AirportHit,
  CompanySummary,
  GlobalSearchResults,
  OwnerHit,
  SearchHit,
} from "@/lib/types";

/**
 * Global search across five kinds of subject: aircraft, companies, owners,
 * operators and airports.
 *
 * Results are grouped rather than merged into one ranked list, because the
 * categories answer different questions — "where is this tail" and "what does
 * this company fly" should not compete for the same slots. Keyboard
 * navigation runs over the flattened list so arrow keys still work across
 * groups.
 */

type Row =
  | { kind: "aircraft"; value: SearchHit }
  | { kind: "company"; value: CompanySummary }
  | { kind: "owner"; value: OwnerHit }
  | { kind: "airport"; value: AirportHit };

const EMPTY: GlobalSearchResults = {
  query: "",
  aircraft: [],
  companies: [],
  owners: [],
  operators: [],
  airports: [],
};

function GroupLabel({ children }: { children: string }) {
  return (
    <li className="border-b border-edge bg-panel-3/60 px-3 py-1 text-[9px] font-semibold uppercase tracking-[0.16em] text-ink-3">
      {children}
    </li>
  );
}

export default function SearchBar({
  onSelect,
  onCompanySelect,
  onAirportSelect,
  viewport,
}: {
  onSelect: (hit: SearchHit) => void;
  onCompanySelect?: (company: CompanySummary) => void;
  onAirportSelect?: (airport: AirportHit) => void;
  /** What the user is looking at, so company search can fall back to it. */
  viewport?: { lat: number; lon: number; radiusNm: number } | null;
}) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<GlobalSearchResults>(EMPTY);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [highlight, setHighlight] = useState(0);
  const containerRef = useRef<HTMLDivElement>(null);

  // One flat list behind the grouped rendering, so the keyboard can walk it.
  const rows = useMemo<Row[]>(
    () => [
      ...results.aircraft.map((value) => ({ kind: "aircraft" as const, value })),
      ...results.companies.map((value) => ({ kind: "company" as const, value })),
      ...results.operators.map((value) => ({ kind: "owner" as const, value })),
      ...results.owners
        .filter((o) => !results.operators.some((op) => op.name === o.name))
        .map((value) => ({ kind: "owner" as const, value })),
      ...results.airports.map((value) => ({ kind: "airport" as const, value })),
    ],
    [results],
  );

  useEffect(() => {
    const term = query.trim();
    if (term.length < 2) {
      setResults(EMPTY);
      setLoading(false);
      return;
    }

    const controller = new AbortController();
    setLoading(true);
    const timer = setTimeout(async () => {
      try {
        const params = new URLSearchParams({ q: term });
        if (viewport) {
          params.set("lat", viewport.lat.toFixed(4));
          params.set("lon", viewport.lon.toFixed(4));
          params.set("radius", String(Math.round(viewport.radiusNm)));
        }
        const response = await fetch(`/api/search?${params}`, {
          signal: controller.signal,
        });
        const body = (await response.json()) as GlobalSearchResults;
        setResults({ ...EMPTY, ...body });
        setHighlight(0);
        setOpen(true);
      } catch {
        /* aborted or offline */
      } finally {
        setLoading(false);
      }
    }, 220);

    return () => {
      controller.abort();
      clearTimeout(timer);
    };
  }, [query, viewport?.lat, viewport?.lon, viewport?.radiusNm]);

  useEffect(() => {
    const onClickAway = (event: MouseEvent) => {
      if (!containerRef.current?.contains(event.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onClickAway);
    return () => document.removeEventListener("mousedown", onClickAway);
  }, []);

  const choose = (row: Row) => {
    setOpen(false);
    if (row.kind === "aircraft") return onSelect(row.value);
    if (row.kind === "company") return onCompanySelect?.(row.value);
    if (row.kind === "airport") return onAirportSelect?.(row.value);
    // An owner or operator with a single tail goes straight to that aircraft;
    // anything larger is a fleet, so hand it to the company view.
    if (row.value.registrations.length === 1) {
      return onSelect({
        registration: row.value.registrations[0],
        icao24: null,
        callsign: null,
        typeCode: null,
        manufacturer: null,
        model: null,
        owner: row.value.role === "owner" ? row.value.name : null,
        operator: row.value.role === "owner" ? null : row.value.name,
        airborne: false,
        lat: null,
        lon: null,
        altBaroFt: null,
        lastSeenAt: null,
        matchedOn: row.value.role,
        score: 0,
      });
    }
    onCompanySelect?.({
      slug: row.value.name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, ""),
      name: row.value.name,
      aircraftCount: row.value.registrations.length,
      website: null,
      country: null,
      exact: true,
    });
  };

  const rowIndex = (row: Row) => rows.indexOf(row);

  const rowClass = (index: number) =>
    `flex w-full items-center justify-between gap-3 border-l-2 px-3 py-2 text-left transition-colors ${
      index === highlight ? "border-cyan bg-panel-3" : "border-transparent hover:bg-panel-3"
    }`;

  return (
    <div ref={containerRef} className="relative w-full max-w-md">
      <div className="flex items-center gap-2 rounded-sm border border-edge bg-panel-2 px-3 focus-within:border-cyan/60">
        <svg viewBox="0 0 16 16" className="h-3.5 w-3.5 shrink-0 text-ink-3" aria-hidden>
          <circle cx="7" cy="7" r="4.5" fill="none" stroke="currentColor" strokeWidth="1.4" />
          <path d="M10.5 10.5L14 14" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
        </svg>
        <input
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          onFocus={() => rows.length > 0 && setOpen(true)}
          onKeyDown={(event) => {
            if (event.key === "ArrowDown") {
              event.preventDefault();
              setHighlight((h) => Math.min(h + 1, rows.length - 1));
            } else if (event.key === "ArrowUp") {
              event.preventDefault();
              setHighlight((h) => Math.max(h - 1, 0));
            } else if (event.key === "Enter" && rows[highlight]) {
              choose(rows[highlight]);
            } else if (event.key === "Escape") {
              setOpen(false);
            }
          }}
          placeholder="Aircraft · company · owner · airport"
          className="tabular w-full bg-transparent py-2 text-sm text-ink placeholder:font-sans placeholder:text-ink-3 focus:outline-none"
          aria-label="Search aircraft, companies, owners and airports"
          spellCheck={false}
          autoComplete="off"
        />
        {loading && <span className="h-3 w-3 animate-spin rounded-full border border-edge-2 border-t-cyan" />}
      </div>

      {open && rows.length > 0 && (
        <ul className="panel-scroll absolute z-30 mt-1 max-h-[70vh] w-full overflow-y-auto rounded-sm border border-edge bg-panel-2 shadow-2xl shadow-black/60">
          {results.aircraft.length > 0 && <GroupLabel>Aircraft</GroupLabel>}
          {results.aircraft.map((hit) => {
            const row: Row = { kind: "aircraft", value: hit };
            const index = rows.findIndex((r) => r.kind === "aircraft" && r.value === hit);
            return (
              <li key={`ac-${hit.icao24 ?? hit.registration}-${index}`}>
                <button
                  type="button"
                  onMouseEnter={() => setHighlight(index)}
                  onClick={() => choose(row)}
                  className={rowClass(index)}
                  // Rows are named by kind because the visible text alone is
                  // ambiguous: an aircraft matched on its owner reads exactly
                  // like the company row below it.
                  aria-label={`Aircraft ${
                    hit.registration ?? hit.callsign ?? hit.icao24?.toUpperCase() ?? "unknown"
                  }`}
                >
                  <span className="min-w-0">
                    <span className="tabular block truncate text-sm text-ink">
                      {hit.registration ?? hit.callsign ?? hit.icao24?.toUpperCase() ?? "—"}
                    </span>
                    <span className="block truncate text-[11px] text-ink-3">
                      {[hit.model ?? hit.typeCode, hit.owner ?? hit.operator]
                        .filter(Boolean)
                        .join(" · ") || `matched on ${hit.matchedOn}`}
                    </span>
                  </span>
                  <span className="shrink-0 text-right">
                    {hit.airborne ? (
                      <>
                        <span className="tabular block text-xs text-cyan">
                          {formatAltitude(hit.altBaroFt)}
                        </span>
                        <span className="block text-[10px] uppercase tracking-wider text-lime">
                          airborne
                        </span>
                      </>
                    ) : (
                      <span className="block text-[10px] uppercase tracking-wider text-ink-3">
                        {hit.lastSeenAt ? formatRelative(hit.lastSeenAt) : "on record"}
                      </span>
                    )}
                  </span>
                </button>
              </li>
            );
          })}

          {results.companies.length > 0 && <GroupLabel>Companies</GroupLabel>}
          {results.companies.map((company) => {
            const row: Row = { kind: "company", value: company };
            const index = rowIndex(rows.find((r) => r.kind === "company" && r.value === company)!);
            return (
              <li key={`co-${company.slug}`}>
                <button
                  type="button"
                  onMouseEnter={() => setHighlight(index)}
                  onClick={() => choose(row)}
                  className={rowClass(index)}
                  aria-label={`Company ${company.name}`}
                >
                  <span className="min-w-0">
                    <span className="block truncate text-sm text-ink">{company.name}</span>
                    <span className="block truncate text-[11px] text-ink-3">
                      Show fleet on map
                    </span>
                  </span>
                  <span className="tabular shrink-0 text-xs text-cyan">
                    {company.aircraftCount} aircraft
                  </span>
                </button>
              </li>
            );
          })}

          {(results.operators.length > 0 || results.owners.length > 0) && (
            <GroupLabel>Owners &amp; operators</GroupLabel>
          )}
          {rows
            .filter((r): r is Extract<Row, { kind: "owner" }> => r.kind === "owner")
            .map((row) => {
              const index = rowIndex(row);
              return (
                <li key={`ow-${row.value.role}-${row.value.name}`}>
                  <button
                    type="button"
                    onMouseEnter={() => setHighlight(index)}
                    onClick={() => choose(row)}
                    className={rowClass(index)}
                    aria-label={`${
                      row.value.role === "owner"
                        ? "Owner"
                        : row.value.role === "management"
                          ? "Management company"
                          : "Operator"
                    } ${row.value.name}`}
                  >
                    <span className="min-w-0">
                      <span className="block truncate text-sm text-ink">{row.value.name}</span>
                      <span className="block truncate text-[11px] text-ink-3">
                        {row.value.role === "owner"
                          ? "Registered owner"
                          : row.value.role === "management"
                            ? "Management company"
                            : "Operator"}
                      </span>
                    </span>
                    <span className="tabular shrink-0 text-[11px] text-ink-2">
                      {row.value.registrations.length}
                    </span>
                  </button>
                </li>
              );
            })}

          {results.airports.length > 0 && <GroupLabel>Airports</GroupLabel>}
          {results.airports.map((airport) => {
            const row: Row = { kind: "airport", value: airport };
            const index = rowIndex(rows.find((r) => r.kind === "airport" && r.value === airport)!);
            return (
              <li key={`ap-${airport.icao}`}>
                <button
                  type="button"
                  onMouseEnter={() => setHighlight(index)}
                  onClick={() => choose(row)}
                  className={rowClass(index)}
                  aria-label={`Airport ${airport.icao}${airport.name ? ` ${airport.name}` : ""}`}
                >
                  <span className="min-w-0">
                    <span className="tabular block truncate text-sm text-ink">
                      {airport.icao}
                      {airport.iata ? ` / ${airport.iata}` : ""}
                    </span>
                    <span className="block truncate text-[11px] text-ink-3">
                      {[airport.name, airport.city].filter(Boolean).join(" · ")}
                    </span>
                  </span>
                  <span className="shrink-0 text-[10px] uppercase tracking-wider text-ink-3">
                    {airport.country ?? ""}
                  </span>
                </button>
              </li>
            );
          })}
        </ul>
      )}

      {open && !loading && query.trim().length >= 2 && rows.length === 0 && (
        <div className="absolute z-30 mt-1 w-full rounded-sm border border-edge bg-panel-2 px-3 py-3 text-xs text-ink-3">
          Nothing found for “{query.trim()}”. Companies are matched against aircraft currently
          in coverage and against ownership already resolved — an operator with nothing airborne
          right now, and not yet researched, will not appear.
        </div>
      )}
    </div>
  );
}
