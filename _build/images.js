// One-time image pipeline. Sources are the original photos (git commit 3ecc224).
// Usage: node _build/images.js <dir-with-originals>
const sharp = require('sharp');
const fs = require('fs');
const path = require('path');
const root = path.resolve(__dirname, '..');
const src = process.argv[2] || root;
const out = path.join(root, 'assets/img');
fs.mkdirSync(out, { recursive: true });

const photos = {
  'pool-front-cottage-gokarna': 'img2.webp',
  'night-pool-gokarna-samudra': 'DOC-20250913-WA0072_Night pool area with moon.webp',
  'deluxe-room-gokarna': 'img1.webp',
  'standard-room-gokarna': 'img3.webp',
  'guest-room-headboard-gokarna': 'DSC07828.webp',
  'guest-room-bed-gokarna': 'img4.jpg',
  'room-wardrobe-gokarna': 'DOC-20250913-WA0601_Wardrobe.webp',
  'lobby-lounge-gokarna-samudra': 'DSC07696.webp',
  'ocean-deck-restaurant-gokarna': 'IMG_9567.webp',
  'ocean-deck-entrance-gokarna': 'DOC-20250913-WA0159.webp',
  'ocean-deck-dish-gokarna': 'dining.webp',
};

async function webp(input, file, w, h, fit, max) {
  let q = 72, buf;
  do {
    let p = sharp(input).rotate();
    p = fit === 'inside' ? p.resize(w, h, { fit: 'inside' }) : p.resize(w, h, { fit: 'cover', position: 'attention' });
    buf = await p.webp({ quality: q, effort: 6 }).toBuffer();
    q -= 6;
  } while (buf.length > max && q > 30);
  fs.writeFileSync(path.join(out, file), buf);
  const m = await sharp(buf).metadata();
  return { w: m.width, h: m.height, kb: Math.round(buf.length / 1024) };
}

(async () => {
  const manifest = {};
  for (const [slug, file] of Object.entries(photos)) {
    const input = fs.readFileSync(path.join(src, file));
    manifest[slug] = {
      hero1600: await webp(input, `${slug}-1600.webp`, 1600, 1000, 'cover', 160 * 1024),
      hero800: await webp(input, `${slug}-hero-800.webp`, 800, 500, 'cover', 60 * 1024),
      card800: await webp(input, `${slug}-800.webp`, 800, 600, 'cover', 90 * 1024),
      card400: await webp(input, `${slug}-400.webp`, 400, 300, 'cover', 30 * 1024),
      full: await webp(input, `${slug}-full.webp`, 1600, 1600, 'inside', 220 * 1024),
    };
    await sharp(input).rotate().resize(1200, 630, { fit: 'cover', position: 'attention' }).jpeg({ quality: 76, mozjpeg: true }).toFile(path.join(out, `${slug}-og.jpg`));
  }
  const logo = fs.readFileSync(path.join(src, 'resort-logo.png'));
  await sharp(logo).resize(96, 96).webp({ quality: 85 }).toFile(path.join(out, 'gokarna-samudra-logo-96.webp'));
  await sharp(logo).resize(96, 96).png({ compressionLevel: 9 }).toFile(path.join(out, 'gokarna-samudra-logo-96.png'));
  await sharp(logo).resize(512, 512).png({ compressionLevel: 9 }).toFile(path.join(out, 'gokarna-samudra-logo-512.png'));
  for (const [n, s] of [['favicon-16x16.png', 16], ['favicon-32x32.png', 32], ['apple-touch-icon.png', 180], ['android-chrome-192x192.png', 192], ['android-chrome-512x512.png', 512]]) {
    let p = sharp(logo).resize(s, s);
    if (n.startsWith('apple')) p = p.flatten({ background: '#ffffff' });
    await p.png({ compressionLevel: 9 }).toFile(path.join(root, n));
  }
  fs.writeFileSync(path.join(__dirname, 'images.json'), JSON.stringify(manifest, null, 1));
  console.log(Object.entries(manifest).map(([k, v]) => `${k}: ${Object.values(v).map(x => x.kb).join('/')}KB`).join('\n'));
})();
