import { useEffect, useMemo, useRef, useState } from 'preact/hooks';
import * as maplibregl from 'maplibre-gl';
import type { GeoJSONSource, Map as MLMap, MapMouseEvent, PointLike } from 'maplibre-gl';
import type { FeatureCollection } from 'geojson';
import workerUrl from 'maplibre-gl/dist/maplibre-gl-worker.mjs?url';
import 'maplibre-gl/dist/maplibre-gl.css';
import { getAllSummaries } from '../db';
import { distance, formatDistance, formatRating } from '../geo';
import { isDefault, loadFilters, matches, saveFilters, type Filters } from '../filters';
import { usePosition } from '../hooks/usePosition';
import { Header } from '../components/Header';
import { TypeIcon } from '../components/TypeIcon';
import { FilterPanel } from '../components/FilterPanel';
import { createIcon, iconName, ICON_SIZE } from '../map/icons';
import { getLastView, OSM_STYLE, setLastView } from '../map/mapView';
import { CACHE_TYPE_LABELS, type CacheSummary, type CacheType } from '../types';

maplibregl.setWorkerUrl(workerUrl);

interface Props {
  onBack: () => void;
  onDetails: (code: string) => void;
  onNavigate: (code: string) => void;
  onImport: () => void;
}

const EMPTY: FeatureCollection = { type: 'FeatureCollection', features: [] };

function cachesToGeoJSON(caches: CacheSummary[]): FeatureCollection {
  return {
    type: 'FeatureCollection',
    features: caches.map((c) => ({
      type: 'Feature',
      geometry: { type: 'Point', coordinates: [c.lon, c.lat] },
      properties: {
        code: c.code,
        icon: iconName(c.type, c.found),
        dimmed: !c.available || c.archived,
        // Gefundene unten, offene oben zeichnen
        sort: c.found ? 0 : 1,
      },
    })),
  };
}

