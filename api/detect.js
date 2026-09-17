const https = require('https');

module.exports = async (req, res) => {
  // CORS Headers
  res.setHeader('Access-Control-Allow-Credentials', 'true');
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,PATCH,DELETE,POST,PUT');
  res.setHeader(
    'Access-Control-Allow-Headers',
    'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version'
  );

  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { imageBase64, mimeType, apiKey } = req.body || {};
    const key = process.env.GEMINI_API_KEY || apiKey;

    if (!key) {
      return res.status(400).json({
        error: 'Missing GEMINI_API_KEY. Please configure GEMINI_API_KEY in your Vercel Environment Variables or enter your key in the app.'
      });
    }

    if (!imageBase64) {
      return res.status(400).json({ error: 'Missing imageBase64' });
    }

    const payload = JSON.stringify({
      contents: [{
        parts: [
          {
            text: 'Detect all text labels, anatomical words, diagram labels, and text annotations in this image. For each label or word, return its text and its exact 2D bounding box as [ymin, xmin, ymax, xmax] on a 0 to 1000 normalized scale. Return a valid JSON array of objects: [{"label": "label name", "box_2d": [ymin, xmin, ymax, xmax]}]'
          },
          {
            inlineData: {
              mimeType: mimeType || 'image/png',
              data: imageBase64
            }
          }
        ]
      }],
      generationConfig: {
        responseMimeType: 'application/json',
        maxOutputTokens: 8192,
        temperature: 0.1
      }
    });

    const models = ['gemini-3.5-flash-lite', 'gemini-3.5-flash', 'gemini-flash-latest'];
    let lastError = null;

    for (const model of models) {
      try {
        const result = await new Promise((resolve, reject) => {
          const geminiReq = https.request({
            hostname: 'generativelanguage.googleapis.com',
            path: `/v1beta/models/${model}:generateContent?key=${key}`,
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Content-Length': Buffer.byteLength(payload)
            }
          }, (geminiRes) => {
            let body = '';
            geminiRes.on('data', chunk => body += chunk);
            geminiRes.on('end', () => {
              try {
                const parsed = JSON.parse(body);
                if (parsed.error) {
                  return reject(new Error(parsed.error.message || `Error ${parsed.error.code}`));
                }
                const text = parsed?.candidates?.[0]?.content?.parts?.[0]?.text;
                if (!text) {
                  return reject(new Error('Empty Gemini response'));
                }
                const labels = JSON.parse(text);
                resolve(labels);
              } catch (e) {
                reject(e);
              }
            });
          });

          geminiReq.on('error', reject);
          geminiReq.write(payload);
          geminiReq.end();
        });

        if (Array.isArray(result) && result.length > 0) {
          return res.status(200).json({ labels: result, model: model });
        }
      } catch (err) {
        lastError = err;
      }
    }

    return res.status(500).json({ error: lastError ? lastError.message : 'Gemini detection failed' });
  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
};
