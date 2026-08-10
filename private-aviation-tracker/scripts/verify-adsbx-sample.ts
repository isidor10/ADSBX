/**
 * Contract check for the ADS-B Exchange direct/gateway API.
 *
 * Runs the real `adsbx_direct` provider against a local mock that serves the
 * response documented at
 * https://www.adsbexchange.com/data-products/sample-api-call/ and asserts:
 *
 *   - the request path/host/header shape matches the published sample call
 *     (`/api/aircraft/v2/icao/{icao}`, no trailing slash, `api-auth` header)
 *   - the documented response wrapper and aircraft fields parse
 *   - the parsed record classifies correctly (the sample aircraft is a
 *     Boeing 737-800 airliner, so it must NOT appear under the default
 *     private/business filter)
 *
 * No network access and no API key required.
 *
 *   npm run verify:adsbx
 */

import assert from "node:assert/strict";
import { createServer, type IncomingMessage, type ServerResponse } from "node:http";
import type { AddressInfo } from "node:net";
import type { FilterKey } from "../src/lib/types";

/**
 * Verbatim shape from the vendor's "Sample API Call" page: a single-aircraft
 * response for ICAO A465DF, wrapped in {ac, msg, now, total, ctime, ptime}.
 */
const SAMPLE_RESPONSE = {
  ac: [
    {
      hex: "a465df",
      type: "adsb_icao",
      flight: "UAL1310 ",
      r: "N37502",
      t: "B738",
      desc: "BOEING 737-800",
      alt_baro: 37000,
      alt_geom: 38500,
      gs: 442.7,
      ias: 262,
      tas: 434,
      mach: 0.752,
      track: 82.9,
      baro_rate: 0,
      squawk: "1140",
      emergency: "none",
      category: "A3",
      nav_qnh: 1013.6,
      nav_altitude_mcp: 37008,
      lat: 39.041016,
      lon: -104.612793,
      nic: 8,
      rc: 186,
      seen_pos: 0.1,
      version: 2,
      messages: 12345,
      seen: 0.1,
      rssi: -14.8,
    },
  ],
  msg: "No error",
  now: 1_700_000_000_000,
  total: 1,
  ctime: 1_700_000_000_000,
  ptime: 12,
};

/** A business jet in the same schema, used to prove the filter's other side. */
const BIZJET_RESPONSE = {
  ac: [
    {
      hex: "a1b2c3",
      type: "adsb_icao",
      flight: "EJA512  ",
      r: "N512QS",
      t: "GLF6",
      desc: "GULFSTREAM AEROSPACE G-VI",
      ownOp: "NETJETS AVIATION INC",
      alt_baro: 43000,
      gs: 480.2,
      track: 271.4,
      baro_rate: 64,
      squawk: "3421",
      emergency: "none",
      category: "A3",
      lat: 40.71,
      lon: -74.01,
      seen_pos: 0.4,
      seen: 0.4,
      rssi: -11.2,
    },
  ],
  msg: "No error",
  now: 1_700_000_000_000,
  total: 1,
  ctime: 1_700_000_000_000,
  ptime: 9,
};

const API_KEY = "test-key-not-a-real-credential";

interface CapturedRequest {
  url: string;
  headers: IncomingMessage["headers"];
}

const captured: CapturedRequest[] = [];

function handler(req: IncomingMessage, res: ServerResponse) {
  captured.push({ url: req.url ?? "", headers: req.headers });

  if (req.headers["api-auth"] !== API_KEY) {
    res.writeHead(403, { "content-type": "application/json" });
    res.end(JSON.stringify({ msg: "Forbidden" }));
    return;
  }

  const body = req.url?.includes("a1b2c3") ? BIZJET_RESPONSE : SAMPLE_RESPONSE;
  res.writeHead(200, { "content-type": "application/json" });
  res.end(JSON.stringify(body));
}

