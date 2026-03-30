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

  const last7 = String(phone).replace(/\D/g, '').slice(-7);
  if (last7.length < 4) return res.status(400).json({ error: 'Invalid phone number' });

  const client = getClient();

  try {
    // Ensure table exists with all columns
    await client.execute(`
      CREATE TABLE IF NOT EXISTS claims (
        id            INTEGER PRIMARY KEY AUTOINCREMENT,
        claim_number  INTEGER,
        ref_number    TEXT,
        phase         INTEGER DEFAULT 1,
        submitted_at  TEXT,
        company       TEXT,
        driver_name   TEXT,
        driver_id     TEXT,
        driver_type   TEXT,
        driver_email  TEXT,
        driver_phone  TEXT,
        accident_type TEXT,
        location      TEXT,
        date_time     TEXT,
        injured       TEXT,
        vehicles      TEXT,
        status        TEXT DEFAULT 'New',
        payload       TEXT
      )
    `);

    // Try to add claim_number column if it doesn't exist yet
    try { await client.execute('ALTER TABLE claims ADD COLUMN claim_number INTEGER'); } catch(e) {}

    // Fetch recent Phase 1 claims and match phone in JS
    const result = await client.execute({
      sql: 'SELECT id, claim_number, ref_number, driver_email, driver_name, driver_phone FROM claims WHERE phase = 1 ORDER BY submitted_at DESC LIMIT 200',
      args: []
    });

    if (!result.rows || result.rows.length === 0) {
      return res.status(404).json({ error: 'No claims found. Please call CCM for assistance.' });
    }

    // Match last 7 digits
    const match = result.rows.find(row => {
      const stored = String(row.driver_phone || '').replace(/\D/g, '').slice(-7);
      return stored === last7;
    });

    if (!match) {
      return res.status(404).json({ error: 'No claim found for that phone number. Please call CCM for assistance.' });
    }

    const email = String(match.driver_email || '');
    if (!email.includes('@')) {
      return res.status(404).json({ error: 'No email address on file. Please call CCM for assistance.' });
    }

    return res.status(200).json({
      success:     true,
      claimNumber: match.claim_number || 'Pending',
      refNumber:   match.ref_number   || '',
      email:       email,
      driverName:  match.driver_name  || '',
    });

  } catch (err) {
    console.error('resend-numbers error:', err.message);
    return res.status(500).json({ error: 'Unable to process request. Please call CCM for assistance.', detail: err.message });
  }
}
