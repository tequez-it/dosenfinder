import { useEffect, useMemo, useRef, useState } from 'preact/hooks';
import { deleteOwnWaypoint, getDetails, getFieldNote, getSummary, getUserData, saveNote, saveOwnWaypoint, setCorrectedCoords } from '../db';
import { attributeName } from '../attributes';
import { CoordsEditor } from '../components/CoordsEditor';
import { FIELD_NOTE_TYPES, type FieldNote } from '../fieldnotes';
import { bearing, cardinal, distance, formatDistance, formatRating, type LatLon } from '../geo';
import { formatCoords, formatDate, rot13 } from '../format';
import { sanitizeHtml } from '../sanitize';
import { usePosition } from '../hooks/usePosition';
import { Header } from '../components/Header';
import { TypeIcon } from '../components/TypeIcon';
import { CACHE_TYPE_LABELS, type CacheDetails, type CacheLog, type CacheSummary, type UserData, type Waypoint } from '../types';

interface Props {
  code: string;
  onBack: () => void;
  /** ohne Argument = zum Cache, sonst zum Wegpunkt mit diesem Code */
  onNavigate: (waypoint?: string) => void;
  onLog: () => void;
  /** Karte mit diesem Cache (optional Wegpunkt) als Ziel */
  onShowMap: (waypoint?: string) => void;
}

type Tab = 'details' | 'description' | 'logs' | 'waypoints';

type Loaded = { summary: CacheSummary; details: CacheDetails | undefined; note: FieldNote | undefined; user: UserData } | null | 'missing';

/** Zuletzt gewählter Reiter – bleibt beim Wechsel Details ↔ Navigation erhalten */
let lastTab: { code: string; tab: Tab } | null = null;

