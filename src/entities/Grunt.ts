import Phaser from 'phaser';
import { BOSS, ENEMY } from '../config';

export type GruntPhase = 'patrol' | 'windup' | 'strike' | 'recover' | 'hurt' | 'dead';
export type EnemyKind = 'grunt' | 'boss';

export interface EnemyStats {
  maxHp: number;
  speed: number;
  bodyWidth: number;
  bodyHeight: number;
  attackRange: number;
  attackDamage: number;
  windupMs: number;
  activeMs: number;
  recoverMs: number;
  flashMs: number;
  stunScale: number;
}

const GRUNT_STATS: EnemyStats = { ...ENEMY, stunScale: 1 };
const BOSS_STATS: EnemyStats = { ...BOSS };

/** Melee foe. Grunt is short-wide; boss is a tall-narrow 36×80 color block. Same state machine. */
export class Grunt {
  readonly sprite: Phaser.Physics.Arcade.Sprite;
  readonly body: Phaser.Physics.Arcade.Body;
  readonly kind: EnemyKind;
  readonly attackDamage: number;
  hp: number;
  maxHp: number;
  dead = false;
  phase: GruntPhase = 'patrol';
  awarded = false;

  private readonly scene: Phaser.Scene;
  private readonly stats: EnemyStats;
  private dir = -1;
  private patrolMin: number;
  private patrolMax: number;
  private stunnedMs = 0;
  private phaseMs = 0;
  private flashMs = 0;
  private hasHitPlayer = false;
  private readonly outline: Phaser.GameObjects.Rectangle;
  private readonly block: Phaser.GameObjects.Rectangle | null;

  constructor(
    scene: Phaser.Scene,
    x: number,
    y: number,
    patrolMin: number,
    patrolMax: number,
    kind: EnemyKind = 'grunt',
  ) {
    this.scene = scene;
    this.kind = kind;
    this.stats = kind === 'boss' ? BOSS_STATS : GRUNT_STATS;
    this.maxHp = this.stats.maxHp;
    this.hp = this.maxHp;
    this.attackDamage = this.stats.attackDamage;
    this.patrolMin = patrolMin;
    this.patrolMax = patrolMax;

    this.sprite = scene.physics.add.sprite(x, y, 'grunt');
    this.sprite.setDepth(9);
    this.body = this.sprite.body as Phaser.Physics.Arcade.Body;
    if (kind === 'boss') {
      this.sprite.setVisible(false);
      this.sprite.setDisplaySize(this.stats.bodyWidth, this.stats.bodyHeight);
      this.body.setSize(this.stats.bodyWidth, this.stats.bodyHeight);
      this.body.setOffset(0, 0);
    } else {
      this.body.setSize(this.stats.bodyWidth, this.stats.bodyHeight);
      this.body.setOffset(
        (this.sprite.width - this.stats.bodyWidth) / 2,
        this.sprite.height - this.stats.bodyHeight,
      );
    }
    this.body.setMaxVelocity(320, 1200);
    this.body.setDragX(600);
    this.sprite.setCollideWorldBounds(true);

    const visW = kind === 'boss' ? this.stats.bodyWidth : this.sprite.displayWidth;
    const visH = kind === 'boss' ? this.stats.bodyHeight : this.sprite.displayHeight;
    this.outline = scene.add
      .rectangle(x, y, visW + 4, visH + 4, 0x000000, 0)
      .setStrokeStyle(2, kind === 'boss' ? 0xd4af37 : 0xe8c48a, 0.95)
      .setDepth(8);

    if (kind === 'boss') {
      this.block = scene.add.rectangle(x, y, visW, visH, 0x2a1a14, 1).setDepth(9);
    } else {
      this.block = null;
    }
  }

  get attackHitbox(): Phaser.Geom.Rectangle | null {
    if (this.dead || this.phase !== 'strike') {
      return null;
    }
    const w = this.kind === 'boss' ? 64 : 56;
    const h = this.kind === 'boss' ? 56 : 40;
    const x = this.dir > 0 ? this.sprite.x + 10 : this.sprite.x - 10 - w;
    return new Phaser.Geom.Rectangle(x, this.sprite.y - h * 0.45, w, h);
  }

