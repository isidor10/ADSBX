import { cache, cacheKeys } from "@/lib/cache";
import { config } from "@/lib/config";
import type { AircraftPhoto } from "@/lib/types";

/**
 * Aircraft photos, resolved by registration.
 *
 * Two sources, tried in order by default:
 *
 *  1. Planespotters public API — aviation-specific, so a hit is genuinely a
 *     photo of *that* tail number. Free, no key, attribution required.
 *  2. Google Programmable Search (image mode) — much broader coverage,
 *     including recent shots the aviation databases have not indexed, but the
 *     match is only as good as the search result. Needs a Google CSE key with
 *     image search enabled.
 *
 * Both render with the photographer/host credited and a link back to the page
 * the image came from. Results are cached so the same tail is not re-searched.
 *
 * Note: a photo can only exist for a real aircraft. Simulated demo tails will
 * always come back empty, which is correct.
 */

const REQUEST_TIMEOUT_MS = 8000;

async function getJson<T>(url: string, headers: Record<string, string> = {}): Promise<T | null> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  try {
    const res = await fetch(url, {
      signal: controller.signal,
      headers: { accept: "application/json", ...headers },
      cache: "no-store",
    });
    if (!res.ok) return null;
    return (await res.json()) as T;
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

// ------------------------------------------------------------- Planespotters
interface PlanespottersPhoto {
  thumbnail?: { src?: string };
  thumbnail_large?: { src?: string };
  link?: string;
  photographer?: string;
}

async function fromPlanespotters(registration: string): Promise<AircraftPhoto | null> {
  const data = await getJson<{ photos?: PlanespottersPhoto[] }>(
    `https://api.planespotters.net/pub/photos/reg/${encodeURIComponent(registration)}`,
  );
  const photo = data?.photos?.[0];
  const url = photo?.thumbnail_large?.src ?? photo?.thumbnail?.src;
  if (!url) return null;

  return {
    url,
    thumbnailUrl: photo?.thumbnail?.src ?? null,
    credit: photo?.photographer
      ? `© ${photo.photographer} / Planespotters.net`
      : "Planespotters.net",
    link: photo?.link ?? null,
    source: "planespotters",
  };
}

// ------------------------------------------------------------ Google Images
interface GoogleImageItem {
  link?: string;
  title?: string;
  displayLink?: string;
  image?: { contextLink?: string; thumbnailLink?: string };
}

/**
 * Hosts whose images are almost certainly the aircraft we asked for. A result
 * from one of these is preferred over a higher-ranked generic result.
 */
const AVIATION_IMAGE_HOSTS = [
  "jetphotos.com",
  "planespotters.net",
  "airliners.net",
  "airhistory.net",
  "airport-data.com",
  "flickr.com",
  "staticflickr.com",
  "abpic.co.uk",
  "planepictures.net",
];

function hostOf(url: string): string {
  try {
    return new URL(url).host.replace(/^www\./, "").toLowerCase();
  } catch {
    return "";
  }
}

async function fromGoogleImages(registration: string): Promise<AircraftPhoto | null> {
  const key = config.photos.googleApiKey;
  const cx = config.photos.googleCx;
  if (!key || !cx) return null;

  const url = new URL("https://www.googleapis.com/customsearch/v1");
  url.searchParams.set("key", key);
  url.searchParams.set("cx", cx);
  url.searchParams.set("q", `"${registration}" aircraft`);
  url.searchParams.set("searchType", "image");
  url.searchParams.set("num", "8");
  url.searchParams.set("safe", "active");
  // Bias towards larger, more recent photography rather than thumbnails.
  url.searchParams.set("imgSize", "large");

  const data = await getJson<{ items?: GoogleImageItem[] }>(url.toString());
  const items = (data?.items ?? []).filter((i) => i.link?.startsWith("https://"));
  if (items.length === 0) return null;

  const preferred =
    items.find((i) => AVIATION_IMAGE_HOSTS.includes(hostOf(i.link!))) ??
    items.find((i) => AVIATION_IMAGE_HOSTS.includes(hostOf(i.image?.contextLink ?? ""))) ??
    items[0];

  const host = hostOf(preferred.image?.contextLink ?? preferred.link!) || "the web";
  return {
    url: preferred.link!,
    thumbnailUrl: preferred.image?.thumbnailLink ?? null,
    // The image is hosted by a third party; credit and link to its page rather
    // than presenting it as ours.
    credit: `Image via ${host} — found with Google Images`,
    link: preferred.image?.contextLink ?? preferred.link!,
    source: "google_images",
  };
}

export async function getAircraftPhoto(registration: string): Promise<AircraftPhoto | null> {
  if (!config.photos.enabled) return null;
  const reg = registration.toUpperCase();

  return cache.remember(cacheKeys.photo(reg), config.photos.ttlHours * 3600, async () => {
    const provider = config.photos.provider;

    if (provider === "google") {
      return (await fromGoogleImages(reg)) ?? null;
    }
    if (provider === "planespotters") {
      return (await fromPlanespotters(reg)) ?? null;
    }
    // "auto": the aviation database first because its match is exact, then
    // Google for tails it has never photographed.
    return (await fromPlanespotters(reg)) ?? (await fromGoogleImages(reg)) ?? null;
  });
}
