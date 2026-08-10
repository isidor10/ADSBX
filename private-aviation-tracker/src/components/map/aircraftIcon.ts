import {
  buildSilhouette,
  FAMILIES,
  silhouetteFor,
  type FamilyKey,
  type Silhouette,
} from "@/lib/aircraft/silhouettes";
import type { AircraftCategory, LiveAircraft } from "@/lib/types";

/**
 * Rasterises the parametric silhouettes into map icons.
 *
 * Icons are built on demand and cached by `family:color` — a viewport of
 * business traffic touches maybe a dozen combinations, so building the full
 * matrix up front would be wasted work. The canvas is rendered at 3x the
 * on-screen size so the outline stays sharp when zoomed in.
 */

/** Rendered pixel size. Combined with pixelRatio 3 this is a 36pt icon. */
export const ICON_PIXELS = 108;
const PIXEL_RATIO = 3;

export const CATEGORY_COLORS: Record<AircraftCategory, string> = {
  business_jet: "#22d3ee",
  private_jet: "#22d3ee",
  bizliner: "#a78bfa",
  turboprop: "#4ade80",
  vip: "#f5a524",
  charter: "#f5a524",
  helicopter: "#38bdf8",
  military: "#f43f5e",
  airliner: "#64748b",
  light_ga: "#94a3b8",
  special: "#f5a524",
  unknown: "#94a3b8",
};

export const SELECTED_COLOR = "#ffffff";
const OUTLINE = "rgba(3,6,14,0.92)";

function tracePolygon(
  ctx: CanvasRenderingContext2D,
  points: readonly (readonly [number, number])[],
  size: number,
) {
  ctx.beginPath();
  points.forEach(([x, y], i) => {
    const px = x * size;
    const py = y * size;
    if (i === 0) ctx.moveTo(px, py);
    else ctx.lineTo(px, py);
  });
  ctx.closePath();
}

function drawSilhouette(
  ctx: CanvasRenderingContext2D,
  silhouette: Silhouette,
  color: string,
  size: number,
) {
  // Outline first as a single wide stroke pass under everything, so adjoining
  // parts (wing meeting fuselage) read as one solid airframe rather than a
  // stack of outlined cut-outs.
  ctx.lineJoin = "round";
  ctx.lineCap = "round";
  ctx.strokeStyle = OUTLINE;
  ctx.lineWidth = Math.max(2, size * 0.045);
  for (const polygon of silhouette.polygons) {
    tracePolygon(ctx, polygon, size);
    ctx.stroke();
  }
  for (const disc of silhouette.discs) {
    ctx.beginPath();
    ctx.arc(disc.x * size, disc.y * size, disc.radius * size, 0, Math.PI * 2);
    ctx.stroke();
  }

  // Rotor and propeller discs sit under the airframe, translucent so the
  // fuselage stays readable through them.
  ctx.fillStyle = color;
  ctx.globalAlpha = 0.28;
  for (const disc of silhouette.discs) {
    ctx.beginPath();
    ctx.arc(disc.x * size, disc.y * size, disc.radius * size, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.globalAlpha = 1;

  for (const polygon of silhouette.polygons) {
    tracePolygon(ctx, polygon, size);
    ctx.fill();
  }
}

const geometryCache = new Map<FamilyKey, Silhouette>();

function geometryFor(family: FamilyKey): Silhouette {
  let geometry = geometryCache.get(family);
  if (!geometry) {
    geometry = buildSilhouette(FAMILIES[family]);
    geometryCache.set(family, geometry);
  }
  return geometry;
}

export function renderAircraftIcon(family: FamilyKey, color: string): ImageData | null {
  const canvas = document.createElement("canvas");
  canvas.width = ICON_PIXELS;
  canvas.height = ICON_PIXELS;
  const ctx = canvas.getContext("2d");
  if (!ctx) return null;
  ctx.clearRect(0, 0, ICON_PIXELS, ICON_PIXELS);
  drawSilhouette(ctx, geometryFor(family), color, ICON_PIXELS);
  return ctx.getImageData(0, 0, ICON_PIXELS, ICON_PIXELS);
}

/** Stable icon id for an aircraft in a given selection state. */
export function iconIdFor(a: LiveAircraft, selected: boolean): string {
  const { family } = silhouetteFor(a.typeCode, a.category);
  return `${family}:${selected ? "selected" : a.category}`;
}

interface IconHost {
  hasImage(id: string): boolean;
  addImage(id: string, image: ImageData, options?: { pixelRatio?: number }): void;
}

/**
 * Ensure the icon exists on the map, building it the first time it is needed.
 * Returns the id so callers can use it directly as `icon-image`.
 */
export function ensureIcon(map: IconHost, a: LiveAircraft, selected: boolean): string {
  const id = iconIdFor(a, selected);
  if (map.hasImage(id)) return id;

  const { family } = silhouetteFor(a.typeCode, a.category);
  const color = selected ? SELECTED_COLOR : (CATEGORY_COLORS[a.category] ?? CATEGORY_COLORS.unknown);
  const image = renderAircraftIcon(family, color);
  if (image) map.addImage(id, image, { pixelRatio: PIXEL_RATIO });
  return id;
}
