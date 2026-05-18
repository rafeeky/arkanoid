import type Phaser from 'phaser';
import type { GameOverViewModel } from '../view-models/GameOverViewModel';

export type GameOverScreenObjects = {
  gameOverLabel: Phaser.GameObjects.Text;
  finalScoreText: Phaser.GameObjects.Text;
  highScoreText: Phaser.GameObjects.Text;
  newHighScoreText: Phaser.GameObjects.Text;
  retryText: Phaser.GameObjects.Text;
  /** "타이틀로 나가기" 버튼 — 클릭 시 ReturnToTitleRequested. */
  quitButton: { rect: Phaser.GameObjects.Rectangle; label: Phaser.GameObjects.Text };
};

export type GameOverHandlers = {
  onQuitToTitle(): void;
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

  // Phase 6: highScoreText(360) 와 동일 y 였던 버그 수정 — 490 으로 분리.
  // 레이아웃: gameOver(200) → final(310) → high(360) → newHigh?(410) → retry(490).
  const retryText = scene.add
    .text(360, 490, '', {
      fontSize: '22px',
      color: '#aaaaaa',
      fontFamily: 'DNFBitBitv2, monospace',
    })
    .setOrigin(0.5, 0.5)
    .setVisible(false);

  // 타이틀로 나가기 버튼 — retryText 아래 (y=560).
  const quitRect = scene.add
    .rectangle(360, 560, 280, 60, 0x444444)
    .setStrokeStyle(3, 0x888888)
    .setOrigin(0.5, 0.5)
    .setVisible(false)
    .setInteractive({ useHandCursor: true });
  quitRect.on('pointerdown', () => handlers.onQuitToTitle());
  const quitLabel = scene.add
    .text(360, 560, 'QUIT TO TITLE', {
      fontSize: '24px', color: '#ffffff', fontFamily: 'DNFBitBitv2, monospace', fontStyle: 'bold',
    })
    .setOrigin(0.5, 0.5)
    .setVisible(false);

  return {
    gameOverLabel, finalScoreText, highScoreText, newHighScoreText, retryText,
    quitButton: { rect: quitRect, label: quitLabel },
  };
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
  objects.quitButton.rect.setVisible(true);
  objects.quitButton.label.setVisible(true);
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
  objects.quitButton.rect.setVisible(false);
  objects.quitButton.label.setVisible(false);
}
