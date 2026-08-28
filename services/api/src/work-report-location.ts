import type { WorkReportGeoJsonGeometry } from "@civic/shared";

function isFiniteCoord(n: unknown): n is number {
  return typeof n === "number" && Number.isFinite(n);
}

function isPosition(value: unknown): value is [number, number] {
  return (
    Array.isArray(value) &&
    value.length >= 2 &&
    isFiniteCoord(value[0]) &&
    isFiniteCoord(value[1])
  );
}

function parsePoint(raw: unknown): WorkReportGeoJsonGeometry | { error: string } {
  if (!raw || typeof raw !== "object") {
    return { error: "field_location Point must be an object." };
  }
  const coords = (raw as { coordinates?: unknown }).coordinates;
  if (!isPosition(coords)) {
    return { error: "field_location Point coordinates must be [lon, lat]." };
  }
  return { type: "Point", coordinates: [coords[0], coords[1]] };
}

function parseLineString(
  raw: unknown,
): WorkReportGeoJsonGeometry | { error: string } {
  if (!raw || typeof raw !== "object") {
    return { error: "field_location LineString must be an object." };
  }
  const coords = (raw as { coordinates?: unknown }).coordinates;
  if (!Array.isArray(coords) || coords.length < 2) {
    return {
      error: "field_location LineString needs at least two coordinates.",
    };
  }
  const line: [number, number][] = [];
  for (const pos of coords) {
    if (!isPosition(pos)) {
      return { error: "field_location LineString coordinates must be [lon, lat]." };
    }
    line.push([pos[0], pos[1]]);
  }
  return { type: "LineString", coordinates: line };
}

function parsePolygon(
  raw: unknown,
): WorkReportGeoJsonGeometry | { error: string } {
  if (!raw || typeof raw !== "object") {
    return { error: "field_location Polygon must be an object." };
  }
  const rings = (raw as { coordinates?: unknown }).coordinates;
  if (!Array.isArray(rings) || rings.length < 1) {
    return { error: "field_location Polygon needs at least one ring." };
  }
  const outer = rings[0];
  if (!Array.isArray(outer) || outer.length < 4) {
    return {
      error: "field_location Polygon outer ring needs at least four positions.",
    };
  }
  const ring: [number, number][] = [];
  for (const pos of outer) {
    if (!isPosition(pos)) {
      return { error: "field_location Polygon coordinates must be [lon, lat]." };
    }
    ring.push([pos[0], pos[1]]);
  }
  const first = ring[0];
  const last = ring[ring.length - 1];
  if (first[0] !== last[0] || first[1] !== last[1]) {
    ring.push([first[0], first[1]]);
  }
  return { type: "Polygon", coordinates: [ring] };
}

export function parseFieldLocation(
  raw: unknown,
): WorkReportGeoJsonGeometry | null | { error: string } {
  if (raw == null) return null;
  if (typeof raw !== "object") {
    return { error: "field_location must be a GeoJSON geometry object." };
  }
  const type = (raw as { type?: unknown }).type;
  if (type === "Point") return parsePoint(raw);
  if (type === "LineString") return parseLineString(raw);
  if (type === "Polygon") return parsePolygon(raw);
  return {
    error: "field_location type must be Point, LineString, or Polygon.",
  };
}
