/* ─────────────────────────────────────────────
   tests/utils.test.js
   Unit tests for js/utils.js → escHtml
───────────────────────────────────────────── */
'use strict';

const { escHtml } = require('../js/utils');

describe('escHtml', () => {
  /* ── Happy path ──────────────────────────── */
  test('returns plain string unchanged', () => {
    expect(escHtml('hello world')).toBe('hello world');
  });

  test('escapes ampersand', () => {
    expect(escHtml('a & b')).toBe('a &amp; b');
  });

  test('escapes less-than sign', () => {
    expect(escHtml('<script>')).toBe('&lt;script&gt;');
  });

  test('escapes greater-than sign', () => {
    expect(escHtml('a > b')).toBe('a &gt; b');
  });

  test('escapes double quotes', () => {
    expect(escHtml('"quoted"')).toBe('&quot;quoted&quot;');
  });

  test('escapes all four special chars in one string (XSS vector)', () => {
    const xss = '<img src="x" onerror="alert(1 & 2)">';
    expect(escHtml(xss)).toBe(
      '&lt;img src=&quot;x&quot; onerror=&quot;alert(1 &amp; 2)&quot;&gt;'
    );
  });

  /* ── Coercion ─────────────────────────────── */
  test('coerces number to string', () => {
    expect(escHtml(42)).toBe('42');
  });

  test('coerces zero to string', () => {
    expect(escHtml(0)).toBe('0');
  });

  test('coerces boolean false to string', () => {
    expect(escHtml(false)).toBe('false');
  });

  /* ── Edge cases ───────────────────────────── */
  test('returns empty string for null', () => {
    expect(escHtml(null)).toBe('');
  });

  test('returns empty string for undefined', () => {
    expect(escHtml(undefined)).toBe('');
  });

  test('returns empty string for empty string input', () => {
    expect(escHtml('')).toBe('');
  });

  test('handles string with multiple ampersands', () => {
    expect(escHtml('a&b&c')).toBe('a&amp;b&amp;c');
  });

  test('handles unicode characters untouched', () => {
    expect(escHtml('caf\u00e9 & \u00e9clair')).toBe('caf\u00e9 &amp; \u00e9clair');
  });

  test('handles already-escaped string literally (no double-escape)', () => {
    // escHtml is not idempotent by design — it escapes the & in &amp;
    expect(escHtml('&amp;')).toBe('&amp;amp;');
  });
});
