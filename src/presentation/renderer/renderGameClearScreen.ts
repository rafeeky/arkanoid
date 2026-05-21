import type Phaser from 'phaser';
import type { GameClearViewModel } from '../view-models/GameClearViewModel';
import { createButton, type Button } from '../ui/Button';

export type GameClearScreenObjects = {
  /** 풀스크린 배경 (canvas 1080×1920). depth -10. */
  background: Phaser.GameObjects.Image;
  headlineText: Phaser.GameObjects.Text;
  finalScoreText: Phaser.GameObjects.Text;
  highScoreText: Phaser.GameObjects.Text;
  retryButton: Button;
  quitButton: Button;
  /** 마스코트 3마리 가로 (Sprite, spritesheet 4 frame dance). 한 anim 키로 동기 재생. */
  mascots: Phaser.GameObjects.Sprite[];
};

const DANCE_ANIM_KEY = 'mascot_dance';

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

  // 풀스크린 배경 — UI 카메라 + depth -10.
  const background = scene.add
    .image(540, 960, 'bg_gameclear')
    .setOrigin(0.5, 0.5)
    .setDisplaySize(1080, 1920)
    .setScrollFactor(0)
    .setDepth(-10)
    .setVisible(false);

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

  // 마스코트 3마리 가로 (QUIT bottom edge 1245 아래). spritesheet 4 frame dance.
  // frame 502×591 (비율 0.85, 살짝 세로 길음) → display 220×260. 3마리 간격 260.
  const MASCOT_W = 220;
  const MASCOT_H = 260;
  const MASCOT_GAP = 260;
  const MASCOT_CY = 1530;

  // 4프레임 dance anim 등록 (한 번만).
  if (!scene.anims.exists(DANCE_ANIM_KEY)) {
    scene.anims.create({
      key: DANCE_ANIM_KEY,
      frames: scene.anims.generateFrameNumbers('dance_sheet', { start: 0, end: 3 }),
      frameRate: 8,
      repeat: -1,
    });
  }

  const mascots: Phaser.GameObjects.Sprite[] = [-1, 0, 1].map((slot) =>
    scene.add
      .sprite(CX + slot * MASCOT_GAP, MASCOT_CY, 'dance_sheet', 0)
      .setOrigin(0.5, 0.5)
      .setDisplaySize(MASCOT_W, MASCOT_H)
      .setScrollFactor(0)
      .setVisible(false),
  );

  return { background, headlineText, finalScoreText, highScoreText, retryButton, quitButton, mascots };
}

export function renderGameClearScreen(
  objects: GameClearScreenObjects,
  viewModel: GameClearViewModel,
): void {
  objects.background.setVisible(true);
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
  for (const m of objects.mascots) {
    m.setVisible(true);
    if (!m.anims.isPlaying) m.play(DANCE_ANIM_KEY);
  }
}

export function hideGameClearScreen(objects: GameClearScreenObjects): void {
  objects.background.setVisible(false);
  objects.headlineText.setVisible(false);
  objects.finalScoreText.setVisible(false);
  objects.highScoreText.setVisible(false);
  objects.retryButton.setVisible(false);
  objects.quitButton.setVisible(false);
  for (const m of objects.mascots) {
    m.setVisible(false);
    m.anims.stop();
  }
}
