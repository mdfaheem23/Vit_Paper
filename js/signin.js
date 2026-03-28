/* ─────────────────────────────────────────────
   signin.js — Sign-In & Admin Mode
   Admin mode activates inline card controls + FAB
───────────────────────────────────────────── */
(function () {
  'use strict';

  var _cfg        = window.ADMIN_CONFIG || {};
  var ADMIN_EMAIL = _cfg.email    || '';
  var ADMIN_HASH  = _cfg.passHash || '';

  async function sha256(str) {
    var buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(str));
    return Array.from(new Uint8Array(buf)).map(function (b) { return b.toString(16).padStart(2, '0'); }).join('');
  }

  /* ─── Sign-in modal elements ──────────────── */
  var signInBtn   = document.getElementById('signInBtn');
  var signInModal = document.getElementById('signInModal');
  var signInClose = document.getElementById('signInClose');
  var signInForm  = document.getElementById('signInForm');
  var siEmail     = document.getElementById('siEmail');
  var siPassword  = document.getElementById('siPassword');
  var siError     = document.getElementById('siError');

  /* ─── Session helpers (localStorage — persists across refresh/tabs) ── */
  var SESSION_KEY = 'vit_session';
  var SESSION_TTL = 12 * 60 * 60 * 1000; // 12 hours

  function loadSession() {
    try {
      var raw = localStorage.getItem(SESSION_KEY);
      if (!raw) return null;
      var s = JSON.parse(raw);
      if (s && s.ts && (Date.now() - s.ts) > SESSION_TTL) {
        localStorage.removeItem(SESSION_KEY);
        return null;
      }
      return s;
    } catch (e) { return null; }
  }
  function saveSession(s) { localStorage.setItem(SESSION_KEY, JSON.stringify(Object.assign({}, s, { ts: Date.now() }))); }
  function dropSession()  { localStorage.removeItem(SESSION_KEY); }

  /* ─── Restore session on load ─────────────── */
  var session = loadSession();
  if (session) applySession(session);

  if (signInBtn) signInBtn.addEventListener('click', function () {
    /* If admin already logged in, toggle dropdown instead */
    if (session && session.role === 'admin') {
      toggleAdminDropdown();
      return;
    }
    if (session && session.role === 'user') {
      if (confirm('Sign out?')) {
        dropSession();
        location.reload();
      }
      return;
    }
    openSignIn();
  });

  if (signInClose) signInClose.addEventListener('click', closeSignIn);
  if (signInModal) signInModal.addEventListener('click', function (e) {
    if (e.target === signInModal) closeSignIn();
  });

  function openSignIn() {
    if (!signInModal) return;
    signInModal.classList.remove('hidden');
    var g = signInModal.querySelector('.modal-glass');
    if (g) g.classList.add('modal-open');
    document.body.style.overflow = 'hidden';
  }
  function closeSignIn() {
    if (!signInModal) return;
    signInModal.classList.add('hidden');
    var g = signInModal.querySelector('.modal-glass');
    if (g) g.classList.remove('modal-open');
    document.body.style.overflow = '';
  }

  if (signInForm) signInForm.addEventListener('submit', async function (e) {
    e.preventDefault();
    var email = siEmail.value.trim().toLowerCase();
    var pass  = siPassword.value;
    if (!email) return;

    if (email === ADMIN_EMAIL) {
      if (!pass) {
        siError.textContent = 'Admin password required.';
        siError.classList.remove('hidden');
        return;
      }
      var hash = await sha256(pass);
      if (hash !== ADMIN_HASH) {
        siError.textContent = 'Incorrect admin password.';
        siError.classList.remove('hidden');
        return;
      }
      var s = { email: email, role: 'admin' };
      saveSession(s);
      session = s;
      closeSignIn();
      applySession(s);
    } else {
      var s = { email: email, role: 'user' };
      saveSession(s);
      session = s;
      closeSignIn();
      applySession(s);
    }
  });

  /* ─── Apply session to UI ─────────────────── */
  function applySession(s) {
    if (!signInBtn) return;
    if (s.role === 'admin') {
      signInBtn.textContent = 'Admin \u25be';
      document.body.classList.add('admin-mode');
      showAdminFab();
      updatePendingBadge();
      /* Re-render cards with admin overlays once Papers is ready */
      if (window.renderPapers) {
        window.renderPapers();
      } else {
        document.addEventListener('papers-ready', function () {
          window.renderPapers && window.renderPapers();
        });
      }
    } else {
      var short = s.email.split('@')[0];
      signInBtn.textContent = short + ' \u25be';
    }
  }

  /* ─── Admin dropdown ──────────────────────── */
  var dropdown        = document.getElementById('adminDropdown');
  var signOutBtn      = document.getElementById('adminSignOutBtn');
  var adminAddPaperBtn= document.getElementById('adminAddPaperBtn');

  function toggleAdminDropdown() {
    if (!dropdown) return;
    dropdown.classList.toggle('hidden');
    if (!dropdown.classList.contains('hidden') && signInBtn) {
      var r = signInBtn.getBoundingClientRect();
      /* position: fixed — no scrollY/scrollX needed; right-align under button */
      dropdown.style.top   = (r.bottom + 6) + 'px';
      dropdown.style.left  = 'auto';
      dropdown.style.right = (window.innerWidth - r.right) + 'px';
      updatePendingBadge();
    }
  }

  document.addEventListener('click', function (e) {
    if (dropdown && !dropdown.classList.contains('hidden') &&
        !dropdown.contains(e.target) && e.target !== signInBtn) {
      dropdown.classList.add('hidden');
    }
  });

  if (adminAddPaperBtn) adminAddPaperBtn.addEventListener('click', function () {
    dropdown && dropdown.classList.add('hidden');
    openAddModal();
  });

  if (signOutBtn) signOutBtn.addEventListener('click', function () {
    dropSession();
    location.reload();
  });

  /* ─── Pending modal ────────────────────────── */
  var pendingModal      = document.getElementById('pendingModal');
  var pendingModalClose = document.getElementById('pendingModalClose');
  var pendingList       = document.getElementById('pendingList');
  var pendingBtn        = document.getElementById('adminPendingBtn');

  if (pendingBtn) pendingBtn.addEventListener('click', function () {
    dropdown && dropdown.classList.add('hidden');
    openPendingModal();
  });
  if (pendingModalClose) pendingModalClose.addEventListener('click', closePendingModal);
  if (pendingModal) pendingModal.addEventListener('click', function (e) {
    if (e.target === pendingModal) closePendingModal();
  });

  function openPendingModal() {
    if (!pendingModal) return;
    renderPendingList();
    pendingModal.classList.remove('hidden');
    document.body.style.overflow = 'hidden';
    var g = pendingModal.querySelector('.modal-glass');
    if (g) setTimeout(function () { g.classList.add('modal-open'); }, 10);
  }
  function closePendingModal() {
    if (!pendingModal) return;
    var g = pendingModal.querySelector('.modal-glass');
    if (g) g.classList.remove('modal-open');
    setTimeout(function () {
      pendingModal.classList.add('hidden');
      document.body.style.overflow = '';
    }, 250);
  }

  async function renderPendingList() {
    if (!pendingList) return;
    var list = window.DB ? await window.DB.loadPending()
                         : (function () { try { return JSON.parse(localStorage.getItem('vit_pending') || '[]'); } catch(e) { return []; } })();
    updatePendingBadge();

    if (!list.length) {
      pendingList.innerHTML = '<p style="color:var(--text-muted);text-align:center;padding:2.5rem 0">No pending submissions.</p>';
      return;
    }

    pendingList.innerHTML = list.map(function (sub) {
      var sid = sub.id;

      /* ── Collect best OCR data from all images ── */
      var det = {};
      (sub.images || []).forEach(function (img) {
        var d = img.detected || {};
        if (!det.courseCode && d.courseCode) det.courseCode = d.courseCode;
        if (!det.courseName && d.courseName) det.courseName = d.courseName;
        if (!det.examType   && d.examType)   det.examType   = d.examType;
        if (!det.year       && d.year)        det.year       = d.year;
        if (!det.semester   && d.semester)    det.semester   = d.semester;
      });

      /* ── Effective values: form submission > OCR detected ── */
      var subject   = sub.subject  || det.courseName || '';
      var code      = sub.code     || det.courseCode || '';
      var examVal   = sub.exam     || det.examType   || '';
      var yearVal   = sub.year     || det.year       || new Date().getFullYear();
      var semVal    = sub.semester || det.semester   || 'WS';
      var courseVal = sub.course   || (code.startsWith('CSE') ? 'MIC' : code.startsWith('CSI') ? 'MID' : '');
      var urlVal    = sub.url      || '';

      var date = sub.submittedAt
        ? new Date(sub.submittedAt).toLocaleDateString('en-IN', { day:'numeric', month:'short', year:'numeric' })
        : '';

      /* ── OCR chips (informational) ── */
      var chipStyle = 'padding:.15rem .55rem;border-radius:999px;font-size:.65rem;font-weight:600;';
      var ocrChips = [
        det.courseCode ? '<span style="' + chipStyle + 'background:rgba(139,92,246,.15);color:#c4b5fd;border:1px solid rgba(139,92,246,.25)">Code: ' + escH(det.courseCode) + '</span>' : '',
        det.courseName ? '<span style="' + chipStyle + 'background:rgba(20,184,166,.1);color:#5eead4;border:1px solid rgba(20,184,166,.2)">' + escH(det.courseName.substring(0, 28)) + '</span>' : '',
        det.examType   ? '<span style="' + chipStyle + 'background:rgba(99,102,241,.1);color:#a5b4fc;border:1px solid rgba(99,102,241,.2)">' + escH(det.examType) + '</span>' : '',
      ].filter(Boolean).join('');

      /* ── Thumbnails with reorder arrows ── */
      var imgs = sub.images || [];
      var arrowStyle = 'background:rgba(255,255,255,.07);border:1px solid rgba(255,255,255,.1);border-radius:4px;color:var(--text-muted);cursor:pointer;padding:.1rem .35rem;font-size:.7rem;line-height:1.4;';
      var thumbsHtml = imgs.map(function (img, i) {
        var thumb;
        if (img.isPdf) {
          thumb = '<div style="width:72px;height:88px;background:rgba(139,92,246,.1);border-radius:8px;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:.3rem;font-size:.65rem;color:var(--accent);border:1px solid rgba(139,92,246,.25)">' +
            '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>PDF</div>';
        } else if (img.thumb) {
          /* Use inline lightbox — window.open(dataURI) is blocked by Chrome */
          thumb = '<img src="' + escH(img.thumb) + '" onclick="window.showPendingPhoto(this.src)" style="width:72px;height:88px;object-fit:cover;border-radius:8px;border:1px solid rgba(255,255,255,.1);cursor:zoom-in;display:block" />';
        } else {
          thumb = '<div style="width:72px;height:88px;background:rgba(255,255,255,.04);border-radius:8px;border:1px solid rgba(255,255,255,.08);display:flex;align-items:center;justify-content:center;font-size:.6rem;color:var(--text-muted);text-align:center;padding:.3rem">' + escH((img.name || 'image').substring(0, 12)) + '</div>';
        }
        var leftBtn  = i > 0            ? '<button style="' + arrowStyle + '" onclick="window.pendingMoveImg(\'' + sid + '\',' + i + ',' + (i-1) + ')">←</button>' : '<span style="width:20px;display:inline-block"></span>';
        var rightBtn = i < imgs.length-1 ? '<button style="' + arrowStyle + '" onclick="window.pendingMoveImg(\'' + sid + '\',' + i + ',' + (i+1) + ')">→</button>' : '<span style="width:20px;display:inline-block"></span>';
        return '<div style="display:flex;flex-direction:column;align-items:center;gap:.3rem">' +
          thumb +
          '<div style="display:flex;gap:.2rem;align-items:center">' + leftBtn + '<span style="font-size:.6rem;color:var(--text-muted)">' + (i+1) + '</span>' + rightBtn + '</div>' +
        '</div>';
      }).join('');

      /* ── Read-only summary + collapsible manual fields ── */
      var slotVal  = sub.slot  || det.slot  || '';
      var batchVal = sub.batch || '';
      var summaryItems = [
        subject   ? '<span><strong style="color:var(--text)">Subject:</strong> ' + escH(subject) + '</span>' : '',
        code      ? '<span><strong style="color:var(--text)">Code:</strong> ' + escH(code) + '</span>' : '',
        courseVal ? '<span><strong style="color:var(--text)">Course:</strong> ' + escH(courseVal) + '</span>' : '',
        examVal   ? '<span><strong style="color:var(--text)">Exam:</strong> ' + escH(examVal) + '</span>' : '',
        yearVal   ? '<span><strong style="color:var(--text)">Year:</strong> ' + escH(String(yearVal)) + '</span>' : '',
        semVal    ? '<span><strong style="color:var(--text)">Sem:</strong> ' + escH(semVal === 'WS' ? 'Winter' : 'Fall') + '</span>' : '',
        slotVal   ? '<span><strong style="color:var(--text)">Slot:</strong> ' + escH(slotVal) + '</span>' : '',
        batchVal  ? '<span><strong style="color:var(--text)">Batch:</strong> ' + escH(batchVal) + '</span>' : '',
        urlVal    ? '<span><a href="' + escH(urlVal) + '" target="_blank" style="color:var(--accent)">Drive Link ↗</a></span>' : '',
      ].filter(Boolean).join('');

      var INP = 'background:rgba(255,255,255,.06);border:1px solid rgba(255,255,255,.12);border-radius:6px;padding:.35rem .65rem;font-size:.78rem;color:var(--text);width:100%;box-sizing:border-box;outline:none;font-family:inherit;';
      var SEL = 'background:rgba(20,17,40,.95);border:1px solid rgba(255,255,255,.12);border-radius:6px;padding:.35rem .5rem;font-size:.78rem;color:var(--text);width:100%;box-sizing:border-box;outline:none;font-family:inherit;';
      var opt = function(val, label, sel) { return '<option value="' + escH(val) + '"' + (sel === val ? ' selected' : '') + '>' + escH(label) + '</option>'; };

      var manualFields =
        '<div id="pf_manual_' + sid + '" style="display:none;margin-top:.6rem">' +
          '<div style="display:grid;grid-template-columns:1fr 1fr;gap:.45rem">' +
            '<input id="pf_s_'  + sid + '" value="' + escH(subject)        + '" placeholder="Subject / Course Name" style="' + INP + 'grid-column:1/-1" />' +
            '<input id="pf_c_'  + sid + '" value="' + escH(code)           + '" placeholder="Course Code e.g. CSI2003" style="' + INP + '" />' +
            '<select id="pf_ct_' + sid + '" style="' + SEL + '">' +
              opt('',    'Course type…', courseVal) +
              opt('MIC', 'MIC',          courseVal) +
              opt('MID', 'MID',          courseVal) +
            '</select>' +
            '<select id="pf_e_' + sid + '" style="' + SEL + '">' +
              opt('',     'Exam type…', examVal) +
              opt('CAT1', 'CAT 1',      examVal) +
              opt('CAT2', 'CAT 2',      examVal) +
              opt('FAT',  'FAT',        examVal) +
            '</select>' +
            '<input id="pf_y_'  + sid + '" value="' + escH(String(yearVal)) + '" placeholder="Year" type="number" min="2018" max="2030" style="' + INP + '" />' +
            '<select id="pf_sm_' + sid + '" style="' + SEL + '">' +
              opt('WS', 'Winter Sem', semVal) +
              opt('FS', 'Fall Sem',   semVal) +
            '</select>' +
            '<input id="pf_sl_' + sid + '" value="' + escH(slotVal)        + '" placeholder="Slot e.g. A1, L31+L32" style="' + INP + '" />' +
            '<input id="pf_b_'  + sid + '" value="' + escH(batchVal)       + '" placeholder="Batch e.g. 2024" style="' + INP + '" />' +
            '<input id="pf_u_'  + sid + '" value="' + escH(urlVal)         + '" placeholder="Google Drive URL (optional)" style="' + INP + 'grid-column:1/-1" />' +
          '</div>' +
        '</div>';

      var summaryBlock = summaryItems
        ? '<div style="display:flex;flex-wrap:wrap;gap:.5rem .9rem;font-size:.78rem;color:var(--text-muted);padding:.65rem .8rem;background:rgba(255,255,255,.03);border-radius:8px;border:1px solid rgba(255,255,255,.07)">' + summaryItems + '</div>'
        : '<div style="font-size:.78rem;color:var(--text-muted);padding:.5rem .75rem;background:rgba(255,165,0,.05);border-radius:8px;border:1px solid rgba(255,165,0,.15)">⚠ No fields detected — will be added as untitled.</div>';

      var fields =
        '<div style="margin-top:.75rem">' +
          summaryBlock +
          '<button id="pf_toggle_' + sid + '" onclick="window.toggleManualFields(\'' + sid + '\')" ' +
          'style="margin-top:.5rem;background:none;border:1px solid rgba(255,255,255,.1);border-radius:6px;color:var(--text-muted);font-size:.72rem;cursor:pointer;padding:.25rem .7rem;display:flex;align-items:center;gap:.3rem">✎ Edit manually</button>' +
          manualFields +
        '</div>';

      return '<div style="border:1px solid rgba(255,255,255,.08);border-radius:14px;padding:1.25rem;margin-bottom:1rem;background:rgba(255,255,255,.025)">' +

        /* Header */
        '<div style="display:flex;justify-content:space-between;align-items:flex-start;gap:.5rem;margin-bottom:.65rem">' +
          '<div style="font-size:.75rem;color:var(--text-muted);line-height:1.5">' +
            (sub.studentName ? 'By <strong style="color:var(--text)">' + escH(sub.studentName) + '</strong> · ' : '') + date +
            (sub.notes ? '<br>Notes: ' + escH(sub.notes) : '') +
          '</div>' +
          '<button onclick="window.rejectSubmission(\'' + sid + '\')" style="background:rgba(239,68,68,.1);color:#f87171;border:1px solid rgba(239,68,68,.25);padding:.3rem .7rem;border-radius:6px;cursor:pointer;font-size:.75rem;flex-shrink:0">✗ Reject</button>' +
        '</div>' +

        /* OCR chips */
        (ocrChips ? '<div style="display:flex;flex-wrap:wrap;gap:.3rem;margin-bottom:.75rem">' + ocrChips + '</div>' : '') +

        /* Thumbnails */
        (thumbsHtml ? '<div style="display:flex;gap:.65rem;flex-wrap:wrap;padding-bottom:.85rem;border-bottom:1px solid rgba(255,255,255,.06)">' + thumbsHtml + '</div>' : '') +

        /* Editable fields */
        fields +

        /* Footer: Download + Approve */
        '<div style="display:flex;justify-content:space-between;align-items:center;margin-top:.75rem;flex-wrap:wrap;gap:.5rem">' +
          '<button onclick="window.downloadPendingPdf(\'' + sid + '\')" style="background:rgba(99,102,241,.1);color:#a5b4fc;border:1px solid rgba(99,102,241,.25);padding:.35rem .9rem;border-radius:7px;cursor:pointer;font-size:.75rem;display:flex;align-items:center;gap:.35rem">' +
            '<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>' +
            'Download Photos PDF' +
          '</button>' +
          '<button onclick="window.approveSubmission(\'' + sid + '\')" style="background:rgba(34,197,94,.15);color:#4ade80;border:1px solid rgba(34,197,94,.3);padding:.4rem 1.4rem;border-radius:8px;cursor:pointer;font-size:.82rem;font-weight:600">✓ Approve &amp; Add Paper</button>' +
        '</div>' +

      '</div>';
    }).join('');
  }

  /* ── Toggle manual fields panel ── */
  window.toggleManualFields = function (sid) {
    var panel  = document.getElementById('pf_manual_' + sid);
    var toggle = document.getElementById('pf_toggle_' + sid);
    if (!panel) return;
    var open = panel.style.display !== 'none';
    panel.style.display  = open ? 'none' : 'block';
    if (toggle) toggle.textContent = open ? '✎ Edit manually' : '▲ Hide manual fields';
  };

  /* ── Photo reorder ── */
  window.pendingMoveImg = function (subId, fromIdx, toIdx) {
    var list = [];
    try { list = JSON.parse(localStorage.getItem('vit_pending') || '[]'); } catch (e) {}
    var sub = list.find(function (s) { return s.id === subId; });
    if (!sub || !sub.images || sub.images[fromIdx] === undefined || sub.images[toIdx] === undefined) return;
    var tmp = sub.images[fromIdx];
    sub.images[fromIdx] = sub.images[toIdx];
    sub.images[toIdx] = tmp;
    try { localStorage.setItem('vit_pending', JSON.stringify(list)); } catch (e) {}
    renderPendingList();
  };

  /* ── Approve — auto-fills from submission + OCR; uses manual fields if open ── */
  window.approveSubmission = async function (id) {
    var list = [];
    try { list = JSON.parse(localStorage.getItem('vit_pending') || '[]'); } catch (e) {}
    var sub = list.find(function (s) { return s.id === id; });
    if (!sub) return;

    /* Check if the manual fields panel is open */
    var manualPanel = document.getElementById('pf_manual_' + id);
    var manualOpen  = manualPanel && manualPanel.style.display !== 'none';

    var g = function (fieldId) {
      var el = document.getElementById(fieldId);
      return el ? el.value.trim() : '';
    };

    var subject, code, exam, year, semester, slot, batch, course, url;

    if (manualOpen) {
      /* Read from manual input fields */
      subject  = g('pf_s_'  + id);
      code     = g('pf_c_'  + id).toUpperCase();
      course   = g('pf_ct_' + id);
      exam     = g('pf_e_'  + id);
      year     = parseInt(g('pf_y_' + id), 10) || new Date().getFullYear();
      semester = g('pf_sm_' + id);
      slot     = g('pf_sl_' + id).toUpperCase() || undefined;
      batch    = g('pf_b_'  + id) || undefined;
      url      = g('pf_u_'  + id);
      if (!course && code) course = code.startsWith('CSE') ? 'MIC' : code.startsWith('CSI') ? 'MID' : '';
    }

    /* Collect best OCR data across all images */
    var det = {};
    (sub.images || []).forEach(function (img) {
      var d = img.detected || {};
      if (!det.courseCode && d.courseCode) det.courseCode = d.courseCode;
      if (!det.courseName && d.courseName) det.courseName = d.courseName;
      if (!det.examType   && d.examType)   det.examType   = d.examType;
      if (!det.year       && d.year)        det.year       = d.year;
      if (!det.semester   && d.semester)    det.semester   = d.semester;
      if (!det.slot       && d.slot)        det.slot       = d.slot;
    });

    /* Fall back to submission data + OCR for any empty fields */
    subject  = subject  || sub.subject  || det.courseName || '(untitled)';
    code     = (code    || sub.code     || det.courseCode  || '?').toUpperCase();
    exam     = exam     || sub.exam     || det.examType    || '?';
    year     = year     || sub.year     || det.year        || new Date().getFullYear();
    semester = semester || sub.semester || det.semester    || undefined;
    slot     = slot     || sub.slot     || det.slot        || undefined;
    batch    = batch    || sub.batch    || undefined;
    course   = course   || sub.course   || (code.startsWith('CSE') ? 'MIC' : code.startsWith('CSI') ? 'MID' : '?');
    url      = (manualOpen ? url : undefined) || sub.url || '#';

    /* Collect non-empty image thumbnails */
    var savedImages = (sub.images || []).map(function (img) { return img.thumb || null; }).filter(Boolean);

    var approvedPaper = {
      subject  : subject,
      code     : code,
      course   : course,
      year     : year,
      exam     : exam,
      semester : semester,
      slot     : slot,
      batch    : batch,
      url      : url,
      images   : savedImages.length ? savedImages : undefined,
      notes    : sub.notes || ''
    };

    if (window.DB && window.DB.configured()) {
      /* DELETE+INSERT (works around Supabase RLS blocking PATCH) */
      try {
        var newId = await window.DB.approveSubmission(id, Object.assign({}, approvedPaper, { submittedAt: sub.submittedAt, studentName: sub.studentName }));
        approvedPaper.id = newId;
      } catch (e) { /* DB failed — local cache only */ }
      /* Update approved cache so paper shows immediately for all users */
      if (window.Papers && window.Papers.saveApprovedCache) {
        try {
          var cached = JSON.parse(localStorage.getItem('vit_approved_cache') || '[]');
          if (approvedPaper.id) {
            cached = cached.filter(function (p) { return String(p.id) !== String(approvedPaper.id); });
            cached.push(approvedPaper);
          }
          window.Papers.saveApprovedCache(cached);
        } catch (e) {}
      }
    } else {
      window.Papers && window.Papers.addPaper(Object.assign({}, approvedPaper, { source: 'admin' }));
    }
    window.DB && window.DB.lsRemove(id);
    window.renderPapers && window.renderPapers();
    renderPendingList();
  };

  window.rejectSubmission = async function (id) {
    if (!confirm('Reject and delete this submission?')) return;
    if (window.DB && window.DB.configured()) {
      try { await window.DB.rejectPending(id); } catch (e) { /* DB reject failed — localStorage already cleaned */ }
    }
    window.DB && window.DB.lsRemove(id);
    renderPendingList();
  };

  /* ── Inline lightbox for photo thumbnails ── */
  window.showPendingPhoto = function (src) {
    var lb  = document.getElementById('photoLightbox');
    var img = document.getElementById('photoLightboxImg');
    if (!lb || !img) return;
    img.src = src;
    lb.style.display = 'flex';
  };

  /* ── Download submitted photos as printable PDF ── */
  window.downloadPendingPdf = function (subId) {
    var list = [];
    try { list = JSON.parse(localStorage.getItem('vit_pending') || '[]'); } catch (e) {}
    var sub = list.find(function (s) { return s.id === subId; });
    if (!sub) return;

    var thumbs = (sub.images || [])
      .filter(function (img) { return img.thumb && !img.isPdf; })
      .map(function (img) { return img.thumb; });

    if (!thumbs.length) {
      alert('No photo previews available to download.');
      return;
    }

    var title = escH(sub.subject || sub.code || 'Paper Photos');
    var imgTags = thumbs.map(function (src, i) {
      return '<div style="page-break-inside:avoid;text-align:center;margin-bottom:1.5rem">' +
        '<p style="font-family:sans-serif;font-size:11px;color:#666;margin:0 0 4px">Page ' + (i + 1) + '</p>' +
        '<img src="' + escH(src) + '" style="max-width:100%;max-height:26cm;object-fit:contain;" />' +
      '</div>';
    }).join('');

    var html = '<!DOCTYPE html><html><head><meta charset="UTF-8"><title>' + title + '</title>' +
      '<style>body{margin:1cm;background:#fff;font-family:sans-serif;}' +
      'h2{font-size:14px;margin-bottom:1.5rem;color:#333;}' +
      '@media print{h2{display:block;}@page{margin:.7cm;}}' +
      '</style></head><body>' +
      '<h2>' + title + ' — Submitted ' + (sub.submittedAt ? new Date(sub.submittedAt).toLocaleDateString() : '') + '</h2>' +
      imgTags +
      '<script>window.addEventListener("load",function(){window.print();});<\/script>' +
      '</body></html>';

    var blob = new Blob([html], { type: 'text/html' });
    var url  = URL.createObjectURL(blob);
    var a    = document.createElement('a');
    a.href   = url;
    a.target = '_blank';
    a.click();
    setTimeout(function () { URL.revokeObjectURL(url); }, 5000);
  };

  function updatePendingBadge() {
    try {
      var pending = JSON.parse(localStorage.getItem('vit_pending') || '[]');
      var n = pending.length;
      /* If Supabase is active, badge count is from the last loadPending call — good enough */
      var badge = document.getElementById('adminPendingBadge');
      if (badge) { badge.textContent = n; badge.classList.toggle('hidden', n === 0); }
      var navBadge = document.getElementById('adminNavBadge');
      if (navBadge) { navBadge.textContent = n; navBadge.classList.toggle('hidden', n === 0); }
      var fabCount = document.getElementById('pendingFabCount');
      if (fabCount) { fabCount.textContent = n; fabCount.style.display = n > 0 ? '' : 'none'; }
    } catch (e) {}
  }

  /* ─── FAB ─────────────────────────────────── */
  var adminFab     = document.getElementById('adminFab');
  var adminFabWrap = document.getElementById('adminFabWrap');
  var fabDropdown  = document.getElementById('fabDropdown');
  var fabAddBtn    = document.getElementById('fabAddBtn');
  var fabPendingBtn= document.getElementById('fabPendingBtn');
  var fabLogoutBtn = document.getElementById('fabLogoutBtn');
  var pendingFab   = document.getElementById('pendingFab');

  function toggleFabDropdown() {
    if (!fabDropdown) return;
    fabDropdown.classList.toggle('hidden');
    if (!fabDropdown.classList.contains('hidden')) updatePendingBadge();
  }

  function closeFabDropdown() {
    if (fabDropdown) fabDropdown.classList.add('hidden');
  }

  function showAdminFab() {
    if (adminFabWrap) adminFabWrap.classList.remove('hidden');
  }

  if (adminFab) adminFab.addEventListener('click', function (e) {
    e.stopPropagation();
    toggleFabDropdown();
  });

  if (pendingFab) pendingFab.addEventListener('click', function () {
    closeFabDropdown();
    openPendingModal();
  });

  if (fabAddBtn) fabAddBtn.addEventListener('click', function () {
    closeFabDropdown();
    openAddModal();
  });

  if (fabPendingBtn) fabPendingBtn.addEventListener('click', function () {
    closeFabDropdown();
    openPendingModal();
  });

  if (fabLogoutBtn) fabLogoutBtn.addEventListener('click', function () {
    closeFabDropdown();
    if (confirm('Log out of admin mode?')) { dropSession(); location.reload(); }
  });

  document.addEventListener('click', function (e) {
    if (fabDropdown && !fabDropdown.classList.contains('hidden') &&
        !fabDropdown.contains(e.target) && e.target !== adminFab) {
      closeFabDropdown();
    }
  });

  /* ─── Card admin buttons (event delegation) ── */
  var grid = document.getElementById('papersGrid');
  if (grid) {
    grid.addEventListener('click', function (e) {
      var editBtn = e.target.closest('[data-id].card-edit-btn');
      var delBtn  = e.target.closest('[data-id].card-del-btn');
      if (editBtn) { e.stopPropagation(); openEditModal(editBtn.dataset.id); }
      if (delBtn)  { e.stopPropagation(); deletePaper(delBtn.dataset.id); }
    });
  }

  function deletePaper(id) {
    if (!confirm('Delete this paper? This cannot be undone.')) return;
    window.Papers && window.Papers.deletePaper(id);
    window.renderPapers && window.renderPapers();
  }

  /* ════════════════════════════════════════════
     ADD MODAL — scan-based
  ════════════════════════════════════════════ */
  var addModal       = document.getElementById('addModal');
  var addModalClose  = document.getElementById('addModalClose');
  var addModalCancel = document.getElementById('addModalCancelBtn');
  var addPaperForm   = document.getElementById('addPaperForm');
  var scanStep       = document.getElementById('scanStep');
  var uploadZone     = document.getElementById('adminUploadZone');
  var fileInput      = document.getElementById('adminFileInput');
  var scanStatus     = document.getElementById('adminScanStatus');
  var scanMsg        = document.getElementById('adminScanMsg');
  var detectedPreview= document.getElementById('detectedPreview');
  var scanBackBtn    = document.getElementById('scanBackBtn');

  if (addModalClose)  addModalClose.addEventListener('click',  closeAddModal);
  if (addModalCancel) addModalCancel.addEventListener('click', closeAddModal);
  if (scanBackBtn)    scanBackBtn.addEventListener('click',    resetScanStep);
  if (addModal) addModal.addEventListener('click', function (e) {
    if (e.target === addModal) closeAddModal();
  });

  if (uploadZone) {
    uploadZone.addEventListener('click', function (e) { if (e.target !== fileInput) fileInput.click(); });
    uploadZone.addEventListener('dragover', function (e) { e.preventDefault(); uploadZone.classList.add('drag-over'); });
    uploadZone.addEventListener('dragleave', function () { uploadZone.classList.remove('drag-over'); });
    uploadZone.addEventListener('drop', function (e) {
      e.preventDefault(); uploadZone.classList.remove('drag-over');
      var files = Array.from(e.dataTransfer.files).filter(function (f) { return f.type.startsWith('image/') || f.type === 'application/pdf'; });
      if (files.length) runScan(files[0]);
    });
  }
  if (fileInput) fileInput.addEventListener('change', function () {
    if (fileInput.files.length) runScan(fileInput.files[0]);
  });

  function openAddModal() {
    resetScanStep();
    if (!addModal) return;
    addModal.classList.remove('hidden');
    document.body.style.overflow = 'hidden';
    setTimeout(function () { addModal.querySelector('.modal-glass').classList.add('modal-open'); }, 10);
  }
  function closeAddModal() {
    if (!addModal) return;
    addModal.querySelector('.modal-glass').classList.remove('modal-open');
    setTimeout(function () { addModal.classList.add('hidden'); document.body.style.overflow = ''; }, 250);
  }
  function resetScanStep() {
    if (scanStep)        scanStep.classList.remove('hidden');
    if (addPaperForm)    addPaperForm.classList.add('hidden');
    if (scanStatus)      scanStatus.classList.add('hidden');
    if (fileInput)       fileInput.value = '';
    if (detectedPreview) detectedPreview.innerHTML = '';
  }

  function runScan(file) {
    var isPdf = file.type === 'application/pdf';
    if (isPdf || !window.OcrScan) { showScanForm(file, null, isPdf); return; }
    scanStatus.classList.remove('hidden');
    scanMsg.textContent = 'Scanning paper…';
    OcrScan.scanImages([file], function () {}).then(function (results) {
      showScanForm(file, results[0].info, false);
    }).catch(function () { showScanForm(file, null, false); });
  }

  function showScanForm(file, info, isPdf) {
    if (scanStatus) scanStatus.classList.add('hidden');
    if (scanStep)   scanStep.classList.add('hidden');
    if (addPaperForm) addPaperForm.classList.remove('hidden');
    info = info || {};
    var previewHtml = isPdf
      ? '<div class="detected-thumb scan-item-pdf" style="width:80px;height:80px;font-size:.85rem">PDF</div>'
      : '<img class="detected-thumb" src="' + URL.createObjectURL(file) + '" />';
    var hasInfo = !!(info.courseCode || info.courseName || info.examType || info.year);
    if (detectedPreview) detectedPreview.innerHTML =
      '<div class="detected-thumb-row">' + previewHtml +
        '<div class="detected-chips">' +
          (isPdf
            ? '<span class="chip chip-warn">PDF — fill details below</span>'
            : (chip(info.courseCode,'Course Code') + chip(info.courseName,'Subject') +
               chip(info.examType,'Exam') + chip(info.year ? String(info.year) : null,'Year') +
               chip(info.slot,'Slot') +
               (!hasInfo ? '<span class="chip chip-warn">Could not auto-detect — fill manually</span>' : ''))
          ) +
        '</div>' +
      '</div>';

    setVal('fCode',    info.courseCode || '');
    setVal('fSubject', info.courseName || '');
    setVal('fYear',    info.year || '');
    if (info.examType) { var fe = document.getElementById('fExam'); if (fe) fe.value = info.examType; }
    if (info.semester) { var fs = document.getElementById('fSem');  if (fs) fs.value = info.semester; }
    if (info.courseCode) {
      var fc = document.getElementById('fCourse'); if (fc) {
        var c = info.courseCode.toUpperCase();
        fc.value = c;
      }
    }
  }

  function chip(val, label) {
    if (!val) return '';
    return '<span class="chip chip-ok"><span class="chip-label">' + escH(label) + '</span>' + escH(String(val)) + '</span>';
  }

  if (addPaperForm) addPaperForm.addEventListener('submit', function (e) {
    e.preventDefault();
    var url = getVal('fUrl');
    if (!url || !/^https?:\/\//i.test(url)) { var u = document.getElementById('fUrl'); if (u) { u.style.borderColor='#f87171'; u.focus(); } return; }
    window.Papers && window.Papers.addPaper({
      subject  : getVal('fSubject') || '(untitled)',
      code     : getVal('fCode').toUpperCase() || '?',
      course   : getVal('fCourse') || '?',
      year     : parseInt(getVal('fYear'), 10) || new Date().getFullYear(),
      exam     : getVal('fExam') || '?',
      semester : getVal('fSem'),
      url      : url,
      notes    : getVal('fNotes'),
      source   : 'admin'
    });
    closeAddModal();
    window.renderPapers && window.renderPapers();
  });

  /* ════════════════════════════════════════════
     EDIT MODAL
  ════════════════════════════════════════════ */
  var editModal      = document.getElementById('editModal');
  var editModalClose = document.getElementById('editModalClose');
  var editCancelBtn  = document.getElementById('editCancelBtn');
  var editPaperForm  = document.getElementById('editPaperForm');

  if (editModalClose) editModalClose.addEventListener('click', closeEditModal);
  if (editCancelBtn)  editCancelBtn.addEventListener('click',  closeEditModal);
  if (editModal) editModal.addEventListener('click', function (e) {
    if (e.target === editModal) closeEditModal();
  });

  function openEditModal(rawId) {
    var paper = (window.Papers ? window.Papers.getPapers() : []).find(function (p) { return String(p.id) === String(rawId); });
    if (!paper || !editModal) return;
    setVal('ePaperId', paper.id);
    setVal('eSubject', paper.subject || '');
    setVal('eCode',    paper.code    || '');
    setVal('eYear',    paper.year    || '');
    setVal('eUrl',     paper.url !== '#' ? (paper.url || '') : '');
    var ee = document.getElementById('eExam'); if (ee) ee.value = paper.exam || '';
    editModal.classList.remove('hidden');
    document.body.style.overflow = 'hidden';
    setTimeout(function () { editModal.querySelector('.modal-glass').classList.add('modal-open'); }, 10);
  }
  function closeEditModal() {
    if (!editModal) return;
    editModal.querySelector('.modal-glass').classList.remove('modal-open');
    setTimeout(function () { editModal.classList.add('hidden'); document.body.style.overflow = ''; }, 250);
  }

  if (editPaperForm) editPaperForm.addEventListener('submit', function (e) {
    e.preventDefault();
    var rawId  = getVal('ePaperId');
    var papers = window.Papers ? window.Papers.getPapers() : [];
    var paper  = papers.find(function (p) { return String(p.id) === rawId; });
    if (paper) {
      window.Papers && window.Papers.updatePaper(paper.id, {
        subject : getVal('eSubject') || undefined,
        code    : getVal('eCode').toUpperCase() || undefined,
        year    : parseInt(getVal('eYear'), 10) || undefined,
        exam    : getVal('eExam') || undefined,
        url     : getVal('eUrl') || '#',
        source  : 'admin'
      });
    }
    closeEditModal();
    window.renderPapers && window.renderPapers();
  });

  /* ─── Helpers ─────────────────────────────── */
  function getVal(id) { var el = document.getElementById(id); return el ? el.value.trim() : ''; }
  function setVal(id, val) { var el = document.getElementById(id); if (el) el.value = val; }
  function escH(s) {
    return String(s || '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
  }

})();
