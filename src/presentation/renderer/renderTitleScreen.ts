import type Phaser from 'phaser';
import type { TitleScreenViewModel } from '../view-models/TitleScreenViewModel';
import type { MascotDefinition } from '../../definitions/types/MascotDefinition';
import { MascotTable, getMascotById } from '../../definitions/tables/MascotTable';
import { CANVAS_WIDTH } from './canvasLayout';
import { createTextPanel } from './components/TextPanel';
import { createButton, type Button } from '../ui/Button';
import { createToast } from '../ui/Toast';

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

// (local Button type 제거 — 공용 Button (ui/Button.ts) 사용으로 통합. unlockButton 만 쓰던 곳.)

export type TitleScreenObjects = {
  // 텍스트
  logo: Phaser.GameObjects.Text;
  startText: Phaser.GameObjects.Text;
  highScoreText: Phaser.GameObjects.Text;
  goldText: Phaser.GameObjects.Text;

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
  mascotInfoPanel: Phaser.GameObjects.Graphics;
  powerupsPanel: Phaser.GameObjects.Graphics;

  // NORMAL / HARD 버튼 — 공용 Button 컴포넌트.
  normalButton: Button;
  hardButton: Button;
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
  const mascotInfoPanel = createTextPanel(scene, CARD_MASCOTINFO.cx, CARD_MASCOTINFO.cy, CARD_MASCOTINFO.w, CARD_MASCOTINFO.h);
  void CARD_HIGHSCORE; // panel 제거됨 — 텍스트만 표시
  const powerupsPanel   = createTextPanel(scene, CARD_POWERUPS.cx,   CARD_POWERUPS.cy,   CARD_POWERUPS.w,   CARD_POWERUPS.h);
  // NORMAL 버튼 — primary (초록). 라벨 'NORMAL PLAY' 한 텍스트로 통합 (옛은 'NORMAL'+'PLAY' 분리였지만 색 동일이라 묶음).
  // glow 없음 — Title 은 밝은 배경. glow 룰: 어두운 backdrop 위 액션 버튼만 ([[learning_principles_albatross]]).
  const normalButton = createButton(scene, {
    cx: CARD_NORMAL.cx, cy: CARD_NORMAL.cy, w: CARD_NORMAL.w, h: CARD_NORMAL.h,
    label: 'NORMAL PLAY',
    variant: 'primary',
    fontSize: '44px',
    scrollFactor: 0,
    onClick: () => mascotHandlers.onNormalClick?.(),
  });
  // HARD 버튼 — danger (빨강). glow 없음 (동일 이유).
  const hardButton = createButton(scene, {
    cx: CARD_HARD.cx, cy: CARD_HARD.cy, w: CARD_HARD.w, h: CARD_HARD.h,
    label: 'HARD PLAY',
    variant: 'danger',
    fontSize: '44px',
    scrollFactor: 0,
    onClick: () => mascotHandlers.onHardClick?.(),
  });

  // ALBATROSS 로고 — 패널 없이 직접 노출. 폰트 1.3배 (84→110).
  const logo = scene.add
    .text(CX, LOGO_Y, 'ALBATROSS', {
      fontSize: '110px', color: '#ffffff', fontFamily: 'DNFBitBitv2, monospace', fontStyle: 'bold',
    })
    .setOrigin(0.5, 0.5).setScrollFactor(0).setVisible(false);
  // 2026-05-19: 빛 sweep — 좌→우 한 번, 2초 휴식 후 무한 반복.
  // postFX.addShine 의 active 토글로 한 사이클씩만 보이게 함.
  // (sweep 자체는 약 700ms 정도 — speed 0.6 기준 한 번 라인이 지나가는 길이.)
  const shineFx = logo.postFX?.addShine(0.6, 0.5, 5);
  if (shineFx) shineFx.active = false;
  if (shineFx) {
    scene.time.addEvent({
      delay: 2700, // 700ms sweep + 2000ms pause
      loop: true,
      callback: () => {
        shineFx.active = true;
        scene.time.delayedCall(700, () => { shineFx.active = false; });
      },
    });
  }

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

  // Toast — gold 부족 등 짧은 알림. Title 화면 안 단일 인스턴스.
  // UNLOCK 버튼 (cy=848, h=60 → top=818) 위에 위치 — 토스트 h=84 / 사이 gap ~10 → cy=766.
  const toast = createToast(scene, { cy: 766 });

  // 잠금 해제 버튼 — portrait bottom(790) ~ mascotInfo top(905) 사이 (cy=848).
  // 주황색 — variant 외 fillColor 오버라이드 (variant 4번째 안 만듦).
  // afford 상태는 render() 에서 setDisabled — 색 자체가 dark 로.
  // glow 는 끄기 (사용자 요청 — disabled 인지 더 명확하게).
  const unlockButton = createButton(scene, {
    cx: CX,
    cy: 848,
    w: 320,
    h: 60,
    label: 'BUY',
    fillColor: 0xff8833,
    strokeColor: 0xffcc88,
    fontSize: '30px',
    scrollFactor: 0,
    onClick: () => {
      // afford 체크 — 부족하면 토스트 + onTryUnlock 호출 안 함.
      const idx = mascotHandlers.getCursorIndex();
      const norm = ((idx % MascotTable.length) + MascotTable.length) % MascotTable.length;
      const m = MascotTable[norm]!;
      if (mascotHandlers.isUnlocked(m.id)) return;
      if (mascotHandlers.getGold() < m.unlockCost) {
        toast.show('Not enough gold');
        return;
      }
      mascotHandlers.onTryUnlock();
    },
  });

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
  // HIGH SCORE — mascot 정보 카드(bottom 1065) 와 POWERUPS 카드(top 1210) 사이 빈 공간 중앙 (y=1137).
  // 패널 없이 텍스트만.
  const highScoreText = scene.add
    .text(CX, 1137, '', { fontSize: '36px', color: '#ffff00', fontFamily: 'DNFBitBitv2, monospace', fontStyle: 'bold' })
    .setOrigin(0.5, 0.5).setScrollFactor(0).setVisible(false);
  // GOLD — mascot 정보 패널 안 (줄 3).
  const goldText = scene.add
    .text(CX, GOLD_Y, '', { fontSize: '28px', color: '#ffcc44', fontFamily: 'DNFBitBitv2, monospace', fontStyle: 'bold' })
    .setOrigin(0.5, 0.5).setScrollFactor(0).setVisible(false);

  // (옛 normalLabel/hardLabel/difficultyHelp/hardSubText 4개 분리 텍스트 제거 — Button.label 안으로 흡수.
  //  옛 addPressAnimation(normalPanel/hardPanel, [...]) 호출도 제거 — createButton 이 container 단위 자동 press.)

  // 사용자가 mascotHandlers 참조를 사용하지 않는 메서드 — type 위해 참조 보존.
  void mascotHandlers.getCursorIndex;
  void BUTTON_BOX_Y; // (label 좌표용이었지만 Button 안 라벨이 자동 중앙 — 보존만)

  return {
    logo, startText, highScoreText, goldText,
    mascotPortrait, mascotPortraitFrame, mascotName, mascotSubtitle, mascotLockStatus,
    unlockButton, prevArrow, nextArrow,
    powerupsTitle, powerupItems,
    mascotInfoPanel, powerupsPanel, normalButton, hardButton,
  };
}

