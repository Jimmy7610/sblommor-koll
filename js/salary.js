/* ══════════════════════════════════════════
   salary.js — Salary calculations
   ══════════════════════════════════════════ */

import { calcHours } from './dates.js';

export function calcShiftPay(shift, settings) {
  const hours = calcHours(shift);
  const hourlyRate = Number(settings.hourlyRate) || 0;
  const gross = hours * hourlyRate;
  const obAddition = shift.hasOB ? hours * (Number(shift.obRate) || Number(settings.defaultOBRate) || 0) : 0;
  const totalGross = gross + obAddition;
  return { hours, gross, obAddition, totalGross };
}

export function calcMonthSummary(shifts, settings) {
  const worked  = shifts.filter(s => s.status === 'worked');
  const planned = shifts.filter(s => s.status === 'planned');

  const sumShifts = (arr) => arr.reduce((acc, s) => {
    const p = calcShiftPay(s, settings);
    return {
      hours:      acc.hours      + p.hours,
      gross:      acc.gross      + p.totalGross,
      obAddition: acc.obAddition + p.obAddition,
    };
  }, { hours: 0, gross: 0, obAddition: 0 });

  const workedSum  = sumShifts(worked);
  const plannedSum = sumShifts(planned);

  const vacRate   = (Number(settings.vacationPayRate) || 12) / 100;
  const taxRate   = (Number(settings.taxRate) || 30) / 100;

  const workedVacation  = workedSum.gross * vacRate;
  const workedTotalBase = workedSum.gross + workedVacation;
  const workedTax       = workedTotalBase * taxRate;
  const workedNet       = workedTotalBase - workedTax;

  const plannedVacation  = plannedSum.gross * vacRate;
  const plannedTotalBase = plannedSum.gross + plannedVacation;
  const plannedTax       = plannedTotalBase * taxRate;
  const plannedNet       = plannedTotalBase - plannedTax;

  return {
    worked: {
      shifts: worked.length,
      hours: workedSum.hours,
      gross: workedSum.gross,
      obAddition: workedSum.obAddition,
      vacation: workedVacation,
      tax: workedTax,
      net: workedNet,
    },
    planned: {
      shifts: planned.length,
      hours: plannedSum.hours,
      gross: plannedSum.gross,
      obAddition: plannedSum.obAddition,
      vacation: plannedVacation,
      tax: plannedTax,
      net: plannedNet,
    },
    combined: {
      shifts: worked.length + planned.length,
      hours: workedSum.hours + plannedSum.hours,
      gross: workedSum.gross + plannedSum.gross,
      net: workedNet + plannedNet,
    },
  };
}

export function calcFullYearSummary(shifts, settings) {
  const byMonth = {};
  shifts.forEach(s => {
    const m = s.date.slice(0, 7);
    if (!byMonth[m]) byMonth[m] = [];
    byMonth[m].push(s);
  });
  return Object.fromEntries(
    Object.entries(byMonth).map(([m, ss]) => [m, calcMonthSummary(ss, settings)])
  );
}
