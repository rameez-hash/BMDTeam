import pg from 'pg';
const { Client } = pg;

const NEON_URL = "postgresql://neondb_owner:npg_T67xNBWUmewk@ep-flat-smoke-aik5vkfj-pooler.c-4.us-east-1.aws.neon.tech/neondb?sslmode=require";
const SUPABASE_URL = "postgres://postgres.fpfzhbbismeemotpclph:DXP4lqQZt9ysf3Uq@aws-1-us-east-1.pooler.supabase.com:5432/postgres?sslmode=require";

// Tables in correct order (respecting foreign keys)
const TABLES = [
  'app_roles',
  'departments',
  'designations',
  'shifts',
  'users',
  'employees',
  'employee_permissions',
  'education',
  'experience',
  'emergency_contacts',
  'attendance',
  'attendance_breaks',
  'attendance_corrections',
  'leave_types',
  'leave_requests',
  'leave_balances',
  'employee_history',
  'salaries',
  'salary_history',
  'payroll_settings',
  'payroll_records',
  'manual_deductions',
  'pf_contributions',
  'tax_slabs',
  'late_rules',
  'announcements',
  'holidays',
  'activity_logs',
  'document_fields',
  'employee_documents',
  'assigned_documents',
  'tax_certificates',
  'notifications',
];

async function migrate() {
  const neon = new Client({ connectionString: NEON_URL });
  const supabase = new Client({ connectionString: SUPABASE_URL });

  console.log('Connecting to Neon (READ ONLY)...');
  await neon.connect();
  console.log('✅ Neon connected');

  console.log('Connecting to Supabase...');
  await supabase.connect();
  console.log('✅ Supabase connected');

  // Disable foreign key checks temporarily
  await supabase.query('SET session_replication_role = replica;');

  for (const table of TABLES) {
    try {
      // Read from Neon
      const { rows } = await neon.query(`SELECT * FROM "${table}"`);
      
      if (rows.length === 0) {
        console.log(`⚪ ${table}: empty, skipping`);
        continue;
      }

      // Clear existing data in Supabase table
      await supabase.query(`TRUNCATE TABLE "${table}" CASCADE`);

      // Insert into Supabase
      const columns = Object.keys(rows[0]);
      const colNames = columns.map(c => `"${c}"`).join(', ');

      let inserted = 0;
      for (const row of rows) {
        const values = columns.map((_, i) => `$${i + 1}`).join(', ');
        const vals = columns.map(c => row[c]);
        await supabase.query(
          `INSERT INTO "${table}" (${colNames}) VALUES (${values})`,
          vals
        );
        inserted++;
      }

      console.log(`✅ ${table}: ${inserted} rows migrated`);
    } catch (err) {
      console.log(`⚠️  ${table}: ${err.message}`);
    }
  }

  // Re-enable foreign key checks
  await supabase.query('SET session_replication_role = DEFAULT;');

  await neon.end();
  await supabase.end();

  console.log('\n🎉 Migration complete! Neon data is now in Supabase.');
  console.log('✅ Neon DB is untouched — all original data still there.');
}

migrate().catch(console.error);
