import { useCallback, useEffect, useState } from 'preact/hooks';
import { angleDelta, smoothAngle } from '../compass';

export type HeadingState =
  | { status: 'pending' }
  /** iOS: braucht einen Tipp des Nutzers, bevor der Kompass läuft */
  | { status: 'needs-permission' }
  | { status: 'denied' }
  | { status: 'unsupported' }
  /** accuracy: Abweichung in Grad laut iOS, null = unbekannt, -1 = nicht kalibriert */
  | { status: 'ok'; heading: number; accuracy: number | null };

type IOSOrientationEvent = DeviceOrientationEvent & {
  webkitCompassHeading?: number;
  webkitCompassAccuracy?: number;
};
type PermissionFn = () => Promise<'granted' | 'denied'>;

/** Glättung pro Messwert: klein genug gegen Zittern, groß genug, um nicht hinterherzuhinken */
const SMOOTHING = 0.4;
/** Änderungen darunter lösen kein neues Zeichnen aus */
const MIN_CHANGE_DEG = 0.5;

function screenAngle(): number {
  return (screen.orientation?.angle ?? 0) % 360;
}

/**
 * Blickrichtung des Geräts in Grad (0 = Norden).
 * iOS liefert sie als webkitCompassHeading, Android über deviceorientationabsolute.
 * Messwerte kommen sehr oft (bis 60×/s); gezeichnet wird höchstens einmal pro Bildschirm-Frame.
 */
export function useHeading(): { state: HeadingState; requestPermission: () => void } {
  const needsPermission =
    typeof DeviceOrientationEvent !== 'undefined' &&
    typeof (DeviceOrientationEvent as unknown as { requestPermission?: PermissionFn }).requestPermission === 'function';

  const [state, setState] = useState<HeadingState>(needsPermission ? { status: 'needs-permission' } : { status: 'pending' });
  const [listening, setListening] = useState(!needsPermission);

  useEffect(() => {
    if (!listening) return;
    if (typeof window === 'undefined' || !('DeviceOrientationEvent' in window)) {
      setState({ status: 'unsupported' });
      return;
    }

    let smoothed: number | null = null;
    let shown: number | null = null;
    let accuracy: number | null = null;
    let frame = 0;

    const commit = () => {
      frame = 0;
      if (smoothed === null) return;
      if (shown !== null && Math.abs(angleDelta(shown, smoothed)) < MIN_CHANGE_DEG) return;
      shown = smoothed;
      setState({ status: 'ok', heading: smoothed, accuracy });
    };

    const update = (raw: number) => {
      const h = (raw + screenAngle() + 360) % 360;
      smoothed = smoothed === null ? h : smoothAngle(smoothed, h, SMOOTHING);
      if (!frame) frame = requestAnimationFrame(commit);
    };

    const onIOS = (e: Event) => {
      const ev = e as IOSOrientationEvent;
      if (typeof ev.webkitCompassHeading === 'number' && ev.webkitCompassHeading >= 0) {
        accuracy = typeof ev.webkitCompassAccuracy === 'number' ? ev.webkitCompassAccuracy : null;
        update(ev.webkitCompassHeading);
      }
    };
    const onAbsolute = (e: Event) => {
      const a = (e as DeviceOrientationEvent).alpha;
      if (typeof a === 'number') update(360 - a);
    };

    window.addEventListener('deviceorientation', onIOS);
    window.addEventListener('deviceorientationabsolute', onAbsolute);

    // Kommt nach 3 s nichts, hat das Gerät keinen nutzbaren Kompass
    const timer = window.setTimeout(() => {
      if (smoothed === null) setState({ status: 'unsupported' });
    }, 3000);

    return () => {
      window.clearTimeout(timer);
      if (frame) cancelAnimationFrame(frame);
      window.removeEventListener('deviceorientation', onIOS);
      window.removeEventListener('deviceorientationabsolute', onAbsolute);
    };
  }, [listening]);

  const requestPermission = useCallback(() => {
    const fn = (DeviceOrientationEvent as unknown as { requestPermission?: PermissionFn }).requestPermission;
    if (!fn) {
      setListening(true);
      return;
    }
    fn()
      .then((r) => {
        if (r === 'granted') {
          setState({ status: 'pending' });
          setListening(true);
        } else {
          setState({ status: 'denied' });
        }
      })
      .catch(() => setState({ status: 'denied' }));
  }, []);

  return { state, requestPermission };
}
