import { normalizeIcao24, normalizeRegistration } from "@/lib/aircraft/registration";
import { withDb } from "@/lib/db";
import {
  findByCallsign,
  findByIcao,
  findByRegistration,
  snapshot,
} from "@/lib/live/recentIndex";
import type { LiveAircraft, SearchHit } from "@/lib/types";

/**
 * Global search across live traffic and everything on record.
 *
 * Airborne aircraft rank above stored records so "N123AB" jumps straight to
 * the aircraft on the map when it is flying, and falls back to its last known
 * information when it is not.
 */

function hitFromLive(a: LiveAircraft, matchedOn: string, score: number): SearchHit {
  return {
    registration: a.registration,
    icao24: a.icao24,
    callsign: a.callsign,
    typeCode: a.typeCode,
    manufacturer: a.manufacturer,
    model: a.model,
    owner: null,
    operator: a.feedOperator,
    airborne: !a.onGround,
    lat: a.lat,
    lon: a.lon,
    altBaroFt: a.altBaroFt,
    lastSeenAt: new Date(a.seenAt).toISOString(),
    matchedOn,
    score,
  };
}

function searchLive(query: string): SearchHit[] {
  const q = query.trim().toUpperCase();
  const hits: SearchHit[] = [];
  const seen = new Set<string>();

  const push = (a: LiveAircraft | null, matchedOn: string, score: number) => {
    if (!a || seen.has(a.icao24)) return;
    seen.add(a.icao24);
    hits.push(hitFromLive(a, matchedOn, score));
  };

  const reg = normalizeRegistration(q);
  if (reg) push(findByRegistration(reg), "registration", 100);

  const hex = normalizeIcao24(q);
  if (hex) push(findByIcao(hex), "icao hex", 100);

  push(findByCallsign(q), "callsign", 95);

  // Substring pass over everything currently in view.
  if (q.length >= 2) {
    for (const a of snapshot()) {
      if (seen.has(a.icao24)) continue;
      const fields: Array<[string | null, string, number]> = [
        [a.registration, "registration", 90],
        [a.callsign, "callsign", 80],
        [a.icao24.toUpperCase(), "icao hex", 80],
        [a.typeCode, "type", 60],
        [a.model, "model", 55],
        [a.manufacturer, "manufacturer", 50],
        [a.feedOperator, "operator", 55],
      ];
      for (const [value, label, base] of fields) {
        if (!value) continue;
        const upper = value.toUpperCase();
        if (upper === q) {
          push(a, label, base + 5);
          break;
        }
        if (upper.includes(q)) {
          push(a, label, base - 10);
          break;
        }
      }
    }
  }

  return hits;
}

async function searchDatabase(query: string, exclude: Set<string>): Promise<SearchHit[]> {
  const q = query.trim();
  if (q.length < 2) return [];

  const rows = await withDb(
    (db) =>
      db.aircraft.findMany({
        where: {
          OR: [
            { registration: { contains: q, mode: "insensitive" } },
            { icao24: { contains: q.toLowerCase() } },
            { typeCode: { contains: q, mode: "insensitive" } },
            { model: { contains: q, mode: "insensitive" } },
            { manufacturer: { contains: q, mode: "insensitive" } },
            { ownership: { owner: { contains: q, mode: "insensitive" } } },
            { ownership: { operator: { contains: q, mode: "insensitive" } } },
          ],
        },
        include: { ownership: true },
        orderBy: { lastSeenAt: "desc" },
        take: 30,
      }),
    [],
    "search:db",
  );

  return rows
    .filter((row) => !exclude.has(row.registration))
    .map((row) => {
      const upper = q.toUpperCase();
      let matchedOn = "record";
      let score = 40;
      if (row.registration.toUpperCase() === upper) {
        matchedOn = "registration";
        score = 88;
      } else if (row.registration.toUpperCase().includes(upper)) {
        matchedOn = "registration";
        score = 70;
      } else if (row.ownership?.owner?.toUpperCase().includes(upper)) {
        matchedOn = "owner";
        score = 60;
      } else if (row.ownership?.operator?.toUpperCase().includes(upper)) {
        matchedOn = "operator";
        score = 58;
      } else if (row.model?.toUpperCase().includes(upper) || row.typeCode?.toUpperCase().includes(upper)) {
        matchedOn = "model";
        score = 50;
      }

      return {
        registration: row.registration,
        icao24: row.icao24,
        callsign: null,
        typeCode: row.typeCode,
        manufacturer: row.manufacturer,
        model: row.model,
        owner: row.ownership?.owner ?? null,
        operator: row.ownership?.operator ?? null,
        airborne: false,
        lat: null,
        lon: null,
        altBaroFt: null,
        lastSeenAt: row.lastSeenAt?.toISOString() ?? null,
        matchedOn,
        score,
      } satisfies SearchHit;
    });
}

export async function searchAircraft(query: string, limit = 25): Promise<SearchHit[]> {
  const live = searchLive(query);
  const seen = new Set(live.map((h) => h.registration).filter((r): r is string => Boolean(r)));
  const stored = await searchDatabase(query, seen);

  return [...live, ...stored]
    .sort((a, b) => b.score - a.score || Number(b.airborne) - Number(a.airborne))
    .slice(0, limit);
}
