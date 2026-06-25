import { useEffect, useRef } from "react";
import { MapContainer, TileLayer, FeatureGroup, Polygon, Popup } from "react-leaflet";
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

interface Props {
  initialGeometry?: GeoJSON.Polygon | null;
  center?: [number, number];
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

export function MapaDesenho({ initialGeometry, center, onChange, height = 360 }: Props) {
  const fgRef = useRef<L.FeatureGroup>(null);

  // Center: initial polygon's centroid > prop center > Brazil
  let mapCenter: [number, number] = center || [-15.78, -47.92];
  if (initialGeometry) {
    const r = computeResult(initialGeometry);
    mapCenter = [r.centro_lat, r.centro_lng];
  }

  useEffect(() => {
    if (initialGeometry && fgRef.current && fgRef.current.getLayers().length === 0) {
      const layer = L.geoJSON(initialGeometry);
      layer.eachLayer((l) => fgRef.current!.addLayer(l));
    }
  }, [initialGeometry]);

  const handleCreated = (e: any) => {
    // Only allow one polygon: clear previous
    if (fgRef.current) {
      const layers = fgRef.current.getLayers();
      layers.forEach((l) => {
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

  const handleDeleted = () => {
    onChange(null);
  };

  return (
    <div style={{ height }} className="w-full rounded-md overflow-hidden border">
      <MapContainer center={mapCenter} zoom={15} style={{ height: "100%", width: "100%" }}>
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
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
    geometria: GeoJSON.Polygon;
    centro_lat?: number | null;
    centro_lng?: number | null;
  }>;
  fallbackCenter?: [number, number];
  height?: number | string;
}

export function MapaTalhoesView({ talhoes, fallbackCenter, height = "100%" }: ViewProps) {
  const centers = talhoes
    .map((t) => (t.centro_lat && t.centro_lng ? [t.centro_lat, t.centro_lng] as [number, number] : null))
    .filter(Boolean) as [number, number][];
  let center: [number, number] = fallbackCenter || [-15.78, -47.92];
  if (centers.length > 0) {
    center = [
      centers.reduce((a, b) => a + b[0], 0) / centers.length,
      centers.reduce((a, b) => a + b[1], 0) / centers.length,
    ];
  }

  return (
    <div style={{ height }} className="w-full rounded-md overflow-hidden border">
      <MapContainer center={center} zoom={13} style={{ height: "100%", width: "100%" }}>
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        {talhoes.map((t) => {
          const positions = t.geometria.coordinates[0].map((c) => [c[1], c[0]] as [number, number]);
          return (
            <Polygon key={t.id} positions={positions} pathOptions={{ color: "#16a34a", weight: 2 }}>
              <Popup>
                <div className="space-y-1">
                  <div className="font-semibold">{t.nome}</div>
                  <div className="text-sm">Área: {t.area_ha?.toFixed(2)} ha</div>
                  {t.cultura_atual && <div className="text-sm">Cultura: {t.cultura_atual}</div>}
                </div>
              </Popup>
            </Polygon>
          );
        })}
      </MapContainer>
    </div>
  );
}
