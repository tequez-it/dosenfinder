import { useEffect, useState } from 'preact/hooks';
import { getAllSummaries } from '../db';

interface Props {
  onList: () => void;
  onImport: () => void;
}

/** Startseite mit Kacheln, angelehnt an das c:geo-Hauptmenü. */
export function Home({ onList, onImport }: Props) {
  const [count, setCount] = useState<number | null>(null);

  useEffect(() => {
    getAllSummaries().then((c) => setCount(c.length)).catch(() => setCount(0));
  }, []);

  return (
    <div class="screen home">
      <header class="header home-header">
        <img src={`${import.meta.env.BASE_URL}icons/favicon.svg`} width="32" height="32" alt="" />
        <div class="header-title">Dosenfinder</div>
      </header>
      <div class="tiles">
        <button class="tile" onClick={onList}>
          <svg width="56" height="56" viewBox="0 0 56 56" aria-hidden="true">
            <rect x="4" y="4" width="48" height="48" rx="10" fill="#1f8a4c" />
            <path d="M15 19h26M15 28h26M15 37h18" stroke="#fff" stroke-width="4" stroke-linecap="round" />
          </svg>
          <span class="tile-label">Caches</span>
          <span class="tile-sub">{count === null ? '' : `${count} gespeichert`}</span>
        </button>
        <button class="tile" onClick={onImport}>
          <svg width="56" height="56" viewBox="0 0 56 56" aria-hidden="true">
            <rect x="4" y="4" width="48" height="48" rx="10" fill="#e07b00" />
            <path d="M28 14v20m-9-9l9 9 9-9M16 41h24" stroke="#fff" stroke-width="4" stroke-linecap="round" stroke-linejoin="round" fill="none" />
          </svg>
          <span class="tile-label">Importieren</span>
          <span class="tile-sub">GPX / Pocket Query</span>
        </button>
      </div>
      <p class="home-footer">Version {__APP_VERSION__}</p>
    </div>
  );
}
