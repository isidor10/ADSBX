import { bearingDelta, bearingDeg, distanceNm } from "@/lib/geo";
import type { AirportRef, LiveAircraft } from "@/lib/types";
import { airportsNear, type CandidateAirport } from "./airports";

/**
 * Destination estimation from the observed trajectory.
 *
 * This is the fallback used when no route data source knows the flight, and it
 * is treated as exactly what it is: a guess from a heading. The rules below
 * exist to keep it from ever being a confident guess.
 *
 *   - Only airborne aircraft with a usable track and speed are considered.
 *   - A candidate must lie close to the projected ground track, with the
 *     corridor widening only as far as normal navigation slop.
 *   - Confidence is capped well below what a filed route would score, and an
 *     aircraft in the cruise far from anywhere produces no estimate at all
 *     rather than naming the next airport along the line.
 *
 * An aircraft descending towards a field a short distance ahead is the one
 * case where a positional estimate is genuinely strong, and that is where the
 * confidence is allowed to rise.
 */

export interface DestinationEstimate {
  airport: AirportRef;
  /** 0-100. Never reaches the confidence of a filed route. */
  confidence: number;
  reason: string;
}

/** Highest confidence a trajectory estimate may ever claim. */
const MAX_ESTIMATE_CONFIDENCE = 72;
const MIN_ESTIMATE_CONFIDENCE = 34;

/** Below this ground speed the track is not meaningful. */
const MIN_GROUND_SPEED_KT = 60;

/** Above this, and not descending, the aircraft is in the cruise. */
const CRUISE_ALTITUDE_FT = 25_000;

/** Ceiling for an aircraft still at cruise: it may simply be passing over. */
const CRUISE_CONFIDENCE_CAP = 45;

/** How far ahead to look. Beyond this the guess is worthless. */
const MAX_LOOKAHEAD_NM = 600;

/** Airport types worth proposing as a destination for private traffic. */
const USABLE_TYPES = new Set(["large_airport", "medium_airport", "small_airport"]);

function usable(airport: CandidateAirport): boolean {
  // Rows without a type come from the curated core list, which is all real
  // airports; imported rows carry heliports and closed fields that would
  // otherwise pollute the ranking.
  return airport.type === null || USABLE_TYPES.has(airport.type);
}

function toRef(airport: CandidateAirport): AirportRef {
  const { type: _type, ...ref } = airport;
  return ref;
}

/**
 * Corridor half-width at a given range. Tight near the aircraft (it is lined
 * up on final, or it is not) and wider far out, where a few degrees of drift
 * covers a lot of ground.
 */
function corridorNm(rangeNm: number): number {
  return Math.min(45, 6 + rangeNm * 0.06);
}

export async function estimateDestination(
  a: Pick<LiveAircraft, "lat" | "lon" | "trackDeg" | "groundSpeedKt" | "altBaroFt" | "verticalRateFpm" | "onGround">,
): Promise<DestinationEstimate | null> {
  if (a.onGround) return null;
  if (a.trackDeg === null || a.groundSpeedKt === null) return null;
  if (a.groundSpeedKt < MIN_GROUND_SPEED_KT) return null;

  const descending = (a.verticalRateFpm ?? 0) < -250;
  const altitude = a.altBaroFt ?? 0;

  // How far ahead to look: an aircraft on the way down is close to its
  // destination, one in the cruise could still be hours out.
  const lookahead = descending ? 250 : Math.min(MAX_LOOKAHEAD_NM, 120 + altitude / 100);

  const candidates = (await airportsNear(a.lat, a.lon, lookahead, 400)).filter(usable);
  if (candidates.length === 0) return null;

  let best: { airport: CandidateAirport; score: number; range: number; cross: number } | null = null;

  for (const airport of candidates) {
    const range = distanceNm(a.lat, a.lon, airport.lat, airport.lon);
    if (range < 1) continue;

    const delta = bearingDelta(a.trackDeg, bearingDeg(a.lat, a.lon, airport.lat, airport.lon));
    // Behind the aircraft: not where it is going.
    if (Math.abs(delta) > 60) continue;

    const cross = Math.abs(range * Math.sin((delta * Math.PI) / 180));
    if (cross > corridorNm(range)) continue;

    // Alignment dominates; nearer wins among equally aligned candidates.
    const alignment = 1 - cross / corridorNm(range);
    const proximity = 1 - Math.min(1, range / lookahead);
    const score = alignment * 0.7 + proximity * 0.3;

    if (!best || score > best.score) best = { airport, score, range, cross };
  }

  if (!best) return null;

  // ---- confidence ---------------------------------------------------------
  let confidence = 20 + best.score * 45;
  const reasons: string[] = [];

  // An aircraft still at cruise is passing over, not arriving — proximity to
  // an airport means nothing while it is 40,000 ft above one. Only a descent
  // profile turns alignment into evidence of intent.
  const atCruise = altitude > CRUISE_ALTITUDE_FT && !descending;

  if (descending && best.range < 150) {
    // The strong case: pointed at it, coming down, and close.
    confidence += 18;
    reasons.push("descending towards it");
  }
  if (best.range < 60 && !atCruise) {
    confidence += 8;
    reasons.push("within 60 NM");
  }
  if (altitude > 28000 && best.range > 300) {
    // High and far: the track will change several times before landing.
    confidence -= 18;
  }
  if (best.airport.type === "large_airport") confidence += 3;

  const ceiling = atCruise ? CRUISE_CONFIDENCE_CAP : MAX_ESTIMATE_CONFIDENCE;
  confidence = Math.round(Math.max(0, Math.min(ceiling, confidence)));
  if (confidence < MIN_ESTIMATE_CONFIDENCE) return null;

  if (atCruise) {
    reasons.push("still at cruise altitude, so it may be overflying");
  }

  reasons.unshift(`${Math.round(best.cross)} NM off the projected ground track`);

  return {
    airport: toRef(best.airport),
    confidence,
    reason: `Estimated from the current track — ${reasons.join(", ")}.`,
  };
}
