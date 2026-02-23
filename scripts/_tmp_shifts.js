const { PrismaClient } = require('@prisma/client');
const p = new PrismaClient();
async function run() {
  const shifts = await p.shift.findMany();
  shifts.forEach(s => {
    console.log(s.name + ' | ' + s.startTime + '-' + s.endTime + ' | ' + s.standardWorkHours + 'h | brk:' + s.breakDuration + 'm | id:' + s.id);
  });
  await p['$disconnect']();
}
run().catch(console.error);
