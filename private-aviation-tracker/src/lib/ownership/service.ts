import { normalizeRegistration, registryFor } from "@/lib/aircraft/registration";
import { cache, cacheKeys } from "@/lib/cache";
import { syncCompanyLinks } from "@/lib/company/service";
import { config, searchConfigured } from "@/lib/config";
import { withDb } from "@/lib/db";
import { getSearchProvider } from "@/lib/search/providers";
import type { SearchResult } from "@/lib/search/types";
import type {
  ConfidenceBand,
  OwnerKind,
  OwnershipResult,
  OwnershipSource,
  OwnershipStatus,
} from "@/lib/types";
import {
  bandFor,
  canonicalName,
  collectCandidates,
  scoreToConfidence,
  type Candidate,
} from "./extract";
import { lookupAircraftDatabase, type AircraftDbRecord } from "./aircraftDb";
import { lookupFaaRegistration, officialRegistrySource, type FaaOwnerRecord } from "./faa";
import { analyzeWithLlm, llmEnabled, type LlmAnalysisResult } from "./llm";
import { buildOwnershipQueries, type QueryHints } from "./queries";

/**
 * Ownership intelligence orchestrator.
 *
 * Pipeline: cache → official registry record → web search → evidence scoring →
 * optional LLM refinement → persisted result.
 *
 * The guiding rule throughout is that an unresolved answer is a valid answer.
 * Nothing here fills a gap with a guess: if the sources do not name an owner,
 * the result says so and explains why.
 */

export interface OwnershipOptions {
  hints?: QueryHints;
  /** Skip every cache layer and re-research from scratch. */
  force?: boolean;
  /** Feed reports the aircraft as privacy-blocked (PIA/LADD). */
  blocked?: boolean;
}

const NOT_FOUND_NO_PROVIDER =
  "No web search provider is configured, so only official registry data was consulted.";
const NOT_FOUND_NO_SOURCES = "No reliable public source was found for this registration.";
const BLOCKED_REASON =
  "This aircraft participates in a privacy programme (PIA/LADD), so public identifying data is limited.";

function emptyResult(
  registration: string,
  status: OwnershipStatus,
  sources: OwnershipSource[],
  queries: string[],
  reason: string,
  errorMessage?: string,
): OwnershipResult {
  return {
    registration,
    status,
    owner: null,
    ownerKind: "UNKNOWN",
    operator: null,
    managementCompany: null,
    charterOperator: null,
    confidence: 0,
    confidenceBand: "none",
    beneficialOwnerConfirmed: false,
    summary: null,
    evidence: null,
    sources,
    queries,
    searchProvider: getSearchProvider().name,
    analyzer: llmEnabled() ? config.llm.model : "heuristic",
    lastVerifiedAt: new Date().toISOString(),
    cached: false,
    errorMessage: errorMessage ?? null,
    notFoundReason: reason,
  };
}

/** Run the query set against the search provider, de-duplicating by URL. */
async function gatherSearchResults(
  registration: string,
  hints: QueryHints,
): Promise<{ results: SearchResult[]; queries: string[]; error: string | null }> {
  const provider = getSearchProvider();
  const queries = buildOwnershipQueries(registration, hints).slice(0, config.search.maxQueries);

  if (!searchConfigured()) {
    return { results: [], queries: [], error: null };
  }

  const settled = await Promise.allSettled(
    queries.map((q) => provider.search(q, config.search.resultsPerQuery)),
  );

  const results: SearchResult[] = [];
  const seen = new Set<string>();
  let error: string | null = null;

  for (const outcome of settled) {
    if (outcome.status === "rejected") {
      error = (outcome.reason as Error).message;
      continue;
    }
    for (const result of outcome.value) {
      const key = result.url.split("#")[0];
      if (seen.has(key)) continue;
      seen.add(key);
      results.push(result);
    }
  }

  // Every query failed — surface it rather than reporting "nothing found".
  if (results.length === 0 && error) {
    return { results: [], queries, error };
  }
  return { results, queries, error: null };
}

function registrySource(registration: string): OwnershipSource | null {
  const registry = registryFor(registration);
  if (!registry) return null;
  return officialRegistrySource(
    registration,
    registry.authority,
    registry.searchUrl(registration),
  );
}

function pickOperator(candidates: Candidate[], ownerCanonical: string | null) {
  const roles: Record<string, OwnerKind[]> = {
    operator: ["OPERATOR"],
    management: ["MANAGEMENT_COMPANY"],
    charter: ["CHARTER_OPERATOR"],
  };
  const out: { operator: string | null; management: string | null; charter: string | null } = {
    operator: null,
    management: null,
    charter: null,
  };

  for (const [slot, kinds] of Object.entries(roles)) {
    const hit = candidates.find(
      (c) => kinds.includes(c.kind) && c.canonical !== ownerCanonical && c.score > 0.4,
    );
    if (!hit) continue;
    if (slot === "operator") out.operator = hit.name;
    if (slot === "management") out.management = hit.name;
    if (slot === "charter") out.charter = hit.name;
  }
  return out;
}

