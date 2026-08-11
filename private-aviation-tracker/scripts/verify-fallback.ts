/**
 * The missing-key path. A deployment whose ADS-B Exchange key was never set
 * must still show real aircraft rather than an empty map. There are two ways
 * that can happen, and this checks both plus the fail-closed case:
 *
 *   chain      the failover chain covers it — airplanes.live is keyless and
 *              first in the default order, so it simply serves.
 *   open-feed  every chain member was turned off, so the legacy open community
 *              feed stands in and the UI is told the source changed.
 *   closed     the chain is off and the fallback was disabled on purpose, so
 *              the routes must fail closed instead of pretending.
 *
 *   npm run verify:fallback
 *
 * Config is read once at module load, so each case runs in its own process.
 */

import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { createServer } from "node:http";
import type { AddressInfo } from "node:net";
import { fileURLToPath } from "node:url";

const FEED_RESPONSE = {
  ac: [
    {
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
      lat: 50.11,
      lon: 8.68,
      seen_pos: 0.2,
      seen: 0.2,
    },
  ],
  msg: "No error",
  now: Date.now(),
  total: 1,
};

/** Runs in the child: assert the case named by CASE behaves as documented. */
async function child() {
  const { adsbConfigured, chainConfigured, selectedAdsbConfigured, usingOpenFeedFallback } =
    await import("../src/lib/config");
  const { getAdsbProvider } = await import("../src/lib/adsb");
  const { getViewportAircraft } = await import("../src/lib/live/feedManager");

  const mode = process.env.CASE;

  // Common to all three: the provider the operator selected has no key.
  assert.equal(selectedAdsbConfigured(), false, "the selected provider must have no key");

  if (mode === "closed") {
    assert.equal(chainConfigured(), false, "every chain member must be off in this case");
    assert.equal(usingOpenFeedFallback(), false, "the fallback was disabled on purpose");
    assert.equal(adsbConfigured(), false, "with nothing left the routes must fail closed");
    console.log("fails closed as configured");
    return;
  }

  const expectChain = mode === "chain";
  assert.equal(chainConfigured(), expectChain);
  assert.equal(usingOpenFeedFallback(), !expectChain);
  assert.equal(adsbConfigured(), true, "a working source must not read as misconfigured");
  assert.match(
    getAdsbProvider().name,
    expectChain ? /^airplanes\.live$/ : /^open feed \(127\.0\.0\.1:\d+\)$/,
  );

  const feed = await getViewportAircraft({
    lat: 50,
    lon: 8,
    radiusNm: 100,
    filters: ["business"],
  });
  assert.equal(feed.simulated, false, "this traffic is real, never flagged simulated");
  assert.equal(feed.stale, false, feed.error ?? "");
  assert.equal(feed.aircraft.length, 1, "the business jet must survive the default filter");
  assert.equal(feed.aircraft[0].registration, "D-CAAA");

  if (expectChain) {
    // Nothing was substituted for the selected provider in a way the user needs
    // warning about — the chain doing its job is the designed behaviour.
    assert.equal(feed.notice, undefined, "a healthy chain needs no degradation notice");
    console.log("chain served real traffic with no key configured");
    return;
  }

  assert.ok(feed.notice, "the UI must be told the data is not from the selected provider");
  assert.match(feed.notice, /open community feed/);
  assert.match(feed.notice, /ADSBX_RAPIDAPI_KEY/, "the notice must name the unset variable");
  console.log("fallback served real traffic and disclosed the source");
}

async function parent() {
  const server = createServer((req, res) => {
    // readsb area query (open feed) and airplanes.live point query.
    if (!req.url?.startsWith("/api/v2/lat/") && !req.url?.startsWith("/api/v2/point/")) {
      res.writeHead(400).end();
      return;
    }
    res.writeHead(200, { "content-type": "application/json" });
    res.end(JSON.stringify({ ...FEED_RESPONSE, now: Date.now() }));
  });
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  const { port } = server.address() as AddressInfo;

  const self = fileURLToPath(import.meta.url);
  const base = {
    ...process.env,
    CHILD: "1",
    // The exact broken deployment: provider selected, key never set.
    ADSB_PROVIDER: "adsbexchange",
    ADSBX_RAPIDAPI_KEY: "",
    ADSB_OPEN_FEED_URL: `http://127.0.0.1:${port}/api/v2`,
    AIRPLANES_LIVE_BASE_URL: `http://127.0.0.1:${port}/api/v2`,
    PERSIST_POSITIONS: "false",
  };
  // Turning off every keyless chain member is what isolates the legacy fallback.
  const chainOff = {
    AIRPLANES_LIVE_ENABLED: "false",
    OPENSKY_ENABLED: "false",
    ADSB_PROVIDER_ORDER: "adsbexchange",
  };

  for (const [label, env] of [
    ["chain covers the missing key", { ...base, CASE: "chain" }],
    ["chain off, open feed stands in", { ...base, ...chainOff, CASE: "openfeed" }],
    [
      "chain off, fallback disabled",
      { ...base, ...chainOff, ADSB_OPEN_FEED_FALLBACK: "false", CASE: "closed" },
    ],
  ] as const) {
    // Must not block: this process is also the mock feed the child calls.
    const out = await new Promise<string>((resolve, reject) => {
      execFile("npx", ["tsx", self], { env }, (error, stdout, stderr) => {
        if (error) reject(new Error(`${stdout}\n${stderr}`));
        else resolve(stdout);
      });
    });
    process.stdout.write(`${label}: ${out.trim()}\n`);
  }

  server.close();
  console.log("open-feed fallback: all checks passed");
}

const run = process.env.CHILD === "1" ? child : parent;
run().catch((error) => {
  console.error(error);
  process.exit(1);
});
