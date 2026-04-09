/**
 * CCM SafeDriver — Record Training Completion API
 * POST /api/complete-training
 * Body: { claimNum, driverID, driverName, score, accidentType, completedAt }
 * Stores completion record in Turso and links to original claim
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

  const { claimNum, driverID, driverName, score, accidentType, completedAt } = req.body || {};
  if (!claimNum) return res.status(400).json({ error: 'Missing claimNum' });

  const client = getClient();

  try {
    // Ensure training_completions table exists
    await client.execute(`
      CREATE TABLE IF NOT EXISTS training_completions (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        claim_number INTEGER,
        driver_id TEXT,
        driver_name TEXT,
        accident_type TEXT,
        score INTEGER,
        completed_at TEXT,
        created_at TEXT DEFAULT (datetime('now'))
      )
    `);

    // Insert completion record
    await client.execute({
      sql: `INSERT INTO training_completions
              (claim_number, driver_id, driver_name, accident_type, score, completed_at)
            VALUES (?, ?, ?, ?, ?, ?)`,
      args: [claimNum, driverID || '', driverName || '', accidentType || '', score || 0, completedAt || new Date().toISOString()]
    });

    // Update claim status to 'Training Complete' if still open
    await client.execute({
      sql: `UPDATE claims SET
              training_completed = 1,
              training_score = ?,
              training_completed_at = ?
            WHERE claim_number = ?`,
      args: [score || 0, completedAt || new Date().toISOString(), claimNum]
    }).catch(() => {}); // Column may not exist yet — non-fatal

    res.status(200).json({ success: true });
  } catch (err) {
    console.error('complete-training error:', err);
    res.status(500).json({ error: 'Database error', detail: err.message });
  }
}
