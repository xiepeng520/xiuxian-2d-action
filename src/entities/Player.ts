import Phaser from 'phaser';
import { PLAYER, LIGHT_COMBO, HEAVY, COMBAT } from '../config';
import { ComboBuffer, type BufferedAction } from '../combat/ComboBuffer';
import { type CombatState, isAttackState } from '../combat/CombatStateMachine';
import { type SaveV1Data, isSkillUnlocked, skillById, type SkillV1 } from '../save/SaveV1';

export type PlayerState = CombatState;

interface AttackDef {
  duration: number;
  activeStart: number;
  activeEnd: number;
  damage: number;
  knockback: number;
  hitstop: number;
  stun: number;
  cancelWindowMs: number;
  skillId: string;
  chainNext: string | null;
}

export class Player {
  readonly sprite: Phaser.Physics.Arcade.Sprite;
  readonly body: Phaser.Physics.Arcade.Body;
  state: CombatState = 'idle';
  hp: number;
  maxHp: number;
  comboCount = 0;
  facing = 1;

  private readonly scene: Phaser.Scene;
  private readonly buffer: ComboBuffer;
  private readonly save: SaveV1Data;
  private readonly keys: {
    left: Phaser.Input.Keyboard.Key;
    right: Phaser.Input.Keyboard.Key;
    a: Phaser.Input.Keyboard.Key;
    d: Phaser.Input.Keyboard.Key;
    up: Phaser.Input.Keyboard.Key;
    w: Phaser.Input.Keyboard.Key;
    space: Phaser.Input.Keyboard.Key;
    j: Phaser.Input.Keyboard.Key;
    k: Phaser.Input.Keyboard.Key;
  };

  private attackElapsed = 0;
  private attack: AttackDef | null = null;
  private hasHit = false;
  private hurtMs = 0;
  private comboIdleMs = 0;
  private slash: Phaser.GameObjects.Image;
  private readonly atkScale: number;
  /** Combat-time clock: paused while scene.time.timeScale === 0 (hitstop). */
  private combatClock = 0;

  constructor(scene: Phaser.Scene, x: number, y: number, save: SaveV1Data) {
    this.scene = scene;
    this.save = save;
    this.buffer = new ComboBuffer(COMBAT.bufferMs);
    this.maxHp = save.character.hp || PLAYER.maxHp;
    this.hp = this.maxHp;
    this.atkScale = save.character.atk / 10;

    this.sprite = scene.physics.add.sprite(x, y, 'player');
    this.sprite.setDepth(10);
    this.body = this.sprite.body as Phaser.Physics.Arcade.Body;
    this.body.setSize(PLAYER.bodyWidth, PLAYER.bodyHeight);
    this.body.setOffset((this.sprite.width - PLAYER.bodyWidth) / 2, this.sprite.height - PLAYER.bodyHeight);
    this.body.setMaxVelocity(520, 1400);
    this.body.setDragX(1800);
    this.sprite.setCollideWorldBounds(true);

    this.slash = scene.add.image(x, y, 'slash').setVisible(false).setDepth(11);

    const kb = scene.input.keyboard!;
    this.keys = {
      left: kb.addKey(Phaser.Input.Keyboard.KeyCodes.LEFT),
      right: kb.addKey(Phaser.Input.Keyboard.KeyCodes.RIGHT),
      a: kb.addKey(Phaser.Input.Keyboard.KeyCodes.A),
      d: kb.addKey(Phaser.Input.Keyboard.KeyCodes.D),
      up: kb.addKey(Phaser.Input.Keyboard.KeyCodes.UP),
      w: kb.addKey(Phaser.Input.Keyboard.KeyCodes.W),
      space: kb.addKey(Phaser.Input.Keyboard.KeyCodes.SPACE),
      j: kb.addKey(Phaser.Input.Keyboard.KeyCodes.J),
      k: kb.addKey(Phaser.Input.Keyboard.KeyCodes.K),
    };
  }

  get alive(): boolean {
    return this.state !== 'dead';
  }

  get hitbox(): Phaser.Geom.Rectangle | null {
    if (!this.attack || !isAttackState(this.state)) {
      return null;
    }
    if (this.attackElapsed < this.attack.activeStart || this.attackElapsed > this.attack.activeEnd) {
      return null;
    }
    if (this.hasHit) {
      return null;
    }
    const w = this.state === 'heavy' ? 78 : 64;
    const h = 52;
    const x = this.facing > 0 ? this.sprite.x + 8 : this.sprite.x - 8 - w;
    return new Phaser.Geom.Rectangle(x, this.sprite.y - h * 0.55, w, h);
  }

