/**
 * CCM Accident Assistant — Get Claims API
 * GET /api/get-claims
 * Returns all claims ordered by most recent first
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
  res.setHeader('Access-Control-Allow-Methods', 'GET, PATCH, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();

  const client = getClient();

  // PATCH — update claim status
  if (req.method === 'PATCH') {
    const { id, status } = req.body || {};
    if (!id || !status) return res.status(400).json({ error: 'Missing id or status' });
    try {
      await client.execute({
        sql: 'UPDATE claims SET status=? WHERE id=?',
        args: [status, id]
      });
      return res.status(200).json({ success: true });
    } catch (err) {
      return res.status(500).json({ error: err.message });
    }
  }

  // GET — return all claims
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });

  try {
    // Ensure table exists
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
    // Ensure claim_number column exists
    try { await client.execute('ALTER TABLE claims ADD COLUMN claim_number INTEGER'); } catch(e) {}

    // Support filtering by driverID for returning driver lookup
    const query    = req.query || {};
    const driverID = query.driverID || null;
    const rawLimit = parseInt(query.limit) || 500;
    const limit    = isNaN(rawLimit) ? 500 : Math.min(rawLimit, 500);
    let result;
    const claimNumber = query.claimNumber || null;
    const refFilter   = query.ref || null;

    if(claimNumber){
      // Phase 2 entry lookup — by claim number (+ optional ref for validation)
      result = await client.execute({
        sql: 'SELECT id, claim_number, ref_number, phase, submitted_at, company, driver_name, driver_id, driver_email, driver_phone, accident_type, location, date_time, injured, vehicles, status, payload FROM claims WHERE claim_number=? ORDER BY submitted_at DESC LIMIT 1',
        args: [parseInt(claimNumber)]
      });
    } else if(driverID){
      result = await client.execute({
        sql: 'SELECT id, claim_number, ref_number, phase, submitted_at, company, driver_name, driver_id, driver_email, driver_phone, accident_type, location, date_time, injured, vehicles, status, payload FROM claims WHERE driver_id=? ORDER BY submitted_at DESC LIMIT ?',
        args: [driverID, limit]
      });
    } else {
      result = await client.execute({
        sql: 'SELECT id, claim_number, ref_number, phase, submitted_at, company, driver_name, driver_id, driver_email, driver_phone, accident_type, location, date_time, injured, vehicles, status FROM claims ORDER BY submitted_at DESC LIMIT ?',
        args: [limit]
      });
    }

    res.status(200).json({ claims: result.rows });

  } catch (err) {
    console.error('get-claims error:', err);
    res.status(500).json({ error: 'Database error', detail: err.message });
  }
}
