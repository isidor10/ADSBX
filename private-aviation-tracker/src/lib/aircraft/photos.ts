import { cache, cacheKeys } from "@/lib/cache";
import { config } from "@/lib/config";
import type { AircraftPhoto } from "@/lib/types";

/**
 * Aircraft photos from the Planespotters public API, which is free to use with
 * attribution and a link back to the photo page. Both are rendered in the UI.
 * Failures are non-fatal — the aircraft panel simply has no photo.
 */

interface PlanespottersPhoto {
  id?: string;
  thumbnail?: { src?: string };
  thumbnail_large?: { src?: string };
  link?: string;
  photographer?: string;
}

interface PlanespottersResponse {
  photos?: PlanespottersPhoto[];
}

export async function getAircraftPhoto(registration: string): Promise<AircraftPhoto | null> {
  if (!config.photos.enabled) return null;
  const reg = registration.toUpperCase();

  return cache.remember(cacheKeys.photo(reg), config.photos.ttlHours * 3600, async () => {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 8000);
    try {
      const res = await fetch(
        `https://api.planespotters.net/pub/photos/reg/${encodeURIComponent(reg)}`,
        { signal: controller.signal, headers: { accept: "application/json" } },
      );
      if (!res.ok) return null;
      const data = (await res.json()) as PlanespottersResponse;
      const photo = data.photos?.[0];
      const url = photo?.thumbnail_large?.src ?? photo?.thumbnail?.src;
      if (!url) return null;

      return {
        url,
        thumbnailUrl: photo?.thumbnail?.src ?? null,
        credit: photo?.photographer ? `© ${photo.photographer} / Planespotters.net` : "Planespotters.net",
        link: photo?.link ?? null,
        source: "planespotters",
      } satisfies AircraftPhoto;
    } catch {
      return null;
    } finally {
      clearTimeout(timer);
    }
  });
}
