/* ─────────────────────────────────────────────
   tests/validate-logic.test.js
   Unit tests for js/validate-logic.js
───────────────────────────────────────────── */
'use strict';

const { validateFormData, REQUIRED_FIELDS } = require('../js/validate-logic');

/* ── Valid form fixture ──────────────────────── */
const VALID_FIELDS = {
  sCode:    'CSE2006',
  sSubject: 'Microprocessors & Interfacing',
  sCourse:  'MIC',
  sYear:    '2025',
  sExam:    'CAT1',
  sUrl:     'https://drive.google.com/file/d/abc123'
};

/* ═══════════════════════════════════════════
   REQUIRED_FIELDS constant
════════════════════════════════════════════ */
describe('REQUIRED_FIELDS', () => {
  test('exports an array', () => {
    expect(Array.isArray(REQUIRED_FIELDS)).toBe(true);
  });

  test('contains the 6 expected field ids', () => {
    expect(REQUIRED_FIELDS).toEqual(
      expect.arrayContaining(['sCode', 'sSubject', 'sCourse', 'sYear', 'sExam', 'sUrl'])
    );
    expect(REQUIRED_FIELDS).toHaveLength(6);
  });
});

/* ═══════════════════════════════════════════
   validateFormData — happy path
════════════════════════════════════════════ */
describe('validateFormData — valid input', () => {
  test('returns valid:true for a complete, correct form', () => {
    const { valid, errors } = validateFormData(VALID_FIELDS);
    expect(valid).toBe(true);
    expect(errors).toHaveLength(0);
  });

  test('accepts http:// URLs', () => {
    const { valid } = validateFormData({ ...VALID_FIELDS, sUrl: 'http://example.com/paper.pdf' });
    expect(valid).toBe(true);
  });

  test('accepts https:// URLs with query params', () => {
    const { valid } = validateFormData({ ...VALID_FIELDS, sUrl: 'https://example.com/p?id=1&dl=true' });
    expect(valid).toBe(true);
  });

  test('accepts https:// URLs with a path', () => {
    const { valid } = validateFormData({ ...VALID_FIELDS, sUrl: 'https://drive.google.com/uc?export=download&id=XYZ' });
    expect(valid).toBe(true);
  });
});

/* ═══════════════════════════════════════════
   validateFormData — required field checks
════════════════════════════════════════════ */
describe('validateFormData — missing required fields', () => {
  test('missing sCode → invalid, sCode in errors', () => {
    const { valid, errors } = validateFormData({ ...VALID_FIELDS, sCode: '' });
    expect(valid).toBe(false);
    expect(errors).toContain('sCode');
  });

  test('missing sSubject → invalid', () => {
    const { valid, errors } = validateFormData({ ...VALID_FIELDS, sSubject: '' });
    expect(valid).toBe(false);
    expect(errors).toContain('sSubject');
  });

  test('missing sCourse → invalid', () => {
    const { valid, errors } = validateFormData({ ...VALID_FIELDS, sCourse: '' });
    expect(valid).toBe(false);
    expect(errors).toContain('sCourse');
  });

  test('missing sYear → invalid', () => {
    const { valid, errors } = validateFormData({ ...VALID_FIELDS, sYear: '' });
    expect(valid).toBe(false);
    expect(errors).toContain('sYear');
  });

  test('missing sExam → invalid', () => {
    const { valid, errors } = validateFormData({ ...VALID_FIELDS, sExam: '' });
    expect(valid).toBe(false);
    expect(errors).toContain('sExam');
  });

  test('missing sUrl → invalid', () => {
    const { valid, errors } = validateFormData({ ...VALID_FIELDS, sUrl: '' });
    expect(valid).toBe(false);
    expect(errors).toContain('sUrl');
  });

  test('whitespace-only field is treated as missing', () => {
    const { valid, errors } = validateFormData({ ...VALID_FIELDS, sCode: '   ' });
    expect(valid).toBe(false);
    expect(errors).toContain('sCode');
  });

  test('missing key (undefined) treated as empty', () => {
    const fields = { ...VALID_FIELDS };
    delete fields.sSubject;
    const { valid, errors } = validateFormData(fields);
    expect(valid).toBe(false);
    expect(errors).toContain('sSubject');
  });

  test('all fields missing → 6 errors', () => {
    const { valid, errors } = validateFormData({});
    expect(valid).toBe(false);
    expect(errors).toHaveLength(6);
  });

  test('multiple missing fields → each reported once', () => {
    const { valid, errors } = validateFormData({ ...VALID_FIELDS, sCode: '', sYear: '' });
    expect(valid).toBe(false);
    expect(errors).toContain('sCode');
    expect(errors).toContain('sYear');
    expect(errors.filter(e => e === 'sCode')).toHaveLength(1);
    expect(errors.filter(e => e === 'sYear')).toHaveLength(1);
  });
});

/* ═══════════════════════════════════════════
   validateFormData — URL format validation
════════════════════════════════════════════ */
describe('validateFormData — URL format', () => {
  test('invalid URL string → sUrl in errors', () => {
    const { valid, errors } = validateFormData({ ...VALID_FIELDS, sUrl: 'not-a-url' });
    expect(valid).toBe(false);
    expect(errors).toContain('sUrl');
  });

  test('ftp:// URL → sUrl in errors (not http/https)', () => {
    const { valid, errors } = validateFormData({ ...VALID_FIELDS, sUrl: 'ftp://files.example.com/paper.pdf' });
    expect(valid).toBe(false);
    expect(errors).toContain('sUrl');
  });

  test('file:// URL → sUrl in errors', () => {
    const { valid, errors } = validateFormData({ ...VALID_FIELDS, sUrl: 'file:///home/user/paper.pdf' });
    expect(valid).toBe(false);
    expect(errors).toContain('sUrl');
  });

  test('javascript: URI → sUrl in errors', () => {
    const { valid, errors } = validateFormData({ ...VALID_FIELDS, sUrl: 'javascript:alert(1)' });
    expect(valid).toBe(false);
    expect(errors).toContain('sUrl');
  });

  test('URL without scheme → sUrl in errors', () => {
    const { valid, errors } = validateFormData({ ...VALID_FIELDS, sUrl: 'www.example.com/paper.pdf' });
    expect(valid).toBe(false);
    expect(errors).toContain('sUrl');
  });

  test('sUrl not in errors when URL is present and valid', () => {
    const { errors } = validateFormData(VALID_FIELDS);
    expect(errors).not.toContain('sUrl');
  });

  test('sUrl appears exactly once in errors for an invalid URL (no duplicate)', () => {
    const { errors } = validateFormData({ ...VALID_FIELDS, sUrl: 'bad-url' });
    expect(errors.filter(e => e === 'sUrl')).toHaveLength(1);
  });
});

/* ═══════════════════════════════════════════
   validateFormData — edge / boundary cases
════════════════════════════════════════════ */
describe('validateFormData — edge cases', () => {
  test('null input for a field treated as missing', () => {
    const { valid, errors } = validateFormData({ ...VALID_FIELDS, sCode: null });
    expect(valid).toBe(false);
    expect(errors).toContain('sCode');
  });

  test('returns a new errors array each call (no shared state)', () => {
    const result1 = validateFormData({});
    const result2 = validateFormData(VALID_FIELDS);
    expect(result1.errors).toHaveLength(6);
    expect(result2.errors).toHaveLength(0);
  });
});
