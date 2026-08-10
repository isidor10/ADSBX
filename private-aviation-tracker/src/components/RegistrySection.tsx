"use client";

import { useEffect, useState } from "react";
import { Divider, EmptyNote, Field, SectionTitle, Spinner } from "@/components/ui";
import type { SerbianRegistryResult } from "@/lib/types";

/**
 * Official national register (DCV) and AOC status.
 *
 * Rendered only for registrations the section actually applies to, and built
 * around two distinctions that matter:
 *
 *   - The register's *holder* is not necessarily the operator, so both are
 *     shown with their own labels.
 *   - "NOT FOUND" is not "NO". An operator missing from the imported list may
 *     simply not have been imported, and the copy says so rather than implying
 *     the company flies without a certificate.
 *
 * A disagreement between the official register and the researched pipeline is
 * displayed as a conflict, never silently resolved.
 */
export default function RegistrySection({ registration }: { registration: string | null }) {
  const [data, setData] = useState<SerbianRegistryResult | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    setData(null);
    if (!registration) return;
    const controller = new AbortController();
    setLoading(true);
    void (async () => {
      try {
        const response = await fetch(
          `/api/aircraft/${encodeURIComponent(registration)}/registry`,
          { signal: controller.signal },
        );
        if (response.ok) setData(await response.json());
      } catch {
        /* section renders nothing on failure */
      } finally {
        setLoading(false);
      }
    })();
    return () => controller.abort();
  }, [registration]);

  // Not a registration this section covers — render nothing at all.
  if (!data?.applicable && !loading) return null;
  if (loading && !data) {
    return (
      <>
        <Divider />
        <section>
          <SectionTitle>Official registry</SectionTitle>
          <Spinner label="Checking the national register…" />
        </section>
      </>
    );
  }
  if (!data?.applicable) return null;

  const { record, aoc, conflicts, note } = data;

  return (
    <>
      <Divider />
      <section>
        <SectionTitle>
          <span className="flex items-center gap-2">
            DCV · Serbian registry
            <span className="rounded-sm border border-lime/40 bg-lime/10 px-1.5 py-0.5 text-[8px] font-semibold uppercase tracking-[0.12em] text-lime">
              official source
            </span>
          </span>
        </SectionTitle>

        {!record && <EmptyNote>{note}</EmptyNote>}

        {record && (
          <div className="px-4 pb-4">
            <div className="grid grid-cols-2 gap-3">
              <Field label="Registration" value={record.registration} />
              <Field label="Serial number" value={record.serialNumber ?? "—"} />
              <Field label="Manufacturer" value={record.manufacturer ?? "—"} mono={false} />
              <Field label="Model" value={record.model ?? record.aircraftType ?? "—"} mono={false} />
              <Field
                label="Registered holder"
                value={record.registeredHolder ?? "—"}
                mono={false}
              />
              <Field label="Operator" value={record.operator ?? "—"} mono={false} />
              {record.yearBuilt && <Field label="Year built" value={record.yearBuilt} />}
              {record.status && <Field label="Status" value={record.status} mono={false} />}
            </div>

            <p className="mt-2 text-[10px] leading-relaxed text-ink-3">
              The register records the <span className="text-ink-2">holder</span>, which is not
              always the operator and is not necessarily the beneficial owner.
            </p>

            {/* ---- AOC ---- */}
            {aoc && (
              <div className="mt-3 rounded-sm border border-edge bg-panel-2 px-3 py-2.5">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-[10px] uppercase tracking-[0.14em] text-ink-3">
                    Air operator certificate
                  </span>
                  <span
                    className={`rounded-sm border px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-[0.12em] ${
                      aoc.status === "HOLDER"
                        ? "border-lime/40 bg-lime/10 text-lime"
                        : "border-edge-2 bg-panel-3 text-ink-3"
                    }`}
                  >
                    {aoc.status === "HOLDER" ? "AOC holder" : "not found"}
                  </span>
                </div>

                {aoc.status === "HOLDER" ? (
                  <div className="mt-2 grid grid-cols-2 gap-3">
                    <Field label="Operator" value={aoc.name ?? "—"} mono={false} />
                    <Field label="AOC number" value={aoc.aocNumber ?? "not published"} />
                    <Field
                      label="Type of operation"
                      value={aoc.operationType ?? "—"}
                      mono={false}
                    />
                    <Field
                      label="Operating licence"
                      value={aoc.operatingLicence ?? "—"}
                      mono={false}
                    />
                    {aoc.principalPlace && (
                      <Field
                        label="Principal place of business"
                        value={aoc.principalPlace}
                        mono={false}
                      />
                    )}
                  </div>
                ) : (
                  <p className="mt-1.5 text-[10px] leading-relaxed text-ink-3">{aoc.note}</p>
                )}
              </div>
            )}

            {/* ---- source conflicts ---- */}
            {conflicts.length > 0 && (
              <div className="mt-3 rounded-sm border border-amber/40 bg-amber/10 px-3 py-2.5">
                <div className="text-[10px] font-semibold uppercase tracking-[0.14em] text-amber">
                  Source conflict
                </div>
                {conflicts.map((c) => (
                  <div key={`${c.field}-${c.alternative}`} className="mt-1.5 text-[11px]">
                    <div className="text-ink-2">
                      {c.field === "operator" ? "Operator" : "Holder"}
                    </div>
                    <div className="tabular mt-0.5 text-ink">
                      {c.officialSource}: {c.official}
                    </div>
                    <div className="tabular text-ink-3">
                      {c.alternativeSource}: {c.alternative}
                    </div>
                  </div>
                ))}
                <p className="mt-1.5 text-[10px] leading-relaxed text-amber/80">
                  The official register takes priority, but the disagreement is shown rather than
                  hidden — a register can lag a change of operator.
                </p>
              </div>
            )}

            <div className="mt-3 flex flex-wrap items-center gap-2 border-t border-edge pt-2 text-[10px] text-ink-3">
              <span>Source:</span>
              {record.sourceUrl ? (
                <a
                  href={record.sourceUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-cyan hover:underline"
                >
                  {record.sourceName} ↗
                </a>
              ) : (
                <span className="text-ink-2">{record.sourceName}</span>
              )}
              <span aria-hidden>·</span>
              <span>last verified {new Date(record.verifiedAt).toLocaleDateString()}</span>
            </div>

            {note && <p className="mt-1.5 text-[10px] leading-relaxed text-ink-3">{note}</p>}
          </div>
        )}
      </section>
    </>
  );
}
