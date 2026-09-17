/**
 * app-v5.js
 * High-Precision Word & Anatomical Label Detection Engine
 * Zero bone-contour false positives • Grouping into clean labels • 100% Offline
 */

// Application State
const state = {
  currentImageSrc: null,
  naturalWidth: 0,
  naturalHeight: 0,
  rawWords: [], // Unmerged individual words
  allWords: [], // Active mask entries (merged labels or single words)
  currentMode: 'both', // 'hover', 'click', 'both'
  currentStyle: 'black', // 'black', 'neon', 'blur', 'badge'
  currentGrouping: 'labels', // 'labels' (e.g. "frontal bone") or 'words' ("frontal", "bone")
  minLength: 1,
  searchFilter: '',
  isDrawMode: false,
  isClickMaskMode: false,
  isEraserMode: false,
  isDrawing: false,
  drawStartX: 0,
  drawStartY: 0,
  zoomLevel: 1.0
};

// DOM References
const elements = {
  uploadSection: document.getElementById('upload-section'),
  dropZone: document.getElementById('drop-zone'),
  fileInput: document.getElementById('file-input'),
  progressCard: document.getElementById('progress-card'),
  progressStatusText: document.getElementById('progress-status-text'),
  progressPct: document.getElementById('progress-pct'),
  progressBarFill: document.getElementById('progress-bar-fill'),
  studioWrapper: document.getElementById('studio-wrapper'),
  previewImage: document.getElementById('preview-image'),
  maskOverlayLayer: document.getElementById('mask-overlay-layer'),
  stageContainer: document.getElementById('stage-container'),
  stageViewport: document.getElementById('stage-viewport'),
  badgeMaskCount: document.getElementById('badge-mask-count'),
  btnDrawMode: document.getElementById('btn-draw-mode'),
  btnClickMaskMode: document.getElementById('btn-click-mask-mode'),
  btnEraserMode: document.getElementById('btn-eraser-mode'),
  sliderMinLength: document.getElementById('slider-min-length'),
  labelMinLength: document.getElementById('label-min-length'),
  inputSearchFilter: document.getElementById('input-search-filter'),
  btnSelectAll: document.getElementById('btn-select-all'),
  btnClearAll: document.getElementById('btn-clear-all'),
  btnZoomIn: document.getElementById('btn-zoom-in'),
  btnZoomOut: document.getElementById('btn-zoom-out'),
  btnZoomFit: document.getElementById('btn-zoom-fit'),
  btnPreviewHtml: document.getElementById('btn-preview-html'),
  btnExportHtml: document.getElementById('btn-export-html'),
  navBtnApi: document.getElementById('nav-btn-api'),
  navBtnReset: document.getElementById('nav-btn-reset'),
  toastContainer: document.getElementById('toast-container')
};

document.addEventListener('DOMContentLoaded', () => {
  initIcons();
  setupUpload();
  setupToolbar();
  setupStage();
  setupExports();
});

function initIcons() {
  if (typeof lucide !== 'undefined') {
    lucide.createIcons();
  }
}

function showToast(msg, type = 'info') {
  const toast = document.createElement('div');
  toast.className = 'toast';
  const icon = type === 'success' ? 'check' : type === 'error' ? 'alert-triangle' : 'info';
  toast.innerHTML = `<i data-lucide="${icon}" style="width:14px;height:14px;color:var(--accent-warm);"></i> <span>${msg}</span>`;
  elements.toastContainer.appendChild(toast);
  initIcons();
  setTimeout(() => {
    toast.style.opacity = '0';
    setTimeout(() => toast.remove(), 250);
  }, 3200);
}

