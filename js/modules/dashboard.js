/* ══════════════════════════════════════════
   dashboard.js — Start-sida
   ══════════════════════════════════════════ */

import { getState } from '../state.js';
import { navigate } from '../router.js';
import { today, tomorrow, formatDate, formatTime, calcHours, formatHours, formatCurrency, relativeDate, daysUntil } from '../dates.js';
import { calcMonthSummary } from '../salary.js';
import { currentMonth } from '../dates.js';
import { getAlerts } from '../validation.js';
import { updateAlerts } from '../ui.js';

export function renderDashboard() {
  const state    = getState();
  const { shifts, blombilen, settings, sync } = state;
  const todayStr    = today();
  const tomorrowStr = tomorrow();
  const month       = currentMonth();

  // Alerts
  updateAlerts(getAlerts(state));

  // Next shift
  const upcoming = shifts
    .filter(s => s.status === 'planned' && s.date >= todayStr)
    .sort((a, b) => a.date.localeCompare(b.date) || a.startTime.localeCompare(b.startTime));
  const nextShift = upcoming[0] || null;

  // Month summary
  const monthShifts = shifts.filter(s => s.date.startsWith(month));
  const summary     = calcMonthSummary(monthShifts, settings);

  // Tomorrow's blombilen
  const tomorrowItems = blombilen.filter(b => b.date === tomorrowStr);
  const unpackedCount = tomorrowItems.filter(b => b.status === 'to-pack').length;

  // Today's shift check
  const todayShift = shifts.find(s => s.date === todayStr && s.status === 'planned');

  // Checklist
  const checklist = buildChecklist(state, todayStr, tomorrowStr, nextShift, unpackedCount);

  const hour = new Date().getHours();
  const greeting = hour < 10 ? 'God morgon' : hour < 12 ? 'God förmiddag' : hour < 17 ? 'God eftermiddag' : 'God kväll';

  const html = `
    <div class="dashboard-section">
      <p class="dashboard-greeting">${greeting}, <strong>Jimmy! 🌸</strong></p>
    </div>

    <!-- Next shift hero -->
    <div class="dashboard-section">
      ${nextShift ? `
        <div class="hero-card">
          <div class="hero-card-label">Nästa arbetspass</div>
          <div class="hero-card-value">${formatTime(nextShift.startTime)} – ${formatTime(nextShift.endTime)}</div>
          <div class="hero-card-sub">${formatDate(nextShift.date, 'long')}</div>
          ${nextShift.date === todayStr ? '<div class="hero-card-badge">🕐 Idag</div>'
            : nextShift.date === tomorrowStr ? '<div class="hero-card-badge">📅 Imorgon</div>'
            : `<div class="hero-card-badge">📅 Om ${daysUntil(nextShift.date)} dagar</div>`}
          ${nextShift.note ? `<div style="font-size:13px;opacity:.75;margin-top:8px">📝 ${nextShift.note}</div>` : ''}
        </div>
      ` : `
        <div class="card">
          <div class="card-body" style="text-align:center;padding:24px">
            <div style="font-size:36px;margin-bottom:8px">🌿</div>
            <div style="font-weight:600;color:var(--c-text-muted)">Inga kommande pass</div>
          </div>
        </div>
      `}
    </div>

    <!-- Stats row -->
    <div class="dashboard-section">
      <div class="section-header">
        <span class="section-title">📊 ${month.replace('-', '/').replace(/^0/, '')}</span>
        <button class="section-link" data-nav="salary">Rapport →</button>
      </div>
      <div class="stat-grid">
        <div class="stat-card">
          <div class="stat-label">Jobbade tim</div>
          <div class="stat-value">${summary.worked.hours.toFixed(1)}<span class="stat-unit"> h</span></div>
        </div>
        <div class="stat-card">
          <div class="stat-label">Planerade tim</div>
          <div class="stat-value">${summary.planned.hours.toFixed(1)}<span class="stat-unit"> h</span></div>
        </div>
        <div class="stat-card">
          <div class="stat-label">Lön hittills</div>
          <div class="stat-value" style="font-size:16px">${formatCurrency(summary.worked.net)}</div>
        </div>
        <div class="stat-card">
          <div class="stat-label">Prognos netto</div>
          <div class="stat-value" style="font-size:16px">${formatCurrency(summary.worked.net + summary.planned.net)}</div>
        </div>
      </div>
    </div>

    <!-- Blombilen imorgon -->
    <div class="dashboard-section">
      <div class="section-header">
        <span class="section-title">🚐 Blombilen imorgon</span>
        <button class="section-link" data-nav="blombilen">Visa →</button>
      </div>
      ${tomorrowItems.length ? `
        <div class="card">
          <div class="card-body">
            ${tomorrowItems.slice(0, 3).map(b => `
              <div style="display:flex;align-items:center;gap:10px;padding:8px 0;border-bottom:1px solid var(--c-border-soft)">
                <span style="font-size:18px">${statusIcon(b.status)}</span>
                <div style="flex:1">
                  <div style="font-size:14px;font-weight:600">${b.place}</div>
                  <div style="font-size:12px;color:var(--c-text-muted)">${b.itemsText || itemRowsSummary(b.itemRows)}</div>
                </div>
                <span class="badge badge-${b.status}">${statusLabel(b.status)}</span>
              </div>
            `).join('')}
            ${tomorrowItems.length > 3 ? `<div style="font-size:13px;color:var(--c-text-muted);padding-top:8px">+${tomorrowItems.length - 3} till</div>` : ''}
            ${unpackedCount > 0 ? `
              <div style="margin-top:12px;padding:10px;background:var(--c-warning-soft);border-radius:var(--radius-md);font-size:13px;color:var(--c-warning);font-weight:600">
                ⚠️ ${unpackedCount} saker kvar att packa
              </div>
            ` : `
              <div style="margin-top:12px;padding:10px;background:var(--c-success-soft);border-radius:var(--radius-md);font-size:13px;color:var(--c-success);font-weight:600">
                ✓ Allt packat!
              </div>
            `}
          </div>
        </div>
      ` : `
        <div class="card">
          <div class="card-body" style="text-align:center;padding:20px;color:var(--c-text-muted);font-size:14px">
            🌸 Inga Blombilen-poster för imorgon
          </div>
        </div>
      `}
    </div>

    <!-- Quick actions -->
    <div class="dashboard-section">
      <div class="section-title" style="margin-bottom:12px">⚡ Snabbknappar</div>
      <div class="quick-actions">
        <button class="quick-btn" data-quick="add-shift">
          <span class="quick-btn-icon">➕</span>
          Nytt pass
        </button>
        <button class="quick-btn" data-quick="add-blombilen">
          <span class="quick-btn-icon">🚐</span>
          Packlista
        </button>
        <button class="quick-btn" data-quick="mark-worked">
          <span class="quick-btn-icon">✅</span>
          Markera jobbat
        </button>
        <button class="quick-btn" data-quick="salary">
          <span class="quick-btn-icon">💰</span>
          Lönerapport
        </button>
      </div>
    </div>

    <!-- Daily checklist -->
    <div class="dashboard-section">
      <div class="section-title" style="margin-bottom:12px">📋 Daglig checklista</div>
      <div class="checklist">
        ${checklist.map(item => `
          <div class="checklist-item ${item.done ? 'done' : ''}">
            <span class="check-circle ${item.done ? 'done' : 'todo'}">${item.done ? '✓' : ''}</span>
            <span>${item.text}</span>
          </div>
        `).join('')}
      </div>
    </div>
  `;

  const container = document.getElementById('dashboard-inner');
  if (container) {
    container.innerHTML = html;
    bindDashboardEvents(container, nextShift, todayShift);
  }
}

