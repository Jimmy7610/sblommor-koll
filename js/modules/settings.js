/* ══════════════════════════════════════════
   settings.js — Settings page
   ══════════════════════════════════════════ */

import { getState, setState } from '../state.js';
import { openModal, closeModal, showToast, confirm, esc } from '../ui.js';
import { testConnection, fetchFromGoogle, flushQueue, updateSyncStatus } from '../sync.js';
import { formatLastSync } from '../dates.js';
import { doExportJSON, doImport } from '../exports.js';
import { renderPlaces } from './places.js';
// qr.js loaded dynamically inside openDeviceLinkModal to avoid module cache issues

export function renderSettings() {
  const { settings, sync } = getState();

  const syncConfigured = !!(settings.googleScriptUrl && settings.googlePin);
  const syncStatusText = { synced: 'Synkat ✓', pending: 'Väntar…', error: 'Fel ⚠', offline: 'Offline', unknown: '—' }[sync.status] ?? '—';
  const syncStatusColor = { synced: 'var(--c-success)', pending: 'var(--c-warning)', error: 'var(--c-error)', offline: 'var(--c-text-muted)' }[sync.status] ?? 'var(--c-text-muted)';

  const html = `
    <div class="page-header"><h2 class="page-title">⚙️ Inställningar</h2></div>

    <!-- ── Lön ── -->
    <div class="settings-section">
      <div class="settings-section-title">Lön & skatt</div>
      <div class="settings-card">
        <form id="salary-settings-form">
          <div style="padding:16px">
            <div class="form-row">
              <div class="form-group mb-0">
                <label class="form-label">Timlön (kr)</label>
                <input type="number" name="hourlyRate" class="form-input" value="${settings.hourlyRate || ''}" placeholder="0" min="0" step="1">
              </div>
              <div class="form-group mb-0">
                <label class="form-label">Skatt (%)</label>
                <input type="number" name="taxRate" class="form-input" value="${settings.taxRate ?? 30}" min="0" max="100" step="1">
                <div class="form-hint">Uddevalla standard: 30%</div>
              </div>
            </div>
            <div class="form-row mt-16">
              <div class="form-group mb-0">
                <label class="form-label">Semesterersättning (%)</label>
                <input type="number" name="vacationPayRate" class="form-input" value="${settings.vacationPayRate ?? 12}" min="0" max="30" step="0.5">
              </div>
              <div class="form-group mb-0">
                <label class="form-label">OB-tillägg (kr/h)</label>
                <input type="number" name="defaultOBRate" class="form-input" value="${settings.defaultOBRate || 0}" min="0">
              </div>
            </div>
          </div>
          <div class="toggle-row" style="padding:14px 16px">
            <div class="toggle-info">
              <div class="toggle-label">OB på som standard</div>
              <div class="toggle-desc">Nya pass får OB förvalt</div>
            </div>
            <label class="toggle">
              <input type="checkbox" name="defaultOB" ${settings.defaultOB ? 'checked' : ''}>
              <span class="toggle-track"></span>
              <span class="toggle-thumb"></span>
            </label>
          </div>
          <div style="padding:0 16px 16px">
            <button type="submit" class="btn btn-primary btn-full">Spara löneinställningar</button>
          </div>
        </form>
      </div>
    </div>

    <!-- ── Google Sync ── -->
    <div class="settings-section">
      <div class="settings-section-title">Google Sync</div>
      <div class="sync-status-card">
        <div class="sync-status-row">
          <span class="sync-status-icon">${syncConfigured ? '☁️' : '🔌'}</span>
          <div class="sync-status-text">
            <div class="sync-status-label" style="color:${syncStatusColor}">${syncConfigured ? syncStatusText : 'Ej konfigurerad'}</div>
            <div class="sync-status-sub">Senast synkat: ${formatLastSync(sync.lastSync)}</div>
          </div>
        </div>
        ${sync.status === 'error' ? `<div style="padding:10px;background:var(--c-error-soft);border-radius:var(--radius-md);font-size:13px;color:var(--c-error);margin-bottom:12px">${sync.lastError || 'Okänt fel'}</div>` : ''}
        <div style="display:flex;gap:8px;flex-wrap:wrap">
          ${syncConfigured ? `
            <button class="btn btn-primary btn-sm" id="sync-now-btn">⬆ Synka nu</button>
            <button class="btn btn-secondary btn-sm" id="pull-btn">⬇ Hämta från Google</button>
            <button class="btn btn-ghost btn-sm" id="edit-sync-btn">Ändra</button>
          ` : `
            <button class="btn btn-primary btn-sm" id="setup-sync-btn">Koppla Google Sync</button>
          `}
        </div>
      </div>
    </div>

    <!-- ── Sync settings ── -->
    ${syncConfigured ? `
    <div class="settings-section">
      <div class="settings-section-title">Sync-alternativ</div>
      <div class="settings-card">
        <div class="toggle-row">
          <div class="toggle-info">
            <div class="toggle-label">Automatisk sync</div>
            <div class="toggle-desc">Synka vid förändringar</div>
          </div>
          <label class="toggle">
            <input type="checkbox" id="auto-sync-toggle" ${settings.autoSync !== false ? 'checked' : ''}>
            <span class="toggle-track"></span>
            <span class="toggle-thumb"></span>
          </label>
        </div>
      </div>
    </div>
    ` : ''}

    <!-- ── Koppla ny enhet ── -->
    ${syncConfigured ? `
    <div class="settings-section">
      <div class="settings-section-title">Koppla ny enhet</div>
      <div class="settings-card">
        <div style="padding:16px">
          <div style="display:flex;align-items:center;gap:10px;margin-bottom:12px">
            <span style="font-size:24px">📱</span>
            <div>
              <div style="font-size:15px;font-weight:600">Dela setup till annan enhet</div>
              <div style="font-size:12px;color:var(--c-text-muted)">Generera en länk eller QR-kod för snabbkoppling</div>
            </div>
          </div>
          <div style="background:var(--c-error-soft);border-radius:var(--radius-md);padding:10px 12px;font-size:12px;color:var(--c-error);margin-bottom:14px;display:flex;gap:8px;align-items:flex-start">
            <span>⚠️</span>
            <span><strong>Dela inte länken offentligt.</strong> Den innehåller PIN-koden och ger full tillgång till din data.</span>
          </div>
          <button class="btn btn-primary btn-full" id="gen-device-link-btn">🔗 Skapa setup-länk & QR-kod</button>
        </div>
      </div>
    </div>
    ` : ''}

    <!-- ── Platser ── -->
    <div class="settings-section">
      <div class="settings-section-title">Platsregister</div>
      <div id="places-container"></div>
    </div>

    <!-- ── Data ── -->
    <div class="settings-section">
      <div class="settings-section-title">Data & säkerhetskopiering</div>
      <div class="settings-card">
        <div class="settings-row" id="export-json-row" style="cursor:pointer">
          <span class="settings-row-icon">📦</span>
          <div class="settings-row-content">
            <div class="settings-row-label">Exportera JSON-backup</div>
            <div class="settings-row-desc">Ladda ned all data som JSON</div>
          </div>
          <span class="settings-row-arrow">›</span>
        </div>
        <div class="settings-row" id="import-row" style="cursor:pointer">
          <span class="settings-row-icon">📥</span>
          <div class="settings-row-content">
            <div class="settings-row-label">Importera backup</div>
            <div class="settings-row-desc">Ladda upp en JSON-backup</div>
          </div>
          <span class="settings-row-arrow">›</span>
        </div>
        <input type="file" id="import-file-input" accept=".json" style="display:none">
      </div>
    </div>

    <!-- ── Danger zone ── -->
    <div class="settings-section">
      <div class="settings-section-title">Rensa data</div>
      <div class="settings-card">
        <div class="settings-row" id="clear-all-row" style="cursor:pointer">
          <span class="settings-row-icon">🗑️</span>
          <div class="settings-row-content">
            <div class="settings-row-label" style="color:var(--c-error)">Rensa all data</div>
            <div class="settings-row-desc">Tar bort alla pass, Blombilen-poster och inställningar</div>
          </div>
          <span class="settings-row-arrow" style="color:var(--c-error)">›</span>
        </div>
      </div>
    </div>

    <!-- Version -->
    <div style="text-align:center;padding:24px 0;font-size:12px;color:var(--c-text-muted)">
      🌸 Blompasset · S-blommor Uddevalla/Kuröd
    </div>
  `;

  const container = document.getElementById('settings-inner');
  if (container) {
    container.innerHTML = html;
    renderPlaces(document.getElementById('places-container'));
    bindSettingsEvents();
  }
}