  consumeHit(): { damage: number; knockback: number; stun: number; hitstop: number; killHitstop: number } | null {
    const box = this.hitbox;
    if (!box || !this.attack) {
      return null;
    }
    this.hasHit = true;
    this.comboCount += 1;
    this.comboIdleMs = 0;
    return {
      damage: this.attack.damage,
      knockback: this.attack.knockback * this.facing,
      stun: this.attack.stun,
      hitstop: this.attack.hitstop,
      killHitstop: COMBAT.killHitstopMs,
    };
  }

  takeHit(damage: number, fromX: number): void {
    if (this.state === 'dead' || this.state === 'hurt') {
      return;
    }
    this.hp = Math.max(0, this.hp - damage);
    this.attack = null;
    this.hasHit = false;
    this.slash.setVisible(false);
    this.buffer.clear();
    if (this.hp <= 0) {
      this.state = 'dead';
      this.body.setVelocity(0, -180);
      this.sprite.setTint(0x442222);
      return;
    }
    this.state = 'hurt';
    this.hurtMs = 280;
    const dir = this.sprite.x < fromX ? -1 : 1;
    this.body.setVelocity(dir * 220, -160);
    this.sprite.setTint(0xff8888);
  }

  update(_time: number, delta: number): void {
    const scale = this.scene.time.timeScale;
    const scaled = delta * scale;
    if (scale > 0) {
      this.combatClock += scaled;
    }
    const clock = this.combatClock;
    const grounded = this.body.blocked.down || this.body.touching.down;

    if (Phaser.Input.Keyboard.JustDown(this.keys.j)) {
      this.buffer.push('light', clock);
    }
    if (Phaser.Input.Keyboard.JustDown(this.keys.k)) {
      this.buffer.push('heavy', clock);
    }
    if (
      Phaser.Input.Keyboard.JustDown(this.keys.space) ||
      Phaser.Input.Keyboard.JustDown(this.keys.up) ||
      Phaser.Input.Keyboard.JustDown(this.keys.w)
    ) {
      this.buffer.push('jump', clock);
    }

    if (this.comboCount > 0) {
      this.comboIdleMs += scaled;
      if (this.comboIdleMs > COMBAT.comboResetMs) {
        this.comboCount = 0;
        this.comboIdleMs = 0;
      }
    }

    if (this.state === 'dead') {
      this.body.setAccelerationX(0);
      this.sprite.setAlpha(0.7);
      return;
    }

    if (this.state === 'hurt') {
      this.hurtMs -= scaled;
      this.body.setAccelerationX(0);
      this.slash.setVisible(false);
      if (this.hurtMs <= 0) {
        this.sprite.clearTint();
        this.state = grounded ? 'idle' : 'fall';
      }
      return;
    }

    if (isAttackState(this.state)) {
      this.tickAttack(clock, scaled, grounded);
      this.syncSlash();
      return;
    }

    const axis = this.readAxis();
    if (grounded && this.buffer.consume(clock, ['jump'])) {
      this.body.setVelocityY(PLAYER.jumpVelocity);
      this.state = 'jump';
    }

    if (this.tryStartAttack(clock)) {
      this.syncSlash();
      return;
    }

    if (axis !== 0) {
      this.facing = axis;
      this.body.setAccelerationX(axis * 2400);
      this.sprite.setFlipX(this.facing < 0);
    } else {
      this.body.setAccelerationX(0);
    }

    if (!grounded) {
      this.state = this.body.velocity.y < 0 ? 'jump' : 'fall';
    } else {
      this.state = Math.abs(this.body.velocity.x) > 30 && axis !== 0 ? 'run' : 'idle';
    }

    this.slash.setVisible(false);
  }

  private tickAttack(clock: number, scaled: number, grounded: boolean): void {
    if (!this.attack) {
      this.endAttack(grounded);
      return;
    }
    this.attackElapsed += scaled;
    this.body.setAccelerationX(0);
    if (this.attackElapsed < 80) {
      this.body.setVelocityX(this.facing * PLAYER.attackLunge * (this.state === 'heavy' ? 0.6 : 1));
    }

    const cancelAt = this.attack.duration - this.attack.cancelWindowMs;
    if (this.attackElapsed >= cancelAt) {
      const next = this.buffer.consume(clock, ['light', 'heavy', 'jump']);
      if (next === 'jump' && grounded) {
        this.endAttack(true);
        this.body.setVelocityY(PLAYER.jumpVelocity);
        this.state = 'jump';
        return;
      }
      if (next === 'light' || next === 'heavy') {
        if (this.startAttack(next, true)) {
          return;
        }
      }
    }

    if (this.attackElapsed >= this.attack.duration) {
      this.endAttack(grounded);
    }
  }

