// CCM Accident Assistant | Built: 2026-06-08 10:00 AM EDT
/**
 * TTS Diagnostic — GET /api/tts-test
 * Open in browser to diagnose speak.js deployment and GOOGLE_API_KEY
 * DELETE THIS FILE before production.
 */
export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');

  const apiKey = process.env.GOOGLE_API_KEY;

  // Step 1 — check env var
  if (!apiKey) {
    return res.status(200).json({
      result: 'FAILED',
      reason: 'GOOGLE_API_KEY environment variable is not set in Vercel',
      fix: 'Go to Vercel → Project Settings → Environment Variables → add GOOGLE_API_KEY',
    });
  }

  // Step 2 — hit Google TTS with a minimal payload
  try {
    const r = await fetch(
      `https://texttospeech.googleapis.com/v1beta1/text:synthesize?key=${apiKey}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          input: { text: 'Test.' },
          voice: { languageCode: 'en-US', name: 'en-US-Chirp3-HD-Leda' },
          audioConfig: { audioEncoding: 'MP3' },
        }),
      }
    );

    if (r.status === 200) {
      const data = await r.json();
      return res.status(200).json({
        result: 'SUCCESS',
        message: 'Google TTS is working correctly',
        audioContentLength: data.audioContent ? data.audioContent.length : 0,
        googleApiKey: 'SET — starts with ' + apiKey.slice(0, 8) + '...',
      });
    }

    const errBody = await r.json().catch(() => ({}));
    return res.status(200).json({
      result: 'FAILED',
      reason: 'Google TTS returned HTTP ' + r.status,
      googleError: errBody?.error?.message || errBody?.error || 'Unknown',
      googleStatus: r.status,
      googleApiKey: 'SET — starts with ' + apiKey.slice(0, 8) + '...',
      fix: r.status === 400 ? 'API key may not have Text-to-Speech API enabled in Google Cloud Console'
         : r.status === 403 ? 'API key is invalid or Text-to-Speech API is not enabled for this key'
         : r.status === 404 ? 'Voice name not found — check voice name is valid Chirp 3 HD voice'
         : 'See googleError above',
    });

  } catch (err) {
    return res.status(200).json({
      result: 'FAILED',
      reason: 'fetch to Google threw an exception',
      error: err.message,
    });
  }
}
