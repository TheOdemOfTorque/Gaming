const { createCanvas } = require('canvas');
const fs = require('fs');
const path = require('path');

function drawStar(ctx, cx, cy, outerR, innerR, points) {
  const step = Math.PI / points;
  ctx.beginPath();
  for (let i = 0; i < points * 2; i++) {
    const r = i % 2 === 0 ? outerR : innerR;
    const angle = i * step - Math.PI / 2;
    const x = cx + r * Math.cos(angle);
    const y = cy + r * Math.sin(angle);
    i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
  }
  ctx.closePath();
}

function generateIcon(size) {
  const canvas = createCanvas(size, size);
  const ctx = canvas.getContext('2d');

  // Background: pure black with rounded corners
  ctx.fillStyle = '#000000';
  ctx.beginPath();
  ctx.roundRect(0, 0, size, size, size * 0.22);
  ctx.fill();

  const cx = size / 2;
  const cy = size / 2 + size * 0.03;
  const outerR = size * 0.38;
  const innerR = size * 0.16;

  // Outer glow
  ctx.shadowColor = 'rgba(255, 210, 50, 0.5)';
  ctx.shadowBlur = size * 0.12;
  drawStar(ctx, cx, cy, outerR, innerR, 5);
  const glow = ctx.createRadialGradient(cx, cy - outerR * 0.1, 0, cx, cy, outerR);
  glow.addColorStop(0, '#fff7a0');
  glow.addColorStop(0.35, '#ffd700');
  glow.addColorStop(0.7, '#f0a000');
  glow.addColorStop(1, '#c07000');
  ctx.fillStyle = glow;
  ctx.fill();
  ctx.shadowBlur = 0;

  // Sparkle triangles (top-left and top-right of star)
  const sparkleColor = '#ffe566';
  const sp = size * 0.08;
  function sparkle(x, y, angle) {
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(angle);
    ctx.beginPath();
    ctx.moveTo(0, -sp);
    ctx.lineTo(sp * 0.28, 0);
    ctx.lineTo(0, sp * 0.5);
    ctx.lineTo(-sp * 0.28, 0);
    ctx.closePath();
    ctx.fillStyle = sparkleColor;
    ctx.shadowColor = '#fff200';
    ctx.shadowBlur = size * 0.03;
    ctx.fill();
    ctx.restore();
  }
  sparkle(cx - outerR * 0.62, cy - outerR * 0.72, -0.3);
  sparkle(cx + outerR * 0.62, cy - outerR * 0.72, 0.3);

  return canvas;
}

const outDir = path.join(__dirname, '..', '1x1-trainer');

[192, 512].forEach(size => {
  const canvas = generateIcon(size);
  const buf = canvas.toBuffer('image/png');
  const outPath = path.join(outDir, `icon-${size}.png`);
  fs.writeFileSync(outPath, buf);
  console.log(`Generated ${outPath}`);
});
