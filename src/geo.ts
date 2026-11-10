export interface LatLon {
  lat: number;
  lon: number;
}

const R = 6371000; // Erdradius in Metern
const rad = (d: number) => (d * Math.PI) / 180;
const deg = (r: number) => (r * 180) / Math.PI;

/** Entfernung in Metern (Haversine). */
export function distance(a: LatLon, b: LatLon): number {
  const dLat = rad(b.lat - a.lat);
  const dLon = rad(b.lon - a.lon);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.asin(Math.min(1, Math.sqrt(h)));
}

/** Richtung von a nach b in Grad (0 = Norden, im Uhrzeigersinn). */
export function bearing(a: LatLon, b: LatLon): number {
  const y = Math.sin(rad(b.lon - a.lon)) * Math.cos(rad(b.lat));
  const x =
    Math.cos(rad(a.lat)) * Math.sin(rad(b.lat)) -
    Math.sin(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.cos(rad(b.lon - a.lon));
  return (deg(Math.atan2(y, x)) + 360) % 360;
}

const CARDINALS = ['N', 'NO', 'O', 'SO', 'S', 'SW', 'W', 'NW'];

export function cardinal(deg: number): string {
  return CARDINALS[Math.round(deg / 45) % 8];
}

const nf1 = new Intl.NumberFormat('de-DE', { maximumFractionDigits: 1 });
const nf0 = new Intl.NumberFormat('de-DE', { maximumFractionDigits: 0 });

export function formatDistance(m: number): string {
  if (m < 1000) return `${m < 100 ? nf1.format(m) : nf0.format(m)} m`;
  if (m < 100000) return `${nf1.format(m / 1000)} km`;
  return `${nf0.format(m / 1000)} km`;
}

/** D/T-Wertung wie "2,5" */
export function formatRating(v: number | null): string {
  return v === null ? '?' : nf1.format(v);
}
