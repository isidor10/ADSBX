"use client";

import { Divider, EmptyNote, SectionTitle, Spinner } from "@/components/ui";
import type { ResearchItem, ResearchReport, Verification } from "@/lib/types";

/**
 * WEB & NEWS.
 *
 * Forum threads are genuinely useful in this subject area and are kept — but
 * every result wears its verification level, so a rumour on a message board is
 * never presented with the same weight as a registry entry or a news report.
 */

const VERIFICATION_STYLE: Record<Verification, { label: string; color: string }> = {
  CONFIRMED: { label: "Confirmed", color: "#4ade80" },
  REPORTED: { label: "Reported", color: "#f5a524" },
  UNVERIFIED: { label: "Unverified", color: "#94a3b8" },
};

const KIND_LABEL: Record<ResearchItem["kind"], string> = {
  NEWS: "News",
  FORUM: "Forum",
  COMPANY_WEBSITE: "Company site",
  OFFICIAL_REGISTRY: "Registry",
  AVIATION_DATABASE: "Database",
  OTHER: "Web",
};

function VerificationChip({ verification }: { verification: Verification }) {
  const style = VERIFICATION_STYLE[verification];
  return (
    <span
      className="rounded-sm border px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-[0.12em]"
      style={{ color: style.color, borderColor: `${style.color}44`, background: `${style.color}12` }}
    >
      {style.label}
    </span>
  );
}

export default function WebNews({
  report,
  loading,
  title = "Web & news",
}: {
  report: ResearchReport | null;
  loading: boolean;
  title?: string;
}) {
  return (
    <>
      <Divider />
      <section>
        <SectionTitle>{title}</SectionTitle>

        {loading && !report && <Spinner label="Searching public sources…" />}

        {report && report.items.length > 0 && (
          <ul className="space-y-2 px-4 pb-4">
            {report.items.map((item) => (
              <li key={item.url}>
                <a
                  href={item.url}
                  target="_blank"
                  rel="noopener noreferrer nofollow"
                  className="block rounded-sm border border-edge bg-panel-2 px-3 py-2 transition-colors hover:border-cyan/40"
                >
                  <div className="flex items-start justify-between gap-2">
                    <span className="line-clamp-2 text-xs leading-snug text-ink">
                      {item.title}
                    </span>
                    <VerificationChip verification={item.verification} />
                  </div>
                  <div className="mt-1 flex items-center gap-2 text-[10px] text-ink-3">
                    <span className="truncate">{item.label}</span>
                    <span aria-hidden>·</span>
                    <span>{KIND_LABEL[item.kind]}</span>
                    {item.publishedAt && (
                      <>
                        <span aria-hidden>·</span>
                        <span>{new Date(item.publishedAt).toLocaleDateString()}</span>
                      </>
                    )}
                  </div>
                  {item.snippet && (
                    <p className="mt-1 line-clamp-2 text-[11px] leading-relaxed text-ink-3">
                      {item.snippet}
                    </p>
                  )}
                </a>
              </li>
            ))}
          </ul>
        )}

        {report && report.items.length === 0 && !loading && (
          <EmptyNote>{report.note ?? "No public sources found."}</EmptyNote>
        )}

        {report && report.items.length > 0 && (
          <p className="px-4 pb-4 text-[10px] leading-relaxed text-ink-3">
            Forum and unverified sources are shown because they are often the only public
            discussion of a private aircraft. Treat them as leads, not as established fact.
          </p>
        )}
      </section>
    </>
  );
}
