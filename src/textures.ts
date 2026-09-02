import Phaser from 'phaser';

function tex(g: Phaser.GameObjects.Graphics, key: string, w: number, h: number): void {
  g.generateTexture(key, w, h);
  g.clear();
}

/** Runtime placeholder sprites: dark stage + glowing spiritual attacks. */
export function createPlaceholderTextures(scene: Phaser.Scene): void {
  const g = scene.make.graphics({ x: 0, y: 0 });

  drawPlayer(g, 'player-idle', 0x6fd6c8, 0x1c3140);
  drawPlayer(g, 'player-run', 0x7ee7d4, 0x24485a);
  drawPlayer(g, 'player-air', 0x9cf0ff, 0x1a3a4c);
  drawPlayer(g, 'player-attack', 0xd8f7ff, 0x2a5068);
  drawPlayer(g, 'player-hurt', 0xff8899, 0x402030);

  g.fillStyle(0x5ee0c0, 0.35);
  g.fillEllipse(32, 44, 48, 20);
  tex(g, 'player-glow', 64, 80);

  drawEnemy(g, 'enemy-idle', 0x8a5a4a, 0x3a241c);
  drawEnemy(g, 'enemy-hurt', 0xf0c070, 0x5a3020);
  drawEnemy(g, 'enemy-dead', 0x4a3a32, 0x241814);

  drawSlash(g, 'slash-1', 0x7ee7ff, 70);
  drawSlash(g, 'slash-2', 0x9cf0ff, 82);
  drawSlash(g, 'slash-3', 0xe8f7ff, 96);
  drawSlash(g, 'slash-heavy', 0xffd27a, 110);
  drawPlayer(g, 'player', 0x6fd6c8, 0x1c3140);
  drawEnemy(g, 'dummy', 0x8a5a4a, 0x3a241c);
  drawSlash(g, 'slash', 0x7ee7ff, 88);

  g.fillStyle(0x14101c, 1);
  g.fillRect(0, 0, 64, 48);
  g.fillStyle(0x1e1828, 1);
  g.fillRect(0, 0, 64, 8);
  g.fillStyle(0x3a2a18, 1);
  g.fillRect(0, 8, 64, 6);
  g.lineStyle(1, 0x2c2438, 0.5);
  g.strokeRect(0, 0, 64, 48);
  tex(g, 'ground', 64, 48);

  g.fillStyle(0x0c0a14, 1);
  g.fillRect(0, 0, 32, 32);
  g.fillStyle(0x161221, 1);
  g.fillRect(4, 4, 10, 22);
  g.fillStyle(0x1c1830, 1);
  g.fillRect(18, 8, 8, 18);
  tex(g, 'bg-far', 32, 32);

  g.fillStyle(0x12101c, 1);
  g.fillRect(0, 0, 48, 96);
  g.fillStyle(0x1a1630, 1);
  g.fillTriangle(0, 96, 24, 8, 48, 96);
  g.fillStyle(0x2a2248, 0.4);
  g.fillCircle(24, 36, 6);
  tex(g, 'bg-peak', 48, 96);

  g.fillStyle(0xb8f0ff, 0.9);
  g.fillCircle(4, 4, 3);
  tex(g, 'spark', 8, 8);
  drawPlayer(g, 'player', 0x6fd6c8, 0x1c3140);
  drawEnemy(g, 'dummy', 0x8a5a4a, 0x3a241c);
  drawSlash(g, 'slash', 0x7ee7ff, 78);

  g.destroy();
}

function drawPlayer(g: Phaser.GameObjects.Graphics, key: string, cloth: number, shade: number): void {
  g.fillStyle(0x000000, 0);
  g.fillRect(0, 0, 64, 88);
  g.fillStyle(shade, 1);
  g.fillRoundedRect(18, 28, 28, 46, 6);
  g.fillStyle(cloth, 1);
  g.fillRoundedRect(20, 18, 24, 40, 8);
  g.fillStyle(0xf2e6d0, 1);
  g.fillCircle(32, 16, 10);
  g.fillStyle(0x1a1010, 1);
  g.fillRoundedRect(22, 6, 20, 12, 4);
  g.fillStyle(0xd4af37, 1);
  g.fillRect(28, 26, 8, 4);
  g.fillStyle(0x9cf0ff, 1);
  g.fillRect(46, 30, 14, 4);
  g.fillTriangle(60, 24, 64, 32, 60, 40);
  tex(g, key, 64, 88);
}

function drawEnemy(g: Phaser.GameObjects.Graphics, key: string, wood: number, dark: number): void {
  g.fillStyle(dark, 1);
  g.fillRoundedRect(16, 22, 32, 52, 4);
  g.fillStyle(wood, 1);
  g.fillRoundedRect(18, 18, 28, 48, 4);
  g.fillStyle(0x2a1810, 1);
  g.fillRect(24, 28, 6, 6);
  g.fillRect(36, 28, 6, 6);
  g.fillStyle(0x6a2018, 0.8);
  g.fillRect(26, 42, 16, 4);
  g.fillStyle(0x704838, 1);
  g.fillRect(12, 36, 10, 8);
  g.fillRect(42, 36, 10, 8);
  tex(g, key, 64, 84);
}

function drawSlash(g: Phaser.GameObjects.Graphics, key: string, color: number, w: number): void {
  g.fillStyle(color, 0.15);
  g.fillEllipse(w / 2, 32, w, 52);
  g.lineStyle(6, color, 0.95);
  g.beginPath();
  g.arc(16, 32, 34, -0.9, 0.9, false);
  g.strokePath();
  g.lineStyle(2, 0xffffff, 0.85);
  g.beginPath();
  g.arc(18, 32, 30, -0.7, 0.7, false);
  g.strokePath();
  tex(g, key, w, 64);
}
