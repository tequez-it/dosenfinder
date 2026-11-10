# Hinweise für Claude

- Sprache in UI, Kommentaren, Commits und PRs: Deutsch.
- Öffentliches Repo: niemals Secrets, echte GPX-/Pocket-Query-Daten, Server-Details oder fremde Logos/Marken committen. Testdaten nur erfunden in `testdata/`.
- Keine inoffiziellen geocaching.com-Zugriffe (kein Login, kein Scraping). Daten kommen nur aus Dateien, die der Nutzer importiert.
- Der Nutzer programmiert nicht selbst: erst Ansatz besprechen, Code erst nach seinem „go“. Nur bauen, was angefragt ist – Erweiterungen vorschlagen statt einbauen.
- Vor jedem PR: `npm test` und `npm run build` müssen grün sein; UI mit Playwright im iPhone-Format prüfen.
- Ziel-Gerät: iPhone, Safari, als Homescreen-App. Design dunkel, angelehnt an c:geo, eigene Icons.
- Hosting: GitHub Pages unter `/dosenfinder/` (siehe `base` in `vite.config.ts`).
