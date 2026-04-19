import type Phaser from 'phaser';
import type { GameOverViewModel } from '../view-models/GameOverViewModel';

export type GameOverScreenObjects = {
  gameOverLabel: Phaser.GameObjects.Text;
  finalScoreText: Phaser.GameObjects.Text;
  highScoreText: Phaser.GameObjects.Text;
  newHighScoreText: Phaser.GameObjects.Text;
  retryText: Phaser.GameObjects.Text;
};

/**
 * createGameOverScreenObjects — GameOver 화면에 필요한 Phaser 오브젝트를 1회 생성한다.
 *
 * 레이아웃: 제목 → FINAL SCORE → HIGH SCORE → (신규면 NEW HIGH SCORE!) → PRESS SPACE
 *
 * Unity 매핑: GameOverView MonoBehaviour.
 */
export function createGameOverScreenObjects(
  scene: Phaser.Scene,
): GameOverScreenObjects {
  const gameOverLabel = scene.add
    .text(480, 200, '', {
      fontSize: '56px',
      color: '#ff4444',
      fontFamily: 'monospace',
    })
    .setOrigin(0.5, 0.5)
    .setVisible(false);

  const finalScoreText = scene.add
    .text(480, 310, '', {
      fontSize: '28px',
      color: '#ffffff',
      fontFamily: 'monospace',
    })
    .setOrigin(0.5, 0.5)
    .setVisible(false);

  const highScoreText = scene.add
    .text(480, 360, '', {
      fontSize: '24px',
      color: '#aaaaaa',
      fontFamily: 'monospace',
    })
    .setOrigin(0.5, 0.5)
    .setVisible(false);

  const newHighScoreText = scene.add
    .text(480, 410, 'NEW HIGH SCORE!', {
      fontSize: '26px',
      color: '#ffdd44',
      fontFamily: 'monospace',
    })
    .setOrigin(0.5, 0.5)
    .setVisible(false);

  const retryText = scene.add
    .text(480, 480, '', {
      fontSize: '22px',
      color: '#aaaaaa',
      fontFamily: 'monospace',
    })
    .setOrigin(0.5, 0.5)
    .setVisible(false);

  return { gameOverLabel, finalScoreText, highScoreText, newHighScoreText, retryText };
}

/**
 * renderGameOverScreen — GameOver 화면 오브젝트를 ViewModel에 맞게 갱신한다.
 *
 * isNewHighScore 이면 highScoreText를 노란색으로 강조하고 "NEW HIGH SCORE!" 라벨을 표시한다.
 * 레이아웃은 GameClear 화면과 시각적 톤을 일치시킨다.
 *
 * Unity 매핑: GameOverView MonoBehaviour.Bind().
 */
export function renderGameOverScreen(
  objects: GameOverScreenObjects,
  viewModel: GameOverViewModel,
): void {
  objects.gameOverLabel.setText(viewModel.gameOverLabel).setVisible(true);
  objects.finalScoreText.setText(viewModel.finalScoreLabel).setVisible(true);

  // 신규 기록이면 highScore 텍스트를 노란색으로 강조
  const highScoreColor = viewModel.isNewHighScore ? '#ffdd44' : '#aaaaaa';
  objects.highScoreText
    .setText(viewModel.highScoreLabel)
    .setColor(highScoreColor)
    .setVisible(true);

  objects.newHighScoreText.setVisible(viewModel.isNewHighScore);
  objects.retryText.setText(viewModel.retryText).setVisible(true);
}

/**
 * hideGameOverScreen — GameOver 화면 오브젝트를 전부 숨긴다.
 */
export function hideGameOverScreen(objects: GameOverScreenObjects): void {
  objects.gameOverLabel.setVisible(false);
  objects.finalScoreText.setVisible(false);
  objects.highScoreText.setVisible(false);
  objects.newHighScoreText.setVisible(false);
  objects.retryText.setVisible(false);
}
