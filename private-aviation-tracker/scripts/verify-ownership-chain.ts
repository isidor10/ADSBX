/**
 * The no-API-key path: aircraft database → owner → company.
 *
 * This is the chain that was broken. With no FAA import and no search key, the
 * only ownership inputs were unavailable, so no owner ever resolved — and
 * because companies are derived from resolved ownership, company search found
 * nothing either. This proves the keyless database closes that gap.
 *
 * Runs against a local mock, so no network and no credentials.
 *
 *   DATABASE_URL=... npm run verify:ownership
 */

import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { createServer } from "node:http";
import type { AddressInfo } from "node:net";
import { fileURLToPath } from "node:url";

const AIRCRAFT = {
  response: {
    aircraft: {
      type: "Gulfstream G650ER",
      icao_type: "GLF6",
      manufacturer: "Gulfstream Aerospace",
      mode_s: "A1B2C3",
      registration: "N650TT",
      registered_owner_country_iso_name: "US",
      registered_owner_country_name: "United States",
      registered_owner_operator_flag_code: "PVA",
      registered_owner: "Prince Aviation Holdings LLC",
      url_photo: "https://example.invalid/photo/n650tt.jpg",
      url_photo_thumbnail: "https://example.invalid/photo/n650tt-thumb.jpg",
    },
  },
};

async function child() {
  const { getOwnership } = await import("../src/lib/ownership/service");
  const { getCompany, searchCompanies } = await import("../src/lib/company/service");
  const { getAircraftPhotos } = await import("../src/lib/aircraft/photos");
  const { searchConfigured } = await import("../src/lib/config");

  assert.equal(searchConfigured(), false, "this test must run with no search provider");

  // ---- owner resolves from the keyless database ---------------------------
  const ownership = await getOwnership("N650TT", { force: true });
  assert.equal(ownership.status, "RESOLVED", `expected RESOLVED, got ${ownership.status}`);
  assert.equal(ownership.owner, "Prince Aviation Holdings LLC");
  assert.equal(ownership.ownerKind, "REGISTERED_OWNER");
  assert.ok(ownership.confidence >= 70 && ownership.confidence < 90, `confidence ${ownership.confidence}`);
  assert.equal(
    ownership.beneficialOwnerConfirmed,
    false,
    "a registry-style record never confirms beneficial ownership",
  );
  assert.match(ownership.summary ?? "", /beneficial owner not publicly confirmed/i);
  assert.ok(
    ownership.sources.some((s) => s.kind === "aviation_database"),
    "the database must appear as a cited source",
  );
  console.log(`owner: ${ownership.owner} (${ownership.confidence}%)`);

  // ---- the company is created from it -------------------------------------
  // syncCompanyLinks runs detached from getOwnership; give it a moment.
  await new Promise((r) => setTimeout(r, 800));

  const { companySlug } = await import("../src/lib/company/naming");
  const expectedSlug = companySlug(ownership.owner!);

  const companies = await searchCompanies("Prince Aviation");
  assert.ok(companies.length > 0, "company search must find the resolved owner");
  const company = companies.find((c) => c.slug === expectedSlug);
  assert.ok(
    company,
    `the owner's own company (${expectedSlug}) must be searchable; got ${companies.map((c) => c.slug).join(", ")}`,
  );
  console.log(`company: ${company.slug} (${company.aircraftCount} aircraft)`);

  const profile = await getCompany(company.slug);
  assert.ok(profile, "company profile must exist");
  assert.ok(
    profile.fleet.some((f) => f.registration === "N650TT"),
    "the aircraft must appear in the fleet",
  );
  assert.equal(profile.fleet[0].role, "REGISTERED_OWNER", "with the role it was found under");

  // ---- and the photo comes back verified ----------------------------------
  const photos = await getAircraftPhotos("N650TT");
  assert.ok(photos.length > 0, "the database photo must reach the gallery");
  assert.equal(photos[0].verified, true, "a tail-keyed photo is a verified aircraft photo");
  console.log(`photo: ${photos[0].url} (verified=${photos[0].verified})`);

  console.log("child: keyless chain resolved owner, company and photo");
}

async function parent() {
  const server = createServer((req, res) => {
    if (req.url?.includes("/aircraft/N650TT")) {
      res.writeHead(200, { "content-type": "application/json" });
      res.end(JSON.stringify(AIRCRAFT));
      return;
    }
    res.writeHead(404).end();
  });
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  const { port } = server.address() as AddressInfo;

  const self = fileURLToPath(import.meta.url);
  const env = {
    ...process.env,
    CHILD: "1",
    ADSB_PROVIDER: "demo",
    SEARCH_PROVIDER: "none",
    OWNERSHIP_LLM_ENABLED: "false",
    ROUTE_API_URL: `http://127.0.0.1:${port}`,
    PHOTO_PROVIDER: "planespotters",
    PERSIST_POSITIONS: "false",
  };

  const out = await new Promise<string>((resolve, reject) => {
    execFile("npx", ["tsx", self], { env }, (error, stdout, stderr) => {
      if (error) reject(new Error(`${stdout}\n${stderr}`));
      else resolve(stdout);
    });
  });
  process.stdout.write(out);

  server.close();
  console.log("ownership chain: all checks passed");
}

const run = process.env.CHILD === "1" ? child : parent;
run().catch((error) => {
  console.error(error);
  process.exit(1);
});
