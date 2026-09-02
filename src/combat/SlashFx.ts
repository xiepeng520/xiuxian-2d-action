import Phaser from 'phaser';

const CYAN = 0xcfe8ff;
const WHITE = 0xffffff;

/** Rect/circle placeholders for light_1/2/3 and heavy_1. No new textures. */
export class SlashFx {
  private readonly scene: Phaser.Scene;
  private readonly barA: Phaser.GameObjects.Rectangle;
  private readonly barB: Phaser.GameObjects.Rectangle;
  private readonly ring: Phaser.GameObjects.Arc;
  private shook = false;

  constructor(scene: Phaser.Scene) {
    this.scene = scene;
    this.barA = scene.add.rectangle(0, 0, 54, 4, CYAN, 0.95).setDepth(12).setVisible(false);
    this.barB = scene.add.rectangle(0, 0, 42, 3, WHITE, 0.85).setDepth(13).setVisible(false);
    this.ring = scene.add.circle(0, 0, 18, CYAN, 0).setStrokeStyle(2, WHITE, 0.9).setDepth(12).setVisible(false);
  }

  hide(): void {
    this.barA.setVisible(false);
    this.barB.setVisible(false);
    this.ring.setVisible(false);
    this.shook = false;
  }

  sync(active: boolean, hitstop: number, x: number, y: number, facing: number): void {
    if (!active) {
      this.hide();
      return;
    }
    const heavy = hitstop >= 130;
    const third = hitstop >= 100 && hitstop < 130;
    const thick = heavy ? 10 : 4;
    const w = heavy ? 78 : 54;
    this.barA.setSize(w, thick);
    this.barA.setFillStyle(CYAN, 0.95);
    this.barA.setPosition(x + facing * (heavy ? 44 : 36), y - 2);
    this.barA.setRotation(facing < 0 ? 0.15 : -0.15);
    this.barA.setVisible(true);

    this.barB.setSize(heavy ? 62 : 42, heavy ? 5 : 3);
    this.barB.setFillStyle(WHITE, 0.9);
    this.barB.setPosition(x + facing * (heavy ? 40 : 32), y + (heavy ? 6 : 8));
    this.barB.setRotation(facing < 0 ? -0.25 : 0.25);
    this.barB.setVisible(true);

    if (third) {
      this.ring.setPosition(x + facing * 48, y);
      this.ring.setRadius(20);
      this.ring.setVisible(true);
    } else {
      this.ring.setVisible(false);
    }

    if (heavy && !this.shook) {
      this.shook = true;
      this.scene.cameras.main.shake(70, 0.003);
    }
  }
}
