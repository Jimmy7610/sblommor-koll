/* ══════════════════════════════════════════
   blombilen.js — Blombilen module
   ══════════════════════════════════════════ */

import { getState, addBlombilen, updateBlombilen, deleteBlombilen } from '../state.js';
import { openModal, closeModal, showToast, confirm, emptyState, esc } from '../ui.js';
import { today, tomorrow, formatDate, relativeDate } from '../dates.js';
import { validateBlombilen, showFieldErrors, hasErrors } from '../validation.js';

let _currentFilter = 'tomorrow';

export function renderBlombilen() {
  const { blombilen } = getState();
  applyFilter(_currentFilter, blombilen);
  bindFilterChips();
  bindFAB();
}

function applyFilter(filter, blombilen) {
  _currentFilter = filter;
  const todayStr    = today();
  const tomorrowStr = tomorrow();

  let items;
  switch (filter) {
    case 'today':     items = blombilen.filter(b => b.date === todayStr); break;
    case 'tomorrow':  items = blombilen.filter(b => b.date === tomorrowStr); break;
    case 'important': items = blombilen.filter(b => b.priority !== 'normal'); break;
    default:          items = [...blombilen];
  }
  items.sort((a, b) => a.date.localeCompare(b.date) || priorityOrder(a.priority) - priorityOrder(b.priority));

  const list = document.getElementById('blombilen-list');
  if (!list) return;

  if (!items.length) {
    list.innerHTML = emptyState('🚐', 'Inga poster', filterEmptyText(filter));
    return;
  }

  list.innerHTML = items.map(b => renderBlomItem(b)).join('');
  bindItemEvents(list);
}

function renderBlomItem(b) {
  const packed   = (b.itemRows || []).filter(r => r.packed).length;
  const total    = (b.itemRows || []).length;
  const hasProg  = total > 0;
  const pct      = hasProg ? Math.round((packed / total) * 100) : 0;

  return `
    <div class="list-item blombilen-item" data-id="${b.id}">
      <div class="blombilen-item-header">
        <div>
          <div class="blombilen-place">🏪 ${esc(b.place)}</div>
          <div class="blombilen-date">${relativeDate(b.date)} · ${formatDate(b.date, 'short')}</div>
        </div>
        <div style="display:flex;gap:6px;align-items:center;flex-wrap:wrap;justify-content:flex-end">
          <span class="badge badge-${b.priority}">${priorityLabel(b.priority)}</span>
          <span class="badge badge-${b.status}">${statusLabel(b.status)}</span>
        </div>
      </div>
      ${b.itemsText ? `<div class="blombilen-items-text">${esc(b.itemsText)}</div>` : ''}
      ${b.itemRows?.length ? `
        <div class="blombilen-rows">
          ${b.itemRows.map(r => `
            <div class="blombilen-row ${r.packed ? 'packed' : ''}">
              <span class="blombilen-row-count">${r.count || ''}×</span>
              <span>${esc(r.item || '')}${r.category ? ` <span style="color:var(--c-text-muted);font-size:12px">(${esc(r.category)})</span>` : ''}</span>
              ${r.note ? `<span style="color:var(--c-text-muted);font-size:12px"> · ${esc(r.note)}</span>` : ''}
            </div>
          `).join('')}
        </div>
        ${hasProg ? `
          <div class="blombilen-progress">
            <div class="progress-bar"><div class="progress-fill" style="width:${pct}%"></div></div>
            <div class="progress-label">${packed}/${total} packade</div>
          </div>
        ` : ''}
      ` : ''}
      ${b.note ? `<div class="blombilen-note">📝 ${esc(b.note)}</div>` : ''}
      <div class="list-item-actions">
        ${b.status === 'to-pack' ? `<button class="btn btn-secondary btn-sm" data-action="pack" data-id="${b.id}">✓ Packad</button>` : ''}
        ${b.status === 'packed'  ? `<button class="btn btn-secondary btn-sm" data-action="deliver" data-id="${b.id}">🏪 Levererad</button>` : ''}
        <button class="btn btn-ghost btn-sm" data-action="edit" data-id="${b.id}">Redigera</button>
        <button class="btn btn-danger btn-sm" data-action="delete" data-id="${b.id}">Ta bort</button>
      </div>
    </div>
  `;
}

function bindItemEvents(list) {
  list.addEventListener('click', async (e) => {
    const btn = e.target.closest('[data-action]');
    if (!btn) return;
    const { action, id } = btn.dataset;

    if (action === 'pack')    { updateBlombilen(id, { status: 'packed' }); showToast('Markerad som packad ✓', 'success'); applyFilter(_currentFilter, getState().blombilen); }
    if (action === 'deliver') { updateBlombilen(id, { status: 'delivered' }); showToast('Markerad som levererad ✓', 'success'); applyFilter(_currentFilter, getState().blombilen); }
    if (action === 'edit')    { openBlombilenModal(id); }
    if (action === 'delete') {
      const ok = await confirm('Ta bort den här Blombilen-posten?');
      if (ok) { deleteBlombilen(id); showToast('Borttagen', 'info'); applyFilter(_currentFilter, getState().blombilen); }
    }
  });
}

