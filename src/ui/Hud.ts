import Phaser from 'phaser';
import { GAME, realmBarFill, realmFromTotal } from '../config';
import type { Player } from '../entities/Player';
import type { Grunt } from '../entities/Grunt';

export class Hud {
  private readonly scene: Phaser.Scene;
  private readonly hpFill: Phaser.GameObjects.Rectangle;
  private readonly hpText: Phaser.GameObjects.Text;
  private readonly comboText: Phaser.GameObjects.Text;
  private readonly hint: Phaser.GameObjects.Text;
  private readonly enemyFill: Phaser.GameObjects.Rectangle;
  private readonly enemyLabel: Phaser.GameObjects.Text;
  private readonly xiuText: Phaser.GameObjects.Text;
  private readonly realmText: Phaser.GameObjects.Text;
  private readonly realmFill: Phaser.GameObjects.Rectangle;
  private readonly banner: Phaser.GameObjects.Text;
  private lastRealm = 1;
  private flashUntil = 0;

  constructor(scene: Phaser.Scene, initialTotal = 0) {
    this.scene = scene;
    this.lastRealm = realmFromTotal(initialTotal);

    const ui = scene.add.container(0, 0).setScrollFactor(0).setDepth(100);

    const panel = scene.add.rectangle(24, 20, 320, 96, 0x0b0814, 0.72).setOrigin(0, 0);
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

    this.realmText = scene.add
      .text(40, 70, '炼气一重', {
        fontFamily: 'Noto Serif SC, serif',
        fontSize: '12px',
        color: '#9fd6ff',
      })
      .setScrollFactor(0)
      .setDepth(101);
    scene.add.rectangle(128, 74, 132, 8, 0x2a2038, 1).setOrigin(0, 0).setScrollFactor(0).setDepth(100);
    this.realmFill = scene.add.rectangle(128, 74, 132, 8, 0xcfe8ff, 1).setOrigin(0, 0).setScrollFactor(0).setDepth(101);

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

    this.xiuText = scene.add
      .text(40, 98, '修为 0', {
        fontFamily: 'Noto Serif SC, serif',
        fontSize: '13px',
        color: '#c9a227',
      })
      .setScrollFactor(0)
      .setDepth(101);

    this.hint = scene.add
      .text(GAME.width / 2, GAME.height - 28, 'WASD / 方向键 移动   空格 跳   J 轻击   K 重击   L 剑气   R 重开', {
        fontFamily: 'Noto Serif SC, serif',
        fontSize: '14px',
        color: '#8a7ea8',
      })
      .setOrigin(0.5, 1)
      .setScrollFactor(0)
      .setDepth(101);

    this.enemyLabel = scene.add
      .text(GAME.width - 40, 72, '野修', {
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
    this.enemyFill = scene.add
      .rectangle(GAME.width - 260, 92, 220, 8, 0x8b1e2d, 1)
      .setOrigin(0, 0)
      .setScrollFactor(0)
      .setDepth(101);

    this.banner = scene.add
      .text(GAME.width / 2, 160, '', {
        fontFamily: 'Noto Serif SC, serif',
        fontSize: '36px',
        color: '#e8d48b',
        stroke: '#0a1020',
        strokeThickness: 6,
      })
      .setOrigin(0.5, 0.5)
      .setScrollFactor(0)
      .setDepth(120);
  }

  refresh(player: Player, enemy: Grunt, cultivation: number, cleared: boolean, skillReady: boolean, slashReady = false): void {
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
    this.enemyFill.scaleX = Phaser.Math.Clamp(enemy.hp / enemy.maxHp, 0, 1);
    const name = enemy.kind === 'boss' ? '关底' : '野修';
    this.enemyLabel.setText(enemy.dead ? name + ' · 已伏' : name);
    this.xiuText.setText(`修为 ${cultivation}`);

    const realm = realmFromTotal(cultivation);
    const names = ['', '炼气一重', '炼气二重', '炼气三重'];
    this.realmText.setText(names[realm]);
    this.realmFill.scaleX = Phaser.Math.Clamp(realmBarFill(cultivation), 0, 1);
    if (this.lastRealm < 2 && realm >= 2) {
      this.flashUntil = this.scene.time.now + 180;
    }
    this.lastRealm = realm;
    const flashing = this.scene.time.now < this.flashUntil;
    this.realmFill.setFillStyle(flashing ? 0xffffff : 0xcfe8ff, 1);

    let controls = 'WASD / 方向键 移动   空格 跳   J 轻击   K 重击';
    if (skillReady) {
      controls += '   L 剑气';
    }
    if (slashReady) {
      controls += '   下+J 横斩';
    }
    controls += '   R 重开';
    if (player.state === 'dead') {
      this.banner.setText('身陨');
      this.hint.setText('按 R 重开此关');
    } else if (cleared) {
      this.banner.setText('');
      this.hint.setText('Enter 再战');
    } else {
      this.banner.setText('');
      this.hint.setText(controls);
    }
  }
}
