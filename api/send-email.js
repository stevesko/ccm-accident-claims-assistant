/**
 * CCM Accident Assistant — Send Email API
 * POST /api/send-email
 * Sends HTML formatted email via SendGrid
 * Env var needed: SENDGRID_EMAIL_API
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

  const apiKey = process.env.SENDGRID_EMAIL_API;
  if (!apiKey) return res.status(500).json({ error: 'SENDGRID_EMAIL_API not configured' });

  try {
    const r = await fetch('https://api.sendgrid.com/v3/mail/send', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer ' + apiKey,
      },
      body: JSON.stringify({
        personalizations: [{ to: [{ email: to }] }],
        from: { email: 'sskoletsky@gmail.com', name: 'CCM Accident Assistant' },
        reply_to: { email: 'sskoletsky@ccmservices.com', name: 'CCM Claims' },
        subject,
        content: [
          { type: 'text/plain', value: text || 'Please view this email in an HTML-capable client.' },
          { type: 'text/html',  value: html },
        ],
      }),
    });

    // SendGrid returns 202 Accepted on success with no body
    if (r.status === 202) {
      return res.status(200).json({ success: true });
    }

    const data = await r.json().catch(() => ({}));
    console.error('SendGrid error:', data);
    return res.status(500).json({ error: 'Email failed', detail: JSON.stringify(data.errors || data) });

  } catch (err) {
    console.error('send-email error:', err);
    res.status(500).json({ error: 'Email failed', detail: err.message });
  }
}
