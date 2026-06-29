/* ══════════════════════════════════════════
   app.js — Entry point
   ══════════════════════════════════════════ */

import { initState, getState, setState, on } from './state.js';
import { initRouter, registerPage, navigate } from './router.js';
import { initSync, updateSyncStatus } from './sync.js';
import { initModalClose, updateSyncIndicator, updateAlerts } from './ui.js';
import { getAlerts } from './validation.js';

import { renderDashboard } from './modules/dashboard.js';
import { renderBlombilen } from './modules/blombilen.js';
import { renderShifts }    from './modules/shifts.js';
import { renderSalaryView} from './modules/salaryView.js';
import { renderSettings }  from './modules/settings.js';
import { parseSetupToken } from './modules/settings.js';

/* ── Boot ── */
async function boot() {
  // Check for magic setup link BEFORE loading state
  const setupHandled = await handleSetupParam();
  if (setupHandled) return; // boot continues inside handleSetupParam

  // Init state from localStorage
  const state = initState();

  // Register service worker
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('./sw.js').catch(() => {});
  }

  // Show splash briefly
  await delay(800);

  // Decide: setup guide or main app?
  if (!state.settings.setupComplete && !state.settings.googleScriptUrl) {
    showSetupGuide();
  } else {
    showMainApp();
  }
}

/* ── Setup guide ── */
function showSetupGuide() {
  hideSplash();
  document.getElementById('setup-guide')?.classList.remove('hidden');
  let step = 1;

  const goTo = (n) => {
    step = n;
    document.querySelectorAll('.setup-step').forEach(el => el.classList.toggle('active', Number(el.dataset.step) === n));
    document.querySelectorAll('.setup-progress .dot').forEach((dot, i) => dot.classList.toggle('active', i < n));
  };

  document.getElementById('setup-configure-sync')?.addEventListener('click', () => goTo(2));
  document.getElementById('setup-skip-sync')?.addEventListener('click', () => {
    setState({ settings: { ...getState().settings, setupComplete: true } });
    document.getElementById('setup-guide')?.classList.add('hidden');
    showMainApp();
  });

  document.getElementById('setup-next-pin')?.addEventListener('click', () => {
    const url = document.getElementById('setup-script-url')?.value?.trim();
    if (!url) { alert('Klistra in Script-URL:en'); return; }
    goTo(3);
  });
  document.getElementById('setup-back-1')?.addEventListener('click', () => goTo(1));
  document.getElementById('setup-back-2')?.addEventListener('click', () => goTo(2));

  document.getElementById('setup-test-connection')?.addEventListener('click', async () => {
    const url = document.getElementById('setup-script-url')?.value?.trim();
    const pin = document.getElementById('setup-pin')?.value?.trim();
    const res = document.getElementById('setup-test-result');
    if (!url || !pin) { if (res) { res.textContent = 'Fyll i URL och PIN'; res.className = 'setup-test-result error'; res.classList.remove('hidden'); } return; }

    res.textContent = '⏳ Testar anslutning…';
    res.className   = 'setup-test-result';
    res.classList.remove('hidden');

    const { testConnection } = await import('./sync.js');
    const result = await testConnection(url, pin);

    res.textContent = result.message;
    res.className   = `setup-test-result ${result.ok ? 'success' : 'error'}`;

    if (result.ok) {
      setState({ settings: { ...getState().settings, googleScriptUrl: url, googlePin: pin, setupComplete: true } });
      setTimeout(() => goTo(4), 800);
    }
  });

  document.getElementById('setup-import-data')?.addEventListener('click', async () => {
    const { fetchFromGoogle } = await import('./sync.js');
    try {
      const data = await fetchFromGoogle();
      if (data) {
        setState({
          shifts:    data.shifts    || [],
          blombilen: data.blombilen || [],
          places:    data.places    || getState().places,
        });
      }
    } catch(e) {}
    goTo(5);
  });

  document.getElementById('setup-fresh-start')?.addEventListener('click', () => goTo(5));
  document.getElementById('setup-enter-app')?.addEventListener('click', () => {
    document.getElementById('setup-guide')?.classList.add('hidden');
    showMainApp();
  });
}

