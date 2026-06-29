/* ══════════════════════════════════════════
   dates.js — Date utilities
   ══════════════════════════════════════════ */

export function today() {
  return toDateStr(new Date());
}

export function tomorrow() {
  const d = new Date();
  d.setDate(d.getDate() + 1);
  return toDateStr(d);
}

export function toDateStr(date) {
  return date.toISOString().slice(0, 10);
}

export function fromDateStr(str) {
  // Parse YYYY-MM-DD without timezone shift
  const [y, m, d] = str.split('-').map(Number);
  return new Date(y, m - 1, d);
}

export function currentMonth() {
  return today().slice(0, 7); // YYYY-MM
}

export function formatDate(dateStr, style = 'long') {
  if (!dateStr) return '';
  const d = fromDateStr(dateStr);
  if (style === 'short') return d.toLocaleDateString('sv-SE', { month: 'short', day: 'numeric' });
  if (style === 'long')  return d.toLocaleDateString('sv-SE', { weekday: 'long', month: 'long', day: 'numeric' });
  if (style === 'day')   return d.toLocaleDateString('sv-SE', { weekday: 'short', day: 'numeric', month: 'short' });
  if (style === 'month') return d.toLocaleDateString('sv-SE', { month: 'long', year: 'numeric' });
  return dateStr;
}

export function formatTime(timeStr) {
  if (!timeStr) return '';
  return timeStr.slice(0, 5); // HH:MM
}

export function calcHours(shift) {
  if (!shift.startTime || !shift.endTime) return 0;
  const [sh, sm] = shift.startTime.split(':').map(Number);
  const [eh, em] = shift.endTime.split(':').map(Number);
  const startMin = sh * 60 + sm;
  let   endMin   = eh * 60 + em;
  if (endMin <= startMin) endMin += 24 * 60; // crosses midnight
  const workedMin = Math.max(0, endMin - startMin - (Number(shift.breakMinutes) || 0));
  return workedMin / 60;
}

export function formatHours(h) {
  const hrs = Math.floor(h);
  const min = Math.round((h - hrs) * 60);
  if (min === 0) return `${hrs} tim`;
  return `${hrs} tim ${min} min`;
}

export function formatCurrency(n) {
  if (n == null || isNaN(n)) return '—';
  return new Intl.NumberFormat('sv-SE', { style: 'currency', currency: 'SEK', maximumFractionDigits: 0 }).format(n);
}

export function daysUntil(dateStr) {
  const diff = fromDateStr(dateStr) - new Date();
  return Math.ceil(diff / (1000 * 60 * 60 * 24));
}

export function isToday(dateStr)    { return dateStr === today(); }
export function isTomorrow(dateStr) { return dateStr === tomorrow(); }

export function relativeDate(dateStr) {
  if (!dateStr) return '';
  if (isToday(dateStr))    return 'Idag';
  if (isTomorrow(dateStr)) return 'Imorgon';
  const d = daysUntil(dateStr);
  if (d > 0 && d <= 7)  return `Om ${d} dagar`;
  if (d < 0 && d >= -7) return `${Math.abs(d)} dagar sedan`;
  return formatDate(dateStr, 'short');
}

export function monthLabel(monthStr) {
  if (!monthStr) return '';
  const [y, m] = monthStr.split('-').map(Number);
  return new Date(y, m - 1, 1).toLocaleDateString('sv-SE', { month: 'long', year: 'numeric' });
}

export function prevMonth(monthStr) {
  const [y, m] = monthStr.split('-').map(Number);
  const d = new Date(y, m - 2, 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

export function nextMonth(monthStr) {
  const [y, m] = monthStr.split('-').map(Number);
  const d = new Date(y, m, 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

export function getMonthDays(monthStr) {
  const [y, m] = monthStr.split('-').map(Number);
  const first = new Date(y, m - 1, 1);
  const last  = new Date(y, m, 0);
  const days = [];
  // Leading empty cells (Mon=0 based)
  let dow = (first.getDay() + 6) % 7; // 0=Mon
  for (let i = 0; i < dow; i++) days.push(null);
  for (let d = 1; d <= last.getDate(); d++) {
    days.push(`${monthStr}-${String(d).padStart(2, '0')}`);
  }
  return days;
}

export function formatLastSync(isoStr) {
  if (!isoStr) return 'Aldrig';
  const d = new Date(isoStr);
  const now = new Date();
  const diff = Math.floor((now - d) / 1000);
  if (diff < 60)   return 'Nyss';
  if (diff < 3600) return `${Math.floor(diff / 60)} min sedan`;
  if (diff < 86400) return d.toLocaleTimeString('sv-SE', { hour: '2-digit', minute: '2-digit' });
  return d.toLocaleDateString('sv-SE', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
}
