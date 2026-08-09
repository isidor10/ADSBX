import { isUsRegistration } from "@/lib/aircraft/registration";

export interface QueryHints {
  manufacturer?: string | null;
  model?: string | null;
  typeCode?: string | null;
  operatorHint?: string | null;
}

/**
 * Build the search queries used to research a tail number, most productive
 * first. The caller truncates the list to SEARCH_MAX_QUERIES.
 */
export function buildOwnershipQueries(registration: string, hints: QueryHints = {}): string[] {
  const reg = registration.toUpperCase();
  const queries: string[] = [
    `"${reg}" aircraft owner`,
    `"${reg}" registration owner operator`,
    `"${reg}" aircraft registration`,
  ];

  if (hints.manufacturer || hints.model) {
    const type = [hints.manufacturer, hints.model].filter(Boolean).join(" ");
    queries.push(`"${reg}" ${type} owner`);
  }

  queries.push(`"${reg}" operator company`);
  queries.push(`"${reg}" jet owned by`);

  if (isUsRegistration(reg)) {
    // US registrations are overwhelmingly held by LLCs and bank trustees.
    queries.push(`"${reg}" LLC registered owner FAA`);
    queries.push(`"${reg}" trustee registration FAA registry`);
  } else {
    queries.push(`"${reg}" aircraft registry owner company`);
  }

  if (hints.operatorHint) {
    queries.push(`"${reg}" ${hints.operatorHint}`);
  }

  // De-duplicate while preserving order.
  return [...new Set(queries)];
}
