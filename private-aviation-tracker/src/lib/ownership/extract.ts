import type { OwnerKind, OwnershipSource } from "@/lib/types";
import type { SearchResult } from "@/lib/search/types";
import { authorityFor, hostOf, isAggregatorName } from "./sources";

/**
 * Evidence extraction.
 *
 * Candidate owner names are pulled out of search titles and snippets by
 * looking for organisation-name shapes (capitalised words ending in a legal or
 * aviation suffix), then scored by how authoritative the sources are, how many
 * *distinct* domains mention them, and how close they sit to the registration
 * in the text. Nothing is inferred from the registration itself, and a name
 * that appears on exactly one low-authority page can never reach high
 * confidence.
 */

const LEGAL_SUFFIXES = new Set([
  "LLC", "L.L.C.", "LLC.", "INC", "INC.", "INCORPORATED", "CORP", "CORP.",
  "CORPORATION", "CO", "CO.", "COMPANY", "LTD", "LTD.", "LIMITED", "LP",
  "L.P.", "LLP", "PLC", "GMBH", "MBH", "AG", "SA", "S.A.", "SAS", "SARL",
  "S.A.R.L.", "BV", "B.V.", "NV", "N.V.", "PTY", "AB", "A/S", "AS", "OY",
  "SPA", "S.P.A.", "SRL", "S.R.L.", "KFT", "ZRT", "DOO", "OOO", "PTE",
  "SDN", "BHD", "KG", "OHG", "SE", "APS", "NA", "N.A.",
]);

const AVIATION_SUFFIXES = new Set([
  "AVIATION", "AVIATIONS", "AIR", "AIRWAYS", "AIRLINES", "AIRLINE", "AIRCRAFT",
  "JET", "JETS", "AERO", "AEROSPACE", "FLIGHT", "FLIGHTS", "CHARTER",
  "CHARTERS", "EXECUTIVE", "WINGS", "AVIA",
]);

const BUSINESS_SUFFIXES = new Set([
  "HOLDINGS", "HOLDING", "TRUST", "TRUSTEE", "LEASING", "PARTNERS",
  "PARTNERSHIP", "GROUP", "CAPITAL", "MANAGEMENT", "ENTERPRISES", "ENTERPRISE",
  "VENTURES", "INTERNATIONAL", "INDUSTRIES", "ASSOCIATES", "SERVICES",
  "INVESTMENTS", "PROPERTIES", "FOUNDATION", "BANK",
]);

const ALL_SUFFIXES = new Set([...LEGAL_SUFFIXES, ...AVIATION_SUFFIXES, ...BUSINESS_SUFFIXES]);

const CONNECTORS = new Set(["OF", "AND", "THE", "DE", "DEL", "DER", "VAN", "VON", "DA", "&", "AL"]);

const STOP_WORDS = new Set([
  "AIRCRAFT", "REGISTRATION", "OWNER", "OPERATOR", "PHOTO", "PHOTOS", "FLIGHT",
  "TRACKING", "TRACKER", "HISTORY", "DATABASE", "PROFILE", "DETAILS", "SEARCH",
  "RESULTS", "LIVE", "STATUS", "ARRIVALS", "DEPARTURES", "AIRPORT", "SERIAL",
  "NUMBER", "TYPE", "MODEL", "YEAR", "PRIVATE", "BUSINESS",
]);

function cleanToken(token: string): string {
  return token.replace(/^[^\w&]+|[^\w&.]+$/g, "");
}