function bindDashboardEvents(container, nextShift, todayShift) {
  container.querySelectorAll('[data-nav]').forEach(btn => {
    btn.addEventListener('click', () => navigate(btn.dataset.nav));
  });

  container.querySelectorAll('[data-quick]').forEach(btn => {
    btn.addEventListener('click', () => {
      const action = btn.dataset.quick;
      if (action === 'add-shift')    { navigate('shifts'); setTimeout(() => document.getElementById('add-shift-btn')?.click(), 200); }
      if (action === 'add-blombilen'){ navigate('blombilen'); setTimeout(() => document.getElementById('add-blombilen-btn')?.click(), 200); }
      if (action === 'salary')       navigate('salary');
      if (action === 'mark-worked' && todayShift) {
        import('../state.js').then(({ updateShift }) => {
          updateShift(todayShift.id, { status: 'worked' });
          import('../ui.js').then(({ showToast }) => showToast('Pass markerat som jobbat ✓', 'success'));
          renderDashboard();
        });
      } else if (action === 'mark-worked') {
        import('../ui.js').then(({ showToast }) => showToast('Inget planerat pass idag', 'info'));
      }
    });
  });
}

function buildChecklist(state, todayStr, tomorrowStr, nextShift, unpackedCount) {
  const items = [];
  const todayShift = state.shifts.find(s => s.date === todayStr && s.status === 'planned');
  items.push({ text: 'Dagens arbetspass markerat', done: !todayShift });
  items.push({ text: `Blombilen till imorgon packad`, done: unpackedCount === 0 && state.blombilen.some(b => b.date === tomorrowStr) });
  items.push({ text: 'Timlön inställd', done: !!state.settings.hourlyRate });
  items.push({ text: 'Google Sync aktiv', done: !!state.settings.googleScriptUrl });
  return items;
}

function statusIcon(status) {
  return { 'to-pack': '📦', 'packed': '✅', 'delivered': '🏪' }[status] ?? '📦';
}
function statusLabel(status) {
  return { 'to-pack': 'Att packa', 'packed': 'Packad', 'delivered': 'Levererad' }[status] ?? status;
}
function itemRowsSummary(rows) {
  if (!rows?.length) return '';
  return rows.slice(0, 2).map(r => `${r.count || ''} ${r.item || ''}`.trim()).join(', ');
}