export function MapScreen({ onBack, onDetails, onNavigate, onImport }: Props) {
  const container = useRef<HTMLDivElement>(null);
  const mapRef = useRef<MLMap | null>(null);
  const [mapReady, setMapReady] = useState(false);
  const [caches, setCaches] = useState<CacheSummary[] | null>(null);
  const [filters, setFilters] = useState<Filters>(loadFilters);
  const [showFilters, setShowFilters] = useState(false);
  const [selected, setSelected] = useState<string | null>(null);
  const [online, setOnline] = useState(navigator.onLine);
  const position = usePosition();
  const pos = position.status === 'ok' ? position.pos : null;

  useEffect(() => {
    getAllSummaries().then(setCaches).catch(() => setCaches([]));
    const on = () => setOnline(true);
    const off = () => setOnline(false);
    window.addEventListener('online', on);
    window.addEventListener('offline', off);
    return () => {
      window.removeEventListener('online', on);
      window.removeEventListener('offline', off);
    };
  }, []);

  const visible = useMemo(() => (caches ?? []).filter((c) => matches(c, filters)), [caches, filters]);
  const availableTypes = useMemo(
    () => [...new Set<CacheType>((caches ?? []).map((c) => c.type))].sort(),
    [caches],
  );

  // Karte einmalig anlegen
  useEffect(() => {
    if (!container.current) return;
    const last = getLastView();
    const map = new maplibregl.Map({
      container: container.current,
      style: OSM_STYLE,
      center: last ? [last.lng, last.lat] : [10.45, 51.16],
      zoom: last ? last.zoom : 5,
      attributionControl: { compact: true },
      // Karte bleibt genordet – wie beim Navigieren erwartet
      dragRotate: false,
      pitchWithRotate: false,
      touchPitch: false,
    });
    map.touchZoomRotate.disableRotation();
    mapRef.current = map;

    map.on('load', () => {
      const ratio = window.devicePixelRatio || 1;
      for (const t of Object.keys(CACHE_TYPE_LABELS) as CacheType[]) {
        for (const found of [false, true]) {
          map.addImage(iconName(t, found), createIcon(t, found, ratio), { pixelRatio: ratio });
        }
      }

      map.addSource('caches', { type: 'geojson', data: EMPTY });
      map.addLayer({
        id: 'caches',
        type: 'symbol',
        source: 'caches',
        layout: {
          'icon-image': ['get', 'icon'],
          'icon-allow-overlap': true,
          'icon-ignore-placement': true,
          'symbol-sort-key': ['get', 'sort'],
        },
        paint: { 'icon-opacity': ['case', ['get', 'dimmed'], 0.5, 1] },
      });

      map.addSource('selected', { type: 'geojson', data: EMPTY });
      map.addLayer({
        id: 'selected',
        type: 'circle',
        source: 'selected',
        paint: {
          'circle-radius': ICON_SIZE / 2 + 4,
          'circle-color': 'rgba(0,0,0,0)',
          'circle-stroke-color': '#f39200',
          'circle-stroke-width': 3,
        },
      });

      map.addSource('me', { type: 'geojson', data: EMPTY });
      map.addLayer({
        id: 'me',
        type: 'circle',
        source: 'me',
        paint: {
          'circle-radius': 8,
          'circle-color': '#1a73e8',
          'circle-stroke-color': '#fff',
          'circle-stroke-width': 3,
        },
      });

      map.on('click', (e: MapMouseEvent) => {
        // Etwas Toleranz um den Fingertipp herum
        const box: [PointLike, PointLike] = [
          [e.point.x - 12, e.point.y - 12],
          [e.point.x + 12, e.point.y + 12],
        ];
        const hit = map.queryRenderedFeatures(box, { layers: ['caches'] })[0];
        setSelected(hit ? (hit.properties.code as string) : null);
      });

      setMapReady(true);
    });

    map.on('moveend', () => {
      const c = map.getCenter();
      setLastView({ lng: c.lng, lat: c.lat, zoom: map.getZoom() });
    });

    return () => {
      map.remove();
      mapRef.current = null;
    };
  }, []);

  // Marker aktualisieren
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !mapReady || caches === null) return;
    (map.getSource('caches') as GeoJSONSource).setData(cachesToGeoJSON(visible));
  }, [mapReady, visible, caches]);

  // Beim ersten Öffnen auf alle Caches zoomen
  const fitted = useRef(getLastView() !== null);
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !mapReady || fitted.current || visible.length === 0) return;
    fitted.current = true;
    const bounds = new maplibregl.LngLatBounds();
    for (const c of visible) bounds.extend([c.lon, c.lat]);
    map.fitBounds(bounds, { padding: 50, maxZoom: 15, duration: 0 });
  }, [mapReady, visible]);

  // Eigener Standort
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !mapReady) return;
    (map.getSource('me') as GeoJSONSource).setData(
      pos
        ? { type: 'FeatureCollection', features: [{ type: 'Feature', geometry: { type: 'Point', coordinates: [pos.lon, pos.lat] }, properties: {} }] }
        : EMPTY,
    );
  }, [mapReady, pos?.lat, pos?.lon]);

  const selectedCache = selected ? visible.find((c) => c.code === selected) ?? null : null;

  // Auswahl-Ring
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !mapReady) return;
    (map.getSource('selected') as GeoJSONSource).setData(
      selectedCache
        ? { type: 'FeatureCollection', features: [{ type: 'Feature', geometry: { type: 'Point', coordinates: [selectedCache.lon, selectedCache.lat] }, properties: {} }] }
        : EMPTY,
    );
  }, [mapReady, selectedCache]);

  const centerOnMe = () => {
    const map = mapRef.current;
    if (!map || !pos) return;
    map.easeTo({ center: [pos.lon, pos.lat], zoom: Math.max(map.getZoom(), 15) });
  };

  const updateFilters = (f: Filters) => {
    setFilters(f);
    saveFilters(f);
  };

  const total = caches?.length ?? 0;
  const subtitle = caches === null ? 'Lade …' : visible.length === total ? `${total} Caches` : `${visible.length} von ${total} Caches`;

  return (
    <div class="screen map-screen">
      <Header
        title="Karte"
        subtitle={subtitle}
        onBack={onBack}
        actions={
          total > 0 && (
            <button
              class={`icon-btn ${!isDefault(filters) ? 'icon-btn-active' : ''}`}
              onClick={() => setShowFilters(!showFilters)}
              aria-label="Filter"
              aria-expanded={showFilters}
            >
              <svg width="24" height="24" viewBox="0 0 24 24" aria-hidden="true">
                <path d="M3 5h18l-7 8.5V20l-4-2v-4.5z" fill="currentColor" />
              </svg>
            </button>
          )
        }
      />

      <div class="map-wrap">
        <div ref={container} class="map" />

        {showFilters && (
          <div class="map-overlay-top">
            <FilterPanel filters={filters} availableTypes={availableTypes} onChange={updateFilters} />
          </div>
        )}

        {!online && <div class="map-banner">Offline – Kartenbilder werden nicht geladen. Caches bleiben sichtbar.</div>}

        {caches !== null && total === 0 && (
          <div class="map-banner">
            Noch keine Caches gespeichert.{' '}
            <button class="text-btn" onClick={onImport}>Importieren</button>
          </div>
        )}

        <button class="map-locate" onClick={centerOnMe} disabled={!pos} aria-label="Auf meinen Standort zentrieren">
          <svg width="24" height="24" viewBox="0 0 24 24" aria-hidden="true">
            <circle cx="12" cy="12" r="4" fill="currentColor" />
            <path d="M12 2v3M12 19v3M2 12h3M19 12h3" stroke="currentColor" stroke-width="2" stroke-linecap="round" />
            <circle cx="12" cy="12" r="7.5" fill="none" stroke="currentColor" stroke-width="2" />
          </svg>
        </button>

        {selectedCache && (
          <div class="map-sheet">
            <div class="map-sheet-head">
              <TypeIcon type={selectedCache.type} found={selectedCache.found} dimmed={!selectedCache.available || selectedCache.archived} />
              <div class="cache-main">
                <div class={`cache-name ${selectedCache.archived ? 'archived' : ''}`}>{selectedCache.name}</div>
                <div class="cache-meta">
                  {selectedCache.code} · D {formatRating(selectedCache.difficulty)} · T {formatRating(selectedCache.terrain)}
                  {selectedCache.container && ` · ${selectedCache.container}`}
                </div>
              </div>
              {pos && <div class="cache-dist">{formatDistance(distance(pos, selectedCache))}</div>}
            </div>
            <div class="map-sheet-actions">
              <button class="secondary-btn" onClick={() => onDetails(selectedCache.code)}>Details</button>
              <button class="primary-btn" onClick={() => onNavigate(selectedCache.code)}>Navigieren</button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
