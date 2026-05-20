import type Phaser from 'phaser';
import { CANVAS_WIDTH, CANVAS_HEIGHT } from '../renderer/canvasLayout';

/**
 * Toast — 짧은 알림 메시지. 하단에 fade-in → hold → fade-out.
 *
 * UI 카메라 (canvas 좌표계). depth 9999 — 다른 모든 UI 위에.
 * 동시에 한 토스트만 — 새 show() 호출 시 진행 중 토스트 즉시 교체.
 */
export type Toast = {
  show(message: string): void;
};

/** Toast 옵션. cy 미지정 시 화면 하단 (canvas 좌표계). */
export type ToastOptions = {
  /** y 좌표 (canvas 좌표계, UI 카메라). default = CANVAS_HEIGHT - 200 (하단). */
  cy?: number;
};

const TOAST_W = 520;
const TOAST_H = 84;
const DEFAULT_TOAST_Y = CANVAS_HEIGHT - 200; // 하단 (canvas 좌표계).
const FADE_MS = 220;       // fade-in / fade-out 동일 (yoyo).
const HOLD_MS = 1500;
const DEPTH_TOAST = 9999;

export function createToast(scene: Phaser.Scene, opt?: ToastOptions): Toast {
  const cx = CANVAS_WIDTH / 2;
  const cy = opt?.cy ?? DEFAULT_TOAST_Y;

  const container = scene.add.container(cx, cy);
  container.setScrollFactor(0);
  container.setDepth(DEPTH_TOAST);
  container.setVisible(false);
  container.setAlpha(0);

  // backdrop — 어두운 반투명 사각.
  const bg = scene.add
    .rectangle(0, 0, TOAST_W, TOAST_H, 0x000000, 0.88)
    .setOrigin(0.5, 0.5)
    .setStrokeStyle(2, 0xffffff)
    .setScrollFactor(0);
  container.add(bg);

  const text = scene.add
    .text(0, 0, '', {
      fontSize: '28px',
      color: '#ffffff',
      fontFamily: 'DNFBitBitv2, monospace',
      fontStyle: 'bold',
    })
    .setOrigin(0.5, 0.5)
    .setScrollFactor(0);
  container.add(text);

  return {
    show(message: string) {
      // 진행 중 tween/타이머 모두 정리.
      scene.tweens.killTweensOf(container);
      text.setText(message);
      container.setVisible(true);
      container.setAlpha(0);
      // fade-in (0→1) → hold → fade-out (1→0). yoyo 가 reverse 자동 처리.
      scene.tweens.add({
        targets: container,
        alpha: 1,
        duration: FADE_MS,
        ease: 'Linear',
        hold: HOLD_MS,
        yoyo: true,
        onComplete: () => container.setVisible(false),
      });
    },
  };
}
