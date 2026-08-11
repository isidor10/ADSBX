/**
 * Last-known-position retention.
 *
 * Observed in production: airplanes.live had just returned 141 aircraft, the
 * user panned the map, upstream refused the next request, and the map went to
 * zero aircraft behind a red error box. The per-cell cache is keyed by viewport
 * centre, so panning lands on a cell that has never been fetched and there is
 * nothing to serve — even though the traffic is still in memory.
 *
 *   npm run verify:retention
 *
 * The rule under test: positions already received are kept and shown, clearly
 * labelled and aged, until they get too old to mean anything. Nothing here
 * invents an aircraft or a position — every contact shown is one that was
 * actually received.
 */

import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { createServer } from "node:http";
import type { AddressInfo } from "node:net";
import { fileURLToPath } from "node:url";

/** Frankfurt-ish, so both viewports below contain it. */
const AIRCRAFT = {
  hex: "3c4b26",
  type: "adsb_icao",
  flight: "GAJ742  ",
  r: "D-CAAA",
  t: "C56X",
  desc: "CESSNA 560XL Citation Excel",
  alt_baro: 41000,
  gs: 421,
  track: 118.2,
  baro_rate: 0,
  squawk: "7001",
  lat: 50.0,
  lon: 8.6,
  seen_pos: 0.2,
  seen: 0.2,
};

async function child() {
  const { getViewportAircraft } = await import("../src/lib/live/feedManager");

  // --- 1. A good poll: the aircraft arrives and is retained --------------
  const first = await getViewportAircraft({
    lat: 50,
    lon: 8.6,
    radiusNm: 100,
    filters: ["business"],
  });
  assert.equal(first.aircraft.length, 1, "the mock feed must be reachable");
  assert.equal(first.aircraft[0].registration, "D-CAAA");
  assert.equal(first.error, undefined);
  assert.equal(first.lastKnownCount, undefined, "a live poll is not retention");
  console.log("live poll: 1 aircraft");

  // --- 2. Upstream now refuses, and the user pans -----------------------
  // A different centre means a different cell key, so there is no per-cell
  // cache to fall back on — this is the case that used to blank the map.
  await fetch(`${process.env.MOCK_URL}/__break`);
  const panned = await getViewportAircraft({
    lat: 50.6,
    lon: 9.2,
    radiusNm: 100,
    filters: ["business"],
  });

  assert.equal(panned.aircraft.length, 1, "the aircraft must not disappear when upstream fails");
  assert.equal(panned.aircraft[0].registration, "D-CAAA");
  assert.equal(panned.lastKnownCount, 1, "the payload must declare it is retained");
  assert.equal(panned.degraded, true, "retention is a degraded state and must say so");
  assert.equal(
    panned.error,
    undefined,
    "with positions on screen this is a notice, not a blocking error",
  );
  assert.ok(panned.notice, "the user must be told these are last known positions");
  assert.match(panned.notice, /last known position/i);
  console.log("upstream down + panned: 1 retained position, labelled, no fatal error");

  // --- 3. Outside the retained area there is still nothing --------------
  // Retention must not teleport aircraft into a viewport they were never in.
  const elsewhere = await getViewportAircraft({
    lat: 41,
    lon: 29,
    radiusNm: 100,
    filters: ["business"],
  });
  assert.equal(elsewhere.aircraft.length, 0, "retention is scoped to the viewport");
  assert.ok(elsewhere.error, "a genuine outage with nothing to show still reports an error");
  console.log("far viewport: no aircraft invented, outage reported honestly");
}

async function parent() {
  let broken = false;
  const server = createServer((req, res) => {
    if (req.url?.startsWith("/__break")) {
      broken = true;
      res.writeHead(200).end("ok");
      return;
    }
    if (broken) {
      res.writeHead(503).end("upstream unavailable");
      return;
    }
    if (!req.url?.startsWith("/v2/lat/")) {
      res.writeHead(400).end();
      return;
    }
    res.writeHead(200, { "content-type": "application/json" });
    res.end(JSON.stringify({ ac: [AIRCRAFT], msg: "No error", now: Date.now(), total: 1 }));
  });
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  const { port } = server.address() as AddressInfo;
  const base = `http://127.0.0.1:${port}`;

  const out = await new Promise<string>((resolve, reject) => {
    execFile(
      "npx",
      ["tsx", fileURLToPath(import.meta.url)],
      {
        env: {
          ...process.env,
          CHILD: "1",
          MOCK_URL: base,
          // One provider, fully under this test's control.
          ADSB_PROVIDER: "readsb",
          ADSB_BASE_URL: base,
          ADSB_PROVIDER_ORDER: "readsb",
          AIRPLANES_LIVE_ENABLED: "false",
          OPENSKY_ENABLED: "false",
          ADSB_OPEN_FEED_FALLBACK: "false",
          // Force a real upstream call on every viewport rather than a cache hit.
          ADSB_POLL_INTERVAL_MS: "0",
          PERSIST_POSITIONS: "false",
        },
      },
      (error, stdout, stderr) => {
        if (error) reject(new Error(`${stdout}\n${stderr}`));
        else resolve(stdout);
      },
    );
  });

  process.stdout.write(out);
  server.close();
  console.log("last-known-position retention: all checks passed");
}

const run = process.env.CHILD === "1" ? child : parent;
run().catch((error) => {
  console.error(error);
  process.exit(1);
});
