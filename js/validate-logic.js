/* ─────────────────────────────────────────────
   validate-logic.js — Pure form validation
   Extracted from submit.js for testability.
   No DOM dependency — operates on plain objects.
───────────────────────────────────────────── */

var REQUIRED_FIELDS = ['sCode', 'sSubject', 'sCourse', 'sYear', 'sExam', 'sUrl'];

/**
 * Validates a submission form data object.
 *
 * @param {Object.<string, string>} fields
 *   An object mapping field id → trimmed value string.
 *   Missing keys are treated as empty.
 *
 * @returns {{ valid: boolean, errors: string[] }}
 *   valid  — true when all required fields present AND url is valid http/https
 *   errors — list of field ids that failed validation
 */
function validateFormData(fields) {
  var errors = [];

  /* Required field presence check */
  REQUIRED_FIELDS.forEach(function (id) {
    var val = (fields[id] || '').trim();
    if (!val) errors.push(id);
  });

  /* URL format check — only when a value is present */
  var urlVal = (fields['sUrl'] || '').trim();
  if (urlVal) {
    var urlValid = false;
    try {
      var u = new URL(urlVal);
      urlValid = u.protocol === 'http:' || u.protocol === 'https:';
    } catch (_) {
      urlValid = false;
    }
    if (!urlValid) {
      /* Avoid double-pushing sUrl if already missing */
      if (errors.indexOf('sUrl') === -1) errors.push('sUrl');
    } else {
      /* Remove sUrl from errors if URL is valid (was already present above) */
      errors = errors.filter(function (e) { return e !== 'sUrl'; });
    }
  }

  return { valid: errors.length === 0, errors: errors };
}

/* ── Export for Node / Jest ─────────────────── */
if (typeof module !== 'undefined' && module.exports) {
  module.exports = { validateFormData, REQUIRED_FIELDS };
}

/* ── Export for browser (global) ─────────────── */
if (typeof window !== 'undefined') {
  window.ValidateLogic = { validateFormData, REQUIRED_FIELDS };
}
