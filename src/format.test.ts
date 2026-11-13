import { describe, expect, it } from 'vitest';
import { formatCoords, formatDate, rot13 } from './format';
import { angleDelta, nextRotation, smoothAngle } from './compass';
import { sanitizeHtml } from './sanitize';
import { hashFor, parseHash } from './routes';

describe('formatCoords', () => {
  it('Geocaching-Format', () => {
    expect(formatCoords(52.50947, 13.37270)).toBe("N 52° 30.568' E 013° 22.362'");
    expect(formatCoords(-33.5, -70.25)).toBe("S 33° 30.000' W 070° 15.000'");
    expect(formatCoords(50.9999999, 10)).toBe("N 51° 00.000' E 010° 00.000'");
  });
});

describe('rot13 & Datum', () => {
  it('rot13 ist umkehrbar und lässt Umlaute/Zahlen stehen', () => {
    expect(rot13('Unter dem Stein 3')).toBe('Hagre qrz Fgrva 3');
    expect(rot13(rot13('Hinter Baum, ä ö ü'))).toBe('Hinter Baum, ä ö ü');
  });
  it('formatDate', () => {
    expect(formatDate('2019-04-12T00:00:00')).toBe('12.04.2019');
    expect(formatDate('kaputt')).toBe('kaputt');
  });
});

describe('Kompass-Mathematik', () => {
  it('angleDelta nimmt den kurzen Weg', () => {
    expect(angleDelta(350, 10)).toBe(20);
    expect(angleDelta(10, 350)).toBe(-20);
    expect(angleDelta(0, 180)).toBe(-180);
  });
  it('nextRotation zählt fortlaufend weiter', () => {
    expect(nextRotation(350, 10)).toBe(370);
    expect(nextRotation(720, -10)).toBe(710);
  });
  it('smoothAngle über die Nordgrenze', () => {
    expect(smoothAngle(350, 10, 0.5)).toBe(0);
  });
});

describe('sanitizeHtml', () => {
  it('entfernt Skripte, Event-Handler und javascript:-Links', () => {
    const out = sanitizeHtml(
      '<p onclick="alert(1)">Hallo</p><script>alert(2)</script><a href="javascript:alert(3)">x</a><iframe src="https://example.invalid"></iframe><img src="x.png" onerror="alert(4)">',
    );
    expect(out).not.toMatch(/script|onclick|onerror|javascript:|iframe/i);
    expect(out).toContain('<p>Hallo</p>');
    expect(out).toContain('<img src="x.png">');
  });
  it('öffnet Links in neuem Tab', () => {
    expect(sanitizeHtml('<a href="https://example.invalid">x</a>')).toContain('rel="noopener noreferrer"');
  });
});

describe('Routing', () => {
  it('parseHash / hashFor', () => {
    expect(parseHash('')).toEqual({ name: 'home' });
    expect(parseHash('#/liste')).toEqual({ name: 'list' });
    expect(parseHash('#/karte')).toEqual({ name: 'map' });
    expect(hashFor({ name: 'map' })).toBe('#/karte');
    expect(parseHash('#/fieldnotes')).toEqual({ name: 'fieldnotes' });
    expect(parseHash('#/listen')).toEqual({ name: 'lists' });
    expect(hashFor({ name: 'lists' })).toBe('#/listen');
    expect(parseHash('#/log/GCTEST1')).toEqual({ name: 'log', code: 'GCTEST1' });
    expect(parseHash('#/cache/GCTEST1')).toEqual({ name: 'cache', code: 'GCTEST1' });
    expect(parseHash('#/nav/GCTEST2/PKTEST2')).toEqual({ name: 'nav', code: 'GCTEST2', waypoint: 'PKTEST2' });
    expect(hashFor({ name: 'nav', code: 'GCTEST2' })).toBe('#/nav/GCTEST2');
  });
});
