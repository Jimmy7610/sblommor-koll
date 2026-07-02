# 🌸 Blompasset
**S-blommor · Uddevalla/Kuröd** — Privat sommarjobbs-dashboard

Helt lokal PWA — ingen server, ingen synk, inga konton. All data trippel-sparas på enheten.

## Funktioner
- **Start** — Dagens berättelse: nästa pass, månadens skörd, Blombilen-status, snabbknappar
- **Blombilen** — Packlista för morgondagens blommor med platser & prioriteter
- **Pass** — Lägg till, redigera och markera arbetspass
- **Lön** — Automatisk beräkning av brutto, OB, semesterersättning och nettolön
- **Inställningar** — Löneinställningar, datasäkerhet, säkerhetskopior, platsregister

## Datasäkerhet (så förloras ingen data)
1. **localStorage** — snabb primärlagring, skrivs vid varje ändring
2. **IndexedDB** — oberoende kopia; om localStorage rensas återställs datan härifrån automatiskt vid nästa start
3. **Dagliga snapshots** — en automatisk säkerhetskopia per dag (7 dagar bakåt) med återställningsknapp i Inställningar
4. **Beständig lagring** — appen begär `navigator.storage.persist()` så att webbläsaren inte får rensa datan
5. **Export/Import** — ladda ned all data som JSON-fil när du vill

## Kom igång

### GitHub Pages
1. Skapa ett nytt privat GitHub-repo
2. Ladda upp alla filer
3. Aktivera GitHub Pages (Settings → Pages → Deploy from branch: main)
4. Öppna URL:en på din iPhone i Safari → Dela → **Lägg till på hemskärmen**

### Löneinställningar (Uddevalla-standard)
- Timlön: din avtalade lön
- Skatt: ~30% (beror på din inkomst)
- Semesterersättning: 12%

## Filstruktur
```
index.html          — Huvud-HTML (splash, appskal, parallaxscen)
styles.css          — Designsystem "Sommaräng"
manifest.webmanifest — PWA-manifest
sw.js               — Service worker (offline)
js/
  app.js            — Entry point & boot
  state.js          — State management (pub/sub)
  storage.js        — Trippel-lagring: localStorage + IndexedDB + snapshots
  effects.js        — Scroll-reveals, parallax, 3D-tilt, count-up
  ui.js             — Modal, toast, alerts, spar-indikator
  router.js         — Tab-navigation
  dates.js          — Datum-utilities
  salary.js         — Löneuträkning
  validation.js     — Formulärvalidering
  exports.js        — JSON/CSV-export
  modules/
    dashboard.js    — Startsida (dagens berättelse)
    blombilen.js    — Packlista
    shifts.js       — Arbetspass
    salaryView.js   — Lönerapport
    settings.js     — Inställningar & datasäkerhet
    places.js       — Platsregister
    calendar.js     — Kalendervy
    reports.js      — Rapporthjälpare
assets/icons/       — App-ikoner (SVG + PNG för iOS)
```
