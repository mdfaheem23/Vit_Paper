/* ─────────────────────────────────────────────
   admin.js — Admin Panel Logic
   SHA-256 login · Scan-based add · Inline edit/delete · Pending review
───────────────────────────────────────────── */
(function () {
  'use strict';

  /* ─── Credentials ────────────────────────────── */
  var _cfg        = window.ADMIN_CONFIG || {};
  var ADMIN_EMAIL = _cfg.email    || 'faasu2327@gmail.com';
  var PASS_HASH   = _cfg.passHash || 'bc5b9bdbac1e8272de856c318c0ac4e8ce0c993782862f10a7853334247ce324';

  /* ─── SHA-256 ────────────────────────────────── */
  async function sha256(message) {
    var buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(message));
    return Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2, '0')).join('');
  }

  /* ─── DOM refs ───────────────────────────────── */
  var loginWall      = document.getElementById('loginWall');
  var adminDash      = document.getElementById('adminDash');
  var loginBtn       = document.getElementById('loginBtn');
  var adminEmail     = document.getElementById('adminEmail');
  var adminPass      = document.getElementById('adminPass');
  var loginError     = document.getElementById('loginError');
  var passToggle     = document.getElementById('passToggle');
  var logoutBtn      = document.getElementById('logoutBtn');
  var exportBtn      = document.getElementById('exportBtn');
  var addPaperBtn    = document.getElementById('addPaperBtn');
  var adminTableBody = document.getElementById('adminTableBody');
  var adminTotal     = document.getElementById('adminTotal');
  var adminSeed      = document.getElementById('adminSeed');
  var adminUser      = document.getElementById('adminUser');
  var navPapers      = document.getElementById('navPapers');
  var navPending     = document.getElementById('navPending');
  var panelPapers    = document.getElementById('panelPapers');
  var panelPending   = document.getElementById('panelPending');
  var paperSearch    = document.getElementById('paperSearch');
  var papersCountLabel = document.getElementById('papersCountLabel');
  var adminPageTitle   = document.getElementById('adminPageTitle');
  var tableEmpty     = document.getElementById('tableEmpty');

  /* Add modal */
  var addModal      = document.getElementById('addModal');
  var modalClose    = document.getElementById('modalClose');
  var modalCancel   = document.getElementById('modalCancelBtn');
  var addPaperForm  = document.getElementById('addPaperForm');
  var scanStep      = document.getElementById('scanStep');
  var adminUploadZone = document.getElementById('adminUploadZone');
  var adminFileInput  = document.getElementById('adminFileInput');
  var adminScanStatus = document.getElementById('adminScanStatus');
  var adminScanMsg    = document.getElementById('adminScanMsg');
  var detectedPreview = document.getElementById('detectedPreview');
  var scanBackBtn     = document.getElementById('scanBackBtn');

  /* Edit modal */
  var editModal     = document.getElementById('editModal');
  var editModalClose= document.getElementById('editModalClose');
  var editCancelBtn = document.getElementById('editCancelBtn');
  var editPaperForm = document.getElementById('editPaperForm');

  /* ─── Session Check (localStorage — persists across tabs and refresh) ── */
  var ADMIN_SESSION_KEY = 'vit_admin_session';
  var ADMIN_SESSION_TTL = 12 * 60 * 60 * 1000; // 12 hours

  function isSessionValid() {
    var ts = parseInt(localStorage.getItem(ADMIN_SESSION_KEY) || '0', 10);
    return ts && (Date.now() - ts) < ADMIN_SESSION_TTL;
  }
  function setAdminSession()   { localStorage.setItem(ADMIN_SESSION_KEY, Date.now().toString()); }
  function clearAdminSession() { localStorage.removeItem(ADMIN_SESSION_KEY); }

  if (isSessionValid()) showDashboard();

  /* ─── Login ──────────────────────────────────── */
  loginBtn.addEventListener('click', async function () {
    var email = adminEmail ? adminEmail.value.trim().toLowerCase() : '';
    var pass  = adminPass.value.trim();
    if (!email || !pass) return;
    if (email !== ADMIN_EMAIL) { loginError.classList.remove('hidden'); return; }
    loginBtn.textContent = 'Verifying…';
    loginBtn.disabled = true;
    var hash = await sha256(pass);
    loginBtn.textContent = 'Unlock Panel';
    loginBtn.disabled = false;
    if (hash === PASS_HASH) {
      loginError.classList.add('hidden');
      setAdminSession();
      showDashboard();
    } else {
      loginError.classList.remove('hidden');
      adminPass.value = '';
      adminPass.focus();
    }
  });

  adminPass.addEventListener('keyup', function (e) { if (e.key === 'Enter') loginBtn.click(); });
  passToggle && passToggle.addEventListener('click', function () {
    adminPass.type = adminPass.type === 'password' ? 'text' : 'password';
  });

  /* ─── Logout ─────────────────────────────────── */
  logoutBtn && logoutBtn.addEventListener('click', function () {
    clearAdminSession();
    location.reload();
  });

  /* ─── Tab Switching ─────────────────────────── */
  function switchTab(tab) {
    if (tab === 'papers') {
      panelPapers  && panelPapers.classList.remove('hidden');
      panelPending && panelPending.classList.add('hidden');
      navPapers    && navPapers.classList.add('active');
      navPending   && navPending.classList.remove('active');
      if (adminPageTitle) adminPageTitle.textContent = 'Papers';
      if (addPaperBtn) addPaperBtn.style.display = '';
    } else {
      panelPapers  && panelPapers.classList.add('hidden');
      panelPending && panelPending.classList.remove('hidden');
      navPapers    && navPapers.classList.remove('active');
      navPending   && navPending.classList.add('active');
      if (adminPageTitle) adminPageTitle.textContent = 'Pending Review';
      if (addPaperBtn) addPaperBtn.style.display = 'none';
    }
  }
  navPapers  && navPapers.addEventListener('click',  function () { switchTab('papers');  });
  navPending && navPending.addEventListener('click', function () { switchTab('pending'); });

  /* ─── Show Dashboard ─────────────────────────── */
  function showDashboard() {
    loginWall.classList.add('hidden');
    adminDash.classList.remove('hidden');
    renderTable();
    updateStats();
    renderPending();
    switchTab('papers');
  }

  /* ─── Render Table ───────────────────────────── */
  function renderTable(query) {
    var all = window.Papers ? window.Papers.getPapers() : [];
    var q = ((query !== undefined ? query : (paperSearch ? paperSearch.value : ''))).toLowerCase().trim();
    var papers = q
      ? all.filter(function (p) {
          return (p.subject || '').toLowerCase().includes(q) ||
                 (p.code    || '').toLowerCase().includes(q) ||
                 (p.exam    || '').toLowerCase().includes(q);
        })
      : all;

    if (papersCountLabel) {
      papersCountLabel.textContent = q
        ? papers.length + ' of ' + all.length + ' papers'
        : all.length + ' papers';
    }

    adminTableBody.innerHTML = '';
    if (tableEmpty) tableEmpty.classList.toggle('hidden', papers.length > 0);

    papers.forEach(function (p) {
      var isSeed = window.Papers && window.Papers.isSeedPaper(p.id);
      var tr = document.createElement('tr');
      tr.dataset.id = p.id;
      tr.innerHTML =
        '<td class="mono" style="font-size:.7rem;color:var(--text-muted)">' + p.id + '</td>' +
        '<td><strong style="font-size:.85rem">' + escHtml(p.subject) + '</strong></td>' +
        '<td class="mono">' + escHtml(p.code) + '</td>' +
        '<td>' + (p.year || '—') + '</td>' +
        '<td><span class="exam-badge exam-' + (p.exam || '').toLowerCase() + '">' + escHtml(p.exam) + '</span></td>' +
        '<td><span class="source-badge source-' + (p.source || 'seed') + '">' + (p.source || 'seed') + '</span></td>' +
        '<td>' + (
          p.url && p.url !== '#'
            ? '<a href="' + escHtml(p.url) + '" target="_blank" class="table-link">Open ↗</a>'
            : '<span class="muted-tag">No URL</span>'
        ) + '</td>' +
        '<td class="row-actions">' +
          '<button class="icon-btn edit-btn" data-edit="' + p.id + '" title="Edit">' +
            '<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 20h9"/><path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"/></svg>' +
          '</button>' +
          (!isSeed
            ? '<button class="icon-btn del-btn" data-del="' + p.id + '" title="Delete">' +
                '<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/><path d="M10 11v6"/><path d="M14 11v6"/></svg>' +
              '</button>'
            : '<span class="seed-lock" title="Seed paper — cannot delete">🔒</span>'
          ) +
        '</td>';
      adminTableBody.appendChild(tr);
    });

    /* Edit listeners */
    adminTableBody.querySelectorAll('[data-edit]').forEach(function (btn) {
      btn.addEventListener('click', function () {
        var id = parseInt(btn.dataset.edit, 10);
        openEditModal(id);
      });
    });

    /* Delete listeners */
    adminTableBody.querySelectorAll('[data-del]').forEach(function (btn) {
      btn.addEventListener('click', function () {
        var id = parseInt(btn.dataset.del, 10);
        if (confirm('Delete this paper? This cannot be undone.')) {
          window.Papers.deletePaper(id);
          renderTable();
          updateStats();
        }
      });
    });
  }

  /* ─── Update Stats ───────────────────────────── */
  function updateStats() {
    var all  = window.Papers ? window.Papers.getPapers() : [];
    var seed = all.filter(function (p) { return !p.source || p.source === 'seed'; }).length;
    var user = all.filter(function (p) { return p.source === 'admin'; }).length;
    if (adminTotal) adminTotal.textContent = all.length;
    if (adminSeed)  adminSeed.textContent  = seed;
    if (adminUser)  adminUser.textContent  = user;

    var pending = loadPending();
    var pendingEl = document.getElementById('adminPending');
    if (pendingEl) pendingEl.textContent = pending.length;
    var sidebarCount = document.getElementById('sidebarPendingCount');
    if (sidebarCount) {
      sidebarCount.textContent = pending.length;
      sidebarCount.classList.toggle('hidden', pending.length === 0);
    }
  }

  /* ─── Search ─────────────────────────────────── */
  paperSearch && paperSearch.addEventListener('input', function () {
    renderTable(paperSearch.value);
  });

  /* ════════════════════════════════════════════════
     ADD MODAL — scan-based flow
  ════════════════════════════════════════════════ */

  addPaperBtn && addPaperBtn.addEventListener('click', openAddModal);
  modalClose  && modalClose.addEventListener('click',  closeAddModal);
  modalCancel && modalCancel.addEventListener('click', closeAddModal);
  scanBackBtn && scanBackBtn.addEventListener('click', resetScanStep);
  addModal    && addModal.addEventListener('click', function (e) {
    if (e.target === addModal) closeAddModal();
  });

  function openAddModal() {
    resetScanStep();
    addModal.classList.remove('hidden');
    document.body.style.overflow = 'hidden';
    setTimeout(function () {
      addModal.querySelector('.modal-glass').classList.add('modal-open');
    }, 10);
  }

  function closeAddModal() {
    addModal.querySelector('.modal-glass').classList.remove('modal-open');
    setTimeout(function () {
      addModal.classList.add('hidden');
      document.body.style.overflow = '';
    }, 250);
  }

  function resetScanStep() {
    if (scanStep)       scanStep.classList.remove('hidden');
    if (addPaperForm)   addPaperForm.classList.add('hidden');
    if (adminScanStatus) adminScanStatus.classList.add('hidden');
    if (adminFileInput)  adminFileInput.value = '';
    if (detectedPreview) detectedPreview.innerHTML = '';
  }

  /* Upload zone click / drag */
  if (adminUploadZone) {
    adminUploadZone.addEventListener('click', function (e) {
      if (e.target !== adminFileInput) adminFileInput.click();
    });
    adminUploadZone.addEventListener('dragover', function (e) {
      e.preventDefault();
      adminUploadZone.classList.add('drag-over');
    });
    adminUploadZone.addEventListener('dragleave', function () {
      adminUploadZone.classList.remove('drag-over');
    });
    adminUploadZone.addEventListener('drop', function (e) {
      e.preventDefault();
      adminUploadZone.classList.remove('drag-over');
      var files = Array.from(e.dataTransfer.files).filter(function (f) {
        return f.type.startsWith('image/');
      });
      if (files.length) runScan(files[0]);
    });
  }

  adminFileInput && adminFileInput.addEventListener('change', function () {
    if (adminFileInput.files.length) runScan(adminFileInput.files[0]);
  });

  function runScan(file) {
    var isPdf = file.type === 'application/pdf';

    if (isPdf || !window.OcrScan) {
      /* PDF or no OCR — go straight to form; admin fills manually */
      showScanForm(file, null, isPdf);
      return;
    }
    adminScanStatus.classList.remove('hidden');
    adminScanMsg.textContent = 'Scanning paper…';

    OcrScan.scanImages([file], function () {}).then(function (results) {
      var r = results[0];
      showScanForm(file, r.info, false);
    }).catch(function () {
      showScanForm(file, null, false);
    });
  }

  function showScanForm(file, info, isPdf) {
    adminScanStatus.classList.add('hidden');
    scanStep.classList.add('hidden');
    addPaperForm.classList.remove('hidden');

    info = info || {};

    /* Preview: PDF icon or image thumbnail */
    var previewHtml;
    if (isPdf) {
      previewHtml = '<div class="detected-thumb scan-item-pdf" style="width:80px;height:80px;font-size:.85rem">PDF</div>';
    } else {
      var thumbUrl = URL.createObjectURL(file);
      previewHtml  = '<img class="detected-thumb" src="' + escHtml(thumbUrl) + '" />';
    }

    var hasInfo = !!(info.courseCode || info.courseName || info.examType || info.year);
    detectedPreview.innerHTML =
      '<div class="detected-thumb-row">' +
        previewHtml +
        '<div class="detected-chips">' +
          (isPdf
            ? '<span class="chip chip-warn">PDF uploaded — fill details below</span>'
            : (
                chip(info.courseCode, 'Course Code') +
                chip(info.courseName, 'Subject') +
                chip(info.examType,   'Exam') +
                chip(info.year ? String(info.year) : null, 'Year') +
                chip(info.slot, 'Slot') +
                (!hasInfo ? '<span class="chip chip-warn">Could not auto-detect — fill manually</span>' : '')
              )
          ) +
        '</div>' +
      '</div>';

    /* Pre-fill fields */
    setVal('fCode',    info.courseCode || '');
    setVal('fSubject', info.courseName || '');
    setVal('fYear',    info.year       || '');

    if (info.examType) {
      var fExam = document.getElementById('fExam');
      if (fExam) fExam.value = info.examType;
    }
    if (info.semester) {
      var fSem = document.getElementById('fSem');
      if (fSem) fSem.value = info.semester;
    }

    /* Auto-derive course type from code */
    if (info.courseCode) {
      var fCourse = document.getElementById('fCourse');
      if (fCourse) {
        var code = info.courseCode.toUpperCase();
        fCourse.value = code;
      }
    }
  }

  function chip(val, label) {
    if (!val) return '';
    return '<span class="chip chip-ok"><span class="chip-label">' + escHtml(label) + '</span>' + escHtml(String(val)) + '</span>';
  }

  /* Add paper form submit */
  addPaperForm && addPaperForm.addEventListener('submit', function (e) {
    e.preventDefault();
    var subject  = getVal('fSubject');
    var code     = getVal('fCode').toUpperCase();
    var course   = getVal('fCourse');
    var year     = parseInt(getVal('fYear'), 10) || 0;
    var exam     = getVal('fExam');
    var semester = getVal('fSem');
    var url      = getVal('fUrl');
    var notes    = getVal('fNotes');

    if (!url) {
      document.getElementById('fUrl').classList.add('form-input-error');
      document.getElementById('fUrl').focus();
      return;
    }

    window.Papers.addPaper({
      subject  : subject  || '(untitled)',
      code     : code     || '?',
      course   : course   || '?',
      year     : year     || new Date().getFullYear(),
      exam     : exam     || '?',
      semester : semester,
      url      : url,
      notes    : notes,
      source   : 'admin'
    });

    closeAddModal();
    renderTable();
    updateStats();
  });

  /* ════════════════════════════════════════════════
     EDIT MODAL
  ════════════════════════════════════════════════ */

  editModalClose && editModalClose.addEventListener('click', closeEditModal);
  editCancelBtn  && editCancelBtn.addEventListener('click',  closeEditModal);
  editModal      && editModal.addEventListener('click', function (e) {
    if (e.target === editModal) closeEditModal();
  });

  function openEditModal(id) {
    var all    = window.Papers ? window.Papers.getPapers() : [];
    var paper  = all.find(function (p) { return p.id === id; });
    if (!paper) return;

    document.getElementById('ePaperId').value  = paper.id;
    document.getElementById('eSubject').value  = paper.subject || '';
    document.getElementById('eCode').value     = paper.code    || '';
    document.getElementById('eYear').value     = paper.year    || '';
    document.getElementById('eUrl').value      = (paper.url !== '#' ? paper.url : '') || '';

    var eExam = document.getElementById('eExam');
    if (eExam) eExam.value = paper.exam || '';

    editModal.classList.remove('hidden');
    document.body.style.overflow = 'hidden';
    setTimeout(function () {
      editModal.querySelector('.modal-glass').classList.add('modal-open');
    }, 10);
  }

  function closeEditModal() {
    editModal.querySelector('.modal-glass').classList.remove('modal-open');
    setTimeout(function () {
      editModal.classList.add('hidden');
      document.body.style.overflow = '';
      if (editPaperForm) editPaperForm.reset();
    }, 250);
  }

  editPaperForm && editPaperForm.addEventListener('submit', function (e) {
    e.preventDefault();
    var id      = parseInt(document.getElementById('ePaperId').value, 10);
    var subject = document.getElementById('eSubject').value.trim();
    var code    = document.getElementById('eCode').value.trim().toUpperCase();
    var year    = parseInt(document.getElementById('eYear').value, 10) || 0;
    var exam    = document.getElementById('eExam').value;
    var url     = document.getElementById('eUrl').value.trim();

    if (!subject || !code) return;

    window.Papers.updatePaper(id, {
      subject : subject,
      code    : code,
      year    : year || undefined,
      exam    : exam || undefined,
      url     : url || '#',
      source  : 'admin'
    });

    closeEditModal();
    renderTable();
    updateStats();
  });

  /* ════════════════════════════════════════════════
     PENDING SUBMISSIONS
  ════════════════════════════════════════════════ */

  var PENDING_KEY = 'vit_pending';

  /* Always delegates to DB layer (falls back to localStorage when not configured) */
  function loadPending() {
    try { return JSON.parse(localStorage.getItem(PENDING_KEY) || '[]'); }
    catch (e) { return []; }
  }

  function savePending(list) {
    localStorage.setItem(PENDING_KEY, JSON.stringify(list));
  }

  async function renderPending() {
    var list = window.DB ? await window.DB.loadPending() : loadPending();
    var emptyEl = document.getElementById('pendingEmpty');
    var cardsEl = document.getElementById('pendingCards');
    if (!cardsEl) return;

    cardsEl.innerHTML = '';

    if (!list.length) {
      if (emptyEl) emptyEl.classList.remove('hidden');
      return;
    }
    if (emptyEl) emptyEl.classList.add('hidden');

    list.forEach(function (sub) {
      var card = document.createElement('div');
      card.className = 'pending-card';
      card.dataset.id = sub.id;

      var date = sub.submittedAt
        ? new Date(sub.submittedAt).toLocaleDateString('en-IN', { day:'numeric', month:'short', year:'numeric' })
        : '—';

      var thumbsHtml = (sub.images || []).map(function (img) {
        if (img.isPdf) {
          return '<div class="pending-thumb-wrap">' +
            '<div class="pending-thumb scan-item-pdf" style="width:80px;height:80px;font-size:.8rem">PDF</div>' +
            '<div class="pending-detected" style="background:rgba(239,68,68,.7)">' + escHtml(img.name || 'file.pdf').substring(0,12) + '</div>' +
            '</div>';
        }
        if (img.thumb) {
          var validClass = img.valid ? ' valid-thumb' : '';
          return '<div class="pending-thumb-wrap">' +
            '<img class="pending-thumb' + validClass + '" src="' + escHtml(img.thumb) + '"' +
            ' onclick="var lb=document.getElementById(\'photoLightbox\');var li=document.getElementById(\'photoLightboxImg\');if(lb&&li){li.src=this.src;lb.style.display=\'flex\';}" style="cursor:zoom-in" />' +
            (img.valid ? '<div class="pending-detected">' + escHtml(img.detected.courseCode || '') + '</div>' : '') +
            '</div>';
        }
        /* No thumbnail yet — show placeholder so the image is still counted */
        return '<div class="pending-thumb-wrap">' +
          '<div class="pending-thumb" style="width:80px;height:80px;background:rgba(255,255,255,.04);border:1px solid rgba(255,255,255,.1);border-radius:6px;display:flex;align-items:center;justify-content:center;font-size:.65rem;color:var(--text-muted);text-align:center;padding:.3rem">' +
            escHtml(img.name || 'image').substring(0, 14) +
          '</div>' +
        '</div>';
      }).join('');

      var validImgs = (sub.images || []).filter(function (i) { return i.valid; });
      var detectedSummary = validImgs.length
        ? validImgs.map(function (i) {
            return [i.detected.courseCode, i.detected.slot, i.detected.courseName]
              .filter(Boolean).join(' · ');
          }).join('<br>')
        : '<span style="color:var(--text-muted)">No fields auto-detected — manual review</span>';

      /* Collect best OCR info across all images for display */
      var ocrDet = {};
      (sub.images || []).forEach(function (img) {
        var d = img.detected || {};
        if (!ocrDet.courseCode && d.courseCode) ocrDet.courseCode = d.courseCode;
        if (!ocrDet.courseName && d.courseName) ocrDet.courseName = d.courseName;
        if (!ocrDet.examType   && d.examType)   ocrDet.examType   = d.examType;
        if (!ocrDet.year       && d.year)        ocrDet.year       = d.year;
        if (!ocrDet.semester   && d.semester)    ocrDet.semester   = d.semester;
        if (!ocrDet.slot       && d.slot)        ocrDet.slot       = d.slot;
      });
      var displayTitle = sub.subject || ocrDet.courseName || '—';
      var displayCode  = sub.code    || ocrDet.courseCode  || '';
      var displayExam  = sub.exam    || ocrDet.examType    || '';
      var displayYear  = sub.year    || ocrDet.year        || '';
      var displaySem   = sub.semester || ocrDet.semester   || '';
      var displaySlot  = sub.slot    || ocrDet.slot        || '';

      card.innerHTML =
        '<div class="pending-card-header">' +
          '<div class="pending-card-meta">' +
            '<div class="pending-card-title">' + escHtml(displayTitle) +
              (displayCode ? ' <span class="mono" style="font-size:.8rem;opacity:.7">' + escHtml(displayCode) + '</span>' : '') +
            '</div>' +
            '<div class="pending-card-sub">' +
              [displayExam, displayYear, sub.course || (displayCode.startsWith('CSE') ? 'MIC' : displayCode.startsWith('CSI') ? 'MID' : ''), displaySem, displaySlot ? 'Slot ' + displaySlot : '']
                .filter(Boolean).join(' · ') +
              ' · Submitted ' + date +
            '</div>' +
            (sub.studentName ? '<div class="pending-card-sub">By: ' + escHtml(sub.studentName) + '</div>' : '') +
            (sub.url ? '<div class="pending-card-sub"><a href="' + escHtml(sub.url) + '" target="_blank" class="table-link">Drive Link ↗</a></div>' : '') +
          '</div>' +
          '<div class="pending-card-actions">' +
            '<button class="btn btn-sm btn-approve" data-approve="' + escHtml(sub.id) + '">✓ Approve</button>' +
            '<button class="btn btn-sm btn-danger"  data-reject="'  + escHtml(sub.id) + '">✗ Reject</button>' +
          '</div>' +
        '</div>' +
        (thumbsHtml ? '<div class="pending-thumbs">' + thumbsHtml + '</div>' : '') +
        '<div class="pending-detected-summary" style="font-size:.78rem;margin-top:.6rem;color:var(--text-muted)">' +
          '<strong style="color:var(--text)">Detected:</strong> ' + detectedSummary +
        '</div>' +
        (sub.notes ? '<div style="font-size:.78rem;color:var(--text-muted);margin-top:.4rem">Notes: ' + escHtml(sub.notes) + '</div>' : '') +
        '<div style="display:flex;justify-content:flex-end;margin-top:.65rem">' +
          '<button class="btn btn-sm" style="background:rgba(99,102,241,.12);color:#a5b4fc;border:1px solid rgba(99,102,241,.25);font-size:.72rem;display:flex;align-items:center;gap:.3rem" data-download-pdf="' + escHtml(sub.id) + '">' +
            '<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>' +
            'Download Photos PDF' +
          '</button>' +
        '</div>';

      cardsEl.appendChild(card);
    });

    cardsEl.querySelectorAll('[data-approve]').forEach(function (btn) {
      btn.addEventListener('click', function () { approvePending(btn.dataset.approve); });
    });
    cardsEl.querySelectorAll('[data-reject]').forEach(function (btn) {
      btn.addEventListener('click', function () { rejectPending(btn.dataset.reject); });
    });
    cardsEl.querySelectorAll('[data-download-pdf]').forEach(function (btn) {
      btn.addEventListener('click', function () { downloadPendingPdf(btn.dataset.downloadPdf); });
    });
  }

  function downloadPendingPdf(subId) {
    var list = loadPending();
    var sub  = list.find(function (s) { return s.id === subId; });
    if (!sub) return;
    var thumbs = (sub.images || [])
      .filter(function (img) { return img.thumb && !img.isPdf; })
      .map(function (img) { return img.thumb; });
    if (!thumbs.length) { alert('No photo previews available.'); return; }

    var title = escHtml(sub.subject || sub.code || 'Paper Photos');
    var imgTags = thumbs.map(function (src, i) {
      return '<div style="page-break-inside:avoid;text-align:center;margin-bottom:1.5rem">' +
        '<p style="font-family:sans-serif;font-size:11px;color:#666;margin:0 0 4px">Page ' + (i + 1) + '</p>' +
        '<img src="' + src + '" style="max-width:100%;max-height:26cm;object-fit:contain;" />' +
      '</div>';
    }).join('');

    var html = '<!DOCTYPE html><html><head><meta charset="UTF-8"><title>' + title + '</title>' +
      '<style>body{margin:1cm;background:#fff;}h2{font-size:14px;margin-bottom:1.5rem;}' +
      '@media print{@page{margin:.7cm;}}</style></head><body>' +
      '<h2>' + title + ' — Submitted ' + (sub.submittedAt ? new Date(sub.submittedAt).toLocaleDateString() : '') + '</h2>' +
      imgTags +
      '<script>window.addEventListener("load",function(){window.print();});<\/script>' +
      '</body></html>';

    var blob = new Blob([html], { type: 'text/html' });
    var url  = URL.createObjectURL(blob);
    var a    = document.createElement('a');
    a.href   = url; a.target = '_blank'; a.click();
    setTimeout(function () { URL.revokeObjectURL(url); }, 5000);
  }

  function approvePending(id) {
    var list = loadPending();
    var sub  = list.find(function (s) { return s.id === id; });
    if (!sub) return;
    if (!confirm('Approve and add to papers list?')) return;

    /* Collect best OCR data across all images as fallback */
    var det = {};
    (sub.images || []).forEach(function (img) {
      var d = img.detected || {};
      if (!det.courseCode && d.courseCode) det.courseCode = d.courseCode;
      if (!det.courseName && d.courseName) det.courseName = d.courseName;
      if (!det.examType   && d.examType)   det.examType   = d.examType;
      if (!det.year       && d.year)        det.year       = d.year;
      if (!det.semester   && d.semester)    det.semester   = d.semester;
    });
    var subject  = sub.subject  || det.courseName || '(untitled)';
    var code     = (sub.code    || det.courseCode  || '?').toUpperCase();
    var exam     = sub.exam     || det.examType    || '?';
    var year     = sub.year     || det.year        || new Date().getFullYear();
    var semester = sub.semester || det.semester;
    var slot     = sub.slot     || det.slot        || '';
    var batch    = sub.batch    || '';
    var course   = sub.course   || (code.startsWith('CSE') ? 'MIC' : code.startsWith('CSI') ? 'MID' : '?');

    /* Collect image thumbnails to save with the paper */
    var savedImages = (sub.images || []).map(function (img) { return img.thumb || null; }).filter(Boolean);

    window.Papers && window.Papers.addPaper({
      subject  : subject,
      code     : code,
      course   : course,
      year     : year,
      exam     : exam,
      semester : semester,
      slot     : slot || undefined,
      batch    : batch || undefined,
      url      : sub.url || '#',
      images   : savedImages.length ? savedImages : undefined,
      notes    : sub.notes,
      source   : 'admin'
    });

    /* Remove from DB (Supabase marks approved; localStorage removes) */
    if (window.DB && window.DB.configured()) {
      window.DB.approvePending(id).catch(function (e) { console.warn('DB approve:', e); });
    }
    savePending(list.filter(function (s) { return s.id !== id; }));
    renderTable();
    updateStats();
    renderPending();
  }

  function rejectPending(id) {
    if (!confirm('Reject and delete this submission?')) return;
    if (window.DB && window.DB.configured()) {
      window.DB.rejectPending(id).catch(function (e) { console.warn('DB reject:', e); });
    }
    var list = loadPending();
    savePending(list.filter(function (s) { return s.id !== id; }));
    updateStats();
    renderPending();
  }

  /* ─── Export JSON ─────────────────────────────── */
  exportBtn && exportBtn.addEventListener('click', function () {
    var papers = window.Papers ? window.Papers.getPapers() : [];
    var json   = JSON.stringify(papers, null, 2);
    navigator.clipboard.writeText(json).then(function () {
      exportBtn.textContent = 'Copied! ✓';
      setTimeout(function () { exportBtn.textContent = 'Export JSON'; }, 2000);
    }).catch(function () {
      var blob = new Blob([json], { type: 'application/json' });
      window.open(URL.createObjectURL(blob), '_blank');
    });
  });

  /* ─── Helpers ─────────────────────────────────── */
  function getVal(id) {
    var el = document.getElementById(id);
    return el ? el.value.trim() : '';
  }
  function setVal(id, val) {
    var el = document.getElementById(id);
    if (el) el.value = val;
  }

  var escHtml = (window.Utils && window.Utils.escHtml) || function (str) {
    if (!str) return '';
    return String(str)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;')
      .replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  };

})();
