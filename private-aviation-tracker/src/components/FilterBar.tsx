"use client";

import type { FilterKey } from "@/lib/types";

/**
 * Category filters. "Private / Business Aviation" is the default view; the
 * others are additive, and "All aircraft" overrides the rest.
 */

interface FilterOption {
  key: FilterKey;
  label: string;
  hint: string;
  color: string;
}

export const FILTER_OPTIONS: FilterOption[] = [
  {
    key: "business",
    label: "Private / Business",
    hint: "Jets, VIP airliners, business turboprops and charter",
    color: "#22d3ee",
  },
  { key: "private_jet", label: "Jets only", hint: "Business and private jets", color: "#22d3ee" },
  { key: "bizliner", label: "VIP airliners", hint: "ACJ, BBJ and converted widebodies", color: "#a78bfa" },
  { key: "turboprop", label: "Turboprops", hint: "PC-12, King Air, TBM, Avanti", color: "#4ade80" },
  { key: "vip", label: "VIP", hint: "Flagged VIP and head-of-state aircraft", color: "#f5a524" },
  { key: "charter", label: "Charter", hint: "Fractional and charter operators", color: "#f5a524" },
  { key: "helicopter", label: "Helicopters", hint: "Rotorcraft (off by default)", color: "#38bdf8" },
  { key: "military", label: "Military", hint: "Military and state aircraft (off by default)", color: "#f43f5e" },
  { key: "all", label: "All aircraft", hint: "Includes airline traffic and light GA", color: "#94a3b8" },
];

export default function FilterBar({
  filters,
  onChange,
}: {
  filters: FilterKey[];
  onChange: (filters: FilterKey[]) => void;
}) {
  const toggle = (key: FilterKey) => {
    if (key === "all") {
      onChange(filters.includes("all") ? ["business"] : ["all"]);
      return;
    }
    const withoutAll = filters.filter((f) => f !== "all");
    const next = withoutAll.includes(key)
      ? withoutAll.filter((f) => f !== key)
      : [...withoutAll, key];
    onChange(next.length === 0 ? ["business"] : next);
  };

  return (
    <div className="flex flex-wrap items-center gap-1.5">
      {FILTER_OPTIONS.map((option) => {
        const active = filters.includes(option.key);
        return (
          <button
            key={option.key}
            type="button"
            onClick={() => toggle(option.key)}
            title={option.hint}
            aria-pressed={active}
            className={`rounded-sm border px-2.5 py-1 text-[11px] font-medium transition-colors ${
              active
                ? "text-ground"
                : "border-edge bg-panel-2 text-ink-2 hover:border-edge-2 hover:text-ink"
            }`}
            style={
              active
                ? { background: option.color, borderColor: option.color, color: "#04060c" }
                : undefined
            }
          >
            {option.label}
          </button>
        );
      })}
    </div>
  );
}
