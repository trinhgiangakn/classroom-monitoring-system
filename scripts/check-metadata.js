const db = require('../backend/config/db');
async function checkAlert() {
  const [rows] = await db.query('SELECT alert_id, metadata FROM alerts WHERE alert_id = 4');
  const r = rows[0];
  if (!r) { console.log('No alert_id=4 found'); process.exit(0); }
  console.log('typeof metadata:', typeof r.metadata);
  console.log('value:', r.metadata);
  if (typeof r.metadata === 'string') {
    try {
      JSON.parse(r.metadata);
      console.log('[OK] metadata is a valid JSON string - mysql2 returning raw string');
    } catch(e) {
      console.log('[FAIL] PARSE ERROR:', e.message);
      console.log('[FAIL] raw (80 chars):', r.metadata.slice(0, 80));
    }
  } else {
    console.log('[OK] mysql2 already auto-parsed JSON column to object');
  }
  process.exit(0);
}
checkAlert().catch(e => { console.error(e.message); process.exit(1); });
