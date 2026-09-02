import Phaser from 'phaser';
import { createPlaceholderTextures } from '../textures';

export class BootScene extends Phaser.Scene {
  constructor() {
    super('boot');
  }

  create(): void {
    createPlaceholderTextures(this);
    this.scene.start('PlayScene');
  }
}
