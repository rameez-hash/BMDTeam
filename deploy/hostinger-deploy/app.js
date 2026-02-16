// Phusion Passenger entry point for Hostinger Shared Hosting
process.env.NODE_ENV = 'production';
process.env.HOSTNAME = '0.0.0.0';
process.env.PORT = process.env.PORT || '3000';

const path = require('path');
const fs = require('fs');
const envPath = path.join(__dirname, '.env');
if (fs.existsSync(envPath)) {
  const lines = fs.readFileSync(envPath, 'utf8').split('\n');
  lines.forEach(function(line) {
    line = line.trim();
    if (line && !line.startsWith('#')) {
      var eq = line.indexOf('=');
      if (eq > 0) {
        var key = line.substring(0, eq).trim();
        var val = line.substring(eq + 1).trim();
        if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
          val = val.slice(1, -1);
        }
        if (!process.env[key]) {
          process.env[key] = val;
        }
      }
    }
  });
}

require('./server.js');
