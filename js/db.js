/* ─────────────────────────────────────────────
   db.js — Database layer
   Supabase (images in Storage + rows in Postgres)
   Falls back to localStorage when not configured
──────────────────────────────────────────────*/
(function () {
  'use strict';

  var CFG    = window.SUPABASE_CONFIG || {};
  var SB_URL = (CFG.url     || '').replace(/\/$/, '');
  var SB_KEY = CFG.anonKey  || '';
  var BUCKET = 'vit-submissions';
  var TABLE  = 'pending_submissions';
  var LS_KEY = 'vit_pending';

  function configured() {
    return !!(SB_URL && SB_KEY &&
              SB_URL !== 'YOUR_SUPABASE_URL' &&
              SB_KEY !== 'YOUR_SUPABASE_ANON_KEY');
  }

  /* ─── REST helpers ─────────────────────────── */
  function authHeaders(extra) {
    return Object.assign({
      'Authorization': 'Bearer ' + SB_KEY,
      'apikey'       : SB_KEY
    }, extra || {});
  }

  async function sbGet(path) {
    var r = await fetch(SB_URL + path, { headers: authHeaders() });
    if (!r.ok) throw new Error('GET ' + path + ' → ' + r.status);
    return r.json();
  }

  async function sbPost(path, body) {
    var r = await fetch(SB_URL + path, {
      method : 'POST',
      headers: authHeaders({ 'Content-Type': 'application/json', 'Prefer': 'return=minimal' }),
      body   : JSON.stringify(body)
    });
    if (!r.ok) throw new Error('POST ' + path + ' → ' + r.status + ' ' + await r.text());
  }

  async function sbPatch(path, body) {
    var r = await fetch(SB_URL + path, {
      method : 'PATCH',
      headers: authHeaders({ 'Content-Type': 'application/json' }),
      body   : JSON.stringify(body)
    });
    if (!r.ok) throw new Error('PATCH ' + path + ' → ' + r.status);
  }

  async function sbDelete(path) {
    var r = await fetch(SB_URL + path, {
      method : 'DELETE',
      headers: authHeaders()
    });
    if (!r.ok) throw new Error('DELETE ' + path + ' → ' + r.status);
  }

  /* ─── Storage upload ───────────────────────── */
  async function resizeBlob(file) {
    if (file.type === 'application/pdf') return file;
    return new Promise(function (resolve) {
      var objUrl = window.URL.createObjectURL(file);
      var img    = new Image();
      img.onload = function () {
        var MAX = 1600, w = img.naturalWidth, h = img.naturalHeight;
        if (w > MAX) { h = Math.round(h * MAX / w); w = MAX; }
        var c = document.createElement('canvas');
        c.width = w; c.height = h;
        c.getContext('2d').drawImage(img, 0, 0, w, h);
        window.URL.revokeObjectURL(objUrl);
        c.toBlob(function (b) { resolve(b || file); }, 'image/jpeg', 0.88);
      };
      img.onerror = function () { window.URL.revokeObjectURL(objUrl); resolve(file); };
      img.src = objUrl;
    });
  }

  async function uploadImage(subId, index, file) {
    var blob = await resizeBlob(file);
    var ext  = file.type === 'application/pdf' ? 'pdf' : 'jpg';
    var safe = (file.name || ('img_' + index + '.' + ext)).replace(/[^a-zA-Z0-9._-]/g, '_');
    var path = subId + '/' + index + '_' + safe;

    var r = await fetch(SB_URL + '/storage/v1/object/' + BUCKET + '/' + path, {
      method : 'POST',
      headers: authHeaders({ 'x-upsert': 'true' }),
      body   : blob
    });
    if (!r.ok) throw new Error('Upload failed: ' + r.status + ' ' + await r.text());

    return SB_URL + '/storage/v1/object/public/' + BUCKET + '/' + path;
  }

  /* ─── Row normalize ───────────────────────── */
  function rowToSub(r) {
    return {
      id          : r.id,
      studentName : r.student_name,
      code        : r.code,
      subject     : r.subject,
      course      : r.course,
      year        : r.year,
      exam        : r.exam,
      semester    : r.semester,
      slot        : r.slot,
      batch       : r.batch,
      url         : r.url,
      notes       : r.notes,
      submittedAt : r.submitted_at,
      status      : r.status,
      images      : r.images || []
    };
  }

  /* ─── Public API ───────────────────────────── */

  async function savePending(sub, files) {
    if (!configured()) { lsSavePending(sub); return; }

    /* Upload images → get public URLs */
    var imageData = [];
    for (var i = 0; i < (files || []).length; i++) {
      var file   = files[i];
      var meta   = (sub.images || [])[i] || {};
      var pubUrl = null;
      try { pubUrl = await uploadImage(sub.id, i, file); } catch (e) { /* skip images that fail to upload */ }
      imageData.push({
        name    : file.name,
        isPdf   : file.type === 'application/pdf',
        valid   : meta.valid   || false,
        detected: meta.detected || {},
        thumb   : pubUrl   /* public Supabase URL — used as src in img tags */
      });
    }

    await sbPost('/rest/v1/' + TABLE, {
      id          : sub.id,
      student_name: sub.studentName || null,
      code        : sub.code        || null,
      subject     : sub.subject     || null,
      course      : sub.course      || null,
      year        : sub.year        || null,
      exam        : sub.exam        || null,
      semester    : sub.semester    || null,
      slot        : sub.slot        || null,
      batch       : sub.batch       || null,
      url         : sub.url         || null,
      notes       : sub.notes       || null,
      submitted_at: sub.submittedAt,
      status      : 'pending',
      images      : imageData
    });
  }

  async function loadPending() {
    if (!configured()) return lsLoadPending();
    try {
      var rows = await sbGet('/rest/v1/' + TABLE +
        '?select=*&status=eq.pending&order=submitted_at.desc');
      return rows.map(rowToSub);
    } catch (e) {
      return lsLoadPending();
    }
  }

  async function approvePending(id) {
    if (!configured()) return;
    await sbPatch('/rest/v1/' + TABLE + '?id=eq.' + encodeURIComponent(id),
      { status: 'approved' });
  }

  /* Approve by DELETE + INSERT (works when PATCH is blocked by RLS) */
  async function approveSubmission(pendingId, row) {
    var newId = (crypto.randomUUID ? crypto.randomUUID() : pendingId + '_approved');
    await sbDelete('/rest/v1/' + TABLE + '?id=eq.' + encodeURIComponent(pendingId));
    await sbPost('/rest/v1/' + TABLE, {
      id          : newId,
      student_name: row.studentName || null,
      code        : row.code        || null,
      subject     : row.subject     || null,
      course      : row.course      || null,
      year        : row.year        || null,
      exam        : row.exam        || null,
      semester    : row.semester    || null,
      slot        : row.slot        || null,
      batch       : row.batch       || null,
      url         : row.url         || null,
      notes       : row.notes       || null,
      submitted_at: row.submittedAt,
      status      : 'approved',
      images      : row.images      || []
    });
    return newId;
  }

  /* Patch fields on an approved paper — uses DELETE + INSERT since PATCH is blocked by RLS */
  async function patchApprovedPaper(id, data) {
    if (!configured()) return;
    await sbDelete('/rest/v1/' + TABLE + '?id=eq.' + encodeURIComponent(id));
    await sbPost('/rest/v1/' + TABLE, {
      id          : id,
      subject     : data.subject     || null,
      code        : data.code        || null,
      course      : data.course      || null,
      year        : data.year        || null,
      exam        : data.exam        || null,
      semester    : data.semester    || null,
      slot        : data.slot        || null,
      url         : data.url         || null,
      images      : data.images      || [],
      notes       : data.notes       || null,
      submitted_at: data.submittedAt || new Date().toISOString(),
      status      : 'approved'
    });
  }

  /* Delete an approved paper from Supabase */
  async function deleteApprovedPaper(id) {
    if (!configured()) return;
    await sbDelete('/rest/v1/' + TABLE + '?id=eq.' + encodeURIComponent(id));
  }

  async function rejectPending(id) {
    if (!configured()) return;
    await sbDelete('/rest/v1/' + TABLE + '?id=eq.' + encodeURIComponent(id));
  }

  async function loadApprovedPapers() {
    if (!configured()) return [];
    try {
      var rows = await sbGet('/rest/v1/' + TABLE + '?select=*&status=eq.approved&order=submitted_at.desc');
      return rows.map(function (r) {
        var imgs = (r.images || []).map(function (img) { return img.thumb || null; }).filter(Boolean);
        return {
          id      : r.id,
          subject : r.subject  || '(untitled)',
          code    : (r.code    || '').toUpperCase(),
          course  : r.course   || '?',
          year    : r.year     || '',
          exam    : r.exam     || '',
          semester: r.semester || '',
          slot    : r.slot     || '',
          url     : r.url      || '#',
          images  : imgs.length ? imgs : undefined,
          notes   : r.notes
        };
      });
    } catch (e) {
      return [];
    }
  }

  /* ─── localStorage fallback ────────────────── */
  function lsSavePending(sub) {
    try {
      var list = JSON.parse(localStorage.getItem(LS_KEY) || '[]');
      list.push(sub);
      localStorage.setItem(LS_KEY, JSON.stringify(list));
    } catch (e) {}
  }

  function lsLoadPending() {
    try { return JSON.parse(localStorage.getItem(LS_KEY) || '[]'); }
    catch (e) { return []; }
  }

  function lsRemovePending(id) {
    try {
      var list = JSON.parse(localStorage.getItem(LS_KEY) || '[]');
      localStorage.setItem(LS_KEY, JSON.stringify(list.filter(function (s) { return s.id !== id; })));
    } catch (e) {}
  }

  window.DB = {
    configured          : configured,
    savePending         : savePending,
    loadPending         : loadPending,
    approvePending      : approvePending,
    approveSubmission   : approveSubmission,
    rejectPending       : rejectPending,
    patchApprovedPaper  : patchApprovedPaper,
    deleteApprovedPaper : deleteApprovedPaper,
    loadApprovedPapers  : loadApprovedPapers,
    /* expose localStorage helpers for callers that still maintain LS in parallel */
    lsRemove            : lsRemovePending
  };
})();