export function renderTitleScreen(
  objects: TitleScreenObjects,
  viewModel: TitleScreenViewModel,
  mascotState: { cursorIndex: number; gold: number; isUnlocked: (id: string) => boolean },
): void {
  // 정보 그룹 카드 visible.
  objects.mascotInfoPanel.setVisible(true);
  objects.powerupsPanel.setVisible(true);
  objects.normalButton.setVisible(true);
  objects.hardButton.setVisible(true);

  // 기본 텍스트
  objects.logo.setVisible(true);
  // startText (PRESS SPACE) 안 보임 — NORMAL/HARD 버튼이 시작 역할.
  objects.startText.setVisible(false);
  objects.highScoreText.setText(`HIGH SCORE  ${viewModel.highScore}`).setVisible(true);
  objects.goldText.setText(`GOLD  ${mascotState.gold}`).setVisible(true);

  // NORMAL/HARD — 클릭 한 번으로 모드 선택 + 게임 시작. selectedDifficulty 의 시각 표시 불필요
  // (옛 alpha pulse 효과는 *선택 상태* 시각화 — 키보드 토글 시절 잔재. 제거.)

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
    objects.unlockButton.setVisible(false);
  } else {
    objects.mascotLockStatus.setText('LOCKED').setColor('#ff7777').setVisible(true);
    // BUY 버튼 + 가격 표시. 골드 부족 시 setDisabled — 색 자체가 dark 로 변경 + glow off + 라벨 회색.
    const canAfford = mascotState.gold >= mascot.unlockCost;
    objects.unlockButton.setLabel(`BUY  ${mascot.unlockCost} G`);
    objects.unlockButton.setDisabled(!canAfford);
    objects.unlockButton.setVisible(true);
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
  objects.mascotInfoPanel.setVisible(false);
  objects.powerupsPanel.setVisible(false);
  objects.normalButton.setVisible(false);
  objects.hardButton.setVisible(false);
  objects.logo.setVisible(false);
  objects.startText.setVisible(false);
  objects.highScoreText.setVisible(false);
  objects.goldText.setVisible(false);
  objects.mascotPortrait.setVisible(false);
  objects.mascotPortraitFrame.setVisible(false);
  objects.mascotName.setVisible(false);
  objects.mascotSubtitle.setVisible(false);
  objects.mascotLockStatus.setVisible(false);
  objects.unlockButton.setVisible(false);
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
