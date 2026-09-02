import Phaser from 'phaser';
import { GAME } from './config';
import { BootScene } from './scenes/BootScene';
import { PlayScene } from './scenes/PlayScene';

const config: Phaser.Types.Core.GameConfig = {
  type: Phaser.AUTO,
  parent: 'game-root',
  backgroundColor: '#09080f',
  width: GAME.width,
  height: GAME.height,
  pixelArt: true,
  antialias: false,
  physics: {
    default: 'arcade',
    arcade: {
      gravity: { x: 0, y: GAME.gravity },
      debug: false,
    },
  },
  scale: {
    mode: Phaser.Scale.FIT,
    autoCenter: Phaser.Scale.CENTER_BOTH,
  },
  scene: [BootScene, PlayScene],
};

new Phaser.Game(config);
