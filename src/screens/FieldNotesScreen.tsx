import { useEffect, useState } from 'preact/hooks';
import { deleteExportedFieldNotes, getAllFieldNotes, getAllSummaries, markFieldNotesExported } from '../db';
import { buildFieldNotesText, encodeUtf16le, FIELD_NOTE_TYPES, type FieldNote } from '../fieldnotes';
import { formatDate } from '../format';
import { Header } from '../components/Header';
import { TypeIcon } from '../components/TypeIcon';
import { hashFor } from '../routes';
import { shareOrDownload } from '../share';
import type { CacheSummary } from '../types';

interface Props {
  onBack: () => void;
}

const FILE_NAME = 'geocache_visits.txt';

export function FieldNotesScreen({ onBack }: Props) {
  const [notes, setNotes] = useState<FieldNote[] | null>(null);
  const [caches, setCaches] = useState<Map<string, CacheSummary>>(new Map());
  const [includeExported, setIncludeExported] = useState(false);
  const [message, setMessage] = useState('');
  const [confirmDelete, setConfirmDelete] = useState(false);

  const load = async () => {
    const [n, s] = await Promise.all([getAllFieldNotes(), getAllSummaries()]);
    setNotes(n.sort((a, b) => b.date.localeCompare(a.date)));
    setCaches(new Map(s.map((c) => [c.code, c])));
  };

  useEffect(() => {
    void load();
  }, []);

  if (!notes) return <div class="screen"><Header title="Field Notes" onBack={onBack} /></div>;

  const toExport = notes.filter((n) => includeExported || !n.exported);
  const exportedCount = notes.filter((n) => n.exported).length;

  const doExport = async () => {
    setMessage('');
    const result = await shareOrDownload(encodeUtf16le(buildFieldNotesText(toExport)), FILE_NAME, 'text/plain', 'Field Notes');
    if (result === 'cancelled') return;
    await markFieldNotesExported(toExport.map((n) => n.code));
    setMessage(`${toExport.length} Field Note${toExport.length === 1 ? '' : 's'} exportiert.`);
    await load();
  };

  const doDelete = async () => {
    const count = await deleteExportedFieldNotes();
    setConfirmDelete(false);
    setMessage(`${count} exportierte Field Note${count === 1 ? '' : 's'} gelöscht.`);
    await load();
  };

  return (
    <div class="screen">
      <Header title="Field Notes" subtitle={`${notes.length - exportedCount} neu · ${exportedCount} exportiert`} onBack={onBack} />

      {notes.length === 0 ? (
        <div class="empty">
          <p>Noch keine Field Notes.</p>
          <p>Öffne einen Cache und tippe auf „Loggen“.</p>
        </div>
      ) : (
        <>
          <div class="content">
            <button class="primary-btn" disabled={toExport.length === 0} onClick={doExport}>
              {toExport.length === 0 ? 'Nichts Neues zu exportieren' : `${toExport.length} exportieren`}
            </button>
            {exportedCount > 0 && (
              <label class="check-row">
                <input type="checkbox" checked={includeExported} onChange={(e) => setIncludeExported((e.target as HTMLInputElement).checked)} />
                Bereits exportierte erneut mitnehmen
              </label>
            )}
            {message && <p class="status status-ok">{message}</p>}
          </div>

          <ul class="cache-list">
            {notes.map((n) => {
              const c = caches.get(n.code);
              const t = FIELD_NOTE_TYPES[n.type];
              return (
                <li key={n.code}>
                  <a class="cache-row" href={hashFor({ name: 'log', code: n.code })}>
                    {c ? <TypeIcon type={c.type} /> : <TypeIcon type="other" />}
                    <div class="cache-main">
                      <div class="cache-name">{c?.name ?? n.code}</div>
                      <div class="cache-meta">
                        <span class={t.cls}>{t.label}</span> · {formatDate(n.date)} · {n.code}
                      </div>
                      {n.text && <div class="cache-meta">{n.text}</div>}
                    </div>
                    {n.exported && <span class="badge">exportiert</span>}
                  </a>
                </li>
              );
            })}
          </ul>

          <details class="howto content">
            <summary>So kommen die Logs auf geocaching.com</summary>
            <ol>
              <li>Hier auf „exportieren“ tippen und die Datei in „Dateien“ sichern (oder per Mail/AirDrop an den PC schicken).</li>
              <li>Auf geocaching.com die Datei als Field Notes / Drafts hochladen (Hilfe-Artikel „Upload drafts (field notes)“).</li>
              <li>Dort jeden Entwurf öffnen, Text prüfen und den Log abschicken.</li>
              <li>Danach hier „Exportierte löschen“.</li>
            </ol>
          </details>

          {exportedCount > 0 && (
            <div class="content danger-zone">
              {!confirmDelete ? (
                <button class="text-btn danger" onClick={() => setConfirmDelete(true)}>Exportierte löschen</button>
              ) : (
                <div class="confirm">
                  <span>{exportedCount} exportierte Field Notes vom Handy löschen?</span>
                  <button class="text-btn danger" onClick={doDelete}>Ja, löschen</button>
                  <button class="text-btn" onClick={() => setConfirmDelete(false)}>Abbrechen</button>
                </div>
              )}
            </div>
          )}
        </>
      )}
    </div>
  );
}
