/**
 * Multi-provider failover.
 *
 * The application used to depend on one live source, so a spent credit balance
 * or a rate limit took the map down. This proves the chain survives each
 * failure mode in turn, and that a total outage serves cache rather than an
 * empty map.
 *
 *   npm run verify:failover
 */
import assert from "node:assert/strict";
import type { AdsbProvider } from "../src/lib/adsb/types";
import { AdsbError } from "../src/lib/adsb/types";
import { fetchWithFailover, mergeAircraft, providerHealth, resetBreakers } from "../src/lib/adsb/manager";
import { countByPositionSource, positionSourceFor } from "../src/lib/adsb/positionSource";
import type { LiveAircraft, LiveFeedResult } from "../src/lib/types";

function aircraft(over: Partial<LiveAircraft> & { icao24: string }): LiveAircraft {
  return {
    registration: null, callsign: null, typeCode: null, manufacturer: null, model: null,
    category: "unknown", feedOperator: null, lat: 45, lon: 20, altBaroFt: 38000,
    altGeomFt: null, groundSpeedKt: 450, trackDeg: 90, verticalRateFpm: 0, squawk: null,
    onGround: false, emergency: null, ageSec: 0, seenAt: Date.now(), isMilitary: false,
    isSpecial: false, isBlocked: false, flightStatus: "cruising", source: "test",
    ...over,
  };
}

/** A provider whose behaviour the test controls. */
class FakeProvider implements AdsbProvider {
  readonly simulated = false;
  calls = 0;
  constructor(
    readonly name: string,
    public behaviour: "ok" | "rate_limit" | "error",
    private payload: LiveAircraft[] = [],
    public configured = true,
  ) {}

  async fetchArea(): Promise<LiveFeedResult> {
    this.calls += 1;
    if (this.behaviour === "rate_limit") {
      throw new AdsbError("Upstream rate limit reached", 429, this.name);
    }
    if (this.behaviour === "error") {
      throw new AdsbError("Not enough credits", 402, this.name);
    }
    return {
      aircraft: this.payload, totalObserved: this.payload.length, updatedAt: Date.now(),
      source: this.name, simulated: false, stale: false,
    };
  }
  async fetchByRegistration() { return null; }
  async fetchByIcao() { return null; }
  async fetchByCallsign() { return []; }
}

