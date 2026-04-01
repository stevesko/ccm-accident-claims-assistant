/**
 * CCM Accident Assistant — Send Email API
 * POST /api/send-email
 * Sends HTML formatted email via nodemailer using Gmail SMTP
 * Env vars needed: EMAIL_USER, EMAIL_PASS (Gmail app password)
 */

import nodemailer from 'nodemailer';

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
    const transporter = nodemailer.createTransporter({
      service: 'gmail',
      auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS,
      },
    });

    await transporter.sendMail({
      from: `"CCM Accident Assistant" <${process.env.EMAIL_USER}>`,
      to,
      subject,
      html,
      text: text || 'Please view this email in an HTML-capable email client.',
    });

    res.status(200).json({ success: true });

  } catch (err) {
    console.error('send-email error:', err);
    res.status(500).json({ error: 'Email failed', detail: err.message });
  }
}
