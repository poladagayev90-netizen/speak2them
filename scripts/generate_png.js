const sharp = require('sharp');
const fs = require('fs');
const path = require('path');

// SVG with background (for standard icons, favicons, web logo)
const svgWithBg = Buffer.from(`
<svg width="512" height="512" viewBox="0 0 512 512" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <linearGradient id="bg" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#2c1b4d" />
      <stop offset="50%" stop-color="#0f0f1a" />
      <stop offset="100%" stop-color="#0a0a14" />
    </linearGradient>
    <linearGradient id="flaskGlass" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#ffffff" stop-opacity="0.95" />
      <stop offset="100%" stop-color="#ffffff" stop-opacity="0.25" />
    </linearGradient>
    <linearGradient id="liquid" x1="0%" y1="0%" x2="0%" y2="100%">
      <stop offset="0%" stop-color="#c084fc" />
      <stop offset="100%" stop-color="#6b21a8" />
    </linearGradient>
    <filter id="glow" x="-20%" y="-20%" width="140%" height="140%">
      <feGaussianBlur stdDeviation="3" result="blur" />
      <feComposite in="SourceGraphic" in2="blur" operator="over"/>
    </filter>
  </defs>
  
  <rect width="512" height="512" rx="112" fill="url(#bg)"/>
  
  <g transform="translate(100, 68) scale(6.8)">
    {/* Flask Outer Contour (Circle + Speech Bubble Pointer + Neck) */}
    <path d="M 16 4 L 24 4 L 24 22.6 A 14 14 0 1 1 13 48.1 L 5 52 L 6.9 40.8 A 14 14 0 0 1 16 22.6 L 16 4 Z" fill="none" stroke="url(#flaskGlass)" stroke-width="2.5" stroke-linejoin="round"/>
    {/* Flask Neck Lip */}
    <rect x="13" y="1" width="14" height="3" fill="url(#flaskGlass)" rx="1.5"/>
    {/* Liquid Base */}
    <path d="M 6.3 33 A 14 14 0 0 1 13 48.1 L 5 52 L 6.9 40.8 A 14 14 0 0 1 6.3 33 Z" fill="url(#liquid)"/>
    <path d="M 6.3 33 A 14 14 0 0 0 33.7 33 A 14 14 0 0 1 13 48.1 L 5 52 L 6.9 40.8 A 14 14 0 0 1 6.3 33 Z" fill="url(#liquid)"/>
    {/* Liquid Surface Wave / 3D Oval Highlight */}
    <path d="M 6.3 33 Q 20 35.5 33.7 33 Q 20 30.5 6.3 33 Z" fill="#e9d5ff" opacity="0.8"/>
    {/* Glass Highlight Reflection */}
    <path d="M 29.5 30.5 A 11 11 0 0 1 27.8 43.8" fill="none" stroke="#ffffff" stroke-width="1.5" stroke-linecap="round" opacity="0.4"/>
    {/* Tiny Speech Bubble rising */}
    <g filter="url(#glow)">
      <path d="M 18 23 C 19.5 23 20.5 24 20.5 25 C 20.5 26.2 19.5 27 18 27 C 17.5 27 17.1 27.2 16.7 27.5 L 16.2 28.5 L 16.5 27.2 C 15.8 27 15.5 26.2 15.5 25 C 15.5 24 16.5 23 18 23 Z" fill="#ffffff" opacity="0.95"/>
    </g>
    {/* Circular Bubbles */}
    <circle cx="25" cy="18" r="1.2" fill="#ffffff" opacity="0.8"/>
    <circle cx="21" cy="12" r="0.8" fill="#ffffff" opacity="0.6"/>
  </g>
</svg>
`);

