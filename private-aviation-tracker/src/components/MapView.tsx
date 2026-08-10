"use client";

import maplibregl, {
  type GeoJSONSource,
  type MapGeoJSONFeature,
  type StyleSpecification,
} from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import { useEffect, useRef } from "react";
import { ensureIcon } from "@/components/map/aircraftIcon";
import { distanceNm, projectPosition } from "@/lib/geo";
import type { LiveAircraft, SelectedRoute } from "@/lib/types";

/**
 * The map. Aircraft are drawn as heading-rotated silhouettes of their actual
 * type on a GeoJSON source, with registration/type/altitude labels appearing
 * as you zoom in.
 *
 * Between server updates each aircraft is dead-reckoned forward from its last
 * reported position using ground speed and track, which is what makes the
 * traffic move continuously rather than jumping every poll. Extrapolation is
 * capped so a stale contact drifts a little and then stops rather than
 * inventing a flight path.
 *
 * Selecting an aircraft adds its route: the track it has actually flown, and
 * — only when a destination is known or estimated — the leg still to fly,
 * drawn dashed so a projection can never be mistaken for a flown path.
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
  /** Route of the selected aircraft, or null when nothing is selected. */
  route?: SelectedRoute | null;
}

const MAX_EXTRAPOLATION_SEC = 45;
const FRAME_INTERVAL_MS = 100;

/** Opt-in: group nearby aircraft into count bubbles at low zoom. */
const CLUSTER_ENABLED = process.env.NEXT_PUBLIC_MAP_CLUSTER === "true";

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

function setLine(map: maplibregl.Map, sourceId: string, coordinates: Array<[number, number]>) {
  const source = map.getSource(sourceId) as GeoJSONSource | undefined;
  if (!source) return;
  source.setData({
    type: "FeatureCollection",
    features:
      coordinates.length >= 2
        ? [{ type: "Feature", properties: {}, geometry: { type: "LineString", coordinates } }]
        : [],
  });
}

/**
 * Paint the selected aircraft's route. `livePosition` is the dead-reckoned
 * position from the current frame, so the flown path stays joined to the
 * aircraft as it moves instead of lagging a poll behind.
 */
function drawRoute(
  map: maplibregl.Map,
  route: SelectedRoute,
  livePosition: [number, number] | null,
) {
  const flown: Array<[number, number]> = [...route.flown];
  if (route.departure) {
    flown.unshift([route.departure.lon, route.departure.lat]);
  }
  if (livePosition) flown.push(livePosition);
  setLine(map, "route-flown", flown);

  const head = livePosition ?? route.flown.at(-1) ?? null;
  setLine(
    map,
    "route-remaining",
    head && route.destination ? [head, [route.destination.lon, route.destination.lat]] : [],
  );

  const points: GeoJSON.Feature<GeoJSON.Point>[] = [];
  if (route.departure) {
    points.push({
      type: "Feature",
      geometry: { type: "Point", coordinates: [route.departure.lon, route.departure.lat] },
      properties: {
        role: "departure",
        label: route.departure.icao ?? route.departure.name,
      },
    });
  }
  if (route.destination) {
    points.push({
      type: "Feature",
      geometry: { type: "Point", coordinates: [route.destination.lon, route.destination.lat] },
      properties: {
        role: "destination",
        // The map must state the estimate, not just imply it with a dash.
        label: route.destinationEstimated
          ? `${route.destination.icao ?? route.destination.name} (est.)`
          : (route.destination.icao ?? route.destination.name),
      },
    });
  }

  const source = map.getSource("route-points") as GeoJSONSource | undefined;
  source?.setData({ type: "FeatureCollection", features: points });
}

