/* ══════════════════════════════════════════
   state.js — Central state with pub/sub
   ══════════════════════════════════════════ */

import { loadState, saveState } from './storage.js';

const DEFAULT_STATE = {
  shifts: [],
  blombilen: [],
  places: [
    { id: 'p-1', name: 'ICA Spara',              note: '', createdAt: '' },
    { id: 'p-2', name: 'Hemköp Munkedal',         note: '', createdAt: '' },
    { id: 'p-3', name: 'Happy Price Tanum köpcenter', note: '', createdAt: '' },
  ],
  settings: {
    hourlyRate: 0,
    taxRate: 30,
    vacationPayRate: 12,
    defaultOB: false,
    defaultOBRate: 0,
    googleScriptUrl: '',
    googlePin: '',
    autoSync: true,
    syncOnChange: true,
    setupComplete: false,
  },
  sync: {
    status: 'unknown',   // unknown | synced | pending | error | offline
    lastSync: null,
    queueCount: 0,
    lastError: null,
  },
  ui: {
    activePage: 'dashboard',
    blombilFilterFilter: 'tomorrow',
    shiftsFilter: 'upcoming',
    salaryMonth: null,
  },
};

let _state = structuredClone(DEFAULT_STATE);
const _listeners = {};

export function getState() {
  return _state;
}

export function get(path) {
  return path.split('.').reduce((obj, k) => obj?.[k], _state);
}

export function setState(updates, { persist = true, notify = true } = {}) {
  _state = deepMerge(_state, updates);
  if (persist) saveState(_state);
  if (notify) emit('change', _state);
}

export function setSync(updates) {
  _state.sync = { ..._state.sync, ...updates };
  emit('syncChange', _state.sync);
}

export function on(event, handler) {
  if (!_listeners[event]) _listeners[event] = [];
  _listeners[event].push(handler);
  return () => off(event, handler);
}

export function off(event, handler) {
  if (_listeners[event]) {
    _listeners[event] = _listeners[event].filter(h => h !== handler);
  }
}

export function emit(event, data) {
  (_listeners[event] || []).forEach(fn => {
    try { fn(data); } catch(e) { console.error('State listener error:', e); }
  });
}

export function initState() {
  const saved = loadState();
  if (saved) {
    _state = deepMerge(DEFAULT_STATE, saved);
    // Reset transient UI sync state
    _state.sync.status = navigator.onLine ? 'unknown' : 'offline';
  }
  return _state;
}

export function generateId() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
}

/* ── Shift helpers ── */
export function addShift(shift) {
  const item = { ...shift, id: generateId(), createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() };
  setState({ shifts: [..._state.shifts, item] });
  return item;
}
export function updateShift(id, updates) {
  setState({ shifts: _state.shifts.map(s => s.id === id ? { ...s, ...updates, updatedAt: new Date().toISOString() } : s) });
}
export function deleteShift(id) {
  setState({ shifts: _state.shifts.filter(s => s.id !== id) });
}

/* ── Blombilen helpers ── */
export function addBlombilen(item) {
  const entry = { ...item, id: generateId(), createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() };
  setState({ blombilen: [..._state.blombilen, entry] });
  return entry;
}
export function updateBlombilen(id, updates) {
  setState({ blombilen: _state.blombilen.map(b => b.id === id ? { ...b, ...updates, updatedAt: new Date().toISOString() } : b) });
}
export function deleteBlombilen(id) {
  setState({ blombilen: _state.blombilen.filter(b => b.id !== id) });
}

/* ── Place helpers ── */
export function addPlace(place) {
  const entry = { ...place, id: generateId(), createdAt: new Date().toISOString() };
  setState({ places: [..._state.places, entry] });
  return entry;
}
export function updatePlace(id, updates) {
  setState({ places: _state.places.map(p => p.id === id ? { ...p, ...updates } : p) });
}
export function deletePlace(id) {
  setState({ places: _state.places.filter(p => p.id !== id) });
}

/* ── Deep merge utility ── */
function deepMerge(target, source) {
  const out = { ...target };
  for (const key of Object.keys(source)) {
    if (source[key] && typeof source[key] === 'object' && !Array.isArray(source[key])) {
      out[key] = deepMerge(target[key] || {}, source[key]);
    } else {
      out[key] = source[key];
    }
  }
  return out;
}