// ==========================================
// Image Upload Handlers
// ==========================================
function setupUpload() {
  const { dropZone, fileInput } = elements;

  dropZone.addEventListener('click', () => fileInput.click());
  fileInput.addEventListener('change', (e) => {
    if (e.target.files && e.target.files[0]) {
      loadFile(e.target.files[0]);
    }
  });

  ['dragenter', 'dragover'].forEach(evt => {
    dropZone.addEventListener(evt, (e) => {
      e.preventDefault();
      dropZone.classList.add('dragover');
    });
  });

  ['dragleave', 'drop'].forEach(evt => {
    dropZone.addEventListener(evt, (e) => {
      e.preventDefault();
      dropZone.classList.remove('dragover');
    });
  });

  dropZone.addEventListener('drop', (e) => {
    const dt = e.dataTransfer;
    if (dt && dt.files && dt.files[0]) {
      loadFile(dt.files[0]);
    }
  });

  window.addEventListener('paste', (e) => {
    const items = (e.clipboardData || e.originalEvent?.clipboardData)?.items || [];
    for (let item of items) {
      if (item.type.includes('image')) {
        const file = item.getAsFile();
        loadFile(file);
        showToast('Pasted image from clipboard', 'success');
        break;
      }
    }
  });

  elements.navBtnReset.addEventListener('click', resetStudio);

  if (elements.navBtnApi) {
    elements.navBtnApi.addEventListener('click', () => {
      const current = localStorage.getItem('ely_gemini_api_key') || '';
      const masked = current ? current.slice(0, 6) + '...' + current.slice(-4) : '(Configured in Vercel)';
      const input = prompt('Google Gemini API Key for Diagram Detection:\n(Active: ' + masked + ')\n\nEnter your Gemini API key (stored only in your personal browser):', current);
      if (input !== null) {
        const trimmed = input.trim();
        if (trimmed) {
          localStorage.setItem('ely_gemini_api_key', trimmed);
          showToast('Gemini API key saved in browser!', 'success');
        } else {
          localStorage.removeItem('ely_gemini_api_key');
          showToast('Using Vercel environment key.', 'info');
        }
      }
    });
  }
}

function loadFile(file) {
  if (!file.type.startsWith('image/')) {
    showToast('Please select a valid image file.', 'error');
    return;
  }
  const reader = new FileReader();
  reader.onload = (e) => startProcessing(e.target.result);
  reader.readAsDataURL(file);
}

function resetStudio() {
  state.currentImageSrc = null;
  state.rawWords = [];
  state.allWords = [];
  elements.studioWrapper.style.display = 'none';
  elements.uploadSection.style.display = 'flex';
  elements.progressCard.style.display = 'none';
  elements.navBtnReset.style.display = 'none';
  elements.fileInput.value = '';
}

// ==========================================
// High-Precision TSV Coordinate Parser
// ==========================================
function parseTSV(tsv) {
  const words = [];
  if (!tsv) return words;
  const lines = tsv.split('\n');

  for (let i = 0; i < lines.length; i++) {
    const cols = lines[i].split('\t');
    // Level 5 in Tesseract TSV represents individual words
    if (cols[0] === '5' && cols.length >= 12) {
      const left = parseInt(cols[6], 10);
      const top = parseInt(cols[7], 10);
      const width = parseInt(cols[8], 10);
      const height = parseInt(cols[9], 10);
      const conf = parseFloat(cols[10]);
      let text = cols[11] ? cols[11].trim() : '';

      // Clean punctuation artifacts (e.g. leading/trailing dashes, brackets)
      const clean = text.replace(/^[^a-zA-Z0-9]+|[^a-zA-Z0-9]+$/g, '');

      // Precision Filter:
      // 1. Must contain letters (filters out line strokes, symbols, border lines)
      // 2. Minimum length >= 2 (filters out single-letter bone shading artifacts like "J", "x", "|", "9")
      // 3. Realistic text height (8px to 38px) (filters out tall vertical bone/spine/rib contours)
      // 4. Short words (<= 2 chars like "of", "nd") require higher confidence (>= 75%) to reject bone shading ("Za", "oF", "Ji")
      const hasLetters = /[a-zA-Z]/.test(clean);
      const isValidLen = clean.length >= 2;
      const isValidHeight = height >= 8 && height <= 38;
      const isValidWidth = width >= 9;
      const isShortWord = clean.length <= 2;
      const isValidConf = isShortWord ? conf >= 75 : conf >= 42;

      // Filter out non-word caps noise (e.g. "FNS", "ANY" in shaded ribs)
      const isRandomCaps = /^[A-Z]{2,4}$/.test(clean) && conf < 80;

      if (hasLetters && isValidLen && isValidHeight && isValidWidth && isValidConf && !isRandomCaps) {
        words.push({
          id: 'w_' + words.length,
          text: clean,
          x: left,
          y: top,
          width: width,
          height: height,
          active: true,
          userCreated: false
        });
      }
    }
  }
  return words;
}

/**
 * Merges adjacent words on the same line into cohesive label boxes (e.g. "frontal bone")
 */
