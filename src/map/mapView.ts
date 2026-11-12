/** Letzter Kartenausschnitt – damit die Karte nach "Details → Zurück" dort bleibt, wo sie war. */
export interface MapView {
  lng: number;
  lat: number;
  zoom: number;
}

let lastView: MapView | null = null;

export function getLastView(): MapView | null {
  return lastView;
}

export function setLastView(v: MapView): void {
  lastView = v;
}

/** Kartenstil: Standard-Kacheln von OpenStreetMap (nur online, keine Vorab-Downloads). */
export const OSM_STYLE = {
  version: 8 as const,
  sources: {
    osm: {
      type: 'raster' as const,
      tiles: ['https://tile.openstreetmap.org/{z}/{x}/{y}.png'],
      tileSize: 256,
      maxzoom: 19,
      attribution: '© <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener">OpenStreetMap</a>-Mitwirkende',
    },
  },
  layers: [{ id: 'osm', type: 'raster' as const, source: 'osm' }],
};