/* ── Main app ── */
function showMainApp() {
  hideSplash();
  const mainApp = document.getElementById('main-app');
  mainApp?.classList.remove('hidden');

  // Register pages
  registerPage('dashboard', renderDashboard);
  registerPage('blombilen', renderBlombilen);
  registerPage('shifts',    renderShifts);
  registerPage('salary',    renderSalaryView);
  registerPage('settings',  renderSettings);

  initModalClose();
  initRouter();
  initSync();

  // Reactive sync indicator
  on('syncChange', (sync) => updateSyncIndicator(sync));
  on('change', (state) => updateAlerts(getAlerts(state)));

  // Initial sync indicator
  updateSyncIndicator(getState().sync);
  updateAlerts(getAlerts(getState()));

  // Sync button tap — show status or trigger sync
  document.getElementById('sync-btn')?.addEventListener('click', async () => {
    const { settings, sync } = getState();
    if (!settings.googleScriptUrl) {
      navigate('settings');
      return;
    }
    if (sync.status === 'pending' || sync.queueCount > 0) {
      const { flushQueue } = await import('./sync.js');
      flushQueue();
    }
  });
}

function hideSplash() {
  const splash = document.getElementById('splash');
  if (splash) {
    splash.style.transition = 'opacity .4s ease';
    splash.style.opacity = '0';
    setTimeout(() => splash.remove(), 420);
  }
}

function delay(ms) { return new Promise(r => setTimeout(r, ms)); }

/* ── Magic setup-link handler ── */
async function handleSetupParam() {
  const params = new URLSearchParams(location.search);
  const token  = params.get('setup');
  if (!token) return false;

  // Remove ?setup=... from URL immediately so PIN isn't visible
  history.replaceState({}, '', location.pathname + location.hash);

  // Show splash while processing
  await delay(600);
  hideSplash();

  // Show setup overlay
  const overlay = document.createElement('div');
  overlay.id = 'setup-overlay';
  overlay.style.cssText = `
    position:fixed;inset:0;z-index:800;
    background:var(--c-bg);display:flex;align-items:center;justify-content:center;
    padding:24px;font-family:var(--font);
  `;
  overlay.innerHTML = `
    <div style="max-width:400px;width:100%;text-align:center">
      <div id="setup-ol-icon" style="font-size:56px;margin-bottom:16px">🔗</div>
      <h2 id="setup-ol-title" style="font-size:24px;font-weight:700;color:var(--c-primary);margin-bottom:10px">Kopplar enhet…</h2>
      <p id="setup-ol-msg" style="font-size:15px;color:var(--c-text-muted);line-height:1.6;margin-bottom:24px">Läser setup-länk…</p>
      <div id="setup-ol-actions" style="display:flex;flex-direction:column;gap:10px"></div>
    </div>
  `;
  document.body.appendChild(overlay);

  const setStatus = (icon, title, msg, actions = '') => {
    document.getElementById('setup-ol-icon').textContent  = icon;
    document.getElementById('setup-ol-title').textContent = title;
    document.getElementById('setup-ol-msg').textContent   = msg;
    document.getElementById('setup-ol-actions').innerHTML = actions;
  };

  // Parse token
  const parsed = parseSetupToken(token);
  if (!parsed) {
    setStatus('❌', 'Ogiltig setup-länk', 'Länken är skadad eller har fel format. Be om en ny länk från den ursprungliga enheten.',
      `<button class="btn btn-primary btn-full" onclick="location.href='${location.pathname}'">Öppna appen</button>`);
    return true;
  }

  setStatus('⏳', 'Testar anslutning…', 'Ansluter till Google Apps Script…');

  // Test connection
  const { testConnection: testConn, fetchFromGoogle } = await import('./sync.js');
  const result = await testConn(parsed.url, parsed.pin);

  if (!result.ok) {
    setStatus('❌', 'Anslutning misslyckades', result.message || 'Kontrollera att Script-URL och PIN stämmer.',
      `<button class="btn btn-primary btn-full" onclick="location.href='${location.pathname}'">Öppna appen ändå</button>`);
    return true;
  }

  // Save settings
  initState();
  setState({
    settings: {
      ...getState().settings,
      googleScriptUrl: parsed.url,
      googlePin: parsed.pin,
      setupComplete: true,
      autoSync: true,
      syncOnChange: true,
    },
  });

  setStatus('📥', 'Hämtar data…', 'Laddar ner dina pass, Blombilen-poster och inställningar…');

  try {
    const data = await fetchFromGoogle();
    if (data) {
      setState({
        shifts:    data.shifts    || [],
        blombilen: data.blombilen || [],
        places:    data.places    || getState().places,
      });
    }
  } catch (_) { /* non-fatal — local state is enough */ }

  setStatus('✅', 'Enheten är kopplad!', 'Sync är aktivt och datan är hämtad. Du är redo att använda Blompasset.',
    `<button class="btn btn-primary btn-full" id="setup-ol-enter">Öppna Blompasset 🌸</button>`);

  document.getElementById('setup-ol-enter')?.addEventListener('click', () => {
    overlay.style.transition = 'opacity .3s';
    overlay.style.opacity = '0';
    setTimeout(() => { overlay.remove(); showMainApp(); }, 320);
  });

  return true;
}

boot().catch(console.error);
