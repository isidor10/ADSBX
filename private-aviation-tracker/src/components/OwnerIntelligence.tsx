"use client";

import { ConfidenceMeter, EmptyNote, Field, SectionTitle, SourceChip, Spinner } from "@/components/ui";
import { formatRelative } from "@/lib/format";
import type { OwnerKind, OwnershipResult } from "@/lib/types";

const OWNER_KIND_LABEL: Record<OwnerKind, string> = {
  REGISTERED_OWNER: "Registered owner",
  OPERATOR: "Operator",
  MANAGEMENT_COMPANY: "Management company",
  CHARTER_OPERATOR: "Charter operator",
  TRUSTEE: "Registered owner (trustee)",
  BENEFICIAL_OWNER: "Beneficial owner",
  UNKNOWN: "Named in public sources",
};

const DISCLAIMER =
  "Ownership information is based on publicly available sources and may represent the registered owner or operator rather than the ultimate beneficial owner.";

export default function OwnerIntelligence({
  ownership,
  loading,
  refreshing,
  onRefresh,
}: {
  ownership: OwnershipResult | null;
  loading: boolean;
  refreshing: boolean;
  onRefresh: () => void;
}) {
  const refreshButton = (
    <button
      type="button"
      onClick={onRefresh}
      disabled={refreshing || loading}
      className="flex items-center gap-1.5 rounded-sm border border-edge bg-panel-2 px-2 py-1 text-[10px] uppercase tracking-[0.12em] text-ink-2 transition-colors hover:border-cyan/50 hover:text-cyan disabled:opacity-50"
    >
      <svg
        viewBox="0 0 16 16"
        className={`h-3 w-3 ${refreshing ? "animate-spin" : ""}`}
        aria-hidden
      >
        <path
          d="M13.5 8a5.5 5.5 0 1 1-1.6-3.9M13.5 2v3h-3"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.4"
          strokeLinecap="round"
        />
      </svg>
      {refreshing ? "Verifying" : "Refresh"}
    </button>
  );

  return (
    <section className="border-t border-edge bg-panel/40">
      <SectionTitle action={refreshButton}>Owner intelligence</SectionTitle>

      {loading && !ownership && <Spinner label="Researching public sources…" />}

      {!loading && !ownership && (
        <EmptyNote>Ownership research has not run for this aircraft yet.</EmptyNote>
      )}

      {ownership && ownership.status === "RESOLVED" && (
        <div className="px-4 pb-4">
          <div className="rounded-sm border border-edge bg-panel-2 p-3">
            <div className="text-[10px] uppercase tracking-[0.14em] text-ink-3">Owner</div>
            <div className="mt-0.5 text-lg leading-snug font-semibold text-ink">
              {ownership.owner}
            </div>
            <div className="mt-1 text-[11px] text-cyan">
              {OWNER_KIND_LABEL[ownership.ownerKind]}
            </div>
          </div>

          <div className="mt-3 grid grid-cols-2 gap-3">
            <Field label="Operator" value={ownership.operator ?? "Not separately identified"} mono={false} />
            <Field
              label="Management"
              value={ownership.managementCompany ?? ownership.charterOperator ?? "—"}
              mono={false}
            />
          </div>

          <div className="mt-4">
            <div className="text-[10px] uppercase tracking-[0.12em] text-ink-3">Confidence</div>
            <div className="mt-1">
              <ConfidenceMeter
                confidence={ownership.confidence}
                band={ownership.confidenceBand}
              />
            </div>
          </div>

          <div className="mt-3 grid grid-cols-2 gap-3">
            <Field label="Last verified" value={formatRelative(ownership.lastVerifiedAt)} />
            <Field
              label="Analysed by"
              value={ownership.analyzer === "heuristic" ? "Source scoring" : ownership.analyzer ?? "—"}
              mono={false}
            />
          </div>

          {!ownership.beneficialOwnerConfirmed && (
            <p className="mt-3 rounded-sm border border-amber/30 bg-amber/10 px-3 py-2 text-[11px] leading-relaxed text-amber">
              Registered owner identified, beneficial owner not publicly confirmed.
            </p>
          )}

          {ownership.evidence && (
            <div className="mt-3">
              <div className="text-[10px] uppercase tracking-[0.12em] text-ink-3">Evidence</div>
              <p className="mt-1 text-[12px] leading-relaxed text-ink-2">{ownership.evidence}</p>
            </div>
          )}

          {ownership.sources.length > 0 && (
            <div className="mt-3">
              <div className="text-[10px] uppercase tracking-[0.12em] text-ink-3">Sources</div>
              <div className="mt-1.5 flex flex-wrap gap-1.5">
                {ownership.sources.map((source) => (
                  <SourceChip
                    key={source.url}
                    label={source.label}
                    url={source.url}
                    kind={source.kind}
                  />
                ))}
              </div>
            </div>
          )}

          <p className="mt-4 border-t border-edge pt-3 text-[10px] leading-relaxed text-ink-3">
            {DISCLAIMER}
          </p>
        </div>
      )}

      {ownership && ownership.status !== "RESOLVED" && (
        <div className="px-4 pb-4">
          <div className="rounded-sm border border-edge bg-panel-2 p-3">
            <div className="text-[10px] uppercase tracking-[0.14em] text-ink-3">Owner</div>
            <div className="mt-0.5 text-lg font-semibold text-ink-2">Unknown</div>
            <div className="mt-2 text-[10px] uppercase tracking-[0.12em] text-ink-3">Reason</div>
            <p className="mt-1 text-[12px] leading-relaxed text-ink-2">
              {ownership.notFoundReason ??
                ownership.errorMessage ??
                "No reliable public ownership information found."}
            </p>
          </div>

          {ownership.sources.length > 0 && (
            <div className="mt-3">
              <div className="text-[10px] uppercase tracking-[0.12em] text-ink-3">
                Check the official registry
              </div>
              <div className="mt-1.5 flex flex-wrap gap-1.5">
                {ownership.sources.map((source) => (
                  <SourceChip
                    key={source.url}
                    label={source.label}
                    url={source.url}
                    kind={source.kind}
                  />
                ))}
              </div>
            </div>
          )}

          {ownership.queries.length > 0 && (
            <details className="mt-3 text-[11px] text-ink-3">
              <summary className="cursor-pointer select-none hover:text-ink-2">
                Queries issued ({ownership.queries.length})
              </summary>
              <ul className="mt-1.5 space-y-1 pl-3">
                {ownership.queries.map((query) => (
                  <li key={query} className="tabular truncate">
                    {query}
                  </li>
                ))}
              </ul>
            </details>
          )}

          <p className="mt-4 border-t border-edge pt-3 text-[10px] leading-relaxed text-ink-3">
            {DISCLAIMER}
          </p>
        </div>
      )}
    </section>
  );
}
