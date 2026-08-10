/**
 * The missing-key path. A deployment whose ADS-B Exchange key was never set
 * must still show real aircraft — from the open community feed, clearly
 * labelled — rather than an empty map.
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
  now: 1_700_000_000_000,
  total: 1,
};

/** Runs in the child: assert the fallback engaged and fetched real traffic. */
async function child() {
  const { adsbConfigured, selectedAdsbConfigured, usingOpenFeedFallback } = await import(
    "../src/lib/config"
  );
  const { getAdsbProvider } = await import("../src/lib/adsb");
  const { getViewportAircraft } = await import("../src/lib/live/feedManager");

  const expectFallback = process.env.EXPECT_FALLBACK === "1";

  assert.equal(selectedAdsbConfigured(), false, "the selected provider must have no key");
  assert.equal(usingOpenFeedFallback(), expectFallback);
  assert.equal(
    adsbConfigured(),
    expectFallback,
    expectFallback
      ? "with a fallback available the routes must not 503"
      : "with the fallback disabled the routes must fail closed",
  );

  if (!expectFallback) {
    console.log("child: fails closed as configured");
    return;
  }

  assert.match(getAdsbProvider().name, /^open feed \(127\.0\.0\.1:\d+\)$/);

  const feed = await getViewportAircraft({
    lat: 50,
    lon: 8,
    radiusNm: 100,
    filters: ["business"],
  });
  assert.equal(feed.simulated, false, "open-feed traffic is real, never flagged simulated");
  assert.equal(feed.stale, false, feed.error ?? "");
  assert.equal(feed.aircraft.length, 1, "the business jet must survive the default filter");
  assert.equal(feed.aircraft[0].registration, "D-CAAA");
  assert.ok(feed.notice, "the UI must be told the data is not from the selected provider");
  assert.match(feed.notice, /open community feed/);
  assert.match(feed.notice, /ADSBX_RAPIDAPI_KEY/, "the notice must name the unset variable");
  console.log("child: fallback served real traffic and disclosed the source");
}

async function parent() {
  const server = createServer((req, res) => {
    if (!req.url?.startsWith("/api/v2/lat/")) {
      res.writeHead(400).end();
      return;
    }
    res.writeHead(200, { "content-type": "application/json" });
    res.end(JSON.stringify(FEED_RESPONSE));
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
    PERSIST_POSITIONS: "false",
  };

  for (const [label, env] of [
    ["fallback enabled", { ...base, EXPECT_FALLBACK: "1" }],
    ["fallback disabled", { ...base, ADSB_OPEN_FEED_FALLBACK: "false", EXPECT_FALLBACK: "0" }],
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