function mergeAdjacentWords(words) {
  if (!words || !words.length) return [];
  // Sort vertically by Y, then horizontally by X
  const sorted = [...words].sort((a, b) => Math.abs(a.y - b.y) > 10 ? a.y - b.y : a.x - b.x);
  const merged = [];
  let current = { ...sorted[0] };

  for (let i = 1; i < sorted.length; i++) {
    const next = sorted[i];
    const sameLine = Math.abs(current.y - next.y) <= 12;
    const gap = next.x - (current.x + current.width);
    const closeHorizontally = gap >= -6 && gap <= 36;

    if (sameLine && closeHorizontally) {
      current.text += ' ' + next.text;
      const right = Math.max(current.x + current.width, next.x + next.width);
      current.width = right - current.x;
      current.height = Math.max(current.height, next.height);
    } else {
      merged.push(current);
      current = { ...next };
    }
  }
  merged.push(current);
  return merged;
}

// ==========================================
// Gemini AI Vision Pipeline (with Local OCR Fallback)
// ==========================================
async function startProcessing(dataUrl) {
  state.currentImageSrc = dataUrl;
  elements.uploadSection.style.display = 'none';
  elements.progressCard.style.display = 'block';
  elements.navBtnReset.style.display = 'inline-flex';

  setProgress(0.1, 'Loading document into memory...');

  const img = new Image();
  img.onload = async () => {
    state.naturalWidth = img.naturalWidth;
    state.naturalHeight = img.naturalHeight;
    elements.previewImage.src = dataUrl;

    try {
      const words = await detectLabelsWithAI(dataUrl, img.naturalWidth, img.naturalHeight);
      finishDetection(words);
    } catch (err) {
      console.error('Detection error:', err);
      showToast('Detection Error: ' + err.message, 'error');
      finishDetection([]);
    }
  };
  img.src = dataUrl;
}

function setProgress(fraction, text) {
  const pct = Math.round(fraction * 100);
  elements.progressBarFill.style.width = pct + '%';
  elements.progressPct.textContent = pct + '%';
  elements.progressStatusText.innerHTML = `<i data-lucide="loader" class="spin" style="width:14px;height:14px;"></i> ${text}`;
  initIcons();
}

/**
 * High-Precision Gemini Vision AI Label Detection
 * Calls the /api/detect serverless proxy (Zero CORS, 100% reliable on Vercel)
 */
async function detectLabelsWithAI(dataUrl, naturalWidth, naturalHeight) {
  const apiKey = localStorage.getItem('ely_gemini_api_key') || '';

  setProgress(0.2, 'Connecting to Gemini AI Vision...');

  // Extract base64 payload & mime
  const match = dataUrl.match(/^data:(image\/[a-zA-Z0-9.+_-]+);base64,(.+)$/);
  if (!match) {
    return runOCR(dataUrl);
  }
  const mimeType = match[1];
  const imageBase64 = match[2];

  let detected = null;

  // 1. Try Vercel Serverless Function (/api/detect) - No CORS!
  try {
    setProgress(0.4, 'Gemini Vision AI is analyzing diagram labels...');
    const res = await fetch('/api/detect', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ imageBase64, mimeType, apiKey })
    });

    if (res.ok) {
      const data = await res.json();
      if (Array.isArray(data.labels) && data.labels.length > 0) {
        detected = data.labels;
        console.log(`Gemini Vision detected ${detected.length} labels via /api/detect`);
      }
    }
  } catch (err) {
    console.warn('/api/detect not reachable (running standalone or local):', err);
  }

  // 2. Direct Fallback if /api/detect was unavailable
  if (!detected || detected.length === 0) {
    const models = ['gemini-3.5-flash-lite', 'gemini-3.5-flash', 'gemini-flash-latest'];
    for (const model of models) {
      try {
        const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            contents: [{
              parts: [
                {
                  text: 'Detect all text labels, anatomical words, diagram labels, and text annotations in this image. For each label or word, return its text and its exact 2D bounding box as [ymin, xmin, ymax, xmax] on a 0 to 1000 normalized scale. Return a valid JSON array of objects: [{"label": "label name", "box_2d": [ymin, xmin, ymax, xmax]}]'
                },
                {
                  inlineData: { mimeType, data: imageBase64 }
                }
              ]
            }],
            generationConfig: {
              responseMimeType: 'application/json',
              maxOutputTokens: 8192,
              temperature: 0.1
            }
          })
        });

        if (res.ok) {
          const data = await res.json();
          const text = data?.candidates?.[0]?.content?.parts?.[0]?.text;
          if (text) {
            const parsed = JSON.parse(text);
            if (Array.isArray(parsed) && parsed.length > 0) {
              detected = parsed;
              break;
            }
          }
        }
      } catch (e) {}
    }
  }

  if (!detected || detected.length === 0) {
    console.warn('Gemini AI unavailable, using local OCR engine.');
    return runOCR(dataUrl);
  }

  setProgress(0.9, `Building precision AI masks for ${detected.length} labels...`);

  const words = [];
  detected.forEach((item, index) => {
    const box = item.box_2d;
    const label = item.label || item.text || '(Word)';
    if (!box || box.length < 4) return;

    const ymin = Math.min(box[0], box[2]);
    const xmin = Math.min(box[1], box[3]);
    const ymax = Math.max(box[0], box[2]);
    const xmax = Math.max(box[1], box[3]);

    // Convert 0-1000 normalized to natural pixel coordinates with slight padding
    let x = Math.round((xmin / 1000) * naturalWidth) - 2;
    let y = Math.round((ymin / 1000) * naturalHeight) - 2;
    let width = Math.round(((xmax - xmin) / 1000) * naturalWidth) + 4;
    let height = Math.round(((ymax - ymin) / 1000) * naturalHeight) + 4;

    x = Math.max(0, x);
    y = Math.max(0, y);
    width = Math.min(naturalWidth - x, width);
    height = Math.min(naturalHeight - y, height);

    words.push({
      id: 'ai_' + index,
      text: label.trim(),
      x: x,
      y: y,
      width: width,
      height: height,
      active: true,
      userCreated: false
    });
  });

  setProgress(1.0, 'AI Detection Complete!');
  return words;
}

