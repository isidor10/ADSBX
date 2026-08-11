"use client";

import { useState } from "react";
import type { ProviderHealth } from "@/lib/types";

/**
 * Data-source health.
 *
 * Deliberately tucked behind a small button rather than shown on the map: which
 * vendor is currently carrying the feed is a diagnostic, not something a user
 * watching aircraft needs in their eyeline. It only asserts itself when the
 * chain is degraded, because that is when it explains something the user can
 * see.
 */

const STATUS_STYLE: Record<ProviderHealth["status"], { label: string; color: string }> = {
  LIVE: { label: "Live", color: "#4ade80" },
  STANDBY: { label: "Standby", color: "#64748b" },
  RATE_LIMITED: { label: "Rate limited", color: "#f5a524" },
  BACKING_OFF: { label: "Backing off", color: "#f97316" },
  DISABLED: { label: "Disabled", color: "#475569" },
};

function ago(iso: string | null): string {
  if (!iso) return "never";
  const sec = Math.round((Date.now() - new Date(iso).getTime()) / 1000);
  if (sec < 60) return `${sec}s ago`;
  if (sec < 3600) return `${Math.round(sec / 60)}m ago`;
  return `${Math.round(sec / 3600)}h ago`;
}

export default function DataSources({
  providers,
  servedBy,
  degraded,
  updatedAt,
  aircraftCount,
  degradedIdentityCount,
  lastKnownCount,
}: {
  providers: ProviderHealth[];
  servedBy?: string | null;
  degraded?: boolean;
  updatedAt: number | null;
  aircraftCount: number;
  degradedIdentityCount?: number;
  lastKnownCount?: number;
}) {
  const [open, setOpen] = useState(false);
  if (providers.length === 0) return null;

  const freshnessSec = updatedAt ? Math.round((Date.now() - updatedAt) / 1000) : null;
  // Retention is its own state, not just "degraded": the positions on screen
  // are real but were not refreshed on this poll, and that distinction is the
  // difference between trusting the map and being misled by it.
  const coverage = lastKnownCount
    ? { label: "Last known", color: "#f5a524" }
    : degraded
      ? { label: "Degraded", color: "#f5a524" }
      : freshnessSec !== null && freshnessSec < 30
        ? { label: "Good", color: "#4ade80" }
        : { label: "Stale", color: "#f5a524" };

  return (
    <div className="pointer-events-auto absolute bottom-6 left-4 z-20">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className={`flex items-center gap-2 rounded-sm border px-2 py-1 text-[10px] uppercase tracking-[0.12em] backdrop-blur-md transition-colors ${
          degraded
            ? "border-amber/50 bg-amber/15 text-amber"
            : "border-edge bg-panel/85 text-ink-3 hover:text-ink"
        }`}
        aria-expanded={open}
      >
        <span className="h-1.5 w-1.5 rounded-full" style={{ background: coverage.color }} />
        {degraded ? "Live data degraded" : "Data sources"}
      </button>

      {open && (
        <div className="mt-1.5 w-[min(88vw,340px)] rounded-sm border border-edge bg-panel/95 p-3 backdrop-blur-md">
          <div className="mb-2 grid grid-cols-3 gap-2 border-b border-edge pb-2 text-[10px]">
            <div>
              <div className="uppercase tracking-[0.1em] text-ink-3">Visible</div>
              <div className="tabular text-sm text-ink">{aircraftCount.toLocaleString()}</div>
            </div>
            <div>
              <div className="uppercase tracking-[0.1em] text-ink-3">Freshness</div>
              <div className="tabular text-sm text-ink">
                {freshnessSec === null ? "—" : `${freshnessSec}s`}
              </div>
            </div>
            <div>
              <div className="uppercase tracking-[0.1em] text-ink-3">Coverage</div>
              <div className="text-sm" style={{ color: coverage.color }}>
                {coverage.label}
              </div>
            </div>
          </div>

          <ul className="space-y-1.5">
            {providers.map((p) => {
              const style = STATUS_STYLE[p.status];
              const serving = servedBy === p.name;
              return (
                <li key={p.name} className="text-[11px]">
                  <div className="flex items-center justify-between gap-2">
                    <span className="flex min-w-0 items-center gap-1.5">
                      <span
                        className="h-1.5 w-1.5 shrink-0 rounded-full"
                        style={{ background: style.color }}
                      />
                      <span className="truncate text-ink-2">{p.name}</span>
                      {serving && (
                        <span className="shrink-0 text-[8px] uppercase tracking-[0.1em] text-cyan">
                          serving
                        </span>
                      )}
                    </span>
                    <span className="shrink-0 text-[10px]" style={{ color: style.color }}>
                      {style.label}
                    </span>
                  </div>
                  <div className="tabular ml-3 mt-0.5 text-[10px] text-ink-3">
                    {p.status === "DISABLED"
                      ? "not configured"
                      : [
                          p.lastCount !== null ? `${p.lastCount} aircraft` : null,
                          p.lastLatencyMs !== null ? `${p.lastLatencyMs} ms` : null,
                          p.lastSuccessAt ? `ok ${ago(p.lastSuccessAt)}` : null,
                          p.retryInSec !== null ? `retry in ${p.retryInSec}s` : null,
                        ]
                          .filter(Boolean)
                          .join(" · ") || "no requests yet"}
                  </div>
                  {p.lastError && p.status !== "LIVE" && (
                    <div className="ml-3 mt-0.5 line-clamp-2 text-[9px] leading-relaxed text-ink-3">
                      {p.lastError}
                    </div>
                  )}
                </li>
              );
            })}
          </ul>

          {lastKnownCount ? (
            <p className="mt-2 border-t border-edge pt-2 text-[9px] leading-relaxed text-amber">
              No source answered for this view. {lastKnownCount} aircraft
              {lastKnownCount === 1 ? " is" : " are"} drawn at the last position actually received —
              not a live fix. Each aircraft&apos;s own timestamp is in its panel.
            </p>
          ) : null}

          {degradedIdentityCount ? (
            <p className="mt-2 border-t border-edge pt-2 text-[9px] leading-relaxed text-ink-3">
              {degradedIdentityCount} contact{degradedIdentityCount === 1 ? "" : "s"} came from a
              source that carries no registration or aircraft type, so the private/business filter
              cannot classify them by airframe.
            </p>
          ) : null}
        </div>
      )}
    </div>
  );
}
