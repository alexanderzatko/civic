import type {
  WorkReportGeoJsonGeometry,
  WorkReportGeometryType,
  WorkReportSimpleGeometry,
} from "@civic/shared";

export type LatLng = { latitude: number; longitude: number };

/** Soft limit — Civic rejects larger collections; UI is otherwise unbounded. */
export const WORK_REPORT_MAX_FEATURES = 100;

export function lonLatToLatLng([lon, lat]: [number, number]): LatLng {
  return { latitude: lat, longitude: lon };
}

export function latLngRing(coords: [number, number][]): LatLng[] {
  return coords.map(lonLatToLatLng);
}

export function zoomToLatitudeDelta(zoom: number): number {
  return 360 / 2 ** Math.max(zoom, 1);
}

export function listGeometries(
  geometry: WorkReportGeoJsonGeometry,
): WorkReportSimpleGeometry[] {
  if (geometry.type === "GeometryCollection") {
    return [...geometry.geometries];
  }
  return [geometry];
}

export function fromGeometries(
  geometries: WorkReportSimpleGeometry[],
): WorkReportGeoJsonGeometry | null {
  if (geometries.length === 0) return null;
  if (geometries.length === 1) return geometries[0];
  return { type: "GeometryCollection", geometries };
}

export function appendGeometry(
  existing: WorkReportGeoJsonGeometry | null,
  next: WorkReportSimpleGeometry,
): WorkReportGeoJsonGeometry | null {
  const list = existing ? listGeometries(existing) : [];
  if (list.length >= WORK_REPORT_MAX_FEATURES) return existing;
  return fromGeometries([...list, next]);
}

export function popGeometry(
  existing: WorkReportGeoJsonGeometry | null,
): WorkReportGeoJsonGeometry | null {
  if (!existing) return null;
  const list = listGeometries(existing);
  list.pop();
  return fromGeometries(list);
}

export function geometryFeatureCount(
  geometry: WorkReportGeoJsonGeometry,
): number {
  return listGeometries(geometry).length;
}

export function geometryVertexCount(geometry: WorkReportGeoJsonGeometry): number {
  return listGeometries(geometry).reduce((sum, part) => {
    switch (part.type) {
      case "Point":
        return sum + 1;
      case "LineString":
        return sum + part.coordinates.length;
      case "Polygon":
        return sum + (part.coordinates[0]?.length ?? 0);
    }
  }, 0);
}

/** i18n key suffix under `volunteer.proof_map_summary_*` (lowercase). */
export function geometrySummaryKey(
  geometry: WorkReportGeoJsonGeometry,
): string {
  if (geometry.type === "GeometryCollection") {
    return geometry.geometries.length <= 1
      ? (geometry.geometries[0]?.type ?? "features")
      : "features";
  }
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
): WorkReportSimpleGeometry | null {
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
