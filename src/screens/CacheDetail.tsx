import { useEffect, useMemo, useState } from 'preact/hooks';
import { getDetails, getSummary } from '../db';
import { distance, formatDistance, formatRating } from '../geo';
import { formatCoords, formatDate, rot13 } from '../format';
import { sanitizeHtml } from '../sanitize';
import { usePosition } from '../hooks/usePosition';
import { Header } from '../components/Header';
import { TypeIcon } from '../components/TypeIcon';
import { CACHE_TYPE_LABELS, type CacheDetails, type CacheLog, type CacheSummary } from '../types';

interface Props {
  code: string;
  onBack: () => void;
  /** ohne Argument = zum Cache, sonst zum Wegpunkt mit diesem Code */
  onNavigate: (waypoint?: string) => void;
}

type Loaded = { summary: CacheSummary; details: CacheDetails | undefined } | null | 'missing';

export function CacheDetail({ code, onBack, onNavigate }: Props) {
  const [data, setData] = useState<Loaded>(null);
  const position = usePosition();

  useEffect(() => {
    Promise.all([getSummary(code), getDetails(code)])
      .then(([summary, details]) => setData(summary ? { summary, details } : 'missing'))
      .catch(() => setData('missing'));
  }, [code]);

  if (data === null) return <div class="screen"><Header title={code} onBack={onBack} /></div>;
  if (data === 'missing') {
    return (
      <div class="screen">
        <Header title={code} onBack={onBack} />
        <div class="empty">Dieser Cache ist nicht (mehr) gespeichert.</div>
      </div>
    );
  }

  const { summary: c, details: d } = data;
  const pos = position.status === 'ok' ? position.pos : null;

  return (
    <div class="screen">
      <Header
        title={c.name}
        subtitle={c.code}
        onBack={onBack}
        actions={
          <button class="icon-btn" onClick={() => onNavigate()} aria-label="Zum Cache navigieren">
            <NavIcon />
          </button>
        }
      />

      <div class="detail-top">
        <TypeIcon type={c.type} found={c.found} dimmed={!c.available || c.archived} size={44} />
        <div class={`detail-name ${c.archived ? 'archived' : ''}`}>{c.name}</div>
      </div>

      {(c.archived || !c.available) && (
        <div class="banner banner-warn">{c.archived ? 'Dieser Cache ist archiviert.' : 'Dieser Cache ist deaktiviert.'}</div>
      )}

      <dl class="info">
        <Row label="Typ" value={c.typeLabel || CACHE_TYPE_LABELS[c.type]} />
        {c.container && <Row label="Größe" value={c.container} />}
        <Row label="Geocode" value={c.code} />
        {pos && <Row label="Entfernung" value={formatDistance(distance(pos, c))} />}
        <Row label="Schwierigkeit" value={`${formatRating(c.difficulty)} von 5`} />
        <Row label="Gelände" value={`${formatRating(c.terrain)} von 5`} />
        {c.owner && <Row label="Besitzer" value={c.owner} />}
        {d?.placedAt && <Row label="Versteckt" value={formatDate(d.placedAt)} />}
        {d && (d.state || d.country) && <Row label="Region" value={[d.state, d.country].filter(Boolean).join(', ')} />}
        <Row label="Koordinaten" value={formatCoords(c.lat, c.lon)} />
        {c.found && <Row label="Status" value="Gefunden ✓" />}
      </dl>

      <div class="content">
        <button class="primary-btn" onClick={() => onNavigate()}>Navigieren</button>
      </div>

      {d && <DetailSections d={d} onNavigate={onNavigate} />}
      {!d && <div class="empty">Keine Beschreibung gespeichert.</div>}
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <>
      <dt>{label}</dt>
      <dd>{value}</dd>
    </>
  );
}

