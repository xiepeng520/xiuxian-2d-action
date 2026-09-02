import Phaser from 'phaser';
import { GAME } from '../config';

const CYAN = '#cfe8ff';

/** One dim screen: total cultivation, realm, rematch. No portraits or textures. */
export class ResultOverlay {
  private readonly root: Phaser.GameObjects.Container;
  private readonly totalText: Phaser.GameObjects.Text;
  private readonly realmText: Phaser.GameObjects.Text;
  private visible = false;
  private onRematch: () => void;

  constructor(scene: Phaser.Scene, onRematch: () => void) {
    this.onRematch = onRematch;
    this.root = scene.add.container(0, 0).setScrollFactor(0).setDepth(200).setVisible(false);

    const dim = scene.add.rectangle(GAME.width / 2, GAME.height / 2, GAME.width, GAME.height, 0x07060c, 0.62);
    this.root.add(dim);

    this.totalText = scene.add
      .text(GAME.width / 2, GAME.height / 2 - 36, '修为合计 0', {
        fontFamily: 'Noto Serif SC, serif',
        fontSize: '28px',
        color: CYAN,
      })
      .setOrigin(0.5);
    this.realmText = scene.add
      .text(GAME.width / 2, GAME.height / 2 + 8, '炼气一重', {
        fontFamily: 'Noto Serif SC, serif',
        fontSize: '22px',
        color: CYAN,
      })
      .setOrigin(0.5);
    const again = scene.add
      .text(GAME.width / 2, GAME.height / 2 + 72, '再战', {
        fontFamily: 'Noto Serif SC, serif',
        fontSize: '26px',
        color: '#ffffff',
      })
      .setOrigin(0.5)
      .setInteractive({ useHandCursor: true });
    again.on('pointerdown', () => this.onRematch());

    this.root.add(this.totalText);
    this.root.add(this.realmText);
    this.root.add(again);

    scene.input.keyboard!.on('keydown-ENTER', () => {
      if (this.visible) {
        this.onRematch();
      }
    });
  }

  show(view: { total: number; realm: 1 | 2 | 3 }): void {
    const names = ['', '炼气一重', '炼气二重', '炼气三重'];
    this.totalText.setText(`修为合计 ${view.total}`);
    this.realmText.setText(names[view.realm]);
    this.root.setVisible(true);
    this.visible = true;
  }

  get open(): boolean {
    return this.visible;
  }
}
