/* ─────────────────────────────────────────────
   submit.js — Student Paper Submission Logic
   Multi-photo upload · OCR scanning · localStorage pending queue
───────────────────────────────────────────── */
(function () {
  'use strict';

  var PENDING_KEY = 'vit_pending';

  /* ─── Elements ───────────────────────────── */
  var uploadZone   = document.getElementById('uploadZone');
  var fileInput    = document.getElementById('fileInput');
  var scanQueue    = document.getElementById('scanQueue');
  var scanOverall  = document.getElementById('scanOverall');
  var submitBtn    = document.getElementById('submitBtn');
  var formError    = document.getElementById('formError');
  var submitForm   = document.getElementById('submitForm');

  /* ─── State ──────────────────────────────── */
  var selectedFiles  = [];   // File objects
  var scanResults    = [];   // parallel array of scan results
  var scanning       = false;

  /* ─── Required fields check ─────────────── */
  var REQUIRED_IDS = ['sCode', 'sSubject', 'sCourse', 'sYear', 'sExam'];

  function requiredFilled() {
    return REQUIRED_IDS.every(function (id) {
      var el = document.getElementById(id);
      return el && el.value.trim() !== '';
    });
  }

  function flashRequired() {
    REQUIRED_IDS.forEach(function (id) {
      var el = document.getElementById(id);
      if (!el || el.value.trim() !== '') return;
      el.style.transition = 'border-color .15s';
      el.style.borderColor = '#f87171';
      setTimeout(function () { el.style.borderColor = ''; }, 1200);
    });
    if (formError) {
      formError.textContent = 'Please fill in all required fields before uploading.';
      formError.classList.remove('hidden');
      setTimeout(function () { formError.classList.add('hidden'); }, 3000);
    }
    /* Scroll to first empty required field */
    var first = REQUIRED_IDS.find(function (id) {
      var el = document.getElementById(id); return el && !el.value.trim();
    });
    if (first) document.getElementById(first).scrollIntoView({ behavior: 'smooth', block: 'center' });
  }

  /* ─── Upload Zone ────────────────────────── */
  if (uploadZone) {
    uploadZone.addEventListener('click', function (e) {
      if (e.target === fileInput) return;
      if (!requiredFilled()) { flashRequired(); return; }
      fileInput.click();
    });
    uploadZone.addEventListener('dragover', function (e) {
      e.preventDefault();
      uploadZone.classList.add('drag-over');
    });
    uploadZone.addEventListener('dragleave', function () {
      uploadZone.classList.remove('drag-over');
    });
    uploadZone.addEventListener('drop', function (e) {
      e.preventDefault();
      uploadZone.classList.remove('drag-over');
      if (!requiredFilled()) { flashRequired(); return; }
      handleFiles(Array.from(e.dataTransfer.files));
    });
  }

  if (fileInput) {
    fileInput.addEventListener('change', function () {
      handleFiles(Array.from(fileInput.files));
    });
  }

  /* ─── Slot real-time enforcement ────────────── */
  var slotInput = document.getElementById('sSlot');
  if (slotInput) {
    slotInput.addEventListener('keydown', function (e) {
      var val    = this.value;
      var key    = e.key;
      var isNav  = ['Backspace','Delete','Tab','ArrowLeft','ArrowRight'].indexOf(key) !== -1;
      if (isNav) return;
      e.preventDefault();

      if (val.length === 0) {
        /* First char must be A-G (letter only) */
        if (/^[A-Ga-g]$/.test(key)) this.value = key.toUpperCase();
      } else if (val.length === 1) {
        /* Second char must be 1 or 2 */
        if (key === '1' || key === '2') this.value = val + key;
      }
    });
  }

  /* ─── Handle File Selection ──────────────── */
  function handleFiles(files) {
    var accepted = files.filter(function (f) {
      return f.type.startsWith('image/') || f.type === 'application/pdf';
    }).slice(0, 10);

    if (!accepted.length) return;
    selectedFiles = accepted;
    scanResults   = new Array(accepted.length).fill(null);

    renderScanQueue();
    startScanning();
  }

  /* ─── Render Scan Queue ──────────────────── */
  function renderScanQueue() {
    if (!scanQueue) return;
    scanQueue.innerHTML = '';
    scanQueue.classList.remove('hidden');
    scanOverall && scanOverall.classList.add('hidden');

    selectedFiles.forEach(function (file, i) {
      var isPdf    = file.type === 'application/pdf';
      var thumbUrl = isPdf ? null : URL.createObjectURL(file);
      var item = document.createElement('div');
      item.className = 'scan-item scanning';
      item.id = 'scan-item-' + i;
      item.innerHTML =
        (isPdf
          ? '<div class="scan-item-thumb scan-item-pdf">PDF</div>'
          : '<img class="scan-item-thumb" src="' + thumbUrl + '" />'
        ) +
        '<div class="scan-item-info">' +
          '<div class="scan-item-name">' + escHtml(file.name) + '</div>' +
          '<div class="scan-item-status" id="scan-status-' + i + '">' + (isPdf ? 'PDF — no scan' : 'Waiting…') + '</div>' +
        '</div>' +
        '<div class="scan-item-icon" id="scan-icon-' + i + '">' + (isPdf ? '📄' : '⏳') + '</div>';
      scanQueue.appendChild(item);
    });

    /* Disable submit until scan complete */
    if (submitBtn) submitBtn.disabled = true;
  }

  /* ─── Start OCR Scanning ─────────────────── */
  function startScanning() {
    /* Separate image files from PDFs */
    var imageFiles = selectedFiles.filter(function (f) { return f.type.startsWith('image/'); });
    var pdfFiles   = selectedFiles.filter(function (f) { return f.type === 'application/pdf'; });

    /* Mark PDF slots as done immediately */
    selectedFiles.forEach(function (f, i) {
      if (f.type === 'application/pdf') {
        scanResults[i] = { file: f, success: true, valid: false, info: {}, isPdf: true };
      }
    });

    if (!imageFiles.length) {
      /* Only PDFs uploaded — allow submit */
      showOverallResult();
      return;
    }

    if (scanning || !window.OcrScan) {
      if (!window.OcrScan) showOcrUnavailable();
      return;
    }
    scanning = true;

    /* Track which index in selectedFiles each image corresponds to */
    var imageIndexMap = [];
    selectedFiles.forEach(function (f, i) {
      if (f.type.startsWith('image/')) imageIndexMap.push(i);
    });

    /* Mark first image as actively scanning */
    if (imageIndexMap.length) updateItemStatus(imageIndexMap[0], 'scanning', null);

    OcrScan.scanImages(imageFiles, function (done, total, result) {
      var globalIdx = imageIndexMap[done - 1];
      scanResults[globalIdx] = result;
      updateItemStatus(globalIdx, result.valid ? 'valid' : 'invalid', result);

      if (done < total) updateItemStatus(imageIndexMap[done], 'scanning', null);

      if (done === total) {
        scanning = false;
        showOverallResult();
      }
    }).catch(function (err) {
      scanning = false;
      showOcrUnavailable(err.message);
    });
  }

  /* ─── Update a Single Scan Item ─────────── */
  function updateItemStatus(idx, state, result) {
    var item    = document.getElementById('scan-item-' + idx);
    var statusEl= document.getElementById('scan-status-' + idx);
    var iconEl  = document.getElementById('scan-icon-' + idx);
    if (!item) return;

    item.className = 'scan-item ' + state;

    if (state === 'scanning') {
      if (statusEl) statusEl.textContent = 'Scanning…';
      if (iconEl)   iconEl.textContent   = '⏳';
    } else if (state === 'valid' && result) {
      var d = result.info;
      var parts = [];
      if (d.courseCode) parts.push('Code: ' + d.courseCode);
      if (d.slot)       parts.push('Slot: ' + d.slot);
      if (d.courseName) parts.push(d.courseName.substring(0, 30));
      if (statusEl) statusEl.textContent = parts.join(' · ') || 'Detected';
      if (iconEl)   iconEl.textContent   = '✓';
    } else if (state === 'invalid' && result) {
      if (statusEl) statusEl.textContent = 'Uploaded';
      if (iconEl)   iconEl.textContent   = '✓';
    }
  }

  /* ─── Show Overall Scan Result ───────────── */
  function showOverallResult() {
    var validCount = scanResults.filter(function (r) { return r && r.valid; }).length;
    var pdfCount   = scanResults.filter(function (r) { return r && r.isPdf; }).length;
    if (!scanOverall) return;
    scanOverall.classList.remove('hidden');

    if (pdfCount > 0 && validCount === 0) {
      /* Only PDFs — accepted without OCR */
      scanOverall.className = 'scan-overall ok';
      scanOverall.textContent = '✓ ' + pdfCount + ' PDF' + (pdfCount > 1 ? 's' : '') + ' attached. Ready to submit.';
    } else if (validCount > 0) {
      scanOverall.className = 'scan-overall ok';
      scanOverall.textContent = '✓ ' + validCount + ' of ' + selectedFiles.length +
        ' file' + (selectedFiles.length > 1 ? 's' : '') + ' verified. Ready to submit.';
    } else {
      scanOverall.className = 'scan-overall ok';
      scanOverall.textContent = '✓ ' + selectedFiles.length + ' file' + (selectedFiles.length > 1 ? 's' : '') + ' uploaded. Ready to submit.';
    }
    if (submitBtn) submitBtn.disabled = false;
  }

  /* ─── OCR Unavailable Fallback ───────────── */
  function showOcrUnavailable() {
    if (scanQueue) {
      var note = document.createElement('div');
      note.className = 'scan-overall ok';
      note.textContent = '✓ Files uploaded. Ready to submit.';
      scanQueue.appendChild(note);
    }
    if (submitBtn) submitBtn.disabled = false;
  }

  /* ─── Navbar Scroll Blur ──────────────────── */
  var navbar = document.getElementById('navbar');
  if (navbar) {
    window.addEventListener('scroll', function () {
      navbar.classList.toggle('scrolled', window.scrollY > 20);
    });
  }

  /* ─── Mini Three.js Background ───────────── */
  if (typeof THREE !== 'undefined') {
    try {
      var canvas   = document.getElementById('heroCanvas');
      var renderer = new THREE.WebGLRenderer({ canvas: canvas, alpha: true, antialias: false });
      var scene    = new THREE.Scene();
      var camera   = new THREE.PerspectiveCamera(60, canvas.offsetWidth / (canvas.offsetHeight || 400), 0.1, 1000);
      camera.position.z = 5;
      renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
      renderer.setSize(canvas.offsetWidth, canvas.offsetHeight || 400);
      var starGeo = new THREE.BufferGeometry();
      var starPos = new Float32Array(800 * 3);
      for (var si = 0; si < 800 * 3; si++) starPos[si] = (Math.random() - 0.5) * 30;
      starGeo.setAttribute('position', new THREE.BufferAttribute(starPos, 3));
      scene.add(new THREE.Points(starGeo, new THREE.PointsMaterial({ color: 0xffffff, size: 0.04, transparent: true, opacity: 0.6 })));
      var mesh = new THREE.Mesh(
        new THREE.IcosahedronGeometry(1, 1),
        new THREE.MeshStandardMaterial({ color: 0x7c3aed, emissive: 0x4c1d8f, emissiveIntensity: 0.5, wireframe: true, transparent: true, opacity: 0.35 })
      );
      mesh.position.set(2, 0, -2);
      scene.add(mesh);
      scene.add(new THREE.PointLight(0x7c3aed, 2, 10));
      scene.add(new THREE.AmbientLight(0x1a0030, 1));
      (function animate() {
        requestAnimationFrame(animate);
        mesh.rotation.x += 0.004; mesh.rotation.y += 0.006;
        renderer.render(scene, camera);
      })();
      window.addEventListener('resize', function () {
        var w = canvas.offsetWidth, h = canvas.offsetHeight || 400;
        camera.aspect = w / h; camera.updateProjectionMatrix();
        renderer.setSize(w, h);
      });
    } catch (e) {}
  }

  /* ─── Form Submission ─────────────────────── */
  if (submitForm) {
    submitForm.addEventListener('submit', function (e) {
      e.preventDefault();
      if (!validateForm()) return;
      if (formError) formError.classList.add('hidden');

      savePendingSubmission(scanResults, function (err) {
        if (err) {
          formError.textContent = 'Storage error: ' + err;
          formError.classList.remove('hidden');
          return;
        }
        showSuccess();
      });
    });
  }

  /* ─── Build & Save Pending Submission ────── */
  async function savePendingSubmission(_, cb) {
    var allFiles = selectedFiles.slice();

    var sub = {
      id          : 'sub_' + Date.now(),
      studentName : val('sName'),
      code        : val('sCode').toUpperCase(),
      subject     : val('sSubject'),
      course      : val('sCourse'),
      year        : parseInt(val('sYear'), 10) || new Date().getFullYear(),
      exam        : val('sExam'),
      semester    : val('sSem'),
      slot        : val('sSlot').toUpperCase(),
      batch       : val('sBatch'),
      url         : val('sUrl'),
      notes       : val('sNotes'),
      submittedAt : new Date().toISOString(),
      status      : 'pending',
      images      : []
    };

    /* Build image metadata from scan results */
    allFiles.forEach(function (file) {
      var result = scanResults.find(function (r) { return r && r.file === file; });
      sub.images.push({
        name    : file.name,
        isPdf   : file.type === 'application/pdf',
        valid   : !!(result && result.valid),
        detected: (result && result.info) ? result.info : {}
      });
    });

    /* Auto-fill from OCR when form fields empty */
    var firstValid = scanResults.find(function (r) { return r && r.valid && r.info; });
    if (firstValid) {
      if (!sub.code     && firstValid.info.courseCode) sub.code     = firstValid.info.courseCode;
      if (!sub.subject  && firstValid.info.courseName) sub.subject  = firstValid.info.courseName;
      if (!sub.exam     && firstValid.info.examType)   sub.exam     = firstValid.info.examType;
      if (!sub.year     && firstValid.info.year)       sub.year     = firstValid.info.year;
      if (!sub.semester && firstValid.info.semester)   sub.semester = firstValid.info.semester;
    }

    /* Show uploading state on submit button */
    if (submitBtn) { submitBtn.disabled = true; submitBtn.textContent = window.DB && window.DB.configured() ? 'Uploading…' : 'Saving…'; }

    try {
      if (window.DB) {
        /* Supabase: uploads images + saves row; falls back to localStorage automatically */
        await window.DB.savePending(sub, allFiles);
      } else {
        /* No DB module loaded — plain localStorage with inline thumbnails */
        await legacyLocalSave(sub, allFiles);
      }
      cb(null);
    } catch (e) {
      cb(e.message || 'Save failed');
    } finally {
      if (submitBtn) { submitBtn.disabled = false; submitBtn.textContent = 'Submit Paper'; }
    }
  }

  /* Legacy path: generate base64 thumbnails and save to localStorage */
  async function legacyLocalSave(sub, allFiles) {
    var thumbTasks = allFiles.map(function (file) {
      if (file.type === 'application/pdf') return Promise.resolve(null);
      return window.OcrScan ? OcrScan.makeThumbnail(file).catch(function () { return null; }) : Promise.resolve(null);
    });
    var thumbs = await Promise.all(thumbTasks);
    thumbs.forEach(function (thumb, i) {
      if (sub.images[i] && thumb) sub.images[i].thumb = thumb;
    });
    var existing = JSON.parse(localStorage.getItem(PENDING_KEY) || '[]');
    existing.push(sub);
    localStorage.setItem(PENDING_KEY, JSON.stringify(existing));
  }

  /* ─── Slot validation ───────────────────────── */
  function slotValid() {
    var el = document.getElementById('sSlot');
    if (!el || el.value.trim() === '') return true;
    return /^[A-Ga-g][12]$/.test(el.value.trim());
  }

  function flashSlot() {
    var el = document.getElementById('sSlot');
    if (!el) return;
    el.style.transition = 'border-color .15s';
    el.style.borderColor = '#f87171';
    setTimeout(function () { el.style.borderColor = ''; }, 1200);
    if (formError) {
      formError.textContent = 'Slot must be a letter A–G followed by 1 or 2 (e.g. A1, B2, G1).';
      formError.classList.remove('hidden');
      setTimeout(function () { formError.classList.add('hidden'); }, 3500);
    }
    el.scrollIntoView({ behavior: 'smooth', block: 'center' });
  }

  /* ─── Validation ──────────────────────────── */
  function validateForm() {
    if (!requiredFilled()) { flashRequired(); return false; }
    if (!slotValid()) { flashSlot(); return false; }
    return selectedFiles.length > 0;
  }

  /* ─── Show Success ───────────────────────── */
  function showSuccess() {
    var card    = document.getElementById('submitCard');
    var success = document.getElementById('successState');
    var guide   = document.querySelector('.submit-guidelines');
    if (card)  card.classList.add('hidden');
    if (guide) guide.classList.add('hidden');
    if (!success) return;

    success.classList.remove('hidden');
    success.style.display = 'block';
    window.scrollTo({ top: 0, behavior: 'smooth' });

    /* Pop in the checkmark */
    var icon = success.querySelector('.success-icon');
    if (icon) {
      icon.style.opacity = '0'; icon.style.transform = 'scale(0.4)';
      setTimeout(function () {
        icon.style.transition = 'all 0.55s cubic-bezier(0.34, 1.56, 0.64, 1)';
        icon.style.opacity = '1'; icon.style.transform = 'scale(1)';
      }, 80);
    }

    /* Confetti burst */
    var confetti = document.getElementById('successConfetti');
    if (confetti) {
      var colors = ['#7c3aed','#a78bfa','#34d399','#f59e0b','#f472b6','#60a5fa'];
      for (var i = 0; i < 36; i++) {
        var s = document.createElement('span');
        s.style.left       = (Math.random() * 100) + '%';
        s.style.background = colors[Math.floor(Math.random() * colors.length)];
        s.style.animationDelay = (Math.random() * 0.6) + 's';
        s.style.animationDuration = (1.6 + Math.random() * 1.2) + 's';
        s.style.width  = (6 + Math.random() * 6) + 'px';
        s.style.height = (6 + Math.random() * 6) + 'px';
        confetti.appendChild(s);
      }
    }
  }

  /* ─── Helpers ─────────────────────────────── */
  function val(id) {
    var el = document.getElementById(id);
    return el ? el.value.trim() : '';
  }

  function escHtml(str) {
    if (!str) return '';
    return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }

})();