function bindSettingsEvents() {
  // Salary form
  document.getElementById('salary-settings-form')?.addEventListener('submit', (e) => {
    e.preventDefault();
    const fd = new FormData(e.target);
    const updates = {
      settings: {
        ...getState().settings,
        hourlyRate:       Number(fd.get('hourlyRate')) || 0,
        taxRate:          Number(fd.get('taxRate'))    || 30,
        vacationPayRate:  Number(fd.get('vacationPayRate')) || 12,
        defaultOBRate:    Number(fd.get('defaultOBRate'))   || 0,
        defaultOB:        !!e.target.querySelector('[name="defaultOB"]')?.checked,
      },
    };
    setState(updates);
    showToast('Löneinställningar sparade ✓', 'success');
  });

  // Sync
  document.getElementById('sync-now-btn')?.addEventListener('click', async () => {
    showToast('Synkar…', 'info', 1500);
    await flushQueue();
    renderSettings();
  });

  document.getElementById('pull-btn')?.addEventListener('click', async () => {
    try {
      showToast('Hämtar från Google…', 'info', 2000);
      const data = await fetchFromGoogle();
      if (data) {
        setState({
          shifts:    data.shifts    || getState().shifts,
          blombilen: data.blombilen || getState().blombilen,
          places:    data.places    || getState().places,
        });
        showToast('Data hämtad ✓', 'success');
        renderSettings();
      }
    } catch (e) { showToast('Hämtning misslyckades: ' + e.message, 'error'); }
  });

  document.getElementById('setup-sync-btn')?.addEventListener('click', () => openSyncModal());
  document.getElementById('edit-sync-btn')?.addEventListener('click',  () => openSyncModal());

  document.getElementById('auto-sync-toggle')?.addEventListener('change', (e) => {
    setState({ settings: { ...getState().settings, autoSync: e.target.checked, syncOnChange: e.target.checked } });
  });

  // Export / Import
  document.getElementById('export-json-row')?.addEventListener('click', () => doExportJSON());
  document.getElementById('import-row')?.addEventListener('click', () => document.getElementById('import-file-input')?.click());
  document.getElementById('import-file-input')?.addEventListener('change', async (e) => {
    if (e.target.files[0]) {
      await doImport(e.target.files[0]);
      renderSettings();
    }
  });

  // Device link
  document.getElementById('gen-device-link-btn')?.addEventListener('click', () => openDeviceLinkModal());

  // Clear all
  document.getElementById('clear-all-row')?.addEventListener('click', async () => {
    const ok = await confirm('Är du säker? All data raderas permanent från den här enheten.', { confirmText: 'Ja, rensa allt', danger: true });
    if (ok) {
      setState({ shifts: [], blombilen: [] });
      showToast('All data rensad', 'info');
      renderSettings();
    }
  });
}

