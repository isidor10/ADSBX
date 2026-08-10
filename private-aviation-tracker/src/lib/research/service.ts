import { cache, cacheKeys } from "@/lib/cache";
import { config, searchConfigured } from "@/lib/config";
import { withDb } from "@/lib/db";
import { authorityFor, hostOf } from "@/lib/ownership/sources";
import { getSearchProvider } from "@/lib/search/providers";
import type { SearchResult } from "@/lib/search/types";
import type { ResearchItem, ResearchKind, ResearchReport, Verification } from "@/lib/types";

/**
 * WEB & NEWS research for an aircraft or a company.
 *
 * Runs the configured search provider — never the browser — over a small set
 * of targeted queries, classifies each result by the authority of its host,
 * and stores it with a verification level:
 *
 *   CONFIRMED    official registry, or the subject's own site
 *   REPORTED     established news outlet or aviation database
 *   UNVERIFIED   forums, aggregators, anything else
 *
 * A forum thread is genuinely useful for this subject matter and is kept — but
 * it is labelled, and the UI shows the label, so speculation is never
 * presented as established fact.
 *
 * Results are cached and persisted, because these pages change on the order of
 * weeks while the map refreshes every few seconds.
 */

const FORUM_HOSTS = [
  "airliners.net",
  "pprune.org",
  "reddit.com",
  "flyertalk.com",
  "jetphotos.com/forum",
  "forums.jetcareers",
  "airlinepilotforums.com",
  "quora.com",
  "stackexchange.com",
];

const NEWS_HOSTS = [
  "ainonline.com",
  "corporatejetinvestor.com",
  "flightglobal.com",
  "reuters.com",
  "bloomberg.com",
  "bbc.co.uk",
  "cnn.com",
  "forbes.com",
  "businessinsider.com",
  "theguardian.com",
  "ft.com",
  "wsj.com",
  "aviationweek.com",
  "simpleflying.com",
];

function classify(url: string, subjectName: string): { kind: ResearchKind; verification: Verification } {
  const host = hostOf(url);
  const authority = authorityFor(host);

  if (authority.kind === "official_registry") {
    return { kind: "OFFICIAL_REGISTRY", verification: "CONFIRMED" };
  }
  if (authority.kind === "corporate_filing") {
    return { kind: "OFFICIAL_REGISTRY", verification: "CONFIRMED" };
  }
  if (FORUM_HOSTS.some((h) => host.includes(h.split("/")[0]))) {
    return { kind: "FORUM", verification: "UNVERIFIED" };
  }
  if (NEWS_HOSTS.some((h) => host.includes(h))) {
    return { kind: "NEWS", verification: "REPORTED" };
  }
  if (authority.kind === "aviation_database") {
    return { kind: "AVIATION_DATABASE", verification: "REPORTED" };
  }
  if (authority.kind === "news") {
    return { kind: "NEWS", verification: "REPORTED" };
  }
  // A page on the subject's own domain is the subject speaking about itself:
  // authoritative for "what they say", which is what CONFIRMED means here.
  const slug = subjectName.toLowerCase().replace(/[^a-z0-9]/g, "");
  if (slug.length > 5 && host.replace(/[^a-z0-9]/g, "").includes(slug)) {
    return { kind: "COMPANY_WEBSITE", verification: "CONFIRMED" };
  }
  return { kind: "OTHER", verification: "UNVERIFIED" };
}

/** Queries for an aircraft: news and community coverage, not ownership. */
export function aircraftResearchQueries(
  registration: string,
  hints: { model?: string | null; operator?: string | null } = {},
): string[] {
  const reg = registration.toUpperCase();
  const queries = [`"${reg}" aircraft news`, `"${reg}" jet forum`];
  if (hints.model) queries.push(`"${reg}" ${hints.model}`);
  if (hints.operator) queries.push(`"${reg}" ${hints.operator}`);
  queries.push(`"${reg}" aviation`);
  return [...new Set(queries)];
}

export function companyResearchQueries(name: string): string[] {
  return [
    `"${name}" aircraft fleet`,
    `"${name}" jet`,
    `"${name}" aviation news`,
    `"${name}" official website`,
    `"${name}" forum aircraft`,
  ];
}

function toItem(result: SearchResult, subjectName: string): ResearchItem {
  const { kind, verification } = classify(result.url, subjectName);
  const host = hostOf(result.url);
  return {
    title: result.title,
    url: result.url,
    host,
    label: authorityFor(host).label,
    snippet: result.snippet || null,
    kind,
    verification,
    publishedAt: null,
    query: result.query,
  };
}

