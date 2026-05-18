import type Phaser from 'phaser';
import type { TitleScreenViewModel } from '../view-models/TitleScreenViewModel';
import type { MascotDefinition } from '../../definitions/types/MascotDefinition';
import { MascotTable, getMascotById } from '../../definitions/tables/MascotTable';
import { CANVAS_WIDTH } from './canvasLayout';
import { createTextPanel } from './components/TextPanel';

export type MascotCarouselHandlers = {
  /** 이전/다음 캐릭터로 cursor 이동. 잠금 여부 무관 (모든 캐릭터 cycle). */
  onCursorPrev(): void;
  onCursorNext(): void;
  /** 현재 cursor 위치의 캐릭터 잠금 해제 시도 (gold 차감). */
  onTryUnlock(): void;
  /** 현재 보유 골드 조회. */
  getGold(): number;
  /** 캐릭터 잠금 해제 여부. */
  isUnlocked(mascotId: string): boolean;
  /** 현재 cursor 인덱스 (MascotTable 기준). */
  getCursorIndex(): number;
  /** NORMAL PLAY 버튼 클릭 — normal 난이도 선택 + 게임 시작. */
  onNormalClick?(): void;
  /** HARD PLAY 버튼 클릭 — hard 난이도 선택 + 게임 시작. */
  onHardClick?(): void;
};

type Button = {
  rect: Phaser.GameObjects.Rectangle;
  label: Phaser.GameObjects.Text;
  /** 입체 bevel overlay (optional). */
  bevel?: Phaser.GameObjects.Graphics;
};

export type TitleScreenObjects = {
  // 텍스트
  logo: Phaser.GameObjects.Text;
  startText: Phaser.GameObjects.Text;
  highScoreText: Phaser.GameObjects.Text;
  goldText: Phaser.GameObjects.Text;
  normalLabel: Phaser.GameObjects.Text;
  hardLabel: Phaser.GameObjects.Text;
  difficultyHelp: Phaser.GameObjects.Text;  // NORMAL 박스 sub "PLAY BUTTON"
  hardSubText: Phaser.GameObjects.Text;     // HARD 박스 sub "PLAY BUTTON"

  // Mascot 캐러셀 — V2 portrait (가로세로 동일) + 테두리. portrait2.<id> 텍스처 사용.
  mascotPortrait: Phaser.GameObjects.Image;
  /** portrait 테두리 박스 — fill 투명, stroke 만. portrait 위치/사이즈에 맞춤. */
  mascotPortraitFrame: Phaser.GameObjects.Rectangle;
  mascotName: Phaser.GameObjects.Text;
  mascotSubtitle: Phaser.GameObjects.Text;
  mascotLockStatus: Phaser.GameObjects.Text;
  unlockButton: Button;
  prevArrow: Phaser.GameObjects.Text;
  nextArrow: Phaser.GameObjects.Text;

  // POWERUPS 영역
  powerupsTitle: Phaser.GameObjects.Text;
  powerupItems: PowerupItemObjects[];

  // 정보 그룹 반투명 카드 — 텍스트 뒤 배경. depth -10.
  // (titlePanel 은 사용자 요청으로 제거됨. ALBATROSS 로고는 패널 없이 노출.)
  highScorePanel: Phaser.GameObjects.Graphics;
  mascotInfoPanel: Phaser.GameObjects.Graphics;
  powerupsPanel: Phaser.GameObjects.Graphics;
  normalPanel: Phaser.GameObjects.Graphics;
  hardPanel: Phaser.GameObjects.Graphics;
};

type PowerupItemObjects = {
  /** 색 블럭 (block_X_drop). 인게임 아이템 드랍과 동일. */
  iconContainer: Phaser.GameObjects.Image;
  /** 흰 아이콘 overlay (icon_X). 인게임 블럭 위 표시와 동일. */
  iconOverlay: Phaser.GameObjects.Image;
  iconCenterX: number;
  iconLeftX: number;
  name: Phaser.GameObjects.Text;
  description: Phaser.GameObjects.Text;
};

const DIFFICULTY_NORMAL_COLOR_SELECTED = '#ffff00';
const DIFFICULTY_NORMAL_COLOR_DIM = '#888888';
const DIFFICULTY_HARD_COLOR_SELECTED = '#ff5050';
const DIFFICULTY_HARD_COLOR_DIM = '#888888';

const CX = CANVAS_WIDTH / 2;

