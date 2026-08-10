import { normalizeRegistration } from "@/lib/aircraft/registration";
import { cache, cacheKeys } from "@/lib/cache";
import { withDb } from "@/lib/db";
import { nearestAirport } from "@/lib/history/airportLookup";
import { getCurrentFlight, getLastLanding } from "@/lib/flight/currentFlight";
import { findByRegistration } from "@/lib/live/recentIndex";
import { getLiveAircraft } from "@/lib/aircraft/service";
import type {
  AirportActivity,
  CompanyActivityFilters,
  CompanyFleetEntry,
  CompanyFlightActivity,
  CompanyProfile,
  CompanySummary,
  FleetRole,
  OwnershipResult,
} from "@/lib/types";
import { companyMatchKey, companySlug, isCompanyName } from "./naming";

/**
 * Company / operator intelligence.
 *
 * Companies are never typed in. A company exists here because a sourced
 * ownership finding named it, and every aircraft on its fleet page carries the
 * role it was found under — owner, operator, management, charter — so the page
 * can never imply that an operator owns what it merely flies.
 *
 * Everything else on the page (where the fleet is, where it last landed, which
 * airports it uses) is computed from flights this deployment actually
 * observed. An empty section says so instead of being filled in.
 */

interface RoleSource {
  role: FleetRole;
  name: string;
  confidence: number;
}

/** Create or update the company rows implied by one ownership result. */
export async function syncCompanyLinks(result: OwnershipResult): Promise<void> {
  const registration = result.registration;
  const candidates: Array<{ role: FleetRole; name: string | null; confidence: number }> = [
    {
      role: result.ownerKind === "BENEFICIAL_OWNER" ? "BENEFICIAL_OWNER" : "REGISTERED_OWNER",
      name: result.owner,
      confidence: result.confidence,
    },
    { role: "OPERATOR", name: result.operator, confidence: Math.min(result.confidence, 85) },
    {
      role: "MANAGEMENT_COMPANY",
      name: result.managementCompany,
      confidence: Math.min(result.confidence, 80),
    },
    {
      role: "CHARTER_OPERATOR",
      name: result.charterOperator,
      confidence: Math.min(result.confidence, 80),
    },
  ];

  const roles: RoleSource[] = candidates.flatMap((c) =>
    isCompanyName(c.name) ? [{ role: c.role, name: c.name, confidence: c.confidence }] : [],
  );

  if (roles.length === 0) return;

  const primarySource = result.sources[0]?.url ?? null;

  await withDb(
    async (db) => {
      const aircraft = await db.aircraft.upsert({
        where: { registration },
        create: { registration },
        update: {},
        select: { id: true },
      });

      for (const { role, name, confidence } of roles) {
        const matchKey = companyMatchKey(name);
        const slug = companySlug(name);

        const company = await db.company.upsert({
          where: { slug },
          create: { slug, name, matchKey, confidence },
          // Keep the best-evidenced spelling of the name.
          update: { matchKey, confidence: Math.max(confidence, 0) },
          select: { id: true },
        });

        await db.companyAircraft.upsert({
          where: {
            companyId_registration_role: { companyId: company.id, registration, role },
          },
          create: {
            companyId: company.id,
            aircraftId: aircraft.id,
            registration,
            role,
            source: result.searchProvider ? "ownership_search" : "registry",
            sourceUrl: primarySource,
            confidence,
            verifiedAt: new Date(),
          },
          update: { confidence, verifiedAt: new Date(), sourceUrl: primarySource },
        });
      }
      return null;
    },
    null,
    "company:sync",
  );
}

/** Companies matching a free-text query, best match first. */
export async function searchCompanies(query: string, limit = 10): Promise<CompanySummary[]> {
  const q = query.trim();
  if (q.length < 2) return [];
  const key = companyMatchKey(q);

  const rows = await withDb(
    (db) =>
      db.company.findMany({
        where: {
          OR: [
            { matchKey: { contains: key } },
            { name: { contains: q, mode: "insensitive" } },
          ],
        },
        // Registrations rather than a link count: one aircraft both owned and
        // operated by the same company is one aircraft, not two.
        include: { aircraft: { select: { registration: true } } },
        take: limit * 2,
      }),
    [],
    "company:search",
  );

  return rows
    .map((row) => ({
      slug: row.slug,
      name: row.name,
      aircraftCount: new Set(row.aircraft.map((a) => a.registration)).size,
      website: row.website,
      country: row.country,
      exact: row.matchKey === key,
    }))
    .sort((a, b) => Number(b.exact) - Number(a.exact) || b.aircraftCount - a.aircraftCount)
    .slice(0, limit);
}

