/* ─────────────────────────────────────────────
   filter-logic.js — Pure filter predicate
   Extracted from main.js for testability.
───────────────────────────────────────────── */

/**
 * Returns true when paper `p` matches all active filter criteria.
 *
 * @param {object} p            - A paper object
 * @param {object} filters
 * @param {string} filters.course  - 'all' or a course code string
 * @param {string} filters.year    - 'all' or a year string (e.g. '2025')
 * @param {string} filters.exam    - 'all' or an exam type string (e.g. 'CAT1')
 * @param {string} filters.search  - lower-cased search term, '' to skip
 * @returns {boolean}
 */
function matchesFilters(p, filters) {
  var ok = true;
  if (filters.course !== 'all') ok = ok && p.course === filters.course;
  if (filters.year   !== 'all') ok = ok && String(p.year) === filters.year;
  if (filters.exam   !== 'all') ok = ok && p.exam === filters.exam;
  if (filters.search) ok = ok && (
    p.subject.toLowerCase().includes(filters.search) ||
    p.code.toLowerCase().includes(filters.search)
  );
  return ok;
}

/**
 * Filters an array of papers using the provided filter state.
 *
 * @param {object[]} papers
 * @param {object}   filters
 * @returns {object[]}
 */
function applyFilters(papers, filters) {
  return papers.filter(function (p) { return matchesFilters(p, filters); });
}

/* ── Export for Node / Jest ─────────────────── */
if (typeof module !== 'undefined' && module.exports) {
  module.exports = { matchesFilters, applyFilters };
}

/* ── Export for browser (global) ─────────────── */
if (typeof window !== 'undefined') {
  window.FilterLogic = { matchesFilters, applyFilters };
}
