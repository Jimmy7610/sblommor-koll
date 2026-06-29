# 🌸 Blompasset
**S-blommor · Uddevalla/Kuröd** — Privat sommarjobbs-dashboard

## Funktioner
- **Start** — Översikt, nästa pass, Blombilen-status, snabbknappar
- **Blombilen** — Packlista för morgondagens blommor med platser & prioriteter
- **Pass** — Lägg till, redigera och markera arbetspass
- **Lön** — Automatisk beräkning av brutto, OB, semesterersättning och nettolön
- **Inställningar** — Löneinställningar, Google Sync, platsregister

## Kom igång

### 1. GitHub Pages
1. Skapa ett nytt privat GitHub-repo
2. Ladda upp alla filer
3. Aktivera GitHub Pages (Settings → Pages → Deploy from branch: main)
4. Öppna URL:en på din iPhone och lägg till på hemskärmen

### 2. Google Apps Script (valfritt men rekommenderat)
1. Öppna [script.google.com](https://script.google.com) och skapa ett nytt projekt
2. Klistra in koden från `apps-script/Code.gs`
3. Klicka **Kör → `onOpen`** för att ge behörigheter
4. Kör **`initSheets()`** för att skapa Google Sheet-arken
5. Kör **`setPin()`** och ange din PIN-kod
6. Gå till **Distribuera → Ny distribution → Webb-app**
   - Kör som: **Jag**
   - Åtkomst: **Alla**
7. Kopiera webb-app-URL:en
8. I Blompasset → Inställningar → klistra in URL och PIN

### Löneinställningar (Uddevalla-standard)
- Timlön: din avtalade lön
- Skatt: ~30% (beror på din inkomst)
- Semesterersättning: 12%

## Filstruktur
```
index.html          — Huvud-HTML
styles.css          — All styling
manifest.webmanifest — PWA-manifest
sw.js               — Service worker (offline)
js/
  app.js            — Entry point
  state.js          — State management
  storage.js        — localStorage
  sync.js           — Google Sync
  ui.js             — Modal, toast, alerts
  router.js         — Tab-navigation
  dates.js          — Datum-utilities
  salary.js         — Löneuträkning
  validation.js     — Formulärvalidering
  exports.js        — JSON/CSV-export
  modules/
    dashboard.js    — Startsida
    blombilen.js    — Packlista
    shifts.js       — Arbetspass
    salaryView.js   — Lönerapport
    settings.js     — Inställningar
    places.js       — Platsregister
    calendar.js     — Kalendervy
    reports.js      — Rapporthjälpare
apps-script/
  Code.gs           — Google Apps Script
```

## Säkerhet
- PIN lagras aldrig i GitHub-koden
- PIN lagras i Google Apps Script Properties (servern)
- Script-URL och PIN lagras lokalt i webbläsaren (localStorage)
- Ingen autentiseringsserver behövs