// 2026-05-18: 타이틀UI영역.png 가이드 기반 전면 재배치.
// 캔버스 1080×1920 기준 패널 6개 배치 (HIGH SCORE 좌상단, 제목, portrait+화살표,
// mascot 정보, POWERUPS, NORMAL/HARD 버튼 2개).
const LOGO_Y = 260;                  // 제목 패널 안

const MASCOT_PLACEHOLDER_Y = 600;    // portrait 가운데
const MASCOT_PLACEHOLDER_SIZE = 380; // 작아짐 (450→380)
const MASCOT_ARROW_OFFSET_X = 430;   // 화살표 좌/우 (portrait 반폭 190 + 여백)

// mascot 정보 패널 안 3줄.
const MASCOT_NAME_Y = 940;
const MASCOT_LOCK_STATUS_Y = 985;
const GOLD_Y = 1030;
// subtitle/unlock button 제거 — 이미지에 없음.

// HIGH SCORE — 좌상단 별도 패널 (origin 0, 0.5 로 좌측 정렬).
const HIGH_SCORE_X = 50;
const HIGH_SCORE_Y = 117;

// POWERUPS — 가로 풀 카드 안. 폰트 키우며 간격도 늘림.
const POWERUPS_TITLE_Y = 1250;
const POWERUPS_ITEM_ROW_Y = 1340;
const POWERUPS_DESC_Y = 1425;

// NORMAL/HARD — 좌/우 분할 두 박스. 한 줄 텍스트 ("NORMAL PLAY" / "HARD PLAY").
const BUTTON_BOX_Y = 1655;          // 박스 중심 y
const NORMAL_BOX_CX = 280;
const HARD_BOX_CX = 800;

// POWERUPS 데이터. 아이콘은 인게임 블럭/드랍 아이템과 동일 (색 블럭 + 흰 아이콘).
const POWERUPS = [
  { name: 'EXPAND', blockTex: 'block_basic_drop',  iconTex: 'icon_expand', desc: 'Bar grows wider\nfor easier rebound' },
  { name: 'MAGNET', blockTex: 'block_magnet_drop', iconTex: 'icon_magnet', desc: 'Catches ball.\nSPACE to launch'     },
  { name: 'LASER',  blockTex: 'block_laser_drop',  iconTex: 'icon_laser',  desc: 'Bar fires lasers.\nSPACE to shoot'  },
];

// 2026-05-18: 인게임 블럭 64×24 와 동일 비율 (2.67:1).
const POWERUP_ICON_W = 96;
const POWERUP_ICON_H = 36;
const POWERUP_NAME_GAP = 32;

const ITEM_BOX_WIDTH = 320;

const COLOR_BUTTON_FILL = 0x1a2a3a;
const COLOR_BUTTON_STROKE = 0x4488cc;

function createTextButton(
  scene: Phaser.Scene,
  x: number,
  y: number,
  w: number,
  h: number,
  text: string,
): Button {
  const rect = scene.add
    .rectangle(x, y, w, h, COLOR_BUTTON_FILL)
    .setStrokeStyle(2, COLOR_BUTTON_STROKE)
    .setOrigin(0.5, 0.5)
    .setScrollFactor(0)
    .setVisible(false)
    .setInteractive({ useHandCursor: true });
  const label = scene.add
    .text(x, y, text, { fontSize: '24px', color: '#ffffff', fontFamily: 'DNFBitBitv2, monospace', fontStyle: 'bold' })
    .setOrigin(0.5, 0.5)
    .setScrollFactor(0)
    .setVisible(false);
  return { rect, label };
}

// 정보 그룹 카드 — 폰트 사이즈 키운 만큼 패널 조정.
const CARD_HIGHSCORE  = { cx: 220, cy: 117, w: 380, h: 78 };           // 좌상단 (font 30 → w 늘림)
// CARD_TITLE — 2026-05-18: 사용자 요청으로 제거됨 (로고는 패널 없이 직접 노출).
const CARD_MASCOTINFO = { cx: CX, cy: 985, w: 620, h: 160 };           // 3줄 (font 36/28/28)
const CARD_POWERUPS   = { cx: CX, cy: 1340, w: 1010, h: 260 };         // POWERUPS
const CARD_NORMAL     = { cx: NORMAL_BOX_CX, cy: BUTTON_BOX_Y, w: 490, h: 170 };  // 한 줄 (font 52)
const CARD_HARD       = { cx: HARD_BOX_CX,   cy: BUTTON_BOX_Y, w: 490, h: 170 };

