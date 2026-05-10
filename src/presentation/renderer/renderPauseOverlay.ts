import type Phaser from 'phaser';
import { CANVAS_WIDTH, CANVAS_HEIGHT } from './canvasLayout';

/**
 * 일시정지 오버레이 — InGame 중 ESC 누르면 표시되는 풀스크린 패널.
 *
 * 모바일 게임 표준 패턴 (블록블라스트 등 참고):
 *   - 풀스크린 반투명 backdrop (게임 화면 살짝 보이게)
 *   - 큰 "PAUSED" 타이틀
 *   - 가로 2개 토글 버튼: 배경음 / 효과음
 *   - 세로 2개 액션 버튼: 나가기 (→ Title) / 돌아가기 (Resume)
 *
 * 모든 요소 scrollFactor=0 + setInteractive 로 마우스/터치 클릭 가능.
 * Unity 매핑: PauseMenuView MonoBehaviour. UGUI Button 컴포넌트로 동등.
 */
export type PauseButtonHandlers = {
  onToggleBgm(): void;
  onToggleSfx(): void;
  onQuitToTitle(): void;
  onResume(): void;
  /** 현재 BGM 음소거 상태 — 버튼 라벨 색상에 반영. */
  isBgmMuted(): boolean;
  /** 현재 SFX 음소거 상태. */
  isSfxMuted(): boolean;
};

type Button = {
  rect: Phaser.GameObjects.Rectangle;
  label: Phaser.GameObjects.Text;
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

// 레이아웃 — 캔버스 절대 좌표.
const TITLE_Y = 600;
const TOGGLE_ROW_Y = 900;
const TOGGLE_BUTTON_W = 280;
const TOGGLE_BUTTON_H = 160;
const TOGGLE_LEFT_X = CX - 160;   // 배경음 버튼 (좌)
const TOGGLE_RIGHT_X = CX + 160;  // 효과음 버튼 (우)

const ACTION_BUTTON_W = 460;
const ACTION_BUTTON_H = 110;
const QUIT_Y = 1200;     // 나가기 (위)
const RESUME_Y = 1380;   // 돌아가기 (아래)

const COLOR_BUTTON_FILL = 0x1a2a3a;
const COLOR_BUTTON_STROKE = 0x4488cc;
const COLOR_BUTTON_TEXT_ON = '#ffffff';
const COLOR_BUTTON_TEXT_OFF = '#666666';
const COLOR_RESUME_TEXT = '#88ff88';
const COLOR_QUIT_TEXT = '#ff7777';

function createButton(
  scene: Phaser.Scene,
  x: number,
  y: number,
  w: number,
  h: number,
  label: string,
  textColor: string,
  fontSize = '32px',
): Button {
  const rect = scene.add
    .rectangle(x, y, w, h, COLOR_BUTTON_FILL)
    .setStrokeStyle(3, COLOR_BUTTON_STROKE)
    .setOrigin(0.5, 0.5)
    .setScrollFactor(0)
    .setDepth(501)
    .setVisible(false)
    .setInteractive({ useHandCursor: true });

  const text = scene.add
    .text(x, y, label, {
      fontSize,
      color: textColor,
      fontFamily: 'monospace',
      fontStyle: 'bold',
    })
    .setOrigin(0.5, 0.5)
    .setScrollFactor(0)
    .setDepth(502)
    .setVisible(false);

  return { rect, label: text };
}

export function createPauseOverlayObjects(
  scene: Phaser.Scene,
  handlers: PauseButtonHandlers,
): PauseOverlayObjects {
  // 풀스크린 반투명 어두운 backdrop. 게임 화면 살짝 보이게 alpha 0.7.
  const backdrop = scene.add
    .rectangle(CANVAS_WIDTH / 2, CANVAS_HEIGHT / 2, CANVAS_WIDTH, CANVAS_HEIGHT, 0x000000, 0.75)
    .setScrollFactor(0)
    .setDepth(500)
    .setVisible(false);

  const title = scene.add
    .text(CX, TITLE_Y, 'PAUSED', {
      fontSize: '88px',
      color: '#ffffff',
      fontFamily: 'monospace',
      fontStyle: 'bold',
    })
    .setOrigin(0.5, 0.5)
    .setScrollFactor(0)
    .setDepth(502)
    .setVisible(false);

  // 배경음 / 효과음 토글 (가로 2개)
  const bgmButton = createButton(
    scene, TOGGLE_LEFT_X, TOGGLE_ROW_Y, TOGGLE_BUTTON_W, TOGGLE_BUTTON_H,
    '배경음\nON', COLOR_BUTTON_TEXT_ON, '32px',
  );
  bgmButton.label.setAlign('center').setLineSpacing(4);
  bgmButton.rect.on('pointerdown', () => {
    handlers.onToggleBgm();
    refreshButtonLabel(bgmButton, '배경음', !handlers.isBgmMuted());
  });

  const sfxButton = createButton(
    scene, TOGGLE_RIGHT_X, TOGGLE_ROW_Y, TOGGLE_BUTTON_W, TOGGLE_BUTTON_H,
    '효과음\nON', COLOR_BUTTON_TEXT_ON, '32px',
  );
  sfxButton.label.setAlign('center').setLineSpacing(4);
  sfxButton.rect.on('pointerdown', () => {
    handlers.onToggleSfx();
    refreshButtonLabel(sfxButton, '효과음', !handlers.isSfxMuted());
  });

  // 나가기 (→ Title)
  const quitButton = createButton(
    scene, CX, QUIT_Y, ACTION_BUTTON_W, ACTION_BUTTON_H,
    '나가기', COLOR_QUIT_TEXT, '40px',
  );
  quitButton.rect.on('pointerdown', () => handlers.onQuitToTitle());

  // 돌아가기 (Resume)
  const resumeButton = createButton(
    scene, CX, RESUME_Y, ACTION_BUTTON_W, ACTION_BUTTON_H,
    '돌아가기', COLOR_RESUME_TEXT, '40px',
  );
  resumeButton.rect.on('pointerdown', () => handlers.onResume());

  return { backdrop, title, bgmButton, sfxButton, quitButton, resumeButton };
}

function refreshButtonLabel(button: Button, name: string, isOn: boolean): void {
  button.label.setText(`${name}\n${isOn ? 'ON' : 'OFF'}`);
  button.label.setColor(isOn ? COLOR_BUTTON_TEXT_ON : COLOR_BUTTON_TEXT_OFF);
}

export function showPauseOverlay(
  objects: PauseOverlayObjects,
  isBgmMuted: boolean,
  isSfxMuted: boolean,
): void {
  objects.backdrop.setVisible(true);
  objects.title.setVisible(true);
  // 토글 버튼 라벨을 현재 음소거 상태에 맞춤.
  refreshButtonLabel(objects.bgmButton, '배경음', !isBgmMuted);
  refreshButtonLabel(objects.sfxButton, '효과음', !isSfxMuted);
  for (const btn of [objects.bgmButton, objects.sfxButton, objects.quitButton, objects.resumeButton]) {
    btn.rect.setVisible(true);
    btn.label.setVisible(true);
  }
}

export function hidePauseOverlay(objects: PauseOverlayObjects): void {
  objects.backdrop.setVisible(false);
  objects.title.setVisible(false);
  for (const btn of [objects.bgmButton, objects.sfxButton, objects.quitButton, objects.resumeButton]) {
    btn.rect.setVisible(false);
    btn.label.setVisible(false);
  }
}
