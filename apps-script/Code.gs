/**
 * Blompasset — Google Apps Script Backend
 * =========================================
 * Driftsätt som "Webb-app" med åtkomst för "Alla".
 * Sätt PIN i Script Properties (Projekt-inställningar → Skriptegenskaper):
 *   Nyckel: BLOMPASSET_PIN
 *   Värde:  din-pin-kod
 *
 * Kör initSheets() EN gång manuellt för att skapa arken.
 */

/* ── Config ── */
const SHEET_NAMES = {
  shifts:    'Shifts',
  blombilen: 'Blombilen',
  places:    'Places',
  settings:  'Settings',
  log:       'SyncLog',
};

/* ── Entry points ── */
function doGet(e) {
  return handleRequest(e.parameter, null);
}

function doPost(e) {
  let body = {};
  try { body = JSON.parse(e.postData.contents); } catch(_) {}
  return handleRequest(body, body);
}

function handleRequest(params, body) {
  const action = (params && params.action) || (body && body.action) || '';
  const pin    = (params && params.pin)    || (body && body.pin)    || '';

  // CORS + JSON output
  const output = ContentService.createTextOutput();
  output.setMimeType(ContentService.MimeType.JSON);

  try {
    if (!checkPin(pin)) {
      output.setContent(JSON.stringify({ ok: false, error: 'Fel PIN-kod' }));
      return output;
    }

    let result;
    switch (action) {
      case 'ping':     result = { ok: true, message: 'Blompasset online 🌸' }; break;
      case 'getData':  result = getData(); break;
      case 'saveAll':  result = saveAll(body.data); break;
      default:         result = { ok: false, error: 'Okänd åtgärd: ' + action };
    }

    logSync(action, result.ok);
    output.setContent(JSON.stringify(result));
  } catch(err) {
    logSync(action, false, err.message);
    output.setContent(JSON.stringify({ ok: false, error: err.message }));
  }

  return output;
}

/* ── Auth ── */
function checkPin(pin) {
  const stored = PropertiesService.getScriptProperties().getProperty('BLOMPASSET_PIN');
  if (!stored) return false; // PIN must be set in Script Properties
  return pin === stored;
}

/* ── Read all data ── */
function getData() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  return {
    ok: true,
    data: {
      shifts:    readSheet(ss, SHEET_NAMES.shifts),
      blombilen: readSheet(ss, SHEET_NAMES.blombilen),
      places:    readSheet(ss, SHEET_NAMES.places),
      settings:  readSettings(ss),
    },
  };
}

/* ── Save all data ── */
function saveAll(data) {
  if (!data) return { ok: false, error: 'Ingen data' };
  const ss = SpreadsheetApp.getActiveSpreadsheet();

  if (data.shifts)    writeSheet(ss, SHEET_NAMES.shifts,    data.shifts);
  if (data.blombilen) writeSheet(ss, SHEET_NAMES.blombilen, data.blombilen);
  if (data.places)    writeSheet(ss, SHEET_NAMES.places,    data.places);
  if (data.settings)  writeSettings(ss, data.settings);

  return { ok: true, savedAt: new Date().toISOString() };
}

/* ── Sheet helpers ── */
function getOrCreateSheet(ss, name) {
  let sheet = ss.getSheetByName(name);
  if (!sheet) sheet = ss.insertSheet(name);
  return sheet;
}

function readSheet(ss, name) {
  const sheet = ss.getSheetByName(name);
  if (!sheet) return [];
  const rows = sheet.getDataRange().getValues();
  if (rows.length < 2) return [];
  const headers = rows[0];
  return rows.slice(1).map(row => {
    const obj = {};
    headers.forEach((h, i) => { obj[h] = row[i]; });
    return obj;
  }).filter(obj => obj.id);
}

