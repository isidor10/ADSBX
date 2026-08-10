import { searchCompanies } from "@/lib/company/service";
import { CORE_AIRPORT_RECORDS } from "@/lib/data/airports";
import { withDb } from "@/lib/db";
import type { GlobalSearchResults, OwnerHit, AirportHit } from "@/lib/types";
import { searchAircraft } from "./service";

/**
 * One search box, five kinds of answer: aircraft, companies, owners,
 * operators and airports.
 *
 * Owners and operators are listed separately from companies on purpose. A
 * company page exists for names that have a fleet; a one-off registered owner
 * that appears on a single tail is still worth finding, but it is not an
 * operator and must not be presented as one.
 */

async function searchOwners(query: string, limit: number): Promise<{ owners: OwnerHit[]; operators: OwnerHit[] }> {
  const q = query.trim();
  if (q.length < 2) return { owners: [], operators: [] };

  const rows = await withDb(
    (db) =>
      db.ownershipRecord.findMany({
        where: {
          OR: [
            { owner: { contains: q, mode: "insensitive" } },
            { operator: { contains: q, mode: "insensitive" } },
            { managementCompany: { contains: q, mode: "insensitive" } },
          ],
        },
        select: {
          registration: true,
          owner: true,
          operator: true,
          managementCompany: true,
          confidence: true,
        },
        take: 120,
      }),
    [],
    "search:owners",
  );

  const owners = new Map<string, OwnerHit>();
  const operators = new Map<string, OwnerHit>();
  const upper = q.toUpperCase();

  const add = (map: Map<string, OwnerHit>, name: string | null, registration: string, confidence: number, role: OwnerHit["role"]) => {
    if (!name || !name.toUpperCase().includes(upper)) return;
    const entry = map.get(name) ?? { name, role, registrations: [], confidence };
    if (!entry.registrations.includes(registration)) entry.registrations.push(registration);
    entry.confidence = Math.max(entry.confidence, confidence);
    map.set(name, entry);
  };

  for (const row of rows) {
    add(owners, row.owner, row.registration, row.confidence, "owner");
    add(operators, row.operator, row.registration, row.confidence, "operator");
    add(operators, row.managementCompany, row.registration, row.confidence, "management");
  }

  const rank = (a: OwnerHit, b: OwnerHit) =>
    b.registrations.length - a.registrations.length || b.confidence - a.confidence;

  return {
    owners: [...owners.values()].sort(rank).slice(0, limit),
    operators: [...operators.values()].sort(rank).slice(0, limit),
  };
}

async function searchAirports(query: string, limit: number): Promise<AirportHit[]> {
  const q = query.trim().toUpperCase();
  if (q.length < 2) return [];

  const rows = await withDb(
    (db) =>
      db.airport.findMany({
        where: {
          OR: [
            { icao: { startsWith: q } },
            { iata: { equals: q } },
            { name: { contains: query, mode: "insensitive" } },
            { city: { contains: query, mode: "insensitive" } },
          ],
        },
        take: limit * 2,
      }),
    [] as Array<{
      icao: string;
      iata: string | null;
      name: string;
      city: string | null;
      country: string | null;
      lat: number;
      lon: number;
    }>,
    "search:airports",
  );

  const merged = new Map<string, AirportHit>();
  for (const a of CORE_AIRPORT_RECORDS) {
    const hit =
      a.icao.startsWith(q) ||
      a.iata === q ||
      a.name.toUpperCase().includes(q) ||
      (a.city ?? "").toUpperCase().includes(q);
    if (hit) merged.set(a.icao, { ...a });
  }
  for (const a of rows) {
    merged.set(a.icao, {
      icao: a.icao,
      iata: a.iata,
      name: a.name,
      city: a.city,
      country: a.country,
      lat: a.lat,
      lon: a.lon,
    });
  }

  // Exact code matches first — typing "LFPB" wants that airport, not a list of
  // everything whose name happens to contain the letters.
  return [...merged.values()]
    .sort((a, b) => {
      const score = (x: AirportHit) => (x.icao === q ? 0 : x.iata === q ? 1 : 2);
      return score(a) - score(b);
    })
    .slice(0, limit);
}

export async function globalSearch(query: string, limit = 8): Promise<GlobalSearchResults> {
  const q = query.trim();
  if (q.length < 2) {
    return { query: q, aircraft: [], companies: [], owners: [], operators: [], airports: [] };
  }

  const [aircraft, companies, ownerHits, airports] = await Promise.all([
    searchAircraft(q, limit * 2),
    searchCompanies(q, limit),
    searchOwners(q, limit),
    searchAirports(q, limit),
  ]);

  return {
    query: q,
    aircraft,
    companies,
    owners: ownerHits.owners,
    operators: ownerHits.operators,
    airports,
  };
}
