import type Phaser from 'phaser';
import type { GameOverViewModel } from '../view-models/GameOverViewModel';
import { createButton, type Button } from '../ui/Button';

export type GameOverScreenObjects = {
  /** 풀스크린 배경 (canvas 1080×1920). depth -10 — 모든 UI 뒤. */
  background: Phaser.GameObjects.Image;
  gameOverLabel: Phaser.GameObjects.Text;
  finalScoreText: Phaser.GameObjects.Text;
  highScoreText: Phaser.GameObjects.Text;
  newHighScoreText: Phaser.GameObjects.Text;
  /** RETRY 버튼 — 화면 탭 시 SPACE 합성으로 동작 (전역). 라벨은 viewModel.retryText 로 매 render 갱신. */
  retryButton: Button;
  /** QUIT TO TITLE 버튼 — 클릭 시 ReturnToTitleRequested. */
  quitButton: Button;
  /** 마스코트 3마리 가로 (Image). 매 프레임 setTexture 로 4프레임 토글. */
  mascots: Phaser.GameObjects.Image[];
  /** 4프레임 토글 타이머. */
  animTimer: Phaser.Time.TimerEvent;
};

const MASCOT_FRAME_KEYS = [
  'gameover_frame_1',
  'gameover_frame_2',
  'gameover_frame_3',
  'gameover_frame_4',
] as const;
const MASCOT_FRAME_MS = 167; // ~6fps

export type GameOverHandlers = {
  onQuitToTitle(): void;
};

/**
 * createGameOverScreenObjects — GameOver 화면 (검은 배경, 전부 UI 카메라).
 *
 * 정석 (learning_principles_albatross §4): 게임 월드가 안 보이므로 *전부 UI 카메라* (canvas 좌표계).
 * 모든 객체 scrollFactor 0 + canvas 1080×1920 좌표계.
 *
 * 레이아웃: GAME OVER (상단) → FINAL SCORE → HIGH SCORE → (신규면 NEW HIGH SCORE!) → RETRY → QUIT
 */
export function createGameOverScreenObjects(
  scene: Phaser.Scene,
  handlers: GameOverHandlers = { onQuitToTitle: () => { /* noop */ } },
): GameOverScreenObjects {
  const CX = 540; // canvas 가운데.

  // 풀스크린 배경 — UI 카메라 + depth -10 (모든 UI 뒤).
  const background = scene.add
    .image(540, 960, 'bg_gameover')
    .setOrigin(0.5, 0.5)
    .setDisplaySize(1080, 1920)
    .setScrollFactor(0)
    .setDepth(-10)
    .setVisible(false);

  const gameOverLabel = scene.add
    .text(CX, 480, '', {
      fontSize: '80px',
      color: '#ff4444',
      fontFamily: 'DNFBitBitv2, monospace',
    })
    .setOrigin(0.5, 0.5)
    .setScrollFactor(0)
    .setVisible(false);

  const finalScoreText = scene.add
    .text(CX, 720, '', {
      fontSize: '40px',
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

  const newHighScoreText = scene.add
    .text(CX, 900, 'NEW HIGH SCORE!', {
      fontSize: '36px',
      color: '#ffdd44',
      fontFamily: 'DNFBitBitv2, monospace',
    })
    .setOrigin(0.5, 0.5)
    .setScrollFactor(0)
    .setVisible(false);

  // RETRY — primary (초록). 라벨 매 render 갱신. scrollFactor 0 (UI 카메라).
  const retryButton = createButton(scene, {
    cx: CX, cy: 1100, w: 420, h: 90,
    label: '',
    variant: 'primary',
    fontSize: '36px',
    scrollFactor: 0,
  });

  // QUIT TO TITLE — danger (빨강).
  const quitButton = createButton(scene, {
    cx: CX, cy: 1240, w: 420, h: 90,
    label: 'QUIT TO TITLE',
    variant: 'danger',
    fontSize: '36px',
    scrollFactor: 0,
    onClick: () => handlers.onQuitToTitle(),
  });

  // 마스코트 3마리 가로 (QUIT bottom edge 1285 아래). RGBA PNG 4 frame 수동 토글.
  // 사이즈 180×280 (원본 ~320×550 비율 유지). 3마리 간격 200.
  const MASCOT_W = 180;
  const MASCOT_H = 280;
  const MASCOT_GAP = 200;
  const MASCOT_CY = 1500;
  const mascots: Phaser.GameObjects.Image[] = [-1, 0, 1].map((slot) =>
    scene.add
      .image(CX + slot * MASCOT_GAP, MASCOT_CY, MASCOT_FRAME_KEYS[0])
      .setOrigin(0.5, 0.5)
      .setDisplaySize(MASCOT_W, MASCOT_H)
      .setScrollFactor(0)
      .setVisible(false),
  );

  // 4프레임 토글 타이머 — 모든 sprite 동기 갱신. setTexture 후 displaySize 재적용
  // (native size 다른 PNG 들의 scaleX/scaleY 어긋남 방지).
  let frameIdx = 0;
  const animTimer = scene.time.addEvent({
    delay: MASCOT_FRAME_MS,
    loop: true,
    callback: () => {
      frameIdx = (frameIdx + 1) % MASCOT_FRAME_KEYS.length;
      const key = MASCOT_FRAME_KEYS[frameIdx]!;
      for (const m of mascots) {
        m.setTexture(key);
        m.setDisplaySize(MASCOT_W, MASCOT_H);
      }
    },
  });

  return { background, gameOverLabel, finalScoreText, highScoreText, newHighScoreText, retryButton, quitButton, mascots, animTimer };
}

/**
 * renderGameOverScreen — GameOver 화면 오브젝트를 ViewModel에 맞게 갱신한다.
 */
export function renderGameOverScreen(
  objects: GameOverScreenObjects,
  viewModel: GameOverViewModel,
): void {
  objects.background.setVisible(true);
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
  for (const m of objects.mascots) m.setVisible(true);
  objects.animTimer.paused = false;
}

export function hideGameOverScreen(objects: GameOverScreenObjects): void {
  objects.background.setVisible(false);
  objects.gameOverLabel.setVisible(false);
  objects.finalScoreText.setVisible(false);
  objects.highScoreText.setVisible(false);
  objects.newHighScoreText.setVisible(false);
  objects.retryButton.setVisible(false);
  objects.quitButton.setVisible(false);
  for (const m of objects.mascots) m.setVisible(false);
  objects.animTimer.paused = true;
}
