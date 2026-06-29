/* ══════════════════════════════════════════
   calendar.js — Kalenderöversikt (inbäddad i dashboard)
   ══════════════════════════════════════════ */

import { getState } from '../state.js';
import { today, currentMonth, prevMonth, nextMonth, monthLabel, getMonthDays, relativeDate, formatTime, calcHours, formatHours } from '../dates.js';
import { openModal, closeModal, esc } from '../ui.js';

let _calMonth = currentMonth();

export function renderCalendar(containerId = 'cal-container') {
  const container = document.getElementById(containerId);
  if (!container) return;

  const { shifts, blombilen } = getState();
  const days = getMonthDays(_calMonth);
  const todayStr = today();

  const shiftDays   = new Set(shifts.map(s => s.date));
  const blomDays    = new Set(blombilen.map(b => b.date));
  const bothDays    = new Set([...shiftDays].filter(d => blomDays.has(d)));

  const weekdays = ['Mån', 'Tis', 'Ons', 'Tor', 'Fre', 'Lör', 'Sön'];

  container.innerHTML = `
    <div class="card">
      <div style="display:flex;align-items:center;justify-content:space-between;padding:12px 16px;border-bottom:1px solid var(--c-border-soft)">
        <button class="btn btn-ghost btn-sm btn-icon" id="cal-prev">‹</button>
        <span style="font-size:15px;font-weight:700;text-transform:capitalize">${monthLabel(_calMonth)}</span>
        <button class="btn btn-ghost btn-sm btn-icon" id="cal-next">›</button>
      </div>
      <div class="calendar-grid">
        <div class="cal-weekdays">
          ${weekdays.map(d => `<div class="cal-weekday">${d}</div>`).join('')}
        </div>
        <div class="cal-days" id="cal-days">
          ${days.map(day => {
            if (!day) return `<div class="cal-day empty"></div>`;
            const d = day.slice(-2);
            const hasShift = shiftDays.has(day);
            const hasBlom  = blomDays.has(day);
            const dots = hasShift || hasBlom ? `<div class="cal-dots">
              ${hasShift ? `<span class="cal-dot shift"></span>` : ''}
              ${hasBlom  ? `<span class="cal-dot blombilen"></span>` : ''}
            </div>` : '';
            return `<div class="cal-day${day === todayStr ? ' today' : ''}" data-day="${day}">${d}${dots}</div>`;
          }).join('')}
        </div>
      </div>
      <!-- Legend -->
      <div style="display:flex;gap:16px;padding:10px 16px;font-size:12px;color:var(--c-text-muted)">
        <span><span class="cal-dot shift" style="display:inline-block;margin-right:4px"></span>Pass</span>
        <span><span class="cal-dot blombilen" style="display:inline-block;margin-right:4px"></span>Blombilen</span>
      </div>
    </div>
  `;

  container.querySelector('#cal-prev')?.addEventListener('click', () => { _calMonth = prevMonth(_calMonth); renderCalendar(containerId); });
  container.querySelector('#cal-next')?.addEventListener('click', () => { _calMonth = nextMonth(_calMonth); renderCalendar(containerId); });

  container.querySelectorAll('.cal-day[data-day]').forEach(el => {
    el.addEventListener('click', () => openDayModal(el.dataset.day, shifts, blombilen));
  });
}

function openDayModal(day, shifts, blombilen) {
  const dayShifts = shifts.filter(s => s.date === day);
  const dayBlom   = blombilen.filter(b => b.date === day);
  const label     = relativeDate(day);

  openModal({
    title: `📆 ${label} · ${day.slice(5)}`,
    content: `
      ${dayShifts.length ? `
        <div style="margin-bottom:16px">
          <div class="section-title" style="margin-bottom:8px">Arbetspass</div>
          ${dayShifts.map(s => `
            <div style="background:var(--c-primary-soft);border-radius:var(--radius-md);padding:12px;margin-bottom:8px">
              <div style="font-weight:700;color:var(--c-primary)">${formatTime(s.startTime)} – ${formatTime(s.endTime)}</div>
              <div style="font-size:13px;color:var(--c-text-muted)">${formatHours(calcHours(s))} · ${s.status}</div>
              ${s.note ? `<div style="font-size:13px;margin-top:4px">${esc(s.note)}</div>` : ''}
            </div>
          `).join('')}
        </div>
      ` : ''}
      ${dayBlom.length ? `
        <div>
          <div class="section-title" style="margin-bottom:8px">Blombilen</div>
          ${dayBlom.map(b => `
            <div style="background:var(--c-accent-soft);border-radius:var(--radius-md);padding:12px;margin-bottom:8px">
              <div style="font-weight:700;color:var(--c-accent)">${esc(b.place)}</div>
              <div style="font-size:13px;color:var(--c-text-2);margin-top:4px">${esc(b.itemsText || '')}</div>
              <div style="font-size:12px;color:var(--c-text-muted);margin-top:4px">${b.status} · ${b.priority}</div>
            </div>
          `).join('')}
        </div>
      ` : ''}
      ${!dayShifts.length && !dayBlom.length ? `
        <div style="text-align:center;padding:24px;color:var(--c-text-muted)">
          Inga poster för den här dagen
        </div>
      ` : ''}
      <div style="margin-top:16px">
        <button class="btn btn-ghost btn-full" id="modal-cancel">Stäng</button>
      </div>
    `,
  });
  document.getElementById('modal-cancel')?.addEventListener('click', closeModal);
}
