/* ─────────────────────────────────────────────
   paper-detail.js — Paper detail page logic
   Reads ?id= from URL, renders title/chips/viewer/related
─────────────────────────────────────────────── */
(function () {
  'use strict';

  /* ── Helpers ── */
  function escH(s) {
    return String(s || '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
  }

  function getParam(name) {
    return new URLSearchParams(window.location.search).get(name);
  }

  /* Convert any Drive share URL → embed URL */
  function driveEmbedUrl(url) {
    if (!url || url === '#') return null;
    var m = url.match(/\/file\/d\/([^/?#]+)/);
    if (m) return 'https://drive.google.com/file/d/' + m[1] + '/preview';
    m = url.match(/[?&]id=([^&]+)/);
    if (m) return 'https://drive.google.com/file/d/' + m[1] + '/preview';
    /* Direct PDF — embed as-is */
    if (/\.pdf($|\?)/.test(url)) return url;
    return url;
  }

  /* ── Load paper ── */
  var id = parseInt(getParam('id'), 10);
  if (!id) {
    document.getElementById('paperTitle').textContent = 'Paper not found.';
    return;
  }

  var papers = window.Papers ? window.Papers.getPapers() : [];
  var paper  = papers.find(function (p) { return p.id === id; });

  if (!paper) {
    document.getElementById('paperTitle').textContent = 'Paper not found.';
    return;
  }

  /* ── Page title ── */
  var fullTitle = [paper.subject, paper.code && '['+ paper.code +']', paper.exam,
    paper.semester].filter(Boolean).join(' ');
  document.title = fullTitle + ' — VIT QP';

  /* ── Breadcrumb ── */
  var bc = document.getElementById('breadcrumbCourse');
  if (bc) bc.textContent = paper.code || paper.subject;

  /* ── Hero title ── */
  var titleEl = document.getElementById('paperTitle');
  if (titleEl) {
    titleEl.innerHTML =
      escH(paper.subject) +
      (paper.code ? ' <span class="code-accent">[' + escH(paper.code) + ']</span>' : '') +
      ' ' + escH(paper.exam) +
      (paper.semester ? ' ' + escH(paper.semester) : '');
  }

  /* ── Chips ── */
  var chipsEl = document.getElementById('paperChips');
  if (chipsEl) {
    var examClass = {
      'CAT1': 'pchip-exam-cat1',
      'CAT2': 'pchip-exam-cat2',
      'FAT' : 'pchip-exam-fat'
    }[paper.exam] || 'pchip-default';

    var chips = [
      paper.exam     ? '<span class="pchip ' + examClass + '">' + escH(paper.exam) + '</span>' : '',
      paper.course   ? '<span class="pchip pchip-course">' + escH(paper.course) + '</span>' : '',
      paper.year     ? '<span class="pchip pchip-default">' + paper.year + '</span>' : '',
      paper.semester ? '<span class="pchip pchip-default">' + escH(paper.semester) + '</span>' : '',
      paper.slot     ? '<span class="pchip pchip-default">Slot ' + escH(paper.slot) + '</span>' : '',
    ];
    chipsEl.innerHTML = chips.join('');
  }

  /* ── Action bar ── */
  var actionsEl = document.getElementById('paperActions');
  if (actionsEl) {
    var embedUrl = driveEmbedUrl(paper.url);
    if (embedUrl && paper.url !== '#') {
      actionsEl.innerHTML =
        '<a href="' + escH(paper.url) + '" target="_blank" rel="noopener" class="btn btn-primary">↓ Open / Download</a>' +
        '<a href="/#papers" class="btn btn-ghost">← All Papers</a>';
    } else {
      actionsEl.innerHTML = '<a href="/#papers" class="btn btn-ghost">← All Papers</a>';
    }
  }

  /* ── PDF Viewer ── */
  var viewerWrap = document.getElementById('paperViewerWrap');
  if (viewerWrap) {
    var embedUrl = driveEmbedUrl(paper.url);
    if (embedUrl && paper.url !== '#') {
      viewerWrap.innerHTML =
        '<iframe src="' + escH(embedUrl) + '" allowfullscreen loading="lazy" title="' + escH(paper.subject) + '"></iframe>';
    } else if (paper.images && paper.images.length) {
      /* Store images on window so the download button can access them */
      var zipName = [(paper.code || paper.subject), paper.exam, paper.year].filter(Boolean).join('_').replace(/\s+/g,'_');
      window._pdImages = paper.images.slice();
      window._pdZipName = zipName;

      /* Show submitted photo thumbnails with lightbox + download */
      var imgHtml = paper.images.map(function (src, i) {
        return '<div style="text-align:center">' +
          '<img src="' + escH(src) + '" ' +
          'style="max-width:100%;border-radius:8px;border:1px solid rgba(255,255,255,.1);cursor:zoom-in;display:block;margin:0 auto" ' +
          'onclick="(function(s){var lb=document.getElementById(\'pdLightbox\');var li=document.getElementById(\'pdLightboxImg\');if(lb&&li){li.src=s;lb.style.display=\'flex\';}})(this.src)" ' +
          'alt="Page ' + (i + 1) + '" />' +
          '<div style="display:flex;align-items:center;justify-content:center;gap:.5rem;margin-top:.5rem">' +
            '<span style="font-size:.7rem;color:var(--text-muted)">Page ' + (i + 1) + '</span>' +
            '<a href="' + escH(src) + '" download="page-' + (i + 1) + '.jpg" ' +
            'style="font-size:.7rem;color:var(--accent);text-decoration:none;padding:.2rem .5rem;border:1px solid rgba(124,58,237,.3);border-radius:4px" ' +
            'onclick="event.stopPropagation()">↓ Save</a>' +
          '</div>' +
        '</div>';
      }).join('');

      viewerWrap.innerHTML =
        '<div style="padding:1.5rem 2rem;display:flex;flex-direction:column;gap:1.5rem">' +
          '<div style="display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:.75rem">' +
            '<span style="font-size:.8rem;color:var(--text-muted)">Student-submitted photos · Click to zoom</span>' +
            '<button id="pdDownloadAll" onclick="window.downloadAllPhotos()" ' +
            'style="display:flex;align-items:center;gap:.4rem;padding:.45rem 1rem;background:rgba(124,58,237,.15);border:1px solid rgba(124,58,237,.4);border-radius:8px;color:#c4b5fd;font-size:.8rem;font-family:inherit;cursor:pointer;transition:all .2s" ' +
            'onmouseover="this.style.background=\'rgba(124,58,237,.28)\'" onmouseout="this.style.background=\'rgba(124,58,237,.15)\'">' +
              '↓ Download All Photos' +
            '</button>' +
          '</div>' +
          imgHtml +
        '</div>' +
        /* Lightbox overlay */
        '<div id="pdLightbox" style="display:none;position:fixed;inset:0;z-index:9999;background:rgba(0,0,0,.92);align-items:center;justify-content:center;cursor:zoom-out" onclick="this.style.display=\'none\'">' +
          '<img id="pdLightboxImg" style="max-width:94vw;max-height:92vh;border-radius:8px;object-fit:contain" />' +
          '<button onclick="document.getElementById(\'pdLightbox\').style.display=\'none\'" ' +
          'style="position:absolute;top:1rem;right:1.2rem;background:none;border:none;color:#fff;font-size:2rem;cursor:pointer;line-height:1">×</button>' +
        '</div>';
    } else {
      viewerWrap.innerHTML =
        '<div class="paper-viewer-unavailable">' +
          '<div class="unavail-icon">⏳</div>' +
          '<h3>Paper not yet available</h3>' +
          '<p>This paper hasn\'t been uploaded yet. You can contribute by submitting it below.</p>' +
          '<a href="/submit" class="btn btn-primary" style="margin-top:.5rem">Submit Paper</a>' +
        '</div>';
    }
  }

  /* ── Related papers (same course, exclude current) ── */
  var related = papers.filter(function (p) {
    return p.code === paper.code && p.id !== paper.id;
  }).slice(0, 8);

  if (related.length) {
    var relatedSection = document.getElementById('relatedSection');
    var relatedGrid    = document.getElementById('relatedGrid');
    if (relatedSection) relatedSection.style.display = '';
    if (relatedGrid) {
      relatedGrid.innerHTML = related.map(function (p) {
        var hasUrl = p.url && p.url !== '#';
        return '<a href="/paper?id=' + p.id + '" class="related-card' + (hasUrl ? '' : ' no-url') + '">' +
          '<div class="related-card-exam">' + escH(p.exam) + '</div>' +
          '<div class="related-card-name">' + escH(p.subject) + '</div>' +
          '<div class="related-card-meta">' +
            [p.year, p.semester].filter(Boolean).join(' · ') +
          '</div>' +
        '</a>';
      }).join('');
    }
  }

  /* ── Download All Photos as PDF ── */
  window.downloadAllPhotos = async function () {
    var srcs    = window._pdImages || [];
    var pdfName = (window._pdZipName || 'photos') + '.pdf';
    var btn     = document.getElementById('pdDownloadAll');
    if (!srcs.length) return;

    if (btn) { btn.textContent = 'Preparing…'; btn.disabled = true; }

    try {
      var jsPDF = (window.jspdf && window.jspdf.jsPDF) || window.jsPDF;
      if (!jsPDF) throw new Error('PDF library not loaded');

      var doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
      var pageW = doc.internal.pageSize.getWidth();
      var pageH = doc.internal.pageSize.getHeight();
      var added = 0;

      for (var i = 0; i < srcs.length; i++) {
        if (btn) btn.textContent = 'Adding page ' + (i + 1) + '/' + srcs.length + '…';
        try {
          /* Load image into a canvas to get dataURL */
          var dataUrl = await new Promise(function (resolve, reject) {
            var img = new Image();
            img.crossOrigin = 'anonymous';
            img.onload = function () {
              var c = document.createElement('canvas');
              c.width = img.naturalWidth; c.height = img.naturalHeight;
              c.getContext('2d').drawImage(img, 0, 0);
              resolve(c.toDataURL('image/jpeg', 0.92));
            };
            img.onerror = reject;
            img.src = srcs[i];
          });

          if (added > 0) doc.addPage();

          /* Fit image to page preserving aspect ratio */
          var imgProps = doc.getImageProperties(dataUrl);
          var ratio    = Math.min(pageW / imgProps.width, pageH / imgProps.height);
          var w = imgProps.width * ratio;
          var h = imgProps.height * ratio;
          var x = (pageW - w) / 2;
          var y = (pageH - h) / 2;
          doc.addImage(dataUrl, 'JPEG', x, y, w, h);
          added++;
        } catch (e) { /* skip image that fails to load */ }
      }

      if (!added) throw new Error('No images could be loaded');
      doc.save(pdfName);

    } catch (e) {
      alert('PDF generation failed: ' + e.message);
    } finally {
      if (btn) { btn.textContent = '↓ Download All Photos'; btn.disabled = false; }
    }
  };

  /* ── Navbar scroll ── */
  var navbar = document.getElementById('navbar');
  if (navbar) {
    window.addEventListener('scroll', function () {
      navbar.classList.toggle('scrolled', window.scrollY > 20);
    });
  }

})();
