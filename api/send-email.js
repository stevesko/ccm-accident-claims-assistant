/**
 * CCM Accident Assistant — Send Email API
 * POST /api/send-email
 * Sends HTML formatted email via Resend.com
 * Env var needed: RESEND_API_KEY
 */

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { to, subject, html, text } = req.body || {};
  if (!to || !subject || !html) {
    return res.status(400).json({ error: 'Missing to, subject, or html' });
  }

  try {
    const r = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer ' + process.env.RESEND_API_KEY,
      },
      body: JSON.stringify({
        from: 'CCM Accident Assistant <onboarding@resend.dev>',
        to: [to],
        subject,
        html,
        text: text || 'Please view this email in an HTML-capable email client.',
      }),
    });

    const data = await r.json();

    if (!r.ok) {
      console.error('Resend error:', data);
      return res.status(500).json({ error: 'Email failed', detail: data.message });
    }

    res.status(200).json({ success: true, id: data.id });

  } catch (err) {
    console.error('send-email error:', err);
    res.status(500).json({ error: 'Email failed', detail: err.message });
  }
}
