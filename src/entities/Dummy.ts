import Phaser from 'phaser';
import { ENEMY } from '../config';

export class Dummy {
  readonly sprite: Phaser.Physics.Arcade.Sprite;
  readonly body: Phaser.Physics.Arcade.Body;
  hp: number;
  maxHp: number;
  dead = false;
  stunnedMs = 0;

  private readonly scene: Phaser.Scene;
  private dir = -1;
  private patrolMin: number;
  private patrolMax: number;

  constructor(scene: Phaser.Scene, x: number, y: number, patrolMin: number, patrolMax: number) {
    this.scene = scene;
    this.maxHp = ENEMY.maxHp;
    this.hp = this.maxHp;
    this.patrolMin = patrolMin;
    this.patrolMax = patrolMax;

    this.sprite = scene.physics.add.sprite(x, y, 'dummy');
    this.sprite.setDepth(9);
    this.body = this.sprite.body as Phaser.Physics.Arcade.Body;
    this.body.setSize(ENEMY.bodyWidth, ENEMY.bodyHeight);
    this.body.setOffset((this.sprite.width - ENEMY.bodyWidth) / 2, this.sprite.height - ENEMY.bodyHeight);
    this.body.setMaxVelocity(280, 1200);
    this.body.setDragX(400);
    this.sprite.setCollideWorldBounds(true);
  }

  takeHit(damage: number, knockback: number, stun: number): boolean {
    if (this.dead) {
      return false;
    }
    this.hp = Math.max(0, this.hp - damage);
    this.stunnedMs = Math.max(this.stunnedMs, stun);
    this.body.setVelocity(knockback, -120);
    this.sprite.setTint(0xffe0e0);
    this.scene.time.delayedCall(80, () => {
      if (!this.dead) {
        this.sprite.clearTint();
      }
    });
    if (this.hp <= 0) {
      this.die();
      return true;
    }
    return false;
  }

  update(delta: number): void {
    if (this.dead) {
      return;
    }
    const scaled = delta * this.scene.time.timeScale;
    if (this.stunnedMs > 0) {
      this.stunnedMs -= scaled;
      this.body.setAccelerationX(0);
      return;
    }
    if (this.sprite.x <= this.patrolMin) {
      this.dir = 1;
    } else if (this.sprite.x >= this.patrolMax) {
      this.dir = -1;
    }
    this.body.setVelocityX(this.dir * ENEMY.speed);
    this.sprite.setFlipX(this.dir < 0);
  }

  private die(): void {
    this.dead = true;
    this.body.setVelocity(0, -80);
    this.body.setAcceleration(0, 0);
    this.sprite.setTint(0x221111);
    this.sprite.setAlpha(0.45);
    this.body.checkCollision.none = true;
  }
}
