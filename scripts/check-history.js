const { PrismaClient } = require('@prisma/client');
const p = new PrismaClient();

(async () => {
  // Check all history records
  const records = await p.employeeHistory.findMany({
    orderBy: { createdAt: 'desc' },
    take: 20,
    include: {
      employee: { select: { firstName: true, lastName: true, employeeCode: true, employmentStatus: true, employmentType: true } },
    },
  });

  console.log('=== All History Records ===');
  for (const r of records) {
    console.log({
      id: r.id,
      type: r.type,
      employee: `${r.employee.firstName} ${r.employee.lastName} (${r.employee.employeeCode})`,
      currentStatus: r.employee.employmentStatus,
      currentType: r.employee.employmentType,
      effectiveDate: r.effectiveDate.toISOString().slice(0, 10),
      oldDesignation: r.oldDesignation,
      newDesignation: r.newDesignation,
      oldEmploymentType: r.oldEmploymentType,
      newEmploymentType: r.newEmploymentType,
      oldEmploymentStatus: r.oldEmploymentStatus,
      newEmploymentStatus: r.newEmploymentStatus,
      reason: r.reason,
      createdAt: r.createdAt.toISOString(),
    });
  }

  // Check DB columns exist
  const cols = await p.$queryRaw`SHOW COLUMNS FROM employee_history LIKE '%employment%'`;
  console.log('\n=== DB Columns ===');
  console.log(cols);

  await p.$disconnect();
})().catch(e => { console.error(e); process.exit(1); });
