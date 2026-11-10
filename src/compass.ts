/** Kleinster Winkelunterschied von a nach b, Ergebnis zwischen -180 und 180. */
export function angleDelta(a: number, b: number): number {
  return ((((b - a) % 360) + 540) % 360) - 180;
}

/** Glättet Kompasswerte, ohne beim Sprung 359° → 0° einmal herumzudrehen. */
export function smoothAngle(prev: number, next: number, factor: number): number {
  return (prev + angleDelta(prev, next) * factor + 360) % 360;
}

/**
 * Nächster Drehwinkel für den Pfeil. Er wird fortlaufend weitergezählt
 * (z. B. 350 → 370 statt 350 → 10), damit die CSS-Animation den kurzen Weg nimmt.
 */
export function nextRotation(current: number, target: number): number {
  return current + angleDelta(current, target);
}
