/* ─────────────────────────────────────────────
   tests/papers-logic.test.js
   Unit tests for js/papers-logic.js
───────────────────────────────────────────── */
'use strict';

const { createPapersStore, SEED_PAPERS } = require('../js/papers-logic');

/* ── Storage fake ─────────────────────────────
   A simple in-memory Map that mirrors the
   localStorage API surface used by papers-logic.
─────────────────────────────────────────────── */
function makeStorage() {
  const store = new Map();
  return {
    getItem(key) { return store.has(key) ? store.get(key) : null; },
    setItem(key, value) { store.set(key, value); },
    clear() { store.clear(); }
  };
}

/* ── Factory helper ───────────────────────── */
function makeStore(overrideStorage) {
  return createPapersStore(overrideStorage || makeStorage());
}

/* ═══════════════════════════════════════════
   SEED_PAPERS constant
════════════════════════════════════════════ */
describe('SEED_PAPERS constant', () => {
  test('exports an array', () => {
    expect(Array.isArray(SEED_PAPERS)).toBe(true);
  });

  test('contains 19 seed papers', () => {
    expect(SEED_PAPERS).toHaveLength(19);
  });

  test('every seed paper has required keys', () => {
    SEED_PAPERS.forEach(p => {
      expect(p).toHaveProperty('id');
      expect(p).toHaveProperty('subject');
      expect(p).toHaveProperty('code');
      expect(p).toHaveProperty('course');
      expect(p).toHaveProperty('year');
      expect(p).toHaveProperty('exam');
    });
  });

  test('seed paper ids are unique', () => {
    const ids = SEED_PAPERS.map(p => p.id);
    expect(new Set(ids).size).toBe(ids.length);
  });
});

/* ═══════════════════════════════════════════
   getPapers
════════════════════════════════════════════ */
describe('getPapers', () => {
  test('returns all 19 seed papers when storage is empty', () => {
    const papers = makeStore();
    expect(papers.getPapers()).toHaveLength(19);
  });

  test('returns seed + extra papers combined', () => {
    const storage = makeStorage();
    const papers = createPapersStore(storage);

    papers.addPaper({
      subject: 'Test Subject', code: 'TST001',
      course: 'MIC', year: 2024, exam: 'CAT1',
      semester: 'WS2023-24', batch: '', url: 'https://example.com'
    });

    expect(papers.getPapers()).toHaveLength(20);
  });

  test('returns a new array each call (no mutation risk)', () => {
    const papers = makeStore();
    const a = papers.getPapers();
    const b = papers.getPapers();
    expect(a).not.toBe(b);
  });

  test('seed papers appear before extra papers', () => {
    const storage = makeStorage();
    const papers = createPapersStore(storage);
    papers.addPaper({ subject: 'Extra', code: 'X001', course: 'MID', year: 2025, exam: 'CAT1', url: '#' });

    const all = papers.getPapers();
    expect(all[0].id).toBe(1); // first seed always first
    expect(all[all.length - 1].code).toBe('X001');
  });
});

