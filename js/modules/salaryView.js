/* ══════════════════════════════════════════
   salaryView.js — Lön & rapport
   ══════════════════════════════════════════ */

import { getState, setState } from '../state.js';
import { calcMonthSummary } from '../salary.js';
import { currentMonth, prevMonth, nextMonth, monthLabel, formatCurrency, formatHours } from '../dates.js';
import { doExportCSV, doExportJSON, doPrint } from '../exports.js';
import { openModal, closeModal, showToast, esc } from '../ui.js';

let _month = currentMonth();

export function renderSalaryView() {
  const state = getState();
  if (state.ui.salaryMonth) _month = state.ui.salaryMonth;

  const monthShifts = state.shifts.filter(s => s.date.startsWith(_month));
  const summary     = calcMonthSummary(monthShifts, state.settings);
  const { settings } = state;

  const hasRate = !!settings.hourlyRate;

  const html = `
    <!-- Period selector -->
    <div class="salary-period-selector">
      <button class="period-nav" id="sal-prev">‹</button>
      <div class="period-label">${monthLabel(_month)}</div>
      <button class="period-nav" id="sal-next">›</button>
    </div>

    ${!hasRate ? `
      <div style="background:var(--c-warning-soft);border-radius:var(--radius-md);padding:14px;font-size:14px;color:var(--c-warning);margin-bottom:16px">
        ⚠️ Ange din timlön i Inställningar för att se lönerapporter
      </div>
    ` : ''}

    <!-- Big net pay card -->
    <div class="salary-big-card">
      <div class="salary-big-label">Nettolön jobbade pass</div>
      <div class="salary-big-value">${hasRate ? formatCurrency(summary.worked.net) : '—'}</div>
      <div class="salary-big-sub">${formatHours(summary.worked.hours)} · ${summary.worked.shifts} pass</div>
    </div>

    <!-- Breakdown -->
    <div class="salary-breakdown">
      <div class="breakdown-row">
        <span class="breakdown-label">Bruttolön (${formatHours(summary.worked.hours)} × ${settings.hourlyRate || 0} kr)</span>
        <span class="breakdown-value">${hasRate ? formatCurrency(summary.worked.gross) : '—'}</span>
      </div>
      ${summary.worked.obAddition > 0 ? `
        <div class="breakdown-row">
          <span class="breakdown-label">OB-tillägg</span>
          <span class="breakdown-value positive">+${formatCurrency(summary.worked.obAddition)}</span>
        </div>
      ` : ''}
      <div class="breakdown-row">
        <span class="breakdown-label">Semesterersättning (${settings.vacationPayRate || 12}%)</span>
        <span class="breakdown-value positive">${hasRate ? '+' + formatCurrency(summary.worked.vacation) : '—'}</span>
      </div>
      <div class="breakdown-row">
        <span class="breakdown-label">Preliminär skatt (${settings.taxRate || 30}%)</span>
        <span class="breakdown-value negative">${hasRate ? '−' + formatCurrency(summary.worked.tax) : '—'}</span>
      </div>
      <div class="breakdown-row total">
        <span class="breakdown-label">Nettolön</span>
        <span class="breakdown-value">${hasRate ? formatCurrency(summary.worked.net) : '—'}</span>
      </div>
    </div>

    <!-- Planned prognosis -->
    ${summary.planned.shifts > 0 ? `
      <div class="card" style="margin-bottom:16px">
        <div class="card-header">
          <span class="card-title">📊 Prognos planerade pass</span>
          <span style="font-size:12px;color:var(--c-text-muted)">${summary.planned.shifts} pass kvar</span>
        </div>
        <div class="card-body" style="padding:12px 16px">
          <div class="stat-grid" style="grid-template-columns:1fr 1fr">
            <div class="stat-card">
              <div class="stat-label">Timmar kvar</div>
              <div class="stat-value" style="font-size:18px">${formatHours(summary.planned.hours)}</div>
            </div>
            <div class="stat-card">
              <div class="stat-label">Prognos netto</div>
              <div class="stat-value" style="font-size:18px">${hasRate ? formatCurrency(summary.planned.net) : '—'}</div>
            </div>
          </div>
          <div style="margin-top:12px;padding:10px;background:var(--c-primary-soft);border-radius:var(--radius-md);font-size:14px;color:var(--c-primary);font-weight:600;text-align:center">
            Total månadsprognos: ${hasRate ? formatCurrency(summary.worked.net + summary.planned.net) : '—'}
          </div>
        </div>
      </div>
    ` : ''}

    <!-- Shifts list for month -->
    ${monthShifts.length ? `
      <div class="section-header" style="margin-bottom:12px">
        <span class="section-title">📋 Pass denna månad</span>
      </div>
      <div class="salary-breakdown" style="margin-bottom:16px">
        ${monthShifts.sort((a,b) => a.date.localeCompare(b.date)).map(s => renderShiftRow(s, settings)).join('')}
      </div>
    ` : ''}

    <!-- Settings shortcut -->
    <div class="card" style="margin-bottom:16px">
      <div class="card-body" style="display:flex;align-items:center;gap:12px">
        <span style="font-size:24px">⚙️</span>
        <div style="flex:1">
          <div style="font-size:14px;font-weight:600">Löneinställningar</div>
          <div style="font-size:12px;color:var(--c-text-muted)">
            ${settings.hourlyRate || 0} kr/h · ${settings.taxRate || 30}% skatt · ${settings.vacationPayRate || 12}% semesterersättning
          </div>
        </div>
        <button class="btn btn-secondary btn-sm" id="sal-open-settings">Ändra</button>
      </div>
    </div>

    <!-- Export -->
    <div class="card">
      <div class="card-header"><span class="card-title">📤 Exportera</span></div>
      <div class="card-body" style="display:flex;flex-wrap:wrap;gap:8px">
        <button class="btn btn-ghost btn-sm" id="sal-csv">CSV</button>
        <button class="btn btn-ghost btn-sm" id="sal-json">JSON-backup</button>
        <button class="btn btn-ghost btn-sm" id="sal-print">🖨 Skriv ut</button>
      </div>
    </div>
  `;

  const container = document.getElementById('salary-inner');
  if (!container) return;
  container.innerHTML = `<div class="page-header"><h2 class="page-title">💰 Lön & Rapport</h2></div>${html}`;
  bindSalaryEvents();
}

