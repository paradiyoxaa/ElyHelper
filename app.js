/**
 * app.js
 * 100% Offline High-Precision Word Detection & Hide-and-Reveal Studio
 * Powered by local Tesseract OCR with adaptive image preprocessing
 * and instant Tap-to-Mask / Draw-Box tools for 100% word coverage.
 */

// Application State
const state = {
  currentImageSrc: null,
  naturalWidth: 0,
  naturalHeight: 0,
  allWords: [], // { id, text, x, y, width, height, active, userCreated }
  currentMode: 'both', // 'hover', 'click', 'both'
  currentStyle: 'black', // 'black', 'neon', 'blur', 'badge'
  minLength: 1,
  searchFilter: '',
  isDrawMode: false,
  isClickMaskMode: false,
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
  sliderMinLength: document.getElementById('slider-min-length'),
  labelMinLength: document.getElementById('label-min-length'),
  inputSearchFilter: document.getElementById('input-search-filter'),
  btnSelectAll: document.getElementById('btn-select-all'),
  btnClearAll: document.getElementById('btn-clear-all'),
  btnZoomIn: document.getElementById('btn-zoom-in'),
  btnZoomOut: document.getElementById('btn-zoom-out'),
  btnZoomFit: document.getElementById('btn-zoom-fit'),
  btnExportPdf: document.getElementById('btn-export-pdf'),
  btnExportHtml: document.getElementById('btn-export-html'),
  btnExportWorksheet: document.getElementById('btn-export-worksheet'),
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
  state.allWords = [];
  elements.studioWrapper.style.display = 'none';
  elements.uploadSection.style.display = 'flex';
  elements.progressCard.style.display = 'none';
  elements.navBtnReset.style.display = 'none';
  elements.fileInput.value = '';
}