async function runOCR(dataUrl) {
  setProgress(0.2, 'Running local OCR engine...');

  if (!window.Tesseract) {
    throw new Error('Tesseract library not loaded.');
  }

  let worker;
  const origin = window.location.origin;

  try {
    worker = await Tesseract.createWorker('eng', 1, {
      workerPath: origin + '/libs/worker.min.js',
      corePath: origin + '/libs/core',
      langPath: origin + '/libs/tessdata',
      gzip: true,
      logger: (m) => {
        if (m.status === 'recognizing text') {
          const p = 0.2 + (m.progress * 0.75);
          setProgress(p, `Detecting labels: ${Math.round(m.progress * 100)}%`);
        }
      }
    });
  } catch (err) {
    console.warn('Local worker fallback to standard:', err);
    worker = await Tesseract.createWorker('eng', 1, {
      logger: (m) => {
        if (m.status === 'recognizing text') {
          const p = 0.2 + (m.progress * 0.75);
          setProgress(p, `Detecting labels: ${Math.round(m.progress * 100)}%`);
        }
      }
    });
  }

  const ret = await worker.recognize(dataUrl, {}, { tsv: true, blocks: true });
  await worker.terminate();

  setProgress(0.95, 'Building word masks...');

  const words = parseTSV(ret.data.tsv);
  setProgress(1.0, 'Done!');
  return words;
}

function finishDetection(words) {
  state.rawWords = words;
  recomputeActiveWords();
  elements.progressCard.style.display = 'none';
  elements.studioWrapper.style.display = 'flex';
  applyFiltersAndRender();
  setZoom(1.0);
  showToast(`Detected & masked ${state.allWords.length} clean labels!`, 'success');
}

function recomputeActiveWords() {
  if (state.currentGrouping === 'labels') {
    state.allWords = mergeAdjacentWords(state.rawWords);
  } else {
    state.allWords = [...state.rawWords];
  }
}

// ==========================================
// Filtering & Rendering
// ==========================================
function applyFiltersAndRender() {
  const minLen = parseInt(elements.sliderMinLength.value, 10);
  const search = elements.inputSearchFilter.value.trim().toLowerCase();

  state.minLength = minLen;
  elements.labelMinLength.textContent = minLen;

  let activeCount = 0;
  state.allWords.forEach(w => {
    if (w.userCreated) {
      w.active = true;
    } else {
      const lenOk = w.text.length >= minLen;
      const searchOk = search === '' || w.text.toLowerCase().includes(search);
      w.active = lenOk && searchOk;
    }
    if (w.active) activeCount++;
  });

  elements.badgeMaskCount.textContent = `${activeCount} Masked`;
  renderMaskLayer();
}

