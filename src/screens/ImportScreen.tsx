import { useRef, useState } from 'preact/hooks';
import { Header } from '../components/Header';
import { parseFile } from '../gpx/import';
import { GpxError } from '../gpx/parse';
import { BackupError, clearAll, createBackup, requestPersistentStorage, restoreBackup, saveImport, type ImportStats } from '../db';
import { shareOrDownload } from '../share';

interface Props {
  onBack: () => void;
  onShowList: () => void;
}

const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`;

type Status =
  | { kind: 'idle' }
  | { kind: 'busy'; file: string }
  | { kind: 'done'; file: string; stats: ImportStats; total: number }
  | { kind: 'error'; message: string }
  | { kind: 'cleared' };

export function ImportScreen({ onBack, onShowList }: Props) {
  const input = useRef<HTMLInputElement>(null);
  const [status, setStatus] = useState<Status>({ kind: 'idle' });
  const [confirmClear, setConfirmClear] = useState(false);

  const onFile = async (e: Event) => {
    const el = e.target as HTMLInputElement;
    const file = el.files?.[0];
    el.value = ''; // gleiche Datei erneut wählbar
    if (!file) return;
    setStatus({ kind: 'busy', file: file.name });
    try {
      const parsed = await parseFile(file);
      if (parsed.caches.length === 0 && parsed.waypoints.length === 0) {
        setStatus({ kind: 'error', message: 'In der Datei wurden keine Caches gefunden.' });
        return;
      }
      const stats = await saveImport(parsed);
      void requestPersistentStorage();
      setStatus({ kind: 'done', file: file.name, stats, total: parsed.caches.length });
    } catch (err) {
      if (err instanceof GpxError) {
        setStatus({ kind: 'error', message: err.message });
      } else {
        console.error(err);
        setStatus({ kind: 'error', message: 'Import fehlgeschlagen. Ist das eine GPX- oder Pocket-Query-ZIP-Datei?' });
      }
    }
  };

  const doClear = async () => {
    await clearAll();
    setConfirmClear(false);
    setStatus({ kind: 'cleared' });
  };

  return (
    <div class="screen">
      <Header title="Importieren" onBack={onBack} />
      <div class="content">
        <p>
          Wähle eine <b>GPX-Datei</b> oder eine <b>Pocket-Query-ZIP</b> von geocaching.com. Die Caches werden nur auf
          diesem Gerät gespeichert.
        </p>

        <input ref={input} type="file" class="hidden-input" onChange={onFile} />
        <button class="primary-btn" disabled={status.kind === 'busy'} onClick={() => input.current?.click()}>
          {status.kind === 'busy' ? 'Importiere …' : 'Datei auswählen'}
        </button>

        {status.kind === 'busy' && <p class="status">Lese {status.file} …</p>}
        {status.kind === 'error' && <p class="status status-error">{status.message}</p>}
        {status.kind === 'cleared' && <p class="status">Alle Caches wurden gelöscht.</p>}
        {status.kind === 'done' && (
          <div class="status status-ok">
            <p>
              <b>{status.total}</b> Caches aus {status.file} gelesen:
            </p>
            <ul>
              <li>{status.stats.newCaches} neu</li>
              <li>{status.stats.updatedCaches} aktualisiert</li>
              {status.stats.waypointsAttached > 0 && (
                <li>{plural(status.stats.waypointsAttached, 'Wegpunkt', 'Wegpunkte')} zugeordnet</li>
              )}
              {status.stats.waypointsOrphaned > 0 && (
                <li>{plural(status.stats.waypointsOrphaned, 'Wegpunkt', 'Wegpunkte')} ohne passenden Cache übersprungen</li>
              )}
            </ul>
            <button class="primary-btn" onClick={onShowList}>Zur Liste</button>
          </div>
        )}

        <details class="howto">
          <summary>So kommst du an die Dateien</summary>
          <ol>
            <li>Auf geocaching.com eine Pocket Query anlegen (z. B. 500 Caches im Umkreis von 20 km).</li>
            <li>Wenn sie fertig ist, die ZIP-Datei auf dem iPhone herunterladen (landet in „Dateien → Downloads“).</li>
            <li>Hier auf „Datei auswählen“ tippen und die ZIP wählen – nicht entpacken nötig.</li>
            <li>
              Für bereits gefundene Caches zusätzlich die Pocket Query „Meine Funde“ importieren. Gefundene bleiben auch
              bei späteren Importen markiert.
            </li>
          </ol>
        </details>

        <BackupSection />

        <div class="danger-zone">
          {!confirmClear ? (
            <button class="text-btn danger" onClick={() => setConfirmClear(true)}>Alle Caches löschen</button>
          ) : (
            <div class="confirm">
              <span>Wirklich alle Caches von diesem Gerät löschen?</span>
              <button class="text-btn danger" onClick={doClear}>Ja, löschen</button>
              <button class="text-btn" onClick={() => setConfirmClear(false)}>Abbrechen</button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

/** Sicherung aller Daten als Datei – schützt vor Verlust, z. B. wenn die App vom Homescreen gelöscht wird. */
function BackupSection() {
  const input = useRef<HTMLInputElement>(null);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [busy, setBusy] = useState(false);

  const doBackup = async () => {
    setBusy(true);
    setMsg(null);
    try {
      const b = await createBackup();
      const date = b.exportedAt.slice(0, 10);
      const r = await shareOrDownload(JSON.stringify(b), `dosenfinder-sicherung-${date}.json`, 'application/json', 'Dosenfinder-Sicherung');
      if (r !== 'cancelled') {
        setMsg({ ok: true, text: `Sicherung erstellt: ${b.caches.length} Caches, ${b.fieldnotes.length} Field Notes, ${b.userdata.length} Caches mit eigenen Daten.` });
      }
    } catch {
      setMsg({ ok: false, text: 'Sicherung fehlgeschlagen.' });
    } finally {
      setBusy(false);
    }
  };

  const onFile = async (e: Event) => {
    const el = e.target as HTMLInputElement;
    const file = el.files?.[0];
    el.value = '';
    if (!file) return;
    setBusy(true);
    setMsg(null);
    try {
      const r = await restoreBackup(JSON.parse(await file.text()));
      setMsg({ ok: true, text: `Sicherung eingespielt: ${r.caches} Caches, ${r.fieldnotes} Field Notes, ${r.userdata} Caches mit eigenen Daten.` });
    } catch (err) {
      setMsg({ ok: false, text: err instanceof BackupError ? err.message : 'Die Datei konnte nicht gelesen werden.' });
    } finally {
      setBusy(false);
    }
  };

  return (
    <section class="backup">
      <h2 class="filter-section-title">Datensicherung</h2>
      <p class="muted">
        Sichert alle Caches, Field Notes, Notizen, korrigierten Koordinaten und eigenen Wegpunkte in eine Datei. Vor
        dem Löschen der App vom Homescreen unbedingt sichern.
      </p>
      <div class="detail-actions">
        <button class="secondary-btn" disabled={busy} onClick={doBackup}>Sicherung erstellen</button>
        <button class="secondary-btn" disabled={busy} onClick={() => input.current?.click()}>Einspielen</button>
      </div>
      <input ref={input} type="file" class="hidden-input" onChange={onFile} />
      {msg && <p class={`status ${msg.ok ? 'status-ok' : 'status-error'}`}>{msg.text}</p>}
    </section>
  );
}