export function createTitleScreenObjects(
  scene: Phaser.Scene,
  mascotHandlers: MascotCarouselHandlers,
): TitleScreenObjects {
  // 정보 그룹 6개 반투명 카드 (텍스트보다 뒤, depth=-10).
  const highScorePanel  = createTextPanel(scene, CARD_HIGHSCORE.cx,  CARD_HIGHSCORE.cy,  CARD_HIGHSCORE.w,  CARD_HIGHSCORE.h);
  const mascotInfoPanel = createTextPanel(scene, CARD_MASCOTINFO.cx, CARD_MASCOTINFO.cy, CARD_MASCOTINFO.w, CARD_MASCOTINFO.h);
  const powerupsPanel   = createTextPanel(scene, CARD_POWERUPS.cx,   CARD_POWERUPS.cy,   CARD_POWERUPS.w,   CARD_POWERUPS.h);
  // NORMAL 버튼 — 초록 입체 + 발광. 클릭 시 normal 선택 + 게임 시작.
  const normalPanel     = createTextPanel(scene, CARD_NORMAL.cx, CARD_NORMAL.cy, CARD_NORMAL.w, CARD_NORMAL.h,
    { color: 0x44aa44, alpha: 0.95, strokeColor: 0x88dd88, strokeWidth: 5, cornerRadius: 24,
      bevel: true, glowColor: 0x44cc66,
      onClick: () => mascotHandlers.onNormalClick?.() });
  // HARD 버튼 — 빨강 입체 + 발광. 클릭 시 hard 선택 + 게임 시작.
  const hardPanel       = createTextPanel(scene, CARD_HARD.cx,   CARD_HARD.cy,   CARD_HARD.w,   CARD_HARD.h,
    { color: 0xcc4444, alpha: 0.95, strokeColor: 0xff8888, strokeWidth: 5, cornerRadius: 24,
      bevel: true, glowColor: 0xff5050,
      onClick: () => mascotHandlers.onHardClick?.() });

  // ALBATROSS 로고 — 패널 없이 직접 노출. 폰트 1.3배 (84→110).
  const logo = scene.add
    .text(CX, LOGO_Y, 'ALBATROSS', {
      fontSize: '110px', color: '#ffffff', fontFamily: 'DNFBitBitv2, monospace', fontStyle: 'bold',
    })
    .setOrigin(0.5, 0.5).setScrollFactor(0).setVisible(false);

  // Mascot portrait V2 — 가로세로 동일 정사각형 + 테두리 박스. portrait2.<id> 키.
  const mascotPortrait = scene.add
    .image(CX, MASCOT_PLACEHOLDER_Y, 'portrait2.albatross')
    .setOrigin(0.5, 0.5)
    .setDisplaySize(MASCOT_PLACEHOLDER_SIZE, MASCOT_PLACEHOLDER_SIZE)
    .setScrollFactor(0).setVisible(false);
  // 테두리: 흰색 4px stroke. fill 투명.
  const mascotPortraitFrame = scene.add
    .rectangle(CX, MASCOT_PLACEHOLDER_Y, MASCOT_PLACEHOLDER_SIZE, MASCOT_PLACEHOLDER_SIZE, 0x000000, 0)
    .setStrokeStyle(4, 0xffffff)
    .setOrigin(0.5, 0.5)
    .setScrollFactor(0).setVisible(false);

  // Left / Right arrows — 클릭 시 cursor 이동.
  const prevArrow = scene.add
    .text(CX - MASCOT_ARROW_OFFSET_X, MASCOT_PLACEHOLDER_Y, '<', {
      fontSize: '88px', color: '#888888', fontFamily: 'DNFBitBitv2, monospace', fontStyle: 'bold',
    })
    .setOrigin(0.5, 0.5).setScrollFactor(0).setVisible(false)
    .setInteractive({ useHandCursor: true });
  prevArrow.on('pointerdown', () => mascotHandlers.onCursorPrev());
  // hover/out 색 hardcoded 제거 — cursor 위치 기반 색은 renderTitleScreen 매 프레임 갱신.

  const nextArrow = scene.add
    .text(CX + MASCOT_ARROW_OFFSET_X, MASCOT_PLACEHOLDER_Y, '>', {
      fontSize: '88px', color: '#888888', fontFamily: 'DNFBitBitv2, monospace', fontStyle: 'bold',
    })
    .setOrigin(0.5, 0.5).setScrollFactor(0).setVisible(false)
    .setInteractive({ useHandCursor: true });
  nextArrow.on('pointerdown', () => mascotHandlers.onCursorNext());
  // (위와 동일 — hover 색 갱신은 renderTitleScreen 매 프레임에서 처리)

  // 이름 / 부제 / 잠금 상태
  const mascotName = scene.add
    .text(CX, MASCOT_NAME_Y, '', {
      fontSize: '36px', color: '#ffffff', fontFamily: 'DNFBitBitv2, monospace', fontStyle: 'bold',
    })
    .setOrigin(0.5, 0.5).setScrollFactor(0).setVisible(false);
  // subtitle 인스턴스만 유지 (type 호환). 화면 밖 위치, 영구 hidden.
  const mascotSubtitle = scene.add
    .text(-1000, -1000, '', { fontSize: '20px', color: '#bbbbbb', fontFamily: 'DNFBitBitv2, monospace' })
    .setOrigin(0.5, 0.5).setScrollFactor(0).setVisible(false);
  const mascotLockStatus = scene.add
    .text(CX, MASCOT_LOCK_STATUS_Y, '', {
      fontSize: '28px', color: '#aaaaaa', fontFamily: 'DNFBitBitv2, monospace', fontStyle: 'bold',
    })
    .setOrigin(0.5, 0.5).setScrollFactor(0).setVisible(false);

  // 잠금 해제 버튼 — portrait bottom(790) ~ mascotInfo top(905) 사이 (cy=848).
  // 파란색 입체 + 발광 효과 (NORMAL/HARD 버튼 톤과 유사한 별도 색).
  const UNLOCK_X = CX;
  const UNLOCK_Y = 848;
  const UNLOCK_W = 320;
  const UNLOCK_H = 60;
  const unlockRect = scene.add
    .rectangle(UNLOCK_X, UNLOCK_Y, UNLOCK_W, UNLOCK_H, 0xff8833)
    .setStrokeStyle(4, 0xffcc88)
    .setOrigin(0.5, 0.5)
    .setScrollFactor(0)
    .setVisible(false)
    .setInteractive({ useHandCursor: true });
  unlockRect.postFX?.addGlow(0xffaa55, 5, 0, false, 0.1, 14);
  // bevel: top highlight + bottom shadow.
  const unlockBevel = scene.add.graphics().setScrollFactor(0).setVisible(false);
  const _ui = 3;
  const _hh = UNLOCK_H / 2;
  const _l = UNLOCK_X - UNLOCK_W / 2 + _ui;
  const _t = UNLOCK_Y - UNLOCK_H / 2 + _ui;
  unlockBevel.fillStyle(0xffffff, 0.22);
  unlockBevel.fillRect(_l, _t, UNLOCK_W - _ui * 2, _hh - _ui);
  unlockBevel.fillStyle(0x000000, 0.25);
  unlockBevel.fillRect(_l, UNLOCK_Y, UNLOCK_W - _ui * 2, _hh - _ui);
  const unlockLabel = scene.add
    .text(UNLOCK_X, UNLOCK_Y, 'BUY', {
      fontSize: '30px', color: '#ffffff', fontFamily: 'DNFBitBitv2, monospace', fontStyle: 'bold',
    })
    .setOrigin(0.5, 0.5)
    .setScrollFactor(0)
    .setVisible(false);
  const unlockButton: Button = { rect: unlockRect, label: unlockLabel, bevel: unlockBevel };
  unlockButton.rect.on('pointerdown', () => mascotHandlers.onTryUnlock());

  // POWERUPS
  const powerupsTitle = scene.add
    .text(CX, POWERUPS_TITLE_Y, 'POWERUPS', { fontSize: '40px', color: '#ffffff', fontFamily: 'DNFBitBitv2, monospace', fontStyle: 'bold' })
    .setOrigin(0.5, 0.5).setScrollFactor(0).setVisible(false);

  const powerupItems: PowerupItemObjects[] = [];
  for (let i = 0; i < POWERUPS.length; i++) {
    const data = POWERUPS[i]!;
    const itemCx = CX + (i - 1) * ITEM_BOX_WIDTH;
    const iconCenterX = itemCx - 70;
    const iconCenterY = POWERUPS_ITEM_ROW_Y;
    const iconLeftX = iconCenterX - POWERUP_ICON_W / 2;
    const iconRightX = iconCenterX + POWERUP_ICON_W / 2;

    // 색 블럭 + 흰 아이콘 두 레이어 (인게임 블럭과 동일 비율 2.67:1).
    // 흰 아이콘은 블럭 너비의 55% 정도 — 인게임 블럭 위 표시와 비슷.
    const iconContainer = scene.add
      .image(iconCenterX, iconCenterY, data.blockTex)
      .setDisplaySize(POWERUP_ICON_W, POWERUP_ICON_H)
      .setOrigin(0.5, 0.5)
      .setScrollFactor(0).setVisible(false);
    const iconOverlay = scene.add
      .image(iconCenterX, iconCenterY, data.iconTex)
      .setDisplaySize(POWERUP_ICON_W * 0.55, POWERUP_ICON_H * 0.7)
      .setOrigin(0.5, 0.5)
      .setScrollFactor(0).setVisible(false);

    const nameLeftX = iconRightX + POWERUP_NAME_GAP;
    const name = scene.add
      .text(nameLeftX, iconCenterY, data.name, { fontSize: '28px', color: '#ffffff', fontFamily: 'DNFBitBitv2, monospace', fontStyle: 'bold' })
      .setOrigin(0, 0.5).setScrollFactor(0).setVisible(false);

    const nameRightX = nameLeftX + name.width;
    const descCenterX = (iconLeftX + nameRightX) / 2;
    const description = scene.add
      .text(descCenterX, POWERUPS_DESC_Y, data.desc, {
        fontSize: '20px', color: '#ffffff', fontFamily: 'DNFBitBitv2, monospace', align: 'center',
      })
      .setOrigin(0.5, 0.5).setScrollFactor(0).setVisible(false);

    powerupItems.push({ iconContainer, iconOverlay, iconCenterX, iconLeftX, name, description });
  }

  // 하단 — NORMAL/HARD 박스 안 텍스트, HIGH SCORE 좌상단, GOLD 는 mascot 정보 패널 안.
  // startText: 사용 안 함 (NORMAL/HARD 버튼이 시작 역할). 빈 텍스트로 보존.
  const startText = scene.add
    .text(CX, 1850, '', { fontSize: '1px', color: '#ffffff', fontFamily: 'DNFBitBitv2, monospace' })
    .setOrigin(0.5, 0.5).setScrollFactor(0).setVisible(false);
  // HIGH SCORE — 좌상단 카드 안 가운데 정렬 (사용자 요청). CARD_HIGHSCORE 중심에 origin(0.5, 0.5).
  const highScoreText = scene.add
    .text(CARD_HIGHSCORE.cx, CARD_HIGHSCORE.cy, '', { fontSize: '30px', color: '#ffff00', fontFamily: 'DNFBitBitv2, monospace', fontStyle: 'bold' })
    .setOrigin(0.5, 0.5).setScrollFactor(0).setVisible(false);
  // GOLD — mascot 정보 패널 안 (줄 3).
  const goldText = scene.add
    .text(CX, GOLD_Y, '', { fontSize: '28px', color: '#ffcc44', fontFamily: 'DNFBitBitv2, monospace', fontStyle: 'bold' })
    .setOrigin(0.5, 0.5).setScrollFactor(0).setVisible(false);

  // NORMAL/HARD — 한 줄, 단어별 색상 분리. PLAY 는 흰색.
  // 두 텍스트 합친 width 측정 후 박스 중앙으로 reposition.
  const WORD_GAP = 14;
  const normalLabel = scene.add
    .text(0, BUTTON_BOX_Y, 'NORMAL', {
      fontSize: '44px', color: '#ffffff', fontFamily: 'DNFBitBitv2, monospace', fontStyle: 'bold',
    })
    .setOrigin(0, 0.5).setScrollFactor(0).setVisible(false);
  const difficultyHelp = scene.add
    .text(0, BUTTON_BOX_Y, 'PLAY', {
      fontSize: '44px', color: '#ffffff', fontFamily: 'DNFBitBitv2, monospace', fontStyle: 'bold',
    })
    .setOrigin(0, 0.5).setScrollFactor(0).setVisible(false);
  // NORMAL 박스 중앙 정렬.
  {
    const totalW = normalLabel.width + WORD_GAP + difficultyHelp.width;
    const startX = NORMAL_BOX_CX - totalW / 2;
    normalLabel.setX(startX);
    difficultyHelp.setX(startX + normalLabel.width + WORD_GAP);
  }

  const hardLabel = scene.add
    .text(0, BUTTON_BOX_Y, 'HARD', {
      fontSize: '44px', color: '#ffffff', fontFamily: 'DNFBitBitv2, monospace', fontStyle: 'bold',
    })
    .setOrigin(0, 0.5).setScrollFactor(0).setVisible(false);
  const hardSubText = scene.add
    .text(0, BUTTON_BOX_Y, 'PLAY', {
      fontSize: '44px', color: '#ffffff', fontFamily: 'DNFBitBitv2, monospace', fontStyle: 'bold',
    })
    .setOrigin(0, 0.5).setScrollFactor(0).setVisible(false);
  // HARD 박스 중앙 정렬.
  {
    const totalW = hardLabel.width + WORD_GAP + hardSubText.width;
    const startX = HARD_BOX_CX - totalW / 2;
    hardLabel.setX(startX);
    hardSubText.setX(startX + hardLabel.width + WORD_GAP);
  }

  // 사용자가 mascotHandlers 참조를 사용하지 않는 메서드 — type 위해 참조 보존.
  void mascotHandlers.getCursorIndex;

  return {
    logo, startText, highScoreText, goldText,
    normalLabel, hardLabel, difficultyHelp, hardSubText,
    mascotPortrait, mascotPortraitFrame, mascotName, mascotSubtitle, mascotLockStatus,
    unlockButton, prevArrow, nextArrow,
    powerupsTitle, powerupItems,
    highScorePanel, mascotInfoPanel, powerupsPanel, normalPanel, hardPanel,
  };
}