function bindFilterChips() {
  const chips = document.getElementById('blombilen-filter-chips');
  chips?.querySelectorAll('.chip').forEach(chip => {
    chip.addEventListener('click', () => {
      chips.querySelectorAll('.chip').forEach(c => c.classList.remove('active'));
      chip.classList.add('active');
      applyFilter(chip.dataset.filter, getState().blombilen);
    });
    if (chip.dataset.filter === _currentFilter) chip.classList.add('active');
  });
}

function bindFAB() {
  const fab = document.getElementById('add-blombilen-btn');
  fab?.removeEventListener('click', openBlombilenModal);
  fab?.addEventListener('click', () => openBlombilenModal());
}

export function openBlombilenModal(editId = null) {
  const { blombilen, places } = getState();
  const existing = editId ? blombilen.find(b => b.id === editId) : null;
  const tomorrowStr = tomorrow();

  const inputMode = existing ? (existing.itemRows?.length ? 'structured' : 'quick') : 'quick';

  const placeOptions = places.map(p => `<option value="${esc(p.name)}" ${existing?.place === p.name ? 'selected' : ''}>${esc(p.name)}</option>`).join('');

  openModal({
    title: editId ? 'Redigera Blompost' : 'Ny Blompost',
    content: `
      <form id="blombilen-form" novalidate>
        <div class="form-row">
          <div class="form-group">
            <label class="form-label">Datum <span>*</span></label>
            <input type="date" name="date" id="field-date" class="form-input" value="${existing?.date || tomorrowStr}" required>
          </div>
          <div class="form-group">
            <label class="form-label">Prioritet</label>
            <select name="priority" class="form-select">
              <option value="normal"    ${!existing || existing.priority==='normal'    ? 'selected':''}>Normal</option>
              <option value="important" ${existing?.priority==='important'             ? 'selected':''}>Viktigt</option>
              <option value="urgent"    ${existing?.priority==='urgent'               ? 'selected':''}>Akut</option>
            </select>
          </div>
        </div>

        <div class="form-group">
          <label class="form-label">Plats <span>*</span></label>
          <select name="place" id="field-place" class="form-select" id="place-select">
            <option value="">Välj plats…</option>
            ${placeOptions}
            <option value="__custom__">Annan plats…</option>
          </select>
          <input type="text" name="placeCustom" id="place-custom-input" class="form-input mt-8 hidden" placeholder="Skriv platsnamn">
        </div>

        <div class="form-group">
          <label class="form-label">Status</label>
          <select name="status" class="form-select">
            <option value="to-pack"   ${!existing || existing.status==='to-pack'  ? 'selected':''}>Att packa</option>
            <option value="packed"    ${existing?.status==='packed'               ? 'selected':''}>Packad</option>
            <option value="delivered" ${existing?.status==='delivered'            ? 'selected':''}>Levererad</option>
          </select>
        </div>

        <!-- Input mode toggle -->
        <div class="form-group">
          <label class="form-label">Innehåll <span>*</span></label>
          <div class="input-mode-toggle">
            <button type="button" class="input-mode-btn ${inputMode==='quick'?'active':''}" data-mode="quick">Snabbtext</button>
            <button type="button" class="input-mode-btn ${inputMode==='structured'?'active':''}" data-mode="structured">Strukturerad</button>
          </div>
        </div>

        <!-- Quick text -->
        <div id="mode-quick" class="form-group ${inputMode!=='quick'?'hidden':''}">
          <textarea name="itemsText" id="field-items" class="form-textarea" placeholder="t.ex. 3 hortensia blå, 2 fredskalla, 1 arrangemang">${existing?.itemsText || ''}</textarea>
        </div>

        <!-- Structured rows -->
        <div id="mode-structured" class="${inputMode!=='structured'?'hidden':''}">
          <div class="struct-rows" id="struct-rows">
            ${(existing?.itemRows?.length ? existing.itemRows : [{ count:'', item:'', category:'', note:'', packed:false }]).map((r, i) => structRow(r, i)).join('')}
          </div>
          <button type="button" class="btn btn-ghost btn-sm" id="add-struct-row">+ Lägg till rad</button>
        </div>

        <div class="form-group mt-16">
          <label class="form-label">Anteckning</label>
          <textarea name="note" class="form-textarea" style="min-height:64px" placeholder="Valfri anteckning">${existing?.note || ''}</textarea>
        </div>

        <div class="modal-actions">
          <button type="submit" class="btn btn-primary btn-full">${editId ? 'Spara ändringar' : 'Lägg till'}</button>
          <button type="button" class="btn btn-ghost btn-full" id="modal-cancel">Avbryt</button>
        </div>
      </form>
    `,
  });

  bindBlombilenForm(editId, existing);
}

