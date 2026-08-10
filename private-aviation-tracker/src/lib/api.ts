import { NextResponse } from "next/server";
import type { FilterKey } from "@/lib/types";

/** Shared helpers for the route handlers. */

export const VALID_FILTERS: FilterKey[] = [
  "business",
  "private_jet",
  "bizliner",
  "turboprop",
  "vip",
  "charter",
  "military",
  "helicopter",
  "all",
];

export function parseFilters(raw: string | null): FilterKey[] {
  if (!raw) return ["business"];
  const parsed = raw
    .split(",")
    .map((f) => f.trim().toLowerCase())
    .filter((f): f is FilterKey => (VALID_FILTERS as string[]).includes(f));
  return parsed.length > 0 ? parsed : ["business"];
}

export interface Viewport {
  lat: number;
  lon: number;
  radiusNm: number;
}

export function parseViewport(params: URLSearchParams): Viewport | { error: string } {
  const lat = Number(params.get("lat"));
  const lon = Number(params.get("lon"));
  const radiusNm = Number(params.get("radius") ?? 250);

  if (!Number.isFinite(lat) || Math.abs(lat) > 90) return { error: "lat must be between -90 and 90" };
  if (!Number.isFinite(lon) || Math.abs(lon) > 180) return { error: "lon must be between -180 and 180" };
  if (!Number.isFinite(radiusNm) || radiusNm <= 0) return { error: "radius must be a positive number" };

  return { lat, lon, radiusNm };
}

export function jsonError(
  error: string,
  message: string,
  status: number,
  detail?: string,
): NextResponse {
  return NextResponse.json({ error, message, detail }, { status });
}

export function jsonOk<T>(body: T, status = 200): NextResponse {
  return NextResponse.json(body, {
    status,
    headers: { "cache-control": "no-store" },
  });
}
