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
