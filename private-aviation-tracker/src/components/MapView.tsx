"use client";

import maplibregl, {
  type GeoJSONSource,
  type MapGeoJSONFeature,
  type StyleSpecification,
} from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import { useEffect, useRef } from "react";
import { distanceNm, projectPosition } from "@/lib/geo";
import type { AircraftCategory, LiveAircraft } from "@/lib/types";

/**
 * The map. Aircraft are drawn as heading-rotated icons on a clustered GeoJSON
 * source, with registration/type/altitude labels appearing as you zoom in.
 *
 * Between server updates each aircraft is dead-reckoned forward from its last
 * reported position using ground speed and track, which is what makes the
 * traffic move continuously rather than jumping every poll. Extrapolation is
 * capped so a stale contact drifts a little and then stops rather than
 * inventing a flight path.
 */

export interface MapViewport {
  lat: number;
  lon: number;
  radiusNm: number;
  zoom: number;
}

interface MapViewProps {
  aircraft: LiveAircraft[];
  selectedIcao: string | null;
  onSelect: (aircraft: LiveAircraft) => void;
  onViewportChange: (viewport: MapViewport) => void;
  focus: { lat: number; lon: number; zoom?: number; key: number } | null;
}

const CATEGORY_COLORS: Record<AircraftCategory, string> = {
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

const SELECTED_COLOR = "#ffffff";
const ICON_SIZE = 64;
const MAX_EXTRAPOLATION_SEC = 45;
const FRAME_INTERVAL_MS = 100;

const GLYPHS =
  process.env.NEXT_PUBLIC_MAP_GLYPHS ?? "https://fonts.openmaptiles.org/{fontstack}/{range}.pbf";
const FONT = ["Noto Sans Bold"];

/** Dark raster basemap that needs no API key. Overridable via env. */
const FALLBACK_STYLE: StyleSpecification = {
  version: 8,
  glyphs: GLYPHS,
  sources: {
    basemap: {
      type: "raster",
      tiles: [
        "https://a.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}@2x.png",
        "https://b.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}@2x.png",
        "https://c.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}@2x.png",
      ],
      tileSize: 256,
      attribution:
        '© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors © <a href="https://carto.com/attributions">CARTO</a>',
    },
  },
  layers: [
    { id: "background", type: "background", paint: { "background-color": "#04060c" } },
    { id: "basemap", type: "raster", source: "basemap", paint: { "raster-opacity": 0.82 } },
  ],
};

function drawPlane(ctx: CanvasRenderingContext2D, color: string) {
  ctx.beginPath();
  ctx.moveTo(32, 3);
  ctx.lineTo(37, 21);
  ctx.lineTo(61, 36);
  ctx.lineTo(61, 43);
  ctx.lineTo(37, 35);
  ctx.lineTo(35, 51);
  ctx.lineTo(46, 58);
  ctx.lineTo(46, 62);
  ctx.lineTo(32, 57);
  ctx.lineTo(18, 62);
  ctx.lineTo(18, 58);
  ctx.lineTo(29, 51);
  ctx.lineTo(27, 35);
  ctx.lineTo(3, 43);
  ctx.lineTo(3, 36);
  ctx.lineTo(27, 21);
  ctx.closePath();
  ctx.fillStyle = color;
  ctx.fill();
  ctx.lineWidth = 2.5;
  ctx.strokeStyle = "rgba(4,6,12,0.9)";
  ctx.stroke();
}

function drawHelicopter(ctx: CanvasRenderingContext2D, color: string) {
  ctx.lineWidth = 5;
  ctx.strokeStyle = color;
  ctx.lineCap = "round";
  ctx.beginPath();
  ctx.moveTo(10, 10);
  ctx.lineTo(54, 54);
  ctx.moveTo(54, 10);
  ctx.lineTo(10, 54);
  ctx.stroke();

  ctx.beginPath();
  ctx.arc(32, 32, 11, 0, Math.PI * 2);
  ctx.fillStyle = color;
  ctx.fill();
  ctx.lineWidth = 2.5;
  ctx.strokeStyle = "rgba(4,6,12,0.9)";
  ctx.stroke();
}

function renderIcon(shape: "plane" | "heli", color: string): ImageData | null {
  const canvas = document.createElement("canvas");
  canvas.width = ICON_SIZE;
  canvas.height = ICON_SIZE;
  const ctx = canvas.getContext("2d");
  if (!ctx) return null;
  ctx.clearRect(0, 0, ICON_SIZE, ICON_SIZE);
  if (shape === "heli") drawHelicopter(ctx, color);
  else drawPlane(ctx, color);
  return ctx.getImageData(0, 0, ICON_SIZE, ICON_SIZE);
}

function iconIdFor(a: LiveAircraft, selected: boolean): string {
  if (selected) return a.category === "helicopter" ? "heli-selected" : "plane-selected";
  const shape = a.category === "helicopter" ? "heli" : "plane";
  return `${shape}-${a.category}`;
}

function labelFor(a: LiveAircraft): string {
  const lines = [a.registration ?? a.callsign ?? a.icao24.toUpperCase()];
  if (a.typeCode) lines.push(a.typeCode);
  if (a.altBaroFt !== null) {
    lines.push(a.altBaroFt >= 18000 ? `FL${Math.round(a.altBaroFt / 100)}` : `${a.altBaroFt} ft`);
  }
  return lines.join("\n");
}

export default function MapView({
  aircraft,
  selectedIcao,
  onSelect,
  onViewportChange,
  focus,
}: MapViewProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<maplibregl.Map | null>(null);
  const readyRef = useRef(false);
  const aircraftRef = useRef<LiveAircraft[]>(aircraft);
  const selectedRef = useRef<string | null>(selectedIcao);
  const onSelectRef = useRef(onSelect);
  const onViewportRef = useRef(onViewportChange);

  aircraftRef.current = aircraft;
  selectedRef.current = selectedIcao;
  onSelectRef.current = onSelect;
  onViewportRef.current = onViewportChange;

  // ---- map bootstrap ------------------------------------------------------
  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;

    const styleUrl = process.env.NEXT_PUBLIC_MAP_STYLE;
    const map = new maplibregl.Map({
      container: containerRef.current,
      style: styleUrl && styleUrl.length > 0 ? styleUrl : FALLBACK_STYLE,
      center: [4.9, 48.5],
      zoom: 5,
      minZoom: 2,
      maxZoom: 15,
      attributionControl: { compact: true },
      dragRotate: false,
      pitchWithRotate: false,
    });
    mapRef.current = map;

    map.addControl(new maplibregl.NavigationControl({ showCompass: false }), "bottom-right");
    map.addControl(
      new maplibregl.GeolocateControl({ positionOptions: { enableHighAccuracy: false } }),
      "bottom-right",
    );
    map.touchZoomRotate.disableRotation();

    const reportViewport = () => {
      const bounds = map.getBounds();
      const center = map.getCenter();
      const radiusNm = distanceNm(
        center.lat,
        center.lng,
        bounds.getNorth(),
        bounds.getEast(),
      );
      onViewportRef.current({
        lat: center.lat,
        lon: center.lng,
        radiusNm: Math.max(25, Math.min(250, radiusNm)),
        zoom: map.getZoom(),
      });
    };

    map.on("load", () => {
      // Register one icon per category so markers stay crisp (no SDF blur).
      for (const [category, color] of Object.entries(CATEGORY_COLORS)) {
        const shape = category === "helicopter" ? "heli" : "plane";
        const image = renderIcon(shape, color);
        if (image) map.addImage(`${shape}-${category}`, image, { pixelRatio: 2 });
      }
      for (const shape of ["plane", "heli"] as const) {
        const image = renderIcon(shape, SELECTED_COLOR);
        if (image) map.addImage(`${shape}-selected`, image, { pixelRatio: 2 });
      }

      map.addSource("aircraft", {
        type: "geojson",
        data: { type: "FeatureCollection", features: [] },
        cluster: true,
        clusterMaxZoom: 6,
        clusterRadius: 44,
      });

      map.addLayer({
        id: "clusters",
        type: "circle",
        source: "aircraft",
        filter: ["has", "point_count"],
        paint: {
          "circle-color": "#0b1220",
          "circle-stroke-color": "#22d3ee",
          "circle-stroke-width": 1.5,
          "circle-opacity": 0.92,
          "circle-radius": ["step", ["get", "point_count"], 16, 10, 21, 40, 27, 120, 34],
        },
      });

      map.addLayer({
        id: "cluster-count",
        type: "symbol",
        source: "aircraft",
        filter: ["has", "point_count"],
        layout: {
          "text-field": ["get", "point_count_abbreviated"],
          "text-font": FONT,
          "text-size": 12,
        },
        paint: { "text-color": "#e8eefb" },
      });

      map.addLayer({
        id: "aircraft-icons",
        type: "symbol",
        source: "aircraft",
        filter: ["!", ["has", "point_count"]],
        layout: {
          "icon-image": ["get", "icon"],
          "icon-rotate": ["get", "track"],
          "icon-rotation-alignment": "map",
          "icon-allow-overlap": true,
          "icon-ignore-placement": true,
          "icon-size": ["interpolate", ["linear"], ["zoom"], 3, 0.34, 7, 0.46, 11, 0.62],
          // Labels appear once individual aircraft are distinguishable.
          "text-field": ["step", ["zoom"], "", 8, ["get", "label"]],
          "text-font": FONT,
          "text-size": 10,
          "text-offset": [0, 1.5],
          "text-anchor": "top",
          "text-allow-overlap": false,
          "text-optional": true,
          "text-line-height": 1.1,
        },
        paint: {
          "text-color": "#cfe0f5",
          "text-halo-color": "#04060c",
          "text-halo-width": 1.4,
        },
      });

      map.on("click", "aircraft-icons", (event) => {
        const feature = event.features?.[0] as MapGeoJSONFeature | undefined;
        const icao = feature?.properties?.icao24 as string | undefined;
        if (!icao) return;
        const match = aircraftRef.current.find((a) => a.icao24 === icao);
        if (match) onSelectRef.current(match);
      });

      map.on("click", "clusters", async (event) => {
        const feature = event.features?.[0];
        const clusterId = feature?.properties?.cluster_id;
        if (clusterId === undefined) return;
        const source = map.getSource("aircraft") as GeoJSONSource;
        const zoom = await source.getClusterExpansionZoom(clusterId as number);
        map.easeTo({
          center: (feature!.geometry as GeoJSON.Point).coordinates as [number, number],
          zoom,
        });
      });

      for (const layer of ["aircraft-icons", "clusters"]) {
        map.on("mouseenter", layer, () => {
          map.getCanvas().style.cursor = "pointer";
        });
        map.on("mouseleave", layer, () => {
          map.getCanvas().style.cursor = "";
        });
      }

      readyRef.current = true;
      reportViewport();
    });

    map.on("moveend", reportViewport);

    return () => {
      readyRef.current = false;
      map.remove();
      mapRef.current = null;
    };
  }, []);

  // ---- render loop: dead reckoning between server updates -----------------
  useEffect(() => {
    let frame = 0;
    let lastDraw = 0;

    const draw = (timestamp: number) => {
      frame = requestAnimationFrame(draw);
      if (timestamp - lastDraw < FRAME_INTERVAL_MS) return;
      lastDraw = timestamp;

      const map = mapRef.current;
      if (!map || !readyRef.current) return;
      const source = map.getSource("aircraft") as GeoJSONSource | undefined;
      if (!source) return;

      const now = Date.now();
      const features: GeoJSON.Feature<GeoJSON.Point>[] = aircraftRef.current.map((a) => {
        const elapsed = Math.min(MAX_EXTRAPOLATION_SEC, Math.max(0, (now - a.seenAt) / 1000));
        const speed = a.groundSpeedKt ?? 0;
        const shouldProject = !a.onGround && a.trackDeg !== null && speed > 20;
        const position = shouldProject
          ? projectPosition(a.lat, a.lon, a.trackDeg as number, (speed / 3600) * elapsed)
          : { lat: a.lat, lon: a.lon };

        return {
          type: "Feature",
          geometry: { type: "Point", coordinates: [position.lon, position.lat] },
          properties: {
            icao24: a.icao24,
            registration: a.registration ?? "",
            icon: iconIdFor(a, a.icao24 === selectedRef.current),
            track: a.trackDeg ?? 0,
            label: labelFor(a),
          },
        };
      });

      source.setData({ type: "FeatureCollection", features });
    };

    frame = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(frame);
  }, []);

  // ---- imperative focus (search result / panel selection) -----------------
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !focus) return;
    map.easeTo({
      center: [focus.lon, focus.lat],
      zoom: Math.max(map.getZoom(), focus.zoom ?? 9),
      duration: 900,
    });
  }, [focus]);

  // Sized with height/width rather than inset-0: MapLibre's stylesheet sets
  // `position: relative` on `.maplibregl-map`, which would override a
  // positioning utility and collapse the container to zero height.
  return <div ref={containerRef} className="h-full w-full" aria-label="Live aircraft map" />;
}
