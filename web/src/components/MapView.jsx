import React, { useEffect } from 'react';
import { MapContainer, TileLayer, Marker, Popup, Circle, useMap, useMapEvents } from 'react-leaflet';
import L from 'leaflet';

const pinIcon = (emoji, color) => L.divIcon({
  className: '',
  html: `<div style="width:38px;height:38px;border-radius:50% 50% 50% 0;background:${color};transform:rotate(-45deg);display:flex;align-items:center;justify-content:center;box-shadow:0 4px 10px rgba(15,23,42,.35);border:3px solid #fff"><span style="transform:rotate(45deg);font-size:17px">${emoji}</span></div>`,
  iconSize: [38, 38],
  iconAnchor: [19, 38],
  popupAnchor: [0, -34]
});

const ICONS = {
  client: pinIcon('🏠', '#2563eb'),
  master: pinIcon('🛠️', '#059669'),
  me: pinIcon('📍', '#7c3aed')
};

function ClickHandler({ onPick }) {
  useMapEvents({
    click(e) {
      onPick?.({ lat: e.latlng.lat, lng: e.latlng.lng });
    }
  });
  return null;
}

/**
 * Markerlar o'zgarganda xaritani ularga moslashtirish
 */
function FitBounds({ points }) {
  const map = useMap();
  const key = points.map((p) => `${p.lat.toFixed(4)},${p.lng.toFixed(4)}`).join('|');
  useEffect(() => {
    if (points.length === 1) {
      map.setView([points[0].lat, points[0].lng], Math.max(map.getZoom(), 14));
    } else if (points.length > 1) {
      map.fitBounds(points.map((p) => [p.lat, p.lng]), { padding: [40, 40], maxZoom: 16 });
    }
    // faqat koordinatalar o'zgarganda qayta joylashtiriladi
  }, [key, map]);
  return null;
}

/**
 * Xarita (OpenStreetMap). markers: [{ id, lat, lng, type: 'client'|'master'|'me', label, draggable }]
 */
export default function MapView({ center, markers = [], onPick, radiusKm, className = 'h-72', zoom = 13 }) {
  const visible = markers.filter((m) => Number.isFinite(m.lat) && Number.isFinite(m.lng));
  const start = visible[0] || center;

  return (
    <div className={`relative rounded-2xl overflow-hidden border border-slate-200 z-0 ${className}`}>
      <MapContainer center={[start.lat, start.lng]} zoom={zoom} scrollWheelZoom className="h-full w-full">
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        {onPick && <ClickHandler onPick={onPick} />}
        <FitBounds points={visible} />
        {radiusKm && visible[0] && (
          <Circle
            center={[visible[0].lat, visible[0].lng]}
            radius={radiusKm * 1000}
            pathOptions={{ color: '#2563eb', weight: 1, fillOpacity: 0.06 }}
          />
        )}
        {visible.map((m) => (
          <Marker
            key={m.id}
            position={[m.lat, m.lng]}
            icon={ICONS[m.type] || ICONS.client}
            draggable={Boolean(m.draggable && onPick)}
            eventHandlers={m.draggable && onPick ? {
              dragend: (e) => {
                const { lat, lng } = e.target.getLatLng();
                onPick({ lat, lng });
              }
            } : undefined}
          >
            {m.label && <Popup>{m.label}</Popup>}
          </Marker>
        ))}
      </MapContainer>
    </div>
  );
}
