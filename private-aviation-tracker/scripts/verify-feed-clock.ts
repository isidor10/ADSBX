/** The seconds-vs-milliseconds clock bug that produced "20655d ago". */
import assert from "node:assert/strict";
import { createServer } from "node:http";
import type { AddressInfo } from "node:net";

const nowSeconds = Math.floor(Date.now() / 1000);
const PAYLOAD = {
  ac: [{ hex: "abc123", r: "N1TEST", t: "GLF6", lat: 50, lon: 8, alt_baro: 41000, gs: 480, track: 90, seen_pos: 0.3, seen: 0.3 }],
  msg: "No error",
  // readsb/adsb.fi report seconds, not milliseconds.
  now: nowSeconds,
  total: 1,
};

async function main() {
  const server = createServer((_req, res) => {
    res.writeHead(200, { "content-type": "application/json" });
    res.end(JSON.stringify(PAYLOAD));
  });
  await new Promise<void>((r) => server.listen(0, "127.0.0.1", r));
  const { port } = server.address() as AddressInfo;

  const { HttpAdsbProvider } = await import("@/lib/adsb/httpProvider");
  const provider = new HttpAdsbProvider({
    name: "readsb-test",
    baseUrl: `http://127.0.0.1:${port}/api/v2`,
    headers: {},
    configured: true,
    trailingSlash: false,
    hexPath: "hex",
  });

  const result = await provider.fetchArea(50, 8, 100);
  const ageMs = Date.now() - result.updatedAt;
  assert.ok(
    Math.abs(ageMs) < 5000,
    `a seconds-based feed clock must be read as now, not 1970 (age ${Math.round(ageMs / 86400000)} days)`,
  );
  const seenAge = Date.now() - result.aircraft[0].seenAt;
  assert.ok(Math.abs(seenAge) < 5000, `observation time must be current (age ${seenAge} ms)`);

  // And a millisecond feed must still be read correctly.
  const ms = { ...PAYLOAD, now: Date.now() };
  server.removeAllListeners("request");
  server.on("request", (_q, s) => {
    s.writeHead(200, { "content-type": "application/json" });
    s.end(JSON.stringify(ms));
  });
  const result2 = await provider.fetchArea(50, 8, 100);
  assert.ok(Math.abs(Date.now() - result2.updatedAt) < 5000, "millisecond clocks still work");

  server.close();
  console.log("feed clock: seconds and milliseconds both read correctly");
}
main().catch((e) => { console.error(e); process.exit(1); });
