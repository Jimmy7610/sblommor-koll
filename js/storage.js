/* ══════════════════════════════════════════
   storage.js — Trippel-säkrad lagring
   1. localStorage  (snabb, synkron)
   2. IndexedDB     (robust, överlever ofta
                     när localStorage rensas)
   3. Dagliga snapshots i IndexedDB (7 dagar)
   + navigator.storage.persist() så att
   webbläsaren inte får rensa datan.
   ══════════════════════════════════════════ */

const STORAGE_KEY   = 'blompasset_data';
const PREV_KEY      = 'blompasset_data_prev';
const DB_NAME       = 'blompasset-db';
const DB_VERSION    = 1;
const STORE_MAIN    = 'state';
const STORE_SNAPS   = 'snapshots';
const MAX_SNAPSHOTS = 7;

let _lastSavedAt = null;
let _idbOk = null; // null = okänt, true/false efter första försöket

/* ── IndexedDB helpers ── */
function idbOpen() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE_MAIN))  db.createObjectStore(STORE_MAIN);
      if (!db.objectStoreNames.contains(STORE_SNAPS)) db.createObjectStore(STORE_SNAPS);
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror   = () => reject(req.error);
  });
}

function idbPut(store, key, value) {
  return idbOpen().then(db => new Promise((resolve, reject) => {
    const tx = db.transaction(store, 'readwrite');
    tx.objectStore(store).put(value, key);
    tx.oncomplete = () => { db.close(); resolve(); };
    tx.onerror    = () => { db.close(); reject(tx.error); };
  }));
}

function idbGet(store, key) {
  return idbOpen().then(db => new Promise((resolve, reject) => {
    const tx  = db.transaction(store, 'readonly');
    const req = tx.objectStore(store).get(key);
    req.onsuccess = () => { db.close(); resolve(req.result ?? null); };
    req.onerror   = () => { db.close(); reject(req.error); };
  }));
}

function idbKeys(store) {
  return idbOpen().then(db => new Promise((resolve, reject) => {
    const tx  = db.transaction(store, 'readonly');
    const req = tx.objectStore(store).getAllKeys();
    req.onsuccess = () => { db.close(); resolve(req.result || []); };
    req.onerror   = () => { db.close(); reject(req.error); };
  }));
}

function idbDelete(store, key) {
  return idbOpen().then(db => new Promise((resolve, reject) => {
    const tx = db.transaction(store, 'readwrite');
    tx.objectStore(store).delete(key);
    tx.oncomplete = () => { db.close(); resolve(); };
    tx.onerror    = () => { db.close(); reject(tx.error); };
  }));
}

/* ── Spara: localStorage direkt + IndexedDB + dagligt snapshot ── */
export function saveState(state) {
  const toSave = {
    shifts:    state.shifts,
    blombilen: state.blombilen,
    places:    state.places,
    settings:  state.settings,
    ui:        state.ui,
    _savedAt:  new Date().toISOString(),
  };
  const json = JSON.stringify(toSave);

  // 1) localStorage — behåll föregående version som rollback
  try {
    const prev = localStorage.getItem(STORAGE_KEY);
    if (prev) localStorage.setItem(PREV_KEY, prev);
    localStorage.setItem(STORAGE_KEY, json);
    _lastSavedAt = toSave._savedAt;
  } catch (e) {
    console.error('localStorage save failed:', e);
  }

  // 2) IndexedDB — asynkront, oberoende kopia
  idbPut(STORE_MAIN, 'current', toSave)
    .then(() => { _idbOk = true; })
    .catch(e => { _idbOk = false; console.error('IndexedDB save failed:', e); });

  // 3) Dagligt snapshot (max ett per dag, behåll 7 senaste)
  const day = toSave._savedAt.slice(0, 10);
  idbPut(STORE_SNAPS, day, toSave)
    .then(() => pruneSnapshots())
    .catch(() => {});
}

async function pruneSnapshots() {
  try {
    const keys = (await idbKeys(STORE_SNAPS)).sort();
    while (keys.length > MAX_SNAPSHOTS) {
      await idbDelete(STORE_SNAPS, keys.shift());
    }
  } catch (_) {}
}

/* ── Ladda: bästa tillgängliga källa ── */
function parseOrNull(raw) {
  try {
    const data = JSON.parse(raw);
    return isValidState(data) ? data : null;
  } catch { return null; }
}

function isValidState(data) {
  return data && typeof data === 'object' && Array.isArray(data.shifts) && Array.isArray(data.blombilen);
}

