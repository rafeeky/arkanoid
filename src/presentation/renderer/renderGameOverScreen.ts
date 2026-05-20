import type Phaser from 'phaser';
import type { GameOverViewModel } from '../view-models/GameOverViewModel';
import { createButton, type Button } from '../ui/Button';

export type GameOverScreenObjects = {
  gameOverLabel: Phaser.GameObjects.Text;
  finalScoreText: Phaser.GameObjects.Text;
  highScoreText: Phaser.GameObjects.Text;
  newHighScoreText: Phaser.GameObjects.Text;
  /** RETRY 버튼 — 화면 탭 시 SPACE 합성으로 동작 (전역 핸들러). 라벨은 viewModel.retryText 로 매 render 갱신. */
  retryButton: Button;
  /** QUIT TO TITLE 버튼 — 클릭 시 ReturnToTitleRequested. */
  quitButton: Button;
};

export type GameOverHandlers = {
  onQuitToTitle(): void;
};

/**
 * createGameOverScreenObjects — GameOver 화면에 필요한 Phaser 오브젝트를 1회 생성한다.
 *
 * 레이아웃: 제목 → FINAL SCORE → HIGH SCORE → (신규면 NEW HIGH SCORE!) → RETRY → QUIT TO TITLE
 *
 * Unity 매핑: GameOverView MonoBehaviour.
 */
export function createGameOverScreenObjects(
  scene: Phaser.Scene,
  handlers: GameOverHandlers = { onQuitToTitle: () => { /* noop */ } },
): GameOverScreenObjects {
  const gameOverLabel = scene.add
    .text(360, 200, '', {
      fontSize: '56px',
      color: '#ff4444',
      fontFamily: 'DNFBitBitv2, monospace',
    })
    .setOrigin(0.5, 0.5)
    .setVisible(false);

  const finalScoreText = scene.add
    .text(360, 310, '', {
      fontSize: '28px',
      color: '#ffffff',
      fontFamily: 'DNFBitBitv2, monospace',
    })
    .setOrigin(0.5, 0.5)
    .setVisible(false);

  const highScoreText = scene.add
    .text(360, 360, '', {
      fontSize: '24px',
      color: '#aaaaaa',
      fontFamily: 'DNFBitBitv2, monospace',
    })
    .setOrigin(0.5, 0.5)
    .setVisible(false);

  const newHighScoreText = scene.add
    .text(360, 410, 'NEW HIGH SCORE!', {
      fontSize: '26px',
      color: '#ffdd44',
      fontFamily: 'DNFBitBitv2, monospace',
    })
    .setOrigin(0.5, 0.5)
    .setVisible(false);

  // RETRY — primary (초록). 라벨은 매 render 갱신 (viewModel.retryText). 별도 click 핸들러 없음 — 전역 SPACE/탭 핸들러.
  const retryButton = createButton(scene, {
    cx: 360, cy: 490, w: 280, h: 60,
    label: '',
    variant: 'primary',
    fontSize: '24px',
  });

  // QUIT TO TITLE — danger (빨강). 일시정지 QUIT 와 동일 톤.
  const quitButton = createButton(scene, {
    cx: 360, cy: 560, w: 280, h: 60,
    label: 'QUIT TO TITLE',
    variant: 'danger',
    fontSize: '24px',
    onClick: () => handlers.onQuitToTitle(),
  });

  return { gameOverLabel, finalScoreText, highScoreText, newHighScoreText, retryButton, quitButton };
}

/**
 * renderGameOverScreen — GameOver 화면 오브젝트를 ViewModel에 맞게 갱신한다.
 *
 * isNewHighScore 이면 highScoreText를 노란색으로 강조하고 "NEW HIGH SCORE!" 라벨을 표시한다.
 *
 * Unity 매핑: GameOverView MonoBehaviour.Bind().
 */
export function renderGameOverScreen(
  objects: GameOverScreenObjects,
  viewModel: GameOverViewModel,
): void {
  objects.gameOverLabel.setText(viewModel.gameOverLabel).setVisible(true);
  objects.finalScoreText.setText(viewModel.finalScoreLabel).setVisible(true);

  const highScoreColor = viewModel.isNewHighScore ? '#ffdd44' : '#aaaaaa';
  objects.highScoreText
    .setText(viewModel.highScoreLabel)
    .setColor(highScoreColor)
    .setVisible(true);

  objects.newHighScoreText.setVisible(viewModel.isNewHighScore);
  objects.retryButton.setLabel(viewModel.retryText);
  objects.retryButton.setVisible(true);
  objects.quitButton.setVisible(true);
}

/**
 * hideGameOverScreen — GameOver 화면 오브젝트를 전부 숨긴다.
 */
export function hideGameOverScreen(objects: GameOverScreenObjects): void {
  objects.gameOverLabel.setVisible(false);
  objects.finalScoreText.setVisible(false);
  objects.highScoreText.setVisible(false);
  objects.newHighScoreText.setVisible(false);
  objects.retryButton.setVisible(false);
  objects.quitButton.setVisible(false);
}