interface FleetRow {
  registration: string;
  role: FleetRole;
  confidence: number;
  sourceUrl: string | null;
  aircraft: {
    typeCode: string | null;
    manufacturer: string | null;
    model: string | null;
    category: string | null;
  } | null;
}

/**
 * Live status for one aircraft. "Flying" is only ever claimed when the
 * aircraft is being received right now — a stale record says when it was last
 * seen instead of implying it is in the air.
 */
async function fleetEntry(row: FleetRow): Promise<CompanyFleetEntry> {
  const registration = row.registration;
  const live = findByRegistration(registration) ?? (await getLiveAircraft(registration));

  const [flight, lastLanding] = await Promise.all([
    live && !live.onGround ? getCurrentFlight(registration, live) : Promise.resolve(null),
    getLastLanding(registration),
  ]);

  const status: CompanyFleetEntry["status"] = !live
    ? "unknown"
    : live.onGround
      ? "on_ground"
      : "flying";

  // Where it is *now*. An airborne aircraft is not at the airport it last
  // landed at, so that fallback is only used when there is no live contact at
  // all — otherwise the table would read as though a flying jet were parked.
  let location: string | null = null;
  if (live?.onGround) {
    const field = await nearestAirport(live.lat, live.lon, 6);
    location = field ? (field.city ?? field.name) : "On the ground";
  } else if (live) {
    const near = await nearestAirport(live.lat, live.lon, 120);
    location = near
      ? `Near ${near.city ?? near.name}`
      : `${live.lat.toFixed(1)}°, ${live.lon.toFixed(1)}°`;
  } else if (lastLanding?.arrival) {
    location = lastLanding.arrival.city ?? lastLanding.arrival.name;
  }

  return {
    registration,
    role: row.role,
    typeCode: row.aircraft?.typeCode ?? live?.typeCode ?? null,
    manufacturer: row.aircraft?.manufacturer ?? live?.manufacturer ?? null,
    model: row.aircraft?.model ?? live?.model ?? null,
    status,
    location,
    destination: flight?.destination ?? null,
    destinationEstimated: flight?.destinationSource === "TRAJECTORY_ESTIMATE",
    lastSeenAt: live ? new Date(live.seenAt).toISOString() : null,
    lastLanding,
    confidence: row.confidence,
    sourceUrl: row.sourceUrl,
  };
}

export async function getCompany(slug: string): Promise<CompanyProfile | null> {
  const row = await withDb(
    (db) =>
      db.company.findUnique({
        where: { slug },
        include: {
          aircraft: {
            include: {
              aircraft: {
                select: { typeCode: true, manufacturer: true, model: true, category: true },
              },
            },
            orderBy: { registration: "asc" },
          },
        },
      }),
    null,
    "company:get",
  );
  if (!row) return null;

  // One entry per registration: an aircraft both owned and operated by the
  // same company should appear once, under its strongest role.
  const byRegistration = new Map<string, FleetRow>();
  const rolePriority: Record<FleetRole, number> = {
    BENEFICIAL_OWNER: 0,
    REGISTERED_OWNER: 1,
    OPERATOR: 2,
    MANAGEMENT_COMPANY: 3,
    CHARTER_OPERATOR: 4,
    ASSOCIATED: 5,
  };
  for (const link of row.aircraft) {
    const existing = byRegistration.get(link.registration);
    const candidate: FleetRow = {
      registration: link.registration,
      role: link.role as FleetRole,
      confidence: link.confidence,
      sourceUrl: link.sourceUrl,
      aircraft: link.aircraft,
    };
    if (!existing || rolePriority[candidate.role] < rolePriority[existing.role]) {
      byRegistration.set(link.registration, candidate);
    }
  }

  const fleet = await Promise.all([...byRegistration.values()].map(fleetEntry));

  return {
    slug: row.slug,
    name: row.name,
    website: row.website,
    country: row.country,
    summary: row.summary,
    fleet,
    stats: {
      aircraft: fleet.length,
      flying: fleet.filter((f) => f.status === "flying").length,
      onGround: fleet.filter((f) => f.status === "on_ground").length,
      unknown: fleet.filter((f) => f.status === "unknown").length,
    },
    note:
      fleet.length === 0
        ? "No aircraft are currently linked to this company. Links are created from sourced ownership findings."
        : null,
  };
}

