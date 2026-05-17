import type Phaser from 'phaser';
import type { BarState } from '../../../gameplay/state/BarState';

const TOAST_DURATION_MS = 1500;
const TOAST_TEXT: Record<string, string> = {
  expand: 'EXPAND!',
  magnet: 'MAGNET!',
  laser:  'LASER!',
};

export type ToastObjects = {
  text: Phaser.GameObjects.Text;
  state: { prevEffect: string; endTime: number };
};

export function createToastObjects(scene: Phaser.Scene): ToastObjects {
  const text = scene.add
    .text(0, 0, '', {
      fontSize: '32px', color: '#ffff66', fontFamily: 'DNFBitBitv2, monospace',
      fontStyle: 'bold', stroke: '#000000', strokeThickness: 4,
    })
    .setOrigin(0.5, 1)
    .setVisible(false);
  return { text, state: { prevEffect: 'none', endTime: 0 } };
}

export function renderToast(objects: ToastObjects, bar: Readonly<BarState>): void {
  // activeEffect 변경 감지 (derive). 같은 effect 갱신은 trigger 안 함.
  const curr = bar.activeEffect;
  if (curr !== objects.state.prevEffect && curr !== 'none') {
    const text = TOAST_TEXT[curr];
    if (text !== undefined) {
      objects.text.setText(text);
      objects.state.endTime = performance.now() + TOAST_DURATION_MS;
    }
  }
  objects.state.prevEffect = curr;

  if (performance.now() < objects.state.endTime) {
    const tx = bar.x + bar.width / 2 + 24;
    const ty = bar.y - 16;
    objects.text.setPosition(tx, ty).setVisible(true);
  } else {
    objects.text.setVisible(false);
  }
}

export function hideToast(objects: ToastObjects): void {
  objects.text.setVisible(false);
}