async function main() {
  // --- 1. Primary serves; secondaries are never touched -------------------
  resetBreakers();
  const primary = new FakeProvider("airplanes.live", "ok", [aircraft({ icao24: "aa1" })]);
  const secondary = new FakeProvider("opensky", "ok", [aircraft({ icao24: "bb2" })]);
  const tertiary = new FakeProvider("adsbexchange", "ok", [aircraft({ icao24: "cc3" })]);

  let out = await fetchWithFailover([primary, secondary, tertiary], 45, 20, 100);
  assert.equal(out.servedBy, "airplanes.live");
  assert.equal(secondary.calls, 0, "a healthy primary must not cost a secondary request");
  assert.equal(tertiary.calls, 0);
  console.log("1. primary serves alone");

  // --- 2. Primary rate-limited -> secondary takes over --------------------
  resetBreakers();
  primary.behaviour = "rate_limit";
  out = await fetchWithFailover([primary, secondary, tertiary], 45, 20, 100);
  assert.equal(out.servedBy, "opensky", "OpenSky must take over");
  assert.equal(out.result?.aircraft[0].icao24, "bb2");
  assert.equal(tertiary.calls, 0, "the chain stops at the first success");
  console.log("2. rate-limited primary -> secondary");

  // --- 3. Credits exhausted on two -> tertiary ---------------------------
  resetBreakers();
  secondary.behaviour = "error";
  out = await fetchWithFailover([primary, secondary, tertiary], 45, 20, 100);
  assert.equal(out.servedBy, "adsbexchange");
  console.log("3. two down -> tertiary");

  // --- 4. All down: no exception, no data, caller serves cache -----------
  resetBreakers();
  tertiary.behaviour = "error";
  out = await fetchWithFailover([primary, secondary, tertiary], 45, 20, 100);
  assert.equal(out.result, null, "a total outage returns null rather than throwing");
  assert.equal(out.servedBy, null);
  assert.equal(out.attempts.length, 3, "every provider was tried");
  console.log("4. total outage returns null (caller serves cache)");

  // --- 5. Circuit breaker: a failed provider is not hammered -------------
  resetBreakers();
  // Carries traffic, so that when it recovers it is chosen on its own merit
  // rather than falling through as a provider with nothing to show.
  const flaky = new FakeProvider("flaky", "error", [aircraft({ icao24: "ff6" })]);
  const backup = new FakeProvider("backup", "ok", [aircraft({ icao24: "dd4" })]);
  await fetchWithFailover([flaky, backup], 45, 20, 100);
  const callsAfterFirst = flaky.calls;
  await fetchWithFailover([flaky, backup], 45, 20, 100);
  await fetchWithFailover([flaky, backup], 45, 20, 100);
  assert.equal(flaky.calls, callsAfterFirst, "an open breaker must skip the provider entirely");
  console.log(`5. breaker open — flaky called ${flaky.calls}x across 3 polls`);

  // --- 6. Recovery: the breaker closes on success ------------------------
  resetBreakers();
  flaky.behaviour = "ok";
  out = await fetchWithFailover([flaky, backup], 45, 20, 100);
  assert.equal(out.servedBy, "flaky", "a recovered provider is used again automatically");
  console.log("6. recovered provider restored automatically");

  // --- 7. Health reflects reality ---------------------------------------
  resetBreakers();
  primary.behaviour = "rate_limit";
  await fetchWithFailover([primary, backup], 45, 20, 100);
  const health = providerHealth([primary, backup]);
  assert.equal(health[0].status, "RATE_LIMITED", `expected RATE_LIMITED, got ${health[0].status}`);
  assert.ok((health[0].retryInSec ?? 0) > 0, "a backing-off provider reports its retry time");
  assert.equal(health[1].status, "LIVE");
  assert.equal(health[1].lastCount, 1);
  console.log(`7. health: ${health.map((h) => `${h.name}=${h.status}`).join(", ")}`);

  // --- 8. Disabled providers are skipped, not attempted ------------------
  resetBreakers();
  const disabled = new FakeProvider("disabled", "ok", [], false);
  out = await fetchWithFailover([disabled, backup], 45, 20, 100);
  assert.equal(disabled.calls, 0);
  assert.equal(out.servedBy, "backup");
  assert.equal(providerHealth([disabled])[0].status, "DISABLED");
  console.log("8. disabled provider skipped");

  // --- 9. De-duplication and field merging across providers -------------
  const merged = mergeAircraft([
    // Position-rich but identity-poor (OpenSky style).
    [aircraft({ icao24: "ee5", seenAt: 2000, identityDegraded: true, lat: 46 })],
    // Identity-rich but older (readsb style).
    [aircraft({ icao24: "ee5", seenAt: 1000, registration: "YU-TST", typeCode: "GLF6", category: "business_jet" })],
  ]);
  assert.equal(merged.length, 1, "the same hex from two providers is one aircraft");
  assert.equal(merged[0].lat, 46, "the fresher position wins");
  assert.equal(merged[0].registration, "YU-TST", "identity is kept from whichever source has it");
  assert.equal(merged[0].typeCode, "GLF6");
  assert.equal(merged[0].category, "business_jet", "classification survives the merge");
  assert.equal(merged[0].identityDegraded, false, "merged identity is no longer degraded");
  console.log("9. dedup by hex, fresher position + richer identity merged");

  // --- 10. A provider with no coverage must not blank the map ------------
  // Observed live: readsb answered "0 aircraft" for a busy region while
  // airplanes.live had 141. A success with nothing in it is a coverage gap,
  // not empty sky, so the chain asks the next provider before giving up.
  resetBreakers();
  const noCoverage = new FakeProvider("readsb", "ok", []);
  const hasTraffic = new FakeProvider("airplanes.live", "ok", [aircraft({ icao24: "dd4" })]);
  out = await fetchWithFailover([noCoverage, hasTraffic], 45, 20, 100);
  assert.equal(out.servedBy, "airplanes.live", "an empty answer must not stop the chain");
  assert.equal(out.result?.aircraft.length, 1);
  assert.equal(noCoverage.calls, 1);
  console.log("10. empty result falls through to a provider that has traffic");

  // --- 11. Genuinely empty sky is data, not an outage --------------------
  resetBreakers();
  const alsoEmpty = new FakeProvider("opensky", "ok", []);
  out = await fetchWithFailover([noCoverage, alsoEmpty], 45, 20, 100);
  assert.ok(out.result, "an agreed-empty area must return a result, not null");
  assert.equal(out.result.aircraft.length, 0);
  assert.equal(out.servedBy, "readsb", "the first provider to answer empty is credited");
  console.log("11. everyone agrees the area is empty -> reported as data");

  // --- 12. Reception method survives the merge, and quality beats recency -
  // A position the aircraft broadcast itself is worth more than a slightly
  // fresher one computed from receiver timing, which can be hundreds of
  // metres out.
  const now = Date.now();
  const byQuality = mergeAircraft([
    [aircraft({ icao24: "gg7", seenAt: now, lat: 47, positionSource: "MLAT" })],
    [aircraft({ icao24: "gg7", seenAt: now - 6_000, lat: 46, positionSource: "ADSB" })],
  ]);
  assert.equal(byQuality[0].lat, 46, "a broadcast position beats a marginally fresher computed one");
  assert.equal(byQuality[0].positionSource, "ADSB", "the kept position's method is reported");

  // Recency still wins once the gap is real rather than marginal.
  const byRecency = mergeAircraft([
    [aircraft({ icao24: "hh8", seenAt: now, lat: 47, positionSource: "MLAT" })],
    [aircraft({ icao24: "hh8", seenAt: now - 90_000, lat: 46, positionSource: "ADSB" })],
  ]);
  assert.equal(byRecency[0].lat, 47, "a much older broadcast position must not be preferred");
  assert.equal(byRecency[0].positionSource, "MLAT");

  const counts = countByPositionSource([
    { positionSource: "ADSB" }, { positionSource: "ADSB" },
    { positionSource: "MLAT" }, {},
  ]);
  assert.equal(counts.ADSB, 2);
  assert.equal(counts.MLAT, 1);
  assert.equal(counts.UNKNOWN, 1, "a contact with no stated method is counted, not dropped");
  assert.equal(positionSourceFor("tisb_trackfile"), "TISB");
  assert.equal(positionSourceFor("adsb_icao_nt"), "ADSB");
  assert.equal(positionSourceFor(undefined), "UNKNOWN");
  console.log("12. position source: parsed, preferred by quality, counted");

  console.log("multi-provider failover: all checks passed");
}

main().catch((e) => { console.error(e); process.exit(1); });
