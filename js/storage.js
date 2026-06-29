/* ══════════════════════════════════════════
   storage.js — localStorage persistence
   ══════════════════════════════════════════ */

const STORAGE_KEY = 'blompasset_data';
const SETTINGS_KEY = 'blompasset_settings_local';
const SYNC_QUEUE_KEY = 'blompasset_sync_queue';

export function saveState(state) {
  try {
    const toSave = {
      shifts: state.shifts,
      blombilen: state.blombilen,
      places: state.places,
      settings: state.settings,
      ui: state.ui,
      _savedAt: new Date().toISOString(),
    };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(toSave));
  } catch (e) {
    console.error('Storage save failed:', e);
  }
}

export function loadState() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    return JSON.parse(raw);
  } catch (e) {
    console.error('Storage load failed:', e);
    return null;
  }
}

export function clearState() {
  localStorage.removeItem(STORAGE_KEY);
}

/* ── Sync queue ── */
export function saveSyncQueue(queue) {
  try {
    localStorage.setItem(SYNC_QUEUE_KEY, JSON.stringify(queue));
  } catch (e) {}
}

export function loadSyncQueue() {
  try {
    const raw = localStorage.getItem(SYNC_QUEUE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch (e) {
    return [];
  }
}

export function clearSyncQueue() {
  localStorage.removeItem(SYNC_QUEUE_KEY);
}

/* ── Export helpers ── */
export function exportJSON(state) {
  const data = {
    _export: 'Blompasset',
    _version: 1,
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
