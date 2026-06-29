/* ══════════════════════════════════════════
   places.js — Platsregister
   ══════════════════════════════════════════ */

import { getState, addPlace, updatePlace, deletePlace } from '../state.js';
import { openModal, closeModal, showToast, confirm, esc } from '../ui.js';

export function renderPlaces(container) {
  if (!container) return;
  const { places } = getState();

  container.innerHTML = `
    <div class="settings-card">
      <div class="places-list" id="places-list">
        ${places.map(p => `
          <div class="settings-row" data-place-id="${p.id}" style="padding:12px 16px">
            <span class="settings-row-icon">📍</span>
            <div class="settings-row-content">
              <div class="settings-row-label">${esc(p.name)}</div>
              ${p.note ? `<div class="settings-row-desc">${esc(p.note)}</div>` : ''}
            </div>
            <div style="display:flex;gap:6px">
              <button class="btn btn-ghost btn-sm place-edit" data-id="${p.id}">Redigera</button>
              <button class="btn btn-danger btn-sm place-delete" data-id="${p.id}">✕</button>
            </div>
          </div>
        `).join('')}
      </div>
      <div style="padding:12px 16px;border-top:1px solid var(--c-border-soft)">
        <button class="btn btn-secondary btn-full btn-sm" id="add-place-btn">+ Lägg till plats</button>
      </div>
    </div>
  `;

  container.querySelector('#add-place-btn')?.addEventListener('click', () => openPlaceModal());
  container.querySelectorAll('.place-edit').forEach(btn => btn.addEventListener('click', () => openPlaceModal(btn.dataset.id)));
  container.querySelectorAll('.place-delete').forEach(btn => btn.addEventListener('click', async () => {
    const ok = await confirm('Ta bort den här platsen?');
    if (ok) { deletePlace(btn.dataset.id); showToast('Plats borttagen', 'info'); renderPlaces(container); }
  }));
}

function openPlaceModal(editId = null) {
  const { places } = getState();
  const p = editId ? places.find(x => x.id === editId) : null;

  openModal({
    title: editId ? 'Redigera plats' : 'Ny plats',
    content: `
      <form id="place-form" novalidate>
        <div class="form-group">
          <label class="form-label">Platsnamn <span>*</span></label>
          <input type="text" name="name" class="form-input" value="${esc(p?.name || '')}" placeholder="t.ex. ICA Spara" required autofocus>
        </div>
        <div class="form-group">
          <label class="form-label">Anteckning</label>
          <input type="text" name="note" class="form-input" value="${esc(p?.note || '')}" placeholder="Valfri anteckning">
        </div>
        <div class="modal-actions">
          <button type="submit" class="btn btn-primary btn-full">${editId ? 'Spara' : 'Lägg till'}</button>
          <button type="button" class="btn btn-ghost btn-full" id="modal-cancel">Avbryt</button>
        </div>
      </form>
    `,
  });

  document.getElementById('modal-cancel')?.addEventListener('click', closeModal);
  document.getElementById('place-form')?.addEventListener('submit', (e) => {
    e.preventDefault();
    const fd = new FormData(e.target);
    const name = fd.get('name')?.trim();
    if (!name) { showToast('Namn krävs', 'warning'); return; }
    const data = { name, note: fd.get('note')?.trim() || '' };
    if (editId) { updatePlace(editId, data); showToast('Plats uppdaterad ✓', 'success'); }
    else        { addPlace(data); showToast('Plats tillagd ✓', 'success'); }
    closeModal();
    const container = document.getElementById('places-container');
    if (container) renderPlaces(container);
  });
}
