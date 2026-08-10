"use client";

import { useEffect, useRef, useState } from "react";
import { formatAltitude, formatRelative } from "@/lib/format";
import type { SearchHit } from "@/lib/types";

/**
 * Global search over registration, callsign, ICAO hex, model, owner and
 * operator. Airborne matches are ranked first and jump the map to the
 * aircraft; grounded ones open the last known information.
 */
export default function SearchBar({ onSelect }: { onSelect: (hit: SearchHit) => void }) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchHit[]>([]);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [highlight, setHighlight] = useState(0);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const term = query.trim();
    if (term.length < 2) {
      setResults([]);
      setLoading(false);
      return;
    }

    const controller = new AbortController();
    setLoading(true);
    const timer = setTimeout(async () => {
      try {
        const response = await fetch(`/api/search?q=${encodeURIComponent(term)}`, {
          signal: controller.signal,
        });
        const body = await response.json();
        setResults(body.results ?? []);
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
  }, [query]);

  useEffect(() => {
    const onClickAway = (event: MouseEvent) => {
      if (!containerRef.current?.contains(event.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onClickAway);
    return () => document.removeEventListener("mousedown", onClickAway);
  }, []);

  const choose = (hit: SearchHit) => {
    onSelect(hit);
    setOpen(false);
  };

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
          onFocus={() => results.length > 0 && setOpen(true)}
          onKeyDown={(event) => {
            if (event.key === "ArrowDown") {
              event.preventDefault();
              setHighlight((h) => Math.min(h + 1, results.length - 1));
            } else if (event.key === "ArrowUp") {
              event.preventDefault();
              setHighlight((h) => Math.max(h - 1, 0));
            } else if (event.key === "Enter" && results[highlight]) {
              choose(results[highlight]);
            } else if (event.key === "Escape") {
              setOpen(false);
            }
          }}
          placeholder="Search aircraft…  N650XX · G-XXXX · G650 · owner"
          className="tabular w-full bg-transparent py-2 text-sm text-ink placeholder:font-sans placeholder:text-ink-3 focus:outline-none"
          aria-label="Search aircraft"
          spellCheck={false}
          autoComplete="off"
        />
        {loading && <span className="h-3 w-3 animate-spin rounded-full border border-edge-2 border-t-cyan" />}
      </div>

      {open && results.length > 0 && (
        <ul className="panel-scroll absolute z-30 mt-1 max-h-96 w-full overflow-y-auto rounded-sm border border-edge bg-panel-2 shadow-2xl shadow-black/60">
          {results.map((hit, index) => (
            <li key={`${hit.icao24 ?? hit.registration}-${index}`}>
              <button
                type="button"
                onMouseEnter={() => setHighlight(index)}
                onClick={() => choose(hit)}
                className={`flex w-full items-center justify-between gap-3 border-l-2 px-3 py-2 text-left transition-colors ${
                  index === highlight
                    ? "border-cyan bg-panel-3"
                    : "border-transparent hover:bg-panel-3"
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
          ))}
        </ul>
      )}

      {open && !loading && query.trim().length >= 2 && results.length === 0 && (
        <div className="absolute z-30 mt-1 w-full rounded-sm border border-edge bg-panel-2 px-3 py-3 text-xs text-ink-3">
          No aircraft found for “{query.trim()}”.
        </div>
      )}
    </div>
  );
}