function renderShiftRow(s, settings) {
  const { calcHours } = window.__blompasset_dates || {};
  const h = calcWorkedHours(s);
  const gross = h * (settings.hourlyRate || 0) + (s.hasOB ? h * (s.obRate || settings.defaultOBRate || 0) : 0);
  return `
    <div class="breakdown-row">
      <span class="breakdown-label">
        ${s.date.slice(5)} ${s.startTime}–${s.endTime}
        <span style="font-size:11px;color:var(--c-text-muted)"> · ${s.status}</span>
      </span>
      <span class="breakdown-value" style="font-size:13px">
        ${h.toFixed(1)}h · ${settings.hourlyRate ? formatCurrency(gross) : '—'}
      </span>
    </div>
  `;
}

function calcWorkedHours(shift) {
  if (!shift.startTime || !shift.endTime) return 0;
  const [sh, sm] = shift.startTime.split(':').map(Number);
  const [eh, em] = shift.endTime.split(':').map(Number);
  const s = sh*60+sm, e = eh*60+em + (eh*60+em < sh*60+sm ? 1440 : 0);
  return Math.max(0, e - s - (Number(shift.breakMinutes)||0)) / 60;
}

function bindSalaryEvents() {
  document.getElementById('sal-prev')?.addEventListener('click', () => { _month = prevMonth(_month); setState({ ui: { ...getState().ui, salaryMonth: _month } }, {persist:true,notify:false}); renderSalaryView(); });
  document.getElementById('sal-next')?.addEventListener('click', () => { _month = nextMonth(_month); setState({ ui: { ...getState().ui, salaryMonth: _month } }, {persist:true,notify:false}); renderSalaryView(); });
  document.getElementById('sal-csv')?.addEventListener('click',  () => doExportCSV(_month));
  document.getElementById('sal-json')?.addEventListener('click', () => doExportJSON());
  document.getElementById('sal-print')?.addEventListener('click',() => doPrint());
  document.getElementById('sal-open-settings')?.addEventListener('click', () => {
    import('./settings.js').then(m => { import('../router.js').then(r => r.navigate('settings')); });
  });
}
