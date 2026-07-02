/* ══════════════════════════════════════════
   effects.js — Scroll-reveals, parallax,
   3D-tilt & count-up. iOS-säkert:
   IntersectionObserver + rAF, ingen
   scroll-driven CSS (saknar Safari-stöd).
   ══════════════════════════════════════════ */

const REVEAL_SELECTOR = [
  '.dashboard-section',
  '.list-item',
  '.stat-card',
  '.quick-btn',
  '.checklist-item',
  '.settings-section',
  '.salary-big-card',
  '.salary-breakdown',
  '.salary-period-selector',
  '.calendar-grid',
  '.page-header',
  '.shift-date-bar',
  '.place-item',
].join(',');

const TILT_SELECTOR = '.hero-card, .salary-big-card';

let _io = null;
let _reducedMotion = false;

export function initEffects() {
  _reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  if (_reducedMotion) return; // respektera användarens val — inga effekter

  document.documentElement.classList.add('fx');

  initRevealObserver();
  initAutoTagging();
  initParallax();
  initTilt();

  // Tagga det som redan finns i DOM:en
  tagAndObserve(document.getElementById('page-content'));
}

/* ── Scroll-reveal via IntersectionObserver ── */
function initRevealObserver() {
  const root = document.getElementById('page-content');
  _io = new IntersectionObserver((entries) => {
    for (const entry of entries) {
      if (entry.isIntersecting) {
        entry.target.classList.add('is-visible');
        _io.unobserve(entry.target);
        // Count-up när elementet blir synligt
        entry.target.querySelectorAll('[data-countup]').forEach(runCountUp);
        if (entry.target.matches('[data-countup]')) runCountUp(entry.target);
      }
    }
  }, { root, rootMargin: '0px 0px -8% 0px', threshold: 0.05 });
}

/* Auto-tagga nya element när sidor renderas om (innerHTML-byten) */
function initAutoTagging() {
  const content = document.getElementById('page-content');
  if (!content) return;
  const mo = new MutationObserver((mutations) => {
    for (const m of mutations) {
      for (const node of m.addedNodes) {
        if (node.nodeType === 1) tagAndObserve(node);
      }
    }
  });
  mo.observe(content, { childList: true, subtree: true });
}

function tagAndObserve(rootEl) {
  if (!rootEl || !_io) return;
  const els = [];
  if (rootEl.matches?.(REVEAL_SELECTOR)) els.push(rootEl);
  rootEl.querySelectorAll?.(REVEAL_SELECTOR).forEach(el => els.push(el));

  let stagger = 0;
  for (const el of els) {
    if (el.hasAttribute('data-reveal')) continue;
    el.setAttribute('data-reveal', el.matches('.hero-card, .salary-big-card, .stat-card') ? 'tilt' : '');
    // Kaskad-fördröjning för element som taggas i samma svep
    el.style.setProperty('--reveal-delay', `${Math.min(stagger * 55, 440)}ms`);
    stagger++;
    _io.observe(el);
  }
}

/* ── Parallax — bakgrundslager följer scroll i olika hastighet ── */
function initParallax() {
  const content = document.getElementById('page-content');
  const layers = document.querySelectorAll('.bg-layer');
  if (!content || !layers.length) return;

  let ticking = false;
  const update = () => {
    ticking = false;
    const y = content.scrollTop;
    layers.forEach((layer) => {
      const speed = parseFloat(layer.dataset.speed || '0.1');
      layer.style.transform = `translate3d(0, ${-(y * speed)}px, 0)`;
    });
  };
  content.addEventListener('scroll', () => {
    if (!ticking) { ticking = true; requestAnimationFrame(update); }
  }, { passive: true });
}

/* ── 3D-tilt på hero-kort (touch + pekare) ── */
function initTilt() {
  const content = document.getElementById('page-content');
  if (!content) return;

  const getCard = (target) => target.closest?.(TILT_SELECTOR);

  const applyTilt = (card, clientX, clientY) => {
    const r = card.getBoundingClientRect();
    const px = (clientX - r.left) / r.width - 0.5;   // -0.5 … 0.5
    const py = (clientY - r.top) / r.height - 0.5;
    card.classList.add('tilting');
    card.style.transform =
      `perspective(900px) rotateX(${(-py * 7).toFixed(2)}deg) rotateY(${(px * 9).toFixed(2)}deg) translateZ(6px)`;
  };

  const release = (card) => {
    card.style.transition = 'transform .55s cubic-bezier(.34,1.56,.64,1)';
    card.style.transform = '';
    setTimeout(() => {
      card.classList.remove('tilting');
      card.style.transition = '';
    }, 560);
  };

  content.addEventListener('pointermove', (e) => {
    const card = getCard(e.target);
    if (card && (e.pointerType !== 'touch')) applyTilt(card, e.clientX, e.clientY);
  }, { passive: true });

  content.addEventListener('pointerleave', (e) => {
    const card = getCard(e.target);
    if (card) release(card);
  }, true);

  content.addEventListener('touchmove', (e) => {
    const card = getCard(e.target);
    if (card) applyTilt(card, e.touches[0].clientX, e.touches[0].clientY);
  }, { passive: true });

  content.addEventListener('touchend', (e) => {
    const card = getCard(e.target);
    if (card) release(card);
  }, { passive: true });
}

/* ── Count-up: <span data-countup="1234.5" data-decimals="1" data-suffix=" h"> ── */
function runCountUp(el) {
  if (el.dataset.countupDone) return;
  el.dataset.countupDone = '1';

  const target   = parseFloat(el.dataset.countup);
  if (!isFinite(target)) return;
  const decimals = parseInt(el.dataset.decimals || '0', 10);
  const suffix   = el.dataset.suffix || '';
  const prefix   = el.dataset.prefix || '';
  const duration = 900;
  const start    = performance.now();

  const fmt = (v) => v.toLocaleString('sv-SE', { minimumFractionDigits: decimals, maximumFractionDigits: decimals });

  const tick = (now) => {
    const t = Math.min((now - start) / duration, 1);
    const eased = 1 - Math.pow(1 - t, 3); // ease-out cubic
    el.textContent = prefix + fmt(target * eased) + suffix;
    if (t < 1) requestAnimationFrame(tick);
  };
  requestAnimationFrame(tick);
}