// SVG foreground only (for Android adaptive launcher foreground)
const svgFgOnly = Buffer.from(`
<svg width="512" height="512" viewBox="0 0 512 512" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <linearGradient id="flaskGlass" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#ffffff" stop-opacity="0.95" />
      <stop offset="100%" stop-color="#ffffff" stop-opacity="0.25" />
    </linearGradient>
    <linearGradient id="liquid" x1="0%" y1="0%" x2="0%" y2="100%">
      <stop offset="0%" stop-color="#c084fc" />
      <stop offset="100%" stop-color="#6b21a8" />
    </linearGradient>
    <filter id="glow" x="-20%" y="-20%" width="140%" height="140%">
      <feGaussianBlur stdDeviation="3" result="blur" />
      <feComposite in="SourceGraphic" in2="blur" operator="over"/>
    </filter>
  </defs>
  
  <g transform="translate(132, 104) scale(5.5)">
    {/* Flask Outer Contour */}
    <path d="M 16 4 L 24 4 L 24 22.6 A 14 14 0 1 1 13 48.1 L 5 52 L 6.9 40.8 A 14 14 0 0 1 16 22.6 L 16 4 Z" fill="none" stroke="url(#flaskGlass)" stroke-width="2.5" stroke-linejoin="round"/>
    {/* Flask Neck Lip */}
    <rect x="13" y="1" width="14" height="3" fill="url(#flaskGlass)" rx="1.5"/>
    {/* Liquid Base */}
    <path d="M 6.3 33 A 14 14 0 0 1 13 48.1 L 5 52 L 6.9 40.8 A 14 14 0 0 1 6.3 33 Z" fill="url(#liquid)"/>
    <path d="M 6.3 33 A 14 14 0 0 0 33.7 33 A 14 14 0 0 1 13 48.1 L 5 52 L 6.9 40.8 A 14 14 0 0 1 6.3 33 Z" fill="url(#liquid)"/>
    {/* Liquid Surface Wave */}
    <path d="M 6.3 33 Q 20 35.5 33.7 33 Q 20 30.5 6.3 33 Z" fill="#e9d5ff" opacity="0.8"/>
    {/* Glass Reflection */}
    <path d="M 29.5 30.5 A 11 11 0 0 1 27.8 43.8" fill="none" stroke="#ffffff" stroke-width="1.5" stroke-linecap="round" opacity="0.4"/>
    {/* Tiny Speech Bubble rising */}
    <g filter="url(#glow)">
      <path d="M 18 23 C 19.5 23 20.5 24 20.5 25 C 20.5 26.2 19.5 27 18 27 C 17.5 27 17.1 27.2 16.7 27.5 L 16.2 28.5 L 16.5 27.2 C 15.8 27 15.5 26.2 15.5 25 C 15.5 24 16.5 23 18 23 Z" fill="#ffffff" opacity="0.95"/>
    </g>
    {/* Circular Bubbles */}
    <circle cx="25" cy="18" r="1.2" fill="#ffffff" opacity="0.8"/>
    <circle cx="21" cy="12" r="0.8" fill="#ffffff" opacity="0.6"/>
  </g>
</svg>
`);

async function generate() {
  const rootDir = path.join(__dirname, '..');
  
  const targets = [
    // Web Assets
    { relPath: 'public/logo512.png', size: 512, type: 'full' },
    { relPath: 'public/logo192.png', size: 192, type: 'full' },
    { relPath: 'public/favicon.ico', size: 64, type: 'full' },
    
    // Android Launcher Icons (Standard)
    { relPath: 'android/app/src/main/res/mipmap-mdpi/ic_launcher.png', size: 48, type: 'full' },
    { relPath: 'android/app/src/main/res/mipmap-hdpi/ic_launcher.png', size: 72, type: 'full' },
    { relPath: 'android/app/src/main/res/mipmap-xhdpi/ic_launcher.png', size: 96, type: 'full' },
    { relPath: 'android/app/src/main/res/mipmap-xxhdpi/ic_launcher.png', size: 144, type: 'full' },
    { relPath: 'android/app/src/main/res/mipmap-xxxhdpi/ic_launcher.png', size: 192, type: 'full' },
    
    // Android Launcher Icons (Round)
    { relPath: 'android/app/src/main/res/mipmap-mdpi/ic_launcher_round.png', size: 48, type: 'full' },
    { relPath: 'android/app/src/main/res/mipmap-hdpi/ic_launcher_round.png', size: 72, type: 'full' },
    { relPath: 'android/app/src/main/res/mipmap-xhdpi/ic_launcher_round.png', size: 96, type: 'full' },
    { relPath: 'android/app/src/main/res/mipmap-xxhdpi/ic_launcher_round.png', size: 144, type: 'full' },
    { relPath: 'android/app/src/main/res/mipmap-xxxhdpi/ic_launcher_round.png', size: 192, type: 'full' },
    
    // Android Launcher Icons (Adaptive Foreground)
    { relPath: 'android/app/src/main/res/mipmap-mdpi/ic_launcher_foreground.png', size: 108, type: 'fg' },
    { relPath: 'android/app/src/main/res/mipmap-hdpi/ic_launcher_foreground.png', size: 162, type: 'fg' },
    { relPath: 'android/app/src/main/res/mipmap-xhdpi/ic_launcher_foreground.png', size: 216, type: 'fg' },
    { relPath: 'android/app/src/main/res/mipmap-xxhdpi/ic_launcher_foreground.png', size: 324, type: 'fg' },
    { relPath: 'android/app/src/main/res/mipmap-xxxhdpi/ic_launcher_foreground.png', size: 432, type: 'fg' },
  ];

  console.log('Generating logo assets...');
  
  for (const target of targets) {
    const fullPath = path.join(rootDir, target.relPath);
    const dir = path.dirname(fullPath);
    
    // Ensure output directory exists
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    
    const svgBuffer = target.type === 'fg' ? svgFgOnly : svgWithBg;
    
    await sharp(svgBuffer)
      .resize(target.size, target.size)
      .png()
      .toFile(fullPath);
      
    console.log(`Generated: ${target.relPath} (${target.size}x${target.size})`);
  }
  
  console.log('All SpeakLab icons generated successfully!');
}

generate().catch(console.error);
