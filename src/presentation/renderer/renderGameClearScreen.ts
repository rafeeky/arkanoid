import type Phaser from 'phaser';
import type { GameClearViewModel } from '../view-models/GameClearViewModel';
import { createButton, type Button } from '../ui/Button';

export type GameClearScreenObjects = {
  headlineText: Phaser.GameObjects.Text;
  finalScoreText: Phaser.GameObjects.Text;
  highScoreText: Phaser.GameObjects.Text;
  retryButton: Button;
  quitButton: Button;
};

export type GameClearHandlers = {
  onQuitToTitle(): void;
};

/**
 * createGameClearScreenObjects — GameClear 화면 (검은 배경, 전부 UI 카메라).
 *
 * 정석 (learning_principles_albatross §4): 게임 월드가 안 보이므로 *전부 UI 카메라*.
 * 모든 객체 scrollFactor 0 + canvas 1080×1920 좌표계.
 */
export function createGameClearScreenObjects(
  scene: Phaser.Scene,
  handlers: GameClearHandlers = { onQuitToTitle: () => { /* noop */ } },
): GameClearScreenObjects {
  const CX = 540;

  const headlineText = scene.add
    .text(CX, 480, '', {
      fontSize: '76px',
      color: '#ffdd44',
      fontFamily: 'DNFBitBitv2, monospace',
    })
    .setOrigin(0.5, 0.5)
    .setScrollFactor(0)
    .setVisible(false);

  const finalScoreText = scene.add
    .text(CX, 720, '', {
      fontSize: '44px',
      color: '#ffffff',
      fontFamily: 'DNFBitBitv2, monospace',
    })
    .setOrigin(0.5, 0.5)
    .setScrollFactor(0)
    .setVisible(false);

  const highScoreText = scene.add
    .text(CX, 810, '', {
      fontSize: '32px',
      color: '#aaaaaa',
      fontFamily: 'DNFBitBitv2, monospace',
    })
    .setOrigin(0.5, 0.5)
    .setScrollFactor(0)
    .setVisible(false);

  // RETRY — primary.
  const retryButton = createButton(scene, {
    cx: CX, cy: 1060, w: 420, h: 90,
    label: '',
    variant: 'primary',
    fontSize: '36px',
    scrollFactor: 0,
  });

  // QUIT TO TITLE — danger.
  const quitButton = createButton(scene, {
    cx: CX, cy: 1200, w: 420, h: 90,
    label: 'QUIT TO TITLE',
    variant: 'danger',
    fontSize: '36px',
    scrollFactor: 0,
    onClick: () => handlers.onQuitToTitle(),
  });

  return { headlineText, finalScoreText, highScoreText, retryButton, quitButton };
}

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

export function hideGameClearScreen(objects: GameClearScreenObjects): void {
  objects.headlineText.setVisible(false);
  objects.finalScoreText.setVisible(false);
  objects.highScoreText.setVisible(false);
  objects.retryButton.setVisible(false);
  objects.quitButton.setVisible(false);
}