  takeHit(damage: number, knockback: number, stun: number): boolean {
    if (this.dead) {
      return false;
    }
    this.hp = Math.max(0, this.hp - damage);
    const applied = Math.floor(stun * this.stats.stunScale);
    this.stunnedMs = Math.max(this.stunnedMs, applied);
    this.phase = 'hurt';
    this.phaseMs = 0;
    this.hasHitPlayer = false;
    this.body.setVelocity(knockback, this.kind === 'boss' ? -140 : -180);
    this.flashMs = this.stats.flashMs;
    this.sprite.setTint(0xffffff);
    this.block?.setFillStyle(0xffffff, 1);
    if (this.hp <= 0) {
      this.die();
      return true;
    }
    return false;
  }

  update(delta: number, playerX: number, playerAlive: boolean): void {
    this.outline.setPosition(this.sprite.x, this.sprite.y);
    this.outline.setAlpha(this.dead ? 0.2 : 0.9);
    this.block?.setPosition(this.sprite.x, this.sprite.y);
    this.block?.setAlpha(this.dead ? 0.4 : 1);

    if (this.flashMs > 0) {
      this.flashMs -= delta;
      this.sprite.setTint(0xffffff);
      this.block?.setFillStyle(0xffffff, 1);
      if (this.flashMs <= 0) {
        this.flashMs = 0;
        if (this.dead) {
          this.sprite.setTint(0x221111);
          this.block?.setFillStyle(0x221111, 1);
        } else {
          this.sprite.clearTint();
          this.block?.setFillStyle(0x2a1a14, 1);
        }
      }
    }

    if (this.dead) {
      this.body.setAccelerationX(0);
      return;
    }

    const scaled = delta * this.scene.time.timeScale;
    if (this.stunnedMs > 0) {
      this.stunnedMs -= scaled;
      this.body.setAccelerationX(0);
      if (this.stunnedMs <= 0 && this.phase === 'hurt') {
        this.phase = 'patrol';
        this.phaseMs = 0;
      }
      return;
    }

    if (this.phase === 'windup' || this.phase === 'strike' || this.phase === 'recover') {
      this.tickAttack(scaled);
      return;
    }

    if (this.sprite.x <= this.patrolMin) {
      this.dir = 1;
    } else if (this.sprite.x >= this.patrolMax) {
      this.dir = -1;
    }

    if (playerAlive) {
      const dx = playerX - this.sprite.x;
      if (Math.abs(dx) < this.stats.attackRange) {
        this.dir = dx >= 0 ? 1 : -1;
        this.sprite.setFlipX(this.dir < 0);
        this.body.setVelocityX(0);
        this.phase = 'windup';
        this.phaseMs = 0;
        this.hasHitPlayer = false;
        this.sprite.setTint(0xc45a3a);
        this.block?.setFillStyle(0x5a2a1a, 1);
        return;
      }
    }

    this.body.setVelocityX(this.dir * this.stats.speed);
    this.sprite.setFlipX(this.dir < 0);
  }

  private tickAttack(scaled: number): void {
    this.phaseMs += scaled;
    this.body.setAccelerationX(0);
    this.sprite.setFlipX(this.dir < 0);

    if (this.phase === 'windup') {
      this.body.setVelocityX(this.dir * 20);
      if (this.phaseMs >= this.stats.windupMs) {
        this.phase = 'strike';
        this.phaseMs = 0;
        this.sprite.clearTint();
        this.block?.setFillStyle(0x2a1a14, 1);
        this.body.setVelocityX(this.dir * (this.kind === 'boss' ? 120 : 160));
      }
      return;
    }

    if (this.phase === 'strike') {
      if (this.phaseMs >= this.stats.activeMs) {
        this.phase = 'recover';
        this.phaseMs = 0;
        this.body.setVelocityX(0);
      }
      return;
    }

    if (this.phaseMs >= this.stats.recoverMs) {
      this.phase = 'patrol';
      this.phaseMs = 0;
    }
  }

  consumePlayerHit(): boolean {
    if (this.hasHitPlayer || !this.attackHitbox) {
      return false;
    }
    this.hasHitPlayer = true;
    return true;
  }

  private die(): void {
    this.dead = true;
    this.phase = 'dead';
    this.body.setVelocity(0, -80);
    this.body.setAcceleration(0, 0);
    this.sprite.setTint(0x221111);
    this.block?.setFillStyle(0x221111, 1);
    this.sprite.setAlpha(0.45);
    this.body.checkCollision.none = true;
  }
}
