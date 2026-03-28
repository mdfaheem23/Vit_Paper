/* ─────────────────────────────────────────────
   ocr-scan.js — Client-side OCR for paper validation
   Uses Tesseract.js to detect course code, slot, course name
───────────────────────────────────────────── */
(function () {
  'use strict';

  var TESSERACT_URL = 'https://cdn.jsdelivr.net/npm/tesseract.js@4/dist/tesseract.min.js';
  var _loadPromise  = null;

  /* Load Tesseract.js once from CDN */
  function loadTesseract() {
    if (_loadPromise) return _loadPromise;
    _loadPromise = new Promise(function (resolve, reject) {
      if (window.Tesseract) { resolve(window.Tesseract); return; }
      var s = document.createElement('script');
      s.src = TESSERACT_URL;
      s.onload  = function () { resolve(window.Tesseract); };
      s.onerror = function () { _loadPromise = null; reject(new Error('Tesseract CDN failed')); };
      document.head.appendChild(s);
    });
    return _loadPromise;
  }

  /* Resize image to max 1200px for faster OCR */
  function resizeImage(file) {
    return new Promise(function (resolve) {
      var url = URL.createObjectURL(file);
      var img = new Image();
      img.onload = function () {
        var MAX = 1200;
        var w = img.naturalWidth, h = img.naturalHeight;
        if (w > MAX) { h = Math.round(h * MAX / w); w = MAX; }
        var c = document.createElement('canvas');
        c.width = w; c.height = h;
        c.getContext('2d').drawImage(img, 0, 0, w, h);
        URL.revokeObjectURL(url);
        c.toBlob(function (blob) { resolve(blob || file); }, 'image/jpeg', 0.92);
      };
      img.onerror = function () { URL.revokeObjectURL(url); resolve(file); };
      img.src = url;
    });
  }

  /* High-quality image for localStorage viewer (max 1200px) */
  function makeThumbnail(file) {
    return new Promise(function (resolve) {
      var url = URL.createObjectURL(file);
      var img = new Image();
      img.onload = function () {
        var MAX = 1200;
        var w = img.naturalWidth, h = img.naturalHeight;
        if (w > MAX) { h = Math.round(h * MAX / w); w = MAX; }
        var c = document.createElement('canvas');
        c.width = w; c.height = h;
        c.getContext('2d').drawImage(img, 0, 0, w, h);
        URL.revokeObjectURL(url);
        resolve(c.toDataURL('image/jpeg', 0.88));
      };
      img.onerror = function () { URL.revokeObjectURL(url); resolve(null); };
      img.src = url;
    });
  }

  /* Extract structured fields from OCR text */
  function extractInfo(text) {
    var upper = text.toUpperCase();

    var courseCode = null;
    var courseName = null;

    /* ── Strategy 1: same-line "CODE - Name" pattern (most reliable)
       Handles: hyphen, en-dash, em-dash; with/without "Course:" prefix;
       OCR artifacts like "Gourse" or missing colon ── */
    var lines = text.split(/[\r\n]+/);
    for (var ci = 0; ci < lines.length; ci++) {
      var cl = lines[ci];
      /* Look for a course-code-like token followed by any dash then a name */
      var lm = cl.match(/\b([A-Za-z]{2,4})\s*(\d{4})\s*[-–—]\s*([A-Za-z][^\n\r]{2,65})/);
      if (lm) {
        /* Prefer lines that also contain a "course" label */
        var hasCourseLabel = /[Cc]ourse/i.test(cl);
        if (hasCourseLabel || !courseCode) {
          courseCode = (lm[1] + lm[2]).toUpperCase();
          var rawName = lm[3].trim().replace(/\s*[-–—|]\s*$/, '').replace(/\s{2,}/g, ' ');
          if (rawName.length >= 3) courseName = rawName.substring(0, 60);
          if (hasCourseLabel) break; /* Course-labelled line wins immediately */
        }
      }
    }

    /* ── Strategy 2: "Course: CSI2003" without a name on the same line
       Then look for name on the very next non-empty line ── */
    if (!courseCode) {
      for (var ci2 = 0; ci2 < lines.length; ci2++) {
        var cl2 = lines[ci2];
        var lm2 = cl2.match(/[Cc][a-z]*\s*[:\-]?\s*([A-Za-z]{2,4})\s*(\d{4})\b/);
        if (lm2 && /[Cc]ourse/i.test(cl2)) {
          courseCode = (lm2[1] + lm2[2]).toUpperCase();
          /* Check next non-empty line for the subject name */
          for (var nj = ci2 + 1; nj < Math.min(ci2 + 4, lines.length); nj++) {
            var nl = lines[nj].trim();
            if (nl.length >= 4 && !/^\d+$/.test(nl) && !/^(Slot|Date|Time|Reg|Hall|Max)/i.test(nl)) {
              courseName = nl.replace(/\s{2,}/g, ' ').substring(0, 60);
              break;
            }
          }
          break;
        }
      }
    }

    /* ── Strategy 3: bare course code anywhere ── */
    if (!courseCode) {
      var codeMatch = upper.match(/\b([A-Z]{2,4})\s*(\d{4})\b/);
      courseCode = codeMatch ? (codeMatch[1] + codeMatch[2]) : null;
    }

    /* ── Slot: "Slot: F2" or "Slot : A1+TA1" ── */
    var slotMatch =
      upper.match(/\bSLOT\s*[:\-]?\s*([A-Z][A-Z0-9]*(?:[+][A-Z]{0,2}[0-9]{0,2})*)/) ||
      upper.match(/\b([A-GL]\d{1,2}(?:\+T[A-Z]{0,2}\d{1,2})*)\b/) ||
      upper.match(/\b(L\d{1,2}(?:\+L\d{1,2})+)\b/);

    /* ── Course name fallbacks if not found via VIT format ── */
    if (!courseName) {
      var nameMatch =
        text.match(/[Cc]ourse\s*[Nn]ame\s*[:\-]?\s*([^\n]{5,70})/) ||
        text.match(/[Ss]ubject\s*[Tt]itle\s*[:\-]?\s*([^\n]{5,70})/) ||
        text.match(/[Ss]ubject\s*[:\-]?\s*([^\n]{5,70})/) ||
        text.match(/[Tt]itle\s*[:\-]?\s*([^\n]{5,70})/);
      if (nameMatch) {
        courseName = nameMatch[1].trim().substring(0, 60);
      } else {
        /* All-caps line fallback */
        var lines = text.split('\n');
        for (var li = 0; li < lines.length; li++) {
          var l = lines[li].trim();
          if (l.length >= 10 && l.length <= 70 && /^[A-Z\s&,\-]+$/.test(l) && !/^\d+$/.test(l)) {
            courseName = l;
            break;
          }
        }
      }
    }

    /* ── Exam type ── */
    var examType = null;
    if (/\bFINAL\s+ASSESSMENT\s+TEST\b|\bFAT\b/.test(upper)) {
      examType = 'FAT';
    } else if (/\bCLASS\s+ASSESSMENT\s+TEST[\s\S]{0,15}1\b|\bCAT[\s\-]?1\b/.test(upper)) {
      examType = 'CAT1';
    } else if (/\bCLASS\s+ASSESSMENT\s+TEST[\s\S]{0,15}2\b|\bCAT[\s\-]?2\b/.test(upper)) {
      examType = 'CAT2';
    }

    /* ── Year ── */
    var yearMatch = upper.match(/\b(20[12]\d)\b/);
    var year = yearMatch ? parseInt(yearMatch[1], 10) : null;

    /* ── Semester from label or month name ── */
    var semester = null;
    if (/\bWINTER\b|\bWINSEM\b/.test(upper)) {
      semester = 'WS';
    } else if (/\bFALL\b|\bFALLSEM\b|\bSUMMER\b|\bSUMSEM\b/.test(upper)) {
      semester = 'FS';
    } else if (/\bJANUARY\b|\bFEBRUARY\b|\bMARCH\b|\bAPRIL\b|\bMAY\b|\bJAN\b|\bFEB\b|\bMAR\b|\bAPR\b/.test(upper)) {
      semester = 'WS';
    } else if (/\bJULY\b|\bAUGUST\b|\bSEPTEMBER\b|\bOCTOBER\b|\bNOVEMBER\b|\bJUL\b|\bAUG\b|\bSEP\b|\bOCT\b|\bNOV\b/.test(upper)) {
      semester = 'FS';
    } else if (/\bDECEMBER\b|\bJUNE\b|\bDEC\b|\bJUN\b/.test(upper)) {
      /* Dec = end of FALLSEM FAT; Jun = end of WINSEM FAT — context-dependent, default to season */
      semester = /\bDECEMBER\b|\bDEC\b/.test(upper) ? 'FS' : 'WS';
    }

    return {
      courseCode : courseCode,
      slot       : slotMatch ? slotMatch[1] : null,
      courseName : courseName,
      examType   : examType,
      year       : year,
      semester   : semester
    };
  }

  /* Valid if any meaningful field was detected — single field is enough */
  function isValid(info) {
    return !!(info.courseCode || info.courseName || info.examType || info.slot);
  }

  /* Scan an array of Files, sharing one Tesseract worker
     onFileProgress(index, total, result) called after each file */
  async function scanImages(files, onFileProgress) {
    var Tesseract = await loadTesseract();
    var worker = await Tesseract.createWorker('eng');
    var results = [];

    for (var i = 0; i < files.length; i++) {
      var file = files[i];
      try {
        var resized = await resizeImage(file);
        var objUrl  = URL.createObjectURL(resized);
        var ret     = await worker.recognize(objUrl);
        URL.revokeObjectURL(objUrl);
        var text    = ret.data.text;
        var info    = extractInfo(text);
        var result  = { file: file, success: true, text: text, info: info, valid: isValid(info) };
      } catch (err) {
        var result = { file: file, success: false, text: '', info: {}, valid: false, error: err.message };
      }
      results.push(result);
      if (onFileProgress) onFileProgress(i + 1, files.length, result);
    }

    await worker.terminate();
    return results;
  }

  window.OcrScan = {
    loadTesseract : loadTesseract,
    extractInfo   : extractInfo,
    isValid       : isValid,
    makeThumbnail : makeThumbnail,
    scanImages    : scanImages
  };
})();
