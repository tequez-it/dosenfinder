import { useEffect, useState } from 'preact/hooks';
import { deleteFieldNote, getFieldNote, getSummary, saveFieldNote } from '../db';
import { FIELD_NOTE_TYPES, fromLocalInput, toLocalInput, typesFor, type FieldNote, type FieldNoteType } from '../fieldnotes';
import { Header } from '../components/Header';
import type { CacheSummary } from '../types';

interface Props {
  code: string;
  onDone: () => void;
}

type Loaded = { summary: CacheSummary | undefined; existing: FieldNote | undefined } | null;

/** Field Note für einen Cache anlegen oder bearbeiten. */
export function LogScreen({ code, onDone }: Props) {
  const [data, setData] = useState<Loaded>(null);
  const [type, setType] = useState<FieldNoteType>('found');
  const [date, setDate] = useState(() => toLocalInput(new Date().toISOString()));
  const [text, setText] = useState('');
  const [busy, setBusy] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);

  useEffect(() => {
    Promise.all([getSummary(code), getFieldNote(code)]).then(([summary, existing]) => {
      setData({ summary, existing });
      if (existing) {
        setType(existing.type);
        setDate(toLocalInput(existing.date));
        setText(existing.text);
      } else if (summary) {
        setType(typesFor(summary.type)[0]);
      }
    });
  }, [code]);

  if (!data) return <div class="screen"><Header title="Loggen" onBack={onDone} /></div>;

  const options = data.summary ? typesFor(data.summary.type) : (Object.keys(FIELD_NOTE_TYPES) as FieldNoteType[]);

  const save = async () => {
    setBusy(true);
    await saveFieldNote({
      code,
      type,
      date: fromLocalInput(date),
      text,
      // Nach einer Änderung muss die Note erneut exportiert werden
      exported: false,
      updatedAt: Date.now(),
    });
    onDone();
  };

  const remove = async () => {
    await deleteFieldNote(code);
    onDone();
  };

  return (
    <div class="screen">
      <Header title={data.existing ? 'Field Note bearbeiten' : 'Loggen'} subtitle={data.summary?.name ?? code} onBack={onDone} />
      <div class="content">
        <div class="filter-section-title">Logtyp</div>
        <div class="log-types">
          {options.map((t) => (
            <button class={`log-type-btn ${type === t ? 'on' : ''}`} onClick={() => setType(t)} aria-pressed={type === t}>
              {FIELD_NOTE_TYPES[t].label}
            </button>
          ))}
        </div>

        <label class="filter-section-title" for="log-date">Datum und Uhrzeit</label>
        <input id="log-date" class="field" type="datetime-local" value={date} onInput={(e) => setDate((e.target as HTMLInputElement).value)} />

        <label class="filter-section-title" for="log-text">Text</label>
        <textarea
          id="log-text"
          class="field"
          rows={6}
          value={text}
          placeholder="Was du später als Log schreiben willst – du kannst ihn auf geocaching.com noch ändern."
          onInput={(e) => setText((e.target as HTMLTextAreaElement).value)}
        />

        <button class="primary-btn" disabled={busy} onClick={save}>Speichern</button>
        <p class="nav-hint log-info">
          Wird nur auf diesem Handy gespeichert. Hochladen auf geocaching.com über „Field Notes → Exportieren“.
        </p>

        {data.existing && (
          <div class="danger-zone">
            {!confirmDelete ? (
              <button class="text-btn danger" onClick={() => setConfirmDelete(true)}>Field Note löschen</button>
            ) : (
              <div class="confirm">
                <span>Diese Field Note wirklich löschen?</span>
                <button class="text-btn danger" onClick={remove}>Ja, löschen</button>
                <button class="text-btn" onClick={() => setConfirmDelete(false)}>Abbrechen</button>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