/* ═══════════════════════════════════════════
   addPaper
════════════════════════════════════════════ */
describe('addPaper', () => {
  test('adds one paper and returns it with an id', () => {
    const papers = makeStore();
    const result = papers.addPaper({
      subject: 'New Paper', code: 'NEW001',
      course: 'MIC', year: 2025, exam: 'FAT',
      semester: 'WS2024-25', url: 'https://example.com'
    });

    expect(result).toHaveProperty('id');
    expect(result.subject).toBe('New Paper');
    expect(papers.getPapers()).toHaveLength(20);
  });

  test('assigns a numeric id (Date.now based)', () => {
    const papers = makeStore();
    const result = papers.addPaper({ subject: 'X', code: 'X', course: 'MIC', year: 2024, exam: 'CAT1', url: '#' });
    expect(typeof result.id).toBe('number');
    expect(result.id).toBeGreaterThan(0);
  });

  test('adding multiple papers gives each a unique id', () => {
    const storage = makeStorage();
    const papers = createPapersStore(storage);

    const a = papers.addPaper({ subject: 'A', code: 'A', course: 'MIC', year: 2024, exam: 'CAT1', url: '#' });
    // Small pause to ensure Date.now() differs
    const b = papers.addPaper({ subject: 'B', code: 'B', course: 'MID', year: 2024, exam: 'CAT2', url: '#' });

    expect(a.id).not.toBe(b.id);
  });

  test('extra paper is persisted in storage', () => {
    const storage = makeStorage();
    const papers = createPapersStore(storage);
    papers.addPaper({ subject: 'P', code: 'P', course: 'MIC', year: 2025, exam: 'FAT', url: '#' });

    // Create a second store instance over the SAME storage — should see the paper
    const papers2 = createPapersStore(storage);
    expect(papers2.getPapers()).toHaveLength(20);
  });

  test('does not mutate the input object', () => {
    const papers = makeStore();
    const input = { subject: 'X', code: 'X', course: 'MIC', year: 2024, exam: 'CAT1', url: '#' };
    const originalKeys = Object.keys(input).length;
    papers.addPaper(input);
    expect(Object.keys(input).length).toBe(originalKeys);
    expect(input).not.toHaveProperty('id');
  });
});

/* ═══════════════════════════════════════════
   deletePaper
════════════════════════════════════════════ */
describe('deletePaper', () => {
  test('deletes an extra paper and returns true', () => {
    const storage = makeStorage();
    const papers = createPapersStore(storage);
    const added = papers.addPaper({ subject: 'Del', code: 'D', course: 'MID', year: 2024, exam: 'CAT1', url: '#' });

    const result = papers.deletePaper(added.id);
    expect(result).toBe(true);
    expect(papers.getPapers()).toHaveLength(19);
  });

  test('returns false when trying to delete a seed paper (id 1)', () => {
    const papers = makeStore();
    expect(papers.deletePaper(1)).toBe(false);
  });

  test('seed papers remain intact after delete attempt', () => {
    const papers = makeStore();
    SEED_PAPERS.forEach(p => papers.deletePaper(p.id));
    expect(papers.getPapers()).toHaveLength(19);
  });

  test('returns true even for a non-existent extra id (no-op delete)', () => {
    const papers = makeStore();
    // id 99999 is not a seed paper and does not exist in extra
    expect(papers.deletePaper(99999)).toBe(true);
  });

  test('deleting one extra does not affect others', () => {
    const storage = makeStorage();
    const papers = createPapersStore(storage);
    const a = papers.addPaper({ subject: 'A', code: 'A', course: 'MIC', year: 2024, exam: 'CAT1', url: '#' });
    const b = papers.addPaper({ subject: 'B', code: 'B', course: 'MID', year: 2024, exam: 'CAT2', url: '#' });

    papers.deletePaper(a.id);

    const remaining = papers.getPapers();
    expect(remaining.find(p => p.id === b.id)).toBeDefined();
    expect(remaining.find(p => p.id === a.id)).toBeUndefined();
  });
});

/* ═══════════════════════════════════════════
   updatePaper
════════════════════════════════════════════ */
describe('updatePaper', () => {
  test('updates an extra paper and returns true', () => {
    const storage = makeStorage();
    const papers = createPapersStore(storage);
    const added = papers.addPaper({ subject: 'Old', code: 'O', course: 'MIC', year: 2024, exam: 'CAT1', url: '#' });

    const result = papers.updatePaper(added.id, { subject: 'Updated' });
    expect(result).toBe(true);

    const updated = papers.getPapers().find(p => p.id === added.id);
    expect(updated.subject).toBe('Updated');
  });

  test('returns false when trying to update a seed paper (id 1)', () => {
    const papers = makeStore();
    expect(papers.updatePaper(1, { subject: 'Hacked' })).toBe(false);
  });

  test('seed paper subject is unchanged after update attempt', () => {
    const papers = makeStore();
    const originalSubject = papers.getPapers().find(p => p.id === 1).subject;
    papers.updatePaper(1, { subject: 'Hacked' });
    expect(papers.getPapers().find(p => p.id === 1).subject).toBe(originalSubject);
  });

  test('returns false for non-existent extra id', () => {
    const papers = makeStore();
    expect(papers.updatePaper(99999, { subject: 'Ghost' })).toBe(false);
  });

  test('update merges fields (partial update)', () => {
    const storage = makeStorage();
    const papers = createPapersStore(storage);
    const added = papers.addPaper({ subject: 'Old', code: 'O001', course: 'MIC', year: 2024, exam: 'CAT1', url: '#' });

    papers.updatePaper(added.id, { url: 'https://new-url.com' });
    const p = papers.getPapers().find(x => x.id === added.id);

    expect(p.url).toBe('https://new-url.com');
    expect(p.subject).toBe('Old'); // unchanged fields preserved
    expect(p.code).toBe('O001');
  });
});

