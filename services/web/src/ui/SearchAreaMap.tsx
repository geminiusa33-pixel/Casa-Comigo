import { useEffect } from "react";
import { Circle, MapContainer, Marker, TileLayer, useMap, useMapEvents } from "react-leaflet";
import { divIcon, type LatLngExpression, type LeafletMouseEvent } from "leaflet";

type Props = {
  position: { latitude: number; longitude: number } | null;
  radiusKm: number;
  onSelect: (latitude: number, longitude: number) => void;
};

const defaultCenter: LatLngExpression = [39.5, -8];
const markerIcon = divIcon({
  className: "search-area-map-marker",
  html: '<span class="search-area-map-marker-dot"></span>',
  iconSize: [28, 28],
  iconAnchor: [14, 14],
});

function MapClickHandler({ onSelect }: Pick<Props, "onSelect">) {
  useMapEvents({
    click(event: LeafletMouseEvent) {
      onSelect(event.latlng.lat, event.latlng.lng);
    },
  });
  return null;
}

function MapCenter({ position }: Pick<Props, "position">) {
  const map = useMap();

  useEffect(() => {
    if (position) map.setView([position.latitude, position.longitude], Math.max(map.getZoom(), 12));
  }, [map, position?.latitude, position?.longitude]);

  return null;
}

export function SearchAreaMap({ position, radiusKm, onSelect }: Props) {
  const center: LatLngExpression = position
    ? [position.latitude, position.longitude]
    : defaultCenter;

  return (
    <div className="search-area-map" aria-label="Mapa para escolher a zona de procura">
      <MapContainer center={center} zoom={position ? 12 : 6} scrollWheelZoom={false}>
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noreferrer">OpenStreetMap contributors</a> · tiles <a href="https://openstreetmap.fr/" target="_blank" rel="noreferrer">openstreetmap.fr</a>'
          url="https://a.tile.openstreetmap.fr/osmfr/{z}/{x}/{y}.png"
        />
        <MapClickHandler onSelect={onSelect} />
        <MapCenter position={position} />
        {position && (
          <>
            <Circle
              center={[position.latitude, position.longitude]}
              radius={radiusKm * 1000}
              pathOptions={{ color: "#315d48", fillColor: "#6e8d70", fillOpacity: 0.13, weight: 2 }}
            />
            <Marker
              position={[position.latitude, position.longitude]}
              icon={markerIcon}
              draggable
              eventHandlers={{
                dragend(event) {
                  const marker = event.target as { getLatLng: () => { lat: number; lng: number } };
                  const selected = marker.getLatLng();
                  onSelect(selected.lat, selected.lng);
                },
              }}
            />
          </>
        )}
      </MapContainer>
      {!position && <div className="search-area-map-prompt">Clique no mapa para escolher a zona</div>}
    </div>
  );
}
