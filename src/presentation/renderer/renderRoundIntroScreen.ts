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
  // 정석 (learning_principles_albatross §4): RoundIntro 는 *혼합* — 게임 월드(블록/바/회전체)는 main,
  // 메시지(ROUND N / READY)만 UI 카메라. 블록 끝(visual ~700) 아래 + bar(visual ~1300) 위 빈 영역.
  // canvas 좌표계 — cx=540 가운데. cy: roundLabel 1080, readyLabel 1180 (블록과 bar 사이).
  // ROUND/READY 텍스트 — 어두운 stroke 로 라운드별 변동 배경 (bg_pixel_0X) 위에서 가독성 보장.
  const roundLabel = scene.add
    .text(540, 1080, '', {
      fontSize: '72px',
      color: '#ffffff',
      fontFamily: 'DNFBitBitv2, monospace',
      stroke: '#000000', strokeThickness: 6,
    })
    .setOrigin(0.5, 0.5)
    .setScrollFactor(0)
    .setVisible(false);

  const readyLabel = scene.add
    .text(540, 1180, '', {
      fontSize: '48px',
      color: '#88ccff', // 하늘색.
      fontFamily: 'DNFBitBitv2, monospace',
      stroke: '#000000', strokeThickness: 5,
    })
    .setOrigin(0.5, 0.5)
    .setScrollFactor(0)
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
