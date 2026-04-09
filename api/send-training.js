/**
 * CCM SafeDriver — Send Training Assignment API
 * POST /api/send-training
 * Body: { driverEmail, driverName, driverID, company, accidentType, claimNum, refNum, trainingUrl }
 * Env vars: SENDGRID_EMAIL_API, SENDGRID_FROM_EMAIL
 */

const CURRICULUM = {
  'Backing':                  { label:'Backing Safety',          modules:['G.O.A.L. Method','Blind Zone Awareness','Mirror & Camera Technique'], duration:'26 min', risk:'High' },
  'Rear-End — Our Driver':    { label:'Following Distance',      modules:['Space Management','Hazard Perception','Reaction Time Science'],      duration:'30 min', risk:'High' },
  'Rear-End — Other Driver':  { label:'Defensive Driving',       modules:['Reading Traffic Ahead','Escape Routes','Positioning'],               duration:'22 min', risk:'Medium' },
  'Hit Fixed Object':         { label:'Spatial Awareness',       modules:['Vehicle Dimensions','Clearance Judgment','Tight Maneuvering'],       duration:'24 min', risk:'Medium' },
  'Side-Impact (T-Bone)':     { label:'Intersection Safety',     modules:['Systematic Scanning','Right-of-Way Rules','Blind Intersection Approach'], duration:'28 min', risk:'High' },
  'Lost Control':             { label:'Vehicle Control',         modules:['Adverse Conditions','Skid Recovery','Speed & Curve Management'],     duration:'32 min', risk:'High' },
  'Rollover':                 { label:'Rollover Prevention',     modules:['Center of Gravity','Load Awareness','Emergency Handling'],           duration:'28 min', risk:'High' },
  'Sideswipe':                { label:'Lane Discipline',         modules:['Mirror Checks','Lane Change Protocol','Highway Positioning'],        duration:'22 min', risk:'Medium' },
  'Lane Change / Merge':      { label:'Lane Change Safety',      modules:['Signal & Check','Blind Spot Elimination','Merge Timing'],           duration:'22 min', risk:'Medium' },
  'Failure to Yield':         { label:'Right-of-Way',            modules:['Yield Situations','Pedestrian Priority','Intersection Protocol'],    duration:'20 min', risk:'Medium' },
  'Hit Pedestrian':           { label:'Pedestrian Safety',       modules:['School & Crosswalk Zones','Low-Speed Awareness','Pedestrian Prediction'], duration:'26 min', risk:'High' },
  'Hit Cyclist':              { label:'Cyclist Awareness',       modules:['Passing Distance','Bike Lane Rules','Dooring Prevention'],          duration:'22 min', risk:'High' },
  'Hit Animal':               { label:'Hazard Response',         modules:['Animal Strike Protocol','Emergency Braking','Swerve vs Stop'],      duration:'18 min', risk:'Low' },
  'Parking Lot':              { label:'Parking Lot Safety',      modules:['Lot Navigation','Pedestrian Conflicts','Low-Speed Hazards'],        duration:'20 min', risk:'Medium' },
  'Hit While Parked':         { label:'Safe Parking',            modules:['Location Selection','Visibility & Lighting','Securing Your Vehicle'], duration:'18 min', risk:'Low' },
  'Hit & Run — Moving':       { label:'Incident Response',       modules:['Scene Safety','Evidence Collection','Reporting Protocols'],         duration:'18 min', risk:'Low' },
  'Vandalism':                { label:'Vehicle Security',        modules:['Parking Security','Reporting Protocols','Prevention Habits'],       duration:'16 min', risk:'Low' },
  'Debris / Pothole Damage':  { label:'Road Hazard Awareness',   modules:['Scanning for Hazards','Smooth Braking','Reporting Road Defects'],   duration:'16 min', risk:'Low' },
  'Distracted':               { label:'Distraction Prevention',  modules:['Device Policy','Cognitive Load','Pre-trip Planning'],               duration:'26 min', risk:'High' },
};