/* ═══════════════════════════════════════════
   isSeedPaper
════════════════════════════════════════════ */
describe('isSeedPaper', () => {
  test('returns true for every seed paper id', () => {
    const papers = makeStore();
    SEED_PAPERS.forEach(p => {
      expect(papers.isSeedPaper(p.id)).toBe(true);
    });
  });

  test('returns false for a clearly non-seed id', () => {
    const papers = makeStore();
    expect(papers.isSeedPaper(99999)).toBe(false);
  });

  test('returns false for an added extra paper id', () => {
    const storage = makeStorage();
    const papers = createPapersStore(storage);
    const added = papers.addPaper({ subject: 'E', code: 'E', course: 'MIC', year: 2024, exam: 'CAT1', url: '#' });
    expect(papers.isSeedPaper(added.id)).toBe(false);
  });

  test('returns false for id 0 (boundary)', () => {
    const papers = makeStore();
    expect(papers.isSeedPaper(0)).toBe(false);
  });

  test('returns false for negative id', () => {
    const papers = makeStore();
    expect(papers.isSeedPaper(-1)).toBe(false);
  });
});

/* ═══════════════════════════════════════════
   getStats
════════════════════════════════════════════ */
describe('getStats', () => {
  test('returns an object with total, courses, examTypes, years', () => {
    const stats = makeStore().getStats();
    expect(stats).toHaveProperty('total');
    expect(stats).toHaveProperty('courses');
    expect(stats).toHaveProperty('examTypes');
    expect(stats).toHaveProperty('years');
  });

  test('total equals 19 for seed-only store', () => {
    expect(makeStore().getStats().total).toBe(19);
  });

  test('courses count is 2 (MIC and MID)', () => {
    expect(makeStore().getStats().courses).toBe(2);
  });

  test('examTypes count is 3 (CAT1, CAT2, FAT)', () => {
    expect(makeStore().getStats().examTypes).toBe(3);
  });

  test('years count is 3 (2025, 2024, 2023)', () => {
    expect(makeStore().getStats().years).toBe(3);
  });

  test('total increases by 1 after addPaper', () => {
    const storage = makeStorage();
    const papers = createPapersStore(storage);
    papers.addPaper({ subject: 'E', code: 'E', course: 'MIC', year: 2024, exam: 'CAT1', url: '#' });
    expect(papers.getStats().total).toBe(20);
  });

  test('years count increases when a new year is added', () => {
    const storage = makeStorage();
    const papers = createPapersStore(storage);
    papers.addPaper({ subject: 'E', code: 'E', course: 'MIC', year: 2022, exam: 'CAT1', url: '#' });
    expect(papers.getStats().years).toBe(4);
  });

  test('courses count increases when a new course is added', () => {
    const storage = makeStorage();
    const papers = createPapersStore(storage);
    papers.addPaper({ subject: 'E', code: 'E', course: 'NEW', year: 2024, exam: 'CAT1', url: '#' });
    expect(papers.getStats().courses).toBe(3);
  });

  /* ── Error resilience ── */
  test('handles corrupted storage gracefully (falls back to seed only)', () => {
    const badStorage = {
      getItem() { return 'NOT_VALID_JSON{{{{'; },
      setItem() {}
    };
    const papers = createPapersStore(badStorage);
    expect(papers.getStats().total).toBe(19);
  });
});
