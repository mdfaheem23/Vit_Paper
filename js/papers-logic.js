/* ─────────────────────────────────────────────
   papers-logic.js — Pure data-layer functions
   Extracted from papers.js for testability.
   This module is framework-agnostic: it accepts
   a storage adapter so tests can inject a fake.
───────────────────────────────────────────── */

const SEED_PAPERS = [];

/* ─────────────────────────────────────────────
   Factory: createPapersStore(storage)
   storage must implement:
     getItem(key)  → string | null
     setItem(key, value)
   In the browser, pass localStorage.
   In tests, pass a Map-backed fake.
───────────────────────────────────────────── */

/* Monotonic id counter — ensures unique ids even when Date.now()
   returns the same value for rapid consecutive calls in tests.
   Starts at Date.now() so ids remain time-ordered and are much
   larger than any seed paper id (max 19). */
var _nextId = Date.now();

function createPapersStore(storage) {
  const STORAGE_KEY = 'vit_qp_extra';

  function getExtra() {
    try { return JSON.parse(storage.getItem(STORAGE_KEY) || '[]'); }
    catch (e) { return []; }
  }

  function saveExtra(arr) {
    storage.setItem(STORAGE_KEY, JSON.stringify(arr));
  }

  function getPapers() {
    return [...SEED_PAPERS, ...getExtra()];
  }

  function addPaper(paper) {
    const extra = getExtra();
    const newPaper = { ...paper, id: ++_nextId };
    extra.push(newPaper);
    saveExtra(extra);
    return newPaper;
  }

  function updatePaper(id, data) {
    const extra = getExtra();
    const idx = extra.findIndex(p => p.id === id);
    if (idx === -1) return false;
    extra[idx] = { ...extra[idx], ...data };
    saveExtra(extra);
    return true;
  }

  function deletePaper(id) {
    if (isSeedPaper(id)) return false;
    const extra = getExtra().filter(p => p.id !== id);
    saveExtra(extra);
    return true;
  }

  function isSeedPaper(id) {
    return SEED_PAPERS.some(p => p.id === id);
  }

  function getStats() {
    const all = getPapers();
    return {
      total:     all.length,
      courses:   [...new Set(all.map(p => p.course))].length,
      examTypes: [...new Set(all.map(p => p.exam))].length,
      years:     [...new Set(all.map(p => p.year))].length
    };
  }

  return { getPapers, addPaper, updatePaper, deletePaper, isSeedPaper, getStats, SEED_PAPERS };
}

/* ── Export for Node / Jest ─────────────────── */
if (typeof module !== 'undefined' && module.exports) {
  module.exports = { createPapersStore, SEED_PAPERS };
}

/* ── Export for browser (global) ─────────────── */
if (typeof window !== 'undefined') {
  window.PapersLogic = { createPapersStore, SEED_PAPERS };
}
