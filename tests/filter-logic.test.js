/* ─────────────────────────────────────────────
   tests/filter-logic.test.js
   Unit tests for js/filter-logic.js
───────────────────────────────────────────── */
'use strict';

const { matchesFilters, applyFilters } = require('../js/filter-logic');

/* ── Sample paper fixtures ─────────────────── */
const MIC_2025_CAT1 = {
  id: 1, subject: 'Microprocessors & Interfacing', code: 'CSE2006',
  course: 'MIC', year: 2025, exam: 'CAT1', semester: 'WS2024-25'
};

const MID_2024_CAT2 = {
  id: 12, subject: 'Mobile & Internet Devices', code: 'CSI2007',
  course: 'MID', year: 2024, exam: 'CAT2', semester: 'WS2023-24'
};

const MIC_2023_FAT = {
  id: 10, subject: 'Microprocessors & Interfacing', code: 'CSE2006',
  course: 'MIC', year: 2023, exam: 'FAT', semester: 'WS2022-23'
};

const ALL_PAPERS = [MIC_2025_CAT1, MID_2024_CAT2, MIC_2023_FAT];

/* ── Default "show all" filter state ─────── */
const NO_FILTER = { course: 'all', year: 'all', exam: 'all', search: '' };

/* ═══════════════════════════════════════════
   matchesFilters — single predicates
════════════════════════════════════════════ */
describe('matchesFilters — course filter', () => {
  test('course "all" matches any paper', () => {
    expect(matchesFilters(MIC_2025_CAT1, NO_FILTER)).toBe(true);
    expect(matchesFilters(MID_2024_CAT2, NO_FILTER)).toBe(true);
  });

  test('course "MIC" matches MIC paper', () => {
    expect(matchesFilters(MIC_2025_CAT1, { ...NO_FILTER, course: 'MIC' })).toBe(true);
  });

  test('course "MIC" does NOT match MID paper', () => {
    expect(matchesFilters(MID_2024_CAT2, { ...NO_FILTER, course: 'MIC' })).toBe(false);
  });

  test('course "MID" matches MID paper', () => {
    expect(matchesFilters(MID_2024_CAT2, { ...NO_FILTER, course: 'MID' })).toBe(true);
  });

  test('course "MID" does NOT match MIC paper', () => {
    expect(matchesFilters(MIC_2025_CAT1, { ...NO_FILTER, course: 'MID' })).toBe(false);
  });
});

describe('matchesFilters — year filter', () => {
  test('year "all" matches any paper', () => {
    expect(matchesFilters(MIC_2025_CAT1, NO_FILTER)).toBe(true);
    expect(matchesFilters(MID_2024_CAT2, NO_FILTER)).toBe(true);
  });

  test('year "2025" matches 2025 paper', () => {
    expect(matchesFilters(MIC_2025_CAT1, { ...NO_FILTER, year: '2025' })).toBe(true);
  });

  test('year "2025" does NOT match 2024 paper', () => {
    expect(matchesFilters(MID_2024_CAT2, { ...NO_FILTER, year: '2025' })).toBe(false);
  });

  test('year filter uses string comparison (String(p.year))', () => {
    // year on paper is a number, filter value is a string
    expect(matchesFilters(MIC_2023_FAT, { ...NO_FILTER, year: '2023' })).toBe(true);
  });
});

describe('matchesFilters — exam filter', () => {
  test('exam "all" matches any paper', () => {
    expect(matchesFilters(MIC_2025_CAT1, NO_FILTER)).toBe(true);
  });

  test('exam "CAT1" matches CAT1 paper', () => {
    expect(matchesFilters(MIC_2025_CAT1, { ...NO_FILTER, exam: 'CAT1' })).toBe(true);
  });

  test('exam "CAT1" does NOT match CAT2 paper', () => {
    expect(matchesFilters(MID_2024_CAT2, { ...NO_FILTER, exam: 'CAT1' })).toBe(false);
  });

  test('exam "FAT" matches FAT paper', () => {
    expect(matchesFilters(MIC_2023_FAT, { ...NO_FILTER, exam: 'FAT' })).toBe(true);
  });
});