function mergeSources(...groups: OwnershipSource[][]): OwnershipSource[] {
  const byUrl = new Map<string, OwnershipSource>();
  for (const group of groups) {
    for (const source of group) {
      const key = source.url.split("#")[0];
      const existing = byUrl.get(key);
      if (!existing || source.weight > existing.weight) byUrl.set(key, source);
    }
  }
  return [...byUrl.values()].sort((a, b) => b.weight - a.weight).slice(0, 12);
}

function buildSummary(
  owner: string,
  ownerKind: OwnerKind,
  operator: string | null,
  beneficialConfirmed: boolean,
): string {
  const kindLabel: Record<OwnerKind, string> = {
    REGISTERED_OWNER: "registered owner",
    OPERATOR: "operator",
    MANAGEMENT_COMPANY: "management company",
    CHARTER_OPERATOR: "charter operator",
    TRUSTEE: "registered owner of record (trustee)",
    BENEFICIAL_OWNER: "beneficial owner",
    UNKNOWN: "party named in public sources",
  };

  let summary = `${owner} is identified as the ${kindLabel[ownerKind]}`;
  if (operator && operator !== owner) summary += `, with ${operator} named as operator`;
  summary += ".";
  if (!beneficialConfirmed) {
    summary += " Registered owner identified, beneficial owner not publicly confirmed.";
  }
  return summary;
}

/** The research pipeline proper, with no caching concerns. */
async function research(
  registration: string,
  options: OwnershipOptions,
): Promise<OwnershipResult> {
  const registryLink = registrySource(registration);
  const baseSources = registryLink ? [registryLink] : [];

  const [faa, aircraftDb, search] = await Promise.all([
    lookupFaaRegistration(registration),
    // Keyless public aircraft database. Without this, a deployment with no
    // FAA import and no search key could never resolve any owner at all.
    lookupAircraftDatabase(registration),
    gatherSearchResults(registration, options.hints ?? {}),
  ]);

  if (search.error && !faa && !aircraftDb) {
    return emptyResult(
      registration,
      "ERROR",
      baseSources,
      search.queries,
      "Ownership information temporarily unavailable.",
      search.error,
    );
  }

  const candidates = collectCandidates(registration, search.results);
  const llm = await analyzeWithLlm(registration, search.results, faa);

  const decided = decide(registration, faa, candidates, llm, aircraftDb);

  if (!decided.owner) {
    const reason = options.blocked
      ? BLOCKED_REASON
      : searchConfigured()
        ? NOT_FOUND_NO_SOURCES
        : NOT_FOUND_NO_PROVIDER;
    return emptyResult(
      registration,
      options.blocked ? "BLOCKED" : "NOT_FOUND",
      baseSources,
      search.queries,
      reason,
    );
  }

  const llmSources: OwnershipSource[] = (llm?.sourceUrls ?? [])
    .map((url) => search.results.find((r) => r.url.split("#")[0] === url.split("#")[0]))
    .filter((r): r is SearchResult => Boolean(r))
    .map((r) => ({
      title: r.title,
      url: r.url,
      label: new URL(r.url).host.replace(/^www\./, ""),
      kind: "search_result" as const,
      snippet: r.snippet?.slice(0, 300),
      weight: 0.4,
    }));

  const sources = mergeSources(
    faa ? [faa.source] : [],
    baseSources,
    decided.sources,
    llmSources,
  );

  return {
    registration,
    status: "RESOLVED",
    owner: decided.owner,
    ownerKind: decided.ownerKind,
    operator: decided.operator,
    managementCompany: decided.managementCompany,
    charterOperator: decided.charterOperator,
    confidence: decided.confidence,
    confidenceBand: bandFor(decided.confidence) as ConfidenceBand,
    beneficialOwnerConfirmed: decided.beneficialOwnerConfirmed,
    summary: buildSummary(
      decided.owner,
      decided.ownerKind,
      decided.operator,
      decided.beneficialOwnerConfirmed,
    ),
    evidence: decided.evidence,
    sources,
    queries: search.queries,
    searchProvider: getSearchProvider().name,
    analyzer: llm ? llm.model : "heuristic",
    lastVerifiedAt: new Date().toISOString(),
    cached: false,
    notFoundReason: null,
  };
}

interface Decision {
  owner: string | null;
  ownerKind: OwnerKind;
  operator: string | null;
  managementCompany: string | null;
  charterOperator: string | null;
  confidence: number;
  beneficialOwnerConfirmed: boolean;
  evidence: string;
  sources: OwnershipSource[];
}

