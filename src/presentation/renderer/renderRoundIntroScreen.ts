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
    .text(480, 300, '', {
      fontSize: '48px',
      color: '#ffffff',
      fontFamily: 'monospace',
    })
    .setOrigin(0.5, 0.5)
    .setVisible(false);

  const readyLabel = scene.add
    .text(480, 380, '', {
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
 */
export function renderRoundIntroScreen(
  objects: RoundIntroScreenObjects,
  viewModel: RoundIntroViewModel,
): void {
  objects.roundLabel.setText(viewModel.roundLabel).setVisible(true);
  objects.readyLabel.setText(viewModel.readyLabel).setVisible(true);
}

/**
 * hideRoundIntroScreen — RoundIntro 화면 오브젝트를 전부 숨긴다.
 */
export function hideRoundIntroScreen(objects: RoundIntroScreenObjects): void {
  objects.roundLabel.setVisible(false);
  objects.readyLabel.setVisible(false);
}
