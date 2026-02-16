const http = require('http');
const loginData = JSON.stringify({ identifier: 'admin@hrms.com', password: 'admin123' });

const loginReq = http.request({
  hostname: 'localhost', port: 3000, path: '/api/auth/login',
  method: 'POST', headers: { 'Content-Type': 'application/json', 'Content-Length': loginData.length }
}, (res) => {
  let body = '';
  res.on('data', d => body += d);
  res.on('end', () => {
    const loginRes = JSON.parse(body);
    if (!loginRes.success) { console.log('Login failed:', loginRes); return; }
    const token = loginRes.token;
    // Rameez's employee DB ID (joining date: 2026-02-18)
    const rameezId = 'd13966ba-4d1f-4722-864f-58cb115161c8';
    const url = '/api/attendance?startDate=2026-02-01&endDate=2026-02-28&limit=100&employeeId=' + rameezId;
    console.log('Calling:', url);
    
    const attReq = http.request({
      hostname: 'localhost', port: 3000, path: url,
      method: 'GET', headers: { 'Authorization': 'Bearer ' + token }
    }, (attRes) => {
      let attBody = '';
      attRes.on('data', d => attBody += d);
      attRes.on('end', () => {
        const data = JSON.parse(attBody);
        const arr = data.data || [];
        console.log('Total records:', arr.length);
        const byStatus = {};
        arr.forEach(r => { byStatus[r.status] = (byStatus[r.status] || 0) + 1; });
        console.log('By status:', byStatus);
        console.log('\nAll records:');
        arr.sort((a,b) => a.date.localeCompare(b.date)).forEach(r => {
          const d = (r.date || '').substring(0, 10);
          console.log(d + ' - ' + r.status + (r.notes ? ' (' + r.notes + ')' : ''));
        });
      });
    });
    attReq.end();
  });
});
loginReq.write(loginData);
loginReq.end();
