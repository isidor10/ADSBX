import { cache } from "@/lib/cache";
import { config } from "@/lib/config";
import type { AircraftPhoto, OwnershipSource } from "@/lib/types";

/**
 * Keyless aircraft-database lookup.
 *
 * Ownership research previously had exactly two inputs: the FAA Releasable
 * Aircraft Database (US registrations only, and only after a manual import)
 * and a paid web-search API. A deployment with neither — which is the default
 * — could therefore never resolve an owner, which in turn meant no companies
 * were ever created, because companies are derived from resolved ownership.
 *
 * This adds a third input that needs no configuration at all: a public
 * aircraft database keyed on registration or Mode-S hex, returning the
 * registered owner, the operator flag and a photograph of that specific
 * airframe.
 *
 * It is treated as an aviation database, not a registry: it is a compilation
 * of public registry data rather than the register itself, so it scores below
 * an official registry entry and above an unattributed web page. Where the FAA
 * data is present, the FAA still wins.
 */

export interface AircraftDbRecord {
  registration: string;
  registeredOwner: string | null;
  ownerCountry: string | null;
  /** Operator flag code (ICAO-ish), when the database carries one. */
  operatorFlag: string | null;
  manufacturer: string | null;
  type: string | null;
  icaoType: string | null;
  modeS: string | null;
  /** A photograph of this exact airframe, when the database has one. */
  photo: AircraftPhoto | null;
  source: OwnershipSource;
}

const REQUEST_TIMEOUT_MS = 7000;

interface AdsbdbAircraft {
  type?: string;
  icao_type?: string;
  manufacturer?: string;
  mode_s?: string;
  registration?: string;
  registered_owner_country_iso_name?: string;
  registered_owner_country_name?: string;
  registered_owner_operator_flag_code?: string;
  registered_owner?: string;
  url_photo?: string | null;
  url_photo_thumbnail?: string | null;
}

function clean(value: string | undefined | null): string | null {
  const trimmed = value?.trim();
  return trimmed && trimmed.toUpperCase() !== "UNKNOWN" ? trimmed : null;
}

async function fetchRecord(registration: string): Promise<AircraftDbRecord | null> {
  const reg = registration.trim().toUpperCase();
  const url = `${config.route.baseUrl.replace(/\/+$/, "")}/aircraft/${encodeURIComponent(reg)}`;

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  try {
    const res = await fetch(url, {
      headers: { accept: "application/json", "user-agent": config.adsb.userAgent },
      signal: controller.signal,
      cache: "no-store",
    });
    // 404 simply means the database has never seen this tail.
    if (!res.ok) return null;

    const body = (await res.json()) as { response?: { aircraft?: AdsbdbAircraft } };
    const raw = body.response?.aircraft;
    if (!raw) return null;

    const owner = clean(raw.registered_owner);
    const photoUrl = clean(raw.url_photo);

    return {
      registration: clean(raw.registration) ?? reg,
      registeredOwner: owner,
      ownerCountry: clean(raw.registered_owner_country_name),
      operatorFlag: clean(raw.registered_owner_operator_flag_code),
      manufacturer: clean(raw.manufacturer),
      type: clean(raw.type),
      icaoType: clean(raw.icao_type),
      modeS: clean(raw.mode_s),
      photo: photoUrl
        ? {
            url: photoUrl,
            thumbnailUrl: clean(raw.url_photo_thumbnail),
            credit: "Photo via adsbdb / Planespotters.net",
            link: photoUrl,
            source: "aircraft_database",
            // Keyed on this registration by the database itself, so it is a
            // photograph of this airframe rather than of its type.
            verified: true,
          }
        : null,
      source: {
        title: `${reg} — aircraft database record`,
        url: `https://api.adsbdb.com/v0/aircraft/${encodeURIComponent(reg)}`,
        label: "adsbdb",
        kind: "aviation_database",
        snippet: owner ? `Registered owner: ${owner}` : undefined,
        weight: 0.72,
      },
    };
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Cached lookup. Misses are cached at a shorter TTL so an unlisted tail is not
 * re-queried on every panel open, but is retried within a day.
 */
export async function lookupAircraftDatabase(
  registration: string,
): Promise<AircraftDbRecord | null> {
  if (!config.aircraftDb.enabled) return null;
  const reg = registration.trim().toUpperCase();
  if (!/^[A-Z0-9-]{3,10}$/.test(reg)) return null;

  const key = `acdb:v1:${reg}`;
  const hit = await cache.getJson<AircraftDbRecord | { miss: true }>(key);
  if (hit) return "miss" in hit ? null : hit;

  const record = await fetchRecord(reg);
  await cache.setJson(
    key,
    record ?? { miss: true },
    (record ? config.aircraftDb.ttlHours : config.aircraftDb.missTtlHours) * 3600,
  );
  return record;
}
