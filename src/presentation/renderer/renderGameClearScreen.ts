import type Phaser from 'phaser';
import type { GameClearViewModel } from '../view-models/GameClearViewModel';
import { createButton, type Button } from '../ui/Button';

export type GameClearScreenObjects = {
  headlineText: Phaser.GameObjects.Text;
  finalScoreText: Phaser.GameObjects.Text;
  highScoreText: Phaser.GameObjects.Text;
  /** RETRY 버튼 — 화면 탭 시 SPACE 합성으로 동작 (전역). 라벨은 viewModel.retryText 로 매 render 갱신. */
  retryButton: Button;
  /** QUIT TO TITLE 버튼. */
  quitButton: Button;
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

  // RETRY — primary (초록). 라벨 매 render 갱신.
  const retryButton = createButton(scene, {
    cx: 360, cy: 460, w: 280, h: 60,
    label: '',
    variant: 'primary',
    fontSize: '24px',
  });

  // QUIT TO TITLE — danger (빨강).
  const quitButton = createButton(scene, {
    cx: 360, cy: 540, w: 280, h: 60,
    label: 'QUIT TO TITLE',
    variant: 'danger',
    fontSize: '24px',
    onClick: () => handlers.onQuitToTitle(),
  });

  return { headlineText, finalScoreText, highScoreText, retryButton, quitButton };
}

/**
 * renderGameClearScreen — GameClear 화면 오브젝트를 ViewModel에 맞게 갱신한다.
 *
 * Unity 매핑: GameClearView MonoBehaviour.Bind().
 */
export function renderGameClearScreen(
  objects: GameClearScreenObjects,
  viewModel: GameClearViewModel,
): void {
  objects.headlineText.setText(viewModel.headline).setVisible(true);
  objects.finalScoreText.setText(viewModel.finalScoreLabel).setVisible(true);

  const highScoreColor = viewModel.isNewHighScore ? '#ffdd44' : '#aaaaaa';
  objects.highScoreText
    .setText(viewModel.highScoreLabel)
    .setColor(highScoreColor)
    .setVisible(true);

  objects.retryButton.setLabel(viewModel.retryText);
  objects.retryButton.setVisible(true);
  objects.quitButton.setVisible(true);
}

/**
 * hideGameClearScreen — GameClear 화면 오브젝트를 전부 숨긴다.
 */
export function hideGameClearScreen(objects: GameClearScreenObjects): void {
  objects.headlineText.setVisible(false);
  objects.finalScoreText.setVisible(false);
  objects.highScoreText.setVisible(false);
  objects.retryButton.setVisible(false);
  objects.quitButton.setVisible(false);
}
