/**
 * CCM Accident Assistant — Update Claim API
 * POST /api/update-claim
 * Body: { claim: { claimNum, refNumber, phase:2, identity, ans, ... } }
 *
 * Updates existing Phase 1 record to Phase 2 with full payload.
 * If no matching record found, inserts a new one.
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
    const identity    = claim.identity || {};
    const ans         = claim.ans || {};
    const refNum      = claim.refNumber || '';
    const claimNum    = claim.claimNum  || '';
    const updatedAt   = new Date().toISOString();

    // Try to update existing Phase 1 record by ref_number or claim_number
    let updated = false;

    if (refNum || claimNum) {
      const result = await client.execute({
        sql: `UPDATE claims SET
                phase        = 2,
                submitted_at = ?,
                status       = CASE WHEN status = 'New' THEN 'In Progress' ELSE status END,
                accident_type = ?,
                location     = ?,
                date_time    = ?,
                injured      = ?,
                vehicles     = ?,
                payload      = ?
              WHERE ref_number = ? OR claim_number = ?`,
        args: [
          updatedAt,
          ans[13] || '',
          ans[8]  || '',
          ans[9]  || '',
          ans[4]  || 'No',
          ans[2]  || '',
          JSON.stringify(claim),
          refNum,
          claimNum || 0,
        ]
      });

      updated = result.rowsAffected > 0;
    }

    // If no record found — insert as new Phase 2 record
    if (!updated) {
      await client.execute(`
        CREATE TABLE IF NOT EXISTS claims (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          ref_number TEXT, phase INTEGER, submitted_at TEXT,
          company TEXT, driver_name TEXT, driver_id TEXT,
          driver_type TEXT, driver_email TEXT, driver_phone TEXT,
          accident_type TEXT, location TEXT, date_time TEXT,
          injured TEXT, vehicles TEXT, status TEXT DEFAULT 'New', payload TEXT
        )
      `);
      try { await client.execute('ALTER TABLE claims ADD COLUMN claim_number INTEGER'); } catch(e) {}

      await client.execute({
        sql: `INSERT INTO claims
                (ref_number, phase, submitted_at, company, driver_name, driver_id,
                 driver_type, driver_email, driver_phone, accident_type, location,
                 date_time, injured, vehicles, status, payload)
              VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
        args: [
          refNum, 2, updatedAt,
          identity.company    || '',
          identity.name       || '',
          identity.driverID   || '',
          identity.driverType || 'employee',
          identity.email      || '',
          identity.phone      || '',
          ans[13] || '',
          ans[8]  || '',
          ans[9]  || '',
          ans[4]  || 'No',
          ans[2]  || '',
          'In Progress',
          JSON.stringify(claim),
        ]
      });
    }

    res.status(200).json({ success: true, updated });

  } catch (err) {
    console.error('update-claim error:', err);
    res.status(500).json({ error: 'Database error', detail: err.message });
  }
}
