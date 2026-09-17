# ElyHelper: Interactive Hide-and-Reveal Image-to-PDF Studio

**ElyHelper** turns any image containing words (handwritten or typed study notes, textbook diagrams, slides, flashcards) into interactive study materials and PDF files where words are concealed behind masks that reveal when clicked or hovered, and re-hide when clicked again or hovered out.

---

## Key Features

1. **Client-Side OCR Word Detection**:
   - Powered by **Tesseract.js v5**, detecting text and exact bounding boxes directly inside the browser.
   - 100% private, local processing — your images and study notes never leave your device.

2. **Interactive Hide-and-Reveal Canvas**:
   - **Hover Trigger**: Hover over any masked word to peek; mouse out to re-hide.
   - **Click Trigger**: Click a mask to toggle locked reveal state; click again to conceal.
   - **Both Mode**: Combine hover peeking with click locking.
   - **Custom Drawing Tool**: Click and drag to mask any custom diagram element, formula, or word that OCR missed.
   - **Smart Filters**: Filter by word length (e.g. skip short particles like "a", "the", "in") or search for specific terms.
   - **Mask Aesthetics**: Switch between Dark Redaction, Highlighter Neon, Frosted Glass Blur, and Flashcard Question Badges (`?`).

3. **Multiple Export Formats**:
   - **Interactive PDF (.pdf)**: High-resolution PDF with embedded AcroForm pushbuttons configured with Acrobat JavaScript Additional Actions (`/AA: E, X, U`). Words reveal and re-hide natively inside Adobe Acrobat Reader, Foxit Reader, and desktop PDF viewers.
   - **Universal Study Deck (.html)**: Self-contained single-file HTML document with embedded base64 image and interaction logic. Opens on any device (iPhone, iPad, Android, Windows, Mac, Chrome, Safari) with zero installation required.
   - **Printable Worksheet & Answer Key (.pdf)**: 2-page printout with cloze test questions on page 1 and an organized answer key on page 2.

---

## How to Run Locally

You can launch ElyHelper with any static file server:

### Option A: Using Python
```bash
python -m http.server 8080
```
Then open `http://localhost:8080` in your browser.

### Option B: Using Node / npx
```bash
npx serve .
```

### Option C: Direct Browser Launch
Simply open `index.html` in modern web browsers (Chrome, Edge, Firefox, Safari).

---

## Usage Guide
1. **Upload or Select Sample**: Drag and drop an image or click "Animal Cell & Organelles" / "Data Structures Sheet" for an instant demo.
2. **Review Auto-Detected Masks**: Adjust the "Min Letters" slider or draw manual masks over formulas or figures.
3. **Practice & Test**: Hover or click masks to reveal words and test your memory.
4. **Export**: Click **Download PDF** for Adobe Acrobat interactive format or **Download HTML** for universal mobile & web review.