const DEFAULT_CURR = { label:'Defensive Driving', modules:['Safe Following Distance','Hazard Awareness','Defensive Techniques'], duration:'24 min', risk:'Medium' };

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { driverEmail, driverName, driverID, company, accidentType, claimNum, refNum, trainingUrl } = req.body || {};
  if (!driverEmail || !driverName || !accidentType || !claimNum) {
    return res.status(400).json({ error: 'Missing required fields' });
  }

  const apiKey    = process.env.SENDGRID_EMAIL_API;
  const fromEmail = process.env.SENDGRID_FROM_EMAIL;
  if (!apiKey || !fromEmail) return res.status(500).json({ error: 'SendGrid not configured' });

  const curr = CURRICULUM[accidentType] || DEFAULT_CURR;
  const deadline = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toLocaleDateString('en-US', { weekday:'long', month:'long', day:'numeric' });
  const moduleList = curr.modules.map(m => `
    <tr>
      <td style="padding:10px 16px;border-bottom:1px solid #f0f0f0;font-size:14px;color:#333">
        <span style="display:inline-block;width:8px;height:8px;border-radius:50%;background:#2F3744;margin-right:10px;vertical-align:middle"></span>${m}
      </td>
      <td style="padding:10px 16px;border-bottom:1px solid #f0f0f0;font-size:12px;color:#888;text-align:right;white-space:nowrap">~8 min</td>
    </tr>`).join('');

  const html = `<!DOCTYPE html>
<html><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#f4f5f7;font-family:'Helvetica Neue',Helvetica,Arial,sans-serif">
<table width="100%" cellpadding="0" cellspacing="0" style="background:#f4f5f7;padding:32px 16px">
<tr><td align="center">
<table width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;background:#ffffff;border-radius:12px;overflow:hidden;box-shadow:0 2px 8px rgba(0,0,0,0.08)">

  <!-- HEADER -->
  <tr><td style="background:#2F3744;padding:28px 32px">
    <table width="100%" cellpadding="0" cellspacing="0">
      <tr>
        <td>
          <div style="font-size:11px;font-weight:700;letter-spacing:0.12em;color:#C4A77D;text-transform:uppercase;margin-bottom:6px">CCM SafeDriver</div>
          <div style="font-size:22px;font-weight:700;color:#ffffff;line-height:1.3">Safety Training<br>Assignment</div>
        </td>
        <td align="right" valign="top">
          <div style="background:#C4A77D;color:#2F3744;font-size:11px;font-weight:700;padding:6px 14px;border-radius:99px;letter-spacing:0.06em">ACTION REQUIRED</div>
        </td>
      </tr>
    </table>
  </td></tr>

  <!-- CLAIM BANNER -->
  <tr><td style="background:#D6DCE4;padding:14px 32px">
    <table width="100%" cellpadding="0" cellspacing="0">
      <tr>
        <td style="font-size:11px;font-weight:700;color:#2F3744;letter-spacing:0.1em;text-transform:uppercase">Claim Number</td>
        <td style="font-size:11px;font-weight:700;color:#2F3744;letter-spacing:0.1em;text-transform:uppercase;text-align:center">Accident Type</td>
        <td style="font-size:11px;font-weight:700;color:#2F3744;letter-spacing:0.1em;text-transform:uppercase;text-align:right">Due Date</td>
      </tr>
      <tr>
        <td style="font-size:20px;font-weight:700;color:#2F3744;padding-top:4px">${claimNum}</td>
        <td style="font-size:14px;font-weight:600;color:#2F3744;padding-top:4px;text-align:center">${accidentType}</td>
        <td style="font-size:13px;font-weight:600;color:#c0392b;padding-top:4px;text-align:right">${deadline}</td>
      </tr>
    </table>
  </td></tr>

  <!-- BODY -->
  <tr><td style="padding:28px 32px">
    <p style="margin:0 0 8px;font-size:16px;color:#333">Hi ${driverName},</p>
    <p style="margin:0 0 20px;font-size:14px;color:#555;line-height:1.7">
      Following your recent accident report, CCM has assigned you a personalized safety training curriculum. 
      This training is based on your specific accident type and must be completed within 7 days. 
      Completion is documented and linked to your claim.
    </p>

    <!-- CURRICULUM CARD -->
    <table width="100%" cellpadding="0" cellspacing="0" style="border:1px solid #e8e8e8;border-radius:8px;overflow:hidden;margin-bottom:24px">
      <tr><td style="background:#2F3744;padding:14px 16px">
        <div style="font-size:11px;color:#C4A77D;font-weight:700;letter-spacing:0.1em;text-transform:uppercase;margin-bottom:2px">Your Curriculum</div>
        <div style="font-size:16px;color:#ffffff;font-weight:700">${curr.label} Remediation</div>
        <div style="font-size:12px;color:#D6DCE4;margin-top:4px">${curr.duration} total · ${curr.modules.length} modules · Complete at your own pace</div>
      </td></tr>
      <tr><td style="padding:0">
        <table width="100%" cellpadding="0" cellspacing="0">
          ${moduleList}
        </table>
      </td></tr>
      <tr><td style="padding:12px 16px;background:#f8f9fa">
        <span style="font-size:12px;color:#888">Risk level assigned: </span>
        <span style="font-size:12px;font-weight:700;color:${curr.risk==='High'?'#c0392b':curr.risk==='Medium'?'#d68910':'#27ae60'}">${curr.risk}</span>
      </td></tr>
    </table>

    <!-- CTA -->
    <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:24px">
      <tr><td align="center">
        <a href="${trainingUrl}" style="display:inline-block;background:#2F3744;color:#ffffff;font-size:15px;font-weight:700;padding:16px 40px;border-radius:8px;text-decoration:none;letter-spacing:0.02em">
          Begin Training →
        </a>
      </td></tr>
      <tr><td align="center" style="padding-top:10px;font-size:12px;color:#aaa">
        Works on your phone, tablet, or computer
      </td></tr>
    </table>

    <!-- INFO BOX -->
    <table width="100%" cellpadding="0" cellspacing="0" style="background:#fff8e6;border-left:3px solid #C4A77D;border-radius:0 6px 6px 0;margin-bottom:20px">
      <tr><td style="padding:12px 16px;font-size:13px;color:#7d6b3a;line-height:1.6">
        <strong>Why this matters:</strong> Completing this training demonstrates your commitment to safety 
        and is documented against claim #${claimNum}. This record protects both you and ${company} 
        in the event the claim is reviewed.
      </td></tr>
    </table>

    <p style="margin:0;font-size:13px;color:#888;line-height:1.7">
      Questions? Contact your safety coordinator or reply to this email.<br>
      Driver ID: ${driverID || 'N/A'} · Reference: ${refNum || 'N/A'}
    </p>
  </td></tr>

  <!-- FOOTER -->
  <tr><td style="background:#2F3744;padding:20px 32px;text-align:center">
    <div style="font-size:11px;color:#8a9bb0;line-height:1.8">
      Corporate Claims Management · CCM SafeDriver Program<br>
      This training is required and must be completed by ${deadline}.<br>
      Non-completion will be escalated to your supervisor.
    </div>
  </td></tr>

</table>
</td></tr>
</table>
</body></html>`;

  const text = `CCM SafeDriver Training Assignment\n\nHi ${driverName},\n\nYou have been assigned safety training following your accident (Claim #${claimNum}).\n\nCurriculum: ${curr.label} Remediation\nModules: ${curr.modules.join(', ')}\nDuration: ${curr.duration}\nDue: ${deadline}\n\nBegin training: ${trainingUrl}\n\nThis training is required. Completion is documented against your claim.\n\n— CCM Safety Team`;

  try {
    const r = await fetch('https://api.sendgrid.com/v3/mail/send', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + apiKey },
      body: JSON.stringify({
        personalizations: [{ to: [{ email: driverEmail, name: driverName }] }],
        from:     { email: fromEmail, name: 'CCM SafeDriver' },
        reply_to: { email: 'sskoletsky@ccmservices.com', name: 'CCM Safety Team' },
        subject:  `Required Safety Training — Claim #${claimNum} | ${curr.label}`,
        content:  [{ type: 'text/plain', value: text }, { type: 'text/html', value: html }],
      }),
    });

    if (r.status === 202) return res.status(200).json({ success: true });
    const data = await r.json().catch(() => ({}));
    console.error('SendGrid training email error:', data);
    return res.status(500).json({ error: 'Email failed', detail: JSON.stringify(data.errors || data) });

  } catch (err) {
    console.error('send-training error:', err);
    res.status(500).json({ error: 'Failed', detail: err.message });
  }
}
