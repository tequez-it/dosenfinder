import type { ListsState } from '../hooks/useLists';
import { hashFor } from '../routes';

interface Props {
  state: ListsState;
  total: number;
}

/** Auswahl der eigenen Liste (wie die Listen-Auswahl in c:geo). */
export function ListPicker({ state, total }: Props) {
  const { lists, active, setActive, countFor } = state;
  return (
    <select
      class="list-picker"
      value={active}
      aria-label="Liste"
      onChange={(e) => {
        const v = (e.target as HTMLSelectElement).value;
        if (v === '__manage') {
          (e.target as HTMLSelectElement).value = active;
          location.hash = hashFor({ name: 'lists' });
          return;
        }
        setActive(v);
      }}
    >
      <option value="">Alle Caches ({total})</option>
      {lists.map((l) => (
        <option value={l.id}>
          {l.name} ({countFor(l.id)})
        </option>
      ))}
      <option value="__manage">Listen verwalten …</option>
    </select>
  );
}
