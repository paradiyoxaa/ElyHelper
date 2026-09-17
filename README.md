# ElyHelper — Interactive Hide-and-Reveal Study Deck

**ElyHelper** turns textbook diagrams, anatomy sheets, and study notes into interactive hide-and-reveal study decks where words and labels are concealed behind masks that reveal when hovered or clicked.

Dedicated with love: *"ElyHelper - For my beautiful girl"*

---

## ✨ Features

1. **Google Gemini Vision AI Detection**:
   - Uses Gemini AI Vision (`gemini-3.5-flash-lite`) with 2D spatial bounding box detection.
   - Accurately reads angled, medical, curved, and complex diagram terminology with zero false positives.
   - Includes built-in local OCR engine fallback if offline.

2. **Interactive Hide-and-Reveal Canvas**:
   - **Hover Reveal**: Hover over any masked label to peek; mouse out to re-hide.
   - **Click Lock**: Click to toggle locked reveal state; click again to conceal.
   - **Remove Mask Tool (Eraser)**: Click any mask to quickly delete and edit errors. Also supports right-click and double-click deletion.
   - **Manual Draw & Tap Tools**: Draw a custom box or tap anywhere to mask diagrams, figures, or formulas.
   - **Matte Night-Light Aesthetic**: Easy on the eyes, sleek warm charcoal design with zero glare.

3. **Universal Interactive Export**:
   - **Self-Contained Study Deck (`.html`)**: Double-click to open in Chrome, Edge, Safari, iPad, iPhone, or Android with 100% smooth CSS transitions and zero external dependencies.

---

## 🚀 Deployment to Vercel

ElyHelper is optimized for instant deployment on [Vercel](https://vercel.com):

1. Import this repository into Vercel: **[Deploy to Vercel](https://vercel.com/new/import?s=https%3A%2F%2Fgithub.com%2Fparadiyoxaa%2FElyHelper)**
2. In Vercel Project Settings → **Environment Variables**, add:
   - `GEMINI_API_KEY`: `<your_gemini_api_key>`
3. Click **Deploy**.

---

## 💻 Running Locally

To run locally with backend AI support:
```bash
node dev-server.js
```
Then open `http://localhost:8765` in your browser.
