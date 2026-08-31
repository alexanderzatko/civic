import type { WorkReportMapConfig } from "@civic/shared";

/** Mobile fallback until Rovas map-config is reachable. */
export const FALLBACK_WORK_REPORT_MAP_CONFIG: WorkReportMapConfig = {
  center: { latitude: 48.7164, longitude: 19.6611 },
  zoom: 8,
  geometry_types: ["Point", "LineString", "Polygon"],
  raster_layers: [
    {
      id: "osm",
      name: "OpenStreetMap",
      url_template: "https://tile.openstreetmap.org/{z}/{x}/{y}.png",
      attribution: "© OpenStreetMap contributors",
      max_zoom: 19,
    },
  ],
  default_layer_id: "osm",
};

export function pickActiveRasterLayer(config: WorkReportMapConfig) {
  const preferred = config.default_layer_id
    ? config.raster_layers.find((l) => l.id === config.default_layer_id)
    : undefined;
  return preferred ?? config.raster_layers[0];
}
