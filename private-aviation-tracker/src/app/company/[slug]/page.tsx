import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import CompanyActivity from "@/components/CompanyActivity";
import WebNews from "@/components/WebNews";
import { getCompany, getCompanyActivity, getCompanyAirports } from "@/lib/company/service";
import { researchCompany } from "@/lib/research/service";
import { FLEET_ROLE_LABELS, type CompanyFleetEntry } from "@/lib/types";

export const dynamic = "force-dynamic";

interface PageProps {
  params: Promise<{ slug: string }>;
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { slug } = await params;
  const company = await getCompany(slug);
  return {
    title: company ? `${company.name} — fleet & activity` : "Company not found",
    description: company
      ? `Aircraft owned, operated or managed by ${company.name}, with live status and observed flight activity.`
      : undefined,
  };
}

function StatusPill({ status }: { status: CompanyFleetEntry["status"] }) {
  const style =
    status === "flying"
      ? { label: "Flying", color: "#4ade80" }
      : status === "on_ground"
        ? { label: "On ground", color: "#94a3b8" }
        : { label: "Not received", color: "#64748b" };
  return (
    <span
      className="inline-flex items-center gap-1.5 whitespace-nowrap rounded-sm border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.1em]"
      style={{ color: style.color, borderColor: `${style.color}44`, background: `${style.color}12` }}
    >
      <span className="h-1.5 w-1.5 rounded-full" style={{ background: style.color }} />
      {style.label}
    </span>
  );
}

function Stat({ value, label, accent }: { value: number; label: string; accent?: string }) {
  return (
    <div className="rounded-sm border border-edge bg-panel-2 px-4 py-3">
      <div className="tabular text-2xl font-semibold leading-none" style={{ color: accent }}>
        {value}
      </div>
      <div className="mt-1 text-[10px] uppercase tracking-[0.14em] text-ink-3">{label}</div>
    </div>
  );
}

/**
 * Company intelligence page.
 *
 * Fleet, live status, recent activity, airports and public coverage — every
 * section built from sourced findings or observed flights, with an explicit
 * note where there is nothing yet rather than an empty frame.
 */