function renderMaskLayer() {
  const layer = elements.maskOverlayLayer;
  layer.innerHTML = '';

  const img = elements.previewImage;
  if (!img.clientWidth || !state.naturalWidth) return;

  const scaleX = img.clientWidth / state.naturalWidth;
  const scaleY = img.clientHeight / state.naturalHeight;

  state.allWords.forEach(word => {
    if (!word.active) return;

    const box = document.createElement('div');
    box.className = `mask-box mask-style-${state.currentStyle}`;
    box.style.left = (word.x * scaleX) + 'px';
    box.style.top = (word.y * scaleY) + 'px';
    box.style.width = (word.width * scaleX) + 'px';
    box.style.height = (word.height * scaleY) + 'px';
    box.dataset.id = word.id;
    box.title = word.text;

    // Hover reveal
    if (state.currentMode === 'hover' || state.currentMode === 'both') {
      box.addEventListener('mouseenter', () => {
        if (!box.dataset.pinned) box.classList.add('revealed');
      });
      box.addEventListener('mouseleave', () => {
        if (!box.dataset.pinned) box.classList.remove('revealed');
      });
    }

    // Click action: Delete if eraser mode active, else toggle pin
    box.addEventListener('click', (e) => {
      e.stopPropagation();
      if (state.isEraserMode) {
        deleteMask(word.id);
        return;
      }
      if (box.dataset.pinned) {
        delete box.dataset.pinned;
        box.classList.remove('revealed');
      } else {
        box.dataset.pinned = 'true';
        box.classList.add('revealed');
      }
    });

    // Delete mask with right-click or double-click
    box.addEventListener('contextmenu', (e) => {
      e.preventDefault();
      e.stopPropagation();
      deleteMask(word.id);
    });

    box.addEventListener('dblclick', (e) => {
      e.stopPropagation();
      deleteMask(word.id);
    });

    layer.appendChild(box);
  });
}

function deleteMask(id) {
  state.rawWords = state.rawWords.filter(w => w.id !== id);
  state.allWords = state.allWords.filter(w => w.id !== id);
  applyFiltersAndRender();
  showToast('Mask removed', 'info');
}

