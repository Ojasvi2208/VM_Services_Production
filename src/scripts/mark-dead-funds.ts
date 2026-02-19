import { Pool } from 'pg';
import https from 'https';

const pool = new Pool({
  connectionString: process.env.RAILWAY_DATABASE_URL || 'postgresql://postgres:zZGzhpULOgKqXvnnutWEjCengioSheMD@turntable.proxy.rlwy.net:19665/railway',
  ssl: { rejectUnauthorized: false }
});

function fetchAmfi(): Promise<string> {
  return new Promise((resolve, reject) => {
    https.get('https://portal.amfiindia.com/spages/NAVAll.txt', { headers: { Accept: 'text/plain' }, timeout: 60000 }, (res) => {
      if (res.statusCode === 301 || res.statusCode === 302) {
        const loc = res.headers.location;
        if (!loc) { reject(new Error('No redirect location')); return; }
        https.get(loc, { headers: { Accept: 'text/plain' }, timeout: 60000 }, (r2) => {
          let d = ''; r2.on('data', (c: Buffer) => d += c.toString()); r2.on('end', () => resolve(d)); r2.on('error', reject);
        }).on('error', reject);
        return;
      }
      let d = ''; res.on('data', (c: Buffer) => d += c.toString()); res.on('end', () => resolve(d)); res.on('error', reject);
    }).on('error', reject);
  });
}

async function run() {
  // 1. Fetch AMFI file and extract active scheme codes
  console.log('Fetching AMFI NAVAll.txt...');
  const raw = await fetchAmfi();
  const activeCodes = new Set<string>();
  for (const line of raw.split('\n')) {
    const t = line.trim();
    if (!t || !t.includes(';')) continue;
    const code = t.split(';')[0].trim();
    if (/^\d+$/.test(code)) activeCodes.add(code);
  }
  console.log('Active scheme codes in AMFI: ' + activeCodes.size);

  // 2. Get all scheme codes from DB
  const dbResult = await pool.query('SELECT scheme_code FROM funds');
  const allCodes = dbResult.rows.map((r: { scheme_code: string }) => r.scheme_code);
  console.log('Total funds in DB: ' + allCodes.length);

  // 3. Find dead codes (in DB but not in AMFI)
  const deadCodes = allCodes.filter(c => !activeCodes.has(c));
  const aliveCodes = allCodes.filter(c => activeCodes.has(c));
  console.log('Dead funds (not in AMFI): ' + deadCodes.length);
  console.log('Active funds (in AMFI): ' + aliveCodes.length);

  // 4. Mark dead funds as is_active = false
  if (deadCodes.length > 0) {
    const result = await pool.query(
      `UPDATE funds SET is_active = false WHERE scheme_code = ANY($1::text[])`,
      [deadCodes]
    );
    console.log('\nMarked ' + result.rowCount + ' funds as is_active = false');
  }

  // 5. Ensure active funds are marked is_active = true
  if (aliveCodes.length > 0) {
    await pool.query(
      `UPDATE funds SET is_active = true WHERE scheme_code = ANY($1::text[])`,
      [aliveCodes]
    );
  }

  // 6. Verify final distribution
  const dist = await pool.query('SELECT is_active, COUNT(*) as cnt FROM funds GROUP BY is_active ORDER BY is_active DESC');
  console.log('\nFinal distribution:');
  dist.rows.forEach((r: any) => console.log('  is_active=' + r.is_active + ': ' + r.cnt + ' funds'));

  // 7. Dead funds by last NAV year
  const deadByYear = await pool.query(`
    SELECT EXTRACT(YEAR FROM latest_nav_date)::int as yr, COUNT(*)::int as cnt
    FROM funds WHERE is_active = false
    GROUP BY EXTRACT(YEAR FROM latest_nav_date)
    ORDER BY yr DESC
  `);
  console.log('\nDead funds by last NAV year:');
  deadByYear.rows.forEach((r: any) => console.log('  ' + r.yr + ': ' + r.cnt + ' funds'));

  // 8. List most recently dead funds
  const deadRecent = await pool.query(`
    SELECT scheme_code, SUBSTRING(scheme_name, 1, 65) as name, latest_nav, TO_CHAR(latest_nav_date, 'YYYY-MM-DD') as last_date
    FROM funds WHERE is_active = false
    ORDER BY latest_nav_date DESC
    LIMIT 30
  `);
  console.log('\nMost recently dead funds (last NAV closest to today):');
  deadRecent.rows.forEach((r: any) => console.log('  ' + r.scheme_code + ' | ' + r.last_date + ' | NAV ' + r.latest_nav + ' | ' + r.name));

  await pool.end();
}

run().catch(async (err) => {
  console.error('Error:', err);
  await pool.end();
  process.exit(1);
});