  private tryStartAttack(clock: number): boolean {
    const action = this.buffer.consume(clock, ['light', 'heavy']);
    if (!action) {
      return false;
    }
    return this.startAttack(action, false);
  }

  private startAttack(action: BufferedAction, chained: boolean): boolean {
    if (action === 'jump') {
      return false;
    }
    const def = this.resolveAttack(action, chained);
    if (!def) {
      return false;
    }
    this.attack = def;
    this.attackElapsed = 0;
    this.hasHit = false;
    this.state = action === 'heavy' ? 'heavy' : 'light';
    this.body.setVelocityX(this.facing * PLAYER.attackLunge);
    this.sprite.setFlipX(this.facing < 0);
    return true;
  }

  private endAttack(grounded: boolean): void {
    this.attack = null;
    this.slash.setVisible(false);
    this.state = grounded ? 'idle' : 'fall';
  }

  private resolveAttack(action: 'light' | 'heavy', chained: boolean): AttackDef | null {
    const skill = this.pickSkill(action, chained);
    const cfg = this.timingFor(action, skill);

    return {
      duration: cfg.duration,
      activeStart: cfg.activeStart,
      activeEnd: cfg.activeEnd,
      damage: this.scaledDamage(skill?.damage ?? cfg.damage),
      knockback: cfg.knockback,
      hitstop: skill?.hitstopMs ?? cfg.hitstop,
      stun: skill?.stun ?? (action === 'heavy' ? 220 : 80),
      cancelWindowMs: skill?.cancelWindowMs ?? 80,
      skillId: skill?.skillId ?? (action === 'heavy' ? 'heavy_1' : 'light_1'),
      chainNext: skill?.chainNext ?? null,
    };
  }

  /** From cancel: use chainNext only if unlocked and same input; else first unlocked of that input. */
  private pickSkill(action: 'light' | 'heavy', chained: boolean): SkillV1 | undefined {
    if (chained && this.attack?.chainNext) {
      const nextId = this.attack.chainNext;
      if (isSkillUnlocked(this.save, nextId)) {
        const next = skillById(this.save, nextId);
        if (next && next.input === action) {
          return next;
        }
      }
    }
    if (action === 'heavy') {
      return this.unlockedSkill('heavy_1') ?? this.firstUnlocked('heavy');
    }
    return this.firstUnlocked('light');
  }

  private timingFor(
    action: 'light' | 'heavy',
    skill: SkillV1 | undefined,
  ): { duration: number; activeStart: number; activeEnd: number; damage: number; knockback: number; hitstop: number } {
    if (action === 'heavy') {
      return HEAVY;
    }
    const match = skill?.skillId.match(/^light_(\d+)$/);
    const idx = match ? Number(match[1]) - 1 : 0;
    const i = Math.max(0, Math.min(idx, LIGHT_COMBO.length - 1));
    return LIGHT_COMBO[i];
  }

  private unlockedSkill(id: string): SkillV1 | undefined {
    if (!isSkillUnlocked(this.save, id)) {
      return undefined;
    }
    return skillById(this.save, id);
  }

  private firstUnlocked(input: 'light' | 'heavy'): SkillV1 | undefined {
    return this.save.skills.find((s) => s.input === input && isSkillUnlocked(this.save, s.skillId));
  }

  private scaledDamage(base: number): number {
    return Math.round(base * this.atkScale);
  }

  private readAxis(): number {
    const left = this.keys.left.isDown || this.keys.a.isDown;
    const right = this.keys.right.isDown || this.keys.d.isDown;
    if (left && !right) {
      return -1;
    }
    if (right && !left) {
      return 1;
    }
    return 0;
  }

  private syncSlash(): void {
    if (!this.attack) {
      this.slash.setVisible(false);
      return;
    }
    const active =
      this.attackElapsed >= this.attack.activeStart && this.attackElapsed <= this.attack.activeEnd;
    this.slash.setVisible(active);
    this.slash.setPosition(this.sprite.x + this.facing * 36, this.sprite.y - 4);
    this.slash.setFlipX(this.facing < 0);
    this.slash.setScale(this.state === 'heavy' ? 1.35 : 1);
    this.slash.setTint(this.state === 'heavy' ? 0xffd27a : 0xcfe8ff);
  }
}