export function renderTitleScreen(
  objects: TitleScreenObjects,
  viewModel: TitleScreenViewModel,
  mascotState: { cursorIndex: number; gold: number; isUnlocked: (id: string) => boolean },
): void {
  // 정보 그룹 카드 visible (5개. titlePanel 제거됨).
  objects.highScorePanel.setVisible(true);
  objects.mascotInfoPanel.setVisible(true);
  objects.powerupsPanel.setVisible(true);
  objects.normalPanel.setVisible(true);
  objects.hardPanel.setVisible(true);

  // 기본 텍스트
  objects.logo.setVisible(true);
  // startText (PRESS SPACE) 안 보임 — NORMAL/HARD 버튼이 시작 역할.
  objects.startText.setVisible(false);
  objects.highScoreText.setText(`HIGH SCORE  ${viewModel.highScore}`).setVisible(true);
  objects.goldText.setText(`GOLD  ${mascotState.gold}`).setVisible(true);

  const isHard = viewModel.selectedDifficulty === 'hard';
  // 글자는 항상 alpha 1.0 흰색 (회색빛 방지). 선택 표시는 box panel alpha 변동.
  objects.normalLabel.setColor('#ffffff').setAlpha(1.0).setVisible(true);
  objects.hardLabel.setColor('#ffffff').setAlpha(1.0).setVisible(true);
  objects.difficultyHelp.setAlpha(1.0);
  objects.hardSubText.setAlpha(1.0);
  // 박스 alpha — 번갈아 깜빡임 (NORMAL ↔ HARD 약 1초 주기). 클릭 유도용 attention.
  // 선택된 박스는 항상 alpha=1.0, 비선택은 0.5..1.0 사이 sinusoidal pulse.
  const t = performance.now() / 500; // 1초 주기.
  const pulse = 0.5 + 0.5 * Math.abs(Math.sin(t));        // 0.5 → 1.0
  const invPulse = 0.5 + 0.5 * Math.abs(Math.cos(t));     // 위상 반대
  objects.normalPanel.setAlpha(isHard ? invPulse : 1.0);
  objects.hardPanel.setAlpha(isHard ? 1.0 : pulse);
  // PLAY 흰색 텍스트 (NORMAL/HARD 옆에 항상 표시).
  objects.difficultyHelp.setVisible(true);
  objects.hardSubText.setVisible(true);

  // Mascot 표시 — cursor 위치의 캐릭터.
  const idx = ((mascotState.cursorIndex % MascotTable.length) + MascotTable.length) % MascotTable.length;
  const mascot: MascotDefinition = MascotTable[idx]!;
  const unlocked = mascotState.isUnlocked(mascot.id);

  objects.mascotPortrait
    .setTexture(`portrait2.${mascot.id}`)
    .setDisplaySize(MASCOT_PLACEHOLDER_SIZE, MASCOT_PLACEHOLDER_SIZE);
  if (unlocked) {
    objects.mascotPortrait.clearTint();
  } else {
    // 잠금 = 어두운 실루엣.
    objects.mascotPortrait.setTint(0x444444);
  }
  objects.mascotPortrait.setVisible(true);
  objects.mascotPortraitFrame.setVisible(true);

  objects.mascotName.setText(mascot.displayName).setVisible(true);
  // subtitle 미사용 (이미지 가이드 3줄: 이름/언락/골드).
  objects.mascotSubtitle.setVisible(false);

  if (unlocked) {
    objects.mascotLockStatus.setText('UNLOCKED').setColor('#88ff88').setVisible(true);
    objects.unlockButton.rect.setVisible(false);
    objects.unlockButton.label.setVisible(false);
    objects.unlockButton.bevel?.setVisible(false);
  } else {
    objects.mascotLockStatus.setText('LOCKED').setColor('#ff7777').setVisible(true);
    // BUY 버튼 + 가격 표시. 골드 부족 시 어둡게.
    const canAfford = mascotState.gold >= mascot.unlockCost;
    objects.unlockButton.rect
      .setFillStyle(canAfford ? 0xff8833 : 0x333333)
      .setStrokeStyle(4, canAfford ? 0xffcc88 : 0x555555)
      .setVisible(true);
    objects.unlockButton.label
      .setText(`BUY  ${mascot.unlockCost} G`)
      .setColor(canAfford ? '#ffffff' : '#888888')
      .setVisible(true);
    objects.unlockButton.bevel?.setVisible(true);
  }
  // 화살표 색 — cursor 가 끝(첫/마지막) 에 있으면 그 방향 화살표만 dimmed.
  //   albatross(0):   ←dim   →white
  //   kongming(1)..reaper(3): 양쪽 white
  //   seraphin(last): ←white →dim
  const isFirst = idx === 0;
  const isLast = idx === MascotTable.length - 1;
  objects.prevArrow.setColor(isFirst ? '#888888' : '#ffffff').setVisible(true);
  objects.nextArrow.setColor(isLast ? '#888888' : '#ffffff').setVisible(true);

  // POWERUPS — 인게임 블럭처럼 정적 (회전 없음).
  objects.powerupsTitle.setVisible(true);
  for (const item of objects.powerupItems) {
    item.iconContainer.angle = 0;
    item.iconOverlay.angle = 0;
    item.iconContainer.setVisible(true);
    item.iconOverlay.setVisible(true);
    item.name.setVisible(true);
    item.description.setVisible(true);
  }

  // ViewModel 의 selectedDifficulty 만 직접 사용. mascot 은 mascotState 로 주입.
  void getMascotById; // export 보존
}

