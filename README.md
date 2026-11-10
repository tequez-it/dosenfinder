# Dosenfinder

Web-App (PWA) fürs iPhone, um Geocaches aus GPX-Dateien und Pocket Queries offline zu finden.
Bedienung und Look angelehnt an c:geo. Alle Daten bleiben auf dem Gerät – es gibt keinen Server und keinen Login.

**Stand 0.1.0:** Import (GPX / Pocket-Query-ZIP inkl. Wegpunkte), Cache-Liste nach Entfernung, Filter (Typ, D/T, gefunden).
Noch nicht: Cache-Details, Karte, Kompass/Navigation.

## Nutzung auf dem iPhone

1. Die App-Adresse in **Safari** öffnen.
2. Teilen-Symbol → **„Zum Home-Bildschirm“**. Nur so bleiben die Daten zuverlässig gespeichert.
3. In der App **Importieren** → Pocket-Query-ZIP oder GPX-Datei auswählen.

## Entwicklung

```bash
npm install
npm run dev      # lokaler Testserver
npm test         # Unit-Tests
npm run build    # Produktions-Build nach dist/
```

Technik: Vite, Preact, TypeScript, IndexedDB (`idb`), ZIP-Entpacken mit `fflate`, PWA über `vite-plugin-pwa`.

```
src/
  gpx/        GPX-Parser und Datei-Import (GPX + ZIP)
  screens/    Startseite, Liste, Import
  components/ Kopfleiste, Typ-Symbole, Filter
  db.ts       lokale Datenbank (IndexedDB)
  geo.ts      Entfernung, Richtung, Formatierung
  filters.ts  Filterlogik
testdata/     selbst erstellte, erfundene Testdaten
```

## Veröffentlichen

Jeder Merge auf `main` startet den Workflow `.github/workflows/pages.yml`: Tests, Build, Veröffentlichung auf GitHub Pages.
Einmalig nötig: Repo → Settings → Pages → Source: **GitHub Actions**.

## Regeln (öffentliches Repo)

- Keine Secrets, API-Keys oder Passwörter – auch nicht kurzzeitig (die Git-Historie behält alles).
- Keine echten GPX-/Pocket-Query-Dateien. Nur selbst erstellte Testdaten in `testdata/`.
- Keine Server-Details (Hostnamen, Pfade, Ports).
- Keine Logos oder Namen von geocaching.com oder c:geo.
