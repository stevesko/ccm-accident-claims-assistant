// CCM Accident Assistant | Built: 2026-06-03 11:30 AM EDT
/**
 * CCM Accident Assistant — Submit Claim API
 * POST /api/submit-claim
 * Body: { claim: {...} }
 *
 * Stores claim in Turso SQLite database.
 * Generates sequential claim number starting at 161000.
 * All structured answer fields are stored as discrete columns
 * for clean export/query without JSON parsing.
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
    // ── Base table ──────────────────────────────────────────────────────────
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

    // ── Structured columns — added safely if not already present ────────────
    // Identity / driver
    await addCol(client, 'claim_number',      'INTEGER');
    await addCol(client, 'driver_license');        // Q16: name + license number + state
    await addCol(client, 'driver_vehicle_type');   // Q17: company or personal vehicle
    await addCol(client, 'driver_vehicle');        // Q19: year/make/model/color/plate/fleet
    await addCol(client, 'driver_insurance');      // Q20: company + policy number
    await addCol(client, 'driver_relationship');   // family member relationship (if applicable)
    await addCol(client, 'driver_employee_name');  // assigned employee (family driver)
    await addCol(client, 'driver_employee_id');    // assigned employee ID (family driver)

    // Incident
    await addCol(client, 'weather');               // Q10
    await addCol(client, 'road_conditions');       // Q11
    await addCol(client, 'traffic');               // Q12
    await addCol(client, 'vehicle_status');        // Q14: moving/parked/stopped
    await addCol(client, 'direction');             // Q15: direction of travel
    await addCol(client, 'passengers');            // Q3: yes/no

    // Injuries
    await addCol(client, 'injured_who');           // Q5: who was injured
    await addCol(client, 'injury_details');        // Q6: injury description
    await addCol(client, 'life_threatening');      // Q7: yes/no

    // Other party
    await addCol(client, 'other_driver');          // Q21: other driver details
    await addCol(client, 'other_vehicle');         // Q22: other vehicle details
    await addCol(client, 'other_insurance');       // Q23: other driver insurance

    // Damage
    await addCol(client, 'vehicle_damage');        // Q24: damage to your vehicle
    await addCol(client, 'other_damage');          // Q26: damage to other vehicle(s)
    await addCol(client, 'property_damage');       // Q251: yes/no property damage
    await addCol(client, 'property_damage_desc');  // Q252: property damage description
    await addCol(client, 'airbags');               // Q27/Q28: airbag deployment

    // Tow
    await addCol(client, 'towed');                 // Q29: yes/no/unsure
    await addCol(client, 'tow_details');           // Q30: company + destination
    await addCol(client, 'other_towed');           // Q291: other vehicle towed
    await addCol(client, 'other_tow_details');     // Q301: other tow details

    // Law enforcement
    await addCol(client, 'police_report_filed');   // Q31: yes/no
    await addCol(client, 'police_details');        // Q32: dept/officer/report#
    await addCol(client, 'citation_issued');       // Q33: yes/no
    await addCol(client, 'citation_details');      // Q34: violation details

    // Witnesses
    await addCol(client, 'witnesses');             // Q35: yes/no
    await addCol(client, 'witness_details');       // Q36: name + contact

    // Narrative / follow-up
    await addCol(client, 'narrative');             // Q37: accident narrative
    await addCol(client, 'additional_info');       // Q38: anything else
    await addCol(client, 'contact_preference');    // Q39: preferred contact method

    // Photos
    await addCol(client, 'photos_json');           // JSON array of {name, category, blobUrl}

    // ── Get next claim number ────────────────────────────────────────────────
    const maxResult = await client.execute('SELECT MAX(claim_number) as max_claim FROM claims');
    const maxClaim  = maxResult.rows[0]?.max_claim;
    const claimNumber = maxClaim ? Number(maxClaim) + 1 : 161000;

    const ref         = claim.refNumber || ('CCM-' + Date.now());
    const phase       = claim.phase || 1;
    const submittedAt = new Date().toISOString();
    const identity    = claim.identity || {};
    const ans         = claim.ans || {};
    const photos      = claim.photoUrls || [];

    // ── Insert ───────────────────────────────────────────────────────────────
    await client.execute({
      sql: `INSERT INTO claims (
              claim_number, ref_number, phase, submitted_at,
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
              ?,?,?,?,
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
        claimNumber, ref, phase, submittedAt,
        // identity
        identity.company    || '',
        identity.name       || '',
        identity.driverID   || '',
        identity.driverType || 'employee',
        identity.email      || '',
        identity.phone      || '',
        // incident overview
        ans[13] || '',   // accident_type
        ans[8]  || '',   // location
        ans[9]  || '',   // date_time
        ans[4]  || '',   // injured
        ans[2]  || '',   // vehicles
        // driver details
        ans[16] || '',   // driver_license
        ans[17] || '',   // driver_vehicle_type
        ans[19] || '',   // driver_vehicle
        ans[20] || '',   // driver_insurance
        identity.relationship  || '',
        identity.employeeName  || '',
        identity.employeeID    || '',
        // conditions
        ans[10] || '',   // weather
        ans[11] || '',   // road_conditions
        ans[12] || '',   // traffic
        ans[14] || '',   // vehicle_status
        ans[15] || '',   // direction
        ans[3]  || '',   // passengers
        // injuries
        ans[5]  || '',   // injured_who
        ans[6]  || '',   // injury_details
        ans[7]  || '',   // life_threatening
        // other party
        ans[21] || '',   // other_driver
        ans[22] || '',   // other_vehicle
        ans[23] || '',   // other_insurance
        // damage
        ans[24] || '',   // vehicle_damage
        ans[26] || '',   // other_damage
        ans[251]|| '',   // property_damage
        ans[252]|| '',   // property_damage_desc
        ans[28] || '',   // airbags (Q27 is airbag yes/no, Q28 is which bags)
        // tow
        ans[29] || '',   // towed
        ans[30] || '',   // tow_details
        ans[291]|| '',   // other_towed
        ans[301]|| '',   // other_tow_details
        // law enforcement
        ans[31] || '',   // police_report_filed
        ans[32] || '',   // police_details
        ans[33] || '',   // citation_issued
        ans[34] || '',   // citation_details
        // witnesses
        ans[35] || '',   // witnesses
        ans[36] || '',   // witness_details
        // narrative / follow-up
        ans[37] || '',   // narrative
        ans[38] || '',   // additional_info
        ans[39] || '',   // contact_preference
        // photos + meta
        JSON.stringify(photos),
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
