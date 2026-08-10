import type { NextRequest } from "next/server";
import { getAdsbProvider } from "@/lib/adsb";
import { AdsbError } from "@/lib/adsb/types";
import { jsonOk } from "@/lib/api";
import { cache } from "@/lib/cache";
import { adsbConfigured, config, isDemoMode, searchConfigured } from "@/lib/config";
import { pingDatabase } from "@/lib/db";
import { feedDiagnostics } from "@/lib/live/feedManager";
import { indexSize } from "@/lib/live/recentIndex";
import { llmEnabled } from "@/lib/ownership/llm";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

interface ProbeResult {
  ok: boolean;
  url: string | null;
  status: number | null;
  message: string | null;
  aircraftReturned: number | null;
}

/**
 * One real upstream call, bypassing the poll cache, reporting the exact URL
 * requested and whatever the provider said back. This is the difference
 * between "400" and a diagnosis when the only access you have to a deployment
 * is its public URL.
 */
async function probeUpstream(lat: number, lon: number, radiusNm: number): Promise<ProbeResult> {
  const provider = getAdsbProvider();
  try {
    const result = await provider.fetchArea(lat, lon, radiusNm);
    return {
      ok: true,
      url: null,
      status: 200,
      message: null,
      aircraftReturned: result.totalObserved,
    };
  } catch (error) {
    const adsb = error instanceof AdsbError ? error : null;
    return {
      ok: false,
      url: adsb?.url ?? null,
      status: adsb?.status ?? null,
      message: (error as Error).message,
      aircraftReturned: null,
    };
  }
}

/**
 * GET /api/health
 * Which integrations are wired up. Reports configuration state only — no keys.
 *
 * GET /api/health?probe=1[&lat=&lon=&radius=] additionally makes one live
 * upstream request and reports the result.
 */
export async function GET(request: NextRequest) {
  const params = request.nextUrl.searchParams;
  const database = await pingDatabase();

  const probe =
    params.get("probe") && adsbConfigured()
      ? await probeUpstream(
          Number(params.get("lat") ?? 50),
          Number(params.get("lon") ?? 8),
          Number(params.get("radius") ?? 100),
        )
      : null;

  return jsonOk({
    status: adsbConfigured() ? "ok" : "degraded",
    time: new Date().toISOString(),
    adsb: {
      ...feedDiagnostics(),
      provider: config.adsb.provider,
      configured: adsbConfigured(),
      simulated: isDemoMode,
      pollIntervalMs: config.adsb.pollIntervalMs,
      maxRadiusNm: config.adsb.maxRadiusNm,
      // Which upstream this build talks to, so a stale deployment is obvious.
      baseUrl:
        config.adsb.provider === "readsb"
          ? config.adsb.readsbBaseUrl
          : config.adsb.provider === "adsbx_direct"
            ? config.adsb.directBaseUrl
            : config.adsb.provider === "adsbexchange"
              ? `https://${config.adsb.rapidApiHost}`
              : null,
      probe,
    },
    search: {
      provider: config.search.provider,
      configured: searchConfigured(),
    },
    ownershipAnalyzer: {
      llm: llmEnabled(),
      model: llmEnabled() ? config.llm.model : null,
    },
    database: {
      configured: Boolean(config.databaseUrl),
      reachable: database,
    },
    cache: { backend: cache.backendName },
    liveIndexEntries: indexSize(),
    photos: { enabled: config.photos.enabled },
  });
}
