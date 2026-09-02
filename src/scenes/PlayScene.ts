import Phaser from 'phaser';
import { GAME } from '../config';
import { Hitstop } from '../combat/Hitstop';
import { Player } from '../entities/Player';
import { Dummy } from '../entities/Dummy';
import { Hud } from '../ui/Hud';
import { loadSave, saveSave } from '../save/SaveV1';

const WORLD_W = 3200;
const GROUND_Y = 640;

export class PlayScene extends Phaser.Scene {
  private player!: Player;
  private dummy!: Dummy;
  private hitstop!: Hitstop;
  private hud!: Hud;
  private platforms!: Phaser.Physics.Arcade.StaticGroup;
  private lastReal = 0;

  constructor() {
    super('PlayScene');
  }

  create(): void {
    const save = loadSave();
    this.hitstop = new Hitstop(this);
    this.physics.world.setBounds(0, 0, WORLD_W, GAME.height);
    this.cameras.main.setBounds(0, 0, WORLD_W, GAME.height);
    this.cameras.main.setBackgroundColor('#07060c');

    this.paintBackdrop();
    this.platforms = this.physics.add.staticGroup();
    this.buildStage();

    const spawnX = save.checkpoint.spawnId === 'start' ? 180 : 180;
    this.player = new Player(this, spawnX, GROUND_Y - 80, save);
    this.dummy = new Dummy(this, 980, GROUND_Y - 80, 820, 1180);

    this.physics.add.collider(this.player.sprite, this.platforms);
    this.physics.add.collider(this.dummy.sprite, this.platforms);
    this.physics.add.overlap(this.player.sprite, this.dummy.sprite, () => {
      if (this.dummy.dead || !this.player.alive) {
        return;
      }
      if (this.player.state === 'light' || this.player.state === 'heavy' || this.player.state === 'hurt') {
        return;
      }
      this.player.takeHit(8, this.dummy.sprite.x);
    });

    this.cameras.main.startFollow(this.player.sprite, true, 0.12, 0.12);
    this.cameras.main.setDeadzone(80, 60);

    this.hud = new Hud(this);
    this.input.keyboard!.on('keydown-R', () => {
      const next = loadSave();
      next.character.hp = next.character.hp || 100;
      saveSave(next);
      this.scene.restart();
    });

    this.lastReal = this.game.getTime();
  }

  update(): void {
    const now = this.game.getTime();
    const realDelta = Math.min(50, now - this.lastReal);
    this.lastReal = now;
    this.hitstop.update(realDelta);

    this.player.update(now, realDelta);
    this.dummy.update(realDelta);
    this.resolveHits();
    this.hud.refresh(this.player, this.dummy);
  }

  private resolveHits(): void {
    const box = this.player.hitbox;
    if (!box || this.dummy.dead) {
      return;
    }
    const dummyRect = this.dummy.sprite.getBounds();
    if (!Phaser.Geom.Intersects.RectangleToRectangle(box, dummyRect)) {
      return;
    }
    const result = this.player.consumeHit();
    if (!result) {
      return;
    }
    const killed = this.dummy.takeHit(result.damage, result.knockback, result.stun);
    this.hitstop.trigger(killed ? result.killHitstop : result.hitstop);
    this.burst(this.dummy.sprite.x, this.dummy.sprite.y - 20);
    this.cameras.main.shake(killed ? 160 : 70, killed ? 0.006 : 0.002);
  }

  private burst(x: number, y: number): void {
    for (let i = 0; i < 8; i++) {
      const p = this.add.image(x, y, 'spark').setDepth(20);
      this.tweens.add({
        targets: p,
        x: x + Phaser.Math.Between(-40, 40),
        y: y + Phaser.Math.Between(-30, 20),
        alpha: 0,
        scale: 0.2,
        duration: 280,
        onComplete: () => p.destroy(),
      });
    }
  }

  private buildStage(): void {
    this.solid(WORLD_W / 2, GROUND_Y + 40, WORLD_W, 80, 0x12101c);
    this.solid(400, 480, 260, 22, 0x1a1630);
    this.solid(1480, 430, 320, 22, 0x1a1630);
    this.solid(2100, 360, 220, 22, 0x1c1834);
    this.solid(2680, 500, 280, 22, 0x1a1630);

    this.add.rectangle(0, GROUND_Y + 4, WORLD_W, 3, 0xc9a227, 0.35).setOrigin(0, 0).setDepth(2);

    for (let i = 0; i < 6; i++) {
      const lx = 280 + i * 480;
      const lamp = this.add.rectangle(lx, GROUND_Y - 90, 6, 90, 0x2a2038, 1).setOrigin(0.5, 1);
      this.add.circle(lx, GROUND_Y - 96, 10, 0xffd27a, 0.85);
      this.add.circle(lx, GROUND_Y - 96, 42, 0xffb347, 0.07);
      lamp.setDepth(3);
    }
  }

  private solid(x: number, y: number, w: number, h: number, color: number): void {
    const rect = this.add.rectangle(x, y, w, h, color, 1).setDepth(4);
    rect.setStrokeStyle(1, 0x6b5a3a, 0.4);
    this.physics.add.existing(rect, true);
    this.platforms.add(rect);
    const body = rect.body as Phaser.Physics.Arcade.StaticBody;
    body.updateFromGameObject();
  }

  private paintBackdrop(): void {
    const g = this.add.graphics().setScrollFactor(0.08).setDepth(0);
    g.fillGradientStyle(0x0a0814, 0x0a0814, 0x1a1030, 0x120c22, 1);
    g.fillRect(-200, 0, WORLD_W + 400, GAME.height);

    const moon = this.add.circle(980, 120, 54, 0xe8dff0, 0.9).setScrollFactor(0.12).setDepth(0);
    this.add.circle(moon.x, moon.y, 90, 0xb8a0d0, 0.08).setScrollFactor(0.12).setDepth(0);

    for (let i = 0; i < 18; i++) {
      const hx = 80 + i * 180;
      const peak = 220 + (i % 3) * 50;
      const mountain = this.add.triangle(hx, GROUND_Y - 40, -160, peak, 160, peak, 0, 0, 0x0c0a16, 0.9);
      mountain.setScrollFactor(0.2 + (i % 3) * 0.05).setDepth(1);
    }

    const mist = this.add.graphics().setScrollFactor(0.35).setDepth(2);
    mist.fillStyle(0x6b5a9a, 0.06);
    for (let i = 0; i < 8; i++) {
      mist.fillEllipse(200 + i * 380, GROUND_Y - 70, 420, 50);
    }
  }
}
