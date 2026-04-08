const { createCanvas } = require('canvas');
const fs = require('fs');
const path = require('path');

function generateIcon(size) {
  const canvas = createCanvas(size, size);
  const ctx = canvas.getContext('2d');

  // Background: dark blue-violet with radial gradient
  const bg = ctx.createRadialGradient(size/2, size/2, 0, size/2, size/2, size*0.7);
  bg.addColorStop(0, '#1a1a4e');
  bg.addColorStop(1, '#0d0d2b');
  ctx.fillStyle = bg;
  ctx.beginPath();
  ctx.roundRect(0, 0, size, size, size * 0.22);
  ctx.fill();

  // Glow border: purple #6C63FF
  ctx.strokeStyle = '#6C63FF';
  ctx.lineWidth = size * 0.025;
  ctx.shadowColor = '#6C63FF';
  ctx.shadowBlur = size * 0.04;
  ctx.beginPath();
  ctx.roundRect(size*0.025, size*0.025, size*0.95, size*0.95, size * 0.20);
  ctx.stroke();
  ctx.shadowBlur = 0;

  // "1×1" text — bold white, centered
  const fontSize = size * 0.36;
  ctx.fillStyle = '#ffffff';
  ctx.font = `900 ${fontSize}px Arial, sans-serif`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.shadowColor = 'rgba(108,99,255,0.6)';
  ctx.shadowBlur = size * 0.05;
  ctx.fillText('1\u00d71', size / 2, size * 0.42);
  ctx.shadowBlur = 0;

  // Golden star below
  const starSize = size * 0.18;
  ctx.font = `${starSize}px serif`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText('\u2b50', size / 2, size * 0.72);

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
