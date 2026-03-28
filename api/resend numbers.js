/**
 * CCM Accident Assistant — Resend Numbers API
 * POST /api/resend-numbers
 * Body: { phone: "2155551234" }
 */

import { createClient } from '@libsql/client';

function getClient() {
  return createClient({
    url:       process.env.TURSO_DATABASE_URL,
    authToken: process.env.TURSO_AUTH_TOKEN,
  });
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { phone } = req.body || {};
  if (!phone) return res.status(400).json({ error: 'Missing phone number' });

  // Extract last 7 digits for matching
  const last7 = String(phone).replace(/\D/g, '').slice(-7);
  if (last7.length < 4) return res.status(400).json({ error: 'Invalid phone number' });

  const client = getClient();

  try {
    // Pull recent Phase 1 claims and match by phone in JS
    // Avoids complex SQL REPLACE chains that hit length limits
    const result = await client.execute({
      sql: 'SELECT claim_number, ref_number, driver_email, driver_name, driver_phone FROM claims WHERE phase = 1 ORDER BY submitted_at DESC LIMIT 100',
      args: []
    });

    if (!result.rows || result.rows.length === 0) {
      return res.status(404).json({ error: 'No claims found. Please call CCM for assistance.' });
    }

    // Match by last 7 digits of stored phone
    const match = result.rows.find(row => {
      const stored = String(row.driver_phone || '').replace(/\D/g, '').slice(-7);
      return stored === last7;
    });

    if (!match) {
      return res.status(404).json({ error: 'No claim found for that phone number. Please call CCM for assistance.' });
    }

    const email = match.driver_email;
    if (!email || !email.includes('@')) {
      return res.status(404).json({ error: 'No email address on file. Please call CCM for assistance.' });
    }

    res.status(200).json({
      success:     true,
      claimNumber: match.claim_number,
      refNumber:   match.ref_number,
      email:       email,
      driverName:  match.driver_name,
    });

  } catch (err) {
    console.error('resend-numbers error:', err);
    res.status(500).json({ error: 'Database error', detail: err.message });
  }
}