export function openSyncModal(step = 1) {
  const { settings } = getState();
  openModal({
    title: 'Google Sync',
    content: `
      <form id="sync-form" novalidate>
        <div class="form-group">
          <label class="form-label">Google Apps Script URL</label>
          <input type="url" name="scriptUrl" class="form-input" value="${esc(settings.googleScriptUrl || '')}" placeholder="https://script.google.com/macros/s/…/exec">
          <div class="form-hint">Från ditt distribuerade Apps Script</div>
        </div>
        <div class="form-group">
          <label class="form-label">PIN</label>
          <input type="password" name="pin" class="form-input" value="${settings.googlePin ? '••••' : ''}" placeholder="Din PIN-kod" autocomplete="new-password">
          <div class="form-hint">Samma PIN du angav i Apps Script</div>
        </div>
        <div id="sync-test-result" class="setup-test-result hidden"></div>
        <div class="modal-actions">
          <button type="button" class="btn btn-secondary btn-full" id="test-conn-btn">Testa anslutning</button>
          <button type="submit" class="btn btn-primary btn-full">Spara</button>
          <button type="button" class="btn btn-ghost btn-full" id="modal-cancel">Avbryt</button>
        </div>
      </form>
    `,
  });

  document.getElementById('modal-cancel')?.addEventListener('click', closeModal);

  document.getElementById('test-conn-btn')?.addEventListener('click', async () => {
    const form = document.getElementById('sync-form');
    const fd = new FormData(form);
    const url = fd.get('scriptUrl')?.trim();
    const pin = fd.get('pin')?.trim();
    const resultEl = document.getElementById('sync-test-result');
    if (!url || !pin) { showToast('Fyll i URL och PIN', 'warning'); return; }
    resultEl.textContent = '⏳ Testar…';
    resultEl.className = 'setup-test-result';
    resultEl.classList.remove('hidden');
    const res = await testConnection(url, pin);
    resultEl.textContent = res.message;
    resultEl.className = `setup-test-result ${res.ok ? 'success' : 'error'}`;
  });

  document.getElementById('sync-form')?.addEventListener('submit', (e) => {
    e.preventDefault();
    const fd = new FormData(e.target);
    const url = fd.get('scriptUrl')?.trim();
    const pin = fd.get('pin')?.trim();
    if (!url) { showToast('Ange Script-URL', 'warning'); return; }
    const newPin = pin === '••••' ? settings.googlePin : pin;
    setState({ settings: { ...getState().settings, googleScriptUrl: url, googlePin: newPin, setupComplete: true } });
    updateSyncStatus();
    showToast('Sync-inställningar sparade ✓', 'success');
    closeModal();
    renderSettings();
  });
}

