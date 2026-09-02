import Phaser from 'phaser';
import { ENEMY, GAME, STAGE } from '../config';
import { Hitstop } from '../combat/Hitstop';
import { Player } from '../entities/Player';
import { Grunt } from '../entities/Grunt';
import { Hud } from '../ui/Hud';
import { cultivationTotal, loadSave, persistProgress, type SaveV1Data } from '../save/SaveV1';

const WORLD_W = 1800;
const GROUND_Y = 640;

export class PlayScene extends Phaser.Scene {
  private player!: Player;
  private grunt!: Grunt;
  private hitstop!: Hitstop;
  private hud!: Hud;
  private platforms!: Phaser.Physics.Arcade.StaticGroup;
  private lastReal = 0;
  private save!: SaveV1Data;
  private awardedKill = false;

  constructor() {
    super('PlayScene');
  }

  create(): void {
    this.save = loadSave();
    this.awardedKill = this.save.cultivation.kill > 0;
    this.hitstop = new Hitstop(this);
    this.physics.world.setBounds(0, 0, WORLD_W, GAME.height);
    this.cameras.main.setBounds(0, 0, WORLD_W, GAME.height);
    this.cameras.main.setBackgroundColor('#07060c');

    this.paintBackdrop();
    this.platforms = this.physics.add.staticGroup();
    this.buildStage();

    const spawnX = 180;
    this.player = new Player(this, spawnX, GROUND_Y - 80, this.save);
    this.grunt = new Grunt(this, 920, GROUND_Y - 60, 700, 1200);

    this.physics.add.collider(this.player.sprite, this.platforms);
    this.physics.add.collider(this.grunt.sprite, this.platforms);

    this.cameras.main.startFollow(this.player.sprite, true, 0.16, 0.14);
    this.cameras.main.setDeadzone(36, 48);
    this.cameras.main.setFollowOffset(-this.player.facing * 90, 24);

    this.hud = new Hud(this);
    this.input.keyboard!.on('keydown-R', () => {
      this.save.checkpoint = { stageId: this.save.checkpoint.stageId, spawnId: 'start' };
      this.save.stageProgress = { stageId: this.save.checkpoint.stageId, cleared: false };
      this.save.cultivation = { kill: 0, clear: 0 };
      persistProgress(this.save);
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
    this.grunt.update(realDelta, this.player.sprite.x, this.player.alive);
    this.cameras.main.setFollowOffset(-this.player.facing * 90, 24);

    this.resolvePlayerHits();
    this.resolveEnemyHits();
    this.tickClear();
    this.hud.refresh(this.player, this.grunt, cultivationTotal(this.save.cultivation), this.save.stageProgress.cleared);
  }

  private resolvePlayerHits(): void {
    const box = this.player.hitbox;
    if (!box || this.grunt.dead) {
      return;
    }
    const enemyRect = this.grunt.sprite.getBounds();
    if (!Phaser.Geom.Intersects.RectangleToRectangle(box, enemyRect)) {
      return;
    }
    const result = this.player.consumeHit();
    if (!result) {
      return;
    }
    const killed = this.grunt.takeHit(result.damage, result.knockback, result.stun);
    this.hitstop.trigger(killed ? result.killHitstop : result.hitstop);
    this.burst(this.grunt.sprite.x, this.grunt.sprite.y - 12);
    this.cameras.main.shake(killed ? 180 : 80, killed ? 0.007 : 0.003);
    if (killed && !this.awardedKill) {
      this.awardedKill = true;
      this.save.cultivation.kill += STAGE.killCultivation;
      persistProgress(this.save);
    }
  }

  private resolveEnemyHits(): void {
    if (!this.player.alive || this.grunt.dead) {
      return;
    }
    const box = this.grunt.attackHitbox;
    if (!box) {
      return;
    }
    const playerRect = this.player.sprite.getBounds();
    if (!Phaser.Geom.Intersects.RectangleToRectangle(box, playerRect)) {
      return;
    }
    if (!this.grunt.consumePlayerHit()) {
      return;
    }
    this.player.takeHit(ENEMY.attackDamage, this.grunt.sprite.x);
    this.cameras.main.shake(90, 0.004);
  }

  private tickClear(): void {
    if (this.save.stageProgress.cleared || !this.grunt.dead || !this.player.alive) {
      return;
    }
    this.save.stageProgress.cleared = true;
    this.save.cultivation.clear += STAGE.clearCultivation;
    persistProgress(this.save);
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
    this.solid(420, 500, 220, 22, 0x1a1630);
    this.solid(1280, 470, 240, 22, 0x1a1630);

    this.add.rectangle(0, GROUND_Y + 4, WORLD_W, 3, 0xc9a227, 0.35).setOrigin(0, 0).setDepth(2);

    for (let i = 0; i < 4; i++) {
      const lx = 280 + i * 420;
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

    for (let i = 0; i < 10; i++) {
      const hx = 80 + i * 180;
      const peak = 220 + (i % 3) * 50;
      const mountain = this.add.triangle(hx, GROUND_Y - 40, -160, peak, 160, peak, 0, 0, 0x0c0a16, 0.9);
      mountain.setScrollFactor(0.2 + (i % 3) * 0.05).setDepth(1);
    }

    const mist = this.add.graphics().setScrollFactor(0.35).setDepth(2);
    mist.fillStyle(0x6b5a9a, 0.06);
    for (let i = 0; i < 6; i++) {
      mist.fillEllipse(200 + i * 380, GROUND_Y - 70, 420, 50);
    }
  }
}
