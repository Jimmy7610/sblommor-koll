/* ══════════════════════════════════════════
   sync.js — Google Apps Script sync
   ══════════════════════════════════════════ */

import { getState, setState, setSync } from './state.js';
import { saveSyncQueue, loadSyncQueue, clearSyncQueue } from './storage.js';
import { showToast } from './ui.js';

let _queue = [];
let _syncTimer = null;
let _isSyncing = false;

export function initSync() {
  _queue = loadSyncQueue();
  updateSyncStatus();

  window.addEventListener('online',  () => { updateSyncStatus(); flushQueue(); });
  window.addEventListener('offline', () => setSync({ status: 'offline' }));

  navigator.serviceWorker?.addEventListener('message', (e) => {
    if (e.data?.type === 'SYNC_REQUESTED') flushQueue();
  });
}

export function updateSyncStatus() {
  const { settings } = getState();
  if (!navigator.onLine) { setSync({ status: 'offline' }); return; }
  if (!settings.googleScriptUrl || !settings.googlePin) { setSync({ status: 'unknown' }); return; }
  if (_queue.length > 0) { setSync({ status: 'pending', queueCount: _queue.length }); return; }
  // status stays as-is (last known)
}

export function scheduleSync() {
  if (_syncTimer) clearTimeout(_syncTimer);
  _syncTimer = setTimeout(() => flushQueue(), 1500);
  setSync({ status: 'pending', queueCount: _queue.length });
}

export function enqueue(operation) {
  _queue.push({ ...operation, ts: Date.now() });
  saveSyncQueue(_queue);
  setSync({ status: 'pending', queueCount: _queue.length });
  const { settings } = getState();
  if (settings.syncOnChange && navigator.onLine && settings.googleScriptUrl) {
    scheduleSync();
  }
}

export async function flushQueue() {
  const { settings } = getState();
  if (!settings.googleScriptUrl || !settings.googlePin) return;
  if (!navigator.onLine) { setSync({ status: 'offline' }); return; }
  if (_isSyncing) return;

  _isSyncing = true;
  setSync({ status: 'pending' });

  try {
    const state = getState();
    const payload = {
      action: 'saveAll',
      pin: settings.googlePin,
      data: {
        shifts: state.shifts,
        blombilen: state.blombilen,
        places: state.places,
        settings: {
          hourlyRate: settings.hourlyRate,
          taxRate: settings.taxRate,
          vacationPayRate: settings.vacationPayRate,
          defaultOB: settings.defaultOB,
          defaultOBRate: settings.defaultOBRate,
        },
      },
    };

    const res = await fetchGAS(settings.googleScriptUrl, payload);
    if (res.ok) {
      _queue = [];
      clearSyncQueue();
      const now = new Date().toISOString();
      setSync({ status: 'synced', lastSync: now, queueCount: 0, lastError: null });
      setState({ sync: { status: 'synced', lastSync: now, queueCount: 0, lastError: null } }, { persist: true, notify: false });
    } else {
      throw new Error(res.error || 'Okänt serverfel');
    }
  } catch (e) {
    setSync({ status: 'error', lastError: e.message });
    showToast('Sync misslyckades: ' + e.message, 'error');
  } finally {
    _isSyncing = false;
  }
}

export async function fetchFromGoogle() {
  const { settings } = getState();
  if (!settings.googleScriptUrl || !settings.googlePin) throw new Error('Sync ej konfigurerad');

  const res = await fetchGAS(settings.googleScriptUrl, {
    action: 'getData',
    pin: settings.googlePin,
  });
  if (!res.ok) throw new Error(res.error || 'Hämtning misslyckades');
  return res.data;
}

export async function testConnection(url, pin) {
  try {
    const res = await fetchGAS(url, { action: 'ping', pin });
    return res.ok
      ? { ok: true, message: 'Anslutning OK! 🎉' }
      : { ok: false, message: res.error || 'Fel PIN eller script-URL' };
  } catch (e) {
    return { ok: false, message: 'Kunde inte nå scriptet: ' + e.message };
  }
}

async function fetchGAS(url, payload) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 15000);
  try {
    let response;
    if (payload.action === 'getData' || payload.action === 'ping') {
      const params = new URLSearchParams({ action: payload.action, pin: payload.pin });
      response = await fetch(`${url}?${params}`, { signal: controller.signal });
    } else {
      response = await fetch(url, {
        method: 'POST',
        signal: controller.signal,
        headers: { 'Content-Type': 'text/plain' },
        body: JSON.stringify(payload),
      });
    }
    clearTimeout(timeout);
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    return await response.json();
  } catch (e) {
    clearTimeout(timeout);
    throw e;
  }
}
