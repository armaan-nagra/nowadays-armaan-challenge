"use client";

import { useEffect, useMemo } from "react";
import { MapContainer, TileLayer, Marker, Polygon, Tooltip, useMap } from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import type { ScoredVenue } from "@/lib/types";

const PACE: Record<"walking" | "driving", number> = { walking: 80, driving: 600 };

/** Hand-drawn-feeling blob: a circle with layered sine wobble on the radius. */
function walkBlob(center: { lat: number; lng: number }, radiusM: number): [number, number][] {
  const points: [number, number][] = [];
  const latM = 111320;
  const lngM = 111320 * Math.cos((center.lat * Math.PI) / 180);
  for (let i = 0; i <= 72; i++) {
    const t = (i / 72) * Math.PI * 2;
    const wobble = 1 + 0.055 * Math.sin(t * 5 + 1.3) + 0.04 * Math.sin(t * 9 + 4.1) + 0.025 * Math.sin(t * 3);
    const r = radiusM * wobble;
    points.push([center.lat + (r * Math.sin(t)) / latM, center.lng + (r * Math.cos(t)) / lngM]);
  }
  return points;
}

function pinIcon(rank: number, isTop: boolean, isActive: boolean): L.DivIcon {
  return L.divIcon({
    className: `pin-sticker ${isTop ? "pin-top" : ""} ${isActive ? "pin-active" : ""}`,
    html: `<div class="pin-inner"><span>${rank}</span></div>`,
    iconSize: [38, 38],
    iconAnchor: [19, 34],
  });
}

const originIcon = L.divIcon({
  className: "pin-origin",
  html: `<div class="origin-inner">📍</div>`,
  iconSize: [44, 44],
  iconAnchor: [22, 22],
});

function Recenter({ lat, lng, radiusM }: { lat: number; lng: number; radiusM: number }) {
  const map = useMap();
  useEffect(() => {
    const latDelta = (radiusM * 1.35) / 111320;
    map.fitBounds([
      [lat - latDelta, lng - latDelta * 1.4],
      [lat + latDelta, lng + latDelta * 1.4],
    ]);
  }, [map, lat, lng, radiusM]);
  return null;
}

export default function MapPanel({
  origin,
  results,
  maxMinutes,
  mode,
  hoveredId,
  onHover,
  onOpen,
}: {
  origin: { lat: number; lng: number } | null;
  results: ScoredVenue[];
  maxMinutes: number;
  mode: "walking" | "driving";
  hoveredId: string | null;
  onHover: (id: string | null) => void;
  onOpen: (id: string) => void;
}) {
  const radiusM = maxMinutes * PACE[mode];
  const blob = useMemo(
    () => (origin ? walkBlob(origin, radiusM) : null),
    [origin, radiusM]
  );

  return (
    <div className="sticker overflow-hidden h-full min-h-[420px]">
      <MapContainer
        center={origin ? [origin.lat, origin.lng] : [40.758, -73.9855]}
        zoom={14}
        className="h-full w-full"
        scrollWheelZoom
        attributionControl={false}
      >
        <TileLayer
          url="https://tiles.stadiamaps.com/tiles/stamen_watercolor/{z}/{x}/{y}.jpg"
          attribution='&copy; <a href="https://stadiamaps.com/">Stadia Maps</a> &copy; <a href="https://stamen.com/">Stamen Design</a> &copy; OpenStreetMap'
          maxZoom={16}
        />
        {origin && <Recenter lat={origin.lat} lng={origin.lng} radiusM={radiusM} />}
        {blob && (
          <Polygon
            positions={blob}
            pathOptions={{
              color: "#22262b",
              weight: 3,
              dashArray: "10 8",
              fillColor: "#ff6b57",
              fillOpacity: 0.09,
            }}
          />
        )}
        {origin && <Marker position={[origin.lat, origin.lng]} icon={originIcon} zIndexOffset={500} />}
        {results.map((r, i) => (
          <Marker
            key={r.venue.id}
            position={[r.venue.lat, r.venue.lng]}
            icon={pinIcon(i + 1, i < 3, hoveredId === r.venue.id)}
            zIndexOffset={hoveredId === r.venue.id ? 1000 : 100 - i}
            eventHandlers={{
              mouseover: () => onHover(r.venue.id),
              mouseout: () => onHover(null),
              click: () => onOpen(r.venue.id),
            }}
          >
            <Tooltip direction="top" offset={[0, -32]} opacity={1}>
              <span className="font-semibold">{r.venue.name}</span>
              {r.commute && <span> · {Math.round(r.commute.duration_minutes)} min {mode === "driving" ? "drive" : "walk"}</span>}
            </Tooltip>
          </Marker>
        ))}
      </MapContainer>
    </div>
  );
}
