import type Phaser from 'phaser';
import type { TitleScreenViewModel } from '../view-models/TitleScreenViewModel';
import type { MascotDefinition } from '../../definitions/types/MascotDefinition';
import { MascotTable, getMascotById } from '../../definitions/tables/MascotTable';
import { CANVAS_WIDTH } from './canvasLayout';

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
};

type Button = {
  rect: Phaser.GameObjects.Rectangle;
  label: Phaser.GameObjects.Text;
};

export type TitleScreenObjects = {
  // 텍스트
  logo: Phaser.GameObjects.Text;
  startText: Phaser.GameObjects.Text;
  highScoreText: Phaser.GameObjects.Text;
  goldText: Phaser.GameObjects.Text;
  normalLabel: Phaser.GameObjects.Text;
  hardLabel: Phaser.GameObjects.Text;
  difficultyHelp: Phaser.GameObjects.Text;

  // Mascot 캐러셀 — 캐릭터 placeholder + 이름/잠금상태 + arrows + unlock 버튼.
  mascotPlaceholder: Phaser.GameObjects.Rectangle;
  mascotLetter: Phaser.GameObjects.Text;
  mascotName: Phaser.GameObjects.Text;
  mascotSubtitle: Phaser.GameObjects.Text;
  mascotLockStatus: Phaser.GameObjects.Text;
  unlockButton: Button;
  prevArrow: Phaser.GameObjects.Text;
  nextArrow: Phaser.GameObjects.Text;

  // POWERUPS 영역
  powerupsTitle: Phaser.GameObjects.Text;
  powerupItems: PowerupItemObjects[];
};

type PowerupItemObjects = {
  iconContainer: Phaser.GameObjects.Container;
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

// Mascot 영역 좌표.
const MASCOT_PLACEHOLDER_Y = 540;
const MASCOT_PLACEHOLDER_SIZE = 180;
const MASCOT_ARROW_OFFSET_X = 280;   // 중심에서 화살표까지
const MASCOT_NAME_Y = 680;
const MASCOT_SUBTITLE_Y = 720;
const MASCOT_LOCK_STATUS_Y = 770;
const UNLOCK_BUTTON_Y = 830;
const UNLOCK_BUTTON_W = 280;
const UNLOCK_BUTTON_H = 70;

// POWERUPS 좌표 (mascot 아래로 밀림).
const POWERUPS_TITLE_Y = 920;
const POWERUPS_ITEM_ROW_Y = 1000;
const POWERUPS_DESC_Y = 1075;

// 하단 영역.
const PRESS_SPACE_Y = 1170;
const HIGH_SCORE_Y = 1260;
const GOLD_Y = 1310;
const DIFFICULTY_Y = 1400;
const HELP_Y = 1480;

// POWERUPS 데이터.
const POWERUPS = [
  { name: 'EXPAND', initial: 'E', desc: 'Bar grows wider\nfor easier rebound', fillColor: 0xffee99, strokeColor: 0xfff7cc },
  { name: 'MAGNET', initial: 'M', desc: 'Catches ball.\nSPACE to launch',     fillColor: 0x88ccff, strokeColor: 0xc0ddff },
  { name: 'LASER',  initial: 'L', desc: 'Bar fires lasers.\nSPACE to shoot',   fillColor: 0xff8888, strokeColor: 0xffbbbb },
];

const POWERUP_ICON_W = 60;
const POWERUP_ICON_H = 30;
const POWERUP_NAME_GAP = 26; // monospace 22px × 2 글자 폭

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
    .text(x, y, text, { fontSize: '24px', color: '#ffffff', fontFamily: 'monospace', fontStyle: 'bold' })
    .setOrigin(0.5, 0.5)
    .setScrollFactor(0)
    .setVisible(false);
  return { rect, label };
}

