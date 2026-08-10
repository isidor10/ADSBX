"use client";

import { useEffect, useState } from "react";
import { Divider, EmptyNote, SectionTitle, Spinner } from "@/components/ui";
import type { CostEstimate, LikelyBase } from "@/lib/types";

/**
 * ESTIMATED OPERATING COST.
 *
 * Three deliberate choices, all about not overstating what this is:
 *
 *   - Every figure is a range. A single number to the euro would imply a
 *     precision that class performance data cannot support.
 *   - Charter price is shown in its own block, visually separated, because it
 *     is a different quantity from operating cost — not the same number with
 *     a margin quietly folded in.
 *   - Each line item can be expanded to show exactly where its number came
 *     from and how firm it is.
 */

function money(value: number, currency: string): string {
  const symbol = currency === "EUR" ? "€" : currency === "USD" ? "$" : `${currency} `;
  if (value >= 100000) return `${symbol}${Math.round(value / 1000)}k`;
  return `${symbol}${Math.round(value).toLocaleString("en-US")}`;
}

const BASIS_LABEL: Record<string, { text: string; color: string }> = {
  PUBLISHED_PERFORMANCE: { text: "Published performance", color: "#4ade80" },
  CLASS_ESTIMATE: { text: "Class estimate", color: "#f5a524" },
  CONFIGURED_RATE: { text: "Configured rate", color: "#94a3b8" },
};

