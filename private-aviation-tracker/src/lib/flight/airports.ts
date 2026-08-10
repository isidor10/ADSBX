import { CORE_AIRPORT_RECORDS } from "@/lib/data/airports";
import { withDb } from "@/lib/db";
import { distanceNm } from "@/lib/geo";
import type { AirportRef } from "@/lib/types";

/**
 * Airport lookup for route work.
 *
 * The bundled core list is always available; the Airport table (populated by
 * `npm run import:airports`) is searched too and merged in, which is what makes
 * small private fields resolvable. Neither source is ever synthesised — an
 * airport that is in no dataset stays unknown.
 */

export interface CandidateAirport extends AirportRef {
  /** Present on rows from the imported dataset. */
  type: string | null;
}

function fromCore(icao: string): CandidateAirport | null {
  const row = CORE_AIRPORT_RECORDS.find((a) => a.icao === icao.toUpperCase());
  return row ? { ...row, type: null } : null;
}

/** Airports within `radiusNm` of a point, nearest first. */
export async function airportsNear(
  lat: number,
  lon: number,
  radiusNm: number,
  limit = 60,
): Promise<CandidateAirport[]> {
  const latDelta = radiusNm / 60 + 0.1;
  // Longitude degrees shrink with latitude; guard the pole case.
  const lonDelta = latDelta / Math.max(0.15, Math.cos((lat * Math.PI) / 180));

  const dbRows = await withDb(
    (db) =>
      db.airport.findMany({
        where: {
          lat: { gte: lat - latDelta, lte: lat + latDelta },
          lon: { gte: lon - lonDelta, lte: lon + lonDelta },
        },
        take: 1200,
      }),
    [] as Array<{
      icao: string;
      iata: string | null;
      name: string;
      city: string | null;
      country: string | null;
      lat: number;
      lon: number;
      type: string | null;
    }>,
    "flight:airports-near",
  );

  const merged = new Map<string, CandidateAirport>();
  for (const a of CORE_AIRPORT_RECORDS) {
    if (Math.abs(a.lat - lat) > latDelta || Math.abs(a.lon - lon) > lonDelta) continue;
    merged.set(a.icao, { ...a, type: null });
  }
  // Imported rows win: they carry the airport type, which the ranking uses.
  for (const a of dbRows) {
    merged.set(a.icao, {
      icao: a.icao,
      iata: a.iata,
      name: a.name,
      city: a.city,
      country: a.country,
      lat: a.lat,
      lon: a.lon,
      type: a.type,
    });
  }

  return [...merged.values()]
    .map((a) => ({ airport: a, d: distanceNm(lat, lon, a.lat, a.lon) }))
    .filter((x) => x.d <= radiusNm)
    .sort((a, b) => a.d - b.d)
    .slice(0, limit)
    .map((x) => x.airport);
}

/** Resolve an ICAO (or IATA) code to a positioned airport. */
export async function findAirport(code: string | null | undefined): Promise<AirportRef | null> {
  if (!code) return null;
  const key = code.trim().toUpperCase();
  if (key.length < 3) return null;

  const row = await withDb(
    (db) =>
      db.airport.findFirst({
        where: key.length === 4 ? { icao: key } : { iata: key },
      }),
    null,
    "flight:airport-by-code",
  );
  if (row) {
    return {
      icao: row.icao,
      iata: row.iata,
      name: row.name,
      city: row.city,
      country: row.country,
      lat: row.lat,
      lon: row.lon,
    };
  }

  const core =
    fromCore(key) ?? CORE_AIRPORT_RECORDS.filter((a) => a.iata === key).map((a) => ({ ...a, type: null }))[0];
  return core ?? null;
}

/** Display label: "LFPB Paris Le Bourget", falling back to whatever is known. */
export function airportLabel(airport: AirportRef | null): string {
  if (!airport) return "Unknown";
  const code = airport.icao ?? airport.iata;
  const place = airport.city ?? airport.name;
  return code ? `${code} ${place}` : place;
}
