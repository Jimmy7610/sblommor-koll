/* ══════════════════════════════════════════
   app.js — Entry point
   Boot: ladda data → splash väntar på
   tryck/tangent → huvudapp. Ingen sync —
   all data trippel-sparas lokalt.
   ══════════════════════════════════════════ */

import { initStateAsync, getState, on } from './state.js';
import { initRouter, registerPage, navigate } from './router.js';
import { requestPersistentStorage } from './storage.js';
import { initModalClose, updateSaveIndicator, updateAlerts } from './ui.js';
import { getAlerts } from './validation.js';
import { initEffects } from './effects.js';

import { renderDashboard } from './modules/dashboard.js';
import { renderBlombilen } from './modules/blombilen.js';
import { renderShifts }    from './modules/shifts.js';
import { renderSalaryView} from './modules/salaryView.js';
import { renderSettings }  from './modules/settings.js';

/* ── Boot ── */
async function boot() {
  // Ladda state från bästa tillgängliga lagringskälla
  await initStateAsync();

  // Be webbläsaren om beständig lagring (datan får inte rensas)
  requestPersistentStorage();

  // Service worker för offline-stöd
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('./sw.js').catch(() => {});
  }

  // Splash: stanna kvar tills användaren trycker (skärm eller tangent)
  await waitForSplashDismiss();
  showMainApp();
}

/* ── Splash väntar på interaktion ── */
function waitForSplashDismiss() {
  return new Promise((resolve) => {
    const splash = document.getElementById('splash');
    if (!splash) { resolve(); return; }

    // Visa "tryck för att öppna"-hinten när blomman blommat klart
    setTimeout(() => splash.classList.add('ready'), 1200);

    let done = false;
    const dismiss = () => {
      if (done) return;
      done = true;
      document.removeEventListener('keydown', dismiss);
      splash.classList.add('leaving');
      setTimeout(() => { splash.remove(); resolve(); }, 500);
    };

    splash.addEventListener('pointerdown', dismiss, { once: false });
    document.addEventListener('keydown', dismiss);
  });
}

/* ── Main app ── */
function showMainApp() {
  const mainApp = document.getElementById('main-app');
  mainApp?.classList.remove('hidden');

  // Register pages
  registerPage('dashboard', renderDashboard);
  registerPage('blombilen', renderBlombilen);
  registerPage('shifts',    renderShifts);
  registerPage('salary',    renderSalaryView);
  registerPage('settings',  renderSettings);

  initModalClose();
  initEffects();
  initRouter();

  // Spar-indikator i headern: blinka "Sparar…" → "Sparad HH:MM" vid varje ändring
  on('change', () => {
    updateSaveIndicator();
    updateAlerts(getAlerts(getState()));
  });

  updateSaveIndicator();
  updateAlerts(getAlerts(getState()));

  // Tryck på spar-indikatorn → gå till Inställningar (datasäkerhet)
  document.getElementById('save-btn')?.addEventListener('click', () => navigate('settings'));
}

boot().catch(console.error);
