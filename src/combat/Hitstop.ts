import Phaser from 'phaser';

export class Hitstop {
  private remainingMs = 0;
  private readonly scene: Phaser.Scene;

  constructor(scene: Phaser.Scene) {
    this.scene = scene;
  }

  trigger(ms: number): void {
    this.remainingMs = Math.max(this.remainingMs, ms);
    this.apply(0);
  }

  get active(): boolean {
    return this.remainingMs > 0;
  }

  update(realDeltaMs: number): void {
    if (this.remainingMs <= 0) {
      this.apply(1);
      return;
    }
    this.remainingMs -= realDeltaMs;
    if (this.remainingMs <= 0) {
      this.remainingMs = 0;
      this.apply(1);
    } else {
      this.apply(0);
    }
  }

  private apply(scale: number): void {
    this.scene.physics.world.timeScale = scale === 0 ? 0 : 1;
    this.scene.time.timeScale = scale === 0 ? 0 : 1;
    this.scene.tweens.timeScale = scale === 0 ? 0 : 1;
  }
}