export function createTitleScreenObjects(
  scene: Phaser.Scene,
  mascotHandlers: MascotCarouselHandlers,
): TitleScreenObjects {
  // ALBATROSS 로고
  const logo = scene.add
    .text(CX, 380, 'ALBATROSS', {
      fontSize: '96px', color: '#ffffff', fontFamily: 'monospace', fontStyle: 'bold',
    })
    .setOrigin(0.5, 0.5).setScrollFactor(0).setVisible(false);

  // Mascot placeholder (선택된 캐릭터 색상으로 채워짐)
  const mascotPlaceholder = scene.add
    .rectangle(CX, MASCOT_PLACEHOLDER_Y, MASCOT_PLACEHOLDER_SIZE, MASCOT_PLACEHOLDER_SIZE, 0xffffff)
    .setStrokeStyle(3, 0x666666)
    .setOrigin(0.5, 0.5).setScrollFactor(0).setVisible(false);
  const mascotLetter = scene.add
    .text(CX, MASCOT_PLACEHOLDER_Y, 'A', {
      fontSize: '64px', color: '#000000', fontFamily: 'monospace', fontStyle: 'bold',
    })
    .setOrigin(0.5, 0.5).setScrollFactor(0).setVisible(false);

  // Left / Right arrows — 클릭 시 cursor 이동.
  const prevArrow = scene.add
    .text(CX - MASCOT_ARROW_OFFSET_X, MASCOT_PLACEHOLDER_Y, '<', {
      fontSize: '88px', color: '#888888', fontFamily: 'monospace', fontStyle: 'bold',
    })
    .setOrigin(0.5, 0.5).setScrollFactor(0).setVisible(false)
    .setInteractive({ useHandCursor: true });
  prevArrow.on('pointerdown', () => mascotHandlers.onCursorPrev());
  prevArrow.on('pointerover', () => prevArrow.setColor('#ffffff'));
  prevArrow.on('pointerout', () => prevArrow.setColor('#888888'));

  const nextArrow = scene.add
    .text(CX + MASCOT_ARROW_OFFSET_X, MASCOT_PLACEHOLDER_Y, '>', {
      fontSize: '88px', color: '#888888', fontFamily: 'monospace', fontStyle: 'bold',
    })
    .setOrigin(0.5, 0.5).setScrollFactor(0).setVisible(false)
    .setInteractive({ useHandCursor: true });
  nextArrow.on('pointerdown', () => mascotHandlers.onCursorNext());
  nextArrow.on('pointerover', () => nextArrow.setColor('#ffffff'));
  nextArrow.on('pointerout', () => nextArrow.setColor('#888888'));

  // 이름 / 부제 / 잠금 상태
  const mascotName = scene.add
    .text(CX, MASCOT_NAME_Y, '', {
      fontSize: '36px', color: '#ffffff', fontFamily: 'monospace', fontStyle: 'bold',
    })
    .setOrigin(0.5, 0.5).setScrollFactor(0).setVisible(false);
  const mascotSubtitle = scene.add
    .text(CX, MASCOT_SUBTITLE_Y, '', {
      fontSize: '20px', color: '#bbbbbb', fontFamily: 'monospace',
    })
    .setOrigin(0.5, 0.5).setScrollFactor(0).setVisible(false);
  const mascotLockStatus = scene.add
    .text(CX, MASCOT_LOCK_STATUS_Y, '', {
      fontSize: '24px', color: '#aaaaaa', fontFamily: 'monospace',
    })
    .setOrigin(0.5, 0.5).setScrollFactor(0).setVisible(false);

  // 잠금 해제 버튼
  const unlockButton = createTextButton(scene, CX, UNLOCK_BUTTON_Y, UNLOCK_BUTTON_W, UNLOCK_BUTTON_H, 'UNLOCK');
  unlockButton.rect.on('pointerdown', () => mascotHandlers.onTryUnlock());

  // POWERUPS
  const powerupsTitle = scene.add
    .text(CX, POWERUPS_TITLE_Y, 'POWERUPS', { fontSize: '28px', color: '#aaaaaa', fontFamily: 'monospace' })
    .setOrigin(0.5, 0.5).setScrollFactor(0).setVisible(false);

  const powerupItems: PowerupItemObjects[] = [];
  for (let i = 0; i < POWERUPS.length; i++) {
    const data = POWERUPS[i]!;
    const itemCx = CX + (i - 1) * ITEM_BOX_WIDTH;
    const iconCenterX = itemCx - 70;
    const iconCenterY = POWERUPS_ITEM_ROW_Y;
    const iconLeftX = iconCenterX - POWERUP_ICON_W / 2;
    const iconRightX = iconCenterX + POWERUP_ICON_W / 2;

    const body = scene.add
      .rectangle(0, 0, POWERUP_ICON_W, POWERUP_ICON_H, data.fillColor)
      .setStrokeStyle(2, data.strokeColor).setOrigin(0.5, 0.5);
    const letter = scene.add
      .text(0, 0, data.initial, {
        fontSize: '18px', color: '#ffff00', fontFamily: 'monospace', fontStyle: 'bold',
      }).setOrigin(0.5, 0.5);
    letter.setShadow(1, 1, '#000000', 0, true, true);

    const iconContainer = scene.add
      .container(iconCenterX, iconCenterY, [body, letter])
      .setScrollFactor(0).setVisible(false);

    const nameLeftX = iconRightX + POWERUP_NAME_GAP;
    const name = scene.add
      .text(nameLeftX, iconCenterY, data.name, { fontSize: '22px', color: '#ffffff', fontFamily: 'monospace' })
      .setOrigin(0, 0.5).setScrollFactor(0).setVisible(false);

    const nameRightX = nameLeftX + name.width;
    const descCenterX = (iconLeftX + nameRightX) / 2;
    const description = scene.add
      .text(descCenterX, POWERUPS_DESC_Y, data.desc, {
        fontSize: '15px', color: '#cccccc', fontFamily: 'monospace', align: 'center',
      })
      .setOrigin(0.5, 0.5).setScrollFactor(0).setVisible(false);

    powerupItems.push({ iconContainer, iconCenterX, iconLeftX, name, description });
  }

  // 하단
  const startText = scene.add
    .text(CX, PRESS_SPACE_Y, '', { fontSize: '40px', color: '#ffffff', fontFamily: 'monospace' })
    .setOrigin(0.5, 0.5).setScrollFactor(0).setVisible(false);
  const highScoreText = scene.add
    .text(CX, HIGH_SCORE_Y, '', { fontSize: '32px', color: '#ffff00', fontFamily: 'monospace' })
    .setOrigin(0.5, 0.5).setScrollFactor(0).setVisible(false);
  const goldText = scene.add
    .text(CX, GOLD_Y, '', { fontSize: '28px', color: '#ffcc44', fontFamily: 'monospace' })
    .setOrigin(0.5, 0.5).setScrollFactor(0).setVisible(false);

  const normalLabel = scene.add
    .text(CX - 140, DIFFICULTY_Y, 'NORMAL', {
      fontSize: '40px', color: DIFFICULTY_NORMAL_COLOR_SELECTED, fontFamily: 'monospace',
    })
    .setOrigin(0.5, 0.5).setScrollFactor(0).setVisible(false);
  const hardLabel = scene.add
    .text(CX + 140, DIFFICULTY_Y, 'HARD', {
      fontSize: '40px', color: DIFFICULTY_HARD_COLOR_DIM, fontFamily: 'monospace',
    })
    .setOrigin(0.5, 0.5).setScrollFactor(0).setVisible(false);
  const difficultyHelp = scene.add
    .text(CX, HELP_Y, '← / →  to select', { fontSize: '22px', color: '#666666', fontFamily: 'monospace' })
    .setOrigin(0.5, 0.5).setScrollFactor(0).setVisible(false);

  // 사용자가 mascotHandlers 참조를 사용하지 않는 메서드 — type 위해 참조 보존.
  void mascotHandlers.getCursorIndex;

  return {
    logo, startText, highScoreText, goldText,
    normalLabel, hardLabel, difficultyHelp,
    mascotPlaceholder, mascotLetter, mascotName, mascotSubtitle, mascotLockStatus,
    unlockButton, prevArrow, nextArrow,
    powerupsTitle, powerupItems,
  };
}