export default function CostEstimateSection({
  registration,
  visible,
}: {
  registration: string | null;
  visible: boolean;
}) {
  const [estimate, setEstimate] = useState<CostEstimate | null>(null);
  const [base, setBase] = useState<LikelyBase | null>(null);
  const [fullAvailable, setFullAvailable] = useState(false);
  const [mode, setMode] = useState<"DIRECT" | "FULL">("DIRECT");
  const [loading, setLoading] = useState(false);
  const [unavailable, setUnavailable] = useState<string | null>(null);
  const [expanded, setExpanded] = useState<string | null>(null);

  useEffect(() => {
    if (!registration || !visible) return;
    const controller = new AbortController();
    setLoading(true);
    setUnavailable(null);

    void (async () => {
      try {
        const response = await fetch(
          `/api/aircraft/${encodeURIComponent(registration)}/cost?mode=${mode}`,
          { signal: controller.signal },
        );
        if (response.status === 422) {
          const body = await response.json();
          setEstimate(null);
          setUnavailable(body.detail ?? body.message);
          return;
        }
        if (!response.ok) return;
        const body = await response.json();
        setEstimate(body.estimate);
        setBase(body.base);
        setFullAvailable(body.fullModeAvailable);
      } catch {
        /* section renders its own empty state */
      } finally {
        setLoading(false);
      }
    })();

    return () => controller.abort();
  }, [registration, mode, visible]);

  if (!visible) return null;

  return (
    <>
      <Divider />
      <section>
        <SectionTitle
          action={
            <div className="flex gap-1">
              {(["DIRECT", "FULL"] as const).map((m) => (
                <button
                  key={m}
                  type="button"
                  disabled={m === "FULL" && !fullAvailable}
                  onClick={() => setMode(m)}
                  title={
                    m === "FULL" && !fullAvailable
                      ? "Needs a likely base, which requires more recorded flights"
                      : m === "FULL"
                        ? "Include positioning to the departure airport and the return to base"
                        : "Passenger leg only"
                  }
                  className={`rounded-sm border px-1.5 py-0.5 text-[10px] tracking-[0.08em] transition-colors ${
                    mode === m
                      ? "border-cyan/50 bg-cyan/15 text-cyan"
                      : m === "FULL" && !fullAvailable
                        ? "cursor-not-allowed border-edge/50 text-ink-3/40"
                        : "border-edge bg-panel-2 text-ink-2 hover:text-ink"
                  }`}
                >
                  {m === "DIRECT" ? "Direct" : "Full operation"}
                </button>
              ))}
            </div>
          }
        >
          Estimated operating cost
        </SectionTitle>

        {loading && !estimate && <Spinner label="Estimating…" />}

        {unavailable && !loading && <EmptyNote>{unavailable}</EmptyNote>}

        {estimate && !unavailable && (
          <div className="px-4 pb-4">
            {/* ---- headline range ---- */}
            <div className="rounded-sm border border-edge bg-panel-2 px-3 py-3">
              <div className="flex items-end justify-between gap-3">
                <div>
                  <div className="text-[10px] uppercase tracking-[0.14em] text-ink-3">
                    Most likely
                  </div>
                  <div className="tabular text-2xl font-semibold text-cyan">
                    {money(estimate.total.likely, estimate.currency)}
                  </div>
                </div>
                <div className="text-right text-[11px] text-ink-3">
                  <div className="tabular">
                    {money(estimate.total.low, estimate.currency)} —{" "}
                    {money(estimate.total.high, estimate.currency)}
                  </div>
                  <div>low / high estimate</div>
                </div>
              </div>

              <div className="mt-2 grid grid-cols-3 gap-2 border-t border-edge pt-2 text-[11px]">
                <div>
                  <div className="text-[9px] uppercase tracking-[0.1em] text-ink-3">Distance</div>
                  <div className="tabular text-ink-2">
                    {estimate.totalRoutedNm.toLocaleString()} NM
                  </div>
                </div>
                <div>
                  <div className="text-[9px] uppercase tracking-[0.1em] text-ink-3">Block time</div>
                  <div className="tabular text-ink-2">
                    {Math.floor(estimate.totalBlockHours)}h{" "}
                    {Math.round((estimate.totalBlockHours % 1) * 60)}m
                  </div>
                </div>
                <div>
                  <div className="text-[9px] uppercase tracking-[0.1em] text-ink-3">Fuel</div>
                  <div className="tabular text-ink-2">
                    {estimate.totalFuelLitres.toLocaleString()} L
                  </div>
                </div>
              </div>
            </div>

            {/* ---- legs ---- */}
            {estimate.legs.length > 1 && (
              <ul className="mt-2 space-y-1">
                {estimate.legs.map((leg, i) => (
                  <li
                    key={`${leg.kind}-${i}`}
                    className="flex items-center justify-between gap-2 rounded-sm border border-edge bg-panel-2/60 px-2.5 py-1.5 text-[11px]"
                  >
                    <span className="min-w-0">
                      <span
                        className={`mr-2 text-[9px] uppercase tracking-[0.1em] ${
                          leg.kind === "PASSENGER" ? "text-cyan" : "text-amber"
                        }`}
                      >
                        {leg.kind === "PASSENGER"
                          ? "passenger"
                          : leg.kind === "POSITIONING"
                            ? "positioning"
                            : "return"}
                      </span>
                      <span className="tabular text-ink-2">
                        {leg.from?.icao ?? leg.from?.name} → {leg.to?.icao ?? leg.to?.name}
                      </span>
                    </span>
                    <span className="tabular shrink-0 text-ink-3">
                      {leg.routedNm.toLocaleString()} NM
                    </span>
                  </li>
                ))}
              </ul>
            )}

            {/* ---- breakdown ---- */}
            <ul className="mt-3 space-y-1">
              {estimate.lines.map((line) => {
                const basis = BASIS_LABEL[line.basis];
                const open = expanded === line.key;
                return (
                  <li key={line.key}>
                    <button
                      type="button"
                      onClick={() => setExpanded(open ? null : line.key)}
                      className="flex w-full items-center justify-between gap-3 rounded-sm px-1 py-1 text-left transition-colors hover:bg-panel-2"
                    >
                      <span className="flex min-w-0 items-center gap-2">
                        <span className="text-xs text-ink-2">{line.label}</span>
                        <span
                          className="rounded-sm px-1 py-0.5 text-[8px] uppercase tracking-[0.1em]"
                          style={{ color: basis.color, background: `${basis.color}15` }}
                        >
                          {basis.text}
                        </span>
                      </span>
                      <span className="tabular shrink-0 text-xs text-ink">
                        {money(line.likely, estimate.currency)}
                      </span>
                    </button>
                    {open && (
                      <p className="px-1 pb-2 text-[10px] leading-relaxed text-ink-3">
                        {money(line.low, estimate.currency)} –{" "}
                        {money(line.high, estimate.currency)}. {line.note}
                      </p>
                    )}
                  </li>
                );
              })}
            </ul>

            {estimate.rangeWarning && (
              <p className="mt-2 rounded-sm border border-amber/40 bg-amber/10 px-2.5 py-2 text-[10px] leading-relaxed text-amber">
                {estimate.rangeWarning}
              </p>
            )}

            {/* ---- charter price, deliberately separate ---- */}
            {estimate.charter && (
              <div className="mt-3 rounded-sm border border-edge-2 bg-panel-3/50 px-3 py-2.5">
                <div className="text-[10px] uppercase tracking-[0.14em] text-ink-3">
                  Estimated charter market price
                </div>
                <div className="tabular mt-0.5 text-lg font-semibold text-ink">
                  {money(estimate.charter.low, estimate.currency)} –{" "}
                  {money(estimate.charter.high, estimate.currency)}
                </div>
                <p className="mt-1 text-[10px] leading-relaxed text-ink-3">
                  {estimate.charter.note}
                </p>
              </div>
            )}

            {base?.known && (
              <p className="mt-2 text-[10px] leading-relaxed text-ink-3">
                <span className="text-ink-2">
                  Likely base: {base.airport?.icao} {base.airport?.city ?? base.airport?.name}
                </span>{" "}
                · inferred, {base.confidence}% confidence from {base.movements} movements.
              </p>
            )}

            <details className="mt-2">
              <summary className="cursor-pointer text-[10px] uppercase tracking-[0.12em] text-ink-3 hover:text-ink-2">
                Assumptions
              </summary>
              <ul className="mt-1 space-y-1 text-[10px] leading-relaxed text-ink-3">
                {estimate.assumptions.map((a) => (
                  <li key={a}>• {a}</li>
                ))}
              </ul>
            </details>

            <p className="mt-2 border-t border-edge pt-2 text-[10px] leading-relaxed text-ink-3">
              {estimate.disclaimer}
            </p>
          </div>
        )}
      </section>
    </>
  );
}
