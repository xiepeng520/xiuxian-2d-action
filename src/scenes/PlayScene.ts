import Phaser from 'phaser';
import { GAME, STAGE, realmFromTotal } from '../config';
import { Hitstop } from '../combat/Hitstop';
import { Player } from '../entities/Player';
import { Grunt } from '../entities/Grunt';
import { Hud } from '../ui/Hud';
import { ResultOverlay } from '../ui/ResultOverlay';
import { cultivationTotal, isSkillUnlocked, loadSave, persistProgress, rematchSave, settlementView, unlockSkill, type SaveV1Data } from '../save/SaveV1';

const ROOM_W = STAGE.roomWidth;
const WORLD_W = ROOM_W * 3;
const GROUND_Y = 640;

export class PlayScene extends Phaser.Scene {
  private player!: Player;
  private foes: Grunt[] = [];
  private hitstop!: Hitstop;
  private hud!: Hud;
  private result!: ResultOverlay;
  private platforms!: Phaser.Physics.Arcade.StaticGroup;
  private lastReal = 0;
  private save!: SaveV1Data;
  private roomAwarded = [false, false];

  constructor() {
    super('PlayScene');
  }

  create(): void {
    this.save = loadSave();
    this.hitstop = new Hitstop(this);
    this.physics.world.setBounds(0, 0, WORLD_W, GAME.height);
    this.cameras.main.setBounds(0, 0, WORLD_W, GAME.height);
    this.cameras.main.setBackgroundColor('#07060c');

    this.paintBackdrop();
    this.platforms = this.physics.add.staticGroup();
    this.buildStage();

    this.player = new Player(this, 180, GROUND_Y - 80, this.save);
    this.foes = [
      new Grunt(this, 420, GROUND_Y - 60, 260, 620, 'grunt'),
      new Grunt(this, 860, GROUND_Y - 60, 700, 1100, 'grunt'),
      new Grunt(this, ROOM_W + 380, GROUND_Y - 60, ROOM_W + 220, ROOM_W + 620, 'grunt'),
      new Grunt(this, ROOM_W + 900, GROUND_Y - 60, ROOM_W + 720, ROOM_W + 1120, 'grunt'),
      new Grunt(this, ROOM_W * 2 + 720, GROUND_Y - 90, ROOM_W * 2 + 480, ROOM_W * 2 + 1100, 'boss'),
    ];

    this.physics.add.collider(this.player.sprite, this.platforms);
    for (const foe of this.foes) {
      this.physics.add.collider(foe.sprite, this.platforms);
    }

    this.cameras.main.startFollow(this.player.sprite, true, 0.16, 0.14);
    this.cameras.main.setDeadzone(36, 48);
    this.cameras.main.setFollowOffset(-this.player.facing * 90, 24);

    const total0 = cultivationTotal(this.save.cultivation);
    this.hud = new Hud(this, total0);
    this.result = new ResultOverlay(this, () => this.rematch());
    this.input.keyboard!.on('keydown-R', () => {
      if (this.result.open) {
        return;
      }
      this.save.checkpoint = { stageId: 'slice_01', spawnId: 'start' };
      this.save.stageProgress = { stageId: 'slice_01', cleared: false };
      this.save.cultivation = { kill: 0, clear: 0, boss: 0 };
      this.commitSave();
      this.scene.restart();
    });

    this.lastReal = this.game.getTime();
  }

  update(): void {
    const now = this.game.getTime();
    const realDelta = Math.min(50, now - this.lastReal);
    this.lastReal = now;
    this.hitstop.update(realDelta);

    if (!this.result.open) {
      this.player.update(now, realDelta);
      for (const foe of this.foes) {
        foe.update(realDelta, this.player.sprite.x, this.player.alive);
      }
      this.resolvePlayerHits();
      this.resolveEnemyHits();
      this.tickRooms();
    }
    this.cameras.main.setFollowOffset(-this.player.facing * 90, 24);

    const total = cultivationTotal(this.save.cultivation);
    this.hud.refresh(
      this.player,
      this.focusedFoe(),
      total,
      this.save.stageProgress.cleared,
      isSkillUnlocked(this.save, 'skill_1'),
      isSkillUnlocked(this.save, 'slash_1'),
    );
    if (this.save.stageProgress.cleared && this.player.alive && !this.result.open) {
      this.result.show(settlementView(this.save));
    }
  }

  private focusedFoe(): Grunt {
    const px = this.player.sprite.x;
    let best = this.foes[0];
    let dist = Infinity;
    for (const foe of this.foes) {
      if (foe.dead) {
        continue;
      }
      const d = Math.abs(foe.sprite.x - px);
      if (d < dist) {
        dist = d;
        best = foe;
      }
    }
    return best;
  }

  private resolvePlayerHits(): void {
    const box = this.player.hitbox;
    if (!box) {
      return;
    }
    for (const foe of this.foes) {
      if (foe.dead) {
        continue;
      }
      const enemyRect = foe.sprite.getBounds();
      if (!Phaser.Geom.Intersects.RectangleToRectangle(box, enemyRect)) {
        continue;
      }
      const result = this.player.consumeHit();
      if (!result) {
        return;
      }
      const killed = foe.takeHit(result.damage, result.knockback, result.stun);
      this.hitstop.trigger(killed ? result.killHitstop : result.hitstop);
      this.burst(foe.sprite.x, foe.sprite.y - 12);
      this.cameras.main.shake(killed ? 180 : 80, killed ? 0.007 : 0.003);
      if (killed && !foe.awarded) {
        foe.awarded = true;
        if (foe.kind === 'boss') {
          this.save.cultivation.boss += STAGE.bossCultivation;
          this.save.stageProgress.cleared = true;
        } else {
          this.save.cultivation.kill += STAGE.killCultivation;
        }
        this.commitSave();
      }
      return;
    }
  }

