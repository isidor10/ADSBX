/**
 * Company name handling.
 *
 * Ownership records name companies as the sources spell them — "PRINCE
 * AVIATION D.O.O.", "Prince Aviation doo", "PRINCE AVIATION LLC" — and those
 * are all the same operator. Matching therefore happens on a normalised key
 * with legal suffixes stripped, while the display name keeps whatever the
 * best source actually wrote.
 *
 * Stripping is deliberately conservative. "Aviation", "Jet", "Air" and the
 * like are load-bearing parts of a company name and are never removed; only
 * legal form suffixes go.
 */

/** Legal-form suffixes across the jurisdictions business aviation lives in. */
const LEGAL_SUFFIXES = [
  "llc", "l l c", "inc", "incorporated", "corp", "corporation", "co", "company",
  "ltd", "limited", "llp", "lp", "plc", "pllc",
  "gmbh", "mbh", "ag", "kg", "gmbh co kg", "ug",
  "sa", "sas", "sarl", "sprl", "bv", "nv", "cv",
  "spa", "srl", "sl", "sav",
  "as", "asa", "ab", "oy", "oyj", "aps", "a s",
  "doo", "d o o", "dd", "d d", "ood", "eood",
  "pty", "pte", "sdn bhd", "kft", "zrt", "sp z oo", "sro", "s r o",
  "trustee", "trust", "owner trustee",
];

const SUFFIX_RE = new RegExp(
  `\\s+(${LEGAL_SUFFIXES.map((s) => s.replace(/ /g, "\\s*")).join("|")})\\.?$`,
  "i",
);

/** Uppercase, punctuation-free key used to decide whether two names match. */
export function companyMatchKey(name: string): string {
  let key = name
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[.,()'"&/]/g, " ")
    .replace(/\s+/g, " ")
    .trim();

  // Suffixes can stack: "Foo Aviation Ltd Co".
  for (let i = 0; i < 3; i += 1) {
    const stripped = key.replace(SUFFIX_RE, "");
    if (stripped === key) break;
    key = stripped.trim();
  }
  return key.toUpperCase();
}

/** URL segment for /company/[slug]. */
export function companySlug(name: string): string {
  const slug = companyMatchKey(name)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return slug || "unknown";
}

/**
 * Names that are not companies at all. Ownership sources routinely return
 * placeholder text, and a fleet page for "Unknown" or "Private Owner" would be
 * meaningless.
 */
const NON_COMPANY = new Set([
  "UNKNOWN",
  "PRIVATE",
  "PRIVATE OWNER",
  "PRIVATE INDIVIDUAL",
  "INDIVIDUAL",
  "N A",
  "NA",
  "NONE",
  "UNDISCLOSED",
  "WITHHELD",
  "CONFIDENTIAL",
  "SALE PENDING",
  "SALES",
]);

export function isCompanyName(name: string | null | undefined): name is string {
  if (!name) return false;
  const key = companyMatchKey(name);
  if (key.length < 3) return false;
  if (NON_COMPANY.has(key)) return false;
  // A bare person's name is not a company; requiring a token that reads as an
  // organisation would over-filter, so only obvious placeholders are excluded.
  return true;
}

/**
 * Fuzzy name matching.
 *
 * People type "Prince aviaton" and mean "Prince Aviation". Exact substring
 * matching turns that into "nothing found", which reads as a broken feature
 * rather than a typo. Matching is per token and tolerant of small spelling
 * errors, while still requiring every token of the query to match something —
 * so "Prince" does not match "Princess Yachts Aviation" by accident.
 */
function editDistance(a: string, b: string): number {
  if (a === b) return 0;
  if (Math.abs(a.length - b.length) > 2) return 3;
  const prev = Array.from({ length: b.length + 1 }, (_, i) => i);
  const row = new Array<number>(b.length + 1);
  for (let i = 1; i <= a.length; i += 1) {
    row[0] = i;
    for (let j = 1; j <= b.length; j += 1) {
      row[j] = Math.min(
        prev[j] + 1,
        row[j - 1] + 1,
        prev[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1),
      );
    }
    for (let j = 0; j <= b.length; j += 1) prev[j] = row[j];
  }
  return prev[b.length];
}

/** Tolerance scales with word length: short words must match exactly. */
function tokenMatches(queryToken: string, nameToken: string): boolean {
  if (nameToken.startsWith(queryToken) || queryToken.startsWith(nameToken)) return true;
  const allowed = queryToken.length >= 7 ? 2 : queryToken.length >= 4 ? 1 : 0;
  return allowed > 0 && editDistance(queryToken, nameToken) <= allowed;
}

/** 0 = no match, 1 = exact. Every query token must find a home in the name. */
export function nameMatchScore(query: string, name: string): number {
  const q = companyMatchKey(query);
  const n = companyMatchKey(name);
  if (!q || !n) return 0;
  if (q === n) return 1;
  if (n.includes(q)) return 0.9;

  const queryTokens = q.split(" ").filter((t) => t.length > 1);
  const nameTokens = n.split(" ").filter(Boolean);
  if (queryTokens.length === 0 || nameTokens.length === 0) return 0;

  let matched = 0;
  let fuzzy = false;
  for (const token of queryTokens) {
    const hit = nameTokens.find((nt) => tokenMatches(token, nt));
    if (!hit) return 0;
    if (hit !== token) fuzzy = true;
    matched += 1;
  }
  const coverage = matched / queryTokens.length;
  return Math.max(0.4, coverage * (fuzzy ? 0.72 : 0.85));
}