export default async function CompanyPage({ params }: PageProps) {
  const { slug } = await params;

  const company = await getCompany(slug);
  if (!company) notFound();

  const [airports, activity, research] = await Promise.all([
    getCompanyAirports(slug),
    getCompanyActivity(slug, { limit: 40 }),
    researchCompany(slug, company.name),
  ]);

  return (
    <main className="min-h-dvh bg-ground text-ink">
      <header className="border-b border-edge bg-panel/60 px-5 py-5">
        <Link href="/" className="text-[11px] tracking-[0.14em] text-ink-3 hover:text-cyan">
          ← LIVE MAP
        </Link>
        <h1 className="mt-3 text-2xl font-semibold tracking-tight">{company.name}</h1>
        <p className="mt-1 text-[11px] leading-relaxed text-ink-3">
          Fleet links come from sourced ownership research. Each aircraft shows the role the
          company was found in — owning, operating and managing an aircraft are different things.
        </p>
        {company.website && (
          <a
            href={company.website}
            target="_blank"
            rel="noopener noreferrer nofollow"
            className="mt-2 inline-block text-xs text-cyan hover:underline"
          >
            {company.website} ↗
          </a>
        )}
      </header>

      <div className="mx-auto max-w-5xl px-5 py-6">
        <section className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <Stat value={company.stats.aircraft} label="Aircraft" />
          <Stat value={company.stats.flying} label="Currently flying" accent="#4ade80" />
          <Stat value={company.stats.onGround} label="On ground" />
          <Stat value={company.stats.unknown} label="Not received" />
        </section>

        {/* ---- fleet ---- */}
        <section className="mt-8">
          <h2 className="mb-3 text-[11px] font-semibold uppercase tracking-[0.18em] text-ink-3">
            Fleet
          </h2>

          {company.fleet.length === 0 ? (
            <p className="rounded-sm border border-edge bg-panel-2 px-4 py-3 text-xs text-ink-3">
              {company.note}
            </p>
          ) : (
            <div className="overflow-x-auto rounded-sm border border-edge">
              <table className="w-full min-w-[720px] border-collapse text-sm">
                <thead>
                  <tr className="border-b border-edge bg-panel-2 text-left text-[10px] uppercase tracking-[0.12em] text-ink-3">
                    <th className="px-3 py-2 font-semibold">Registration</th>
                    <th className="px-3 py-2 font-semibold">Aircraft</th>
                    <th className="px-3 py-2 font-semibold">Role</th>
                    <th className="px-3 py-2 font-semibold">Status</th>
                    <th className="px-3 py-2 font-semibold">Location</th>
                    <th className="px-3 py-2 font-semibold">Destination</th>
                  </tr>
                </thead>
                <tbody>
                  {company.fleet.map((entry) => (
                    <tr key={entry.registration} className="border-b border-edge/60 last:border-0">
                      <td className="px-3 py-2">
                        <Link
                          href={`/aircraft/${encodeURIComponent(entry.registration)}`}
                          className="tabular text-cyan hover:underline"
                        >
                          {entry.registration}
                        </Link>
                      </td>
                      <td className="px-3 py-2 text-ink-2">
                        {[entry.manufacturer, entry.model].filter(Boolean).join(" ") ||
                          entry.typeCode ||
                          "—"}
                      </td>
                      <td className="px-3 py-2 text-[11px] text-ink-3">
                        {FLEET_ROLE_LABELS[entry.role]}
                      </td>
                      <td className="px-3 py-2">
                        <StatusPill status={entry.status} />
                      </td>
                      <td className="px-3 py-2 text-ink-2">{entry.location ?? "—"}</td>
                      <td className="px-3 py-2 text-ink-2">
                        {entry.destination ? (
                          <span>
                            {entry.destination.icao ?? entry.destination.name}
                            {entry.destinationEstimated && (
                              <span className="ml-1.5 text-[9px] uppercase tracking-[0.1em] text-amber">
                                est.
                              </span>
                            )}
                          </span>
                        ) : (
                          "—"
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>

        {/* ---- most visited airports ---- */}
        <section className="mt-8">
          <h2 className="mb-3 text-[11px] font-semibold uppercase tracking-[0.18em] text-ink-3">
            Most visited airports
          </h2>
          {airports.length === 0 ? (
            <p className="rounded-sm border border-edge bg-panel-2 px-4 py-3 text-xs text-ink-3">
              No airport activity recorded yet. Counts are computed from observed departures and
              arrivals, so they start at zero and grow as this deployment watches the fleet.
            </p>
          ) : (
            <ol className="grid gap-1.5 sm:grid-cols-2">
              {airports.map((airport, index) => (
                <li
                  key={airport.icao}
                  className="flex items-center justify-between gap-3 rounded-sm border border-edge bg-panel-2 px-3 py-2"
                >
                  <span className="min-w-0">
                    <span className="tabular text-xs text-ink-3">{index + 1}. </span>
                    <span className="tabular text-sm text-ink">{airport.icao}</span>
                    {airport.name && (
                      <span className="ml-2 truncate text-[11px] text-ink-3">{airport.name}</span>
                    )}
                  </span>
                  <span className="tabular shrink-0 text-xs text-cyan">
                    {airport.movements} movement{airport.movements === 1 ? "" : "s"}
                  </span>
                </li>
              ))}
            </ol>
          )}
        </section>

        {/* ---- activity timeline ---- */}
        <CompanyActivity slug={slug} initial={activity} fleet={company.fleet} />

        {/* ---- web & news ---- */}
        <div className="mt-8 rounded-sm border border-edge">
          <WebNews report={research} loading={false} title="Web & news" />
        </div>
      </div>
    </main>
  );
}
