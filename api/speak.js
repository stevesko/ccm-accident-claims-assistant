// CCM Accident Assistant | Built: 2026-06-08 10:00 AM EDT
/**
 * CCM Accident Assistant — Google Cloud TTS Proxy
 * POST /api/speak
 * Body: { text: string }
 * Returns: { audioContent: string }  ← base64 MP3, same format as Google TTS response
 *
 * Keeps GOOGLE_API_KEY server-side — never exposed to the browser.
 * Voice: Google Cloud Chirp 3 HD — en-US-Chirp3-HD-Callirrhoe
 * Env var required: GOOGLE_API_KEY
 */

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { text } = req.body || {};
  if (!text || typeof text !== 'string') {
    return res.status(400).json({ error: 'Missing or invalid text' });
  }

  const apiKey = process.env.GOOGLE_API_KEY;
  if (!apiKey) {
    return res.status(500).json({ error: 'GOOGLE_API_KEY not configured' });
  }

  // Trim to 5000 chars — well within Google's 5000 byte limit for standard input
  const safeText = text.slice(0, 5000).trim();
  if (!safeText) {
    return res.status(400).json({ error: 'Text is empty after trimming' });
  }

  try {
    // Chirp 3 HD uses the v1beta1 endpoint
    const googleUrl = `https://texttospeech.googleapis.com/v1beta1/text:synthesize?key=${apiKey}`;

    const payload = {
      input: { text: safeText },
      voice: {
        languageCode: 'en-US',
        name: 'en-US-Chirp3-HD-Callirrhoe',
      },
      audioConfig: {
        audioEncoding: 'MP3',
        speakingRate: 0.95,   // Slightly slower — clearer for accident scene use
        pitch: 0.0,
      },
    };

    const r = await fetch(googleUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });

    if (!r.ok) {
      const errBody = await r.json().catch(() => ({}));
      const detail  = errBody?.error?.message || errBody?.error || r.status;
      console.error('Google TTS error:', r.status, JSON.stringify(errBody));
      return res.status(r.status).json({
        error:  'Google TTS error',
        detail: String(detail),
        status: r.status,
      });
    }

    const data = await r.json();

    if (!data.audioContent) {
      console.error('Google TTS returned no audioContent:', JSON.stringify(data));
      return res.status(500).json({ error: 'No audio in Google TTS response' });
    }

    // Return in the same shape the client expects
    return res.status(200).json({ audioContent: data.audioContent });

  } catch (err) {
    console.error('speak.js error:', err);
    return res.status(500).json({ error: 'TTS proxy error', detail: err.message });
  }
}