/**
 * Combine the official record, the scored web evidence and the optional model
 * reading into one answer. The official registry always wins on the owner
 * name; the other two adjust confidence and fill in operator roles.
 */
function decide(
  registration: string,
  faa: FaaOwnerRecord | null,
  candidates: Candidate[],
  llm: LlmAnalysisResult | null,
  aircraftDb: AircraftDbRecord | null = null,
): Decision {
  const evidence: string[] = [];
  const top = candidates[0] ?? null;
  const roles = pickOperator(candidates, top ? top.canonical : null);

  let owner: string | null = null;
  let ownerKind: OwnerKind = "UNKNOWN";
  let confidence = 0;
  let sources: OwnershipSource[] = [];

  if (faa) {
    owner = faa.registrantName;
    ownerKind = faa.ownerKind;
    confidence = 90;
    sources = [faa.source];
    evidence.push(
      `FAA Civil Aviation Registry lists ${faa.registrantName}${
        faa.registrantTypeLabel ? ` (${faa.registrantTypeLabel})` : ""
      } as the registered owner of ${registration}.`,
    );

    if (
      aircraftDb?.registeredOwner &&
      canonicalName(aircraftDb.registeredOwner) === canonicalName(faa.registrantName)
    ) {
      confidence = Math.min(97, confidence + 3);
      sources = [...sources, aircraftDb.source];
      evidence.push("A public aircraft database records the same registered owner.");
    }

    const corroborating = candidates.find((c) => c.canonical === canonicalName(faa.registrantName));
    if (corroborating) {
      confidence = Math.min(97, confidence + 5);
      sources = [...sources, ...corroborating.sources];
      evidence.push(
        `The same name appears on ${corroborating.domains.length} independent public source(s).`,
      );
    }
  } else if (aircraftDb?.registeredOwner) {
    // A compilation of public registry data: strong enough to name a
    // registered owner, but not the register itself, so it sits below the FAA
    // and can be corroborated upwards by independent web sources.
    owner = aircraftDb.registeredOwner;
    ownerKind = "REGISTERED_OWNER";
    confidence = 74;
    sources = [aircraftDb.source];
    evidence.push(
      `A public aircraft database lists ${aircraftDb.registeredOwner} as the registered owner of ${registration}${
        aircraftDb.ownerCountry ? ` (${aircraftDb.ownerCountry})` : ""
      }.`,
    );

    const corroborating = candidates.find(
      (c) => c.canonical === canonicalName(aircraftDb.registeredOwner!),
    );
    if (corroborating) {
      confidence = Math.min(88, confidence + 8);
      sources = [...sources, ...corroborating.sources];
      evidence.push(
        `The same name appears on ${corroborating.domains.length} independent public source(s).`,
      );
    }
  } else if (top) {
    owner = top.name;
    ownerKind = top.kind === "UNKNOWN" ? "REGISTERED_OWNER" : top.kind;
    const hasRegistry = top.sources.some((s) => s.kind === "official_registry");
    confidence = scoreToConfidence(top.score, top.domains.length, hasRegistry);
    sources = top.sources;
    evidence.push(
      `${top.name} is named alongside ${registration} on ${top.domains.length} source(s): ${top.domains
        .slice(0, 4)
        .join(", ")}.`,
    );
    evidence.push(...top.evidence.slice(0, 2));

    const runnerUp = candidates[1];
    if (runnerUp && runnerUp.score > top.score * 0.8) {
      confidence = Math.max(20, confidence - 12);
      evidence.push(
        `Public sources are not unanimous — ${runnerUp.name} is also named for this registration.`,
      );
    }
  }

  if (llm) {
    if (!owner) {
      owner = llm.owner;
      ownerKind = llm.ownerKind;
      // Model-only findings are deliberately capped: no deterministic
      // corroboration means this cannot be a "high confidence" answer.
      confidence = Math.min(llm.confidence, llm.sourceUrls.length >= 2 ? 70 : 45);
      evidence.push(llm.evidence);
    } else if (llm.owner && canonicalName(llm.owner) === canonicalName(owner)) {
      confidence = Math.min(97, confidence + 4);
      evidence.push(llm.evidence);
    } else if (llm.owner) {
      confidence = Math.max(20, confidence - 8);
      evidence.push(
        `Source analysis also surfaced ${llm.owner}, which does not match the primary finding.`,
      );
    }
  }

  const operator = llm?.operator ?? roles.operator;
  const managementCompany = llm?.managementCompany ?? roles.management;
  const charterOperator = llm?.charterOperator ?? roles.charter;

  return {
    owner,
    ownerKind,
    operator: operator && operator !== owner ? operator : null,
    managementCompany:
      managementCompany && managementCompany !== owner ? managementCompany : null,
    charterOperator: charterOperator && charterOperator !== owner ? charterOperator : null,
    confidence: Math.max(0, Math.min(100, Math.round(confidence))),
    beneficialOwnerConfirmed: llm?.beneficialOwnerConfirmed ?? false,
    evidence: evidence.join(" "),
    sources,
  };
}

