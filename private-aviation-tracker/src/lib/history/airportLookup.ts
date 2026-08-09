import { CORE_AIRPORT_RECORDS, type AirportRecord } from "@/lib/data/airports";
import { withDb } from "@/lib/db";
import { distanceNm } from "@/lib/geo";

/**
 * Nearest-airport resolution for departure/arrival inference.
 *
 * The bundled core list is always searched. If the Airport table has been
 * populated (`npm run import:airports`) its rows are searched too and win when
 * closer, which is what makes small private fields resolvable.
 */

export interface NearestAirport extends AirportRecord {
  distanceNm: number;
  /** Inference is positional, never authoritative flight-plan data. */
  inferred: true;
}

const DEFAULT_MAX_NM = 8;

function nearestInCore(lat: number, lon: number, maxNm: number): NearestAirport | null {
  let best: NearestAirport | null = null;
  for (const airport of CORE_AIRPORT_RECORDS) {
    // Cheap bounding-box reject before the trig.
    if (Math.abs(airport.lat - lat) > 0.5) continue;
    const d = distanceNm(lat, lon, airport.lat, airport.lon);
    if (d <= maxNm && (!best || d < best.distanceNm)) {
      best = { ...airport, distanceNm: d, inferred: true };
    }
  }
  return best;
}

async function nearestInDb(
  lat: number,
  lon: number,
  maxNm: number,
): Promise<NearestAirport | null> {
  const delta = maxNm / 60 + 0.05;
  const rows = await withDb(
    (db) =>
      db.airport.findMany({
        where: {
          lat: { gte: lat - delta, lte: lat + delta },
          lon: { gte: lon - delta * 2, lte: lon + delta * 2 },
        },
        take: 200,
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
    "airports",
  );

  let best: NearestAirport | null = null;
  for (const a of rows) {
    const d = distanceNm(lat, lon, a.lat, a.lon);
    if (d <= maxNm && (!best || d < best.distanceNm)) {
      best = {
        icao: a.icao,
        iata: a.iata,
        name: a.name,
        city: a.city,
        country: a.country,
        lat: a.lat,
        lon: a.lon,
        distanceNm: d,
        inferred: true,
      };
    }
  }
  return best;
}

export async function nearestAirport(
  lat: number,
  lon: number,
  maxNm = DEFAULT_MAX_NM,
): Promise<NearestAirport | null> {
  const [core, fromDb] = await Promise.all([
    Promise.resolve(nearestInCore(lat, lon, maxNm)),
    nearestInDb(lat, lon, maxNm),
  ]);
  if (core && fromDb) return fromDb.distanceNm < core.distanceNm ? fromDb : core;
  return fromDb ?? core;
}
