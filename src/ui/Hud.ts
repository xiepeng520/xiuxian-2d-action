import Phaser from 'phaser';
import { GAME } from '../config';
import type { Player } from '../entities/Player';
import type { Dummy } from '../entities/Dummy';

export class Hud {
  private readonly hpFill: Phaser.GameObjects.Rectangle;
  private readonly hpText: Phaser.GameObjects.Text;
  private readonly comboText: Phaser.GameObjects.Text;
  private readonly hint: Phaser.GameObjects.Text;
  private readonly dummyFill: Phaser.GameObjects.Rectangle;
  private readonly dummyLabel: Phaser.GameObjects.Text;

  constructor(scene: Phaser.Scene) {
    const ui = scene.add.container(0, 0).setScrollFactor(0).setDepth(100);

    const panel = scene.add.rectangle(24, 20, 320, 72, 0x0b0814, 0.72).setOrigin(0, 0);
    panel.setStrokeStyle(1, 0xc9a227, 0.55);
    ui.add(panel);

    const title = scene.add
      .text(40, 26, '御剑 · 试锋', {
        fontFamily: 'Noto Serif SC, Songti SC, serif',
        fontSize: '16px',
        color: '#e8d48b',
      })
      .setOrigin(0, 0);
    ui.add(title);

    scene.add.rectangle(40, 52, 220, 10, 0x2a2038, 1).setOrigin(0, 0).setScrollFactor(0).setDepth(100);
    this.hpFill = scene.add.rectangle(40, 52, 220, 10, 0xc94b6a, 1).setOrigin(0, 0).setScrollFactor(0).setDepth(101);
    this.hpText = scene.add
      .text(268, 48, '100', {
        fontFamily: 'Noto Serif SC, serif',
        fontSize: '12px',
        color: '#f0e6d0',
      })
      .setScrollFactor(0)
      .setDepth(101);

    this.comboText = scene.add
      .text(GAME.width - 40, 28, '', {
        fontFamily: 'Noto Serif SC, serif',
        fontSize: '28px',
        color: '#9fd6ff',
        stroke: '#0a1020',
        strokeThickness: 4,
      })
      .setOrigin(1, 0)
      .setScrollFactor(0)
      .setDepth(101);

    this.hint = scene.add
      .text(GAME.width / 2, GAME.height - 28, 'WASD / 方向键 移动   空格 跳   J 轻击   K 重击   R 重开', {
        fontFamily: 'Noto Serif SC, serif',
        fontSize: '14px',
        color: '#8a7ea8',
      })
      .setOrigin(0.5, 1)
      .setScrollFactor(0)
      .setDepth(101);

    this.dummyLabel = scene.add
      .text(GAME.width - 40, 72, '木桩', {
        fontFamily: 'Noto Serif SC, serif',
        fontSize: '12px',
        color: '#c9a8a8',
      })
      .setOrigin(1, 0)
      .setScrollFactor(0)
      .setDepth(101);

    scene.add
      .rectangle(GAME.width - 260, 92, 220, 8, 0x2a2038, 1)
      .setOrigin(0, 0)
      .setScrollFactor(0)
      .setDepth(100);
    this.dummyFill = scene.add
      .rectangle(GAME.width - 260, 92, 220, 8, 0x8b1e2d, 1)
      .setOrigin(0, 0)
      .setScrollFactor(0)
      .setDepth(101);
  }

  refresh(player: Player, dummy: Dummy): void {
    const p = Phaser.Math.Clamp(player.hp / player.maxHp, 0, 1);
    this.hpFill.scaleX = p;
    this.hpText.setText(`${Math.ceil(player.hp)}`);
    if (player.comboCount >= 2) {
      this.comboText.setText(`${player.comboCount} HIT`);
      this.comboText.setAlpha(1);
    } else if (player.comboCount === 1) {
      this.comboText.setText('1 HIT');
      this.comboText.setAlpha(0.85);
    } else {
      this.comboText.setText('');
    }
    this.dummyFill.scaleX = Phaser.Math.Clamp(dummy.hp / dummy.maxHp, 0, 1);
    this.dummyLabel.setText(dummy.dead ? '木桩 · 已破' : '木桩');
    this.hint.setText(
      player.state === 'dead'
        ? '你已身陨 — 按 R 重开此切片'
        : 'WASD / 方向键 移动   空格 跳   J 轻击   K 重击   R 重开',
    );
  }
}
