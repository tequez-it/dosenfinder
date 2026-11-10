import { CACHE_TYPE_LABELS, type CacheType } from '../types';
import { DEFAULT_FILTERS, type Filters, type FoundFilter } from '../filters';
import { TypeIcon } from './TypeIcon';

interface Props {
  filters: Filters;
  /** Typen, die in den Daten überhaupt vorkommen */
  availableTypes: CacheType[];
  onChange: (f: Filters) => void;
}

const STEPS = [1, 1.5, 2, 2.5, 3, 3.5, 4, 4.5, 5];
const fmt = (n: number) => String(n).replace('.', ',');

function RangeRow(props: {
  label: string;
  min: number;
  max: number;
  onChange: (min: number, max: number) => void;
}) {
  const { label, min, max, onChange } = props;
  return (
    <div class="filter-row">
      <span class="filter-label">{label}</span>
      <select value={min} onChange={(e) => {
        const v = Number((e.target as HTMLSelectElement).value);
        onChange(v, Math.max(v, max));
      }}>
        {STEPS.map((s) => <option value={s}>{fmt(s)}</option>)}
      </select>
      <span class="filter-sep">bis</span>
      <select value={max} onChange={(e) => {
        const v = Number((e.target as HTMLSelectElement).value);
        onChange(Math.min(v, min), v);
      }}>
        {STEPS.map((s) => <option value={s}>{fmt(s)}</option>)}
      </select>
    </div>
  );
}

const FOUND_OPTIONS: { value: FoundFilter; label: string }[] = [
  { value: 'all', label: 'Alle' },
  { value: 'open', label: 'Nicht gefunden' },
  { value: 'found', label: 'Gefunden' },
];

export function FilterPanel({ filters, availableTypes, onChange }: Props) {
  const toggleType = (t: CacheType) => {
    const types = filters.types.includes(t) ? filters.types.filter((x) => x !== t) : [...filters.types, t];
    onChange({ ...filters, types });
  };

  return (
    <div class="filter-panel">
      <div class="filter-section-title">Typ</div>
      <div class="chips">
        {availableTypes.map((t) => (
          <button
            class={`chip ${filters.types.includes(t) ? 'chip-on' : ''}`}
            onClick={() => toggleType(t)}
            aria-pressed={filters.types.includes(t)}
          >
            <TypeIcon type={t} size={20} />
            {CACHE_TYPE_LABELS[t]}
          </button>
        ))}
      </div>

      <div class="filter-section-title">Wertung</div>
      <RangeRow label="D" min={filters.dMin} max={filters.dMax} onChange={(dMin, dMax) => onChange({ ...filters, dMin, dMax })} />
      <RangeRow label="T" min={filters.tMin} max={filters.tMax} onChange={(tMin, tMax) => onChange({ ...filters, tMin, tMax })} />

      <div class="filter-section-title">Status</div>
      <div class="segmented">
        {FOUND_OPTIONS.map((o) => (
          <button
            class={filters.found === o.value ? 'seg-on' : ''}
            onClick={() => onChange({ ...filters, found: o.value })}
          >
            {o.label}
          </button>
        ))}
      </div>

      <button class="text-btn" onClick={() => onChange(DEFAULT_FILTERS)}>
        Filter zurücksetzen
      </button>
    </div>
  );
}
