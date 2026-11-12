import type { CacheType } from '../types';

export const TYPE_STYLE: Record<CacheType, { color: string; label: string }> = {
  traditional: { color: '#1f8a4c', label: 'Tr' },
  multi: { color: '#e07b00', label: 'Mu' },
  mystery: { color: '#1d5fb4', label: '?' },
  letterbox: { color: '#16758f', label: 'Lb' },
  wherigo: { color: '#6a5acd', label: 'Wi' },
  earth: { color: '#8a5a2b', label: 'Ea' },
  virtual: { color: '#0096a8', label: 'Vi' },
  webcam: { color: '#5d7a8c', label: 'Wc' },
  event: { color: '#c5262c', label: 'Ev' },
  other: { color: '#6b6b6b', label: '·' },
};

interface Props {
  type: CacheType;
  found?: boolean;
  dimmed?: boolean;
  size?: number;
}

/** Eigenes, schlichtes Typ-Symbol: Farbe nach üblicher Cache-Farbe plus Kürzel. */
export function TypeIcon({ type, found = false, dimmed = false, size = 34 }: Props) {
  const s = TYPE_STYLE[type];
  return (
    <svg width={size} height={size} viewBox="0 0 34 34" class="type-icon" style={{ opacity: dimmed ? 0.45 : 1 }} aria-hidden="true">
      <rect x="1" y="1" width="28" height="28" rx="7" fill={s.color} />
      <text x="15" y="20" text-anchor="middle" font-size="12" font-weight="700" fill="#fff" font-family="-apple-system, system-ui, sans-serif">
        {s.label}
      </text>
      {found && (
        <g>
          <circle cx="27.5" cy="27.5" r="6.5" fill="#fff" stroke="#000" stroke-width="1" />
          <path d="M24.3 27.7l2.2 2.2 4.2-4.4" fill="none" stroke="#1f8a4c" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" />
        </g>
      )}
    </svg>
  );
}
