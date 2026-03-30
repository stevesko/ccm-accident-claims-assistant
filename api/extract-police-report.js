/**
 * CCM Accident Assistant — Extract Police Report API
 * POST /api/extract-police-report
 * Body: { image: base64string, mediaType: 'image/jpeg'|'application/pdf', claimRef: string }
 *
 * Sends the police report image/PDF to Claude API for structured extraction.
 * Returns JSON with all key fields from the report.
 */

import { createClient } from '@libsql/client';

function getDB() {
  return createClient({
    url:       process.env.TURSO_DATABASE_URL,
    authToken: process.env.TURSO_AUTH_TOKEN,
  });
}

const EXTRACTION_PROMPT = `You are extracting data from a police crash/accident report.
Extract ALL of the following fields and return ONLY a valid JSON object — no markdown, no explanation, no code fences.
If a field is not found or illegible, use null.

{
  "case_number": "string",
  "crash_date": "string (MM/DD/YYYY)",
  "crash_time": "string (HH:MM, 24hr)",
  "crash_location": "string (street/highway)",
  "municipality": "string",
  "county": "string",
  "state": "string",

  "driver1_first_name": "string",
  "driver1_last_name": "string",
  "driver1_address": "string",
  "driver1_city": "string",
  "driver1_state": "string",
  "driver1_zip": "string",
  "driver1_dob": "string (MM/DD/YYYY)",
  "driver1_license_number": "string",
  "driver1_license_state": "string",
  "driver1_license_expires": "string",
  "driver1_phone": "string",
  "driver1_sex": "string",

  "driver2_first_name": "string",
  "driver2_last_name": "string",
  "driver2_address": "string",
  "driver2_city": "string",
  "driver2_state": "string",
  "driver2_zip": "string",
  "driver2_dob": "string (MM/DD/YYYY)",
  "driver2_license_number": "string",
  "driver2_license_state": "string",
  "driver2_license_expires": "string",
  "driver2_phone": "string",
  "driver2_sex": "string",

  "vehicle1_year": "string",
  "vehicle1_make": "string",
  "vehicle1_model": "string",
  "vehicle1_color": "string",
  "vehicle1_plate": "string",
  "vehicle1_plate_state": "string",
  "vehicle1_vin": "string",
  "vehicle1_owner_name": "string",
  "vehicle1_owner_address": "string",
  "vehicle1_towed": "boolean",

  "vehicle2_year": "string",
  "vehicle2_make": "string",
  "vehicle2_model": "string",
  "vehicle2_color": "string",
  "vehicle2_plate": "string",
  "vehicle2_plate_state": "string",
  "vehicle2_vin": "string",
  "vehicle2_owner_name": "string",
  "vehicle2_owner_address": "string",
  "vehicle2_towed": "boolean",

  "insurance1_company": "string",
  "insurance1_policy": "string",
  "insurance2_company": "string",
  "insurance2_policy": "string",

  "injuries_reported": "boolean",
  "injury_count": "number or null",
  "fatalities": "boolean",
  "pedestrian_involved": "boolean",
  "hit_and_run": "boolean",
  "alcohol_drug_driver1": "boolean",
  "alcohol_drug_driver2": "boolean",

  "vehicle1_tow_company": "string",
  "vehicle2_tow_company": "string",

  "summons_number1": "string",
  "charge1": "string",
  "summons_number2": "string",
  "charge2": "string",
  "summons_number3": "string",
  "charge3": "string",

  "officer_first_name": "string",
  "officer_last_name": "string",
  "officer_badge": "string",
  "reviewed_by_name": "string",
  "reviewed_by_badge": "string",
  "police_department": "string",
  "precinct": "string",
  "case_status": "string",

  "crash_narrative": "string (full text of crash description/narrative if present)"
}`;

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { image, mediaType, claimRef } = req.body || {};
  if (!image || !mediaType) {
    return res.status(400).json({ error: 'Missing image or mediaType' });
  }

  try {
    // Call Claude API to extract the data
    const claudeRes = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': process.env.ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: 'claude-opus-4-5',
        max_tokens: 4000,
        messages: [{
          role: 'user',
          content: [
            {
              type: mediaType === 'application/pdf' ? 'document' : 'image',
              source: {
                type: 'base64',
                media_type: mediaType,
                data: image,
              },
            },
            {
              type: 'text',
              text: EXTRACTION_PROMPT,
            },
          ],
        }],
      }),
    });

    if (!claudeRes.ok) {
      const err = await claudeRes.text();
      console.error('Claude API error:', err);
      return res.status(500).json({ error: 'Claude API error', detail: err });
    }

    const claudeData = await claudeRes.json();
    const rawText = claudeData.content?.[0]?.text || '{}';

    // Parse JSON — strip any accidental markdown fences
    let extracted;
    try {
      const clean = rawText.replace(/```json|```/g, '').trim();
      extracted = JSON.parse(clean);
    } catch (parseErr) {
      console.error('JSON parse error:', parseErr, 'Raw:', rawText);
      return res.status(500).json({ error: 'Failed to parse extracted data', raw: rawText });
    }

    // Store in Turso database
    const db = getDB();
    await db.execute(`
      CREATE TABLE IF NOT EXISTS police_reports (
        id               INTEGER PRIMARY KEY AUTOINCREMENT,
        claim_ref        TEXT,
        extracted_at     TEXT NOT NULL,
        case_number      TEXT,
        crash_date       TEXT,
        crash_time       TEXT,
        crash_location   TEXT,
        municipality     TEXT,
        driver1_name     TEXT,
        driver1_license  TEXT,
        driver1_dob      TEXT,
        driver1_address  TEXT,
        driver2_name     TEXT,
        driver2_license  TEXT,
        driver2_dob      TEXT,
        driver2_address  TEXT,
        vehicle1         TEXT,
        vehicle2         TEXT,
        insurance1       TEXT,
        insurance2       TEXT,
        injuries         INTEGER DEFAULT 0,
        fatalities       INTEGER DEFAULT 0,
        towed_v1         INTEGER DEFAULT 0,
        towed_v2         INTEGER DEFAULT 0,
        officer_name     TEXT,
        officer_badge    TEXT,
        police_dept      TEXT,
        summons          TEXT,
        charges          TEXT,
        case_status      TEXT,
        narrative        TEXT,
        raw_json         TEXT
      )
    `);

    await db.execute({
      sql: `INSERT INTO police_reports
        (claim_ref, extracted_at, case_number, crash_date, crash_time, crash_location,
         municipality, driver1_name, driver1_license, driver1_dob, driver1_address,
         driver2_name, driver2_license, driver2_dob, driver2_address,
         vehicle1, vehicle2, insurance1, insurance2,
         injuries, fatalities, towed_v1, towed_v2,
         officer_name, officer_badge, police_dept,
         summons, charges, case_status, narrative, raw_json)
        VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
      args: [
        claimRef || null,
        new Date().toISOString(),
        extracted.case_number || null,
        extracted.crash_date || null,
        extracted.crash_time || null,
        extracted.crash_location || null,
        extracted.municipality || null,
        [extracted.driver1_first_name, extracted.driver1_last_name].filter(Boolean).join(' ') || null,
        extracted.driver1_license_number || null,
        extracted.driver1_dob || null,
        [extracted.driver1_address, extracted.driver1_city, extracted.driver1_state].filter(Boolean).join(', ') || null,
        [extracted.driver2_first_name, extracted.driver2_last_name].filter(Boolean).join(' ') || null,
        extracted.driver2_license_number || null,
        extracted.driver2_dob || null,
        [extracted.driver2_address, extracted.driver2_city, extracted.driver2_state].filter(Boolean).join(', ') || null,
        JSON.stringify({ year: extracted.vehicle1_year, make: extracted.vehicle1_make, model: extracted.vehicle1_model, color: extracted.vehicle1_color, plate: extracted.vehicle1_plate, vin: extracted.vehicle1_vin }),
        JSON.stringify({ year: extracted.vehicle2_year, make: extracted.vehicle2_make, model: extracted.vehicle2_model, color: extracted.vehicle2_color, plate: extracted.vehicle2_plate, vin: extracted.vehicle2_vin }),
        JSON.stringify({ company: extracted.insurance1_company, policy: extracted.insurance1_policy }),
        JSON.stringify({ company: extracted.insurance2_company, policy: extracted.insurance2_policy }),
        extracted.injuries_reported ? 1 : 0,
        extracted.fatalities ? 1 : 0,
        extracted.vehicle1_towed ? 1 : 0,
        extracted.vehicle2_towed ? 1 : 0,
        [extracted.officer_first_name, extracted.officer_last_name].filter(Boolean).join(' ') || null,
        extracted.officer_badge || null,
        extracted.police_department || null,
        JSON.stringify([extracted.summons_number1, extracted.summons_number2, extracted.summons_number3].filter(Boolean)),
        JSON.stringify([extracted.charge1, extracted.charge2, extracted.charge3].filter(Boolean)),
        extracted.case_status || null,
        extracted.crash_narrative || null,
        JSON.stringify(extracted),
      ]
    });

    res.status(200).json({ success: true, data: extracted });

  } catch (err) {
    console.error('extract-police-report error:', err);
    res.status(500).json({ error: 'Server error', detail: err.message });
  }
}
