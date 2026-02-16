const { PrismaClient } = require('@prisma/client');
const p = new PrismaClient();
(async () => {
  const r = await p.leaveRequest.findMany({
    include: {
      approvedBy: { select: { firstName: true, lastName: true } },
      employee: { select: { firstName: true, lastName: true } },
    }
  });
  r.forEach(x => console.log({
    emp: x.employee.firstName + ' ' + x.employee.lastName,
    status: x.status,
    rejectionReason: x.rejectionReason,
    approvedBy: x.approvedBy,
  }));
  await p.$disconnect();
})();
