"use client";

import type { ReactNode } from "react";
import type { AircraftCategory, ConfidenceBand } from "@/lib/types";

/** Small presentational primitives shared across the panels. */

export function SectionTitle({ children, action }: { children: ReactNode; action?: ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-3 px-4 pt-5 pb-2">
      <h3 className="text-[11px] font-semibold uppercase tracking-[0.18em] text-ink-3">{children}</h3>
      {action}
    </div>
  );
}

export function Field({
  label,
  value,
  mono = true,
  accent,
}: {
  label: string;
  value: ReactNode;
  mono?: boolean;
  accent?: string;
}) {
  return (
    <div className="min-w-0">
      <div className="text-[10px] uppercase tracking-[0.12em] text-ink-3">{label}</div>
      <div
        className={`truncate text-sm ${mono ? "tabular" : ""}`}
        style={accent ? { color: accent } : undefined}
        title={typeof value === "string" ? value : undefined}
      >
        {value ?? "—"}
      </div>
    </div>
  );
}

export function Divider() {
  return <div className="mx-4 border-t border-edge" />;
}

export const CATEGORY_STYLE: Record<AircraftCategory, { label: string; color: string }> = {
  business_jet: { label: "Business jet", color: "#22d3ee" },
  private_jet: { label: "Private jet", color: "#22d3ee" },
  bizliner: { label: "VIP airliner", color: "#a78bfa" },
  turboprop: { label: "Turboprop", color: "#4ade80" },
  vip: { label: "VIP", color: "#f5a524" },
  charter: { label: "Charter", color: "#f5a524" },
  helicopter: { label: "Helicopter", color: "#38bdf8" },
  military: { label: "Military", color: "#f43f5e" },
  airliner: { label: "Airline", color: "#64748b" },
  light_ga: { label: "Light GA", color: "#94a3b8" },
  special: { label: "Special", color: "#f5a524" },
  unknown: { label: "Unidentified", color: "#94a3b8" },
};

export function CategoryBadge({ category }: { category: AircraftCategory }) {
  const style = CATEGORY_STYLE[category] ?? CATEGORY_STYLE.unknown;
  return (
    <span
      className="inline-flex items-center gap-1.5 rounded-sm border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.12em]"
      style={{ color: style.color, borderColor: `${style.color}44`, background: `${style.color}12` }}
    >
      <span className="h-1.5 w-1.5 rounded-full" style={{ background: style.color }} />
      {style.label}
    </span>
  );
}

const BAND_COLOR: Record<ConfidenceBand, string> = {
  high: "#4ade80",
  medium: "#f5a524",
  low: "#f97316",
  none: "#64748b",
};

export function ConfidenceMeter({
  confidence,
  band,
}: {
  confidence: number;
  band: ConfidenceBand;
}) {
  const color = BAND_COLOR[band];
  return (
    <div>
      <div className="flex items-baseline justify-between">
        <span className="tabular text-2xl font-semibold" style={{ color }}>
          {confidence}%
        </span>
        <span
          className="text-[10px] font-semibold uppercase tracking-[0.16em]"
          style={{ color }}
        >
          {band === "none" ? "unconfirmed" : band}
        </span>
      </div>
      <div className="mt-2 h-1 w-full overflow-hidden rounded-full bg-panel-3">
        <div
          className="h-full rounded-full transition-[width] duration-500"
          style={{ width: `${Math.max(2, confidence)}%`, background: color }}
        />
      </div>
    </div>
  );
}

export function SourceChip({
  label,
  url,
  kind,
}: {
  label: string;
  url: string;
  kind: string;
}) {
  const official = kind === "official_registry" || kind === "corporate_filing";
  return (
    <a
      href={url}
      target="_blank"
      rel="noopener noreferrer nofollow"
      className={`inline-flex max-w-full items-center gap-1.5 rounded-sm border px-2 py-1 text-[11px] transition-colors ${
        official
          ? "border-cyan/40 bg-cyan/10 text-cyan hover:bg-cyan/20"
          : "border-edge-2 bg-panel-3 text-ink-2 hover:border-cyan/40 hover:text-cyan"
      }`}
      title={url}
    >
      <span className="truncate">{label}</span>
      <svg viewBox="0 0 12 12" className="h-2.5 w-2.5 shrink-0 opacity-70" aria-hidden>
        <path
          d="M4.5 1.5h6v6M10.5 1.5L5 7M8 8.5v2h-6.5V4h2"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.2"
          strokeLinecap="round"
        />
      </svg>
    </a>
  );
}

export function EmptyNote({ children }: { children: ReactNode }) {
  return (
    <p className="px-4 py-3 text-xs leading-relaxed text-ink-3">{children}</p>
  );
}

export function Spinner({ label }: { label?: string }) {
  return (
    <div className="flex items-center gap-2 px-4 py-3 text-xs text-ink-3">
      <span className="h-3 w-3 animate-spin rounded-full border border-edge-2 border-t-cyan" />
      {label ?? "Loading…"}
    </div>
  );
}
