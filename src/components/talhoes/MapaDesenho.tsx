import { useEffect, useRef } from "react";
import { MapContainer, TileLayer, FeatureGroup, GeoJSON, Popup, useMap } from "react-leaflet";
import { EditControl } from "react-leaflet-draw";
import L from "leaflet";
import area from "@turf/area";
import "leaflet/dist/leaflet.css";
import "leaflet-draw/dist/leaflet.draw.css";

// Fix default marker icons
delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png",
  iconUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png",
  shadowUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png",
});

export interface DrawResult {
  geometria: GeoJSON.Polygon;
  centro_lat: number;
  centro_lng: number;
  area_ha: number;
}

/** Aceita geometria vinda como objeto ou string JSON do banco */
export function parseGeometria(g: any): GeoJSON.Polygon | null {
  if (!g) return null;
  try {
    const obj = typeof g === "string" ? JSON.parse(g) : g;
    if (obj?.type === "Feature") return obj.geometry ?? null;
    if (obj?.type === "Polygon" || obj?.type === "MultiPolygon") return obj;
    return null;
  } catch {
    return null;
  }
}

interface Props {
  initialGeometry?: any;
  center?: [number, number];
  zoom?: number;
  onChange: (r: DrawResult | null) => void;
  height?: number;
}

function computeResult(geometry: GeoJSON.Polygon): DrawResult {
  const m2 = area(geometry as any);
  const area_ha = +(m2 / 10000).toFixed(4);
  const coords = geometry.coordinates[0];
  const lats = coords.map((c) => c[1]);
  const lngs = coords.map((c) => c[0]);
  const centro_lat = lats.reduce((a, b) => a + b, 0) / lats.length;
  const centro_lng = lngs.reduce((a, b) => a + b, 0) / lngs.length;
  return { geometria: geometry, centro_lat, centro_lng, area_ha };
}

/** Força o Leaflet a recalcular o tamanho do container após montagem/resize */
function InvalidateSize() {
  const map = useMap();
  useEffect(() => {
    const fix = () => map.invalidateSize();
    const t1 = setTimeout(fix, 100);
    const t2 = setTimeout(fix, 500);
    window.addEventListener("resize", fix);
    return () => {
      clearTimeout(t1);
      clearTimeout(t2);
      window.removeEventListener("resize", fix);
    };
  }, [map]);
  return null;
}

/** Centraliza o mapa nas geometrias fornecidas */
function FitBounds({ geometries }: { geometries: GeoJSON.Polygon[] }) {
  const map = useMap();
  useEffect(() => {
    if (!geometries.length) return;
    try {
      const grupo = L.featureGroup(geometries.map((g) => L.geoJSON(g as any)));
      const bounds = grupo.getBounds();
      if (bounds.isValid()) map.fitBounds(bounds, { padding: [50, 50] });
    } catch {
      /* ignore */
    }
  }, [geometries, map]);
  return null;
}

export function MapaDesenho({ initialGeometry, center, zoom, onChange, height = 360 }: Props) {
  const fgRef = useRef<L.FeatureGroup>(null);
  const geom = parseGeometria(initialGeometry);

  let mapCenter: [number, number] = center || [-14.235, -51.925];
  let mapZoom = zoom ?? (center ? 14 : 4);
  if (geom) {
    const r = computeResult(geom as GeoJSON.Polygon);
    mapCenter = [r.centro_lat, r.centro_lng];
    mapZoom = 15;
  }

  const handleCreated = (e: any) => {
    if (fgRef.current) {
      fgRef.current.getLayers().forEach((l) => {
        if (l !== e.layer) fgRef.current!.removeLayer(l);
      });
    }
    const gj = e.layer.toGeoJSON() as GeoJSON.Feature<GeoJSON.Polygon>;
    onChange(computeResult(gj.geometry));
  };

  const handleEdited = (e: any) => {
    e.layers.eachLayer((layer: any) => {
      const gj = layer.toGeoJSON() as GeoJSON.Feature<GeoJSON.Polygon>;
      onChange(computeResult(gj.geometry));
    });
  };

  const handleDeleted = () => onChange(null);

  return (
    <div style={{ height }} className="w-full rounded-md overflow-hidden border">
      <MapContainer center={mapCenter} zoom={mapZoom} scrollWheelZoom style={{ height: "100%", width: "100%" }}>
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        <InvalidateSize />
        {geom && <FitBounds geometries={[geom]} />}
        <FeatureGroup ref={fgRef as any}>
          <EditControl
            position="topright"
            onCreated={handleCreated}
            onEdited={handleEdited}
            onDeleted={handleDeleted}
            draw={{
              rectangle: false,
              circle: false,
              circlemarker: false,
              marker: false,
              polyline: false,
              polygon: { allowIntersection: false, showArea: true },
            }}
          />
          {geom && (
            <GeoJSON
              key={JSON.stringify(geom)}
              data={geom as any}
              pathOptions={{ color: "#1F3A2E", weight: 2, fillOpacity: 0.3 }}
            />
          )}
        </FeatureGroup>
      </MapContainer>
    </div>
  );
}

interface ViewProps {
  talhoes: Array<{
    id: string;
    nome: string;
    area_ha: number;
    cultura_atual?: string | null;
    geometria: any;
    centro_lat?: number | null;
    centro_lng?: number | null;
  }>;
  fallbackCenter?: [number, number];
  height?: number | string;
}

export function MapaTalhoesView({ talhoes, fallbackCenter, height = 600 }: ViewProps) {
  const comGeo = talhoes
    .map((t) => ({ ...t, geom: parseGeometria(t.geometria) }))
    .filter((t) => !!t.geom);

  const center: [number, number] = fallbackCenter || [-14.235, -51.925];
  const zoom = fallbackCenter ? 14 : 4;

  return (
    <div style={{ height, minHeight: 400 }} className="w-full rounded-md overflow-hidden border">
      <MapContainer center={center} zoom={zoom} scrollWheelZoom style={{ height: "100%", width: "100%" }}>
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        <InvalidateSize />
        <FitBounds geometries={comGeo.map((t) => t.geom as GeoJSON.Polygon)} />
        {comGeo.map((t) => (
          <GeoJSON
            key={t.id}
            data={t.geom as any}
            pathOptions={{ color: "#16a34a", weight: 2, fillOpacity: 0.3 }}
          >
            <Popup>
              <div className="space-y-1">
                <div className="font-semibold">{t.nome}</div>
                {t.area_ha != null && <div className="text-sm">Área: {Number(t.area_ha).toFixed(2)} ha</div>}
                {t.cultura_atual && <div className="text-sm">Cultura: {t.cultura_atual}</div>}
              </div>
            </Popup>
          </GeoJSON>
        ))}
      </MapContainer>
    </div>
  );
}
