/* ─────────────────────────────────────────────
   utils.js — Pure utility functions
   Shared by main.js, admin.js, and tests
───────────────────────────────────────────── */

/**
 * Escapes HTML special characters to prevent XSS.
 * Handles: & < > "
 * admin.js version also guards null/undefined with an early-return empty string.
 * This version matches admin.js behaviour: null/undefined/falsy → ''.
 *
 * @param {*} str
 * @returns {string}
 */
function escHtml(str) {
  if (str === null || str === undefined || str === false || str === 0 || str === '') {
    // Preserve main.js behaviour: String(str) for 0/false, '' for null/undefined/''
    // We align with the more defensive admin.js version for null/undefined,
    // but keep String() coercion for numeric / boolean values as main.js does.
    if (str === null || str === undefined) return '';
    // 0 or false: fall through to String() coercion
  }
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

/* ── Export for Node / Jest ─────────────────── */
if (typeof module !== 'undefined' && module.exports) {
  module.exports = { escHtml };
}

/* ── Export for browser (global) ─────────────── */
if (typeof window !== 'undefined') {
  window.Utils = { escHtml };
}