function clearRoute(map: maplibregl.Map) {
  setLine(map, "route-flown", []);
  setLine(map, "route-remaining", []);
  const source = map.getSource("route-points") as GeoJSONSource | undefined;
  source?.setData({ type: "FeatureCollection", features: [] });
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
  route = null,
}: MapViewProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<maplibregl.Map | null>(null);
  const readyRef = useRef(false);
  const aircraftRef = useRef<LiveAircraft[]>(aircraft);
  const selectedRef = useRef<string | null>(selectedIcao);
  const routeRef = useRef<SelectedRoute | null>(route);
  const onSelectRef = useRef(onSelect);
  const onViewportRef = useRef(onViewportChange);

  aircraftRef.current = aircraft;
  selectedRef.current = selectedIcao;
  routeRef.current = route;
  onSelectRef.current = onSelect;
  onViewportRef.current = onViewportChange;

  // Clearing has to be explicit: the render loop only repaints a route that
  // exists, so a deselect would otherwise leave the last one on screen.
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !readyRef.current || route) return;
    clearRoute(map);
  }, [route]);

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

    // Report the viewport as soon as the map exists. Centre and zoom are known
    // immediately, and waiting for `load` means a slow or failing basemap
    // delays the aircraft feed — the map can be blank but the traffic should
    // still be arriving.
    reportViewport();
    map.once("idle", reportViewport);

    // `style.load` fires once the style is parsed; `load` additionally waits
    // for the first full render, which never completes if the basemap tiles
    // cannot be fetched. Building the aircraft layers here means traffic still
    // draws over a blank background when the tile CDN is unreachable.
    map.on("style.load", () => {
      // Aircraft icons are silhouettes of the actual type, built on first use
      // by ensureIcon() in the render loop below — a viewport touches only a
      // handful of type/colour combinations, so building all of them up front
      // would be wasted work.

      // ---- route of the selected aircraft --------------------------------
      // Three separate sources so each can carry its own styling: the path
      // actually flown, the leg still to fly, and the airport endpoints.
      for (const id of ["route-flown", "route-remaining", "route-points"]) {
        map.addSource(id, {
          type: "geojson",
          data: { type: "FeatureCollection", features: [] },
        });
      }

      map.addLayer({
        id: "route-flown-line",
        type: "line",
        source: "route-flown",
        layout: { "line-cap": "round", "line-join": "round" },
        paint: {
          "line-color": "#22d3ee",
          "line-width": ["interpolate", ["linear"], ["zoom"], 4, 1.6, 10, 3],
          "line-opacity": 0.85,
        },
      });

      map.addLayer({
        id: "route-remaining-line",
        type: "line",
        source: "route-remaining",
        layout: { "line-cap": "round", "line-join": "round" },
        paint: {
          // Dashed and dimmer: this leg has not been flown. An estimated
          // destination must never look like observed track.
          "line-color": "#f5a524",
          "line-width": ["interpolate", ["linear"], ["zoom"], 4, 1.4, 10, 2.4],
          "line-opacity": 0.75,
          "line-dasharray": [2, 2],
        },
      });

      map.addLayer({
        id: "route-endpoints",
        type: "circle",
        source: "route-points",
        paint: {
          "circle-radius": ["interpolate", ["linear"], ["zoom"], 4, 3.5, 10, 6],
          "circle-color": ["case", ["==", ["get", "role"], "departure"], "#22d3ee", "#f5a524"],
          "circle-stroke-color": "#04060c",
          "circle-stroke-width": 1.5,
        },
      });

      map.addLayer({
        id: "route-endpoint-labels",
        type: "symbol",
        source: "route-points",
        layout: {
          "text-field": ["get", "label"],
          "text-font": FONT,
          "text-size": 11,
          "text-offset": [0, -1.2],
          "text-anchor": "bottom",
          "text-allow-overlap": false,
          "text-optional": true,
        },
        paint: {
          "text-color": "#e8eefb",
          "text-halo-color": "#04060c",
          "text-halo-width": 1.5,
        },
      });

      // Every aircraft is drawn individually by default — grouping nearby
      // contacts into a count bubble hides the traffic you came to look at.
      // Clustering stays available for very dense views via NEXT_PUBLIC_MAP_CLUSTER.
      map.addSource("aircraft", {
        type: "geojson",
        data: { type: "FeatureCollection", features: [] },
        cluster: CLUSTER_ENABLED,
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
          // Large enough for the airframe planform to be readable rather than
          // just a dot — that is the whole point of type-accurate silhouettes.
          "icon-size": [
            "interpolate",
            ["linear"],
            ["zoom"],
            3, 0.5,
            6, 0.72,
            10, 1.0,
            13, 1.25,
          ],
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
            icon: ensureIcon(map, a, a.icao24 === selectedRef.current),
            track: a.trackDeg ?? 0,
            label: labelFor(a),
          },
        };
      });

      source.setData({ type: "FeatureCollection", features });

      // Keep the live end of the route attached to the moving aircraft.
      const route = routeRef.current;
      if (route) {
        const selected = aircraftRef.current.find((a) => a.icao24 === selectedRef.current);
        const live = selected
          ? features.find((f) => f.properties?.icao24 === selected.icao24)
          : undefined;
        drawRoute(map, route, (live?.geometry.coordinates as [number, number]) ?? null);
      }
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
