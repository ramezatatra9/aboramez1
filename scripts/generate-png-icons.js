const fs = require('fs');
const path = require('path');
const zlib = require('zlib');

function crc32(buf) {
  let crc = 0xffffffff;
  for (let i = 0; i < buf.length; i++) {
    crc ^= buf[i];
    for (let j = 0; j < 8; j++) {
      crc = (crc >>> 1) ^ (crc & 1 ? 0xedb88320 : 0);
    }
  }
  return (crc ^ 0xffffffff) >>> 0;
}

function makeChunk(type, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length, 0);
  const t = Buffer.from(type, 'ascii');
  const crc = Buffer.alloc(4);
  const crcVal = crc32(Buffer.concat([t, data]));
  crc.writeUInt32BE(crcVal, 0);
  return Buffer.concat([len, t, data, crc]);
}

function createPngBuffer(width, height, drawFn) {
  const sig = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
  const ihdrData = Buffer.alloc(13);
  ihdrData.writeUInt32BE(width, 0);
  ihdrData.writeUInt32BE(height, 4);
  ihdrData[8] = 8; // 8-bit depth
  ihdrData[9] = 6; // RGBA
  ihdrData[10] = 0;
  ihdrData[11] = 0;
  ihdrData[12] = 0;
  const ihdr = makeChunk('IHDR', ihdrData);

  // Buffer: width * height * 4
  const pixels = Buffer.alloc(width * height * 4);
  drawFn(pixels, width, height);

  const rawRows = [];
  for (let y = 0; y < height; y++) {
    const row = Buffer.alloc(1 + width * 4);
    row[0] = 0; // Filter: None
    pixels.copy(row, 1, y * width * 4, (y + 1) * width * 4);
    rawRows.push(row);
  }

  const compressed = zlib.deflateSync(Buffer.concat(rawRows), { level: 9 });
  const idat = makeChunk('IDAT', compressed);
  const iend = makeChunk('IEND', Buffer.alloc(0));

  return Buffer.concat([sig, ihdr, idat, iend]);
}

function setPixel(buf, w, h, x, y, r, g, b, a = 255) {
  if (x < 0 || x >= w || y < 0 || y >= h) return;
  const idx = (y * w + x) * 4;
  if (a === 255) {
    buf[idx] = r;
    buf[idx + 1] = g;
    buf[idx + 2] = b;
    buf[idx + 3] = 255;
  } else {
    // Alpha blending
    const sa = a / 255;
    const da = (buf[idx + 3] / 255) * (1 - sa);
    const oa = sa + da;
    if (oa > 0) {
      buf[idx] = Math.round((r * sa + buf[idx] * da) / oa);
      buf[idx + 1] = Math.round((g * sa + buf[idx + 1] * da) / oa);
      buf[idx + 2] = Math.round((b * sa + buf[idx + 2] * da) / oa);
      buf[idx + 3] = Math.round(oa * 255);
    }
  }
}

