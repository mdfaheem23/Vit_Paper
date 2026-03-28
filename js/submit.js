/* ─────────────────────────────────────────────
   submit.js — Student Paper Submission Logic
   Multi-photo upload · localStorage pending queue
───────────────────────────────────────────── */
(function () {
  'use strict';

  var PENDING_KEY = 'vit_pending';

  /* ─── Elements ───────────────────────────── */
  var uploadZone   = document.getElementById('uploadZone');
  var fileInput    = document.getElementById('fileInput');
  var scanOverall  = document.getElementById('scanOverall');
  var submitBtn    = document.getElementById('submitBtn');
  var formError    = document.getElementById('formError');
  var submitForm   = document.getElementById('submitForm');

  /* ─── State ──────────────────────────────── */
  var selectedFiles = [];

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

  /* ─── Slot auto-uppercase ───────────────────── */
  var slotInput = document.getElementById('sSlot');
  if (slotInput) {
    slotInput.addEventListener('input', function () {
      var pos = this.selectionStart;
      this.value = this.value.toUpperCase();
      this.setSelectionRange(pos, pos);
    });
  }

  /* ─── Handle File Selection ──────────────── */
  function handleFiles(files) {
    var accepted = files.filter(function (f) {
      return f.type.startsWith('image/') || f.type === 'application/pdf';
    }).slice(0, 10);

    if (!accepted.length) return;
    selectedFiles = accepted;

    showUploadReady();
  }

  /* ─── Show upload ready state ─────────────── */
  function showUploadReady() {
    if (!scanOverall) return;
    var n = selectedFiles.length;
    scanOverall.className = 'scan-overall ok';
    scanOverall.textContent = '✓ ' + n + ' file' + (n === 1 ? '' : 's') + ' ready to submit.';
    scanOverall.classList.remove('hidden');
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

      savePendingSubmission(function (err) {
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
  async function savePendingSubmission(cb) {
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

    /* Build image metadata */
    allFiles.forEach(function (file) {
      sub.images.push({
        name  : file.name,
        isPdf : file.type === 'application/pdf',
        valid : false,
        detected: {}
      });
    });

    if (submitBtn) { submitBtn.disabled = true; submitBtn.textContent = window.DB && window.DB.configured() ? 'Uploading…' : 'Saving…'; }

    try {
      if (window.DB) {
        await window.DB.savePending(sub, allFiles);
      } else {
        var existing = JSON.parse(localStorage.getItem(PENDING_KEY) || '[]');
        existing.push(sub);
        localStorage.setItem(PENDING_KEY, JSON.stringify(existing));
      }
      cb(null);
    } catch (e) {
      cb(e.message || 'Save failed');
    } finally {
      if (submitBtn) { submitBtn.disabled = false; submitBtn.textContent = 'Submit Paper'; }
    }
  }

  /* ─── Slot validation ───────────────────────── */
  /* ─── Validation ──────────────────────────── */
  function validateForm() {
    if (!requiredFilled()) { flashRequired(); return false; }
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

    var icon = success.querySelector('.success-icon');
    if (icon) {
      icon.style.opacity = '0'; icon.style.transform = 'scale(0.4)';
      setTimeout(function () {
        icon.style.transition = 'all 0.55s cubic-bezier(0.34, 1.56, 0.64, 1)';
        icon.style.opacity = '1'; icon.style.transform = 'scale(1)';
      }, 80);
    }

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