async function main() {
  const server = createServer(handler);
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  const { port } = server.address() as AddressInfo;

  // Configure before importing anything that reads config at module load.
  process.env.ADSB_PROVIDER = "adsbx_direct";
  process.env.ADSBX_API_KEY = API_KEY;
  process.env.ADSBX_BASE_URL = `http://127.0.0.1:${port}/api/aircraft`;

  const { getAdsbProvider } = await import("../src/lib/adsb/index");
  const { matchesFilters } = await import("../src/lib/aircraft/classifier");

  /** The filter set the UI starts with: Private / Business Aviation. */
  const DEFAULT_FILTERS: FilterKey[] = ["business"];

  const provider = getAdsbProvider();
  assert.equal(provider.name, "adsbexchange-direct");
  assert.equal(provider.configured, true);

  // --- 1. Request shape matches the published sample call -------------------
  const airliner = await provider.fetchByIcao("A465DF");
  const req = captured.at(-1)!;
  assert.equal(
    req.url,
    "/api/aircraft/v2/icao/a465df",
    `expected the documented path with no trailing slash, got ${req.url}`,
  );
  assert.equal(req.headers["api-auth"], API_KEY, "api key must go in the api-auth header");
  assert.match(String(req.headers["accept"]), /application\/json/);

  // --- 2. Documented fields parse ------------------------------------------
  assert.ok(airliner, "documented sample response must produce an aircraft");
  assert.equal(airliner.icao24, "a465df");
  assert.equal(airliner.registration, "N37502");
  assert.equal(airliner.callsign, "UAL1310", "trailing pad must be trimmed");
  assert.equal(airliner.typeCode, "B738", "type designator comes from `t`, not `type`");
  assert.equal(airliner.manufacturer, "Boeing");
  assert.equal(airliner.altBaroFt, 37000);
  assert.equal(airliner.altGeomFt, 38500);
  assert.equal(airliner.groundSpeedKt, 442.7);
  assert.equal(airliner.trackDeg, 82.9);
  assert.equal(airliner.verticalRateFpm, 0);
  assert.equal(airliner.squawk, "1140");
  assert.equal(airliner.emergency, null, '"none" must not surface as an emergency');
  assert.equal(airliner.onGround, false);
  assert.equal(airliner.flightStatus, "cruising");
  assert.equal(airliner.lat, 39.041016);
  assert.equal(airliner.lon, -104.612793);

  // --- 3. The sample aircraft is an airliner and must be filtered out -------
  assert.equal(airliner.category, "airliner");
  assert.equal(
    matchesFilters(airliner, DEFAULT_FILTERS),
    false,
    "a 737-800 on a UAL callsign must not show under the private/business default",
  );
  assert.equal(matchesFilters(airliner, ["all"]), true, '"All aircraft" must include it');

  // --- 4. Same schema, business jet: kept by the default filter -------------
  const bizjet = await provider.fetchByIcao("A1B2C3");
  assert.ok(bizjet);
  assert.equal(bizjet.typeCode, "GLF6");
  assert.equal(bizjet.model, "G650 / G650ER");
  assert.equal(bizjet.category, "business_jet");
  assert.equal(bizjet.feedOperator, "NETJETS AVIATION INC");
  assert.equal(matchesFilters(bizjet, DEFAULT_FILTERS), true);

  // --- 5. Area query uses the documented lat/lon/dist path ------------------
  const area = await provider.fetchArea(39.04, -104.61, 250);
  assert.equal(captured.at(-1)!.url, "/api/aircraft/v2/lat/39.0400/lon/-104.6100/dist/250");
  assert.equal(area.simulated, false);
  assert.equal(area.totalObserved, 1);
  assert.equal(area.updatedAt, SAMPLE_RESPONSE.now);

  // --- 6. Radius is clamped to the documented 250 NM maximum ---------------
  await provider.fetchArea(0, 0, 5000);
  assert.match(captured.at(-1)!.url, /\/dist\/250$/);

  // --- 7. Registration + callsign paths ------------------------------------
  await provider.fetchByRegistration("N37502");
  assert.equal(captured.at(-1)!.url, "/api/aircraft/v2/registration/N37502");
  await provider.fetchByCallsign("eja512");
  assert.equal(captured.at(-1)!.url, "/api/aircraft/v2/callsign/EJA512");

  // --- 8. readsb feeds: a base URL that already carries /v2 -----------------
  // Every compatible provider publishes its endpoint with the version in it
  // (https://opendata.adsb.fi/api/v2, https://api.adsb.lol/v2), so that is what
  // lands in ADSB_BASE_URL. It must not produce /v2/v2/.
  const { HttpAdsbProvider } = await import("../src/lib/adsb/httpProvider");
  for (const base of [
    `http://127.0.0.1:${port}/api/v2`,
    `http://127.0.0.1:${port}/api`,
    `http://127.0.0.1:${port}/api/v2/`,
  ]) {
    const readsb = new HttpAdsbProvider({
      name: "readsb-test",
      baseUrl: base,
      headers: { "api-auth": API_KEY },
      configured: true,
      trailingSlash: false,
      hexPath: "hex",
    });
    await readsb.fetchArea(39.04, -104.61, 100);
    assert.equal(
      captured.at(-1)!.url,
      "/api/v2/lat/39.0400/lon/-104.6100/dist/100",
      `base "${base}" must not double the version segment`,
    );
  }

  server.close();
  console.log("ADS-B Exchange direct API contract: all checks passed");
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
