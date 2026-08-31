type LeafletHtmlOptions = {
  tileUrl: string;
  maxZoom: number;
  centerLat: number;
  centerLon: number;
  zoom: number;
  brand: string;
  brandSoft: string;
};

/** Inline Leaflet map for WebView — Freemap/OSM XYZ tiles only, no Google/Apple SDK. */
export function buildWorkReportLeafletHtml(opts: LeafletHtmlOptions): string {
  const init = JSON.stringify({
    tileUrl: opts.tileUrl,
    maxZoom: opts.maxZoom,
    centerLat: opts.centerLat,
    centerLon: opts.centerLon,
    zoom: opts.zoom,
    brand: opts.brand,
    brandSoft: opts.brandSoft,
  });

  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no" />
  <link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css" crossorigin="" />
  <script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js" crossorigin=""></script>
  <style>
    html, body { height: 100%; margin: 0; padding: 0; background: #e8ede9; }
    #map { height: 100%; width: 100%; touch-action: none; }
  </style>
</head>
<body>
  <div id="map"></div>
  <script>
    (function () {
      var INIT = ${init};
      var map = L.map("map", { zoomControl: true, attributionControl: true }).setView(
        [INIT.centerLat, INIT.centerLon],
        INIT.zoom,
      );
      L.tileLayer(INIT.tileUrl, { maxZoom: INIT.maxZoom, crossOrigin: true }).addTo(map);

      var geometryLayer = L.layerGroup().addTo(map);
      var draftLayer = L.layerGroup().addTo(map);
      var interactive = false;
      var disabled = false;

      function lonLatRing(coords) {
        if (!coords || !coords.length) return [];
        return coords.map(function (c) { return [c[1], c[0]]; });
      }

      function boundsFromGeometry(g) {
        if (!g) return null;
        if (g.type === "Point") {
          var p = g.coordinates;
          return L.latLngBounds([p[1], p[0]], [p[1], p[0]]);
        }
        if (g.type === "LineString") {
          return L.latLngBounds(lonLatRing(g.coordinates));
        }
        if (g.type === "Polygon") {
          return L.latLngBounds(lonLatRing(g.coordinates[0] || []));
        }
        return null;
      }

      function renderGeometry(g) {
        geometryLayer.clearLayers();
        if (!g) return;
        if (g.type === "Point") {
          L.circleMarker([g.coordinates[1], g.coordinates[0]], {
            radius: 8,
            color: INIT.brand,
            weight: 2,
            fillColor: INIT.brand,
            fillOpacity: 1,
          }).addTo(geometryLayer);
          return;
        }
        if (g.type === "LineString") {
          L.polyline(lonLatRing(g.coordinates), { color: INIT.brand, weight: 3 }).addTo(geometryLayer);
          return;
        }
        if (g.type === "Polygon") {
          L.polygon(lonLatRing(g.coordinates[0] || []), {
            color: INIT.brand,
            weight: 2,
            fillColor: INIT.brand,
            fillOpacity: 0.25,
          }).addTo(geometryLayer);
        }
      }

      function renderDraft(draft, mode) {
        draftLayer.clearLayers();
        if (!draft || !draft.length) return;
        if (mode === "Point") {
          L.circleMarker([draft[0][1], draft[0][0]], {
            radius: 8,
            color: INIT.brandSoft,
            weight: 2,
            fillColor: INIT.brandSoft,
            fillOpacity: 1,
          }).addTo(draftLayer);
          return;
        }
        if (mode === "LineString") {
          L.polyline(lonLatRing(draft), { color: INIT.brandSoft, weight: 3, dashArray: "8 6" }).addTo(draftLayer);
          return;
        }
        if (mode === "Polygon") {
          L.polygon(lonLatRing(draft), {
            color: INIT.brandSoft,
            weight: 2,
            fillColor: INIT.brandSoft,
            fillOpacity: 0.2,
          }).addTo(draftLayer);
        }
      }

      function applyState(state) {
        interactive = !!state.interactive;
        disabled = !!state.disabled;
        renderGeometry(state.geometry || null);
        renderDraft(state.draft || [], state.mode || "Point");
        if (state.fitGeometry && state.geometry) {
          var b = boundsFromGeometry(state.geometry);
          if (b && b.isValid()) {
            map.fitBounds(b.pad(state.geometry.type === "Point" ? 0.2 : 0.1));
          }
        }
      }

      function onRnMessage(event) {
        var raw = event.data;
        if (typeof raw !== "string") return;
        try {
          var msg = JSON.parse(raw);
          if (msg.type === "sync") {
            applyState(msg);
          } else if (msg.type === "flyTo") {
            map.setView([msg.latitude, msg.longitude], msg.zoom || map.getZoom());
          }
        } catch (e) {}
      }

      document.addEventListener("message", onRnMessage);
      window.addEventListener("message", onRnMessage);

      map.on("click", function (e) {
        if (!interactive || disabled) return;
        if (window.ReactNativeWebView && window.ReactNativeWebView.postMessage) {
          window.ReactNativeWebView.postMessage(JSON.stringify({
            type: "press",
            longitude: e.latlng.lng,
            latitude: e.latlng.lat,
          }));
        }
      });

      if (window.ReactNativeWebView && window.ReactNativeWebView.postMessage) {
        window.ReactNativeWebView.postMessage(JSON.stringify({ type: "ready" }));
      }
    })();
  </script>
</body>
</html>`;
}
