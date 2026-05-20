import type Phaser from 'phaser';
import { CANVAS_WIDTH, CANVAS_HEIGHT } from './canvasLayout';
import { createButton, type Button } from '../ui/Button';

/**
 * 일시정지 오버레이 — InGame 중 ESC 누르면 표시되는 풀스크린 패널.
 *
 * 정석 (learning_principles_albatross): 일시정지 화면은 *혼합* 카메라 — 멈춘 월드=main, 메뉴=UI.
 *   backdrop / title / 4개 버튼 모두 UI 카메라 (scrollFactor 0). 멈춘 게임 월드가 backdrop 너머로 비침.
 *
 * 4개 버튼:
 *   - 가로: BGM toggle (neutral, ON/OFF) / SFX toggle (neutral, ON/OFF)
 *   - 세로: QUIT (danger, 빨강) / RESUME (primary, 초록)
 *
 * Unity 매핑: PauseMenuView MonoBehaviour. UGUI Button 컴포넌트로 동등.
 */
export type PauseButtonHandlers = {
  onToggleBgm(): void;
  onToggleSfx(): void;
  onQuitToTitle(): void;
  onResume(): void;
  /** 현재 BGM 음소거 상태. */
  isBgmMuted(): boolean;
  /** 현재 SFX 음소거 상태. */
  isSfxMuted(): boolean;
};

export type PauseOverlayObjects = {
  backdrop: Phaser.GameObjects.Rectangle;
  title: Phaser.GameObjects.Text;
  bgmButton: Button;
  sfxButton: Button;
  quitButton: Button;
  resumeButton: Button;
};

const CX = CANVAS_WIDTH / 2;

// 레이아웃 — 캔버스 절대 좌표 (UI 카메라).
const TITLE_Y = 600;
const TOGGLE_ROW_Y = 900;
const TOGGLE_BUTTON_W = 280;
const TOGGLE_BUTTON_H = 160;
const TOGGLE_LEFT_X = CX - 160;   // 배경음 (좌)
const TOGGLE_RIGHT_X = CX + 160;  // 효과음 (우)

const ACTION_BUTTON_W = 460;
const ACTION_BUTTON_H = 110;
const QUIT_Y = 1200;
const RESUME_Y = 1380;

const DEPTH_BACKDROP = 500;
const DEPTH_BUTTON = 501;
const DEPTH_TITLE = 502;

export function createPauseOverlayObjects(
  scene: Phaser.Scene,
  handlers: PauseButtonHandlers,
): PauseOverlayObjects {
  // 풀스크린 반투명 어두운 backdrop. 멈춘 게임 월드가 살짝 비치도록 alpha 0.75.
  const backdrop = scene.add
    .rectangle(CANVAS_WIDTH / 2, CANVAS_HEIGHT / 2, CANVAS_WIDTH, CANVAS_HEIGHT, 0x000000, 0.75)
    .setScrollFactor(0)
    .setDepth(DEPTH_BACKDROP)
    .setVisible(false);

  const title = scene.add
    .text(CX, TITLE_Y, 'PAUSED', {
      fontSize: '88px',
      color: '#ffffff',
      fontFamily: 'DNFBitBitv2, monospace',
      fontStyle: 'bold',
    })
    .setOrigin(0.5, 0.5)
    .setScrollFactor(0)
    .setDepth(DEPTH_TITLE)
    .setVisible(false);

  // 배경음 toggle — neutral variant. label "배경음" + 자동 \nON/\nOFF.
  const bgmButton = createButton(scene, {
    cx: TOGGLE_LEFT_X, cy: TOGGLE_ROW_Y, w: TOGGLE_BUTTON_W, h: TOGGLE_BUTTON_H,
    label: '배경음',
    variant: 'neutral',
    fontSize: '32px',
    toggle: true,
    toggleInitiallyOn: !handlers.isBgmMuted(),
    scrollFactor: 0,
    depth: DEPTH_BUTTON,
    onClick: () => {
      handlers.onToggleBgm();
      bgmButton.setOn(!handlers.isBgmMuted());
    },
  });

  // 효과음 toggle — neutral variant.
  const sfxButton = createButton(scene, {
    cx: TOGGLE_RIGHT_X, cy: TOGGLE_ROW_Y, w: TOGGLE_BUTTON_W, h: TOGGLE_BUTTON_H,
    label: '효과음',
    variant: 'neutral',
    fontSize: '32px',
    toggle: true,
    toggleInitiallyOn: !handlers.isSfxMuted(),
    scrollFactor: 0,
    depth: DEPTH_BUTTON,
    onClick: () => {
      handlers.onToggleSfx();
      sfxButton.setOn(!handlers.isSfxMuted());
    },
  });

  // QUIT — danger variant + glow.
  const quitButton = createButton(scene, {
    cx: CX, cy: QUIT_Y, w: ACTION_BUTTON_W, h: ACTION_BUTTON_H,
    label: 'QUIT',
    variant: 'danger',
    fontSize: '40px',
    glow: true,
    scrollFactor: 0,
    depth: DEPTH_BUTTON,
    onClick: () => handlers.onQuitToTitle(),
  });

  // RESUME — primary variant + glow.
  const resumeButton = createButton(scene, {
    cx: CX, cy: RESUME_Y, w: ACTION_BUTTON_W, h: ACTION_BUTTON_H,
    label: 'RESUME',
    variant: 'primary',
    fontSize: '40px',
    glow: true,
    scrollFactor: 0,
    depth: DEPTH_BUTTON,
    onClick: () => handlers.onResume(),
  });

  return { backdrop, title, bgmButton, sfxButton, quitButton, resumeButton };
}

export function showPauseOverlay(
  objects: PauseOverlayObjects,
  isBgmMuted: boolean,
  isSfxMuted: boolean,
): void {
  objects.backdrop.setVisible(true);
  objects.title.setVisible(true);
  // toggle 상태를 현재 음소거 상태에 맞춤 (라벨 + OFF 시 회색 자동).
  objects.bgmButton.setOn(!isBgmMuted);
  objects.sfxButton.setOn(!isSfxMuted);
  objects.bgmButton.setVisible(true);
  objects.sfxButton.setVisible(true);
  objects.quitButton.setVisible(true);
  objects.resumeButton.setVisible(true);
}

export function hidePauseOverlay(objects: PauseOverlayObjects): void {
  objects.backdrop.setVisible(false);
  objects.title.setVisible(false);
  objects.bgmButton.setVisible(false);
  objects.sfxButton.setVisible(false);
  objects.quitButton.setVisible(false);
  objects.resumeButton.setVisible(false);
}
