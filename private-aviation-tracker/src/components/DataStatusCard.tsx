"use client";

import { STATUS_STYLE, OPERATION_LABEL } from "@/lib/aircraft/operationalClass";
import { SectionTitle } from "@/components/ui";
import type { LiveAircraft, StatusReason } from "@/lib/types";

/**
 * Why this aircraft is the colour it is.
 *
 * A colour-coded map is only trustworthy if the coding can be interrogated.
 * Every marker's colour is a claim about how much has been established, and
 * this is where that claim is made accountable: the verdict, the confidence,
 * and the individual pieces of evidence with what each one contributed.
 */

const SOURCE_LABEL: Record<StatusReason["source"], string> = {
  FEED: "ADS-B feed",
  CALLSIGN: "Callsign",
  AIRFRAME: "Aircraft type",
  REGISTRY: "Official registry",
  RESEARCH: "Web research",
  OPERATOR: "Operator record",
  COMPANY: "Company record",
  AOC: "Air Operator Certificate",
};

function confidenceBand(value: number): { label: string; color: string } {
  if (value >= 70) return { label: "High", color: "#34d399" };
  if (value >= 40) return { label: "Medium", color: "#facc15" };
  return { label: "Low", color: "#fb923c" };
}

/** §18: a bar, the number, and — the part that matters — what it is based on. */
export function ConfidenceBar({ value }: { value: number }) {
  const band = confidenceBand(value);
  const filled = Math.round(value / 10);
  return (
    <div className="flex items-center gap-2">
      <span className="tabular text-[11px] tracking-tight" style={{ color: band.color }}>
        {"█".repeat(filled)}
        <span className="text-edge-2">{"░".repeat(10 - filled)}</span>
      </span>
      <span className="tabular text-[11px] text-ink">{value}%</span>
      <span className="text-[10px] uppercase tracking-[0.12em]" style={{ color: band.color }}>
        {band.label}
      </span>
    </div>
  );
}

export default function DataStatusCard({ live }: { live: LiveAircraft }) {
  const status = live.dataStatus ?? "UNKNOWN";
  const style = STATUS_STYLE[status];
  const confidence = live.statusConfidence ?? 0;
  const reasons = live.statusReasons ?? [];

  // Evidence that contributed to the score, heaviest first; explanatory notes
  // (weight 0) follow, because they are context rather than support.
  const supporting = reasons.filter((r) => r.weight > 0).sort((a, b) => b.weight - a.weight);
  const notes = reasons.filter((r) => r.weight === 0);

  return (
    <section>
      <SectionTitle>Data status</SectionTitle>

      <div className="px-4 pb-1">
        <div
          className="flex items-center gap-2.5 rounded-[6px] border px-3 py-2.5"
          style={{
            borderColor: `${style.color}40`,
            background: `linear-gradient(180deg, ${style.color}14, transparent)`,
          }}
        >
          <span
            className="h-2.5 w-2.5 shrink-0 rounded-full"
            style={{ background: style.color, boxShadow: `0 0 10px ${style.color}80` }}
          />
          <div className="min-w-0">
            <div className="text-[13px] font-medium text-ink">{style.label}</div>
            <div className="text-[10px] leading-relaxed text-ink-2">
              {style.description}
              {live.operation ? ` · Classified as ${OPERATION_LABEL[live.operation].toLowerCase()}.` : ""}
            </div>
          </div>
        </div>

        <div className="mt-3">
          <div className="mb-1 text-[10px] uppercase tracking-[0.12em] text-ink-3">
            Data confidence
          </div>
          <ConfidenceBar value={confidence} />
        </div>

        {supporting.length > 0 && (
          <div className="mt-3">
            <div className="mb-1.5 text-[10px] uppercase tracking-[0.12em] text-ink-3">
              Based on
            </div>
            <ul className="space-y-1.5">
              {supporting.map((reason, i) => (
                <li key={`${reason.label}-${i}`} className="flex gap-2">
                  <span className="tabular mt-0.5 shrink-0 text-[10px] text-lime">
                    +{reason.weight}
                  </span>
                  <span className="min-w-0">
                    <span className="block text-[11px] text-ink-2">
                      {reason.label}
                      <span className="ml-1.5 text-[9px] uppercase tracking-[0.1em] text-ink-3">
                        {SOURCE_LABEL[reason.source]}
                      </span>
                    </span>
                    <span className="block text-[10px] leading-relaxed text-ink-3">
                      {reason.detail}
                    </span>
                  </span>
                </li>
              ))}
            </ul>
          </div>
        )}

        {notes.length > 0 && (
          <div className="mt-3 border-t border-edge pt-2">
            <ul className="space-y-1">
              {notes.map((reason, i) => (
                <li key={`${reason.label}-${i}`} className="text-[10px] leading-relaxed text-ink-3">
                  <span className="text-ink-2">{reason.label}.</span> {reason.detail}
                </li>
              ))}
            </ul>
          </div>
        )}

        {supporting.length === 0 && notes.length === 0 && (
          <p className="mt-3 text-[11px] leading-relaxed text-ink-3">
            Nothing beyond a position and a transponder address has been established for this
            contact.
          </p>
        )}
      </div>
    </section>
  );
}

// ---------------------------------------------------------------------------

export interface CompletenessField {
  label: string;
  present: boolean;
}

/**
 * §19: how complete this aircraft's profile is.
 *
 * Useful precisely because it names what is *missing* — for research work,
 * the gap is the actionable part, not the score.
 */
export function CompletenessCard({ fields }: { fields: CompletenessField[] }) {
  const present = fields.filter((f) => f.present);
  const missing = fields.filter((f) => !f.present);
  const pct = fields.length === 0 ? 0 : Math.round((present.length / fields.length) * 100);

  return (
    <section>
      <SectionTitle>Profile completeness</SectionTitle>
      <div className="px-4 pb-1">
        <div className="mb-2 flex items-baseline gap-2">
          <span className="tabular text-2xl font-light text-ink">{pct}%</span>
          <span className="text-[10px] uppercase tracking-[0.14em] text-ink-3">
            {present.length} of {fields.length} fields
          </span>
        </div>

        <div className="mb-3 h-1 overflow-hidden rounded-full bg-panel-3">
          <div
            className="h-full rounded-full bg-cyan transition-[width] duration-500"
            style={{ width: `${pct}%` }}
          />
        </div>

        <ul className="grid grid-cols-2 gap-x-3 gap-y-1">
          {present.map((f) => (
            <li key={f.label} className="flex items-center gap-1.5 text-[11px] text-ink-2">
              <span className="text-lime">✓</span>
              {f.label}
            </li>
          ))}
          {missing.map((f) => (
            <li key={f.label} className="flex items-center gap-1.5 text-[11px] text-ink-3">
              <span className="text-edge-2">○</span>
              {f.label}
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
