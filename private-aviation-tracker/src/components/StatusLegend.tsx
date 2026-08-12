"use client";

import { useState } from "react";
import { STATUS_ORDER, STATUS_STYLE } from "@/lib/aircraft/operationalClass";
import type { DataStatus } from "@/lib/types";

/**
 * The map's key.
 *
 * Colour on this map answers "how much do we know about this aircraft?", which
 * is not what a colour usually means on a flight tracker — so the legend has
 * to say so outright, or every user will read the palette as aircraft types.
 *
 * Counts come from what is actually in view, which makes the legend double as
 * a research summary: a screen of grey is a screen of unresearched contacts.
 */
export default function StatusLegend({
  counts,
  onFilter,
  active,
}: {
  counts?: Partial<Record<DataStatus, number>>;
  onFilter?: (status: DataStatus | null) => void;
  active?: DataStatus | null;
}) {
  const [open, setOpen] = useState(false);
  const total = STATUS_ORDER.reduce((sum, s) => sum + (counts?.[s] ?? 0), 0);

  return (
    <div className="pointer-events-auto">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        className="glass-chip flex items-center gap-2 px-2.5 py-1.5 text-[10px] uppercase tracking-[0.14em] text-ink-3 transition-colors hover:text-ink"
      >
        <span className="flex -space-x-0.5">
          {STATUS_ORDER.slice(0, 4).map((s) => (
            <span
              key={s}
              className="h-2 w-2 rounded-full ring-1 ring-ground"
              style={{ background: STATUS_STYLE[s].color }}
            />
          ))}
        </span>
        Status
      </button>

      {open && (
        <div className="glass-panel mt-1.5 w-[min(86vw,268px)] p-3">
          <div className="mb-2 flex items-baseline justify-between">
            <h2 className="text-[10px] uppercase tracking-[0.16em] text-ink-3">Aircraft status</h2>
            {total > 0 && <span className="tabular text-[10px] text-ink-3">{total} in view</span>}
          </div>

          <p className="mb-2.5 text-[10px] leading-relaxed text-ink-3">
            Colour shows what has been established about each aircraft — not its type. The
            silhouette shows the type.
          </p>

          <ul className="space-y-0.5">
            {STATUS_ORDER.map((status) => {
              const style = STATUS_STYLE[status];
              const count = counts?.[status] ?? 0;
              const isActive = active === status;
              return (
                <li key={status}>
                  <button
                    type="button"
                    onClick={() => onFilter?.(isActive ? null : status)}
                    disabled={!onFilter}
                    aria-pressed={isActive}
                    className={`flex w-full items-center gap-2 rounded-[3px] px-1.5 py-1 text-left transition-colors ${
                      isActive ? "bg-panel-3" : "hover:bg-panel-3/60"
                    } ${onFilter ? "cursor-pointer" : "cursor-default"} ${
                      count === 0 && total > 0 ? "opacity-45" : ""
                    }`}
                  >
                    <span
                      className="h-2 w-2 shrink-0 rounded-full"
                      style={{ background: style.color, boxShadow: `0 0 6px ${style.color}66` }}
                    />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-[11px] text-ink-2">{style.label}</span>
                      <span className="block truncate text-[9px] leading-tight text-ink-3">
                        {style.description}
                      </span>
                    </span>
                    {total > 0 && (
                      <span className="tabular shrink-0 text-[11px] text-ink">{count}</span>
                    )}
                  </button>
                </li>
              );
            })}
          </ul>

          {onFilter && (
            <p className="mt-2 border-t border-edge pt-2 text-[9px] leading-relaxed text-ink-3">
              Tap a status to show only those aircraft.
            </p>
          )}
        </div>
      )}
    </div>
  );
}