export function CacheDetail({ code, onBack, onNavigate, onLog, onShowMap }: Props) {
  const [data, setData] = useState<Loaded>(null);
  const [tab, setTabState] = useState<Tab>(() => (lastTab?.code === code ? lastTab.tab : 'details'));
  const touch = useRef<{ x: number; y: number } | null>(null);
  const setTab = (t: Tab) => {
    lastTab = { code, tab: t };
    setTabState(t);
    window.scrollTo(0, 0);
  };
  const position = usePosition();

  const reload = () =>
    Promise.all([getSummary(code), getDetails(code), getFieldNote(code), getUserData(code)])
      .then(([summary, details, note, user]) => setData(summary ? { summary, details, note, user } : 'missing'))
      .catch(() => setData('missing'));

  useEffect(() => {
    void reload();
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

  const { summary: c, details: d, note, user } = data;
  const allWaypoints: Waypoint[] = [...(d?.waypoints ?? []), ...user.ownWaypoints];
  const pos = position.status === 'ok' ? position.pos : null;

  const tabs: { id: Tab; label: string }[] = [
    { id: 'details', label: 'Details' },
    { id: 'description', label: 'Beschreibung' },
    { id: 'logs', label: `Logbuch${d?.logs.length ? ` (${d.logs.length})` : ''}` },
    { id: 'waypoints', label: `Wegpunkte${allWaypoints.length ? ` (${allWaypoints.length})` : ''}` },
  ];

  // Wischen nach links/rechts wechselt den Reiter – wie in c:geo
  const onTouchStart = (e: TouchEvent) => {
    const t = e.touches[0];
    touch.current = { x: t.clientX, y: t.clientY };
  };
  const onTouchEnd = (e: TouchEvent) => {
    const start = touch.current;
    touch.current = null;
    if (!start) return;
    const t = e.changedTouches[0];
    const dx = t.clientX - start.x;
    const dy = t.clientY - start.y;
    if (Math.abs(dx) < 70 || Math.abs(dy) > 50) return;
    const i = tabs.findIndex((x) => x.id === tab);
    const next = tabs[i + (dx < 0 ? 1 : -1)];
    if (next) setTab(next.id);
  };

  return (
    <div class="screen">
      <Header
        title={c.name}
        subtitle={c.code}
        onBack={onBack}
        actions={
          <>
            <button class="icon-btn" onClick={() => onShowMap()} aria-label="Auf Karte zeigen">
              <MapIcon />
            </button>
            <button class="icon-btn" onClick={() => onNavigate()} aria-label="Zum Cache navigieren">
              <NavIcon />
            </button>
          </>
        }
      />

      <nav class="tabs" role="tablist">
        {tabs.map((t) => (
          <button role="tab" aria-selected={tab === t.id} class={tab === t.id ? 'tab-on' : ''} onClick={() => setTab(t.id)}>
            {t.label}
          </button>
        ))}
      </nav>

      <div class="tab-body" onTouchStart={onTouchStart} onTouchEnd={onTouchEnd}>
        {tab === 'details' && (
          <DetailsTab c={c} d={d} note={note} user={user} pos={pos} onNavigate={onNavigate} onLog={onLog} onShowMap={onShowMap} onChanged={reload} />
        )}
        {tab === 'description' && <DescriptionTab d={d} />}
        {tab === 'logs' && <LogsTab d={d} />}
        {tab === 'waypoints' && (
          <WaypointsTab c={c} waypoints={allWaypoints} pos={pos} onNavigate={onNavigate} onShowMap={onShowMap} onChanged={reload} />
        )}
      </div>
    </div>
  );
}

function appleMapsUrl(lat: number, lon: number, name: string): string {
  return `https://maps.apple.com/?daddr=${lat},${lon}&q=${encodeURIComponent(name)}`;
}

function DetailsTab(props: {
  c: CacheSummary;
  d: CacheDetails | undefined;
  note: FieldNote | undefined;
  user: UserData;
  pos: LatLon | null;
  onNavigate: (wp?: string) => void;
  onLog: () => void;
  onShowMap: (wp?: string) => void;
  onChanged: () => void;
}) {
  const { c, d, note, user, pos, onNavigate, onLog, onShowMap, onChanged } = props;
  const [editCoords, setEditCoords] = useState(false);
  const listing = user.original ?? { lat: c.lat, lon: c.lon };
  return (
    <>
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
        {pos && <Row label="Entfernung" value={`${formatDistance(distance(pos, c))} ${cardinal(bearing(pos, c))}`} />}
        <Row label="Schwierigkeit" value={`${formatRating(c.difficulty)} von 5`} />
        <Row label="Gelände" value={`${formatRating(c.terrain)} von 5`} />
        {c.owner && <Row label="Besitzer" value={c.owner} />}
        {d?.placedAt && <Row label="Versteckt" value={formatDate(d.placedAt)} />}
        {d && (d.state || d.country) && <Row label="Region" value={[d.state, d.country].filter(Boolean).join(', ')} />}
        <Row label="Koordinaten" value={`${formatCoords(c.lat, c.lon)}${c.corrected ? ' (korrigiert)' : ''}`} />
        {c.corrected && user.original && <Row label="Listing" value={formatCoords(user.original.lat, user.original.lon)} />}
        {c.found && <Row label="Status" value="Gefunden ✓" />}
      </dl>

      {editCoords ? (
        <div class="content">
          <CoordsEditor
            initial={{ lat: c.lat, lon: c.lon }}
            base={listing}
            baseLabel="Listing-Koordinaten"
            pos={pos}
            onCancel={() => setEditCoords(false)}
            onSave={async (coords) => {
              await setCorrectedCoords(c.code, coords);
              setEditCoords(false);
              onChanged();
            }}
          />
        </div>
      ) : (
        <div class="content coords-links">
          <button class="text-btn" onClick={() => setEditCoords(true)}>Koordinaten ändern</button>
          {c.corrected && (
            <button
              class="text-btn"
              onClick={async () => {
                await setCorrectedCoords(c.code, null);
                onChanged();
              }}
            >
              Original wiederherstellen
            </button>
          )}
        </div>
      )}

      <div class="content detail-actions">
        <button class="primary-btn" onClick={() => onNavigate()}>Navigieren</button>
        <button class="secondary-btn" onClick={onLog}>{note ? 'Field Note ändern' : 'Loggen'}</button>
      </div>
      <div class="content detail-actions detail-actions-2">
        <button class="secondary-btn" onClick={() => onShowMap()}>Auf Karte zeigen</button>
        <a class="secondary-btn" href={appleMapsUrl(c.lat, c.lon, c.name)} target="_blank" rel="noopener">
          Apple Karten
        </a>
      </div>

      {note && (
        <section class="section">
          <h2>Meine Field Note{note.exported ? ' (exportiert)' : ''}</h2>
          <div class="log">
            <div class="log-head">
              <span class={`log-type ${FIELD_NOTE_TYPES[note.type].cls}`}>{FIELD_NOTE_TYPES[note.type].label}</span>
              <span class="log-meta">{formatDate(note.date)}</span>
            </div>
            {note.text && <p class="plain log-text">{note.text}</p>}
          </div>
        </section>
      )}

      <NoteBox code={c.code} note={user.note} onChanged={onChanged} />

      {d && d.attributes.length > 0 && (
        <section class="section">
          <h2>Attribute</h2>
          <ul class="attributes">
            {d.attributes.map((a) => (
              <li class={a.inc ? '' : 'attr-no'}>{a.inc ? attributeName(a.name) : `Nicht: ${attributeName(a.name)}`}</li>
            ))}
          </ul>
        </section>
      )}

      {d?.hint && <HintBox hint={d.hint} />}
    </>
  );
}

function NoteBox({ code, note, onChanged }: { code: string; note: string; onChanged: () => void }) {
  const [editing, setEditing] = useState(false);
  const [text, setText] = useState(note);
  return (
    <section class="section">
      <h2>Persönliche Notiz</h2>
      {editing ? (
        <>
          <textarea class="field" rows={5} value={text} onInput={(e) => setText((e.target as HTMLTextAreaElement).value)} placeholder="Lösungsweg, Zwischenergebnisse, Erinnerungen …" />
          <div class="detail-actions">
            <button class="secondary-btn" onClick={() => { setText(note); setEditing(false); }}>Abbrechen</button>
            <button
              class="primary-btn"
              onClick={async () => {
                await saveNote(code, text);
                setEditing(false);
                onChanged();
              }}
            >
              Speichern
            </button>
          </div>
        </>
      ) : (
        <button class="note-view" onClick={() => setEditing(true)}>
          {note ? <span class="plain">{note}</span> : <span class="muted">Tippen, um eine Notiz anzulegen</span>}
        </button>
      )}
    </section>
  );
}

function HintBox({ hint }: { hint: string }) {
  const [open, setOpen] = useState(false);
  return (
    <section class="section">
      <h2>Hinweis</h2>
      <button class="hint" onClick={() => setOpen(!open)} aria-pressed={open}>
        <span>{open ? hint : rot13(hint)}</span>
        <span class="hint-toggle">{open ? 'Verschlüsseln' : 'Entschlüsseln'}</span>
      </button>
    </section>
  );
}

function DescriptionTab({ d }: { d: CacheDetails | undefined }) {
  const shortHtml = useMemo(() => (d?.shortDescriptionHtml ? sanitizeHtml(d.shortDescription) : ''), [d]);
  const longHtml = useMemo(() => (d?.longDescriptionHtml ? sanitizeHtml(d.longDescription) : ''), [d]);
  if (!d || !(d.shortDescription.trim() || d.longDescription.trim())) {
    return <div class="empty">Keine Beschreibung gespeichert.</div>;
  }
  return (
    <>
      <section class="section section-first">
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
      {d.hint && <HintBox hint={d.hint} />}
    </>
  );
}

function LogsTab({ d }: { d: CacheDetails | undefined }) {
  if (!d || d.logs.length === 0) return <div class="empty">Keine Logs in der importierten Datei.</div>;
  return (
    <section class="section section-first">
      <ul class="logs">
        {d.logs.map((l) => (
          <LogItem log={l} />
        ))}
      </ul>
      <p class="nav-hint">Pocket Queries enthalten nur die letzten Logs.</p>
    </section>
  );
}

function WaypointsTab(props: {
  c: CacheSummary;
  waypoints: Waypoint[];
  pos: LatLon | null;
  onNavigate: (wp?: string) => void;
  onShowMap: (wp?: string) => void;
  onChanged: () => void;
}) {
  const { c, waypoints, pos, onNavigate, onShowMap, onChanged } = props;
  // null = kein Formular, 'new' = neuer Wegpunkt, sonst Code des bearbeiteten
  const [editing, setEditing] = useState<string | null>(null);
  const [name, setName] = useState('');
  const [comment, setComment] = useState('');
  const editWp = editing && editing !== 'new' ? waypoints.find((w) => w.code === editing) : undefined;

  const startEdit = (w?: Waypoint) => {
    setEditing(w ? w.code : 'new');
    setName(w?.name ?? `Eigener Wegpunkt ${waypoints.filter((x) => x.own).length + 1}`);
    setComment(w?.comment ?? '');
    window.scrollTo(0, 0);
  };

  if (editing) {
    return (
      <section class="section section-first">
        <h2>{editing === 'new' ? 'Wegpunkt hinzufügen' : 'Wegpunkt bearbeiten'}</h2>
        <label class="filter-section-title" for="wp-name">Name</label>
        <input id="wp-name" class="field" value={name} onInput={(e) => setName((e.target as HTMLInputElement).value)} />
        <label class="filter-section-title" for="wp-comment">Notiz</label>
        <input id="wp-comment" class="field" value={comment} onInput={(e) => setComment((e.target as HTMLInputElement).value)} />
        <div class="filter-section-title">Koordinaten</div>
        <CoordsEditor
          initial={editWp && editWp.lat !== null && editWp.lon !== null ? { lat: editWp.lat, lon: editWp.lon } : null}
          base={{ lat: c.lat, lon: c.lon }}
          baseLabel="Cache-Koordinaten"
          pos={pos}
          onCancel={() => setEditing(null)}
          onSave={async (coords) => {
            await saveOwnWaypoint(c.code, {
              code: editWp?.code ?? `EIGEN${Date.now().toString(36).toUpperCase()}`,
              name: name.trim() || 'Eigener Wegpunkt',
              type: 'Eigener Wegpunkt',
              lat: coords.lat,
              lon: coords.lon,
              comment: comment.trim(),
            });
            setEditing(null);
            onChanged();
          }}
        />
      </section>
    );
  }

  return (
    <section class="section section-first">
      <button class="secondary-btn add-wp" onClick={() => startEdit()}>+ Wegpunkt hinzufügen</button>
      {waypoints.length === 0 && <div class="empty">Keine Wegpunkte.</div>}
      <ul class="waypoints">
        {waypoints.map((w) => {
          const has = w.lat !== null && w.lon !== null;
          return (
            <li class={w.own ? 'wp-own' : ''}>
              <div class="wp-main">
                <div class="wp-name">{w.name}</div>
                <div class="wp-meta">
                  {w.own ? 'Eigener Wegpunkt' : `${w.code} · ${w.type}`}
                  {has && pos ? ` · ${formatDistance(distance(pos, { lat: w.lat!, lon: w.lon! }))}` : ''}
                </div>
                <div class="wp-meta">{has ? formatCoords(w.lat!, w.lon!) : 'Keine Koordinaten'}</div>
                {w.comment && <div class="wp-comment">{w.comment}</div>}
                {w.own && (
                  <div class="wp-own-actions">
                    <button class="text-btn" onClick={() => startEdit(w)}>Bearbeiten</button>
                    <button
                      class="text-btn danger"
                      onClick={async () => {
                        await deleteOwnWaypoint(c.code, w.code);
                        onChanged();
                      }}
                    >
                      Löschen
                    </button>
                  </div>
                )}
              </div>
              {has && (
                <div class="wp-actions">
                  <button class="icon-btn" onClick={() => onShowMap(w.code)} aria-label={`${w.name} auf Karte zeigen`}>
                    <MapIcon />
                  </button>
                  <button class="icon-btn" onClick={() => onNavigate(w.code)} aria-label={`Zu ${w.name} navigieren`}>
                    <NavIcon />
                  </button>
                </div>
              )}
            </li>
          );
        })}
      </ul>
    </section>
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

function MapIcon() {
  return (
    <svg width="24" height="24" viewBox="0 0 24 24" aria-hidden="true">
      <path d="M4 6l5-2 6 2 5-2v14l-5 2-6-2-5 2z" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round" />
      <path d="M9 4v14M15 6v14" stroke="currentColor" stroke-width="2" />
    </svg>
  );
}

function NavIcon() {
  return (
    <svg width="24" height="24" viewBox="0 0 24 24" aria-hidden="true">
      <path d="M12 2l7 19-7-4-7 4z" fill="currentColor" />
    </svg>
  );
}