async function persist(
  subjectType: "AIRCRAFT" | "COMPANY",
  subjectKey: string,
  items: ResearchItem[],
  provider: string,
): Promise<void> {
  if (items.length === 0) return;
  await withDb(
    async (db) => {
      for (const item of items) {
        await db.researchItem.upsert({
          where: {
            subjectType_subjectKey_url: { subjectType, subjectKey, url: item.url },
          },
          create: {
            subjectType,
            subjectKey,
            title: item.title,
            url: item.url,
            host: item.host,
            snippet: item.snippet,
            kind: item.kind,
            verification: item.verification,
            provider,
            query: item.query,
          },
          update: { title: item.title, snippet: item.snippet, lastSeenAt: new Date() },
        });
      }
      return null;
    },
    null,
    "research:persist",
  );
}

async function fromDatabase(
  subjectType: "AIRCRAFT" | "COMPANY",
  subjectKey: string,
): Promise<ResearchItem[]> {
  const rows = await withDb(
    (db) =>
      db.researchItem.findMany({
        where: { subjectType, subjectKey },
        orderBy: [{ verification: "asc" }, { discoveredAt: "desc" }],
        take: 24,
      }),
    [],
    "research:load",
  );
  return rows.map((r) => ({
    title: r.title,
    url: r.url,
    host: r.host,
    label: authorityFor(r.host).label,
    snippet: r.snippet,
    kind: r.kind as ResearchKind,
    verification: r.verification as Verification,
    publishedAt: r.publishedAt?.toISOString() ?? null,
    query: r.query,
  }));
}

interface ResearchOptions {
  subjectType: "AIRCRAFT" | "COMPANY";
  subjectKey: string;
  subjectName: string;
  queries: string[];
  force?: boolean;
}

export async function research(options: ResearchOptions): Promise<ResearchReport> {
  const { subjectType, subjectKey, subjectName, queries } = options;
  const key = cacheKeys.research(subjectType, subjectKey);

  if (!options.force) {
    const cached = await cache.getJson<ResearchReport>(key);
    if (cached) return { ...cached, cached: true };
  }

  if (!searchConfigured()) {
    // Nothing to search with — but anything found on an earlier run, when a
    // provider was configured, is still perfectly good.
    const stored = await fromDatabase(subjectType, subjectKey);
    return {
      subject: subjectName,
      items: stored,
      provider: null,
      cached: false,
      note:
        stored.length > 0
          ? "Showing previously discovered sources. Configure SEARCH_PROVIDER to refresh."
          : "No web search provider is configured. Set SEARCH_PROVIDER and its API key to research news and forum coverage.",
    };
  }

  const provider = getSearchProvider();
  const results: SearchResult[] = [];
  for (const query of queries.slice(0, config.search.maxQueries)) {
    try {
      results.push(...(await provider.search(query, config.search.resultsPerQuery)));
    } catch {
      // One failed query must not lose the others.
    }
  }

  const seen = new Set<string>();
  const items: ResearchItem[] = [];
  for (const result of results) {
    if (!result.url || seen.has(result.url)) continue;
    seen.add(result.url);
    items.push(toItem(result, subjectName));
  }

  // Most trustworthy first, so the eye lands on registries and news before
  // forum chatter.
  const order: Record<Verification, number> = { CONFIRMED: 0, REPORTED: 1, UNVERIFIED: 2 };
  items.sort((a, b) => order[a.verification] - order[b.verification]);

  const report: ResearchReport = {
    subject: subjectName,
    items: items.slice(0, 24),
    provider: provider.name,
    cached: false,
    note:
      items.length === 0
        ? "No relevant public sources were found for this subject."
        : null,
  };

  void persist(subjectType, subjectKey, report.items, provider.name).catch(() => {});
  await cache.setJson(key, report, config.research.ttlHours * 3600);
  return report;
}

export async function researchAircraft(
  registration: string,
  hints: { model?: string | null; operator?: string | null } = {},
  force = false,
): Promise<ResearchReport> {
  const reg = registration.toUpperCase();
  return research({
    subjectType: "AIRCRAFT",
    subjectKey: reg,
    subjectName: reg,
    queries: aircraftResearchQueries(reg, hints),
    force,
  });
}

export async function researchCompany(
  slug: string,
  name: string,
  force = false,
): Promise<ResearchReport> {
  return research({
    subjectType: "COMPANY",
    subjectKey: slug,
    subjectName: name,
    queries: companyResearchQueries(name),
    force,
  });
}