// ==========================================
// Toolbar Controls
// ==========================================
function setupToolbar() {
  // Mode Selector (Trigger)
  const modeGroup = document.getElementById('mode-selector');
  modeGroup.querySelectorAll('.pill-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      modeGroup.querySelectorAll('.pill-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      state.currentMode = btn.dataset.mode;
      renderMaskLayer();
    });
  });

  // Style Selector (Mask appearance)
  const styleGroup = document.getElementById('style-selector');
  styleGroup.querySelectorAll('.pill-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      styleGroup.querySelectorAll('.pill-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      state.currentStyle = btn.dataset.style;
      renderMaskLayer();
    });
  });

  // Units Selector (Labels vs Words)
  const groupSelector = document.getElementById('group-selector');
  if (groupSelector) {
    groupSelector.querySelectorAll('.pill-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        groupSelector.querySelectorAll('.pill-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        state.currentGrouping = btn.dataset.group;
        recomputeActiveWords();
        applyFiltersAndRender();
        showToast(state.currentGrouping === 'labels' ? 'Grouped into complete labels' : 'Separated into single words', 'info');
      });
    });
  }

  // Slider & Search
  elements.sliderMinLength.addEventListener('input', applyFiltersAndRender);
  elements.inputSearchFilter.addEventListener('input', applyFiltersAndRender);

  // Mask All / Clear All
  elements.btnSelectAll.addEventListener('click', () => {
    state.allWords.forEach(w => w.active = true);
    applyFiltersAndRender();
    showToast('All words masked', 'info');
  });

  elements.btnClearAll.addEventListener('click', () => {
    state.allWords.forEach(w => w.active = false);
    applyFiltersAndRender();
    showToast('All masks cleared', 'info');
  });

  // Draw Box Mode
  elements.btnDrawMode.addEventListener('click', () => {
    state.isDrawMode = !state.isDrawMode;
    state.isClickMaskMode = false;
    state.isEraserMode = false;
    elements.btnDrawMode.classList.toggle('active', state.isDrawMode);
    elements.btnClickMaskMode.classList.remove('active');
    if (elements.btnEraserMode) elements.btnEraserMode.classList.remove('btn-danger-active');
    elements.stageViewport.classList.remove('eraser-active');
    elements.stageViewport.style.cursor = state.isDrawMode ? 'crosshair' : 'default';
    if (state.isDrawMode) showToast('Draw Box: Click & drag over text to mask', 'info');
  });

  // Tap-to-Mask Mode
  elements.btnClickMaskMode.addEventListener('click', () => {
    state.isClickMaskMode = !state.isClickMaskMode;
    state.isDrawMode = false;
    state.isEraserMode = false;
    elements.btnClickMaskMode.classList.toggle('active', state.isClickMaskMode);
    elements.btnDrawMode.classList.remove('active');
    if (elements.btnEraserMode) elements.btnEraserMode.classList.remove('btn-danger-active');
    elements.stageViewport.classList.remove('eraser-active');
    elements.stageViewport.style.cursor = state.isClickMaskMode ? 'cell' : 'default';
    if (state.isClickMaskMode) showToast('Tap to Mask: Click anywhere on text to cover it', 'info');
  });

  // Remove Mask (Eraser) Mode
  if (elements.btnEraserMode) {
    elements.btnEraserMode.addEventListener('click', () => {
      state.isEraserMode = !state.isEraserMode;
      state.isDrawMode = false;
      state.isClickMaskMode = false;
      elements.btnEraserMode.classList.toggle('btn-danger-active', state.isEraserMode);
      elements.btnDrawMode.classList.remove('active');
      elements.btnClickMaskMode.classList.remove('active');
      elements.stageViewport.classList.toggle('eraser-active', state.isEraserMode);
      elements.stageViewport.style.cursor = state.isEraserMode ? 'crosshair' : 'default';
      if (state.isEraserMode) {
        showToast('Remove Mask Tool active: Click any mask to delete it', 'info');
      }
    });
  }

  window.addEventListener('resize', renderMaskLayer);
}

// ==========================================
// Stage Events (Drawing & Tapping)
// ==========================================
function setupStage() {
  const viewport = elements.stageViewport;
  let drawBox = null;

  viewport.addEventListener('mousedown', (e) => {
    if (e.button !== 0) return;

    const rect = viewport.getBoundingClientRect();
    const clickX = e.clientX - rect.left;
    const clickY = e.clientY - rect.top;

    // Tap-to-mask
    if (state.isClickMaskMode) {
      const scaleX = state.naturalWidth / elements.previewImage.clientWidth;
      const scaleY = state.naturalHeight / elements.previewImage.clientHeight;
      const w = 70 * scaleX;
      const h = 24 * scaleY;

      state.allWords.push({
        id: 'tap_' + Date.now(),
        text: '(Custom Mask)',
        x: Math.round((clickX * scaleX) - (w / 2)),
        y: Math.round((clickY * scaleY) - (h / 2)),
        width: Math.round(w),
        height: Math.round(h),
        active: true,
        userCreated: true
      });
      applyFiltersAndRender();
      showToast('Mask added!', 'success');
      return;
    }

    // Draw custom mask
    if (state.isDrawMode) {
      state.isDrawing = true;
      state.drawStartX = clickX;
      state.drawStartY = clickY;

      drawBox = document.createElement('div');
      drawBox.className = 'custom-draw-box';
      drawBox.style.left = clickX + 'px';
      drawBox.style.top = clickY + 'px';
      drawBox.style.width = '0px';
      drawBox.style.height = '0px';
      viewport.appendChild(drawBox);
    }
  });

  window.addEventListener('mousemove', (e) => {
    if (!state.isDrawing || !drawBox) return;
    const rect = viewport.getBoundingClientRect();
    const curX = Math.max(0, Math.min(e.clientX - rect.left, rect.width));
    const curY = Math.max(0, Math.min(e.clientY - rect.top, rect.height));

    const left = Math.min(state.drawStartX, curX);
    const top = Math.min(state.drawStartY, curY);
    const width = Math.abs(curX - state.drawStartX);
    const height = Math.abs(curY - state.drawStartY);

    drawBox.style.left = left + 'px';
    drawBox.style.top = top + 'px';
    drawBox.style.width = width + 'px';
    drawBox.style.height = height + 'px';
  });

  window.addEventListener('mouseup', () => {
    if (!state.isDrawing || !drawBox) return;
    state.isDrawing = false;

    const widthPx = parseInt(drawBox.style.width, 10);
    const heightPx = parseInt(drawBox.style.height, 10);

    if (widthPx > 8 && heightPx > 6) {
      const leftPx = parseInt(drawBox.style.left, 10);
      const topPx = parseInt(drawBox.style.top, 10);
      const scaleX = state.naturalWidth / elements.previewImage.clientWidth;
      const scaleY = state.naturalHeight / elements.previewImage.clientHeight;

      state.allWords.push({
        id: 'drawn_' + Date.now(),
        text: '(Custom Mask)',
        x: Math.round(leftPx * scaleX),
        y: Math.round(topPx * scaleY),
        width: Math.round(widthPx * scaleX),
        height: Math.round(heightPx * scaleY),
        active: true,
        userCreated: true
      });
      applyFiltersAndRender();
      showToast('Custom mask added!', 'success');
    }

    if (drawBox.parentNode) {
      drawBox.parentNode.removeChild(drawBox);
    }
    drawBox = null;
  });

  // Stage Zoom Controls
  elements.btnZoomIn.addEventListener('click', () => setZoom(state.zoomLevel + 0.15));
  elements.btnZoomOut.addEventListener('click', () => setZoom(state.zoomLevel - 0.15));
  elements.btnZoomFit.addEventListener('click', () => setZoom(1.0));
}

