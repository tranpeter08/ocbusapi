'use client';

import { useEffect, useRef } from 'react';
import type * as LType from 'leaflet';
import { Bus } from './types';

const OC_CENTER: [number, number] = [33.7175, -117.8311];
const DEFAULT_ZOOM = 11;

type BusMapProps = {
  buses: Bus[];
  selectedBus: Bus | null;
  focusTrigger: number;
};

export default function BusMap({
  buses,
  selectedBus,
  focusTrigger,
}: BusMapProps) {
  const mapContainerRef = useRef<HTMLDivElement | null>(null);
  const mapInstanceRef = useRef<LType.Map | null>(null);
  const markersLayerRef = useRef<LType.LayerGroup | null>(null);

  // 1. Initialize the Leaflet map once on mount
  useEffect(() => {
    let cancelled = false;

    async function initMap() {
      const L = await import('leaflet');
      if (cancelled || !mapContainerRef.current || mapInstanceRef.current) {
        return;
      }

      const map = L.map(mapContainerRef.current).setView(
        OC_CENTER,
        DEFAULT_ZOOM
      );

      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '© OpenStreetMap contributors',
        maxZoom: 19,
      }).addTo(map);

      markersLayerRef.current = L.layerGroup().addTo(map);
      mapInstanceRef.current = map;
    }

    initMap();

    return () => {
      cancelled = true;
      if (mapInstanceRef.current) {
        mapInstanceRef.current.remove();
        mapInstanceRef.current = null;
      }
    };
  }, []);

  // 2. Update bus pins and permanent labels
  useEffect(() => {
    async function updateMarkers() {
      const L = await import('leaflet');
      const layer = markersLayerRef.current;
      if (!layer) return;

      layer.clearLayers();

      buses.forEach((bus) => {
        const isNotInService = bus.routeId === '0';
        const isSelected = selectedBus?.id === bus.id;

        let dotColor = '#2563eb'; // Blue for active service
        if (isSelected) {
          dotColor = '#16a34a'; // Green for selected bus
        } else if (isNotInService) {
          dotColor = '#6b7280'; // Gray for NIS
        }

        const routeLabel = isNotInService ? 'NIS' : bus.routeId;

        const marker = L.circleMarker([bus.latitude, bus.longitude], {
          radius: isSelected ? 9 : 6,
          fillColor: dotColor,
          color: '#ffffff',
          weight: 2,
          opacity: 1,
          fillOpacity: 0.95,
          interactive: false,
        });

        marker.bindTooltip(`${bus.id} (${routeLabel})`, {
          permanent: true,
          direction: 'top',
          offset: [0, -6],
          className:
            'font-mono font-bold text-[11px] px-1.5 py-0.5 leading-none shadow-sm',
        });

        marker.addTo(layer);
      });
    }

    updateMarkers();
  }, [buses, selectedBus]);

  // 3. Center and zoom when "View" is clicked in the table
  useEffect(() => {
    const map = mapInstanceRef.current;
    if (!map || !selectedBus) return;

    map.flyTo([selectedBus.latitude, selectedBus.longitude], 16, {
      duration: 0.8,
    });
  }, [selectedBus, focusTrigger]);

  return (
    <div
      ref={mapContainerRef}
      className='w-full h-[500px] rounded-lg border border-gray-300 shadow-sm z-0'
    />
  );
}
