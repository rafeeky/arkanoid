import type Phaser from 'phaser';
import type { TitleScreenViewModel } from '../view-models/TitleScreenViewModel';

export type TitleScreenObjects = {
  logo: Phaser.GameObjects.Text;
  startText: Phaser.GameObjects.Text;
  highScoreText: Phaser.GameObjects.Text;
};

/**
 * createTitleScreenObjects — Title 화면에 필요한 Phaser 오브젝트를 1회 생성한다.
 * Unity 매핑: TitleScreenView의 Awake()/Start() 에서 오브젝트 참조를 찾는 것에 대응.
 */
export function createTitleScreenObjects(scene: Phaser.Scene): TitleScreenObjects {
  const logo = scene.add
    .text(360, 200, 'ARKANOID', {
      fontSize: '64px',
      color: '#ffffff',
      fontFamily: 'monospace',
    })
    .setOrigin(0.5, 0.5)
    .setVisible(false);

  const startText = scene.add
    .text(360, 360, '', {
      fontSize: '24px',
      color: '#ffffff',
      fontFamily: 'monospace',
    })
    .setOrigin(0.5, 0.5)
    .setVisible(false);

  const highScoreText = scene.add
    .text(360, 430, '', {
      fontSize: '20px',
      color: '#ffff00',
      fontFamily: 'monospace',
    })
    .setOrigin(0.5, 0.5)
    .setVisible(false);

  return { logo, startText, highScoreText };
}

/**
 * renderTitleScreen — Title 화면 오브젝트를 ViewModel에 맞게 갱신한다.
 * Unity 매핑: TitleScreenView.OnBind(viewModel) 형태로 포팅된다.
 */
export function renderTitleScreen(
  objects: TitleScreenObjects,
  viewModel: TitleScreenViewModel,
): void {
  objects.logo.setVisible(true);
  objects.startText.setText(viewModel.startText).setVisible(true);
  objects.highScoreText
    .setText(`HIGH SCORE  ${viewModel.highScore}`)
    .setVisible(true);
}

/**
 * hideTitleScreen — Title 화면 오브젝트를 전부 숨긴다.
 */
export function hideTitleScreen(objects: TitleScreenObjects): void {
  objects.logo.setVisible(false);
  objects.startText.setVisible(false);
  objects.highScoreText.setVisible(false);
}
