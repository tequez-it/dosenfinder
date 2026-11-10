import { useEffect, useState } from 'preact/hooks';
import { Home } from './screens/Home';
import { CacheList } from './screens/CacheList';
import { ImportScreen } from './screens/ImportScreen';
import { CacheDetail } from './screens/CacheDetail';
import { Navigate } from './screens/Navigate';
import { hashFor, parseHash, type Route } from './routes';

export function App() {
  const [route, setRoute] = useState<Route>(() => parseHash(location.hash));

  useEffect(() => {
    const onHash = () => {
      setRoute(parseHash(location.hash));
      window.scrollTo(0, 0);
    };
    window.addEventListener('hashchange', onHash);
    return () => window.removeEventListener('hashchange', onHash);
  }, []);

  const go = (r: Route) => {
    location.hash = hashFor(r);
  };

  switch (route.name) {
    case 'list':
      return <CacheList onBack={() => go({ name: 'home' })} onImport={() => go({ name: 'import' })} />;
    case 'import':
      return <ImportScreen onBack={() => go({ name: 'home' })} onShowList={() => go({ name: 'list' })} />;
    case 'cache':
      return (
        <CacheDetail
          key={route.code}
          code={route.code}
          onBack={() => go({ name: 'list' })}
          onNavigate={(waypoint) => go({ name: 'nav', code: route.code, waypoint })}
        />
      );
    case 'nav':
      return (
        <Navigate
          key={`${route.code}/${route.waypoint ?? ''}`}
          code={route.code}
          waypoint={route.waypoint}
          onBack={() => go({ name: 'cache', code: route.code })}
        />
      );
    default:
      return <Home onList={() => go({ name: 'list' })} onImport={() => go({ name: 'import' })} />;
  }
}
