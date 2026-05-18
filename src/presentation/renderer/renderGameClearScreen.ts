import type Phaser from 'phaser';
import type { GameClearViewModel } from '../view-models/GameClearViewModel';

export type GameClearScreenObjects = {
  headlineText: Phaser.GameObjects.Text;
  finalScoreText: Phaser.GameObjects.Text;
  highScoreText: Phaser.GameObjects.Text;
  retryText: Phaser.GameObjects.Text;
  quitButton: { rect: Phaser.GameObjects.Rectangle; label: Phaser.GameObjects.Text };
};

export type GameClearHandlers = {
  onQuitToTitle(): void;
};

/**
 * createGameClearScreenObjects — GameClear 화면에 필요한 Phaser 오브젝트를 1회 생성한다.
 *
 * Unity 매핑: GameClearView MonoBehaviour.
 */
export function createGameClearScreenObjects(
  scene: Phaser.Scene,
  handlers: GameClearHandlers = { onQuitToTitle: () => { /* noop */ } },
): GameClearScreenObjects {
  const headlineText = scene.add
    .text(360, 200, '', {
      fontSize: '52px',
      color: '#ffdd44',
      fontFamily: 'DNFBitBitv2, monospace',
    })
    .setOrigin(0.5, 0.5)
    .setVisible(false);

  const finalScoreText = scene.add
    .text(360, 310, '', {
      fontSize: '30px',
      color: '#ffffff',
      fontFamily: 'DNFBitBitv2, monospace',
    })
    .setOrigin(0.5, 0.5)
    .setVisible(false);

  const highScoreText = scene.add
    .text(360, 370, '', {
      fontSize: '24px',
      color: '#aaaaaa',
      fontFamily: 'DNFBitBitv2, monospace',
    })
    .setOrigin(0.5, 0.5)
    .setVisible(false);

  const retryText = scene.add
    .text(360, 460, '', {
      fontSize: '22px',
      color: '#aaaaaa',
      fontFamily: 'DNFBitBitv2, monospace',
    })
    .setOrigin(0.5, 0.5)
    .setVisible(false);

  const quitRect = scene.add
    .rectangle(360, 540, 280, 60, 0x444444)
    .setStrokeStyle(3, 0x888888)
    .setOrigin(0.5, 0.5)
    .setVisible(false)
    .setInteractive({ useHandCursor: true });
  quitRect.on('pointerdown', () => handlers.onQuitToTitle());
  const quitLabel = scene.add
    .text(360, 540, 'QUIT TO TITLE', {
      fontSize: '24px', color: '#ffffff', fontFamily: 'DNFBitBitv2, monospace', fontStyle: 'bold',
    })
    .setOrigin(0.5, 0.5)
    .setVisible(false);

  return { headlineText, finalScoreText, highScoreText, retryText, quitButton: { rect: quitRect, label: quitLabel } };
}

/**
 * renderGameClearScreen — GameClear 화면 오브젝트를 ViewModel에 맞게 갱신한다.
 *
 * isNewHighScore 이면 highScoreText를 노란색으로 강조한다.
 *
 * Unity 매핑: GameClearView MonoBehaviour.Bind().
 */
export function renderGameClearScreen(
  objects: GameClearScreenObjects,
  viewModel: GameClearViewModel,
): void {
  objects.headlineText.setText(viewModel.headline).setVisible(true);
  objects.finalScoreText.setText(viewModel.finalScoreLabel).setVisible(true);

  // 신규 기록이면 highScore 텍스트를 노란색으로 강조
  const highScoreColor = viewModel.isNewHighScore ? '#ffdd44' : '#aaaaaa';
  objects.highScoreText
    .setText(viewModel.highScoreLabel)
    .setColor(highScoreColor)
    .setVisible(true);

  objects.retryText.setText(viewModel.retryText).setVisible(true);
  objects.quitButton.rect.setVisible(true);
  objects.quitButton.label.setVisible(true);
}

/**
 * hideGameClearScreen — GameClear 화면 오브젝트를 전부 숨긴다.
 */
export function hideGameClearScreen(objects: GameClearScreenObjects): void {
  objects.headlineText.setVisible(false);
  objects.finalScoreText.setVisible(false);
  objects.highScoreText.setVisible(false);
  objects.retryText.setVisible(false);
  objects.quitButton.rect.setVisible(false);
  objects.quitButton.label.setVisible(false);
}
