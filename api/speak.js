/**
 * CCM Accident Assistant — TTS Proxy API
 * POST /api/speak
 * Body: { text: string }
 *
 * Proxies to Google Cloud TTS (Chirp 3 HD / Leda voice).
 * Keeps GOOGLE_API_KEY server-side — never exposed in client HTML.
 * Env var needed: GOOGLE_API_KEY
 */

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { text } = req.body || {};
  if (!text) return res.status(400).json({ error: 'Missing text' });

  const apiKey = process.env.GOOGLE_API_KEY;
  if (!apiKey) return res.status(500).json({ error: 'GOOGLE_API_KEY not configured' });

  try {
    const r = await fetch(
      'https://texttospeech.googleapis.com/v1beta1/text:synthesize?key=' + apiKey,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          input: { text: text.slice(0, 5000) },
          voice: {
            languageCode: 'en-US',
            name: 'en-US-chirp3-hd-leda',
          },
          audioConfig: {
            audioEncoding: 'MP3',
          },
        }),
      }
    );

    const data = await r.json();

    if (!r.ok) {
      console.error('Google TTS error:', data);
      return res.status(500).json({
        error: 'TTS failed',
        detail: (data.error && data.error.message) || r.status,
      });
    }

    if (!data.audioContent) {
      return res.status(500).json({ error: 'No audio in TTS response' });
    }

    res.status(200).json({ audioContent: data.audioContent });

  } catch (err) {
    console.error('speak proxy error:', err);
    res.status(500).json({ error: 'TTS proxy failed', detail: err.message });
  }
}
