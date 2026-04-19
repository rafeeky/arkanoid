import type Phaser from 'phaser';
import type { RoundIntroViewModel } from '../view-models/RoundIntroViewModel';

export type RoundIntroScreenObjects = {
  roundLabel: Phaser.GameObjects.Text;
  readyLabel: Phaser.GameObjects.Text;
};

/**
 * createRoundIntroScreenObjects — RoundIntro 화면에 필요한 Phaser 오브젝트를 1회 생성한다.
 */
export function createRoundIntroScreenObjects(
  scene: Phaser.Scene,
): RoundIntroScreenObjects {
  const roundLabel = scene.add
    .text(360, 300, '', {
      fontSize: '48px',
      color: '#ffffff',
      fontFamily: 'monospace',
    })
    .setOrigin(0.5, 0.5)
    .setVisible(false);

  const readyLabel = scene.add
    .text(360, 380, '', {
      fontSize: '32px',
      color: '#aaffaa',
      fontFamily: 'monospace',
    })
    .setOrigin(0.5, 0.5)
    .setVisible(false);

  return { roundLabel, readyLabel };
}

/**
 * renderRoundIntroScreen — RoundIntro 화면 오브젝트를 ViewModel에 맞게 갱신한다.
 *
 * introProgress(0.0~1.0) 기반으로 fade-in/out 연출:
 * - 0.0~0.2: fade-in (0→1)
 * - 0.2~0.8: 완전 불투명
 * - 0.8~1.0: fade-out (1→0)
 *
 * Unity 매핑: RoundIntroView MonoBehaviour. CanvasGroup.alpha 로 대응.
 */
export function renderRoundIntroScreen(
  objects: RoundIntroScreenObjects,
  viewModel: RoundIntroViewModel,
): void {
  const p = viewModel.introProgress;

  // alpha 계산: fade-in 0~0.2, hold 0.2~0.8, fade-out 0.8~1.0
  let alpha: number;
  if (p < 0.2) {
    alpha = p / 0.2; // 0 → 1
  } else if (p < 0.8) {
    alpha = 1.0;
  } else {
    alpha = (1.0 - p) / 0.2; // 1 → 0
  }
  alpha = Math.max(0, Math.min(1, alpha));

  objects.roundLabel.setText(viewModel.roundLabel).setAlpha(alpha).setVisible(true);
  objects.readyLabel.setText(viewModel.readyLabel).setAlpha(alpha).setVisible(true);
}

/**
 * hideRoundIntroScreen — RoundIntro 화면 오브젝트를 전부 숨긴다.
 */
export function hideRoundIntroScreen(objects: RoundIntroScreenObjects): void {
  objects.roundLabel.setVisible(false);
  objects.readyLabel.setVisible(false);
}
