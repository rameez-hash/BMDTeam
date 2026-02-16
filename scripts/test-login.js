const https = require('https');

const data = JSON.stringify({ email: 'admin@hrms.com', password: 'admin123' });

const options = {
  hostname: 'which-pied.vercel.app',
  path: '/api/auth/login',
  method: 'POST',
  headers: { 'Content-Type': 'application/json', 'Content-Length': data.length }
};

const req = https.request(options, (res) => {
  console.log('STATUS:', res.statusCode);
  let body = '';
  res.on('data', (chunk) => body += chunk);
  res.on('end', () => {
    try { console.log('RESPONSE:', JSON.stringify(JSON.parse(body), null, 2)); }
    catch { console.log('RAW:', body.substring(0, 1000)); }
  });
});

req.on('error', (e) => console.error('ERROR:', e.message));
req.write(data);
req.end();