  private resolveEnemyHits(): void {
    if (!this.player.alive) {
      return;
    }
    const playerRect = this.player.sprite.getBounds();
    for (const foe of this.foes) {
      if (foe.dead) {
        continue;
      }
      const box = foe.attackHitbox;
      if (!box || !Phaser.Geom.Intersects.RectangleToRectangle(box, playerRect)) {
        continue;
      }
      if (!foe.consumePlayerHit()) {
        continue;
      }
      this.player.takeHit(foe.attackDamage, foe.sprite.x);
      this.cameras.main.shake(90, 0.004);
      return;
    }
  }

  private tickRooms(): void {
    if (!this.player.alive) {
      return;
    }
    const rooms: Grunt[][] = [
      this.foes.filter((f) => f.kind === 'grunt' && f.sprite.x < ROOM_W),
      this.foes.filter((f) => f.kind === 'grunt' && f.sprite.x >= ROOM_W && f.sprite.x < ROOM_W * 2),
    ];
    rooms.forEach((group, i) => {
      if (this.roomAwarded[i] || group.length === 0) {
        return;
      }
      if (group.every((f) => f.dead)) {
        this.roomAwarded[i] = true;
        this.save.cultivation.clear += STAGE.clearCultivation;
        this.commitSave();
      }
    });
  }

  private rematch(): void {
    this.save = rematchSave(this.save);
    this.scene.restart();
  }

  private commitSave(): void {
    persistProgress(this.save);
    const total = cultivationTotal(this.save.cultivation);
    if (realmFromTotal(total) >= 2) {
      this.save = unlockSkill(this.save, 'skill_1');
    }
    if (realmFromTotal(total) >= 3) {
      for (const id of ['slash_1', 'slash_2', 'slash_3'] as const) {
        this.save = unlockSkill(this.save, id);
      }
    }
    this.player.bindSave(this.save);
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
    this.solid(ROOM_W / 2, GROUND_Y + 40, ROOM_W, 80, 0x3a4048);
    this.solid(ROOM_W + ROOM_W / 2, GROUND_Y + 40, ROOM_W, 80, 0x1c1828);
    this.solid(ROOM_W * 2 + ROOM_W / 2, GROUND_Y + 40, ROOM_W, 80, 0x0c0a10);

    this.add.rectangle(0, GROUND_Y + 4, ROOM_W, 3, 0x8a96a4, 0.45).setOrigin(0, 0).setDepth(2);
    this.add.rectangle(ROOM_W, GROUND_Y + 4, ROOM_W, 3, 0x6b5a9a, 0.25).setOrigin(0, 0).setDepth(2);
    this.add.rectangle(ROOM_W * 2, GROUND_Y + 6, ROOM_W, 5, 0xd4af37, 0.85).setOrigin(0, 0).setDepth(2);

    this.solid(360, 500, 200, 18, 0x4a5158);
    this.solid(980, 470, 180, 18, 0x454c54);

    this.solid(ROOM_W + 300, 520, 160, 16, 0x16122a);
    this.solid(ROOM_W + 560, 430, 140, 16, 0x141028);
    this.solid(ROOM_W + 820, 360, 130, 16, 0x12101f);
    this.solid(ROOM_W + 1080, 470, 170, 16, 0x16122a);
    this.silhouette(ROOM_W + 240, 390, 90, 10);
    this.silhouette(ROOM_W + 700, 300, 110, 10);
    this.silhouette(ROOM_W + 980, 250, 80, 10);

    this.solid(ROOM_W * 2 + 420, 500, 180, 18, 0x141018);
    this.solid(ROOM_W * 2 + 980, 480, 160, 18, 0x141018);
  }

  private silhouette(x: number, y: number, w: number, h: number): void {
    this.add.rectangle(x, y, w, h, 0x0a0814, 0.85).setDepth(3);
  }

  private solid(x: number, y: number, w: number, h: number, color: number): void {
    const rect = this.add.rectangle(x, y, w, h, color, 1).setDepth(4);
    rect.setStrokeStyle(1, 0x6b5a3a, 0.35);
    this.physics.add.existing(rect, true);
    this.platforms.add(rect);
    const body = rect.body as Phaser.Physics.Arcade.StaticBody;
    body.updateFromGameObject();
  }

  private paintBackdrop(): void {
    const g = this.add.graphics().setScrollFactor(0.08).setDepth(0);
    g.fillGradientStyle(0x0a0814, 0x0a0814, 0x1a1030, 0x120c22, 1);
    g.fillRect(-200, 0, WORLD_W + 400, GAME.height);

    const dim = this.add.rectangle(ROOM_W * 2 + ROOM_W / 2, GAME.height / 2, ROOM_W, GAME.height, 0x000000, 0.28);
    dim.setDepth(1);

    for (let i = 0; i < 16; i++) {
      const hx = 80 + i * 240;
      const peak = 220 + (i % 3) * 50;
      const mountain = this.add.triangle(hx, GROUND_Y - 40, -160, peak, 160, peak, 0, 0, 0x0c0a16, 0.9);
      mountain.setScrollFactor(0.2 + (i % 3) * 0.05).setDepth(1);
    }

    const mist = this.add.graphics().setScrollFactor(0.35).setDepth(2);
    mist.fillStyle(0x8a7aaa, 0.1);
    for (let i = 0; i < 10; i++) {
      mist.fillEllipse(ROOM_W + 80 + i * 120, GROUND_Y - 90 - (i % 3) * 30, 280, 70);
    }
  }
}