export function hideTitleScreen(objects: TitleScreenObjects): void {
  objects.highScorePanel.setVisible(false);
  objects.mascotInfoPanel.setVisible(false);
  objects.powerupsPanel.setVisible(false);
  objects.normalPanel.setVisible(false);
  objects.hardPanel.setVisible(false);
  objects.hardSubText.setVisible(false);
  objects.logo.setVisible(false);
  objects.startText.setVisible(false);
  objects.highScoreText.setVisible(false);
  objects.goldText.setVisible(false);
  objects.normalLabel.setVisible(false);
  objects.hardLabel.setVisible(false);
  objects.difficultyHelp.setVisible(false);
  objects.mascotPortrait.setVisible(false);
  objects.mascotPortraitFrame.setVisible(false);
  objects.mascotName.setVisible(false);
  objects.mascotSubtitle.setVisible(false);
  objects.mascotLockStatus.setVisible(false);
  objects.unlockButton.rect.setVisible(false);
  objects.unlockButton.label.setVisible(false);
  objects.unlockButton.bevel?.setVisible(false);
  objects.prevArrow.setVisible(false);
  objects.nextArrow.setVisible(false);
  objects.powerupsTitle.setVisible(false);
  for (const item of objects.powerupItems) {
    item.iconContainer.setVisible(false);
    item.iconOverlay.setVisible(false);
    item.name.setVisible(false);
    item.description.setVisible(false);
  }
}
