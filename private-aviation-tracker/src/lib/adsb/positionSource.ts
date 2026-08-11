import type { PositionSource } from "@/lib/types";

/**
 * How a position was actually obtained.
 *
 * Not every contact on the map is equally trustworthy, and until now the app
 * treated them all the same. The readsb/tar1090 schema states the reception
 * method per aircraft in its `type` field, and every feed in the chain except
 * OpenSky carries it — it was simply being discarded during normalisation.
 *
 * The distinction is not cosmetic:
 *
 *   ADS-B   the aircraft broadcast its own GPS position. Accurate to metres.
 *   ADS-R   the same position rebroadcast by a ground station on the other
 *           link layer. As good as ADS-B, one hop removed.
 *   TIS-B   a ground station broadcasting what radar sees, for aircraft that
 *           do not transmit ADS-B themselves. Coarser, and lagged.
 *   MLAT    no position was transmitted at all — it is computed from the
 *           arrival-time differences of a Mode S reply at several receivers.
 *           Typically hundreds of metres of error, and it degrades badly at
 *           the edge of receiver coverage.
 *   ADS-C   contract position reporting over satellite, used oceanically.
 *           Minutes old by design, not seconds.
 *   Mode S  an aircraft seen but not located; kept only if a feed supplies a
 *           position from elsewhere.
 *
 * A business jet shown by MLAT may genuinely be a few hundred metres from
 * where it is drawn, and an ADS-C contact may be several minutes stale. Saying
 * so is the difference between a map that is precise and a map that merely
 * looks precise.
 */

const TYPE_MAP: Record<string, PositionSource> = {
  adsb_icao: "ADSB",
  adsb_icao_nt: "ADSB",
  adsb_other: "ADSB",
  adsr_icao: "ADSR",
  adsr_other: "ADSR",
  tisb_icao: "TISB",
  tisb_other: "TISB",
  tisb_trackfile: "TISB",
  mlat: "MLAT",
  adsc: "ADSC",
  mode_s: "MODE_S",
  modes: "MODE_S",
  other: "OTHER",
};

export function positionSourceFor(rawType: string | null | undefined): PositionSource {
  if (!rawType) return "UNKNOWN";
  return TYPE_MAP[rawType.trim().toLowerCase()] ?? "OTHER";
}

/** Short label, and what it means, for the data-source panel. */
export const POSITION_SOURCE_LABEL: Record<PositionSource, string> = {
  ADSB: "ADS-B",
  ADSR: "ADS-R rebroadcast",
  TISB: "TIS-B (radar relay)",
  MLAT: "MLAT (multilateration)",
  ADSC: "ADS-C (satellite)",
  MODE_S: "Mode S",
  OTHER: "Other",
  UNKNOWN: "Not stated by feed",
};

/**
 * Rough horizontal uncertainty, for the aircraft panel. Deliberately given as
 * an order of magnitude rather than a false precision — the real figure varies
 * with receiver geometry, and the feeds do not publish it per contact.
 */
export const POSITION_SOURCE_ACCURACY: Record<PositionSource, string | null> = {
  ADSB: null, // GPS-derived; no caveat needed.
  ADSR: null,
  TISB: "Radar-derived and relayed — typically a few hundred metres out and a few seconds behind.",
  MLAT: "Computed from signal arrival times, not broadcast by the aircraft — typically a few hundred metres out, and worse near the edge of receiver coverage.",
  ADSC: "Satellite contract report — these arrive minutes apart by design, so the position is older than it looks.",
  MODE_S: "Identified by transponder reply; the position comes from elsewhere and may be approximate.",
  OTHER: null,
  UNKNOWN: "This feed does not state how the position was obtained.",
};

/** Order used in the panel: most trustworthy first. */
export const POSITION_SOURCE_ORDER: PositionSource[] = [
  "ADSB",
  "ADSR",
  "MLAT",
  "TISB",
  "ADSC",
  "MODE_S",
  "OTHER",
  "UNKNOWN",
];

/** Count contacts by reception method. */
export function countByPositionSource(
  aircraft: Array<{ positionSource?: PositionSource }>,
): Record<PositionSource, number> {
  const counts = {
    ADSB: 0, ADSR: 0, TISB: 0, MLAT: 0, ADSC: 0, MODE_S: 0, OTHER: 0, UNKNOWN: 0,
  } satisfies Record<PositionSource, number>;
  for (const a of aircraft) counts[a.positionSource ?? "UNKNOWN"] += 1;
  return counts;
}