/* ══════════════════════════════════════════
   Koppla ny enhet — magic link + QR
   ══════════════════════════════════════════ */

export function buildSetupToken(scriptUrl, pin) {
  const payload = { u: scriptUrl, p: pin };
  return btoa(JSON.stringify(payload))
    .replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '');
}

export function parseSetupToken(token) {
  try {
    const padded = token.replace(/-/g, '+').replace(/_/g, '/');
    const json   = atob(padded.padEnd(padded.length + (4 - padded.length % 4) % 4, '='));
    const obj    = JSON.parse(json);
    if (!obj.u || !obj.p) throw new Error('Incomplete');
    return { url: obj.u, pin: obj.p };
  } catch {
    return null;
  }
}

function getSetupLink() {
  const { settings } = getState();
  if (!settings.googleScriptUrl || !settings.googlePin) return null;
  const token   = buildSetupToken(settings.googleScriptUrl, settings.googlePin);
  const baseUrl = location.origin + location.pathname.replace(/\/$/, '');
  return `${baseUrl}?setup=${token}`;
}

export async function openDeviceLinkModal() {
  const link = getSetupLink();
  if (!link) { showToast('Konfigurera Google Sync först', 'warning'); return; }

  // Dynamic import with cache-bust in dev, works normally in prod
  let qrCanvas, qrDataURL;
  try {
    const qrMod = await import('../qr.js');
    qrCanvas   = qrMod.qrCanvas;
    qrDataURL  = qrMod.qrDataURL;
  } catch (e) {
    showToast('Kunde inte ladda QR-modul: ' + e.message, 'error');
    return;
  }

  openModal({
    title: '📱 Koppla ny enhet',
    content: `
      <div style="padding-bottom:8px">

        <div style="background:var(--c-error-soft);border-radius:var(--radius-md);padding:10px 14px;font-size:13px;color:var(--c-error);margin-bottom:20px;display:flex;gap:8px;align-items:flex-start">
          <span style="flex-shrink:0">⚠️</span>
          <span><strong>Dela inte länken offentligt.</strong> Den innehåller din PIN-kod.</span>
        </div>

        <!-- QR code via canvas -->
        <div style="text-align:center;margin-bottom:8px;font-size:13px;font-weight:600;color:var(--c-text-muted)">
          Skanna med kameran på den nya enheten
        </div>
        <div id="qr-wrap" style="
          display:flex;justify-content:center;align-items:center;
          background:#ffffff;border:3px solid #e5e7eb;
          border-radius:var(--radius-lg);padding:16px;
          margin-bottom:10px;min-height:200px;
        ">
          <canvas id="qr-canvas" style="display:block;image-rendering:pixelated;max-width:100%"></canvas>
        </div>

        <!-- QR fallback tip -->
        <div style="text-align:center;font-size:12px;color:var(--c-text-muted);margin-bottom:16px">
          Fungerar inte QR-koden? Tryck <strong>Kopiera länk</strong> och öppna den på mobilen.
        </div>

        <!-- Action buttons -->
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-bottom:20px">
          <button class="btn btn-primary" id="copy-link-btn">📋 Kopiera länk</button>
          <button class="btn btn-secondary" id="share-link-btn" style="${'share' in navigator ? '' : 'display:none'}">↗ Dela länk</button>
          <button class="btn btn-ghost" id="open-link-btn">🔗 Öppna länk</button>
          <button class="btn btn-ghost" id="bigger-qr-btn">🔍 Visa större QR</button>
        </div>

        <!-- Link text (collapsed by default) -->
        <details style="margin-bottom:20px">
          <summary style="font-size:13px;font-weight:600;color:var(--c-text-muted);cursor:pointer;padding:8px 0">
            Visa setup-länk som text
          </summary>
          <div style="margin-top:8px">
            <textarea id="device-link-input" class="form-textarea" readonly
              style="font-size:10px;font-family:var(--font-mono);min-height:72px;word-break:break-all">${esc(link)}</textarea>
          </div>
        </details>

        <!-- How it works -->
        <div style="background:var(--c-primary-soft);border-radius:var(--radius-md);padding:12px 14px;font-size:13px;color:var(--c-primary);margin-bottom:20px">
          <div style="font-weight:700;margin-bottom:6px">Så här fungerar det:</div>
          <ol style="padding-left:16px;line-height:1.9;margin:0">
            <li>Skanna QR-koden med kameran på den nya enheten</li>
            <li>Appen öppnas och kopplas automatiskt mot Google Sync</li>
            <li>All data hämtas från Google Sheets direkt</li>
          </ol>
        </div>

        <div style="display:flex;flex-direction:column;gap:8px">
          <button class="btn btn-ghost btn-full" id="clear-sync-btn">🗑 Radera sync-inställningar från denna enhet</button>
          <button class="btn btn-ghost btn-full" id="modal-cancel">Stäng</button>
        </div>

        <div style="margin-top:16px;padding:10px 14px;background:var(--c-border-soft);border-radius:var(--radius-md);font-size:12px;color:var(--c-text-muted)">
          💡 Vill du byta PIN? Kör <code style="background:rgba(0,0,0,.06);padding:1px 4px;border-radius:3px">setPin()</code> i Google Apps Script, uppdatera sedan PIN i Inställningar och generera en ny länk.
        </div>
      </div>
    `,
  });

  // Render QR on canvas after modal is painted
  requestAnimationFrame(() => {
    const canvas = document.getElementById('qr-canvas');
    if (!canvas) return;
    try {
      // Size: fill container up to 300px, min 240px
      const wrap   = document.getElementById('qr-wrap');
      const avail  = Math.min(wrap ? wrap.clientWidth - 32 : 280, 300);
      const target = Math.max(avail, 240);
      qrCanvas(link, canvas, { quiet: 4, size: target });
      canvas.style.width  = canvas.width  + 'px';
      canvas.style.height = canvas.height + 'px';
    } catch (e) {
      document.getElementById('qr-wrap').innerHTML =
        `<div style="padding:16px;color:var(--c-error);font-size:13px;text-align:center">
          Kunde inte generera QR-kod:<br>${e.message}<br><br>Använd Kopiera länk-knappen istället.
        </div>`;
    }
  });

  // Copy
  document.getElementById('copy-link-btn')?.addEventListener('click', async () => {
    try {
      await navigator.clipboard.writeText(link);
      const btn = document.getElementById('copy-link-btn');
      if (btn) { btn.textContent = '✓ Kopierad!'; setTimeout(() => { btn.textContent = '📋 Kopiera länk'; }, 2500); }
    } catch {
      document.getElementById('device-link-input')?.select();
      showToast('Markera och kopiera manuellt', 'info');
    }
  });

  // Share (Web Share API — works on mobile)
  document.getElementById('share-link-btn')?.addEventListener('click', async () => {
    try {
      await navigator.share({ title: 'Blompasset Setup', url: link });
    } catch (e) {
      if (e.name !== 'AbortError') showToast('Delning misslyckades', 'error');
    }
  });

  // Open in new tab
  document.getElementById('open-link-btn')?.addEventListener('click', () => {
    window.open(link, '_blank', 'noopener');
  });

  // Bigger QR
  document.getElementById('bigger-qr-btn')?.addEventListener('click', () => {
    openBigQR(link);
  });

  // Select textarea on tap
  document.getElementById('device-link-input')?.addEventListener('click', (e) => e.target.select());

  // Clear sync
  document.getElementById('clear-sync-btn')?.addEventListener('click', async () => {
    const ok = await confirm('Radera sync-inställningar från den här enheten? Lokal data påverkas inte.', {
      confirmText: 'Ja, radera',
      danger: true,
    });
    if (ok) {
      setState({ settings: { ...getState().settings, googleScriptUrl: '', googlePin: '', setupComplete: false } });
      updateSyncStatus();
      showToast('Sync-inställningar raderade', 'info');
      closeModal();
      renderSettings();
    }
  });

  document.getElementById('modal-cancel')?.addEventListener('click', closeModal);
}

