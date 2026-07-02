/* ══════════════════════════════════════════
   validation.js — Form validation helpers
   ══════════════════════════════════════════ */

export function validateShift(data) {
  const errors = {};
  if (!data.date) errors.date = 'Datum krävs';
  if (!data.startTime) errors.startTime = 'Starttid krävs';
  if (!data.endTime) errors.endTime = 'Sluttid krävs';
  if (data.startTime && data.endTime && data.startTime === data.endTime) {
    errors.endTime = 'Sluttid kan inte vara samma som starttid';
  }
  return errors;
}

export function validateBlombilen(data) {
  const errors = {};
  if (!data.date) errors.date = 'Datum krävs';
  if (!data.place || !data.place.trim()) errors.place = 'Plats krävs';
  const hasItems = data.itemsText?.trim() || (data.itemRows?.some(r => r.item?.trim()));
  if (!hasItems) errors.items = 'Ange vad som ska tas med';
  return errors;
}

export function validateSettings(data) {
  const errors = {};
  if (data.hourlyRate !== '' && (isNaN(data.hourlyRate) || Number(data.hourlyRate) < 0)) {
    errors.hourlyRate = 'Ange en giltig timlön';
  }
  if (isNaN(data.taxRate) || Number(data.taxRate) < 0 || Number(data.taxRate) > 100) {
    errors.taxRate = 'Skatteprocent måste vara 0–100';
  }
  return errors;
}

export function showFieldErrors(form, errors) {
  // Clear previous
  form.querySelectorAll('.error').forEach(el => el.classList.remove('error'));
  form.querySelectorAll('.form-error-msg').forEach(el => el.remove());

  Object.entries(errors).forEach(([field, msg]) => {
    const input = form.querySelector(`[name="${field}"], #field-${field}`);
    if (input) {
      input.classList.add('error');
      const hint = document.createElement('div');
      hint.className = 'form-error-msg';
      hint.textContent = msg;
      input.parentNode.insertBefore(hint, input.nextSibling);
    }
  });
}

export function hasErrors(errors) {
  return Object.keys(errors).length > 0;
}

export function getAlerts(state) {
  const alerts = [];
  const { shifts, blombilen, settings } = state;
  const todayStr = new Date().toISOString().slice(0, 10);
  const tomorrowD = new Date(); tomorrowD.setDate(tomorrowD.getDate() + 1);
  const tomorrowStr = tomorrowD.toISOString().slice(0, 10);

  const todayShift = shifts.find(s => s.date === todayStr && s.status === 'planned');
  if (todayShift) alerts.push({ icon: '📅', text: `Dagens arbetspass är inte markerat som jobbat` });

  const unpackedTomorrow = blombilen.filter(b => b.date === tomorrowStr && b.status === 'to-pack');
  if (unpackedTomorrow.length) alerts.push({ icon: '🚐', text: `${unpackedTomorrow.length} saker kvar att packa till imorgon` });

  const urgentUnpacked = blombilen.filter(b => b.priority === 'urgent' && b.status === 'to-pack');
  if (urgentUnpacked.length) alerts.push({ icon: '🔴', text: `${urgentUnpacked.length} akuta Blombilen-poster ej packade` });

  if (!settings.hourlyRate) alerts.push({ icon: '💰', text: `Timlön är inte inställd` });

  return alerts;
}
