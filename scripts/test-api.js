// Test actual API response for the employee user
const http = require('http');

// First login as employee to get token
const loginData = JSON.stringify({ identifier: 'admin@hrms.com', password: 'admin123' });

const loginReq = http.request({
  hostname: 'localhost', port: 3000, path: '/api/auth/login',
  method: 'POST', headers: { 'Content-Type': 'application/json', 'Content-Length': loginData.length }
}, (res) => {
  let body = '';
  res.on('data', d => body += d);
  res.on('end', async () => {
    const loginRes = JSON.parse(body);
    if (!loginRes.success) { console.log('Login failed:', loginRes); return; }
    
    console.log('=== LOGGED IN AS ===');
    console.log(JSON.stringify(loginRes.user));
    console.log('employeeDbId:', loginRes.user.employeeDbId);
    
    const token = loginRes.token;
    const empDbId = loginRes.user.employeeDbId;
    const now = new Date();
    const y = now.getFullYear();
    const mo = String(now.getMonth() + 1).padStart(2, '0');
    const ld = new Date(y, now.getMonth() + 1, 0).getDate();
    const empFilter = empDbId ? '&employeeId=' + empDbId : '';
    const url = `/api/attendance?startDate=${y}-${mo}-01&endDate=${y}-${mo}-${String(ld).padStart(2, '0')}&limit=100${empFilter}`;
    
    console.log('\n=== CALLING:', url, '===');
    
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
        console.log('Pagination:', data.pagination);
        
        // Count by status
        const byStatus = {};
        arr.forEach(r => { byStatus[r.status] = (byStatus[r.status] || 0) + 1; });
        console.log('\nBy status:', byStatus);
        
        // Count duplicates
        const dateCounts = {};
        arr.forEach(r => {
          const d = (r.date || '').substring(0, 10);
          dateCounts[d] = (dateCounts[d] || 0) + 1;
        });
        const dupes = Object.entries(dateCounts).filter(([, c]) => c > 1);
        if (dupes.length) {
          console.log('\n=== DUPLICATE DATES ===');
          dupes.forEach(([date, count]) => {
            console.log(`${date}: ${count} records`);
            arr.filter(r => r.date.substring(0, 10) === date).forEach(r => {
              console.log(`  - ${r.status} id:${r.id.substring(0, 20)}... emp:${r.employee?.firstName || 'N/A'}`);
            });
          });
        } else {
          console.log('\nNo duplicate dates found!');
        }
        
        // Show recent 7 (like Electron app)
        const today = `${y}-${mo}-${String(now.getDate()).padStart(2, '0')}`;
        arr.forEach(x => { if (x.date && x.date.length > 10) x.date = x.date.split('T')[0]; });
        const recent = arr.filter(x => x.date <= today).sort((a, b) => b.date.localeCompare(a.date)).slice(0, 7);
        console.log('\n=== RECENT 7 (as shown in Electron) ===');
        recent.forEach(r => console.log(`${r.date} - ${r.status} - ${r.employee?.firstName || 'N/A'}`));
      });
    });
    attReq.end();
  });
});
loginReq.write(loginData);
loginReq.end();