/* ── Full-screen QR overlay ── */
function openBigQR(link) {
  closeModal();
  const overlay = document.createElement('div');
  overlay.id = 'big-qr-overlay';
  overlay.style.cssText = `
    position:fixed;inset:0;z-index:700;
    background:#ffffff;
    display:flex;flex-direction:column;align-items:center;justify-content:center;
    padding:24px;gap:20px;
  `;
  overlay.innerHTML = `
    <div style="font-size:16px;font-weight:700;color:#1B5E3B">📱 Skanna med kameran</div>
    <canvas id="big-qr-canvas" style="display:block;image-rendering:pixelated;max-width:min(90vw,90vh)"></canvas>
    <div style="font-size:13px;color:#6B7280;text-align:center;max-width:280px">
      Håll kameran stadigt mot skärmen.<br>QR-koden öppnar Blompasset automatiskt.
    </div>
    <button id="big-qr-close" style="
      padding:14px 32px;border-radius:9999px;
      background:#1B5E3B;color:#fff;
      font-size:15px;font-weight:600;border:none;cursor:pointer;
    ">Stäng</button>
  `;
  document.body.appendChild(overlay);

  requestAnimationFrame(() => {
    const canvas = document.getElementById('big-qr-canvas');
    if (!canvas) return;
    const size = Math.min(window.innerWidth, window.innerHeight) * 0.82;
    qrCanvas(link, canvas, { quiet: 4, size: Math.max(size, 260) });
    canvas.style.width  = canvas.width  + 'px';
    canvas.style.height = canvas.height + 'px';
  });

  document.getElementById('big-qr-close')?.addEventListener('click', () => overlay.remove());
  overlay.addEventListener('click', (e) => { if (e.target === overlay) overlay.remove(); });
}
