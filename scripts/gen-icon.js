const sharp = require('sharp');
const width = 512, height = 512;
const svg = `<svg width="${width}" height="${height}" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="#10b981"/>
      <stop offset="100%" stop-color="#0d9488"/>
    </linearGradient>
  </defs>
  <rect width="${width}" height="${height}" rx="80" fill="url(#bg)"/>
  <text x="50%" y="54%" text-anchor="middle" dominant-baseline="middle" font-family="Arial,sans-serif" font-weight="bold" font-size="180" fill="white">BMD</text>
  <text x="50%" y="82%" text-anchor="middle" font-family="Arial,sans-serif" font-weight="600" font-size="80" fill="rgba(255,255,255,0.9)">HRMS</text>
</svg>`;

const path = require('path');

sharp(Buffer.from(svg))
  .resize(512, 512)
  .png()
  .toFile(path.join(__dirname, '..', 'electron', 'assets', 'icon.png'))
  .then(() => console.log('Icon created: 512x512 icon.png'))
  .catch(e => console.error(e));
