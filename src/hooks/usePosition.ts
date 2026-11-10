import { useEffect, useState } from 'preact/hooks';
import type { LatLon } from '../geo';

export type PositionState =
  | { status: 'pending' }
  | { status: 'unsupported' }
  | { status: 'denied' }
  | { status: 'error'; message: string }
  | { status: 'ok'; pos: LatLon; accuracy: number };

/** Laufende GPS-Position. Läuft nur, solange die Komponente sichtbar ist. */
export function usePosition(): PositionState {
  const [state, setState] = useState<PositionState>({ status: 'pending' });

  useEffect(() => {
    if (!('geolocation' in navigator)) {
      setState({ status: 'unsupported' });
      return;
    }
    const id = navigator.geolocation.watchPosition(
      (p) =>
        setState({
          status: 'ok',
          pos: { lat: p.coords.latitude, lon: p.coords.longitude },
          accuracy: p.coords.accuracy,
        }),
      (err) =>
        setState((prev) => {
          if (err.code === err.PERMISSION_DENIED) return { status: 'denied' };
          // Kurze Aussetzer (z. B. Timeout) nicht die letzte Position überschreiben lassen
          if (prev.status === 'ok') return prev;
          return { status: 'error', message: err.message };
        }),
      { enableHighAccuracy: true, maximumAge: 5000, timeout: 30000 },
    );
    return () => navigator.geolocation.clearWatch(id);
  }, []);

  return state;
}
