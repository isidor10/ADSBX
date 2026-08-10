import { jsonError, jsonOk } from "@/lib/api";
import { getOwnership } from "@/lib/ownership/service";
import { lookupSerbianRegistry } from "@/lib/registry/serbia";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/**
 * GET /api/aircraft/:registration/registry
 *
 * Official national register entry and AOC status. Serbian (YU-) aircraft are
 * resolved against the DCV register, which takes priority over every other
 * source; where the researched pipeline disagrees, the conflict is returned
 * rather than resolved.
 */
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ registration: string }> },
) {
  const { registration } = await params;
  try {
    // The researched view is only needed to detect disagreement, so a failure
    // here must not prevent the official record being shown.
    const ownership = await getOwnership(registration).catch(() => null);

    const result = await lookupSerbianRegistry(registration, {
      researched: ownership
        ? {
            owner: ownership.owner,
            operator: ownership.operator,
            sourceLabel: ownership.sources[0]?.label ?? "aviation database",
          }
        : null,
    });
    return jsonOk(result);
  } catch (error) {
    return jsonError(
      "registry_unavailable",
      "Registry lookup temporarily unavailable.",
      502,
      (error as Error).message,
    );
  }
}
