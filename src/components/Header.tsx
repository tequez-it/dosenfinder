import type { ComponentChildren } from 'preact';

interface Props {
  title: string;
  subtitle?: string;
  onBack?: () => void;
  actions?: ComponentChildren;
}

/** Kopfleiste im Stil von c:geo: dunkel, orange Linie unten. */
export function Header({ title, subtitle, onBack, actions }: Props) {
  return (
    <header class="header">
      {onBack && (
        <button class="icon-btn" onClick={onBack} aria-label="Zurück">
          <svg width="24" height="24" viewBox="0 0 24 24" aria-hidden="true">
            <path d="M20 11H7.8l5.6-5.6L12 4l-8 8 8 8 1.4-1.4L7.8 13H20z" fill="currentColor" />
          </svg>
        </button>
      )}
      <div class="header-titles">
        <div class="header-title">{title}</div>
        {subtitle && <div class="header-subtitle">{subtitle}</div>}
      </div>
      <div class="header-actions">{actions}</div>
    </header>
  );
}
