/* ══════════════════════════════════════════
   shifts.js — Arbetspass module
   ══════════════════════════════════════════ */

import { getState, addShift, updateShift, deleteShift } from '../state.js';
import { openModal, closeModal, showToast, confirm, emptyState, esc } from '../ui.js';
import { today, formatDate, formatTime, calcHours, formatHours, relativeDate } from '../dates.js';
import { validateShift, showFieldErrors, hasErrors } from '../validation.js';
import { enqueue } from '../sync.js';

let _currentFilter = 'upcoming';

export function renderShifts() {
  applyFilter(_currentFilter);
  bindFilterChips();
  bindFAB();
}

function applyFilter(filter) {
  _currentFilter = filter;
  const { shifts } = getState();
  const todayStr = today();
  let items;

  switch (filter) {
    case 'upcoming': items = shifts.filter(s => s.date >= todayStr && s.status === 'planned').sort(byDate); break;
    case 'worked':   items = shifts.filter(s => s.status === 'worked').sort((a, b) => b.date.localeCompare(a.date)); break;
    default:         items = [...shifts].sort((a, b) => b.date.localeCompare(a.date)); break;
  }

  const list = document.getElementById('shifts-list');
  if (!list) return;

  if (!items.length) {
    list.innerHTML = emptyState('📅', 'Inga pass', filterEmpty(filter));
    return;
  }

  list.innerHTML = renderGrouped(items);
  list.querySelectorAll('[data-action]').forEach(btn => {
    btn.addEventListener('click', handleShiftAction);
  });
}

function renderGrouped(shifts) {
  const groups = {};
  shifts.forEach(s => {
    const key = s.date.slice(0, 7); // YYYY-MM
    if (!groups[key]) groups[key] = [];
    groups[key].push(s);
  });

  return Object.entries(groups).map(([month, monthShifts]) => {
    const label = new Date(month + '-01').toLocaleDateString('sv-SE', { month: 'long', year: 'numeric' });
    return `
      <div class="shift-date-bar" style="text-transform:capitalize">${label}</div>
      ${monthShifts.map(s => renderShiftItem(s)).join('')}
    `;
  }).join('');
}

function renderShiftItem(s) {
  const hours = calcHours(s);
  const todayStr = today();

  return `
    <div class="list-item shift-item" data-id="${s.id}">
      <div class="list-item-body">
        <div class="list-item-top">
          <div>
            <div style="font-size:12px;font-weight:700;color:var(--c-text-muted);letter-spacing:.4px;text-transform:uppercase;margin-bottom:2px">
              ${formatDate(s.date, 'day')}${s.date === todayStr ? ' · <span style="color:var(--c-primary)">Idag</span>' : ''}
            </div>
            <div class="shift-time">${formatTime(s.startTime)} – ${formatTime(s.endTime)}</div>
            <div class="shift-duration">${formatHours(hours)}${s.breakMinutes ? ` · ${s.breakMinutes} min rast` : ''}</div>
          </div>
          <div style="display:flex;flex-direction:column;gap:4px;align-items:flex-end">
            <span class="badge badge-${s.status}">${statusLabel(s.status)}</span>
            ${s.hasOB ? `<span class="badge" style="background:var(--c-info-soft);color:var(--c-info)">OB +${s.obRate||0} kr/h</span>` : ''}
          </div>
        </div>
        ${s.note ? `<div class="shift-note">📝 ${esc(s.note)}</div>` : ''}
      </div>
      <div class="list-item-actions">
        ${s.status === 'planned' ? `<button class="btn btn-secondary btn-sm" data-action="worked" data-id="${s.id}">✓ Jobbat</button>` : ''}
        <button class="btn btn-ghost btn-sm" data-action="edit" data-id="${s.id}">Redigera</button>
        <button class="btn btn-danger btn-sm" data-action="delete" data-id="${s.id}">Ta bort</button>
      </div>
    </div>
  `;
}

async function handleShiftAction(e) {
  const btn    = e.currentTarget;
  const { action, id } = btn.dataset;

  if (action === 'worked') {
    updateShift(id, { status: 'worked' });
    enqueue({ type: 'update', entity: 'shifts', id });
    showToast('Pass markerat som jobbat ✓', 'success');
    applyFilter(_currentFilter);
  }
  if (action === 'edit')   openShiftModal(id);
  if (action === 'delete') {
    const ok = await confirm('Ta bort det här arbetspasset?');
    if (ok) { deleteShift(id); enqueue({ type: 'delete', entity: 'shifts', id }); showToast('Borttaget', 'info'); applyFilter(_currentFilter); }
  }
}

function bindFilterChips() {
  const chips = document.getElementById('shifts-filter-chips');
  chips?.querySelectorAll('.chip').forEach(chip => {
    chip.addEventListener('click', () => {
      chips.querySelectorAll('.chip').forEach(c => c.classList.remove('active'));
      chip.classList.add('active');
      applyFilter(chip.dataset.filter);
    });
    if (chip.dataset.filter === _currentFilter) chip.classList.add('active');
  });
}

function bindFAB() {
  const fab = document.getElementById('add-shift-btn');
  fab?.addEventListener('click', () => openShiftModal());
}