function DetailSections({ d, onNavigate }: { d: CacheDetails; onNavigate: (wp?: string) => void }) {
  const [hintOpen, setHintOpen] = useState(false);
  const shortHtml = useMemo(() => (d.shortDescriptionHtml ? sanitizeHtml(d.shortDescription) : ''), [d]);
  const longHtml = useMemo(() => (d.longDescriptionHtml ? sanitizeHtml(d.longDescription) : ''), [d]);
  const hasDescription = d.shortDescription.trim() || d.longDescription.trim();

  return (
    <>
      {d.attributes.length > 0 && (
        <section class="section">
          <h2>Attribute</h2>
          <ul class="attributes">
            {d.attributes.map((a) => (
              <li class={a.inc ? '' : 'attr-no'}>{a.inc ? a.name : `Nicht: ${a.name}`}</li>
            ))}
          </ul>
        </section>
      )}

      {d.hint && (
        <section class="section">
          <h2>Hinweis</h2>
          <button class="hint" onClick={() => setHintOpen(!hintOpen)} aria-pressed={hintOpen}>
            <span>{hintOpen ? d.hint : rot13(d.hint)}</span>
            <span class="hint-toggle">{hintOpen ? 'Verschlüsseln' : 'Entschlüsseln'}</span>
          </button>
        </section>
      )}

      {hasDescription && (
        <section class="section">
          <h2>Beschreibung</h2>
          <div class="description">
            {d.shortDescription.trim() &&
              (d.shortDescriptionHtml ? (
                <div dangerouslySetInnerHTML={{ __html: shortHtml }} />
              ) : (
                <p class="plain">{d.shortDescription}</p>
              ))}
            {d.longDescription.trim() &&
              (d.longDescriptionHtml ? (
                <div dangerouslySetInnerHTML={{ __html: longHtml }} />
              ) : (
                <p class="plain">{d.longDescription}</p>
              ))}
          </div>
        </section>
      )}

      {d.waypoints.length > 0 && (
        <section class="section">
          <h2>Wegpunkte ({d.waypoints.length})</h2>
          <ul class="waypoints">
            {d.waypoints.map((w) => (
              <li>
                <div class="wp-main">
                  <div class="wp-name">{w.name}</div>
                  <div class="wp-meta">
                    {w.code} · {w.type}
                  </div>
                  <div class="wp-meta">{w.lat !== null && w.lon !== null ? formatCoords(w.lat, w.lon) : 'Keine Koordinaten'}</div>
                  {w.comment && <div class="wp-comment">{w.comment}</div>}
                </div>
                {w.lat !== null && w.lon !== null && (
                  <button class="icon-btn" onClick={() => onNavigate(w.code)} aria-label={`Zu ${w.name} navigieren`}>
                    <NavIcon />
                  </button>
                )}
              </li>
            ))}
          </ul>
        </section>
      )}

      {d.logs.length > 0 && (
        <section class="section">
          <h2>Logs ({d.logs.length})</h2>
          <ul class="logs">
            {d.logs.map((l) => (
              <LogItem log={l} />
            ))}
          </ul>
        </section>
      )}
    </>
  );
}

const LOG_TYPES: Record<string, { label: string; cls: string }> = {
  'found it': { label: 'Gefunden', cls: 'log-found' },
  "didn't find it": { label: 'Nicht gefunden', cls: 'log-dnf' },
  'write note': { label: 'Notiz', cls: '' },
  'attended': { label: 'Teilgenommen', cls: 'log-found' },
  'will attend': { label: 'Will teilnehmen', cls: '' },
  'webcam photo taken': { label: 'Webcam-Foto', cls: 'log-found' },
  'needs maintenance': { label: 'Wartung nötig', cls: 'log-dnf' },
  'owner maintenance': { label: 'Wartung durch Owner', cls: '' },
  'temporarily disable listing': { label: 'Deaktiviert', cls: 'log-dnf' },
  'enable listing': { label: 'Aktiviert', cls: '' },
  'archive': { label: 'Archiviert', cls: 'log-dnf' },
  'publish listing': { label: 'Veröffentlicht', cls: '' },
};

function LogItem({ log }: { log: CacheLog }) {
  const t = LOG_TYPES[log.type.toLowerCase()] ?? { label: log.type, cls: '' };
  return (
    <li class="log">
      <div class="log-head">
        <span class={`log-type ${t.cls}`}>{t.label}</span>
        <span class="log-meta">
          {formatDate(log.date)} · {log.finder}
        </span>
      </div>
      {log.text && <p class="plain log-text">{log.text}</p>}
    </li>
  );
}

function NavIcon() {
  return (
    <svg width="24" height="24" viewBox="0 0 24 24" aria-hidden="true">
      <path d="M12 2l7 19-7-4-7 4z" fill="currentColor" />
    </svg>
  );
}
