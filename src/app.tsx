import { useEffect, useState } from 'preact/hooks';
import { Home } from './screens/Home';
import { CacheList } from './screens/CacheList';
import { ImportScreen } from './screens/ImportScreen';

type Route = 'home' | 'list' | 'import';

/** Einfaches Hash-Routing: #/liste, #/import – leer = Startseite. */
function routeFromHash(): Route {
  const h = location.hash.replace(/^#\/?/, '');
  if (h === 'liste') return 'list';
  if (h === 'import') return 'import';
  return 'home';
}

const HASH: Record<Route, string> = { home: '', list: '#/liste', import: '#/import' };

export function App() {
  const [route, setRoute] = useState<Route>(routeFromHash);

  useEffect(() => {
    const onHash = () => setRoute(routeFromHash());
    window.addEventListener('hashchange', onHash);
    return () => window.removeEventListener('hashchange', onHash);
  }, []);

  const go = (r: Route) => {
    if (r === 'home') {
      history.pushState(null, '', location.pathname);
      setRoute('home');
    } else {
      location.hash = HASH[r];
    }
  };

  switch (route) {
    case 'list':
      return <CacheList onBack={() => go('home')} onImport={() => go('import')} />;
    case 'import':
      return <ImportScreen onBack={() => go('home')} onShowList={() => go('list')} />;
    default:
      return <Home onList={() => go('list')} onImport={() => go('import')} />;
  }
}
