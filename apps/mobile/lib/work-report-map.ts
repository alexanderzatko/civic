import type {
  WorkReportGeoJsonGeometry,
  WorkReportGeometryType,
} from "@civic/shared";

export type LatLng = { latitude: number; longitude: number };

export function lonLatToLatLng([lon, lat]: [number, number]): LatLng {
  return { latitude: lat, longitude: lon };
}

export function latLngRing(coords: [number, number][]): LatLng[] {
  return coords.map(lonLatToLatLng);
}

export function zoomToLatitudeDelta(zoom: number): number {
  return 360 / 2 ** Math.max(zoom, 1);
}

export function geometryVertexCount(geometry: WorkReportGeoJsonGeometry): number {
  switch (geometry.type) {
    case "Point":
      return 1;
    case "LineString":
      return geometry.coordinates.length;
    case "Polygon":
      return geometry.coordinates[0]?.length ?? 0;
  }
}

export function geometrySummaryKey(
  geometry: WorkReportGeoJsonGeometry,
): WorkReportGeometryType {
  return geometry.type;
}

export function isGeometryComplete(
  type: WorkReportGeometryType,
  draft: [number, number][],
): boolean {
  if (type === "Point") return draft.length >= 1;
  if (type === "LineString") return draft.length >= 2;
  return draft.length >= 3;
}

export function commitDraftGeometry(
  type: WorkReportGeometryType,
  draft: [number, number][],
): WorkReportGeoJsonGeometry | null {
  if (type === "Point" && draft[0]) {
    return { type: "Point", coordinates: draft[0] };
  }
  if (type === "LineString" && draft.length >= 2) {
    return { type: "LineString", coordinates: draft };
  }
  if (type === "Polygon" && draft.length >= 3) {
    const ring = [...draft];
    const first = ring[0];
    const last = ring[ring.length - 1];
    if (first[0] !== last[0] || first[1] !== last[1]) {
      ring.push(first);
    }
    return { type: "Polygon", coordinates: [ring] };
  }
  return null;
}