function structRow(r = {}, i = 0) {
  return `
    <div class="struct-row" data-row="${i}">
      <input type="number" class="form-input sr-count" placeholder="Ant." value="${r.count || ''}" min="1">
      <input type="text"   class="form-input sr-item"  placeholder="Blomma/vara" value="${esc(r.item || '')}">
      <button type="button" class="struct-row-remove" title="Ta bort rad">✕</button>
    </div>
    <div class="struct-row-details" style="grid-column:1/-1;display:flex;gap:8px;padding-left:68px;margin-top:-2px;margin-bottom:4px">
      <input type="text" class="form-input sr-category" placeholder="Kategori" value="${esc(r.category || '')}" style="flex:1">
      <input type="text" class="form-input sr-note"     placeholder="Not"      value="${esc(r.note || '')}"     style="flex:1">
      <label style="display:flex;align-items:center;gap:4px;font-size:13px;white-space:nowrap;padding:0 8px">
        <input type="checkbox" class="sr-packed" ${r.packed ? 'checked' : ''}> Packad
      </label>
    </div>
  `;
}

function bindBlombilenForm(editId, existing) {
  const form   = document.getElementById('blombilen-form');
  const select = form?.querySelector('[name="place"]');
  const custom = document.getElementById('place-custom-input');
  if (existing?.place && !getState().places.find(p => p.name === existing.place)) {
    select.value = '__custom__';
    custom.value = existing.place;
    custom.classList.remove('hidden');
  }

  select?.addEventListener('change', () => {
    const isCustom = select.value === '__custom__';
    custom.classList.toggle('hidden', !isCustom);
    if (isCustom) custom.focus();
  });

  // Mode toggle
  let currentMode = existing?.itemRows?.length ? 'structured' : 'quick';
  form?.querySelectorAll('.input-mode-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      currentMode = btn.dataset.mode;
      form.querySelectorAll('.input-mode-btn').forEach(b => b.classList.toggle('active', b.dataset.mode === currentMode));
      document.getElementById('mode-quick').classList.toggle('hidden', currentMode !== 'quick');
      document.getElementById('mode-structured').classList.toggle('hidden', currentMode !== 'structured');
    });
  });

  // Add struct row
  let rowCount = existing?.itemRows?.length || 1;
  document.getElementById('add-struct-row')?.addEventListener('click', () => {
    const rows = document.getElementById('struct-rows');
    const tmp = document.createElement('div');
    tmp.innerHTML = structRow({}, rowCount++);
    [...tmp.children].forEach(c => rows.appendChild(c));
    bindRowRemove(rows);
  });
  bindRowRemove(document.getElementById('struct-rows'));

  // Cancel
  document.getElementById('modal-cancel')?.addEventListener('click', closeModal);

  // Submit
  form?.addEventListener('submit', (e) => {
    e.preventDefault();
    const fd = new FormData(form);
    const placeVal = fd.get('place') === '__custom__' ? (custom?.value?.trim() || '') : fd.get('place');

    const itemRows = currentMode === 'structured' ? collectStructRows(form) : [];

    const data = {
      date:      fd.get('date'),
      place:     placeVal,
      priority:  fd.get('priority'),
      status:    fd.get('status'),
      itemsText: currentMode === 'quick' ? (fd.get('itemsText') || '').trim() : '',
      itemRows,
      note:      (fd.get('note') || '').trim(),
    };

    const errors = validateBlombilen(data);
    if (hasErrors(errors)) { showFieldErrors(form, errors); return; }

    if (editId) { updateBlombilen(editId, data); showToast('Sparad ✓', 'success'); }
    else        { addBlombilen(data); showToast('Tillagd ✓', 'success'); }

    closeModal();
    applyFilter(_currentFilter, getState().blombilen);
  });
}

function bindRowRemove(container) {
  container?.querySelectorAll('.struct-row-remove').forEach(btn => {
    btn.onclick = () => {
      const row = btn.closest('.struct-row');
      const det = row?.nextElementSibling;
      row?.remove(); det?.remove();
    };
  });
}

function collectStructRows(form) {
  const rows = [];
  form.querySelectorAll('.struct-row').forEach(rowEl => {
    const det = rowEl.nextElementSibling;
    const item = rowEl.querySelector('.sr-item')?.value?.trim();
    if (!item) return;
    rows.push({
      count:    rowEl.querySelector('.sr-count')?.value    || '',
      item,
      category: det?.querySelector('.sr-category')?.value?.trim() || '',
      note:     det?.querySelector('.sr-note')?.value?.trim()     || '',
      packed:   det?.querySelector('.sr-packed')?.checked         || false,
    });
  });
  return rows;
}

/* ── Labels / helpers ── */
function priorityOrder(p) { return { urgent: 0, important: 1, normal: 2 }[p] ?? 2; }
function priorityLabel(p) { return { normal: 'Normal', important: '⭐ Viktigt', urgent: '🔴 Akut' }[p] ?? p; }
function statusLabel(s)   { return { 'to-pack': 'Att packa', 'packed': '✅ Packad', 'delivered': '🏪 Levererad' }[s] ?? s; }
function filterEmptyText(f) {
  return { today: 'Inga poster för idag', tomorrow: 'Inga poster för imorgon', important: 'Inga viktiga poster', all: 'Tryck + för att lägga till din första post' }[f] || '';
}
