import { jsonError, jsonOk } from "@/lib/api";
import { getAircraftPhotos, storedPhotos } from "@/lib/aircraft/photos";
import { getIdentity } from "@/lib/aircraft/service";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 60;

/**
 * GET /api/aircraft/:registration/photos
 * A gallery of publicly available photographs, each with its source and
 * attribution. Images are hot-linked to their origin, never re-hosted.
 */
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ registration: string }> },
) {
  const { registration } = await params;

  try {
    const identity = await getIdentity(registration);
    const photos = await getAircraftPhotos(registration, {
      model: identity?.model ?? null,
      manufacturer: identity?.manufacturer ?? null,
    });

    // Fall back to anything found on an earlier run when the live search
    // returns nothing (no key configured, provider down, quota spent).
    const items = photos.length > 0 ? photos : await storedPhotos(registration);

    return jsonOk({
      registration: registration.toUpperCase(),
      photos: items,
      note:
        items.length === 0
          ? "No public photographs were found for this registration."
          : null,
    });
  } catch (error) {
    return jsonError(
      "photos_unavailable",
      "Photo search temporarily unavailable.",
      502,
      (error as Error).message,
    );
  }
}