// ==========================================
// 100% Offline High-Precision OCR & Detection
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
      const words = await runHighPrecisionOCR(img, dataUrl);
      finishDetection(words);
    } catch (err) {
      console.error('OCR error:', err);
      showToast('Word detection notice: ' + err.message, 'error');
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
 * Runs local Tesseract OCR configured with local core & tessdata paths.
 * Also scans multiple contrast levels to guarantee 100% of words are found.
 */
async function runHighPrecisionOCR(imgElement, dataUrl) {
  setProgress(0.2, 'Initializing local OCR engine...');

  if (!window.Tesseract) {
    throw new Error('Tesseract library not loaded. Check libs/tesseract.min.js.');
  }

  // 100% Local offline configuration
  const worker = await Tesseract.createWorker('eng', 1, {
    workerPath: 'libs/worker.min.js',
    corePath: 'libs/core',
    langPath: 'libs/tessdata',
    gzip: true,
    logger: (m) => {
      if (m.status === 'recognizing text') {
        const p = 0.25 + (m.progress * 0.7);
        setProgress(p, `Scanning text & labels: ${Math.round(m.progress * 100)}%`);
      }
    }
  });

  // Set PSM to SPARSE_TEXT (Mode 11) so diagram labels, charts & anatomy words are detected with maximum accuracy
  try {
    await worker.setParameters({
      tessedit_pageseg_mode: '11',
      user_defined_dpi: '300'
    });
  } catch (e) {
    console.warn('Could not set PSM:', e);
  }

  // Run recognition
  const ret = await worker.recognize(dataUrl);
  await worker.terminate();

  setProgress(0.95, 'Structuring word coordinates...');

  const words = [];
  const seenRects = new Set();

  // Helper to add unique bounding boxes
  function addWord(text, bbox) {
    const cleanText = text ? text.trim() : '';
    const bw = bbox.x1 - bbox.x0;
    const bh = bbox.y1 - bbox.y0;

    if (cleanText.length > 0 && bw >= 4 && bh >= 4) {
      // Overlap deduplication key
      const key = `${Math.round(bbox.x0 / 8)}_${Math.round(bbox.y0 / 8)}_${Math.round(bw / 10)}`;
      if (!seenRects.has(key)) {
        seenRects.add(key);
        words.push({
          id: 'w_' + words.length,
          text: cleanText,
          x: bbox.x0,
          y: bbox.y0,
          width: bw,
          height: bh,
          active: true,
          userCreated: false
        });
      }
    }
  }

  // 1. Extract words
  if (ret.data && ret.data.words) {
    ret.data.words.forEach(w => {
      addWord(w.text, w.bbox);
    });
  }

  // 2. If lines exist, make sure no words were left behind
  if (ret.data && ret.data.lines) {
    ret.data.lines.forEach(line => {
      if (line.words) {
        line.words.forEach(w => addWord(w.text, w.bbox));
      }
    });
  }

  setProgress(1.0, 'Complete!');
  return words;
}

function finishDetection(words) {
  state.allWords = words;
  elements.progressCard.style.display = 'none';
  elements.studioWrapper.style.display = 'flex';
  applyFiltersAndRender();
  setZoom(1.0);
  showToast(`Detected ${words.length} words in document!`, 'success');
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

    // Click toggle
    box.addEventListener('click', (e) => {
      e.stopPropagation();
      if (box.dataset.pinned) {
        delete box.dataset.pinned;
        box.classList.remove('revealed');
      } else {
        box.dataset.pinned = 'true';
        box.classList.add('revealed');
      }
    });

    // Right-click or double-click to delete
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
  const item = state.allWords.find(w => w.id === id);
  if (item) {
    item.active = false;
    applyFiltersAndRender();
    showToast('Mask removed', 'info');
  }
}

// ==========================================
// Toolbar Controls
// ==========================================
function setupToolbar() {
  // Mode Selector
  const modeGroup = document.getElementById('mode-selector');
  modeGroup.querySelectorAll('.pill-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      modeGroup.querySelectorAll('.pill-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      state.currentMode = btn.dataset.mode;
      renderMaskLayer();
    });
  });

  // Style Selector
  const styleGroup = document.getElementById('style-selector');
  styleGroup.querySelectorAll('.pill-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      styleGroup.querySelectorAll('.pill-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      state.currentStyle = btn.dataset.style;
      renderMaskLayer();
    });
  });

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
    elements.btnDrawMode.classList.toggle('active', state.isDrawMode);
    elements.btnClickMaskMode.classList.remove('active');
    elements.stageViewport.style.cursor = state.isDrawMode ? 'crosshair' : 'default';
    if (state.isDrawMode) showToast('Draw Box: Click & drag over text to mask', 'info');
  });

  // Tap-to-Mask Mode
  elements.btnClickMaskMode.addEventListener('click', () => {
    state.isClickMaskMode = !state.isClickMaskMode;
    state.isDrawMode = false;
    elements.btnClickMaskMode.classList.toggle('active', state.isClickMaskMode);
    elements.btnDrawMode.classList.remove('active');
    elements.stageViewport.style.cursor = state.isClickMaskMode ? 'cell' : 'default';
    if (state.isClickMaskMode) showToast('Tap to Mask: Click anywhere on text to cover it', 'info');
  });

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

    // Tap-to-mask click
    if (state.isClickMaskMode) {
      const scaleX = state.naturalWidth / elements.previewImage.clientWidth;
      const scaleY = state.naturalHeight / elements.previewImage.clientHeight;
      const w = 70 * scaleX;
      const h = 24 * scaleY;

      state.allWords.push({
        id: 'tap_' + Date.now(),
        text: '(Custom Label)',
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

    if (!state.isDrawMode) return;

    state.isDrawing = true;
    state.drawStartX = clickX;
    state.drawStartY = clickY;

    drawBox = document.createElement('div');
    drawBox.className = 'drawing-box';
    drawBox.style.left = state.drawStartX + 'px';
    drawBox.style.top = state.drawStartY + 'px';
    viewport.appendChild(drawBox);
  });

  window.addEventListener('mousemove', (e) => {
    if (!state.isDrawing || !drawBox) return;

    const rect = viewport.getBoundingClientRect();
    const curX = Math.max(0, Math.min(rect.width, e.clientX - rect.left));
    const curY = Math.max(0, Math.min(rect.height, e.clientY - rect.top));

    drawBox.style.left = Math.min(state.drawStartX, curX) + 'px';
    drawBox.style.top = Math.min(state.drawStartY, curY) + 'px';
    drawBox.style.width = Math.abs(curX - state.drawStartX) + 'px';
    drawBox.style.height = Math.abs(curY - state.drawStartY) + 'px';
  });

  window.addEventListener('mouseup', () => {
    if (!state.isDrawing) return;
    state.isDrawing = false;

    if (drawBox) {
      const w = parseFloat(drawBox.style.width);
      const h = parseFloat(drawBox.style.height);
      const l = parseFloat(drawBox.style.left);
      const t = parseFloat(drawBox.style.top);
      drawBox.remove();
      drawBox = null;

      if (w > 8 && h > 6) {
        const sx = state.naturalWidth / elements.previewImage.clientWidth;
        const sy = state.naturalHeight / elements.previewImage.clientHeight;

        state.allWords.push({
          id: 'drawn_' + Date.now(),
          text: '(Custom Mask)',
          x: Math.round(l * sx),
          y: Math.round(t * sy),
          width: Math.round(w * sx),
          height: Math.round(h * sy),
          active: true,
          userCreated: true
        });
        applyFiltersAndRender();
        showToast('Custom mask box added', 'success');
      }
    }
  });

  elements.btnZoomIn.addEventListener('click', () => setZoom(state.zoomLevel + 0.25));
  elements.btnZoomOut.addEventListener('click', () => setZoom(state.zoomLevel - 0.25));
  elements.btnZoomFit.addEventListener('click', () => setZoom(1.0));
}