function writeSheet(ss, name, records) {
  const sheet = getOrCreateSheet(ss, name);
  sheet.clearContents();
  if (!records || records.length === 0) return;

  const headers = Object.keys(records[0]);
  const rows    = records.map(r => headers.map(h => {
    const v = r[h];
    if (v === null || v === undefined) return '';
    if (typeof v === 'object') return JSON.stringify(v);
    return v;
  }));

  sheet.getRange(1, 1, 1, headers.length).setValues([headers]);
  if (rows.length > 0) {
    sheet.getRange(2, 1, rows.length, headers.length).setValues(rows);
  }

  // Header formatting
  const headerRange = sheet.getRange(1, 1, 1, headers.length);
  headerRange.setBackground('#1B5E3B').setFontColor('#ffffff').setFontWeight('bold');
  sheet.setFrozenRows(1);
}

function readSettings(ss) {
  const sheet = ss.getSheetByName(SHEET_NAMES.settings);
  if (!sheet) return {};
  const rows = sheet.getDataRange().getValues();
  const obj  = {};
  rows.forEach(row => { if (row[0]) obj[row[0]] = row[1]; });
  return obj;
}

function writeSettings(ss, settings) {
  const sheet = getOrCreateSheet(ss, SHEET_NAMES.settings);
  sheet.clearContents();
  // Never store googlePin or googleScriptUrl in sheets
  const safe = { ...settings };
  delete safe.googlePin;
  delete safe.googleScriptUrl;
  const rows = Object.entries(safe).map(([k, v]) => [k, v]);
  if (rows.length > 0) {
    sheet.getRange(1, 1, rows.length, 2).setValues(rows);
    sheet.getRange(1, 1, 1, 2).setBackground('#1B5E3B').setFontColor('#fff').setFontWeight('bold');
  }
}

function logSync(action, ok, error) {
  try {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const sheet = getOrCreateSheet(ss, SHEET_NAMES.log);
    if (sheet.getLastRow() === 0) {
      sheet.appendRow(['Tid', 'Åtgärd', 'Status', 'Fel']);
    }
    sheet.appendRow([new Date(), action, ok ? 'OK' : 'FEL', error || '']);
    // Keep max 200 log rows
    const maxRows = 200;
    if (sheet.getLastRow() > maxRows + 1) {
      sheet.deleteRows(2, sheet.getLastRow() - maxRows - 1);
    }
  } catch(_) {}
}

/* ── Manual setup ── */
function initSheets() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  Object.values(SHEET_NAMES).forEach(name => getOrCreateSheet(ss, name));

  // Sample data hint
  const settingsSheet = getOrCreateSheet(ss, SHEET_NAMES.settings);
  if (settingsSheet.getLastRow() === 0) {
    settingsSheet.appendRow(['nyckel', 'värde']);
    settingsSheet.appendRow(['hourlyRate', 0]);
    settingsSheet.appendRow(['taxRate', 30]);
    settingsSheet.appendRow(['vacationPayRate', 12]);
    settingsSheet.getRange(1,1,1,2).setBackground('#1B5E3B').setFontColor('#fff').setFontWeight('bold');
  }

  SpreadsheetApp.getUi().alert('✅ Blompasset-ark skapade!\n\nGlöm inte att sätta BLOMPASSET_PIN i Projekt-inställningar → Skriptegenskaper.');
}

function setPin() {
  const ui  = SpreadsheetApp.getUi();
  const res = ui.prompt('Sätt PIN', 'Ange PIN-kod för Blompasset:', ui.ButtonSet.OK_CANCEL);
  if (res.getSelectedButton() === ui.Button.OK) {
    PropertiesService.getScriptProperties().setProperty('BLOMPASSET_PIN', res.getResponseText().trim());
    ui.alert('PIN sparad ✓');
  }
}

function onOpen() {
  SpreadsheetApp.getUi()
    .createMenu('🌸 Blompasset')
    .addItem('Initiera ark', 'initSheets')
    .addItem('Sätt PIN', 'setPin')
    .addToUi();
}
