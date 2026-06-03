// CCM Accident Assistant | Built: 2026-06-03 11:30 AM EDT
/**
 * CCM Accident Assistant — Update Claim API
 * POST /api/update-claim
 * Body: { claim: { claimNum, refNumber, phase:2, identity, ans, ... } }
 *
 * Updates existing Phase 1 record to Phase 2 with all structured columns.
 * If no matching record found, inserts a new one.
 * All answer fields stored as discrete columns for clean export/query.
 */

import { createClient } from '@libsql/client';

function getClient() {
  return createClient({
    url:       process.env.TURSO_DATABASE_URL,
    authToken: process.env.TURSO_AUTH_TOKEN,
  });
}

// Add a column only if it doesn't already exist — safe to call on every request
async function addCol(client, col, type = 'TEXT') {
  try {
    await client.execute(`ALTER TABLE claims ADD COLUMN ${col} ${type}`);
  } catch(e) { /* already exists — fine */ }
}

// Ensure all structured columns exist (mirrors submit-claim.js)
async function ensureColumns(client) {
  await addCol(client, 'claim_number',      'INTEGER');
  await addCol(client, 'driver_license');
  await addCol(client, 'driver_vehicle_type');
  await addCol(client, 'driver_vehicle');
  await addCol(client, 'driver_insurance');
  await addCol(client, 'driver_relationship');
  await addCol(client, 'driver_employee_name');
  await addCol(client, 'driver_employee_id');
  await addCol(client, 'weather');
  await addCol(client, 'road_conditions');
  await addCol(client, 'traffic');
  await addCol(client, 'vehicle_status');
  await addCol(client, 'direction');
  await addCol(client, 'passengers');
  await addCol(client, 'injured_who');
  await addCol(client, 'injury_details');
  await addCol(client, 'life_threatening');
  await addCol(client, 'other_driver');
  await addCol(client, 'other_vehicle');
  await addCol(client, 'other_insurance');
  await addCol(client, 'vehicle_damage');
  await addCol(client, 'other_damage');
  await addCol(client, 'property_damage');
  await addCol(client, 'property_damage_desc');
  await addCol(client, 'airbags');
  await addCol(client, 'towed');
  await addCol(client, 'tow_details');
  await addCol(client, 'other_towed');
  await addCol(client, 'other_tow_details');
  await addCol(client, 'police_report_filed');
  await addCol(client, 'police_details');
  await addCol(client, 'citation_issued');
  await addCol(client, 'citation_details');
  await addCol(client, 'witnesses');
  await addCol(client, 'witness_details');
  await addCol(client, 'narrative');
  await addCol(client, 'additional_info');
  await addCol(client, 'contact_preference');
  await addCol(client, 'photos_json');
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
    const identity  = claim.identity || {};
    const ans       = claim.ans || {};
    const refNum    = claim.refNumber || '';
    const claimNum  = claim.claimNum  || '';
    const updatedAt = new Date().toISOString();
    const photos    = claim.photoUrls || [];

    // Ensure base table and all structured columns exist
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
    await ensureColumns(client);

    // ── Try to update existing Phase 1 record ──────────────────────────────
    let updated = false;

    if (refNum || claimNum) {
      const result = await client.execute({
        sql: `UPDATE claims SET
                phase                = 2,
                submitted_at         = ?,
                status               = CASE WHEN status = 'New' THEN 'In Progress' ELSE status END,
                accident_type        = ?,
                location             = ?,
                date_time            = ?,
                injured              = ?,
                vehicles             = ?,
                driver_license       = ?,
                driver_vehicle_type  = ?,
                driver_vehicle       = ?,
                driver_insurance     = ?,
                driver_relationship  = ?,
                driver_employee_name = ?,
                driver_employee_id   = ?,
                weather              = ?,
                road_conditions      = ?,
                traffic              = ?,
                vehicle_status       = ?,
                direction            = ?,
                passengers           = ?,
                injured_who          = ?,
                injury_details       = ?,
                life_threatening     = ?,
                other_driver         = ?,
                other_vehicle        = ?,
                other_insurance      = ?,
                vehicle_damage       = ?,
                other_damage         = ?,
                property_damage      = ?,
                property_damage_desc = ?,
                airbags              = ?,
                towed                = ?,
                tow_details          = ?,
                other_towed          = ?,
                other_tow_details    = ?,
                police_report_filed  = ?,
                police_details       = ?,
                citation_issued      = ?,
                citation_details     = ?,
                witnesses            = ?,
                witness_details      = ?,
                narrative            = ?,
                additional_info      = ?,
                contact_preference   = ?,
                photos_json          = ?,
                payload              = ?
              WHERE ref_number = ? OR claim_number = ?`,
        args: [
          updatedAt,
          ans[13] || '',   // accident_type
          ans[8]  || '',   // location
          ans[9]  || '',   // date_time
          ans[4]  || '',   // injured
          ans[2]  || '',   // vehicles
          ans[16] || '',   // driver_license
          ans[17] || '',   // driver_vehicle_type
          ans[19] || '',   // driver_vehicle
          ans[20] || '',   // driver_insurance
          identity.relationship  || '',
          identity.employeeName  || '',
          identity.employeeID    || '',
          ans[10] || '',   // weather
          ans[11] || '',   // road_conditions
          ans[12] || '',   // traffic
          ans[14] || '',   // vehicle_status
          ans[15] || '',   // direction
          ans[3]  || '',   // passengers
          ans[5]  || '',   // injured_who
          ans[6]  || '',   // injury_details
          ans[7]  || '',   // life_threatening
          ans[21] || '',   // other_driver
          ans[22] || '',   // other_vehicle
          ans[23] || '',   // other_insurance
          ans[24] || '',   // vehicle_damage
          ans[26] || '',   // other_damage
          ans[251]|| '',   // property_damage
          ans[252]|| '',   // property_damage_desc
          ans[28] || '',   // airbags
          ans[29] || '',   // towed
          ans[30] || '',   // tow_details
          ans[291]|| '',   // other_towed
          ans[301]|| '',   // other_tow_details
          ans[31] || '',   // police_report_filed
          ans[32] || '',   // police_details
          ans[33] || '',   // citation_issued
          ans[34] || '',   // citation_details
          ans[35] || '',   // witnesses
          ans[36] || '',   // witness_details
          ans[37] || '',   // narrative
          ans[38] || '',   // additional_info
          ans[39] || '',   // contact_preference
          JSON.stringify(photos),
          JSON.stringify(claim),
          refNum,
          claimNum || 0,
        ]
      });

      updated = result.rowsAffected > 0;
    }

    // ── If no record found — insert as new Phase 2 record ─────────────────
    if (!updated) {
      await client.execute({
        sql: `INSERT INTO claims (
                ref_number, phase, submitted_at,
                company, driver_name, driver_id, driver_type, driver_email, driver_phone,
                accident_type, location, date_time, injured, vehicles,
                driver_license, driver_vehicle_type, driver_vehicle, driver_insurance,
                driver_relationship, driver_employee_name, driver_employee_id,
                weather, road_conditions, traffic, vehicle_status, direction, passengers,
                injured_who, injury_details, life_threatening,
                other_driver, other_vehicle, other_insurance,
                vehicle_damage, other_damage, property_damage, property_damage_desc, airbags,
                towed, tow_details, other_towed, other_tow_details,
                police_report_filed, police_details, citation_issued, citation_details,
                witnesses, witness_details,
                narrative, additional_info, contact_preference,
                photos_json, status, payload
              ) VALUES (
                ?,?,?,
                ?,?,?,?,?,?,
                ?,?,?,?,?,
                ?,?,?,?,
                ?,?,?,
                ?,?,?,?,?,?,
                ?,?,?,
                ?,?,?,
                ?,?,?,?,?,
                ?,?,?,?,
                ?,?,?,?,
                ?,?,
                ?,?,?,
                ?,?,?
              )`,
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
          ans[4]  || '',
          ans[2]  || '',
          ans[16] || '',
          ans[17] || '',
          ans[19] || '',
          ans[20] || '',
          identity.relationship  || '',
          identity.employeeName  || '',
          identity.employeeID    || '',
          ans[10] || '',
          ans[11] || '',
          ans[12] || '',
          ans[14] || '',
          ans[15] || '',
          ans[3]  || '',
          ans[5]  || '',
          ans[6]  || '',
          ans[7]  || '',
          ans[21] || '',
          ans[22] || '',
          ans[23] || '',
          ans[24] || '',
          ans[26] || '',
          ans[251]|| '',
          ans[252]|| '',
          ans[28] || '',
          ans[29] || '',
          ans[30] || '',
          ans[291]|| '',
          ans[301]|| '',
          ans[31] || '',
          ans[32] || '',
          ans[33] || '',
          ans[34] || '',
          ans[35] || '',
          ans[36] || '',
          ans[37] || '',
          ans[38] || '',
          ans[39] || '',
          JSON.stringify(photos),
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
