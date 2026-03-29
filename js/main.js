/* ─────────────────────────────────────────────
   main.js — Student-facing UI logic
   Preloader · Cursor · Navbar · Paper cards · Filters · GSAP
───────────────────────────────────────────── */
(function () {
  'use strict';

  /* ── State ────────────────────────────── */
  var activeFilters = { course: 'all', year: 'all', exam: 'all', search: '' };

  /* Convert single year "2025" → "2025-2026"; pass-through "2025-2026" unchanged */
  function fmtYear(y) {
    var s = String(y || '');
    if (/^\d{4}$/.test(s)) return s + '-' + (parseInt(s, 10) + 1);
    return s;
  }

  /* ════════════════════════════════════════
     PRELOADER
  ═══════════════════════════════════════ */
  function runPreloader() {
    var preloader = document.getElementById('preloader');
    var fill      = document.getElementById('preloaderFill');
    var pct       = document.getElementById('preloaderPct');
    if (!preloader) return Promise.resolve();

    return new Promise(function (resolve) {
      var start = performance.now();
      /* First visit: full 2s animation. Repeat visit: 300ms fast-skip. */
      var visited  = sessionStorage.getItem('vit_visited');
      var duration = visited ? 300 : 2000;
      sessionStorage.setItem('vit_visited', '1');

      function tick(now) {
        var p = Math.min((now - start) / duration, 1);
        var eased = p < 0.5 ? 2 * p * p : 1 - Math.pow(-2 * p + 2, 2) / 2;
        var val = Math.round(eased * 100);
        if (fill) fill.style.width = val + '%';
        if (pct)  pct.textContent  = val;
        if (p < 1) { requestAnimationFrame(tick); return; }

        // Exit
        var done = false;
        function hidePreloader() {
          if (done) return;
          done = true;
          preloader.style.display = 'none';
          resolve();
        }
        // Fallback: force hide after 1s in case GSAP fails
        setTimeout(hidePreloader, 1000);
        if (typeof gsap !== 'undefined') {
          gsap.to(preloader, {
            opacity: 0,
            scale: 1.04,
            duration: 0.7,
            ease: 'power2.inOut',
            onComplete: hidePreloader
          });
        } else {
          hidePreloader();
        }
      }
      requestAnimationFrame(tick);
    });
  }

  /* ════════════════════════════════════════
     NAVBAR
  ═══════════════════════════════════════ */
  function initNavbar() {
    var nav = document.getElementById('navbar');
    if (!nav) return;
    window.addEventListener('scroll', function () {
      nav.classList.toggle('scrolled', window.scrollY > 40);
    }, { passive: true });

    if (typeof gsap === 'undefined') return;

    var logo      = document.getElementById('navLogo');
    var logoV     = document.getElementById('logoV');
    var logoI     = document.getElementById('logoI');
    var logoT     = document.getElementById('logoT');
    var logoSpace  = document.getElementById('logoSpace');
    var logoSpace2 = document.getElementById('logoSpace2');
    var logoM      = document.getElementById('logoM');
    var expand    = document.getElementById('logoExpand');
    var logoQP    = document.getElementById('logoQP');
    var star1     = document.getElementById('doodleStar1');
    var star2     = document.getElementById('doodleStar2');
    var dot1      = document.getElementById('doodleDot1');
    var dot2      = document.getElementById('doodleDot2');
    var wiggle    = document.getElementById('doodleWiggle');
    if (!logo || !logoM || !expand) return;

    /* Measure full expand width */
    gsap.set(expand, { width: 'auto' });
    var expandedW = expand.offsetWidth;
    gsap.set(expand, { width: 0 });

    /* Measure space widths */
    gsap.set(logoSpace, { width: 'auto' });
    var spaceW = Math.max(logoSpace.offsetWidth, 6);
    gsap.set(logoSpace, { width: 0 });

    gsap.set(logoSpace2, { width: 'auto' });
    var spaceW2 = Math.max(logoSpace2 ? logoSpace2.offsetWidth : 0, 6);
    if (logoSpace2) gsap.set(logoSpace2, { width: 0 });

    var letters = [logoV, logoI, logoT, logoM, logoQP].filter(Boolean);

    /* ── Entrance ── */
    gsap.from(letters, {
      y: -20, opacity: 0,
      rotation: function (i) { return i % 2 === 0 ? -14 : 14; },
      duration: 0.5,
      ease: 'elastic.out(1, 0.55)',
      stagger: 0.07,
      delay: 0.1,
      onComplete: runExpand
    });

    function runExpand() {
      var tl = gsap.timeline();
      tl
        /* Spaces open between T–M and C–Q */
        .to(logoSpace,  { width: spaceW  + 4, duration: 0.25, ease: 'back.out(2)' })
        .to(logoSpace2, { width: spaceW2 + 4, duration: 0.25, ease: 'back.out(2)' }, '<')
        /* M squish */
        .to(logoM, { scaleX: 0.55, scaleY: 1.35, duration: 0.16, ease: 'power2.in' }, '-=0.05')
        /* ID MIC slides out */
        .to(expand, { width: expandedW, duration: 0.52, ease: 'elastic.out(1, 0.65)' }, '-=0.02')
        .to(logoM, { scaleX: 1, scaleY: 1, duration: 0.3, ease: 'back.out(2.5)' }, '-=0.42')
        /* Doodles pop in */
        .to([star1, star2], { opacity: 1, scale: 1, rotation: 360, transformOrigin: 'center', duration: 0.35, ease: 'back.out(3)', stagger: 0.08 }, '-=0.3')
        .to([dot1, dot2],   { opacity: 1, scale: 1, duration: 0.25, ease: 'back.out(3)', stagger: 0.06 }, '-=0.2')
        .to(wiggle,         { opacity: 1, duration: 0.3, ease: 'power2.out' }, '-=0.15')
        /* Hold */
        .to({}, { duration: 1.6 })
        /* Doodles out */
        .to([star1, star2, dot1, dot2, wiggle], { opacity: 0, scale: 0.5, duration: 0.25, ease: 'power2.in', stagger: 0.04 })
        /* Collapse */
        .to(expand, { width: 0, duration: 0.35, ease: 'power3.in' }, '-=0.1')
        .to(logoSpace,  { width: 0, duration: 0.22, ease: 'power2.in' }, '-=0.25')
        .to(logoSpace2, { width: 0, duration: 0.22, ease: 'power2.in' }, '<')
        .to(logoM, { scaleX: 1.2, scaleY: 0.8, duration: 0.1, ease: 'power2.in' }, '-=0.1')
        .to(logoM, { scaleX: 1, scaleY: 1, duration: 0.38, ease: 'elastic.out(1, 0.5)' });
    }

    /* ── Hover → same expand animation ── */
    var _hoverTl = null;
    var _expanding = false;

    logo.addEventListener('mouseenter', function () {
      if (_expanding) return;
      _expanding = true;
      if (_hoverTl) _hoverTl.kill();

      _hoverTl = gsap.timeline({
        onComplete: function () { _expanding = false; }
      });
      _hoverTl
        .to(logoSpace,  { width: spaceW  + 4, duration: 0.22, ease: 'back.out(2)' })
        .to(logoSpace2, { width: spaceW2 + 4, duration: 0.22, ease: 'back.out(2)' }, '<')
        .to(logoM, { scaleX: 0.55, scaleY: 1.35, duration: 0.14, ease: 'power2.in' }, '-=0.05')
        .to(expand, { width: expandedW, duration: 0.48, ease: 'elastic.out(1, 0.65)' }, '-=0.02')
        .to(logoM, { scaleX: 1, scaleY: 1, duration: 0.28, ease: 'back.out(2.5)' }, '-=0.38')
        .to([star1, star2], { opacity: 1, scale: 1, rotation: 360, transformOrigin: 'center', duration: 0.3, ease: 'back.out(3)', stagger: 0.07 }, '-=0.25')
        .to([dot1, dot2],   { opacity: 1, scale: 1, duration: 0.22, ease: 'back.out(3)', stagger: 0.05 }, '-=0.18')
        .to(wiggle,         { opacity: 1, duration: 0.25, ease: 'power2.out' }, '-=0.12');
    });

    logo.addEventListener('mouseleave', function () {
      if (_hoverTl) _hoverTl.kill();
      _expanding = false;

      _hoverTl = gsap.timeline();
      _hoverTl
        .to([star1, star2, dot1, dot2, wiggle], { opacity: 0, scale: 0.5, duration: 0.2, ease: 'power2.in', stagger: 0.03 })
        .to(expand,     { width: 0, duration: 0.3, ease: 'power3.in' }, '-=0.08')
        .to(logoSpace,  { width: 0, duration: 0.2, ease: 'power2.in' }, '-=0.22')
        .to(logoSpace2, { width: 0, duration: 0.2, ease: 'power2.in' }, '<')
        .to(logoM, { scaleX: 1.2, scaleY: 0.8, duration: 0.08, ease: 'power2.in' }, '-=0.08')
        .to(logoM, { scaleX: 1,   scaleY: 1,   duration: 0.32, ease: 'elastic.out(1, 0.5)' });
    });
  }

  /* ════════════════════════════════════════
     HERO ANIMATIONS
  ═══════════════════════════════════════ */
  function animateHero() {
    var tl = gsap.timeline({ defaults: { ease: 'power3.out' } });

    tl.to('.hero-title .word', {
        opacity: 1, y: 0, duration: 0.9,
        stagger: 0.12, ease: 'expo.out'
      }, '-=0.4')
      .to('.hero-sub', { opacity: 1, y: 0, duration: 0.8 }, '-=0.5')
      .to('.hero-ctas', { opacity: 1, y: 0, duration: 0.7 }, '-=0.4')
      ;
  }

  /* ════════════════════════════════════════
     STATS COUNTER
  ═══════════════════════════════════════ */
  function initStats() {
    var stats   = Papers.getStats();
    var numEls  = document.querySelectorAll('.stat-num');
    var targets = [stats.total, stats.courses, stats.years];

    numEls.forEach(function (el, i) {
      if (i < targets.length) {
        el.dataset.target = targets[i];
      }
    });

    ScrollTrigger.create({
      trigger: '#stats',
      start: 'top 80%',
      once: true,
      onEnter: function () {
        numEls.forEach(function (el) {
          if (!el.dataset.target) return; // skip the 100% stat
          var target = parseInt(el.dataset.target, 10) || 0;
          gsap.to({ val: 0 }, {
            val: target,
            duration: 1.8,
            ease: 'power2.out',
            onUpdate: function () {
              el.textContent = Math.round(this.targets()[0].val);
            }
          });
        });
      }
    });
  }

  /* ════════════════════════════════════════
     PAPER CARDS
  ═══════════════════════════════════════ */
  function renderCards(papers) {
    var grid  = document.getElementById('papersGrid');
    var empty = document.getElementById('papersEmpty');
    if (!grid) return;

    grid.innerHTML = '';

    if (!papers.length) {
      if (empty) empty.style.display = 'block';
      return;
    }
    if (empty) empty.style.display = 'none';

    papers.forEach(function (p, i) {
      var isMic    = p.course === 'MIC';
      var hasUrl   = p.url && p.url !== '#';
      var examCls  = 'exam-' + (/^(cat1|cat2|fat)$/i.test(p.exam || '') ? p.exam.toLowerCase() : 'default');
      var batchTag = p.batch ? '<span class="card-tag">' + p.batch + '</span>' : '';
      var slotTag  = p.slot  ? '<span class="card-tag">' + escHtml(p.slot) + '</span>' : '';

      var downloadBtn = hasUrl
        ? '<a href="' + escHtml(p.url) + '" target="_blank" rel="noopener noreferrer" class="btn btn-sm ' + (isMic ? 'btn-primary' : 'btn-accent') + '" onclick="event.stopPropagation()">↓ PDF</a>'
        : '';

      var card = document.createElement('div');
      card.className = 'paper-card ' + (isMic ? 'mic' : 'mid');
      card.dataset.course = p.course;
      card.dataset.year   = fmtYear(p.year);
      card.dataset.exam   = p.exam;
      card.innerHTML = [
        '<div class="card-header">',
          '<span class="card-course">' + escHtml(p.course) + '</span>',
          '<span class="card-year">' + fmtYear(p.year) + '</span>',
        '</div>',
        '<div class="card-subject">' + escHtml(p.subject) + '</div>',
        '<div class="card-code">' + escHtml(p.code) + '</div>',
        '<div class="card-tags">',
          '<span class="card-tag ' + examCls + '">' + escHtml(p.exam) + '</span>',
          '<span class="card-tag">' + escHtml(p.semester || '') + '</span>',
          slotTag,
          batchTag,
        '</div>',
        '<div class="card-footer">',
          '<span class="card-semester">' + escHtml(p.semester || '') + '</span>',
          downloadBtn,
        '</div>'
      ].join('');

      /* Admin overlay — edit + delete buttons on each card */
      if (document.body.classList.contains('admin-mode')) {
        var isSeedCard = window.Papers && window.Papers.isSeedPaper(p.id);
        var overlay = document.createElement('div');
        overlay.className = 'card-admin-bar';
        overlay.innerHTML =
          '<button class="card-admin-btn card-edit-btn" data-id="' + p.id + '" title="Edit paper">' +
            '<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 20h9"/><path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"/></svg>' +
          '</button>' +
          (!isSeedCard
            ? '<button class="card-admin-btn card-del-btn" data-id="' + p.id + '" title="Delete paper">' +
                '<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/></svg>' +
              '</button>'
            : ''
          );
        card.appendChild(overlay);
        card.classList.add('has-admin');
      }

      /* Navigate to detail page on click (skip admin buttons) */
      card.addEventListener('click', function (e) {
        if (e.target.closest('.card-admin-btn')) return;
        window.location.href = '/paper?id=' + p.id;
      });
      card.style.cursor = 'pointer';

      /* Card hover tilt */
      card.addEventListener('mousemove', function (e) {
        var rect = card.getBoundingClientRect();
        var rx = ((e.clientY - rect.top)  / rect.height - 0.5) * 8;
        var ry = ((e.clientX - rect.left) / rect.width  - 0.5) * -8;
        gsap.to(card, { rotateX: rx, rotateY: ry, duration: 0.3, ease: 'power2.out', transformPerspective: 800 });
      });
      card.addEventListener('mouseleave', function () {
        gsap.to(card, { rotateX: 0, rotateY: 0, duration: 0.5, ease: 'elastic.out(1,.7)' });
      });

      grid.appendChild(card);
    });

    /* Scroll-in animation */
    ScrollTrigger.batch('.paper-card', {
      start: 'top 90%',
      onEnter: function (els) {
        gsap.to(els, {
          opacity: 1, y: 0, duration: 0.6,
          stagger: 0.07, ease: 'power3.out'
        });
      },
      once: true
    });
  }

  /* ════════════════════════════════════════
     FILTERS
  ═══════════════════════════════════════ */
  function initFilters() {
    /* Course buttons */
    document.querySelectorAll('.filter-btn').forEach(function (btn) {
      btn.addEventListener('click', function () {
        var group = btn.dataset.filter;
        document.querySelectorAll('.filter-btn[data-filter="' + group + '"]')
          .forEach(function (b) { b.classList.remove('active'); });
        btn.classList.add('active');
        activeFilters[group] = btn.dataset.value;
        applyFilters();
      });
    });

    /* Year + Exam selects */
    var yearSel = document.getElementById('yearFilter');
    if (yearSel) yearSel.addEventListener('change', function () {
      activeFilters.year = this.value;
      applyFilters();
    });

    /* Search input */
    var searchInput = document.getElementById('searchInput');
    if (searchInput) searchInput.addEventListener('input', function () {
      activeFilters.search = this.value.toLowerCase().trim();
      applyFilters();
    });
  }

  function applyFilters() {
    var all = Papers.getPapers();
    var filtered = all.filter(function (p) {
      var ok = true;
      if (activeFilters.course !== 'all') ok = ok && p.course === activeFilters.course;
      if (activeFilters.year   !== 'all') ok = ok && fmtYear(p.year) === activeFilters.year;
      if (activeFilters.exam   !== 'all') ok = ok && p.exam === activeFilters.exam;
      if (activeFilters.search) ok = ok && (
        p.subject.toLowerCase().includes(activeFilters.search) ||
        p.code.toLowerCase().includes(activeFilters.search)
      );
      return ok;
    });

    /* Update results count */
    var meta = document.getElementById('resultsMeta');
    if (meta) {
      var count = document.getElementById('resultsCount');
      if (count) count.textContent = filtered.length + ' paper' + (filtered.length === 1 ? '' : 's') + ' found';
    }

    /* Animate out then re-render */
    var cards = document.querySelectorAll('.paper-card');
    if (cards.length) {
      gsap.to(cards, {
        opacity: 0, y: -10, scale: 0.97, duration: 0.2, stagger: 0.02,
        onComplete: function () { renderCards(filtered); }
      });
    } else {
      renderCards(filtered);
    }
  }

  /* ════════════════════════════════════════
     SECTION SCROLL ANIMATIONS
  ═══════════════════════════════════════ */
  function initScrollAnimations() {
    /* Section headers */
    gsap.utils.toArray('.section-header').forEach(function (el) {
      gsap.from(el, {
        scrollTrigger: { trigger: el, start: 'top 85%', once: true },
        opacity: 0, y: 40, duration: 0.8, ease: 'power3.out'
      });
    });

    /* CTA */
    gsap.from('.cta-inner', {
      scrollTrigger: { trigger: '.cta-strip', start: 'top 75%', once: true },
      opacity: 0, y: 50, duration: 0.9, ease: 'power3.out'
    });
  }

  /* ── Utility ──────────────────────────── */
  /* Delegate to the shared utils module when loaded; keep a local fallback
     so the file remains self-contained if script order changes. */
  var escHtml = (window.Utils && window.Utils.escHtml) || function (str) {
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  };

  /* ════════════════════════════════════════
     BOOT
  ═══════════════════════════════════════ */
  function boot() {
    gsap.registerPlugin(ScrollTrigger);

    runPreloader().then(function () {
      ThreeScene.init('hero-canvas');
      initNavbar();
      animateHero();
      initStats();
      renderCards(Papers.getPapers());
      initFilters();
      initScrollAnimations();

      /* Fetch latest approved papers from Supabase and re-render */
      if (window.DB && window.DB.loadApprovedPapers) {
        window.DB.loadApprovedPapers().then(function (fresh) {
          if (fresh && fresh.length) {
            Papers.saveApprovedCache(fresh);
            renderCards(Papers.getPapers());
            applyFilters();
          }
        }).catch(function () {});
      }
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot);
  } else {
    boot();
  }

  /* ─── Public API ─────────────────────────── */
  window.renderPapers = function () { applyFilters(); };
})();
