const fs = require('fs');
const { createCanvas } = require('canvas');

function generateIcon(size) {
  const canvas = createCanvas(size, size);
  const ctx = canvas.getContext('2d');
  
  // 背景渐变
  const gradient = ctx.createLinearGradient(0, 0, size, size);
  gradient.addColorStop(0, '#667eea');
  gradient.addColorStop(1, '#764ba2');
  
  // 圆角矩形背景
  ctx.fillStyle = gradient;
  roundRect(ctx, 0, 0, size, size, size * 0.2);
  ctx.fill();
  
  // 机器人图标
  ctx.fillStyle = 'white';
  const centerX = size / 2;
  const centerY = size / 2;
  const scale = size / 48;
  
  // 头部
  ctx.beginPath();
  roundRect(ctx, centerX - 12*scale, centerY - 14*scale, 24*scale, 20*scale, 4*scale);
  ctx.fill();
  
  // 眼睛
  ctx.fillStyle = '#667eea';
  ctx.beginPath();
  ctx.arc(centerX - 5*scale, centerY - 4*scale, 3*scale, 0, Math.PI * 2);
  ctx.arc(centerX + 5*scale, centerY - 4*scale, 3*scale, 0, Math.PI * 2);
  ctx.fill();
  
  // 身体
  ctx.fillStyle = 'white';
  ctx.beginPath();
  roundRect(ctx, centerX - 10*scale, centerY + 8*scale, 20*scale, 10*scale, 3*scale);
  ctx.fill();
  
  // 天线
  ctx.strokeStyle = 'white';
  ctx.lineWidth = 2 * scale;
  ctx.beginPath();
  ctx.moveTo(centerX, centerY - 14*scale);
  ctx.lineTo(centerX, centerY - 20*scale);
  ctx.stroke();
  
  ctx.beginPath();
  ctx.arc(centerX, centerY - 22*scale, 2*scale, 0, Math.PI * 2);
  ctx.fill();
  
  return canvas.toBuffer('image/png');
}

function roundRect(ctx, x, y, width, height, radius) {
  ctx.beginPath();
  ctx.moveTo(x + radius, y);
  ctx.lineTo(x + width - radius, y);
  ctx.quadraticCurveTo(x + width, y, x + width, y + radius);
  ctx.lineTo(x + width, y + height - radius);
  ctx.quadraticCurveTo(x + width, y + height, x + width - radius, y + height);
  ctx.lineTo(x + radius, y + height);
  ctx.quadraticCurveTo(x, y + height, x, y + height - radius);
  ctx.lineTo(x, y + radius);
  ctx.quadraticCurveTo(x, y, x + radius, y);
  ctx.closePath();
}

// 生成各尺寸图标
[16, 32, 48, 128].forEach(size => {
  const buffer = generateIcon(size);
  fs.writeFileSync(`icon${size}.png`, buffer);
  console.log(`Generated icon${size}.png`);
});
