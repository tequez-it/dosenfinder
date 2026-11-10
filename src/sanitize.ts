import DOMPurify from 'dompurify';

/*
 * Cache-Beschreibungen sind HTML von fremden Cache-Ownern. Bevor sie angezeigt
 * werden, entfernt DOMPurify alles Ausführbare (Skripte, Event-Handler,
 * javascript:-Links, eingebettete Seiten, Formulare).
 */

let hooked = false;

function ensureHook() {
  if (hooked) return;
  hooked = true;
  // Links immer in neuem Tab öffnen, ohne Zugriff auf unsere Seite
  DOMPurify.addHook('afterSanitizeAttributes', (node) => {
    if (node.tagName === 'A' && node.getAttribute('href')) {
      node.setAttribute('target', '_blank');
      node.setAttribute('rel', 'noopener noreferrer');
    }
  });
}

export function sanitizeHtml(html: string): string {
  ensureHook();
  return DOMPurify.sanitize(html, {
    FORBID_TAGS: ['style', 'iframe', 'frame', 'object', 'embed', 'form', 'input', 'button', 'textarea', 'select', 'link', 'meta', 'base'],
    FORBID_ATTR: ['srcset'],
  });
}