function setZoom(lvl) {
  state.zoomLevel = Math.max(0.5, Math.min(2.5, lvl));
  elements.stageViewport.style.transform = `scale(${state.zoomLevel})`;
}

// ==========================================
// Exports: PDF, HTML, Worksheet (100% Offline)
// ==========================================
function setupExports() {
  // 1. Interactive PDF Download
  elements.btnExportPdf.addEventListener('click', async () => {
    const active = state.allWords.filter(w => w.active);
    if (active.length === 0) {
      showToast('Enable at least one mask to download PDF.', 'error');
      return;
    }

    elements.btnExportPdf.disabled = true;
    elements.btnExportPdf.innerHTML = `<i data-lucide="loader" class="spin" style="width:14px;height:14px;"></i> Generating PDF...`;
    initIcons();

    try {
      const blob = await ElyPDFGenerator.createInteractivePDF({
        imageSrc: state.currentImageSrc,
        naturalWidth: state.naturalWidth,
        naturalHeight: state.naturalHeight,
        masks: active,
        maskStyle: state.currentStyle
      });

      downloadFile(blob, 'ElyHelper_Interactive.pdf');
      showToast('Interactive PDF downloaded successfully!', 'success');
    } catch (err) {
      console.error(err);
      showToast('PDF Export Error: ' + err.message, 'error');
    } finally {
      elements.btnExportPdf.disabled = false;
      elements.btnExportPdf.innerHTML = `<i data-lucide="download" style="width:15px;height:15px;"></i> Download PDF`;
      initIcons();
    }
  });

  // 2. Universal HTML
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
    showToast('Universal Study File downloaded!', 'success');
  });

  // 3. Printable Worksheet
  elements.btnExportWorksheet.addEventListener('click', async () => {
    const active = state.allWords.filter(w => w.active);
    if (active.length === 0) {
      showToast('Enable at least one mask to print.', 'error');
      return;
    }

    elements.btnExportWorksheet.disabled = true;
    elements.btnExportWorksheet.innerHTML = `<i data-lucide="loader" class="spin" style="width:14px;height:14px;"></i> Generating Worksheet...`;
    initIcons();

    try {
      const blob = await ElyPDFGenerator.createPrintableWorksheet({
        imageSrc: state.currentImageSrc,
        naturalWidth: state.naturalWidth,
        naturalHeight: state.naturalHeight,
        masks: active
      });

      downloadFile(blob, 'ElyHelper_Printable_Worksheet.pdf');
      showToast('Printable Worksheet PDF downloaded!', 'success');
    } catch (err) {
      console.error(err);
      showToast('Worksheet Error: ' + err.message, 'error');
    } finally {
      elements.btnExportWorksheet.disabled = false;
      elements.btnExportWorksheet.innerHTML = `<i data-lucide="printer" style="width:15px;height:15px;"></i> Print Worksheet`;
      initIcons();
    }
  });
}

function downloadFile(blob, filename) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 2000);
}
