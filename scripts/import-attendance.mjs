import pg from 'pg';
import { readFileSync } from 'fs';

const { Client } = pg;
const data = JSON.parse(readFileSync('C:/Users/CBM/Downloads/attendance.json', 'utf8'));

const client = new Client({
  connectionString: 'postgres://postgres.fpfzhbbismeemotpclph:DXP4lqQZt9ysf3Uq@aws-1-us-east-1.pooler.supabase.com:5432/postgres?sslmode=require&uselibpqcompat=true',
});

async function run() {
  await client.connect();
  console.log('Connected! Total records to import:', data.length);

  await client.query('DELETE FROM attendance');
  console.log('Old records cleared');

  let count = 0;
  for (const r of data) {
    await client.query(
      `INSERT INTO attendance (
        id, employee_id, date, check_in, check_out, status, is_late, late_minutes,
        work_hours, overtime, notes, work_location, shift_name, shift_start_time,
        shift_end_time, shift_break_duration, shift_grace_time, shift_standard_work_hours,
        shift_work_days, modified_by_id, modified_at, modify_reason, created_at, updated_at, checkout_missing
      ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21,$22,$23,$24,$25)
      ON CONFLICT (id) DO UPDATE SET
        check_in=EXCLUDED.check_in, check_out=EXCLUDED.check_out, status=EXCLUDED.status,
        work_hours=EXCLUDED.work_hours, updated_at=EXCLUDED.updated_at`,
      [
        r.id, r.employee_id, r.date, r.check_in || null, r.check_out || null,
        r.status, r.is_late, r.late_minutes, r.work_hours ?? null, r.overtime ?? 0,
        r.notes || null, r.work_location || null, r.shift_name || null,
        r.shift_start_time || null, r.shift_end_time || null,
        r.shift_break_duration ?? null, r.shift_grace_time ?? null,
        r.shift_standard_work_hours ?? null,
        r.shift_work_days ? JSON.stringify(r.shift_work_days) : null,
        r.modified_by_id || null, r.modified_at || null, r.modify_reason || null,
        r.created_at, r.updated_at, r.checkout_missing || false
      ]
    );
    count++;
    if (count % 100 === 0) console.log('Imported:', count);
  }

  console.log('Done! Total imported:', count);
  await client.end();
}

run().catch(e => { console.error('Error:', e.message); process.exit(1); });
