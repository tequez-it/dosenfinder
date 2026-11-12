import { useEffect, useState } from 'preact/hooks';
import type { ComponentType } from 'preact';
import { Home } from './screens/Home';
import { CacheList } from './screens/CacheList';
import { ImportScreen } from './screens/ImportScreen';
import { CacheDetail } from './screens/CacheDetail';
import { Navigate } from './screens/Navigate';
import { Header } from './components/Header';
import { hashFor, parseHash, type Route } from './routes';

/*
 * Verlauf innerhalb der App mitschreiben. "Zurück" geht dadurch dorthin, wo man
 * herkam (z. B. Karte → Details → zurück zur Karte). Ist kein Verlauf da
 * (App frisch geöffnet), springt "Zurück" zur übergeordneten Seite.
 */
const trail: string[] = [location.hash || '#/'];

function trackHash(hash: string) {
  const h = hash || '#/';
  if (trail.length > 1 && trail[trail.length - 2] === h) trail.pop();
  else if (trail[trail.length - 1] !== h) trail.push(h);
}

function go(r: Route) {
  location.hash = hashFor(r);
}

function back(fallback: Route) {
  if (trail.length > 1) {
    history.back();
  } else {
    const h = hashFor(fallback);
    trail[0] = h;
    location.replace(h);
  }
}

// Die Karte (MapLibre, ~1 MB) erst laden, wenn sie gebraucht wird
type MapProps = {
  onBack: () => void;
  onDetails: (code: string) => void;
  onNavigate: (code: string) => void;
  onImport: () => void;
};
let MapScreenCache: ComponentType<MapProps> | null = null;

function LazyMap(props: MapProps) {
  const [Comp, setComp] = useState<ComponentType<MapProps> | null>(() => MapScreenCache);
  const [failed, setFailed] = useState(false);
  useEffect(() => {
    if (Comp) return;
    import('./screens/MapScreen')
      .then((m) => {
        MapScreenCache = m.MapScreen;
        setComp(() => m.MapScreen);
      })
      .catch(() => setFailed(true));
  }, []);
  if (Comp) return <Comp {...props} />;
  return (
    <div class="screen">
      <Header title="Karte" onBack={props.onBack} />
      <div class="empty">{failed ? 'Karte konnte nicht geladen werden.' : 'Lade Karte …'}</div>
    </div>
  );
}

export function App() {
  const [route, setRoute] = useState<Route>(() => parseHash(location.hash));

  useEffect(() => {
    const onHash = () => {
      trackHash(location.hash);
      setRoute(parseHash(location.hash));
      window.scrollTo(0, 0);
    };
    window.addEventListener('hashchange', onHash);
    return () => window.removeEventListener('hashchange', onHash);
  }, []);

  switch (route.name) {
    case 'list':
      return <CacheList onBack={() => back({ name: 'home' })} onImport={() => go({ name: 'import' })} />;
    case 'map':
      return (
        <LazyMap
          onBack={() => back({ name: 'home' })}
          onDetails={(code) => go({ name: 'cache', code })}
          onNavigate={(code) => go({ name: 'nav', code })}
          onImport={() => go({ name: 'import' })}
        />
      );
    case 'import':
      return <ImportScreen onBack={() => back({ name: 'home' })} onShowList={() => go({ name: 'list' })} />;
    case 'cache':
      return (
        <CacheDetail
          key={route.code}
          code={route.code}
          onBack={() => back({ name: 'list' })}
          onNavigate={(waypoint) => go({ name: 'nav', code: route.code, waypoint })}
        />
      );
    case 'nav':
      return (
        <Navigate
          key={`${route.code}/${route.waypoint ?? ''}`}
          code={route.code}
          waypoint={route.waypoint}
          onBack={() => back({ name: 'cache', code: route.code })}
        />
      );
    default:
      return <Home onList={() => go({ name: 'list' })} onMap={() => go({ name: 'map' })} onImport={() => go({ name: 'import' })} />;
  }
}