function drawIcon(pixels, size, isMaskable = false) {
  const w = size;
  const h = size;
  const s = size / 512; // scale relative to 512

  // Background Gradient (Deep Blue to Royal Blue)
  for (let y = 0; y < h; y++) {
    const t = y / h;
    const r = Math.round(30 * (1 - t) + 37 * t);
    const g = Math.round(58 * (1 - t) + 99 * t);
    const b = Math.round(138 * (1 - t) + 235 * t);
    for (let x = 0; x < w; x++) {
      let alpha = 255;
      if (!isMaskable) {
        // Rounded corner mask
        const cornerR = 100 * s;
        let dx = 0;
        let dy = 0;
        if (x < cornerR) dx = cornerR - x;
        else if (x > w - cornerR) dx = x - (w - cornerR);
        if (y < cornerR) dy = cornerR - y;
        else if (y > h - cornerR) dy = y - (h - cornerR);

        if (dx > 0 && dy > 0) {
          const dist = Math.sqrt(dx * dx + dy * dy);
          if (dist > cornerR) {
            alpha = 0;
          } else if (dist > cornerR - 1) {
            alpha = Math.round((cornerR - dist) * 255);
          }
        }
      }
      if (alpha > 0) {
        setPixel(pixels, w, h, x, y, r, g, b, alpha);
      }
    }
  }

  // Draw Shopping Bag Handle (arc)
  const handleCx = Math.round(256 * s);
  const handleCy = Math.round(160 * s);
  const handleRx = Math.round(58 * s);
  const handleRy = Math.round(50 * s);
  const handleThick = Math.round(18 * s);

  for (let y = handleCy - handleRy - handleThick; y <= handleCy; y++) {
    for (let x = handleCx - handleRx - handleThick; x <= handleCx + handleRx + handleThick; x++) {
      const dx = (x - handleCx) / handleRx;
      const dy = (y - handleCy) / handleRy;
      const d = Math.sqrt(dx * dx + dy * dy);
      if (d >= 0.75 && d <= 1.25 && y <= handleCy) {
        setPixel(pixels, w, h, x, y, 255, 255, 255, 255);
      }
    }
  }

  // Draw White Bag Body (Rounded Rectangle)
  const bagX = Math.round(124 * s);
  const bagY = Math.round(168 * s);
  const bagW = Math.round(264 * s);
  const bagH = Math.round(230 * s);
  const bagR = Math.round(28 * s);

  for (let y = bagY; y < bagY + bagH; y++) {
    for (let x = bagX; x < bagX + bagW; x++) {
      let inside = true;
      let dx = 0;
      let dy = 0;
      if (x < bagX + bagR) dx = bagX + bagR - x;
      else if (x > bagX + bagW - bagR) dx = x - (bagX + bagW - bagR);
      if (y < bagY + bagR) dy = bagY + bagR - y;
      else if (y > bagY + bagH - bagR) dy = y - (bagY + bagH - bagR);

      if (dx > 0 && dy > 0) {
        if (Math.sqrt(dx * dx + dy * dy) > bagR) inside = false;
      }
      if (inside) {
        setPixel(pixels, w, h, x, y, 255, 255, 255, 255);
      }
    }
  }

  // Draw Barcode on Bag
  const barY = Math.round(210 * s);
  const barH = Math.round(52 * s);
  const barDefs = [
    { x: 160, w: 8, col: [37, 99, 235] },
    { x: 176, w: 16, col: [30, 64, 175] },
    { x: 200, w: 6, col: [37, 99, 235] },
    { x: 214, w: 12, col: [59, 130, 246] },
    { x: 234, w: 18, col: [30, 64, 175] },
    { x: 260, w: 8, col: [37, 99, 235] },
    { x: 276, w: 14, col: [59, 130, 246] },
    { x: 298, w: 8, col: [30, 64, 175] },
    { x: 314, w: 18, col: [37, 99, 235] },
    { x: 340, w: 12, col: [59, 130, 246] }
  ];

  barDefs.forEach(b => {
    const startX = Math.round(b.x * s);
    const barWidth = Math.max(1, Math.round(b.w * s));
    for (let by = barY; by < barY + barH; by++) {
      for (let bx = startX; bx < startX + barWidth; bx++) {
        setPixel(pixels, w, h, bx, by, b.col[0], b.col[1], b.col[2], 255);
      }
    }
  });

  // Draw bottom badges/stripes on bag
  const stripeY = Math.round(290 * s);
  const stripeH = Math.round(8 * s);
  for (let y = stripeY; y < stripeY + stripeH; y++) {
    for (let x = Math.round(160 * s); x < Math.round(352 * s); x++) {
      setPixel(pixels, w, h, x, y, 16, 185, 129, 255); // Green stripe
    }
  }

  const stripe2Y = Math.round(310 * s);
  const stripe2H = Math.round(6 * s);
  for (let y = stripe2Y; y < stripe2Y + stripe2H; y++) {
    for (let x = Math.round(180 * s); x < Math.round(332 * s); x++) {
      setPixel(pixels, w, h, x, y, 245, 158, 11, 255); // Gold stripe
    }
  }

  // Draw Green Success Badge at Top Right
  const badgeCx = Math.round(410 * s);
  const badgeCy = Math.round(100 * s);
  const badgeR = Math.round(36 * s);

  for (let y = badgeCy - badgeR; y <= badgeCy + badgeR; y++) {
    for (let x = badgeCx - badgeR; x <= badgeCx + badgeR; x++) {
      const dist = Math.sqrt((x - badgeCx) ** 2 + (y - badgeCy) ** 2);
      if (dist <= badgeR) {
        if (dist >= badgeR - Math.round(6 * s)) {
          // White border
          setPixel(pixels, w, h, x, y, 255, 255, 255, 255);
        } else {
          // Green fill
          setPixel(pixels, w, h, x, y, 16, 185, 129, 255);
        }
      }
    }
  }

  // Checkmark inside green badge
  const checkThick = Math.max(2, Math.round(6 * s));
  for (let t = 0; t <= 12 * s; t++) {
    const cx1 = Math.round(badgeCx - 14 * s + t);
    const cy1 = Math.round(badgeCy - 2 * s + t);
    for (let ox = -checkThick; ox <= checkThick; ox++) {
      for (let oy = -checkThick; oy <= checkThick; oy++) {
        setPixel(pixels, w, h, cx1 + ox, cy1 + oy, 255, 255, 255, 255);
      }
    }
  }
  for (let t = 0; t <= 24 * s; t++) {
    const cx2 = Math.round(badgeCx - 2 * s + t);
    const cy2 = Math.round(badgeCy + 10 * s - t * 1.2);
    for (let ox = -checkThick; ox <= checkThick; ox++) {
      for (let oy = -checkThick; oy <= checkThick; oy++) {
        setPixel(pixels, w, h, cx2 + ox, cy2 + oy, 255, 255, 255, 255);
      }
    }
  }
}

// Generate all required icons
const targets = [
  { file: 'icon-192x192.png', size: 192, maskable: false },
  { file: 'icon-512x512.png', size: 512, maskable: false },
  { file: 'icon-maskable-512x512.png', size: 512, maskable: true },
  { file: 'apple-touch-icon.png', size: 180, maskable: false },
  { file: 'favicon-64x64.png', size: 64, maskable: false }
];

const outDir = path.join(__dirname, '..', 'public', 'icons');
if (!fs.existsSync(outDir)) {
  fs.mkdirSync(outDir, { recursive: true });
}

targets.forEach(t => {
  const buf = createPngBuffer(t.size, t.size, (pixels, w, h) => drawIcon(pixels, t.size, t.maskable));
  const dest = path.join(outDir, t.file);
  fs.writeFileSync(dest, buf);
  console.log(`Generated ${t.file} (${buf.length} bytes, ${t.size}x${t.size})`);
});