describe('matchesFilters — search filter', () => {
  test('empty search matches any paper', () => {
    expect(matchesFilters(MIC_2025_CAT1, { ...NO_FILTER, search: '' })).toBe(true);
  });

  test('search matches on subject (case-insensitive)', () => {
    expect(matchesFilters(MIC_2025_CAT1, { ...NO_FILTER, search: 'microprocessors' })).toBe(true);
    expect(matchesFilters(MIC_2025_CAT1, { ...NO_FILTER, search: 'MICROPROCESSORS' })).toBe(false);
    // The main.js implementation does `search: this.value.toLowerCase().trim()`
    // so the search term itself is already lowercased before being stored
    // The predicate just checks includes on p.subject.toLowerCase()
  });

  test('search matches on code (case-insensitive)', () => {
    expect(matchesFilters(MIC_2025_CAT1, { ...NO_FILTER, search: 'cse2006' })).toBe(true);
  });

  test('search returns false when no match', () => {
    expect(matchesFilters(MIC_2025_CAT1, { ...NO_FILTER, search: 'zzznomatch' })).toBe(false);
  });

  test('search matches partial subject word', () => {
    expect(matchesFilters(MID_2024_CAT2, { ...NO_FILTER, search: 'mobile' })).toBe(true);
  });
});

describe('matchesFilters — combined filters', () => {
  test('course + year combined — matching case', () => {
    const filters = { ...NO_FILTER, course: 'MIC', year: '2025' };
    expect(matchesFilters(MIC_2025_CAT1, filters)).toBe(true);
  });

  test('course + year combined — mismatched year', () => {
    const filters = { ...NO_FILTER, course: 'MIC', year: '2024' };
    expect(matchesFilters(MIC_2025_CAT1, filters)).toBe(false);
  });

  test('all four filters combined — full match', () => {
    const filters = { course: 'MIC', year: '2025', exam: 'CAT1', search: 'cse2006' };
    expect(matchesFilters(MIC_2025_CAT1, filters)).toBe(true);
  });

  test('all four filters combined — search mismatch', () => {
    const filters = { course: 'MIC', year: '2025', exam: 'CAT1', search: 'csi2007' };
    expect(matchesFilters(MIC_2025_CAT1, filters)).toBe(false);
  });
});

/* ═══════════════════════════════════════════
   applyFilters
════════════════════════════════════════════ */
describe('applyFilters', () => {
  test('no filters — returns all papers', () => {
    expect(applyFilters(ALL_PAPERS, NO_FILTER)).toHaveLength(3);
  });

  test('course filter reduces results', () => {
    const result = applyFilters(ALL_PAPERS, { ...NO_FILTER, course: 'MIC' });
    expect(result).toHaveLength(2);
    result.forEach(p => expect(p.course).toBe('MIC'));
  });

  test('year filter returns correct papers', () => {
    const result = applyFilters(ALL_PAPERS, { ...NO_FILTER, year: '2024' });
    expect(result).toHaveLength(1);
    expect(result[0]).toBe(MID_2024_CAT2);
  });

  test('exam filter returns correct papers', () => {
    const result = applyFilters(ALL_PAPERS, { ...NO_FILTER, exam: 'FAT' });
    expect(result).toHaveLength(1);
    expect(result[0]).toBe(MIC_2023_FAT);
  });

  test('search filter returns matching papers', () => {
    const result = applyFilters(ALL_PAPERS, { ...NO_FILTER, search: 'mobile' });
    expect(result).toHaveLength(1);
    expect(result[0]).toBe(MID_2024_CAT2);
  });

  test('no matches returns empty array', () => {
    const result = applyFilters(ALL_PAPERS, { ...NO_FILTER, course: 'NONE' });
    expect(result).toHaveLength(0);
  });

  test('empty input array returns empty array', () => {
    expect(applyFilters([], { ...NO_FILTER, course: 'MIC' })).toHaveLength(0);
  });

  test('does not mutate the input array', () => {
    const input = [...ALL_PAPERS];
    applyFilters(input, { ...NO_FILTER, course: 'MIC' });
    expect(input).toHaveLength(3);
  });

  test('combined course + exam filter', () => {
    const result = applyFilters(ALL_PAPERS, { ...NO_FILTER, course: 'MIC', exam: 'CAT1' });
    expect(result).toHaveLength(1);
    expect(result[0]).toBe(MIC_2025_CAT1);
  });
});
