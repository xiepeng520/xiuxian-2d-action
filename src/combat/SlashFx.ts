import Phaser from 'phaser';

const CYAN = 0xcfe8ff;
const WHITE = 0xffffff;

export type SlashStyle = 'vert' | 'horiz' | 'heavy' | 'qi';

/** Rect placeholders. First set vertical, slash_* horizontal. No new hitstop 130/150 for slash. */
export class SlashFx {
  private readonly scene: Phaser.Scene;
  private readonly barA: Phaser.GameObjects.Rectangle;
  private readonly barB: Phaser.GameObjects.Rectangle;
  private readonly ring: Phaser.GameObjects.Arc;
  private readonly pillar: Phaser.GameObjects.Rectangle;
  private shook = false;

  constructor(scene: Phaser.Scene) {
    this.scene = scene;
    this.barA = scene.add.rectangle(0, 0, 54, 4, CYAN, 0.95).setDepth(12).setVisible(false);
    this.barB = scene.add.rectangle(0, 0, 42, 3, WHITE, 0.85).setDepth(13).setVisible(false);
    this.ring = scene.add.circle(0, 0, 18, CYAN, 0).setStrokeStyle(2, WHITE, 0.9).setDepth(12).setVisible(false);
    this.pillar = scene.add.rectangle(0, 0, 18, 150, CYAN, 0.92).setDepth(12).setVisible(false);
  }

  hide(): void {
    this.barA.setVisible(false);
    this.barB.setVisible(false);
    this.ring.setVisible(false);
    this.pillar.setVisible(false);
    this.shook = false;
  }

  sync(active: boolean, hitstop: number, x: number, y: number, facing: number, style: SlashStyle): void {
    if (!active) {
      this.hide();
      return;
    }
    if (style === 'qi' || hitstop >= 150) {
      this.barA.setVisible(false);
      this.barB.setVisible(false);
      this.ring.setVisible(false);
      this.pillar.setFillStyle(CYAN, 0.92);
      this.pillar.setSize(16, 150);
      this.pillar.setPosition(x + facing * 42, y - 36);
      this.pillar.setVisible(true);
      return;
    }
    this.pillar.setVisible(false);

    if (style === 'vert') {
      const third = hitstop >= 100;
      this.barA.setSize(third ? 8 : 6, third ? 72 : 56);
      this.barA.setFillStyle(CYAN, 0.95);
      this.barA.setRotation(0);
      this.barA.setPosition(x + facing * 28, y - 8);
      this.barA.setVisible(true);
      this.barB.setSize(4, third ? 52 : 40);
      this.barB.setFillStyle(WHITE, 0.9);
      this.barB.setRotation(0);
      this.barB.setPosition(x + facing * 40, y);
      this.barB.setVisible(true);
      if (third) {
        this.ring.setPosition(x + facing * 48, y);
        this.ring.setRadius(20);
        this.ring.setVisible(true);
      } else {
        this.ring.setVisible(false);
      }
      return;
    }

    if (style === 'horiz') {
      const third = hitstop >= 100;
      const w = third ? 86 : 64;
      this.barA.setSize(w, third ? 8 : 5);
      this.barA.setFillStyle(CYAN, 0.95);
      this.barA.setRotation(0);
      this.barA.setPosition(x + facing * 44, y - 6);
      this.barA.setVisible(true);
      this.barB.setSize(third ? 70 : 50, 3);
      this.barB.setFillStyle(WHITE, 0.9);
      this.barB.setRotation(0);
      this.barB.setPosition(x + facing * 40, y + 8);
      this.barB.setVisible(true);
      this.ring.setVisible(false);
      return;
    }

    const heavy = style === 'heavy' || hitstop >= 130;
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
    this.ring.setVisible(false);
    if (heavy && !this.shook) {
      this.shook = true;
      this.scene.cameras.main.shake(70, 0.003);
    }
  }
}
