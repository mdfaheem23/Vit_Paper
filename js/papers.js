/* ─────────────────────────────────────────────
   papers.js — Data layer for VIT QP Repository
   Delegates to papers-logic.js (testable module)
   and exposes window.Papers for the rest of the UI.
───────────────────────────────────────────── */
(function () {
  'use strict';

  /* When papers-logic.js is loaded before this file (as required by the
     HTML script order) it sets window.PapersLogic.  We use that factory
     to build the store, passing the real localStorage as the storage
     adapter.  This keeps all business logic in the testable module and
     this file to pure wiring. */
  var logic = window.PapersLogic;
  var store = logic.createPapersStore(localStorage);

  window.Papers = {
    getPapers:    store.getPapers,
    addPaper:     store.addPaper,
    updatePaper:  store.updatePaper,
    deletePaper:  store.deletePaper,
    isSeedPaper:  store.isSeedPaper,
    getStats:     store.getStats,
    SEED_PAPERS:  logic.SEED_PAPERS
  };
})();
