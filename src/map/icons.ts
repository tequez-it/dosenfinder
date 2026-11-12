import { TYPE_STYLE } from '../components/TypeIcon';
import type { CacheType } from '../types';

/** Pixelgröße eines Markers auf der Karte (CSS-Pixel) */
export const ICON_SIZE = 30;

export function iconName(type: CacheType, found: boolean): string {
  return `cache-${type}${found ? '-found' : ''}`;
}

/**
 * Zeichnet die Typ-Symbole (gleiche Optik wie in der Liste) als Bilder für die Karte.
 * Gezeichnet wird in Geräteauflösung, damit sie auf dem iPhone scharf sind.
 */
export function createIcon(type: CacheType, found: boolean, pixelRatio: number): ImageData {
  const size = Math.round(ICON_SIZE * pixelRatio);
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d')!;
  ctx.scale(pixelRatio, pixelRatio);

  const s = TYPE_STYLE[type];
  // Kasten mit dunklem Rand, damit er auf hellen Karten auffällt
  ctx.fillStyle = s.color;
  ctx.strokeStyle = 'rgba(0,0,0,0.75)';
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.roundRect(2, 2, 24, 24, 6);
  ctx.fill();
  ctx.stroke();

  ctx.fillStyle = '#fff';
  ctx.font = '700 11px -apple-system, system-ui, sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(s.label, 14, 14.5);

  if (found) {
    ctx.fillStyle = '#fff';
    ctx.strokeStyle = '#000';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.arc(24, 24, 5.5, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    ctx.strokeStyle = '#1f8a4c';
    ctx.lineWidth = 1.8;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.beginPath();
    ctx.moveTo(21.4, 24.2);
    ctx.lineTo(23.3, 26.1);
    ctx.lineTo(26.8, 22.4);
    ctx.stroke();
  }

  return ctx.getImageData(0, 0, size, size);
}
