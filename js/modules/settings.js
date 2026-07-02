/* ══════════════════════════════════════════
   settings.js — Inställningar
   Lön, datasäkerhet (trippel-lagring +
   snapshots), platser, export/import.
   ══════════════════════════════════════════ */

import { getState, setState } from '../state.js';
import { openModal, closeModal, showToast, confirm } from '../ui.js';
import { getStorageInfo, requestPersistentStorage, listSnapshots, getSnapshot } from '../storage.js';
import { doExportJSON, doImport } from '../exports.js';
import { renderPlaces } from './places.js';

export function renderSettings() {
  const { settings, shifts, blombilen, places } = getState();

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

    <!-- ── Datasäkerhet ── -->
    <div class="settings-section">
      <div class="settings-section-title">Datasäkerhet</div>
      <div class="sync-status-card" id="storage-status-card">
        <div class="sync-status-row">
          <span class="sync-status-icon">🛡️</span>
          <div class="sync-status-text">
            <div class="sync-status-label" id="storage-status-label">Kontrollerar lagring…</div>
            <div class="sync-status-sub" id="storage-status-sub">Din data sparas i tre lager på enheten</div>
          </div>
        </div>
        <div style="font-size:13px;color:var(--c-text-2);line-height:1.7;padding:2px 0 10px">
          Lagrat just nu: <strong>${shifts.length}</strong> pass · <strong>${blombilen.length}</strong> Blombilen-poster · <strong>${places.length}</strong> platser
        </div>
        <div id="persist-warning" class="hidden" style="padding:10px 12px;background:var(--c-warning-soft);border-radius:var(--radius-md);font-size:13px;color:var(--c-warning);margin-bottom:10px">
          ⚠️ Beständig lagring är inte garanterad än. Exportera en säkerhetskopia då och då för säkerhets skull.
        </div>
        <button class="btn btn-secondary btn-sm" id="persist-request-btn" style="display:none">🔒 Aktivera beständig lagring</button>
      </div>
    </div>

    <!-- ── Automatiska säkerhetskopior ── -->
    <div class="settings-section">
      <div class="settings-section-title">Automatiska säkerhetskopior</div>
      <div class="settings-card">
        <div style="padding:12px 16px 4px;font-size:13px;color:var(--c-text-muted)">
          Appen sparar automatiskt en kopia per dag (7 dagar bakåt). Råkade du radera något? Återställ här.
        </div>
        <div id="snapshots-list">
          <div style="padding:16px;font-size:13px;color:var(--c-text-muted)">Laddar…</div>
        </div>
      </div>
    </div>

    <!-- ── Export / Import ── -->
    <div class="settings-section">
      <div class="settings-section-title">Säkerhetskopia som fil</div>
      <div class="settings-card">
        <div class="settings-row" id="export-json-row" style="cursor:pointer">
          <span class="settings-row-icon">📦</span>
          <div class="settings-row-content">
            <div class="settings-row-label">Exportera säkerhetskopia</div>
            <div class="settings-row-desc">${settings.lastBackupAt ? 'Senast: ' + formatDateTime(settings.lastBackupAt) : 'Ladda ned all data som fil'}</div>
          </div>
          <span class="settings-row-arrow">›</span>
        </div>
        <div class="settings-row" id="import-row" style="cursor:pointer">
          <span class="settings-row-icon">📥</span>
          <div class="settings-row-content">
            <div class="settings-row-label">Importera säkerhetskopia</div>
            <div class="settings-row-desc">Läs in en tidigare exporterad fil</div>
          </div>
          <span class="settings-row-arrow">›</span>
        </div>
        <input type="file" id="import-file-input" accept=".json" style="display:none">
      </div>
    </div>

    <!-- ── Platser ── -->
    <div class="settings-section">
      <div class="settings-section-title">Platsregister</div>
      <div id="places-container"></div>
    </div>

    <!-- ── Danger zone ── -->
    <div class="settings-section">
      <div class="settings-section-title">Rensa data</div>
      <div class="settings-card">
        <div class="settings-row" id="clear-all-row" style="cursor:pointer">
          <span class="settings-row-icon">🗑️</span>
          <div class="settings-row-content">
            <div class="settings-row-label" style="color:var(--c-error)">Rensa all data</div>
            <div class="settings-row-desc">Tar bort alla pass och Blombilen-poster (säkerhetskopiorna finns kvar i 7 dagar)</div>
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
    refreshStorageStatus();
    refreshSnapshotsList();
  }
}

