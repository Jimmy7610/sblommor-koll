/* ══════════════════════════════════════════
   exports.js — Export / Import operations
   ══════════════════════════════════════════ */

import { exportJSON, exportCSV, importJSON } from './storage.js';
import { getState, setState } from './state.js';
import { showToast } from './ui.js';

export function doExportJSON() {
  exportJSON(getState());
  showToast('JSON-backup nedladdad', 'success');
}

export function doExportCSV(month) {
  exportCSV(getState(), month);
  showToast('CSV nedladdad', 'success');
}

export function doImport(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const result = importJSON(e.target.result, (data) => {
        setState({
          shifts:    data.shifts    || [],
          blombilen: data.blombilen || [],
          places:    data.places    || getState().places,
        });
      });
      if (result.ok) {
        showToast('Data importerad ✓', 'success');
        resolve();
      } else {
        showToast('Import misslyckades: ' + result.error, 'error');
        reject(result.error);
      }
    };
    reader.readAsText(file, 'UTF-8');
  });
}

export function doPrint() {
  window.print();
}
