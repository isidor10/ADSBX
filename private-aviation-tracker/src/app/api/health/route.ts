import { jsonOk } from "@/lib/api";
import { cache } from "@/lib/cache";
import { adsbConfigured, config, isDemoMode, searchConfigured } from "@/lib/config";
import { pingDatabase } from "@/lib/db";
import { feedDiagnostics } from "@/lib/live/feedManager";
import { indexSize } from "@/lib/live/recentIndex";
import { llmEnabled } from "@/lib/ownership/llm";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/**
 * GET /api/health
 * Which integrations are wired up. Reports configuration state only — no keys.
 */
export async function GET() {
  const database = await pingDatabase();

  return jsonOk({
    status: adsbConfigured() ? "ok" : "degraded",
    time: new Date().toISOString(),
    adsb: {
      ...feedDiagnostics(),
      provider: config.adsb.provider,
      configured: adsbConfigured(),
      simulated: isDemoMode,
      pollIntervalMs: config.adsb.pollIntervalMs,
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
