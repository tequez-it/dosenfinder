import { useEffect, useRef, useState } from 'preact/hooks';
import { getDetails, getSummary } from '../db';
import { bearing, cardinal, distance, formatDistance } from '../geo';
import { formatCoords } from '../format';
import { nextRotation } from '../compass';
import { usePosition } from '../hooks/usePosition';
import { useHeading } from '../hooks/useHeading';
import { useWakeLock } from '../hooks/useWakeLock';
import { Header } from '../components/Header';
import type { LatLon } from '../geo';

interface Props {
  code: string;
  waypoint?: string;
  onBack: () => void;
}

interface Target extends LatLon {
  title: string;
  subtitle: string;
}

type Loaded = Target | null | 'missing';

export function Navigate({ code, waypoint, onBack }: Props) {
  const [target, setTarget] = useState<Loaded>(null);
  const position = usePosition();
  const { state: heading, requestPermission } = useHeading();
  const wakeLock = useWakeLock();
  const rotation = useRef(0);

  useEffect(() => {
    (async () => {
      const summary = await getSummary(code);
      if (!summary) return setTarget('missing');
      if (!waypoint) {
        return setTarget({ lat: summary.lat, lon: summary.lon, title: summary.name, subtitle: summary.code });
      }
      const wp = (await getDetails(code))?.waypoints.find((w) => w.code === waypoint);
      if (!wp || wp.lat === null || wp.lon === null) return setTarget('missing');
      setTarget({ lat: wp.lat, lon: wp.lon, title: wp.name, subtitle: `${wp.code} · ${summary.name}` });
    })().catch(() => setTarget('missing'));
  }, [code, waypoint]);

  if (target === null) return <div class="screen"><Header title="Navigation" onBack={onBack} /></div>;
  if (target === 'missing') {
    return (
      <div class="screen">
        <Header title="Navigation" onBack={onBack} />
        <div class="empty">Ziel nicht gefunden oder ohne Koordinaten.</div>
      </div>
    );
  }

  const pos = position.status === 'ok' ? position.pos : null;
  const dist = pos ? distance(pos, target) : null;
  const brg = pos ? bearing(pos, target) : null;
  const hasCompass = heading.status === 'ok';

  // Mit Kompass: Pfeil relativ zur Blickrichtung. Ohne: relativ zu Norden.
  if (brg !== null) {
    const wanted = hasCompass ? brg - heading.heading : brg;
    rotation.current = nextRotation(rotation.current, wanted);
  }

  return (
    <div class="screen nav-screen">
      <Header title={target.title} subtitle={target.subtitle} onBack={onBack} />

      <div class="nav-coords">{formatCoords(target.lat, target.lon)}</div>

      <div class="nav-distance">{dist !== null ? formatDistance(dist) : '–'}</div>
      <div class="nav-bearing">
        {brg !== null ? `${Math.round(brg)}° ${cardinal(brg)}` : position.status === 'denied' ? 'Kein Standortzugriff' : 'Suche GPS …'}
      </div>

      <div class={`nav-arrow-wrap ${brg === null ? 'nav-arrow-off' : ''}`}>
        {!hasCompass && <div class="nav-north">N</div>}
        <svg
          class="nav-arrow"
          viewBox="0 0 200 200"
          style={{ transform: `rotate(${rotation.current}deg)` }}
          aria-label={brg !== null ? `Richtung ${Math.round(brg)} Grad` : 'Richtung unbekannt'}
        >
          <path d="M100 14 L156 176 L100 146 L44 176 Z" fill="var(--accent)" stroke="#000" stroke-width="4" stroke-linejoin="round" />
        </svg>
      </div>

      <CompassStatus state={heading.status} onEnable={requestPermission} />

      <dl class="info nav-info">
        <dt>Genauigkeit</dt>
        <dd>{position.status === 'ok' ? `± ${Math.round(position.accuracy)} m` : '–'}</dd>
        <dt>Mein Standort</dt>
        <dd>{pos ? formatCoords(pos.lat, pos.lon) : '–'}</dd>
        {hasCompass && (
          <>
            <dt>Blickrichtung</dt>
            <dd>{`${Math.round(heading.heading)}° ${cardinal(heading.heading)}`}</dd>
          </>
        )}
      </dl>

      <p class="nav-note">
        {wakeLock ? 'Das Display bleibt während der Navigation an.' : 'Tipp: Display anlassen – im Hintergrund pausiert das GPS.'}
      </p>
    </div>
  );
}

function CompassStatus({ state, onEnable }: { state: string; onEnable: () => void }) {
  switch (state) {
    case 'needs-permission':
      return (
        <div class="content">
          <button class="primary-btn" onClick={onEnable}>Kompass aktivieren</button>
          <p class="nav-hint">Ohne Kompass zeigt der Pfeil die Richtung, wenn du nach Norden schaust.</p>
        </div>
      );
    case 'denied':
      return <p class="nav-hint">Kompass nicht freigegeben. Der Pfeil zeigt die Richtung, wenn du nach Norden schaust. Zum Freigeben die App neu öffnen.</p>;
    case 'unsupported':
      return <p class="nav-hint">Kein Kompass verfügbar. Der Pfeil zeigt die Richtung, wenn du nach Norden schaust.</p>;
    case 'pending':
      return <p class="nav-hint">Warte auf Kompass …</p>;
    default:
      return null;
  }
}
