// CCM Accident Assistant | Built: 2026-04-27 08:42 AM EDT
/**
 * CCM Accident Assistant — Submit Claim API
 * POST /api/submit-claim
 * Body: { claim: {...} }
 *
 * Stores claim in Turso SQLite database.
 * Generates sequential claim number starting at 161000.
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

  const { claim } = req.body || {};
  if (!claim) return res.status(400).json({ error: 'Missing claim data' });

  const client = getClient();

  try {
    // Create base table if it doesn't exist
    await client.execute(`
      CREATE TABLE IF NOT EXISTS claims (
        id            INTEGER PRIMARY KEY AUTOINCREMENT,
        ref_number    TEXT NOT NULL,
        phase         INTEGER DEFAULT 1,
        submitted_at  TEXT NOT NULL,
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

    // Add claim_number column if it doesn't exist (ALTER TABLE is safe to run repeatedly)
    try {
      await client.execute('ALTER TABLE claims ADD COLUMN claim_number INTEGER');
    } catch(e) {
      // Column already exists — that's fine
    }

    // Get next claim number — start at 161000
    const maxResult = await client.execute(
      'SELECT MAX(claim_number) as max_claim FROM claims'
    );
    const maxClaim = maxResult.rows[0]?.max_claim;
    const claimNumber = maxClaim ? Number(maxClaim) + 1 : 161000;

    const ref         = claim.refNumber || ('CCM-' + Date.now());
    const phase       = claim.phase || 1;
    const submittedAt = new Date().toISOString();
    const identity    = claim.identity || {};
    const ans         = claim.ans || {};

    await client.execute({
      sql: `INSERT INTO claims
              (claim_number, ref_number, phase, submitted_at, company, driver_name,
               driver_id, driver_type, driver_email, driver_phone, accident_type,
               location, date_time, injured, vehicles, status, payload)
            VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
      args: [
        claimNumber,
        ref,
        phase,
        submittedAt,
        identity.company   || ans[0]  || '',
        identity.name      || '',
        identity.driverID  || '',
        identity.driverType|| 'employee',
        identity.email     || '',
        identity.phone     || '',
        ans[13] || '',
        ans[8]  || '',
        ans[9]  || '',
        ans[4]  || 'No',
        ans[2]  || '',
        'New',
        JSON.stringify(claim),
      ]
    });

    res.status(200).json({ success: true, ref, claimNumber });

  } catch (err) {
    console.error('submit-claim error:', err);
    res.status(500).json({ error: 'Database error', detail: err.message });
  }
}
