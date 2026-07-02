const sharp = require('sharp');
const fs = require('fs');
const path = require('path');

const svgBuffer = Buffer.from(`
<svg width="512" height="512" viewBox="0 0 512 512" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <linearGradient id="bg" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#7c3aed" />
      <stop offset="100%" stop-color="#3b1a78" />
    </linearGradient>
    <linearGradient id="liquid" x1="0%" y1="0%" x2="0%" y2="100%">
      <stop offset="0%" stop-color="#c4b5fd" />
      <stop offset="100%" stop-color="#8b5cf6" />
    </linearGradient>
    <linearGradient id="flaskGlass" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#ffffff" stop-opacity="0.9" />
      <stop offset="100%" stop-color="#ffffff" stop-opacity="0.3" />
    </linearGradient>
  </defs>
  <rect width="512" height="512" rx="112" fill="url(#bg)" />
  
  <g transform="translate(100, 100) scale(7.8)">
    <path d="M 14 6 L 14 20 L 2 55 C 0 60 3 64 8 64 L 32 64 C 37 64 40 60 38 55 L 26 20 L 26 6 Z" fill="none" stroke="url(#flaskGlass)" stroke-width="3" stroke-linejoin="round"/>
    <rect x="11" y="2" width="18" height="4" fill="url(#flaskGlass)" rx="2"/>
    <path d="M 6.5 44 L 33.5 44 L 37 54 C 38 58 36 61 32 61 L 8 61 C 4 61 2 58 3 54 Z" fill="url(#liquid)"/>
    <path d="M 6.5 44 Q 20 48 33.5 44 Q 20 40 6.5 44 Z" fill="#ddd6fe" opacity="0.9"/>
    <g transform="translate(18, 28)">
      <path d="M 8 0 C 3.6 0 0 3 0 6.5 C 0 8.5 1.2 10.3 3 11.5 L 2 15 L 6 13 C 6.6 13.2 7.3 13 8 13 C 12.4 13 16 10 16 6.5 C 16 3 12.4 0 8 0 Z" fill="#ffffff" />
    </g>
    <circle cx="12" cy="36" r="2" fill="#ffffff" opacity="0.9"/>
    <circle cx="15" cy="42" r="1.5" fill="#ffffff" opacity="0.6"/>
    <path d="M 28 22 L 18 52" stroke="#ffffff" stroke-width="2" stroke-linecap="round" opacity="0.5"/>
  </g>
</svg>
`);

async function generate() {
  const publicDir = path.join(__dirname, '../public');
  
  await sharp(svgBuffer)
    .resize(512, 512)
    .png()
    .toFile(path.join(publicDir, 'logo512.png'));
    
  await sharp(svgBuffer)
    .resize(192, 192)
    .png()
    .toFile(path.join(publicDir, 'logo192.png'));

  await sharp(svgBuffer)
    .resize(64, 64)
    .png()
    .toFile(path.join(publicDir, 'favicon.ico'));
    
  console.log('Icons generated successfully.');
}

generate().catch(console.error);
