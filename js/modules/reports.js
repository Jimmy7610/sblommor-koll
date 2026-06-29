/* ══════════════════════════════════════════
   reports.js — (inbäddad i salaryView)
   ══════════════════════════════════════════ */

// Reports functionality is integrated into salaryView.js
// This file exports helper utilities for report generation

import { getState } from '../state.js';
import { calcMonthSummary } from '../salary.js';
import { formatCurrency, formatHours, monthLabel } from '../dates.js';

export function generateMonthReport(monthStr) {
  const { shifts, blombilen, settings } = getState();
  const monthShifts = shifts.filter(s => s.date.startsWith(monthStr));
  const monthBlom   = blombilen.filter(b => b.date.startsWith(monthStr));
  const summary     = calcMonthSummary(monthShifts, settings);

  return {
    month: monthStr,
    label: monthLabel(monthStr),
    shifts: monthShifts,
    blombilen: monthBlom,
    summary,
    formatted: {
      workedHours:   formatHours(summary.worked.hours),
      plannedHours:  formatHours(summary.planned.hours),
      grossPay:      formatCurrency(summary.worked.gross),
      vacation:      formatCurrency(summary.worked.vacation),
      tax:           formatCurrency(summary.worked.tax),
      netPay:        formatCurrency(summary.worked.net),
      obAddition:    formatCurrency(summary.worked.obAddition),
    },
  };
}

export function generateCSVReport(monthStr) {
  const report = generateMonthReport(monthStr);
  const rows = [
    ['Blompasset Månadsrapport', report.label],
    [],
    ['Sammanfattning', ''],
    ['Jobbade timmar', report.summary.worked.hours.toFixed(2)],
    ['Planerade timmar', report.summary.planned.hours.toFixed(2)],
    ['Bruttolön', report.summary.worked.gross.toFixed(2)],
    ['OB-tillägg', report.summary.worked.obAddition.toFixed(2)],
    ['Semesterersättning', report.summary.worked.vacation.toFixed(2)],
    ['Preliminär skatt', report.summary.worked.tax.toFixed(2)],
    ['Nettolön', report.summary.worked.net.toFixed(2)],
    [],
    ['Pass', 'Datum', 'Start', 'Slut', 'Rast', 'Timmar', 'Status', 'OB'],
    ...report.shifts.map(s => {
      const h = calcH(s);
      return [s.date, s.startTime, s.endTime, s.breakMinutes, h.toFixed(2), s.status, s.hasOB ? 'Ja' : 'Nej'];
    }),
    [],
    ['Blombilen', 'Datum', 'Plats', 'Status', 'Prioritet'],
    ...report.blombilen.map(b => [b.date, b.place, b.status, b.priority]),
  ];

  return rows.map(r => r.map(v => `"${String(v).replace(/"/g, '""')}"`).join(',')).join('\n');
}

function calcH(shift) {
  if (!shift.startTime || !shift.endTime) return 0;
  const [sh, sm] = shift.startTime.split(':').map(Number);
  const [eh, em] = shift.endTime.split(':').map(Number);
  const s = sh*60+sm, e = eh*60+em + (eh*60+em < sh*60+sm ? 1440 : 0);
  return Math.max(0, e - s - (Number(shift.breakMinutes)||0)) / 60;
}
