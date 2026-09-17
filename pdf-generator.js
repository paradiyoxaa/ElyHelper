/**
 * pdf-generator.js
 * 100% Offline, Rock-Solid PDF Generation for ElyHelper
 * Converts any image format (WEBP, PNG, JPG, BMP) into standardized PDF-compatible format,
 * embeds AcroForm pushbuttons with interactive reveal/hide scripts.
 */

const ElyPDFGenerator = {
  /**
   * Helper: Converts any image (including WEBP, AVIF, BMP, GIF) into standard PNG data URL
   */
  async _convertToStandardPng(imageSrc, width, height) {
    if (imageSrc.startsWith('data:image/png')) {
      return imageSrc;
    }
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d');
    const img = new Image();
    img.crossOrigin = 'anonymous';
    await new Promise((resolve, reject) => {
      img.onload = resolve;
      img.onerror = reject;
      img.src = imageSrc;
    });
    ctx.drawImage(img, 0, 0, width, height);
    return canvas.toDataURL('image/png');
  },

  /**
   * Generates native Interactive PDF with AcroForm button scripts
   */
  async createInteractivePDF({ imageSrc, naturalWidth, naturalHeight, masks, maskStyle }) {
    if (typeof PDFLib === 'undefined') {
      throw new Error('PDF-lib library not found. Please ensure libs/pdf-lib.min.js is present.');
    }

    const { PDFDocument, rgb, PDFName, PDFString } = PDFLib;
    const pdfDoc = await PDFDocument.create();

    // Standardize page dimensions
    const maxDimension = 1400;
    let pageWidth = naturalWidth;
    let pageHeight = naturalHeight;

    if (pageWidth > maxDimension || pageHeight > maxDimension) {
      const scale = Math.min(maxDimension / pageWidth, maxDimension / pageHeight);
      pageWidth = Math.round(pageWidth * scale);
      pageHeight = Math.round(pageHeight * scale);
    }

    const scaleX = pageWidth / naturalWidth;
    const scaleY = pageHeight / naturalHeight;

    const page = pdfDoc.addPage([pageWidth, pageHeight]);

    // ALWAYS convert image to standard PNG to guarantee 100% compatibility with WEBP, JPG, etc.
    const safePngDataUrl = await this._convertToStandardPng(imageSrc, naturalWidth, naturalHeight);
    const embeddedImage = await pdfDoc.embedPng(safePngDataUrl);

    // Draw background image
    page.drawImage(embeddedImage, {
      x: 0,
      y: 0,
      width: pageWidth,
      height: pageHeight,
    });

    // Mask colors
    let r = 0.1, g = 0.11, b = 0.14; // default matte charcoal
    let buttonLabel = '';

    if (maskStyle === 'neon') {
      r = 0.83; g = 0.64; b = 0.45; // warm amber
    } else if (maskStyle === 'badge') {
      r = 0.15; g = 0.17; b = 0.22;
      buttonLabel = '?';
    }

    const form = pdfDoc.getForm();

    // Adobe Acrobat JavaScript Actions
    const jsMouseEnter = `event.target.fillColor = ['T'];`;
    const jsMouseExit = `
      if (!event.target.userName || event.target.userName !== 'pinned') {
        event.target.fillColor = ['RGB', ${r}, ${g}, ${b}];
      }
    `;
    const jsMouseUp = `
      if (event.target.userName === 'pinned') {
        event.target.userName = '';
        event.target.fillColor = ['RGB', ${r}, ${g}, ${b}];
      } else {
        event.target.userName = 'pinned';
        event.target.fillColor = ['T'];
      }
    `;

    // Embed button over each masked word
    masks.forEach((mask, index) => {
      const pdfX = mask.x * scaleX;
      const pdfWidth = Math.max(12, mask.width * scaleX);
      const pdfHeight = Math.max(10, mask.height * scaleY);
      const pdfY = pageHeight - (mask.y * scaleY) - pdfHeight;

      const fieldName = `mask_field_${index}`;
      const button = form.createButton(fieldName);

      button.addToPage(buttonLabel || '', page, {
        x: pdfX,
        y: pdfY,
        width: pdfWidth,
        height: pdfHeight,
        textColor: rgb(1, 1, 1),
        backgroundColor: rgb(r, g, b),
        borderColor: rgb(0.2, 0.22, 0.28),
        borderWidth: 1,
      });

      // Attach Additional Actions (/AA: E, X, U)
      const widgets = button.acroField.getWidgets();
      widgets.forEach((widget) => {
        widget.dict.set(
          PDFName.of('AA'),
          pdfDoc.context.obj({
            E: { Type: 'Action', S: 'JavaScript', JS: PDFString.of(jsMouseEnter) },
            X: { Type: 'Action', S: 'JavaScript', JS: PDFString.of(jsMouseExit) },
            U: { Type: 'Action', S: 'JavaScript', JS: PDFString.of(jsMouseUp) }
          })
        );
      });
    });

    const pdfBytes = await pdfDoc.save();
    return new Blob([pdfBytes], { type: 'application/pdf' });
  },

  /**
   * Universal Single-File Interactive HTML Study Deck
   * Guaranteed 100% offline, opens on any device with smooth reveal animations.
   */
  createUniversalHTML({ imageSrc, naturalWidth, naturalHeight, masks, maskStyle, mode }) {
    const masksJson = JSON.stringify(masks);

    return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>ElyHelper Study Deck</title>
  <style>
    :root {
      --bg: #121417;
      --card-bg: #181b20;
      --surface: #20242b;
      --text: #ede8e1;
      --muted: #aba49c;
      --accent: #d4a373;
      --border: rgba(255, 255, 255, 0.08);
    }
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      background: var(--bg);
      color: var(--text);
      min-height: 100vh;
      display: flex;
      flex-direction: column;
      align-items: center;
      padding: 1.25rem;
    }
    header {
      width: 100%;
      max-width: 1200px;
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 1rem;
      padding: 0.65rem 1.25rem;
      background: var(--card-bg);
      border: 1px solid var(--border);
      border-radius: 6px;
    }
    .brand { font-weight: 700; font-size: 0.95rem; color: var(--accent); }
    .controls { display: flex; gap: 0.4rem; }
    button {
      background: var(--surface);
      color: var(--text);
      border: 1px solid var(--border);
      padding: 0.4rem 0.8rem;
      border-radius: 4px;
      font-size: 0.78rem;
      font-weight: 600;
      cursor: pointer;
    }
    button:hover { background: #2a303a; }
    .btn-primary { background: var(--accent); color: #121417; border-color: var(--accent); }
    .viewer-container {
      position: relative;
      max-width: 100%;
      border-radius: 6px;
      overflow: hidden;
      border: 1px solid var(--border);
      background: #0d0f12;
    }
    #study-img { display: block; max-width: 100%; height: auto; user-select: none; }
    .mask-layer { position: absolute; top: 0; left: 0; width: 100%; height: 100%; }
    .mask-box {
      position: absolute;
      border-radius: 2px;
      cursor: pointer;
      transition: background-color 0.15s, opacity 0.15s;
      box-sizing: border-box;
      display: flex;
      align-items: center;
      justify-content: center;
    }
    .style-black { background-color: #1a1d23; border: 1px solid rgba(255, 255, 255, 0.1); }
    .style-neon { background-color: rgba(212, 163, 115, 0.88); border: 1px solid rgba(212, 163, 115, 0.95); }
    .style-blur { background-color: rgba(32, 36, 43, 0.8); backdrop-filter: blur(5px); border: 1px solid var(--border); }
    .style-badge { background: var(--surface); border: 1px solid var(--border); color: var(--accent); font-size: 10px; font-weight: bold; }
    .style-badge::after { content: '?'; }
    .mask-box.revealed { background-color: transparent !important; backdrop-filter: none !important; border: 1px dashed var(--accent) !important; }
    .mask-box.revealed::after { content: none !important; }
    .stats-bar { margin-top: 0.85rem; font-size: 0.8rem; color: var(--muted); display: flex; gap: 0.8rem; }
    footer { margin-top: 2rem; font-size: 0.78rem; color: var(--muted); text-align: center; }
  </style>
</head>
<body>
  <header>
    <div class="brand">ElyHelper Study Deck</div>
    <div class="controls">
      <button id="btn-toggle-all">Reveal All</button>
      <button id="btn-reset">Reset All</button>
      <button class="btn-primary" onclick="window.print()">Print</button>
    </div>
  </header>

  <div class="viewer-container">
    <img id="study-img" src="${imageSrc}" alt="Study Sheet">
    <div class="mask-layer" id="mask-layer"></div>
  </div>

  <div class="stats-bar">
    <span id="revealed-count">Revealed: 0 / ${masks.length}</span>
    <span>• Tip: Hover or click masks to reveal words</span>
  </div>

  <footer>
    ElyHelper - For my beautiful girl
  </footer>

  <script>
    const masks = ${masksJson};
    const naturalWidth = ${naturalWidth};
    const naturalHeight = ${naturalHeight};
    const maskStyle = "${maskStyle || 'black'}";
    const mode = "${mode || 'both'}";

    const img = document.getElementById('study-img');
    const layer = document.getElementById('mask-layer');
    const revealedCountEl = document.getElementById('revealed-count');
    const btnToggleAll = document.getElementById('btn-toggle-all');
    const btnReset = document.getElementById('btn-reset');

    let allRevealed = false;

    function renderMasks() {
      layer.innerHTML = '';
      const scaleX = img.clientWidth / naturalWidth;
      const scaleY = img.clientHeight / naturalHeight;

      masks.forEach((m, idx) => {
        const div = document.createElement('div');
        div.className = 'mask-box style-' + maskStyle;
        div.style.left = (m.x * scaleX) + 'px';
        div.style.top = (m.y * scaleY) + 'px';
        div.style.width = (m.width * scaleX) + 'px';
        div.style.height = (m.height * scaleY) + 'px';

        if (mode === 'hover' || mode === 'both') {
          div.addEventListener('mouseenter', () => {
            if (!div.dataset.pinned) div.classList.add('revealed');
            updateCount();
          });
          div.addEventListener('mouseleave', () => {
            if (!div.dataset.pinned) div.classList.remove('revealed');
            updateCount();
          });
        }

        div.addEventListener('click', () => {
          if (div.dataset.pinned) {
            delete div.dataset.pinned;
            div.classList.remove('revealed');
          } else {
            div.dataset.pinned = 'true';
            div.classList.add('revealed');
          }
          updateCount();
        });

        layer.appendChild(div);
      });
      updateCount();
    }

    function updateCount() {
      const revealed = document.querySelectorAll('.mask-box.revealed').length;
      revealedCountEl.textContent = 'Revealed: ' + revealed + ' / ' + masks.length;
    }

    btnToggleAll.addEventListener('click', () => {
      allRevealed = !allRevealed;
      document.querySelectorAll('.mask-box').forEach(box => {
        if (allRevealed) {
          box.dataset.pinned = 'true';
          box.classList.add('revealed');
        } else {
          delete box.dataset.pinned;
          box.classList.remove('revealed');
        }
      });
      btnToggleAll.textContent = allRevealed ? 'Hide All' : 'Reveal All';
      updateCount();
    });

    btnReset.addEventListener('click', () => {
      allRevealed = false;
      btnToggleAll.textContent = 'Reveal All';
      document.querySelectorAll('.mask-box').forEach(box => {
        delete box.dataset.pinned;
        box.classList.remove('revealed');
      });
      updateCount();
    });

    window.addEventListener('resize', renderMasks);
    if (img.complete) { renderMasks(); } else { img.onload = renderMasks; }
  </script>
</body>
</html>`;
  },

  /**
   * 2-Page Printable PDF Worksheet + Answer Key
   */
  async createPrintableWorksheet({ imageSrc, naturalWidth, naturalHeight, masks }) {
    if (typeof PDFLib === 'undefined') {
      throw new Error('PDF-lib is required for printable worksheet generation.');
    }

    const { PDFDocument, rgb, StandardFonts } = PDFLib;
    const pdfDoc = await PDFDocument.create();
    const font = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
    const regularFont = await pdfDoc.embedFont(StandardFonts.Helvetica);

    const maxDimension = 1200;
    let pageWidth = naturalWidth;
    let pageHeight = naturalHeight;
    if (pageWidth > maxDimension || pageHeight > maxDimension) {
      const scale = Math.min(maxDimension / pageWidth, maxDimension / pageHeight);
      pageWidth = Math.round(pageWidth * scale);
      pageHeight = Math.round(pageHeight * scale);
    }
    const scaleX = pageWidth / naturalWidth;
    const scaleY = pageHeight / naturalHeight;

    const page1 = pdfDoc.addPage([pageWidth, pageHeight]);

    const safePngDataUrl = await this._convertToStandardPng(imageSrc, naturalWidth, naturalHeight);
    const embeddedImage = await pdfDoc.embedPng(safePngDataUrl);

    page1.drawImage(embeddedImage, {
      x: 0,
      y: 0,
      width: pageWidth,
      height: pageHeight,
    });

    masks.forEach((mask, index) => {
      const pdfX = mask.x * scaleX;
      const pdfWidth = Math.max(16, mask.width * scaleX);
      const pdfHeight = Math.max(12, mask.height * scaleY);
      const pdfY = pageHeight - (mask.y * scaleY) - pdfHeight;

      page1.drawRectangle({
        x: pdfX,
        y: pdfY,
        width: pdfWidth,
        height: pdfHeight,
        color: rgb(1, 1, 1),
        borderColor: rgb(0.2, 0.2, 0.2),
        borderWidth: 1.5,
      });

      const numStr = `(${index + 1})`;
      const numSize = Math.min(10, Math.max(7, pdfHeight * 0.7));
      page1.drawText(numStr, {
        x: pdfX + 2,
        y: pdfY + (pdfHeight / 2) - (numSize / 2) + 1,
        size: numSize,
        font: font,
        color: rgb(0.1, 0.1, 0.1),
      });
    });

    // Page 2: Answer Key
    const page2 = pdfDoc.addPage([pageWidth, pageHeight]);
    page2.drawRectangle({
      x: 0,
      y: 0,
      width: pageWidth,
      height: pageHeight,
      color: rgb(0.98, 0.98, 0.99),
    });

    page2.drawText('ElyHelper Study Sheet: Official Answer Key', {
      x: 40,
      y: pageHeight - 60,
      size: 20,
      font: font,
      color: rgb(0.1, 0.15, 0.25),
    });

    const startY = pageHeight - 110;
    const colWidth = (pageWidth - 80) / 2;
    const itemsPerCol = Math.ceil(masks.length / 2);

    masks.forEach((mask, index) => {
      const col = index < itemsPerCol ? 0 : 1;
      const row = col === 0 ? index : index - itemsPerCol;
      const itemX = 40 + (col * colWidth);
      const itemY = startY - (row * 22);

      if (itemY > 50) {
        page2.drawText(`[${index + 1}]`, {
          x: itemX,
          y: itemY,
          size: 10,
          font: font,
          color: rgb(0.3, 0.35, 0.8),
        });

        page2.drawText(mask.text || '(Masked Word)', {
          x: itemX + 35,
          y: itemY,
          size: 10,
          font: regularFont,
          color: rgb(0.1, 0.1, 0.15),
        });
      }
    });

    page2.drawText('ElyHelper - For my beautiful girl', {
      x: 40,
      y: 25,
      size: 10,
      font: regularFont,
      color: rgb(0.5, 0.55, 0.65),
    });

    const pdfBytes = await pdfDoc.save();
    return new Blob([pdfBytes], { type: 'application/pdf' });
  }
};
