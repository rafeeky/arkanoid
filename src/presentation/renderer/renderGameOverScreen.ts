import type Phaser from 'phaser';
import type { GameOverViewModel } from '../view-models/GameOverViewModel';

export type GameOverScreenObjects = {
  gameOverLabel: Phaser.GameObjects.Text;
  finalScoreText: Phaser.GameObjects.Text;
  retryText: Phaser.GameObjects.Text;
  newHighScoreText: Phaser.GameObjects.Text;
};

/**
 * createGameOverScreenObjects — GameOver 화면에 필요한 Phaser 오브젝트를 1회 생성한다.
 */
export function createGameOverScreenObjects(
  scene: Phaser.Scene,
): GameOverScreenObjects {
  const gameOverLabel = scene.add
    .text(480, 220, '', {
      fontSize: '56px',
      color: '#ff4444',
      fontFamily: 'monospace',
    })
    .setOrigin(0.5, 0.5)
    .setVisible(false);

  const newHighScoreText = scene.add
    .text(480, 300, 'NEW HIGH SCORE!', {
      fontSize: '26px',
      color: '#ffdd44',
      fontFamily: 'monospace',
    })
    .setOrigin(0.5, 0.5)
    .setVisible(false);

  const finalScoreText = scene.add
    .text(480, 355, '', {
      fontSize: '28px',
      color: '#ffffff',
      fontFamily: 'monospace',
    })
    .setOrigin(0.5, 0.5)
    .setVisible(false);

  const retryText = scene.add
    .text(480, 430, '', {
      fontSize: '22px',
      color: '#aaaaaa',
      fontFamily: 'monospace',
    })
    .setOrigin(0.5, 0.5)
    .setVisible(false);

  return { gameOverLabel, finalScoreText, retryText, newHighScoreText };
}

/**
 * renderGameOverScreen — GameOver 화면 오브젝트를 ViewModel에 맞게 갱신한다.
 *
 * isNewHighScore 이면 "NEW HIGH SCORE!" 라벨을 노란색으로 표시한다.
 */
export function renderGameOverScreen(
  objects: GameOverScreenObjects,
  viewModel: GameOverViewModel,
): void {
  objects.gameOverLabel.setText(viewModel.gameOverLabel).setVisible(true);
  objects.newHighScoreText.setVisible(viewModel.isNewHighScore);
  objects.finalScoreText
    .setText(`SCORE  ${viewModel.finalScore}`)
    .setVisible(true);
  objects.retryText.setText(viewModel.retryText).setVisible(true);
}

/**
 * hideGameOverScreen — GameOver 화면 오브젝트를 전부 숨긴다.
 */
export function hideGameOverScreen(objects: GameOverScreenObjects): void {
  objects.gameOverLabel.setVisible(false);
  objects.newHighScoreText.setVisible(false);
  objects.finalScoreText.setVisible(false);
  objects.retryText.setVisible(false);
}
