const sharp = require('sharp');

async function createIcon() {
  // Resize the BMD logo to fit inside a 512x512 canvas
  const logo = await sharp('public/iconbmd.png')
    .resize(300, null, { fit: 'inside' })
    .toBuffer();

  const logoMeta = await sharp(logo).metadata();

  const svg = `<svg width="512" height="512" xmlns="http://www.w3.org/2000/svg">
    <defs>
      <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1">
        <stop offset="0%" stop-color="#065f46"/>
        <stop offset="100%" stop-color="#047857"/>
      </linearGradient>
      <clipPath id="rounded">
        <rect width="512" height="512" rx="110" ry="110"/>
      </clipPath>
    </defs>
    <rect width="512" height="512" fill="url(#bg)" clip-path="url(#rounded)"/>
  </svg>`;

  const left = Math.round((512 - logoMeta.width) / 2);
  const top = Math.round((512 - logoMeta.height) / 2);

  await sharp(Buffer.from(svg))
    .composite([{ input: logo, left, top }])
    .png()
    .toFile('electron/assets/icon.png');

  // Also copy for consistency
  await sharp('electron/assets/icon.png').toFile('electron/assets/iconbmd.png');

  const meta = await sharp('electron/assets/icon.png').metadata();
  console.log('Icon created:', meta.width + 'x' + meta.height, 'size:', (await require('fs').promises.stat('electron/assets/icon.png')).size, 'bytes');
}

createIcon().catch(console.error);
