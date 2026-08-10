/** Display formatting shared by the client components. */

export function formatAltitude(ft: number | null | undefined): string {
  if (ft === null || ft === undefined) return "—";
  if (ft <= 0) return "Ground";
  if (ft >= 18000) return `FL${Math.round(ft / 100)}`;
  return `${Math.round(ft).toLocaleString("en-US")} ft`;
}

export function formatSpeed(kt: number | null | undefined): string {
  if (kt === null || kt === undefined) return "—";
  return `${Math.round(kt)} kt`;
}

export function formatVerticalRate(fpm: number | null | undefined): string {
  if (fpm === null || fpm === undefined) return "—";
  const rounded = Math.round(fpm / 50) * 50;
  if (rounded === 0) return "level";
  return `${rounded > 0 ? "+" : ""}${rounded.toLocaleString("en-US")} fpm`;
}

export function formatHeading(deg: number | null | undefined): string {
  if (deg === null || deg === undefined) return "—";
  return `${Math.round(((deg % 360) + 360) % 360).toString().padStart(3, "0")}°`;
}

export function formatCoordinate(value: number | null | undefined, axis: "lat" | "lon"): string {
  if (value === null || value === undefined) return "—";
  const hemi = axis === "lat" ? (value >= 0 ? "N" : "S") : value >= 0 ? "E" : "W";
  return `${Math.abs(value).toFixed(4)}° ${hemi}`;
}

export function formatDistance(nm: number | null | undefined): string {
  if (nm === null || nm === undefined) return "—";
  return `${Math.round(nm).toLocaleString("en-US")} nm`;
}

export function formatDuration(seconds: number | null | undefined): string {
  if (seconds === null || seconds === undefined || seconds < 0) return "—";
  const h = Math.floor(seconds / 3600);
  const m = Math.round((seconds % 3600) / 60);
  if (h === 0) return `${m}m`;
  return `${h}h ${m.toString().padStart(2, "0")}m`;
}

export function formatClock(iso: string | number | null | undefined): string {
  if (iso === null || iso === undefined) return "—";
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "—";
  return date.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" });
}

export function formatDate(iso: string | number | null | undefined): string {
  if (iso === null || iso === undefined) return "—";
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "—";
  return date.toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" });
}

export function formatRelative(iso: string | number | null | undefined): string {
  if (iso === null || iso === undefined) return "never";
  const then = new Date(iso).getTime();
  if (Number.isNaN(then)) return "never";
  const seconds = Math.max(0, Math.round((Date.now() - then) / 1000));
  if (seconds < 10) return "just now";
  if (seconds < 60) return `${seconds}s ago`;
  const minutes = Math.round(seconds / 60);
  if (minutes < 60) return `${minutes} min ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.round(hours / 24)}d ago`;
}

export function flightStatusLabel(status: string): string {
  switch (status) {
    case "on_ground":
      return "On ground";
    case "climbing":
      return "Climbing";
    case "descending":
      return "Descending";
    case "cruising":
      return "Cruising";
    case "level":
      return "Level";
    default:
      return "Unknown";
  }
}
