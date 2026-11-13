import { useState } from 'preact/hooks';
import { createList, deleteList, renameList } from '../db';
import { useLists } from '../hooks/useLists';
import { Header } from '../components/Header';

interface Props {
  onBack: () => void;
}

/** Eigene Listen anlegen, umbenennen, löschen. */
export function ListsScreen({ onBack }: Props) {
  const state = useLists();
  const [newName, setNewName] = useState('');
  const [editing, setEditing] = useState<string | null>(null);
  const [editName, setEditName] = useState('');
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);

  const add = async () => {
    if (!newName.trim()) return;
    await createList(newName);
    setNewName('');
    await state.reload();
  };

  return (
    <div class="screen">
      <Header title="Listen" subtitle={`${state.lists.length} eigene Listen`} onBack={onBack} />
      <div class="content">
        <p class="muted">
          Listen sortieren deine Caches, z. B. „Urlaub Harz“ oder „Mysteries gelöst“. Ein Cache kann in mehreren Listen
          liegen. Löschen einer Liste löscht keine Caches.
        </p>
        <div class="list-add">
          <input
            class="field"
            value={newName}
            placeholder="Name der neuen Liste"
            onInput={(e) => setNewName((e.target as HTMLInputElement).value)}
            onKeyDown={(e) => e.key === 'Enter' && add()}
            aria-label="Name der neuen Liste"
          />
          <button class="primary-btn" disabled={!newName.trim()} onClick={add}>Anlegen</button>
        </div>
      </div>

      <ul class="cache-list">
        {state.lists.map((l) => (
          <li key={l.id} class="list-item">
            {editing === l.id ? (
              <div class="list-edit">
                <input class="field" value={editName} onInput={(e) => setEditName((e.target as HTMLInputElement).value)} aria-label="Neuer Name" />
                <button class="text-btn" onClick={() => setEditing(null)}>Abbrechen</button>
                <button
                  class="text-btn"
                  onClick={async () => {
                    await renameList(l.id, editName);
                    setEditing(null);
                    await state.reload();
                  }}
                >
                  Speichern
                </button>
              </div>
            ) : confirmDelete === l.id ? (
              <div class="confirm">
                <span>Liste „{l.name}“ löschen? Die Caches bleiben erhalten.</span>
                <button
                  class="text-btn danger"
                  onClick={async () => {
                    await deleteList(l.id);
                    setConfirmDelete(null);
                    await state.reload();
                  }}
                >
                  Ja, löschen
                </button>
                <button class="text-btn" onClick={() => setConfirmDelete(null)}>Abbrechen</button>
              </div>
            ) : (
              <div class="list-row">
                <div class="cache-main">
                  <div class="cache-name">{l.name}</div>
                  <div class="cache-meta">{state.countFor(l.id)} Caches</div>
                </div>
                <button class="text-btn" onClick={() => { setEditing(l.id); setEditName(l.name); }}>Umbenennen</button>
                <button class="text-btn danger" onClick={() => setConfirmDelete(l.id)}>Löschen</button>
              </div>
            )}
          </li>
        ))}
      </ul>
      {state.lists.length === 0 && <div class="empty">Noch keine eigenen Listen.</div>}
    </div>
  );
}
