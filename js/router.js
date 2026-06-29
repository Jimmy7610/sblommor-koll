/* ══════════════════════════════════════════
   router.js — Tab navigation
   ══════════════════════════════════════════ */

import { getState, setState } from './state.js';
import { scrollTop } from './ui.js';

const PAGE_HANDLERS = {};
let _currentPage = 'dashboard';

export function registerPage(name, handler) {
  PAGE_HANDLERS[name] = handler;
}

export function initRouter() {
  const nav = document.getElementById('bottom-nav');
  nav?.querySelectorAll('.nav-item').forEach(btn => {
    btn.addEventListener('click', () => navigate(btn.dataset.page));
  });

  // Hash-based deep links (from manifest shortcuts)
  const hash = location.hash.replace('#', '');
  const initialPage = hash && PAGE_HANDLERS[hash] ? hash : (getState().ui.activePage || 'dashboard');
  navigate(initialPage, false);
}

export function navigate(page, pushState = true) {
  if (!PAGE_HANDLERS[page]) page = 'dashboard';

  // Hide all pages, deactivate all nav items
  document.querySelectorAll('.page').forEach(el => el.classList.remove('active'));
  document.querySelectorAll('.nav-item').forEach(el => el.classList.remove('active'));

  // Show target page, activate nav item
  const pageEl = document.getElementById(`page-${page}`);
  const navEl  = document.querySelector(`.nav-item[data-page="${page}"]`);
  pageEl?.classList.add('active');
  navEl?.classList.add('active');

  _currentPage = page;
  if (pushState) {
    setState({ ui: { ...getState().ui, activePage: page } }, { persist: true, notify: false });
  }
  scrollTop();

  // Call page render handler
  PAGE_HANDLERS[page]?.();
}

export function getCurrentPage() {
  return _currentPage;
}
