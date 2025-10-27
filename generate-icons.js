// Node.js script to generate PNG icons using Canvas
const fs = require('fs');
const { createCanvas } = require('canvas');

function drawIcon(ctx, size) {
  // Clear canvas
  ctx.clearRect(0, 0, size, size);

  // Background gradient
  const gradient = ctx.createLinearGradient(0, 0, size, size);
  gradient.addColorStop(0, '#4A90E2');
  gradient.addColorStop(1, '#357ABD');
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, size, size);

  // Add border
  ctx.strokeStyle = '#2E5C8A';
  ctx.lineWidth = Math.max(1, size / 32);
  ctx.strokeRect(0, 0, size, size);

  // Draw bat wings icon (simplified)
  const padding = size * 0.2;
  const centerX = size / 2;
  const centerY = size / 2;

  ctx.fillStyle = '#FFFFFF';

  // Left wing
  ctx.beginPath();
  ctx.moveTo(padding, centerY);
  ctx.quadraticCurveTo(centerX - padding/2, centerY - padding/2, centerX, centerY);
  ctx.quadraticCurveTo(centerX - padding/2, centerY + padding/2, padding, centerY);
  ctx.fill();

  // Right wing
  ctx.beginPath();
  ctx.moveTo(size - padding, centerY);
  ctx.quadraticCurveTo(centerX + padding/2, centerY - padding/2, centerX, centerY);
  ctx.quadraticCurveTo(centerX + padding/2, centerY + padding/2, size - padding, centerY);
  ctx.fill();

  // Center circle (represents chat/message)
  ctx.beginPath();
  ctx.arc(centerX, centerY, size * 0.15, 0, Math.PI * 2);
  ctx.fillStyle = '#FFD700';
  ctx.fill();

  // Add "WS" text for WebSocket (only visible on larger icons)
  if (size >= 48) {
    ctx.fillStyle = '#FFFFFF';
    ctx.font = `bold ${size * 0.25}px Arial`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('WS', centerX, centerY);
  }

  // Add glow effect
  ctx.shadowColor = 'rgba(255, 215, 0, 0.5)';
  ctx.shadowBlur = size * 0.1;
  ctx.strokeStyle = '#FFD700';
  ctx.lineWidth = Math.max(1, size / 64);
  ctx.strokeRect(padding/2, padding/2, size - padding, size - padding);
}

// Generate icons
const sizes = [16, 48, 128];

sizes.forEach(size => {
  const canvas = createCanvas(size, size);
  const ctx = canvas.getContext('2d');

  drawIcon(ctx, size);

  // Save as PNG
  const buffer = canvas.toBuffer('image/png');
  fs.writeFileSync(`icon${size}.png`, buffer);

  console.log(`Generated icon${size}.png`);
});

console.log('All icons generated successfully!');