export function openShiftModal(editId = null) {
  const { shifts, settings } = getState();
  const s = editId ? shifts.find(x => x.id === editId) : null;
  const todayStr = today();

  openModal({
    title: editId ? 'Redigera pass' : 'Nytt arbetspass',
    content: `
      <form id="shift-form" novalidate>
        <div class="form-group">
          <label class="form-label">Datum <span>*</span></label>
          <input type="date" name="date" id="field-date" class="form-input" value="${s?.date || todayStr}" required>
        </div>

        <div class="form-row">
          <div class="form-group">
            <label class="form-label">Starttid <span>*</span></label>
            <input type="time" name="startTime" id="field-startTime" class="form-input" value="${s?.startTime || '08:00'}" required>
          </div>
          <div class="form-group">
            <label class="form-label">Sluttid <span>*</span></label>
            <input type="time" name="endTime" id="field-endTime" class="form-input" value="${s?.endTime || '17:00'}" required>
          </div>
        </div>

        <div class="form-row">
          <div class="form-group">
            <label class="form-label">Rast (minuter)</label>
            <input type="number" name="breakMinutes" class="form-input" value="${s?.breakMinutes ?? 30}" min="0" max="240">
          </div>
          <div class="form-group">
            <label class="form-label">Status</label>
            <select name="status" class="form-select">
              <option value="planned" ${!s || s.status==='planned' ? 'selected':''}>Planerat</option>
              <option value="worked"  ${s?.status==='worked'       ? 'selected':''}>Jobbat</option>
              <option value="sick"    ${s?.status==='sick'         ? 'selected':''}>Sjuk</option>
              <option value="off"     ${s?.status==='off'          ? 'selected':''}>Ledig</option>
            </select>
          </div>
        </div>

        <div class="settings-card" style="margin-bottom:18px">
          <div class="toggle-row">
            <div class="toggle-info">
              <div class="toggle-label">OB-tillägg</div>
              <div class="toggle-desc">Obekväm arbetstid</div>
            </div>
            <label class="toggle">
              <input type="checkbox" name="hasOB" id="ob-toggle" ${s?.hasOB ?? settings.defaultOB ? 'checked' : ''}>
              <span class="toggle-track"></span>
              <span class="toggle-thumb"></span>
            </label>
          </div>
          <div id="ob-rate-row" class="${!(s?.hasOB ?? settings.defaultOB) ? 'hidden' : ''}" style="padding:0 16px 14px">
            <label class="form-label">OB kr/timme</label>
            <input type="number" name="obRate" class="form-input" value="${s?.obRate ?? settings.defaultOBRate ?? 0}" min="0">
          </div>
        </div>

        <div class="form-group">
          <label class="form-label">Anteckning</label>
          <textarea name="note" class="form-textarea" style="min-height:64px" placeholder="Valfri anteckning">${s?.note || ''}</textarea>
        </div>

        <div id="duration-preview" style="text-align:center;padding:10px;background:var(--c-primary-soft);border-radius:var(--radius-md);font-size:14px;color:var(--c-primary);font-weight:600;margin-bottom:16px"></div>

        <div class="modal-actions">
          <button type="submit" class="btn btn-primary btn-full">${editId ? 'Spara ändringar' : 'Lägg till pass'}</button>
          <button type="button" class="btn btn-ghost btn-full" id="modal-cancel">Avbryt</button>
        </div>
      </form>
    `,
  });

  bindShiftForm(editId);
}

function bindShiftForm(editId) {
  const form = document.getElementById('shift-form');
  const obToggle = document.getElementById('ob-toggle');
  const obRateRow = document.getElementById('ob-rate-row');
  const preview   = document.getElementById('duration-preview');

  obToggle?.addEventListener('change', () => { obRateRow?.classList.toggle('hidden', !obToggle.checked); });

  const updatePreview = () => {
    const fd = new FormData(form);
    const start = fd.get('startTime'), end = fd.get('endTime'), brk = Number(fd.get('breakMinutes') || 0);
    if (start && end) {
      const mock = { startTime: start, endTime: end, breakMinutes: brk };
      const h = calcHours(mock);
      preview.textContent = h > 0 ? `⏱ ${formatHours(h)} arbetstid` : '⚠️ Kontrollera tiderna';
    }
  };
  form?.querySelectorAll('[name="startTime"],[name="endTime"],[name="breakMinutes"]').forEach(el => el.addEventListener('input', updatePreview));
  updatePreview();

  document.getElementById('modal-cancel')?.addEventListener('click', closeModal);

  form?.addEventListener('submit', (e) => {
    e.preventDefault();
    const fd = new FormData(form);
    const data = {
      date:         fd.get('date'),
      startTime:    fd.get('startTime'),
      endTime:      fd.get('endTime'),
      breakMinutes: Number(fd.get('breakMinutes') || 0),
      status:       fd.get('status'),
      hasOB:        obToggle?.checked || false,
      obRate:       Number(fd.get('obRate') || 0),
      note:         (fd.get('note') || '').trim(),
    };

    const errors = validateShift(data);
    if (hasErrors(errors)) { showFieldErrors(form, errors); return; }

    if (editId) { updateShift(editId, data); enqueue({ type: 'update', entity: 'shifts', id: editId }); showToast('Sparad ✓', 'success'); }
    else        { addShift(data); enqueue({ type: 'add', entity: 'shifts' }); showToast('Pass tillagt ✓', 'success'); }

    closeModal();
    applyFilter(_currentFilter);
  });
}

const byDate = (a, b) => a.date.localeCompare(b.date) || a.startTime.localeCompare(b.startTime);
function statusLabel(s) { return { planned: 'Planerat', worked: 'Jobbat', sick: 'Sjuk', off: 'Ledig' }[s] ?? s; }
function filterEmpty(f) { return { upcoming: 'Inga kommande pass – tryck + för att lägga till', worked: 'Inga jobbade pass ännu', all: 'Tryck + för att lägga till ditt första pass' }[f] || ''; }
