// CCM Accident Assistant | Built: 2026-06-08 10:53 AM EDT
/**
 * CCM Accident Assistant — SendGrid Diagnostic Endpoint
 * GET /api/test-email
 *
 * Sends a minimal test email via SendGrid and returns the full response.
 * Use this to diagnose SendGrid failures without needing Vercel logs.
 *
 * Usage: open in browser → https://ccm-accident-claims-assistant.vercel.app/api/test-email
 * DELETE THIS FILE before going to production.
 */

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');

  const apiKey    = process.env.SENDGRID_EMAIL_API;
  const fromEmail = process.env.SENDGRID_FROM_EMAIL;

  const envCheck = {
    SENDGRID_EMAIL_API:  apiKey    ? 'SET — starts with ' + apiKey.slice(0,8)+'...' : 'MISSING',
    SENDGRID_FROM_EMAIL: fromEmail ? fromEmail : 'MISSING',
  };

  if (!apiKey || !fromEmail) {
    return res.status(200).json({
      result: 'FAILED — missing env vars',
      envCheck,
      fix: 'Go to Vercel → Project Settings → Environment Variables and add the missing variable, then redeploy.',
    });
  }

  const payload = {
    personalizations: [{ to: [{ email: fromEmail }] }],
    from:    { email: fromEmail, name: 'CCM Test' },
    subject: 'CCM SendGrid Diagnostic Test — ' + new Date().toISOString(),
    content: [
      { type: 'text/plain', value: 'This is a diagnostic test from the CCM Accident Assistant.' },
      { type: 'text/html',  value: '<p>This is a <strong>diagnostic test</strong> from the CCM Accident Assistant.</p>' },
    ],
  };

  try {
    const r = await fetch('https://api.sendgrid.com/v3/mail/send', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer ' + apiKey,
      },
      body: JSON.stringify(payload),
    });

    if (r.status === 202) {
      return res.status(200).json({
        result:  'SUCCESS — SendGrid accepted the email (202)',
        from:    fromEmail,
        to:      fromEmail,
        envCheck,
        note:    'Check your inbox at ' + fromEmail + '. If email arrived, SendGrid is fully working.',
      });
    }

    let errorBody = {};
    try { errorBody = await r.json(); } catch(e) {}

    return res.status(200).json({
      result:         'FAILED — SendGrid returned HTTP ' + r.status,
      httpStatus:     r.status,
      sendgridErrors: errorBody.errors || errorBody,
      envCheck,
      fix: r.status === 403
        ? 'Sender not verified. Go to SendGrid → Settings → Sender Authentication and verify: ' + fromEmail
        : r.status === 401
        ? 'API key invalid or expired. Check SENDGRID_EMAIL_API in Vercel environment variables.'
        : r.status === 400
        ? 'Bad request — see sendgridErrors above for the specific field causing the problem.'
        : 'Unexpected error — see sendgridErrors above.',
    });

  } catch (err) {
    return res.status(200).json({
      result:  'FAILED — fetch threw an exception',
      error:   err.message,
      envCheck,
    });
  }
}
