import Phaser from 'phaser';
import { ENEMY } from '../config';

export type GruntPhase = 'patrol' | 'windup' | 'strike' | 'recover' | 'hurt' | 'dead';

/** One short, wide melee grunt. Solid fill + outline; 2-frame white flash on hit. */
export class Grunt {
  readonly sprite: Phaser.Physics.Arcade.Sprite;
  readonly body: Phaser.Physics.Arcade.Body;
  hp: number;
  maxHp: number;
  dead = false;
  phase: GruntPhase = 'patrol';

  private readonly scene: Phaser.Scene;
  private dir = -1;
  private patrolMin: number;
  private patrolMax: number;
  private stunnedMs = 0;
  private phaseMs = 0;
  private flashMs = 0;
  private hasHitPlayer = false;
  private readonly outline: Phaser.GameObjects.Rectangle;

  constructor(scene: Phaser.Scene, x: number, y: number, patrolMin: number, patrolMax: number) {
    this.scene = scene;
    this.maxHp = ENEMY.maxHp;
    this.hp = this.maxHp;
    this.patrolMin = patrolMin;
    this.patrolMax = patrolMax;
    this.sprite = scene.physics.add.sprite(x, y, 'grunt');
    this.sprite.setDepth(9);
    this.body = this.sprite.body as Phaser.Physics.Arcade.Body;
    this.body.setSize(ENEMY.bodyWidth, ENEMY.bodyHeight);
    this.body.setOffset((this.sprite.width - ENEMY.bodyWidth) / 2, this.sprite.height - ENEMY.bodyHeight);
    this.body.setMaxVelocity(320, 1200);
    this.body.setDragX(600);
    this.sprite.setCollideWorldBounds(true);

    this.outline = scene.add
      .rectangle(x, y, this.sprite.width + 4, this.sprite.height + 4, 0x000000, 0)
      .setStrokeStyle(2, 0xe8c48a, 0.9)
      .setDepth(8);
  }

  get attackHitbox(): Phaser.Geom.Rectangle | null {
    if (this.dead || this.phase !== 'strike') {
      return null;
    }
    const w = 56;
    const h = 40;
    const x = this.dir > 0 ? this.sprite.x + 10 : this.sprite.x - 10 - w;
    return new Phaser.Geom.Rectangle(x, this.sprite.y - h * 0.45, w, h);
  }

  takeHit(damage: number, knockback: number, stun: number): boolean {
    if (this.dead) {
      return false;
    }
    this.hp = Math.max(0, this.hp - damage);
    this.stunnedMs = Math.max(this.stunnedMs, stun);
    this.phase = 'hurt';
    this.phaseMs = 0;
    this.hasHitPlayer = false;
    this.body.setVelocity(knockback, -180);
    this.flashMs = ENEMY.flashMs;
    this.sprite.setTint(0xffffff);
    if (this.hp <= 0) {
      this.die();
      return true;
    }
    return false;
  }

  update(delta: number, playerX: number, playerAlive: boolean): void {
    this.outline.setPosition(this.sprite.x, this.sprite.y);
    this.outline.setAlpha(this.dead ? 0.2 : 0.9);

    if (this.flashMs > 0) {
      this.flashMs -= delta;
      this.sprite.setTint(0xffffff);
      if (this.flashMs <= 0) {
        this.flashMs = 0;
        if (this.dead) {
          this.sprite.setTint(0x221111);
        } else {
          this.sprite.clearTint();
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
      if (Math.abs(dx) < ENEMY.attackRange) {
        this.dir = dx >= 0 ? 1 : -1;
        this.sprite.setFlipX(this.dir < 0);
        this.body.setVelocityX(0);
        this.phase = 'windup';
        this.phaseMs = 0;
        this.hasHitPlayer = false;
        this.sprite.setTint(0xc45a3a);
        return;
      }
    }

    this.body.setVelocityX(this.dir * ENEMY.speed);
    this.sprite.setFlipX(this.dir < 0);
  }

  private tickAttack(scaled: number): void {
    this.phaseMs += scaled;
    this.body.setAccelerationX(0);
    this.sprite.setFlipX(this.dir < 0);

    if (this.phase === 'windup') {
      this.body.setVelocityX(this.dir * 20);
      if (this.phaseMs >= ENEMY.windupMs) {
        this.phase = 'strike';
        this.phaseMs = 0;
        this.sprite.clearTint();
        this.body.setVelocityX(this.dir * 160);
      }
      return;
    }

    if (this.phase === 'strike') {
      if (this.phaseMs >= ENEMY.activeMs) {
        this.phase = 'recover';
        this.phaseMs = 0;
        this.body.setVelocityX(0);
      }
      return;
    }

    if (this.phaseMs >= ENEMY.recoverMs) {
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
    this.sprite.setAlpha(0.45);
    this.body.checkCollision.none = true;
  }
}
