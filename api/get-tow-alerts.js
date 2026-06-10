// CCM Accident Assistant | Built: 2026-06-10 8:25 PM EST
/**
 * CCM Accident Assistant — Tow Alerts API
 * GET  /api/get-tow-alerts         — returns all unacknowledged tow alerts
 * PATCH /api/get-tow-alerts        — acknowledges an alert
 *
 * Body for PATCH: { id, acknowledgedBy }
 * Env vars: TURSO_DATABASE_URL, TURSO_AUTH_TOKEN
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

  // Ensure tow_alerts table exists
  await client.execute(`
    CREATE TABLE IF NOT EXISTS tow_alerts (
      id               INTEGER PRIMARY KEY AUTOINCREMENT,
      claim_number     TEXT,
      ref_number       TEXT,
      driver_name      TEXT,
      driver_phone     TEXT,
      company          TEXT,
      location         TEXT,
      date_time        TEXT,
      police_on_scene  TEXT,
      tow_needed       TEXT,
      truck_on_scene   TEXT,
      tow_type         TEXT,
      destination      TEXT,
      created_at       TEXT,
      status           TEXT DEFAULT 'new',
      acknowledged_by  TEXT,
      acknowledged_at  TEXT
    )
  `);

  // ── POST — create a new tow alert ───────────────────────────────────────
  if (req.method === 'POST') {
    const d = req.body || {};
    try {
      await client.execute({
        sql: `INSERT INTO tow_alerts
                (claim_number, ref_number, driver_name, driver_phone, company,
                 location, date_time, police_on_scene, tow_needed, truck_on_scene,
                 tow_type, destination, created_at, status)
              VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
        args: [
          d.claim_number   || '',
          d.ref_number     || '',
          d.driver_name    || '',
          d.driver_phone   || '',
          d.company        || '',
          d.location       || '',
          d.date_time      || '',
          d.police_on_scene|| '',
          d.tow_needed     || '',
          d.truck_on_scene || '',
          d.tow_type       || '',
          d.destination    || 'Not yet known',
          d.created_at     || new Date().toISOString(),
          'new',
        ]
      });
      return res.status(200).json({ success: true });
    } catch (err) {
      console.error('tow_alerts insert error:', err);
      return res.status(500).json({ error: 'Database error', detail: err.message });
    }
  }

  // ── PATCH — acknowledge an alert ────────────────────────────────────────
  if (req.method === 'PATCH') {
    const { id, acknowledgedBy } = req.body || {};
    if (!id) return res.status(400).json({ error: 'Missing id' });

    await client.execute({
      sql: `UPDATE tow_alerts SET
              status          = 'acknowledged',
              acknowledged_by = ?,
              acknowledged_at = ?
            WHERE id = ?`,
      args: [
        acknowledgedBy || 'unknown',
        new Date().toISOString(),
        id,
      ]
    });

    return res.status(200).json({ success: true });
  }

  // ── GET — return unacknowledged alerts ──────────────────────────────────
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });

  try {
    const result = await client.execute(
      `SELECT * FROM tow_alerts
       WHERE status = 'new'
       ORDER BY created_at DESC
       LIMIT 50`
    );

    return res.status(200).json({ alerts: result.rows });

  } catch (err) {
    console.error('get-tow-alerts error:', err);
    return res.status(500).json({ error: 'Database error', detail: err.message });
  }
}
