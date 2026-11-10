import { useEffect, useMemo, useState } from 'preact/hooks';
import { getAllSummaries } from '../db';
import { bearing, cardinal, distance, formatDistance, formatRating } from '../geo';
import { isDefault, loadFilters, matches, saveFilters, type Filters } from '../filters';
import { usePosition } from '../hooks/usePosition';
import { Header } from '../components/Header';
import { TypeIcon } from '../components/TypeIcon';
import { FilterPanel } from '../components/FilterPanel';
import type { CacheSummary, CacheType } from '../types';

interface Props {
  onBack: () => void;
  onImport: () => void;
}

export function CacheList({ onBack, onImport }: Props) {
  const [caches, setCaches] = useState<CacheSummary[] | null>(null);
  const [filters, setFilters] = useState<Filters>(loadFilters);
  const [showFilters, setShowFilters] = useState(false);
  const position = usePosition();

  useEffect(() => {
    getAllSummaries().then(setCaches).catch(() => setCaches([]));
  }, []);

  const updateFilters = (f: Filters) => {
    setFilters(f);
    saveFilters(f);
  };

  const availableTypes = useMemo(() => {
    const set = new Set<CacheType>((caches ?? []).map((c) => c.type));
    return [...set].sort();
  }, [caches]);

  const pos = position.status === 'ok' ? position.pos : null;

  // Position auf ~10 m runden, damit die Liste nicht bei jedem GPS-Zucken neu sortiert
  const posKey = pos ? `${pos.lat.toFixed(4)},${pos.lon.toFixed(4)}` : '';

  const rows = useMemo(() => {
    if (!caches) return [];
    const filtered = caches.filter((c) => matches(c, filters));
    const withDist = filtered.map((c) => ({
      cache: c,
      dist: pos ? distance(pos, c) : null,
      dir: pos ? cardinal(bearing(pos, c)) : '',
    }));
    if (pos) withDist.sort((a, b) => a.dist! - b.dist!);
    else withDist.sort((a, b) => a.cache.name.localeCompare(b.cache.name, 'de'));
    return withDist;
  }, [caches, filters, posKey]);

  const total = caches?.length ?? 0;
  const subtitle = caches === null ? 'Lade …' : rows.length === total ? `${total} Caches` : `${rows.length} von ${total} Caches`;

  return (
    <div class="screen">
      <Header
        title="Caches"
        subtitle={subtitle}
        onBack={onBack}
        actions={
          total > 0 && (
            <button
              class={`icon-btn ${!isDefault(filters) ? 'icon-btn-active' : ''}`}
              onClick={() => setShowFilters(!showFilters)}
              aria-label="Filter"
              aria-expanded={showFilters}
            >
              <svg width="24" height="24" viewBox="0 0 24 24" aria-hidden="true">
                <path d="M3 5h18l-7 8.5V20l-4-2v-4.5z" fill="currentColor" />
              </svg>
            </button>
          )
        }
      />

      {showFilters && <FilterPanel filters={filters} availableTypes={availableTypes} onChange={updateFilters} />}

      <PositionHint state={position.status} />

      {caches !== null && total === 0 && (
        <div class="empty">
          <p>Noch keine Caches gespeichert.</p>
          <button class="primary-btn" onClick={onImport}>GPX importieren</button>
        </div>
      )}

      {total > 0 && rows.length === 0 && (
        <div class="empty">
          <p>Kein Cache passt zum Filter.</p>
        </div>
      )}

      <ul class="cache-list">
        {rows.map(({ cache: c, dist, dir }) => (
          <li class="cache-row" key={c.code}>
            <TypeIcon type={c.type} found={c.found} dimmed={!c.available || c.archived} />
            <div class="cache-main">
              <div class={`cache-name ${c.archived ? 'archived' : ''} ${!c.available ? 'disabled' : ''}`}>{c.name}</div>
              <div class="cache-meta">
                {c.code} · D {formatRating(c.difficulty)} · T {formatRating(c.terrain)}
                {c.container && ` · ${c.container}`}
                {c.archived ? ' · Archiviert' : !c.available ? ' · Deaktiviert' : ''}
              </div>
            </div>
            <div class="cache-dist">
              {dist !== null ? (
                <>
                  <div>{formatDistance(dist)}</div>
                  <div class="cache-dir">{dir}</div>
                </>
              ) : (
                <div class="cache-dir">–</div>
              )}
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}

function PositionHint({ state }: { state: string }) {
  if (state === 'ok') return null;
  const text: Record<string, string> = {
    pending: 'Suche GPS-Position …',
    denied: 'Kein Standortzugriff – Liste nach Name sortiert. Freigabe am iPhone: Einstellungen → Datenschutz & Sicherheit → Ortungsdienste → Safari-Websites.',
    unsupported: 'Dieses Gerät liefert keinen Standort – Liste nach Name sortiert.',
    error: 'GPS-Position nicht verfügbar – Liste nach Name sortiert.',
  };
  return <div class="position-hint">{text[state]}</div>;
}
