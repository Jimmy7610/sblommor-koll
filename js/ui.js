/* ══════════════════════════════════════════
   ui.js — Shared UI utilities
   ══════════════════════════════════════════ */

/* ── Toast notifications ── */
const toastContainer = () => document.getElementById('toast-container');

export function showToast(message, type = 'info', duration = 3000) {
  const el = document.createElement('div');
  el.className = `toast toast-${type}`;
  el.innerHTML = `<span>${icon(type)}</span><span>${message}</span>`;
  toastContainer()?.appendChild(el);
  setTimeout(() => {
    el.classList.add('removing');
    setTimeout(() => el.remove(), 300);
  }, duration);
}

function icon(type) {
  return { success: '✓', error: '✕', warning: '⚠', info: 'ℹ' }[type] ?? 'ℹ';
}

/* ── Modal ── */
let _onModalClose = null;

export function openModal({ title, content, onClose } = {}) {
  const overlay = document.getElementById('modal-overlay');
  const cnt     = document.getElementById('modal-content');
  if (!overlay || !cnt) return;

  _onModalClose = onClose;
  cnt.innerHTML = `${title ? `<div class="modal-title">${title}</div>` : ''}${content}`;
  overlay.classList.remove('hidden');
  overlay.classList.remove('closing');

  requestAnimationFrame(() => {
    const firstInput = cnt.querySelector('input, select, textarea');
    firstInput?.focus();
  });
}

export function closeModal() {
  const overlay = document.getElementById('modal-overlay');
  if (!overlay || overlay.classList.contains('hidden')) return;
  overlay.classList.add('closing');
  setTimeout(() => {
    overlay.classList.add('hidden');
    overlay.classList.remove('closing');
    document.getElementById('modal-content').innerHTML = '';
    _onModalClose?.();
    _onModalClose = null;
  }, 280);
}

export function initModalClose() {
  const overlay = document.getElementById('modal-overlay');
  overlay?.addEventListener('click', (e) => {
    if (e.target === overlay) closeModal();
  });
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') closeModal();
  });
}

/* ── Confirm dialog ── */
export function confirm(message, { confirmText = 'Ja, ta bort', cancelText = 'Avbryt', danger = true } = {}) {
  return new Promise((resolve) => {
    openModal({
      content: `
        <div style="text-align:center;padding:8px 0 16px">
          <div style="font-size:36px;margin-bottom:12px">⚠️</div>
          <p style="font-size:16px;color:var(--c-text-2);line-height:1.5">${message}</p>
        </div>
        <div class="modal-actions">
          <button class="btn ${danger ? 'btn-danger' : 'btn-primary'} btn-full" id="confirm-yes">${confirmText}</button>
          <button class="btn btn-ghost btn-full" id="confirm-no">${cancelText}</button>
        </div>
      `,
      onClose: () => resolve(false),
    });
    document.getElementById('confirm-yes')?.addEventListener('click', () => { closeModal(); resolve(true); });
    document.getElementById('confirm-no')?.addEventListener('click', () => { closeModal(); resolve(false); });
  });
}

/* ── Sync status indicator ── */
export function updateSyncIndicator(sync) {
  const dot   = document.getElementById('sync-dot');
  const label = document.getElementById('sync-label');
  if (!dot || !label) return;

  const statusMap = {
    synced:  { label: 'Synkat', status: 'synced' },
    pending: { label: 'Väntar', status: 'pending' },
    error:   { label: 'Fel',    status: 'error' },
    offline: { label: 'Offline',status: 'offline' },
    unknown: { label: '—',      status: 'unknown' },
  };
  const s = statusMap[sync.status] || statusMap.unknown;
  dot.setAttribute('data-status', s.status);
  label.textContent = s.label;
}

/* ── Alerts banner ── */
export function updateAlerts(alerts) {
  const banner = document.getElementById('alerts-banner');
  if (!banner) return;
  if (!alerts.length) {
    banner.classList.add('hidden');
    banner.innerHTML = '';
    return;
  }
  banner.classList.remove('hidden');
  banner.innerHTML = alerts.map(a => `<div class="alert-item"><span>${a.icon}</span><span>${a.text}</span></div>`).join('');
}

/* ── Loading spinner ── */
export function spinner() {
  return '<div class="spinner-wrap"><div class="spinner"></div></div>';
}

/* ── Empty state ── */
export function emptyState(icon, title, desc) {
  return `
    <div class="empty-state">
      <div class="empty-state-icon">${icon}</div>
      <div class="empty-state-title">${title}</div>
      <p class="empty-state-desc">${desc}</p>
    </div>
  `;
}

/* ── Format helpers for templates ── */
export function esc(str) {
  return String(str ?? '')
    .replace(/&/g, '&amp;').replace(/</g, '&lt;')
    .replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

/* ── Scroll to top of a page ── */
export function scrollTop() {
  document.getElementById('page-content')?.scrollTo({ top: 0, behavior: 'smooth' });
}
