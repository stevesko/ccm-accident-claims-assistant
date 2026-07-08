/**
 * CCM Accident Assistant — Export Claims API (server-to-server)
 * GET /api/export-claims?since_id=1234&limit=100
 * Header required: X-API-Key: <CLAIMS_EXPORT_KEY>
 *
 * Read-only feed for the internal SQL Server import job on ZEUS.
 * Deliberately different from get-claims:
 *   - No CORS headers (this endpoint is never called from a browser)
 *   - Requires a secret key, compared in constant time
 *   - Incremental: returns only claims with id > since_id, oldest first
 *   - Never leaks internal error details to the caller
 *
 * Env vars: TURSO_DATABASE_URL, TURSO_AUTH_TOKEN, CLAIMS_EXPORT_KEY
 */

import { createClient } from '@libsql/client';
import { timingSafeEqual } from 'crypto';

function keyIsValid(req) {
  const provided = Buffer.from(String(req.headers['x-api-key'] || ''));
  const expected = Buffer.from(String(process.env.CLAIMS_EXPORT_KEY || ''));
  if (expected.length === 0) return false;           // key not configured → nobody gets in
  if (provided.length !== expected.length) return false;
  return timingSafeEqual(provided, expected);
}

export default async function handler(req, res) {
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });
  if (!keyIsValid(req))     return res.status(401).json({ error: 'Unauthorized' });

  const sinceId = Number.parseInt(req.query.since_id, 10) || 0;
  const limit   = Math.min(Math.max(Number.parseInt(req.query.limit, 10) || 100, 1), 500);

  const client = createClient({
    url:       process.env.TURSO_DATABASE_URL,
    authToken: process.env.TURSO_AUTH_TOKEN,
  });

  try {
    const result = await client.execute({
      sql: `SELECT id, ref_number, phase, submitted_at, company, driver_name,
                   driver_id, driver_type, driver_email, driver_phone,
                   accident_type, location, date_time, injured, vehicles,
                   status, payload
              FROM claims
             WHERE id > ?
             ORDER BY id ASC
             LIMIT ?`,
      args: [sinceId, limit],
    });

    const claims = result.rows;
    const maxId  = claims.length ? Number(claims[claims.length - 1].id) : sinceId;

    return res.status(200).json({ claims, count: claims.length, maxId });

  } catch (err) {
    console.error('export-claims error:', err);
    return res.status(500).json({ error: 'Database error' });
  }
}
