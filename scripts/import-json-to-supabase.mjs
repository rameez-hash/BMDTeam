import pg from 'pg';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const { Client } = pg;
const __dirname = path.dirname(fileURLToPath(import.meta.url));

const SUPABASE_URL = "postgres://postgres.fpfzhbbismeemotpclph:DXP4lqQZt9ysf3Uq@aws-1-us-east-1.pooler.supabase.com:5432/postgres?sslmode=require&uselibpqcompat=true";

// Order matters — foreign keys must be satisfied
const TABLES = [
  { file: 'app_roles.json',                  table: 'app_roles' },
  { file: 'departments.json',                table: 'departments' },
  { file: 'designations.json',               table: 'designations' },
  { file: 'shifts.json',                     table: 'shifts' },
  { file: 'users.json',                      table: 'users' },
  { file: 'employees.json',                  table: 'employees' },
  { file: 'employee_permissions.json',       table: 'employee_permissions' },
  { file: 'permissions.json',                table: 'permissions' },
  { file: 'role_permissions.json',           table: 'role_permissions' },
  { file: 'education.json',                  table: 'education' },
  { file: 'experience.json',                 table: 'experience' },
  { file: 'emergency_contacts.json',         table: 'emergency_contacts' },
  { file: 'attendance.json',                 table: 'attendance' },
  { file: 'attendance_breaks.json',          table: 'attendance_breaks' },
  { file: 'attendance_corrections.json',     table: 'attendance_corrections' },
  { file: 'leave_types.json',                table: 'leave_types' },
  { file: 'leave_requests.json',             table: 'leave_requests' },
  { file: 'leave_balances.json',             table: 'leave_balances' },
  { file: 'employee_history.json',           table: 'employee_history' },
  { file: 'salaries.json',                   table: 'salaries' },
  { file: 'salary_history.json',             table: 'salary_history' },
  { file: 'payroll_settings.json',           table: 'payroll_settings' },
  { file: 'payroll_records.json',            table: 'payroll_records' },
  { file: 'manual_deductions.json',          table: 'manual_deductions' },
  { file: 'pf_contributions.json',           table: 'pf_contributions' },
  { file: 'tax_slabs.json',                  table: 'tax_slabs' },
  { file: 'late_rules.json',                 table: 'late_rules' },
  { file: 'announcements.json',              table: 'announcements' },
  { file: 'holidays.json',                   table: 'holidays' },
  { file: 'document_fields.json',            table: 'document_fields' },
  { file: 'employee_documents.json',         table: 'employee_documents' },
  { file: 'assigned_documents.json',         table: 'assigned_documents' },
  { file: 'tax_certificates.json',           table: 'tax_certificates' },
  { file: 'notifications.json',              table: 'notifications' },
  { file: 'activity_logs.json',              table: 'activity_logs' },
];

async function importTable(client, table, rows) {
  if (!rows || rows.length === 0) {
    console.log(`⚪ ${table}: empty, skipping`);
    return;
  }

  const columns = Object.keys(rows[0]);
  const colNames = columns.map(c => `"${c}"`).join(', ');

  // Insert in batches of 100
  const BATCH = 100;
  let inserted = 0;

  for (let i = 0; i < rows.length; i += BATCH) {
    const batch = rows.slice(i, i + BATCH);
    for (const row of batch) {
      const values = columns.map((_, idx) => `$${idx + 1}`).join(', ');
      const vals = columns.map(c => row[c]);
      try {
        await client.query(
          `INSERT INTO "${table}" (${colNames}) VALUES (${values}) ON CONFLICT DO NOTHING`,
          vals
        );
        inserted++;
      } catch (err) {
        // skip duplicate or constraint errors silently
      }
    }
    process.stdout.write(`\r  → ${table}: ${Math.min(i + BATCH, rows.length)}/${rows.length} rows...`);
  }

  console.log(`\r✅ ${table}: ${inserted} rows imported`);
}

async function main() {
  const client = new Client({ connectionString: SUPABASE_URL });
  await client.connect();
  console.log('✅ Connected to Supabase\n');

  // Disable FK checks
  await client.query('SET session_replication_role = replica;');

  const prismaDir = path.join(__dirname, '..', 'prisma');

  for (const { file, table } of TABLES) {
    const filePath = path.join(prismaDir, file);
    if (!fs.existsSync(filePath)) {
      console.log(`⚠️  ${file} not found, skipping`);
      continue;
    }

    const raw = fs.readFileSync(filePath, 'utf8').trim();
    if (!raw || raw === '[]' || raw === '') {
      console.log(`⚪ ${table}: empty file, skipping`);
      continue;
    }

    let rows;
    try {
      rows = JSON.parse(raw);
    } catch {
      console.log(`❌ ${file}: invalid JSON, skipping`);
      continue;
    }

    await importTable(client, table, rows);
  }

  // Re-enable FK checks
  await client.query('SET session_replication_role = DEFAULT;');

  await client.end();
  console.log('\n🎉 All done! Neon data imported into Supabase.');
  console.log('✅ Neon DB untouched — original data still safe.');
}

main().catch(err => {
  console.error('Error:', err.message);
  process.exit(1);
});