/* ── Lagringsstatus ── */
async function refreshStorageStatus() {
  const info = await getStorageInfo();
  const label = document.getElementById('storage-status-label');
  const sub   = document.getElementById('storage-status-sub');
  const warn  = document.getElementById('persist-warning');
  const btn   = document.getElementById('persist-request-btn');
  if (!label) return; // användaren har lämnat sidan

  if (info.persisted) {
    label.textContent = 'Beständig lagring aktiv ✓';
    label.style.color = 'var(--c-success)';
  } else {
    label.textContent = 'Lagring: standard';
    label.style.color = 'var(--c-warning)';
    warn?.classList.remove('hidden');
    if (btn) {
      btn.style.display = 'inline-flex';
      btn.addEventListener('click', async () => {
        const ok = await requestPersistentStorage();
        showToast(ok ? 'Beständig lagring aktiverad ✓' : 'Webbläsaren nekade — exportera säkerhetskopior i stället', ok ? 'success' : 'warning', 4000);
        refreshStorageStatus();
      }, { once: true });
    }
  }

  const parts = [];
  if (info.lastSavedAt) parts.push(`Senast sparad: ${formatDateTime(info.lastSavedAt)}`);
  if (info.usage != null) parts.push(`${(info.usage / 1024).toFixed(0)} kB använt`);
  if (info.idbOk === false) parts.push('⚠ IndexedDB otillgänglig');
  if (sub && parts.length) sub.textContent = parts.join(' · ');
}

/* ── Snapshots ── */
async function refreshSnapshotsList() {
  const wrap = document.getElementById('snapshots-list');
  if (!wrap) return;
  const snaps = await listSnapshots();

  if (!snaps.length) {
    wrap.innerHTML = '<div style="padding:16px;font-size:13px;color:var(--c-text-muted)">Inga säkerhetskopior än — de skapas automatiskt när du använder appen.</div>';
    return;
  }

  wrap.innerHTML = snaps.map(s => `
    <div class="settings-row">
      <span class="settings-row-icon">🗓️</span>
      <div class="settings-row-content">
        <div class="settings-row-label">${formatDay(s.day)}</div>
        <div class="settings-row-desc">${s.shifts} pass · ${s.blombilen} Blombilen-poster</div>
      </div>
      <button class="btn btn-secondary btn-sm" data-restore="${s.day}">Återställ</button>
    </div>
  `).join('');

  wrap.querySelectorAll('[data-restore]').forEach(btn => {
    btn.addEventListener('click', async () => {
      const day = btn.dataset.restore;
      const ok = await confirm(`Återställ datan som den såg ut ${formatDay(day)}? Nuvarande data ersätts (men dagens snapshot uppdateras inte förrän nästa ändring).`, { confirmText: 'Ja, återställ', danger: false });
      if (!ok) return;
      const snap = await getSnapshot(day);
      if (!snap) { showToast('Kunde inte läsa säkerhetskopian', 'error'); return; }
      setState({
        shifts:    snap.shifts    || [],
        blombilen: snap.blombilen || [],
        places:    snap.places    || getState().places,
      });
      showToast(`Data återställd från ${formatDay(day)} ✓`, 'success');
      renderSettings();
    });
  });
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

  // Export / Import
  document.getElementById('export-json-row')?.addEventListener('click', () => {
    doExportJSON();
    renderSettings();
  });
  document.getElementById('import-row')?.addEventListener('click', () => document.getElementById('import-file-input')?.click());
  document.getElementById('import-file-input')?.addEventListener('change', async (e) => {
    if (e.target.files[0]) {
      await doImport(e.target.files[0]);
      renderSettings();
    }
  });

  // Clear all
  document.getElementById('clear-all-row')?.addEventListener('click', async () => {
    const ok = await confirm('Är du säker? Alla pass och Blombilen-poster raderas. De automatiska säkerhetskopiorna (7 dagar) finns kvar om du ångrar dig.', { confirmText: 'Ja, rensa allt', danger: true });
    if (ok) {
      setState({ shifts: [], blombilen: [] });
      showToast('All data rensad', 'info');
      renderSettings();
    }
  });
}

/* ── Datum-helpers ── */
function formatDateTime(iso) {
  try {
    return new Date(iso).toLocaleString('sv-SE', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });
  } catch { return iso; }
}

function formatDay(day) {
  try {
    const d = new Date(day + 'T12:00:00');
    const todayStr = new Date().toISOString().slice(0, 10);
    if (day === todayStr) return 'Idag';
    return d.toLocaleDateString('sv-SE', { weekday: 'long', day: 'numeric', month: 'long' });
  } catch { return day; }
}