// --------------------------------------------------------------- persistence

async function loadPersisted(registration: string): Promise<OwnershipResult | null> {
  const row = await withDb(
    (db) => db.ownershipRecord.findUnique({ where: { registration } }),
    null,
    "ownership:load",
  );
  if (!row) return null;
  if (row.expiresAt.getTime() < Date.now()) return null;

  return {
    registration,
    status: row.status as OwnershipStatus,
    owner: row.owner,
    ownerKind: row.ownerKind as OwnerKind,
    operator: row.operator,
    managementCompany: row.managementCompany,
    charterOperator: row.charterOperator,
    confidence: row.confidence,
    confidenceBand: row.confidenceBand as ConfidenceBand,
    beneficialOwnerConfirmed: row.beneficialOwnerConfirmed,
    summary: row.summary,
    evidence: row.evidence,
    sources: (row.sources as unknown as OwnershipSource[]) ?? [],
    queries: (row.queries as unknown as string[]) ?? [],
    searchProvider: row.searchProvider,
    analyzer: row.analyzer,
    lastVerifiedAt: row.lastVerifiedAt.toISOString(),
    cached: true,
    errorMessage: row.errorMessage,
    notFoundReason: row.status === "RESOLVED" ? null : row.summary,
  };
}

async function persist(result: OwnershipResult): Promise<void> {
  const ttlHours =
    result.status === "RESOLVED" ? config.ownership.cacheTtlHours : config.ownership.notFoundTtlHours;
  const expiresAt = new Date(Date.now() + ttlHours * 60 * 60 * 1000);

  await withDb(
    async (db) => {
      const aircraft = await db.aircraft.upsert({
        where: { registration: result.registration },
        create: { registration: result.registration },
        update: {},
        select: { id: true },
      });

      const data = {
        owner: result.owner,
        ownerKind: result.ownerKind,
        operator: result.operator,
        managementCompany: result.managementCompany,
        charterOperator: result.charterOperator,
        status: result.status,
        confidence: result.confidence,
        confidenceBand: result.confidenceBand,
        beneficialOwnerConfirmed: result.beneficialOwnerConfirmed,
        summary: result.summary ?? result.notFoundReason ?? null,
        evidence: result.evidence,
        sources: result.sources as unknown as object,
        queries: result.queries as unknown as object,
        searchProvider: result.searchProvider,
        analyzer: result.analyzer,
        errorMessage: result.errorMessage ?? null,
        searchedAt: new Date(),
        lastVerifiedAt: new Date(),
        expiresAt,
      };

      await db.ownershipRecord.upsert({
        where: { registration: result.registration },
        create: { aircraftId: aircraft.id, registration: result.registration, ...data },
        update: data,
      });
      return null;
    },
    null,
    "ownership:persist",
  );
}

/**
 * Resolve ownership for a registration, using cached results when they are
 * still fresh. `force` re-runs the full research pipeline.
 */
export async function getOwnership(
  rawRegistration: string,
  options: OwnershipOptions = {},
): Promise<OwnershipResult> {
  const registration = normalizeRegistration(rawRegistration);
  if (!registration) {
    return emptyResult(
      rawRegistration,
      "NOT_FOUND",
      [],
      [],
      "That does not look like a valid aircraft registration.",
    );
  }

  const key = cacheKeys.ownership(registration);

  if (!options.force) {
    const hot = await cache.getJson<OwnershipResult>(key);
    if (hot) return { ...hot, cached: true };

    const stored = await loadPersisted(registration);
    if (stored) {
      await cache.setJson(key, stored, 15 * 60);
      return stored;
    }
  } else {
    await cache.del(key);
  }

  const result = await research(registration, options);
  await persist(result);
  // Every resolved owner/operator/manager is also a company. Linking here —
  // rather than in a separate crawl — means the company pages are built from
  // exactly the sourced findings the aircraft panel shows, never from a
  // second, divergent view of the same evidence.
  void syncCompanyLinks(result).catch((error) =>
    console.warn("[company] link sync failed:", (error as Error).message),
  );
  await cache.setJson(key, result, result.status === "RESOLVED" ? 60 * 60 : 10 * 60);
  return result;
}

/** Manual re-verification, used by the "Refresh ownership information" button. */
export function refreshOwnership(
  registration: string,
  options: OwnershipOptions = {},
): Promise<OwnershipResult> {
  return getOwnership(registration, { ...options, force: true });
}