function isCapitalised(token: string): boolean {
  return /^[A-Z][\w&.'’-]*$/.test(token) || /^[A-Z0-9]{2,}$/.test(token);
}

/**
 * Extract organisation-shaped names: a run of capitalised words terminated by
 * a legal, aviation or business suffix.
 */
export function extractOrganisations(text: string): string[] {
  if (!text) return [];
  const found: string[] = [];
  // Work sentence by sentence so names never span unrelated clauses.
  for (const segment of text.split(/[.;:!?\n|·•]+|\s[-–—]\s/)) {
    const tokens = segment.split(/\s+/).map(cleanToken).filter(Boolean);
    for (let i = 0; i < tokens.length; i++) {
      const upper = tokens[i].toUpperCase();
      if (!ALL_SUFFIXES.has(upper)) continue;

      // Walk backwards collecting the capitalised head of the name.
      const parts: string[] = [tokens[i]];
      let j = i - 1;
      let words = 0;
      while (j >= 0 && words < 5) {
        const t = tokens[j];
        const tu = t.toUpperCase();
        if (CONNECTORS.has(tu) && parts.length > 0 && j > 0) {
          parts.unshift(t);
          j--;
          continue;
        }
        if (!isCapitalised(t)) break;
        if (STOP_WORDS.has(tu)) break;
        parts.unshift(t);
        words++;
        j--;
      }

      // Absorb a trailing legal suffix ("Foo Aviation LLC").
      let k = i + 1;
      while (k < tokens.length && LEGAL_SUFFIXES.has(tokens[k].toUpperCase())) {
        parts.push(tokens[k]);
        k++;
      }

      if (parts.length < 2) continue;
      const name = parts.join(" ").replace(/\s+/g, " ").trim();
      if (name.length < 5 || name.length > 80) continue;
      if (/\d{3,}/.test(name)) continue; // registrations, serials, phone numbers
      if (isAggregatorName(name)) continue;
      found.push(name);
      i = k - 1;
    }
  }
  return found;
}

/** Normalised key so "ABC Aviation, LLC" and "ABC Aviation LLC" collapse. */
export function canonicalName(name: string): string {
  return name
    .toUpperCase()
    .replace(/[.,'’"]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function classifyOwnerKind(name: string, context: string): OwnerKind {
  const n = name.toUpperCase();
  const c = context.toLowerCase();
  if (/\bTRUSTEE\b/.test(n) || /\btrustee\b/.test(c)) return "TRUSTEE";
  if (/\bTRUST\b/.test(n)) return "TRUSTEE";
  if (/\bcharter\b/.test(c) || /\bCHARTERS?\b/.test(n)) return "CHARTER_OPERATOR";
  if (/\bmanagement\b/.test(c) || /\bMANAGEMENT\b/.test(n)) return "MANAGEMENT_COMPANY";
  if (/\boperated by\b|\boperator\b/.test(c)) return "OPERATOR";
  if (/\bregistered (?:to|owner)\b|\bowner\b|\bowned by\b/.test(c)) return "REGISTERED_OWNER";
  return "UNKNOWN";
}

export interface Candidate {
  name: string;
  canonical: string;
  score: number;
  kind: OwnerKind;
  /** Distinct hosts that mention this name. */
  domains: string[];
  mentions: number;
  evidence: string[];
  sources: OwnershipSource[];
}

interface Mention {
  name: string;
  weight: number;
  kind: OwnerKind;
  host: string;
  result: SearchResult;
  context: string;
}

function proximityBoost(text: string, registration: string, name: string): number {
  const regIdx = text.toUpperCase().indexOf(registration.toUpperCase());
  const nameIdx = text.toUpperCase().indexOf(name.toUpperCase());
  if (regIdx < 0 || nameIdx < 0) return 1;
  const gap = Math.abs(regIdx - nameIdx);
  if (gap < 60) return 1.35;
  if (gap < 140) return 1.15;
  return 1;
}

/** Phrases that explicitly tie a name to the aircraft, e.g. "operated by X". */
const RELATION_PATTERNS: Array<{ re: RegExp; kind: OwnerKind; boost: number }> = [
  { re: /registered (?:owner|to)\s*:?\s*/i, kind: "REGISTERED_OWNER", boost: 1.5 },
  { re: /owner\s*:?\s*/i, kind: "REGISTERED_OWNER", boost: 1.3 },
  { re: /owned by\s+/i, kind: "REGISTERED_OWNER", boost: 1.4 },
  { re: /operated by\s+/i, kind: "OPERATOR", boost: 1.3 },
  { re: /operator\s*:?\s*/i, kind: "OPERATOR", boost: 1.2 },
  { re: /managed by\s+/i, kind: "MANAGEMENT_COMPANY", boost: 1.2 },
];

export function collectCandidates(
  registration: string,
  results: SearchResult[],
): Candidate[] {
  const mentions: Mention[] = [];

  for (const result of results) {
    const host = hostOf(result.url);
    const authority = authorityFor(host);
    const haystack = `${result.title}. ${result.snippet}`;
    // Only trust a page that actually names the registration.
    const mentionsRegistration = haystack
      .toUpperCase()
      .replace(/[-\s]/g, "")
      .includes(registration.toUpperCase().replace(/[-\s]/g, ""));
    if (!mentionsRegistration) continue;

    for (const name of extractOrganisations(haystack)) {
      const nameIdx = haystack.toUpperCase().indexOf(name.toUpperCase());
      const context = haystack.slice(Math.max(0, nameIdx - 90), nameIdx + name.length + 60);

      let weight = authority.weight;
      // Titles are stronger signals than body snippets.
      if (result.title.toUpperCase().includes(name.toUpperCase())) weight *= 1.15;
      weight *= proximityBoost(haystack, registration, name);
      // Higher-ranked results are more likely to be on-topic.
      weight *= result.rank <= 3 ? 1.1 : result.rank <= 6 ? 1.0 : 0.9;

      let kind = classifyOwnerKind(name, context);
      for (const pattern of RELATION_PATTERNS) {
        const m = pattern.re.exec(context);
        if (m && Math.abs((m.index ?? 0) + m[0].length - (nameIdx - Math.max(0, nameIdx - 90))) < 25) {
          weight *= pattern.boost;
          if (kind === "UNKNOWN") kind = pattern.kind;
          break;
        }
      }

      mentions.push({ name, weight, kind, host, result, context });
    }
  }

  const byName = new Map<string, Candidate>();
  for (const m of mentions) {
    const canonical = canonicalName(m.name);
    let candidate = byName.get(canonical);
    if (!candidate) {
      candidate = {
        name: m.name,
        canonical,
        score: 0,
        kind: m.kind,
        domains: [],
        mentions: 0,
        evidence: [],
        sources: [],
      };
      byName.set(canonical, candidate);
    }

    candidate.score += m.weight;
    candidate.mentions += 1;
    if (m.kind !== "UNKNOWN" && candidate.kind === "UNKNOWN") candidate.kind = m.kind;
    if (!candidate.domains.includes(m.host)) {
      candidate.domains.push(m.host);
      const authority = authorityFor(m.host);
      candidate.sources.push({
        title: m.result.title || m.host,
        url: m.result.url,
        label: authority.label,
        kind: authority.kind,
        snippet: m.result.snippet?.slice(0, 300) || undefined,
        weight: authority.weight,
      });
      candidate.evidence.push(`${authority.label}: “${m.context.trim().slice(0, 180)}”`);
    }
  }

  // Corroboration across independent domains is the strongest signal we have.
  for (const candidate of byName.values()) {
    const domainBonus = 1 + Math.min(3, candidate.domains.length - 1) * 0.35;
    candidate.score *= domainBonus;
  }

  return [...byName.values()].sort((a, b) => b.score - a.score);
}

/** Map a raw candidate score onto a 0-100 confidence value. */
export function scoreToConfidence(score: number, domains: number, hasRegistry: boolean): number {
  // 1.0 ≈ a single mention on an authoritative site.
  let confidence = Math.min(90, Math.round(score * 26));
  if (domains >= 3) confidence = Math.min(93, confidence + 6);
  if (hasRegistry) confidence = Math.min(96, confidence + 8);
  if (domains <= 1) confidence = Math.min(confidence, 48);
  return Math.max(0, confidence);
}

export function bandFor(confidence: number): "high" | "medium" | "low" | "none" {
  if (confidence >= 75) return "high";
  if (confidence >= 45) return "medium";
  if (confidence >= 20) return "low";
  return "none";
}
