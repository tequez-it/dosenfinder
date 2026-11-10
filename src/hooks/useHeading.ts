import { useCallback, useEffect, useRef, useState } from 'preact/hooks';
import { smoothAngle } from '../compass';

export type HeadingState =
  | { status: 'pending' }
  /** iOS: braucht einen Tipp des Nutzers, bevor der Kompass läuft */
  | { status: 'needs-permission' }
  | { status: 'denied' }
  | { status: 'unsupported' }
  | { status: 'ok'; heading: number };

type IOSOrientationEvent = DeviceOrientationEvent & { webkitCompassHeading?: number };
type PermissionFn = () => Promise<'granted' | 'denied'>;

function screenAngle(): number {
  return (screen.orientation?.angle ?? 0) % 360;
}

/**
 * Blickrichtung des Geräts in Grad (0 = Norden).
 * iOS liefert sie als webkitCompassHeading, Android über deviceorientationabsolute.
 */
export function useHeading(): { state: HeadingState; requestPermission: () => void } {
  const needsPermission =
    typeof DeviceOrientationEvent !== 'undefined' &&
    typeof (DeviceOrientationEvent as unknown as { requestPermission?: PermissionFn }).requestPermission === 'function';

  const [state, setState] = useState<HeadingState>(needsPermission ? { status: 'needs-permission' } : { status: 'pending' });
  const [listening, setListening] = useState(!needsPermission);
  const smoothed = useRef<number | null>(null);

  useEffect(() => {
    if (!listening) return;
    if (typeof window === 'undefined' || !('DeviceOrientationEvent' in window)) {
      setState({ status: 'unsupported' });
      return;
    }

    const update = (raw: number) => {
      const h = (raw + screenAngle() + 360) % 360;
      smoothed.current = smoothed.current === null ? h : smoothAngle(smoothed.current, h, 0.25);
      setState({ status: 'ok', heading: smoothed.current });
    };

    const onIOS = (e: Event) => {
      const h = (e as IOSOrientationEvent).webkitCompassHeading;
      if (typeof h === 'number' && h >= 0) update(h);
    };
    const onAbsolute = (e: Event) => {
      const a = (e as DeviceOrientationEvent).alpha;
      if (typeof a === 'number') update(360 - a);
    };

    window.addEventListener('deviceorientation', onIOS);
    window.addEventListener('deviceorientationabsolute', onAbsolute);

    // Kommt nach 3 s nichts, hat das Gerät keinen nutzbaren Kompass
    const timer = window.setTimeout(() => {
      if (smoothed.current === null) setState({ status: 'unsupported' });
    }, 3000);

    return () => {
      window.clearTimeout(timer);
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