/** Registrations in a company's fleet — used to filter the live map. */
export async function getCompanyRegistrations(slug: string): Promise<string[]> {
  const rows = await withDb(
    (db) =>
      db.companyAircraft.findMany({
        where: { company: { slug } },
        select: { registration: true },
        distinct: ["registration"],
      }),
    [],
    "company:registrations",
  );
  return rows.map((r) => r.registration);
}

/** Observed flight activity, newest first, with optional filters. */
export async function getCompanyActivity(
  slug: string,
  filters: CompanyActivityFilters = {},
): Promise<CompanyFlightActivity> {
  const registrations = await getCompanyRegistrations(slug);
  if (registrations.length === 0) {
    return { slug, flights: [], filters, note: "No aircraft are linked to this company yet." };
  }

  const wanted = filters.registration
    ? registrations.filter((r) => r === normalizeRegistration(filters.registration!))
    : registrations;

  const rows = await withDb(
    (db) =>
      db.flightLeg.findMany({
        where: {
          registration: { in: wanted },
          ...(filters.since ? { firstSeenAt: { gte: new Date(filters.since) } } : {}),
          ...(filters.until ? { firstSeenAt: { lte: new Date(filters.until) } } : {}),
          ...(filters.airport
            ? {
                OR: [
                  { departureIcao: filters.airport.toUpperCase() },
                  { arrivalIcao: filters.airport.toUpperCase() },
                ],
              }
            : {}),
        },
        orderBy: { firstSeenAt: "desc" },
        take: Math.min(filters.limit ?? 100, 300),
      }),
    [],
    "company:activity",
  );

  return {
    slug,
    filters,
    flights: rows.map((leg) => ({
      id: leg.id,
      registration: leg.registration,
      callsign: leg.callsign,
      status: leg.status as "ACTIVE" | "COMPLETED" | "STALE",
      departureIcao: leg.departureIcao,
      departureName: leg.departureName,
      departedAt: leg.departedAt?.toISOString() ?? null,
      arrivalIcao: leg.arrivalIcao,
      arrivalName: leg.arrivalName,
      arrivedAt: leg.arrivedAt?.toISOString() ?? null,
      distanceNm: leg.distanceNm,
      durationSec: leg.durationSec,
    })),
    note:
      rows.length === 0
        ? "No flights recorded for this fleet yet. Activity is built from ADS-B positions observed by this deployment."
        : null,
  };
}

/**
 * Most-visited airports, counted from observed departures and arrivals. Pure
 * arithmetic over recorded legs — no estimates, no rounding up.
 */
export async function getCompanyAirports(slug: string, limit = 10): Promise<AirportActivity[]> {
  const registrations = await getCompanyRegistrations(slug);
  if (registrations.length === 0) return [];

  const legs = await withDb(
    (db) =>
      db.flightLeg.findMany({
        where: { registration: { in: registrations } },
        select: {
          departureIcao: true,
          departureName: true,
          arrivalIcao: true,
          arrivalName: true,
        },
        take: 2000,
      }),
    [],
    "company:airports",
  );

  const counts = new Map<string, { name: string | null; departures: number; arrivals: number }>();
  const bump = (icao: string | null, name: string | null, key: "departures" | "arrivals") => {
    if (!icao) return;
    const entry = counts.get(icao) ?? { name, departures: 0, arrivals: 0 };
    entry[key] += 1;
    if (!entry.name && name) entry.name = name;
    counts.set(icao, entry);
  };

  for (const leg of legs) {
    bump(leg.departureIcao, leg.departureName, "departures");
    bump(leg.arrivalIcao, leg.arrivalName, "arrivals");
  }

  return [...counts.entries()]
    .map(([icao, v]) => ({
      icao,
      name: v.name,
      departures: v.departures,
      arrivals: v.arrivals,
      movements: v.departures + v.arrivals,
    }))
    .sort((a, b) => b.movements - a.movements)
    .slice(0, limit);
}

/** Cached profile — company pages are read far more often than they change. */
export async function getCompanyCached(slug: string): Promise<CompanyProfile | null> {
  // Only the slow, stable parts are cached; live fleet status is recomputed on
  // every request inside getCompany, which is what makes "Flying" trustworthy.
  return cache.remember(cacheKeys.company(slug), 20, () => getCompany(slug));
}