export async function loadStateAsync() {
  // 1) localStorage (primär)
  const local = parseOrNull(localStorage.getItem(STORAGE_KEY));

  // 2) IndexedDB (kan vara nyare om localStorage rensats)
  let idb = null;
  try {
    const fromIdb = await idbGet(STORE_MAIN, 'current');
    if (isValidState(fromIdb)) idb = fromIdb;
    _idbOk = true;
  } catch (e) {
    _idbOk = false;
  }

  // Välj den senast sparade av de två
  let best = local;
  let source = 'localStorage';
  if (idb && (!local || (idb._savedAt || '') > (local._savedAt || ''))) {
    best = idb; source = 'indexeddb';
  }

  // 3) Rollback-kopian i localStorage
  if (!best) {
    best = parseOrNull(localStorage.getItem(PREV_KEY));
    if (best) source = 'rollback';
  }

  // 4) Senaste dagliga snapshot
  if (!best) {
    try {
      const keys = (await idbKeys(STORE_SNAPS)).sort();
      if (keys.length) {
        const snap = await idbGet(STORE_SNAPS, keys[keys.length - 1]);
        if (isValidState(snap)) { best = snap; source = 'snapshot'; }
      }
    } catch (_) {}
  }

  if (best) {
    _lastSavedAt = best._savedAt || null;
    // Om vi räddade data från en sekundär källa: skriv tillbaka till alla lager direkt
    if (source !== 'localStorage') {
      try { localStorage.setItem(STORAGE_KEY, JSON.stringify(best)); } catch (_) {}
      idbPut(STORE_MAIN, 'current', best).catch(() => {});
      console.info(`Blompasset: data återställd från ${source}`);
    }
  }
  return best;
}

/* Synkron fallback (används inte av boot, men behålls för kompatibilitet) */
export function loadState() {
  return parseOrNull(localStorage.getItem(STORAGE_KEY));
}

export function clearState() {
  localStorage.removeItem(STORAGE_KEY);
  localStorage.removeItem(PREV_KEY);
  idbPut(STORE_MAIN, 'current', null).catch(() => {});
}

/* ── Beständig lagring — be webbläsaren att aldrig rensa ── */
export async function requestPersistentStorage() {
  try {
    if (navigator.storage?.persist) {
      const already = await navigator.storage.persisted();
      if (already) return true;
      return await navigator.storage.persist();
    }
  } catch (_) {}
  return false;
}

export async function getStorageInfo() {
  const info = {
    persisted: false,
    usage: null,
    quota: null,
    lastSavedAt: _lastSavedAt,
    idbOk: _idbOk,
  };
  try {
    if (navigator.storage?.persisted) info.persisted = await navigator.storage.persisted();
    if (navigator.storage?.estimate) {
      const est = await navigator.storage.estimate();
      info.usage = est.usage ?? null;
      info.quota = est.quota ?? null;
    }
  } catch (_) {}
  return info;
}

/* ── Snapshots: lista + återställ ── */
export async function listSnapshots() {
  try {
    const keys = (await idbKeys(STORE_SNAPS)).sort().reverse();
    const out = [];
    for (const key of keys) {
      const snap = await idbGet(STORE_SNAPS, key);
      if (isValidState(snap)) {
        out.push({
          day: key,
          savedAt: snap._savedAt,
          shifts: snap.shifts.length,
          blombilen: snap.blombilen.length,
        });
      }
    }
    return out;
  } catch (_) { return []; }
}

export async function getSnapshot(day) {
  try {
    const snap = await idbGet(STORE_SNAPS, day);
    return isValidState(snap) ? snap : null;
  } catch (_) { return null; }
}

/* ── Export helpers ── */
export function exportJSON(state) {
  const data = {
    _export: 'Blompasset',
    _version: 2,
    _exportedAt: new Date().toISOString(),
    shifts: state.shifts,
    blombilen: state.blombilen,
    places: state.places,
    settings: {
      hourlyRate: state.settings.hourlyRate,
      taxRate: state.settings.taxRate,
      vacationPayRate: state.settings.vacationPayRate,
      defaultOB: state.settings.defaultOB,
      defaultOBRate: state.settings.defaultOBRate,
    },
  };
  downloadFile(`blompasset-backup-${today()}.json`, JSON.stringify(data, null, 2), 'application/json');
}

export function exportCSV(state, month) {
  const shifts = month
    ? state.shifts.filter(s => s.date.startsWith(month))
    : state.shifts;

  const rows = [
    ['Datum', 'Starttid', 'Sluttid', 'Rast (min)', 'Timmar', 'Status', 'OB', 'OB-tillägg', 'Anteckning'],
    ...shifts.map(s => {
      const h = calcHours(s);
      return [s.date, s.startTime, s.endTime, s.breakMinutes, h.toFixed(2), s.status, s.hasOB ? 'Ja' : 'Nej', s.obRate || 0, s.note || ''];
    }),
  ];

  const csv = rows.map(row => row.map(v => `"${String(v).replace(/"/g, '""')}"`).join(',')).join('\n');
  downloadFile(`blompasset-${month || 'alla'}.csv`, csv, 'text/csv;charset=utf-8;');
}

export function importJSON(jsonText, applyFn) {
  try {
    const data = JSON.parse(jsonText);
    if (!data._export || data._export !== 'Blompasset') throw new Error('Ogiltigt format');
    applyFn(data);
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e.message };
  }
}

function today() {
  return new Date().toISOString().slice(0, 10);
}

function calcHours(shift) {
  if (!shift.startTime || !shift.endTime) return 0;
  const [sh, sm] = shift.startTime.split(':').map(Number);
  const [eh, em] = shift.endTime.split(':').map(Number);
  const start = sh * 60 + sm;
  let end = eh * 60 + em;
  if (end < start) end += 24 * 60;
  const worked = Math.max(0, end - start - (shift.breakMinutes || 0));
  return worked / 60;
}

function downloadFile(filename, content, mimeType) {
  const blob = new Blob(['﻿' + content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = filename;
  document.body.appendChild(a); a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 2000);
}
