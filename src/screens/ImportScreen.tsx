import { useRef, useState } from 'preact/hooks';
import { Header } from '../components/Header';
import { parseFile } from '../gpx/import';
import { GpxError } from '../gpx/parse';
import { clearAll, requestPersistentStorage, saveImport, type ImportStats } from '../db';

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