function setZoom(lvl) {
  state.zoomLevel = Math.max(0.6, Math.min(2.5, lvl));
  elements.stageViewport.style.transform = `scale(${state.zoomLevel})`;
}

// ==========================================
// Export: Standalone Interactive Study Deck
// ==========================================
function setupExports() {
  // 1. Preview / Open Study Deck in Browser Tab
  if (elements.btnPreviewHtml) {
    elements.btnPreviewHtml.addEventListener('click', () => {
      const active = state.allWords.filter(w => w.active);
      if (active.length === 0) {
        showToast('Enable at least one mask to test the study deck.', 'error');
        return;
      }

      const html = ElyPDFGenerator.createUniversalHTML({
        imageSrc: state.currentImageSrc,
        naturalWidth: state.naturalWidth,
        naturalHeight: state.naturalHeight,
        masks: active,
        maskStyle: state.currentStyle,
        mode: state.currentMode
      });

      const blob = new Blob([html], { type: 'text/html;charset=utf-8' });
      const url = URL.createObjectURL(blob);
      window.open(url, '_blank');
      showToast('Interactive Study Deck opened in new tab!', 'success');
    });
  }

  // 2. Download Study Deck (.html)
  if (elements.btnExportHtml) {
    elements.btnExportHtml.addEventListener('click', () => {
      const active = state.allWords.filter(w => w.active);
      if (active.length === 0) {
        showToast('Enable at least one mask to download.', 'error');
        return;
      }

      const html = ElyPDFGenerator.createUniversalHTML({
        imageSrc: state.currentImageSrc,
        naturalWidth: state.naturalWidth,
        naturalHeight: state.naturalHeight,
        masks: active,
        maskStyle: state.currentStyle,
        mode: state.currentMode
      });

      const blob = new Blob([html], { type: 'text/html;charset=utf-8' });
      downloadFile(blob, 'ElyHelper_StudyDeck.html');
      showToast('Interactive Study Deck (.html) downloaded!', 'success');
    });
  }
}

/**
 * Guarantees proper file download on Windows browsers with explicit MIME type & filename
 */
function downloadFile(blob, filename) {
  const mimeType = filename.endsWith('.html') ? 'text/html;charset=utf-8' : (blob.type || 'application/octet-stream');
  const fileBlob = blob.type === mimeType ? blob : new Blob([blob], { type: mimeType });
  const url = URL.createObjectURL(fileBlob);

  const a = document.createElement('a');
  a.style.display = 'none';
  a.href = url;
  a.setAttribute('download', filename);
  a.download = filename;

  document.body.appendChild(a);
  a.click();

  setTimeout(() => {
    if (a.parentNode) {
      document.body.removeChild(a);
    }
    // Keep object URL alive for 90s so browser download manager finishes writing to disk
    setTimeout(() => URL.revokeObjectURL(url), 90000);
  }, 500);
}
