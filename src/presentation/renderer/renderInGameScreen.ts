import type Phaser from 'phaser';
import type { GameplayRuntimeState } from '../../gameplay/state/GameplayRuntimeState';
import type { HudViewModel } from '../view-models/HudViewModel';
import type { BlockDefinition } from '../../definitions/types/BlockDefinition';

// 블록 시각 ID → 색상 매핑
// Phaser API 없이 순수 값 매핑. Unity 포팅 시 Material/Sprite 참조로 교체된다.
const BLOCK_COLOR_MAP: Record<string, number> = {
  block_basic: 0x888888,
  block_basic_drop: 0xdddd00,
  block_tough: 0x4488ff,
};
const BLOCK_COLOR_DEFAULT = 0x888888;

// 아이템 색상
const ITEM_COLOR = 0xffdd00;

export type InGameObjects = {
  bar: Phaser.GameObjects.Rectangle;
  ball: Phaser.GameObjects.Arc;
  // 블록은 동적으로 캐시: blockId → Rectangle
  blockMap: Map<string, Phaser.GameObjects.Rectangle>;
  // 아이템 드랍: itemId → Rectangle
  itemMap: Map<string, Phaser.GameObjects.Rectangle>;
  // HUD
  hudScore: Phaser.GameObjects.Text;
  hudLives: Phaser.GameObjects.Text;
  hudRound: Phaser.GameObjects.Text;
  // HUD 구분선
  hudDivider: Phaser.GameObjects.Rectangle;
};

const HUD_HEIGHT = 60;
const BLOCK_WIDTH = 64;
const BLOCK_HEIGHT = 24;
const BAR_HEIGHT = 16;
const BALL_RADIUS = 8;
const ITEM_WIDTH = 24;
const ITEM_HEIGHT = 12;

/**
 * createInGameObjects — InGame 화면에 필요한 Phaser 오브젝트를 1회 생성한다.
 * 블록/아이템은 게임 진행 중 필요에 따라 캐시에 추가된다.
 * Unity 매핑: BarView, BallView, BlockViewPool, HudView MonoBehaviour에 대응.
 */
export function createInGameObjects(scene: Phaser.Scene): InGameObjects {
  // HUD 구분선
  const hudDivider = scene.add
    .rectangle(480, HUD_HEIGHT, 960, 2, 0x444444)
    .setOrigin(0.5, 0.5)
    .setVisible(false);

  // HUD 텍스트
  const hudScore = scene.add
    .text(20, 10, 'SCORE  0', {
      fontSize: '20px',
      color: '#ffffff',
      fontFamily: 'monospace',
    })
    .setOrigin(0, 0)
    .setVisible(false);

  const hudLives = scene.add
    .text(480, 10, 'LIVES  3', {
      fontSize: '20px',
      color: '#ffffff',
      fontFamily: 'monospace',
    })
    .setOrigin(0.5, 0)
    .setVisible(false);

  const hudRound = scene.add
    .text(940, 10, 'RD 1', {
      fontSize: '20px',
      color: '#ffffff',
      fontFamily: 'monospace',
    })
    .setOrigin(1, 0)
    .setVisible(false);

  // 바
  const bar = scene.add
    .rectangle(480, 680, 120, BAR_HEIGHT, 0xffffff)
    .setVisible(false);

  // 공
  const ball = scene.add
    .arc(480, 660, BALL_RADIUS, 0, 360, false, 0xffffff)
    .setVisible(false);

  return {
    bar,
    ball,
    blockMap: new Map(),
    itemMap: new Map(),
    hudScore,
    hudLives,
    hudRound,
    hudDivider,
  };
}

/**
 * renderInGameScreen — InGame 화면 오브젝트를 gameplayState / hudViewModel에 맞게 갱신한다.
 * 매 프레임 visible/position/text 갱신만 수행. 오브젝트 신규 생성은 최소화.
 * Unity 매핑: BarView.Refresh(), BallView.Refresh(), BlockViewPool.Refresh() 형태.
 */
export function renderInGameScreen(
  scene: Phaser.Scene,
  objects: InGameObjects,
  gameplayState: Readonly<GameplayRuntimeState>,
  hudViewModel: HudViewModel,
  blockDefinitions: Readonly<Record<string, BlockDefinition>>,
): void {
  // HUD 표시
  objects.hudDivider.setVisible(true);
  objects.hudScore.setText(`SCORE  ${hudViewModel.score}`).setVisible(true);
  objects.hudLives.setText(`LIVES  ${hudViewModel.lives}`).setVisible(true);
  objects.hudRound.setText(`RD ${hudViewModel.round}`).setVisible(true);

  // 바
  const bar = gameplayState.bar;
  objects.bar
    .setPosition(bar.x, bar.y)
    .setSize(bar.width, BAR_HEIGHT)
    .setVisible(true);

  // 공 (isActive인 것만 표시. MVP1은 공 1개)
  const activeBall = gameplayState.balls.find((b) => b.isActive);
  if (activeBall) {
    objects.ball.setPosition(activeBall.x, activeBall.y).setVisible(true);
  } else {
    objects.ball.setVisible(false);
  }

  // 블록: 파괴되지 않은 블록만 visible
  const activeBlockIds = new Set<string>();
  for (const block of gameplayState.blocks) {
    if (block.isDestroyed) continue;
    activeBlockIds.add(block.id);

    let rect = objects.blockMap.get(block.id);
    if (!rect) {
      // 최초 등장 시 1회 생성
      const def = blockDefinitions[block.definitionId];
      const color = def
        ? (BLOCK_COLOR_MAP[def.visualId] ?? BLOCK_COLOR_DEFAULT)
        : BLOCK_COLOR_DEFAULT;
      rect = scene.add.rectangle(
        block.x,
        block.y,
        BLOCK_WIDTH,
        BLOCK_HEIGHT,
        color,
      );
      objects.blockMap.set(block.id, rect);
    }

    rect.setPosition(block.x, block.y).setVisible(true);
  }

  // 파괴된 블록 숨기기
  for (const [id, rect] of objects.blockMap) {
    if (!activeBlockIds.has(id)) {
      rect.setVisible(false);
    }
  }

  // 아이템 드랍
  const activeItemIds = new Set<string>();
  for (const item of gameplayState.itemDrops) {
    if (item.isCollected) continue;
    activeItemIds.add(item.id);

    let rect = objects.itemMap.get(item.id);
    if (!rect) {
      rect = scene.add.rectangle(item.x, item.y, ITEM_WIDTH, ITEM_HEIGHT, ITEM_COLOR);
      objects.itemMap.set(item.id, rect);
    }

    rect.setPosition(item.x, item.y).setVisible(true);
  }

  // 수집/소멸된 아이템 숨기기
  for (const [id, rect] of objects.itemMap) {
    if (!activeItemIds.has(id)) {
      rect.setVisible(false);
    }
  }
}

/**
 * hideInGameScreen — InGame 화면 오브젝트를 전부 숨긴다.
 */
export function hideInGameScreen(objects: InGameObjects): void {
  objects.hudDivider.setVisible(false);
  objects.hudScore.setVisible(false);
  objects.hudLives.setVisible(false);
  objects.hudRound.setVisible(false);
  objects.bar.setVisible(false);
  objects.ball.setVisible(false);
  for (const rect of objects.blockMap.values()) {
    rect.setVisible(false);
  }
  for (const rect of objects.itemMap.values()) {
    rect.setVisible(false);
  }
}
