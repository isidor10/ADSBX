/**
 * Viewport tiling: a zoomed-out map must fetch the whole visible area.
 *
 * One upstream request reaches at most 250 NM. Before tiling, a viewport
 * ~800 NM across still asked for a single 250 NM circle at the centre and
 * silently dropped everything else — which looked like "the map is not
 * showing all the aircraft when I zoom out".
 *
 *   npm run verify:tiling
 */
import assert from "node:assert/strict";
import { createServer } from "node:http";
import type { AddressInfo } from "node:net";

/**
 * Centred on Belgrade, with the outer aircraft deliberately 400-700 NM out —
 * beyond the reach of one 250 NM request, which is the case that was broken.
 */
const FLEET = [
  { hex: "aa0001", r: "YU-AAA", lat: 44.8, lon: 20.3 }, // Belgrade — centre
  { hex: "aa0002", r: "YU-BBB", lat: 41.8, lon: 12.5 }, // Rome, ~430 NM W
  { hex: "aa0003", r: "YU-CCC", lat: 41.0, lon: 28.9 }, // Istanbul, ~440 NM SE
  { hex: "aa0004", r: "YU-DDD", lat: 52.2, lon: 21.0 }, // Warsaw, ~440 NM N
  { hex: "aa0005", r: "YU-EEE", lat: 48.1, lon: 11.6 }, // Munich, ~400 NM NW
];

const R = 3440.065;
const toRad = (d: number) => (d * Math.PI) / 180;
function distNm(a: { lat: number; lon: number }, b: { lat: number; lon: number }) {
  const dLat = toRad(b.lat - a.lat);
  const dLon = toRad(b.lon - a.lon);
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.asin(Math.min(1, Math.sqrt(h)));
}

const requests: Array<{ lat: number; lon: number; dist: number }> = [];

async function main() {
  const server = createServer((req, res) => {
    const m = /\/lat\/([-\d.]+)\/lon\/([-\d.]+)\/dist\/(\d+)/.exec(req.url ?? "");
    if (!m) {
      res.writeHead(404).end();
      return;
    }
    const lat = Number(m[1]);
    const lon = Number(m[2]);
    const dist = Number(m[3]);
    requests.push({ lat, lon, dist });

    // The mock behaves like the real API: only aircraft inside the circle.
    const ac = FLEET.filter((a) => distNm({ lat, lon }, a) <= dist).map((a) => ({
      hex: a.hex,
      r: a.r,
      t: "GLF6",
      lat: a.lat,
      lon: a.lon,
      alt_baro: 38000,
      gs: 450,
      track: 90,
      seen_pos: 0.2,
      seen: 0.2,
    }));
    res.writeHead(200, { "content-type": "application/json" });
    res.end(JSON.stringify({ ac, msg: "No error", now: Date.now(), total: ac.length }));
  });
  await new Promise<void>((r) => server.listen(0, "127.0.0.1", r));
  const { port } = server.address() as AddressInfo;

  process.env.ADSB_PROVIDER = "readsb";
  process.env.ADSB_BASE_URL = `http://127.0.0.1:${port}/api/v2`;
  process.env.PERSIST_POSITIONS = "false";
  process.env.ADSB_POLL_INTERVAL_MS = "1";

  const { getViewportAircraft } = await import("../src/lib/live/feedManager");

  // --- 1. A viewport inside one request stays one request ------------------
  requests.length = 0;
  const small = await getViewportAircraft({ lat: 44.8, lon: 20.3, radiusNm: 200, filters: ["all"] });
  assert.equal(requests.length, 1, "a small viewport must not be tiled");
  assert.equal(small.tilesRequested, 1);
  console.log(`200 NM view: ${requests.length} request, ${small.aircraft.length} aircraft`);

  // --- 2. A wide viewport is covered by several tiles ----------------------
  requests.length = 0;
  const wide = await getViewportAircraft({ lat: 44.8, lon: 20.3, radiusNm: 700, filters: ["all"] });
  assert.ok(requests.length > 1, `a 700 NM viewport must be tiled, got ${requests.length} request(s)`);
  assert.equal(wide.tilesRequested, requests.length);
  assert.ok(requests.every((r) => r.dist <= 250), "no tile may exceed the upstream radius cap");

  // --- 3. And it actually returns the aircraft a single circle would miss --
  const found = new Set(wide.aircraft.map((a) => a.registration));
  const centreOnly = FLEET.filter((a) => distNm({ lat: 44.8, lon: 20.3 }, a) <= 250);
  assert.ok(
    wide.aircraft.length > centreOnly.length,
    `tiling must find more than the centre circle (${wide.aircraft.length} vs ${centreOnly.length})`,
  );
  // At least the aircraft inside the covered radius must all be present.
  const covered = wide.coveredRadiusNm ?? 0;
  for (const a of FLEET) {
    if (distNm({ lat: 44.8, lon: 20.3 }, a) <= covered - 250) {
      assert.ok(found.has(a.r), `${a.r} is inside the covered radius and must be returned`);
    }
  }
  assert.ok(covered > 250, `covered radius must exceed one request (${covered} NM)`);
  console.log(
    `700 NM view: ${requests.length} tiles, ${wide.aircraft.length} aircraft ` +
      `(a single centred circle would return ${centreOnly.length})`,
  );

  // --- 4. Overlapping tiles must not duplicate an aircraft ----------------
  assert.equal(
    new Set(wide.aircraft.map((a) => a.icao24)).size,
    wide.aircraft.length,
    "overlapping tiles must be de-duplicated",
  );

  // --- 5. The cap holds, and partial coverage is reported honestly --------
  requests.length = 0;
  const huge = await getViewportAircraft({
    lat: 44.8,
    lon: 20.3,
    radiusNm: 1500,
    filters: ["all"],
  });
  assert.ok(requests.length <= 6, `tiles must be capped, got ${requests.length}`);
  assert.ok(
    (huge.coveredRadiusNm ?? 0) < (huge.viewportRadiusNm ?? 0),
    "when the cap bites, the response must admit the view is only partly covered",
  );
  console.log(
    `1500 NM view: capped at ${requests.length} tiles, ` +
      `covering ${huge.coveredRadiusNm} of ${huge.viewportRadiusNm} NM (reported)`,
  );

  server.close();
  console.log("viewport tiling: all checks passed");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
