// CCM Accident Assistant | Built: 2026-04-27 08:55 AM EDT
/**
 * CCM Accident Assistant — TTS Proxy
 * POST /api/speak — proxies to Google Cloud TTS
 * Env var: GOOGLE_API_KEY
 */

import https from 'https';

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

  const payload = JSON.stringify({
    input: { text: text.slice(0, 5000) },
    voice: { languageCode: 'en-US', name: 'en-US-chirp3-hd-leda' },
    audioConfig: { audioEncoding: 'MP3' },
  });

  return new Promise((resolve) => {
    const options = {
      hostname: 'texttospeech.googleapis.com',
      path: '/v1beta1/text:synthesize?key=' + apiKey,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(payload),
      },
    };

    const req2 = https.request(options, (r2) => {
      let body = '';
      r2.on('data', chunk => body += chunk);
      r2.on('end', () => {
        try {
          const data = JSON.parse(body);
          if (r2.statusCode !== 200) {
            console.error('Google TTS error:', r2.statusCode, body);
            res.status(500).json({ error: 'TTS failed', detail: data?.error?.message || r2.statusCode });
            return resolve();
          }
          if (!data.audioContent) {
            res.status(500).json({ error: 'No audio in TTS response' });
            return resolve();
          }
          res.status(200).json({ audioContent: data.audioContent });
          resolve();
        } catch (e) {
          res.status(500).json({ error: 'TTS parse error', detail: e.message });
          resolve();
        }
      });
    });

    req2.on('error', (e) => {
      console.error('TTS request error:', e);
      res.status(500).json({ error: 'TTS request failed', detail: e.message });
      resolve();
    });

    req2.write(payload);
    req2.end();
  });
}