export function renderTitleScreen(
  objects: TitleScreenObjects,
  viewModel: TitleScreenViewModel,
  mascotState: { cursorIndex: number; gold: number; isUnlocked: (id: string) => boolean },
): void {
  // 기본 텍스트
  objects.logo.setVisible(true);
  objects.startText.setText(viewModel.startText).setVisible(true);
  objects.highScoreText.setText(`HIGH SCORE  ${viewModel.highScore}`).setVisible(true);
  objects.goldText.setText(`GOLD  ${mascotState.gold}`).setVisible(true);

  const isHard = viewModel.selectedDifficulty === 'hard';
  objects.normalLabel
    .setColor(isHard ? DIFFICULTY_NORMAL_COLOR_DIM : DIFFICULTY_NORMAL_COLOR_SELECTED)
    .setVisible(true);
  objects.hardLabel
    .setColor(isHard ? DIFFICULTY_HARD_COLOR_SELECTED : DIFFICULTY_HARD_COLOR_DIM)
    .setVisible(true);
  objects.difficultyHelp.setVisible(true);

  // Mascot 표시 — cursor 위치의 캐릭터.
  const idx = ((mascotState.cursorIndex % MascotTable.length) + MascotTable.length) % MascotTable.length;
  const mascot: MascotDefinition = MascotTable[idx]!;
  const unlocked = mascotState.isUnlocked(mascot.id);

  objects.mascotPlaceholder
    .setFillStyle(unlocked ? mascot.placeholderColor : 0x333333)
    .setStrokeStyle(3, mascot.placeholderStrokeColor)
    .setVisible(true);
  objects.mascotLetter
    .setText(mascot.displayName.charAt(0))
    .setColor(unlocked ? '#000000' : '#666666')
    .setVisible(true);

  objects.mascotName.setText(mascot.displayName).setVisible(true);
  objects.mascotSubtitle.setText(mascot.subtitle).setVisible(true);

  if (unlocked) {
    objects.mascotLockStatus.setText('UNLOCKED').setColor('#88ff88').setVisible(true);
    objects.unlockButton.rect.setVisible(false);
    objects.unlockButton.label.setVisible(false);
  } else {
    objects.mascotLockStatus
      .setText(`LOCKED  —  ${mascot.unlockCost} GOLD`)
      .setColor('#ff7777').setVisible(true);
    const canAfford = mascotState.gold >= mascot.unlockCost;
    objects.unlockButton.rect
      .setFillStyle(canAfford ? COLOR_BUTTON_FILL : 0x222222)
      .setStrokeStyle(2, canAfford ? COLOR_BUTTON_STROKE : 0x444444)
      .setVisible(true);
    objects.unlockButton.label
      .setText(canAfford ? 'UNLOCK' : 'NOT ENOUGH')
      .setColor(canAfford ? '#ffffff' : '#666666')
      .setVisible(true);
  }
  objects.prevArrow.setVisible(true);
  objects.nextArrow.setVisible(true);

  // POWERUPS
  objects.powerupsTitle.setVisible(true);
  for (const item of objects.powerupItems) {
    item.iconContainer.angle = (performance.now() / 1000 * 360) % 360; // 1 회전/초
    item.iconContainer.setVisible(true);
    item.name.setVisible(true);
    item.description.setVisible(true);
  }

  // ViewModel 의 selectedDifficulty 만 직접 사용. mascot 은 mascotState 로 주입.
  void getMascotById; // export 보존
}

export function hideTitleScreen(objects: TitleScreenObjects): void {
  objects.logo.setVisible(false);
  objects.startText.setVisible(false);
  objects.highScoreText.setVisible(false);
  objects.goldText.setVisible(false);
  objects.normalLabel.setVisible(false);
  objects.hardLabel.setVisible(false);
  objects.difficultyHelp.setVisible(false);
  objects.mascotPlaceholder.setVisible(false);
  objects.mascotLetter.setVisible(false);
  objects.mascotName.setVisible(false);
  objects.mascotSubtitle.setVisible(false);
  objects.mascotLockStatus.setVisible(false);
  objects.unlockButton.rect.setVisible(false);
  objects.unlockButton.label.setVisible(false);
  objects.prevArrow.setVisible(false);
  objects.nextArrow.setVisible(false);
  objects.powerupsTitle.setVisible(false);
  for (const item of objects.powerupItems) {
    item.iconContainer.setVisible(false);
    item.name.setVisible(false);
    item.description.setVisible(false);
  }
}
