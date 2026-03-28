/**
 * CCM Accident Assistant — Resend Numbers API
 * POST /api/resend-numbers
 * Body: { phone: "2155551234" }
 *
 * Looks up claim by phone number, sends email with claim and reference numbers.
 * TODO: Replace emailjs send with Twilio SMS when ready for production.
 */

import { createClient } from '@libsql/client';

function getClient() {
  return createClient({
    url:       process.env.TURSO_DATABASE_URL,
    authToken: process.env.TURSO_AUTH_TOKEN,
  });
}

function normalizePhone(phone) {
  return String(phone || '').replace(/\D/g, '').slice(-10);
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { phone } = req.body || {};
  if (!phone) return res.status(400).json({ error: 'Missing phone number' });

  const client = getClient();

  try {
    // Search by last 10 digits of phone — most recent Phase 1 claim first
    const normalized = normalizePhone(phone);
    const result = await client.execute({
      sql: `SELECT claim_number, ref_number, driver_email, driver_name, driver_phone
            FROM claims
            WHERE REPLACE(REPLACE(REPLACE(REPLACE(driver_phone,'-',''),'(',''),')',''),' ','') LIKE ?
            AND phase = 1
            ORDER BY submitted_at DESC
            LIMIT 1`,
      args: ['%' + normalized.slice(-7)]  // match last 7 digits to handle area code variations
    });

    if (!result.rows || result.rows.length === 0) {
      return res.status(404).json({ error: 'No claim found for that phone number.' });
    }

    const claim = result.rows[0];
    const email = claim.driver_email;

    if (!email || !email.includes('@')) {
      return res.status(404).json({ error: 'No email address on file for this claim. Please call CCM for assistance.' });
    }

    // For now return the data to the app which will send via EmailJS
    // TODO: Replace with Twilio SMS when ready
    res.status(200).json({
      success: true,
      claimNumber: claim.claim_number,
      refNumber:   claim.ref_number,
      email:       email,
      driverName:  claim.driver_name,
    });

  } catch (err) {
    console.error('resend-numbers error:', err);
    res.status(500).json({ error: 'Database error', detail: err.message });
  }
}
