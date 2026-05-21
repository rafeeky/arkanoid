import type Phaser from 'phaser';
import type { BlockState } from '../../../gameplay/state/BlockState';
import type { BlockDefinition } from '../../../definitions/types/BlockDefinition';
import { BLOCK_WIDTH, BLOCK_HEIGHT } from '../../../gameplay/systems/playfieldLayout';

// TODO (톤 결정 후): 블록도 자산 PNG 폐기하고 `applyGlossyStyle` (또는 톤 변경 시 새 헬퍼)
// 로 통일. 바/공은 이미 GlossyStyle 헬퍼 사용 중. 게임 월드 톤 결정 (하늘/바다/석양/픽셀아트 등)
// 후 블록 visualId 8개 색 매핑 + 코드 generateTexture 또는 직접 Graphics. 지금은 글로시 유지
// 미정이라 헛수고 방지로 PNG 그대로.
// 참조: [[diegetic_non-diegetic]] / learning_principles_albatross §5.

// 드랍 블록 visualId → 위에 표시할 흰색 아이콘 texture key.
const DROP_BLOCK_ICON: Record<string, string> = {
  block_basic_drop:  'icon_expand',   // 노랑 블럭 + 흰 ↔ (확장)
  block_magnet_drop: 'icon_magnet',   // 파랑 블럭 + 흰 U (자석)
  block_laser_drop:  'icon_laser',    // 빨강 블럭 + 흰 ⚡ (번개)
};
const ICON_W = 36;
const ICON_H = 18;

export type BlocksObjects = {
  blockMap: Map<string, Phaser.GameObjects.Image>;
  /** drop 블럭 위 흰색 아이콘 overlay. */
  blockIconMap: Map<string, Phaser.GameObjects.Image>;
};

/**
 * createBlocksObjects — 블록 풀 + 흰색 아이콘 텍스처 1회 생성.
 *
 * 아이콘은 Phaser Graphics 로 직접 그려서 generateTexture 로 등록 → Image 풀이 텍스처 재사용.
 * 자산 추가 없이 코드 레벨로 처리 (사용자 피드백: 코드 레벨 우선).
 */
export function createBlocksObjects(scene: Phaser.Scene): BlocksObjects {
  ensureIconTextures(scene);
  return {
    blockMap: new Map(),
    blockIconMap: new Map(),
  };
}

let iconTexturesGenerated = false;

function ensureIconTextures(scene: Phaser.Scene): void {
  if (iconTexturesGenerated) return;
  iconTexturesGenerated = true;
  // 모두 32×24 캔버스 흰색 도형 → generateTexture 로 등록 → 이후 Image 풀이 setTexture(key).

  // EXPAND: 양방향 화살표 ↔
  {
    const g = scene.add.graphics().setVisible(false);
    g.fillStyle(0xffffff, 1);
    g.fillTriangle(0, 12, 10, 3, 10, 21);      // 왼쪽 화살촉
    g.fillRect(10, 9, 12, 6);                    // 가운데 막대
    g.fillTriangle(32, 12, 22, 3, 22, 21);     // 오른쪽 화살촉
    g.generateTexture('icon_expand', 32, 24);
    g.destroy();
  }
  // MAGNET: U 모양
  {
    const g = scene.add.graphics().setVisible(false);
    g.fillStyle(0xffffff, 1);
    g.fillRect(0, 0, 8, 20);    // 좌측 막대
    g.fillRect(24, 0, 8, 20);   // 우측 막대
    g.fillRect(0, 16, 32, 8);   // 하단 가로 (U 곡선부)
    g.generateTexture('icon_magnet', 32, 24);
    g.destroy();
  }
  // LASER: 번개 모양 (zigzag bolt)
  {
    const g = scene.add.graphics().setVisible(false);
    g.fillStyle(0xffffff, 1);
    g.fillPoints([
      { x: 18, y: 0 },
      { x: 24, y: 0 },
      { x: 14, y: 11 },
      { x: 20, y: 11 },
      { x: 8, y: 24 },
      { x: 14, y: 13 },
      { x: 8, y: 13 },
    ], true);
    g.generateTexture('icon_laser', 32, 24);
    g.destroy();
  }
}

export function renderBlocks(
  scene: Phaser.Scene,
  objects: BlocksObjects,
  blocks: readonly Readonly<BlockState>[],
  blockDefinitions: Readonly<Record<string, BlockDefinition>>,
  flashBlockIds: ReadonlySet<string>,
): void {
  const activeBlockIds = new Set<string>();
  for (const block of blocks) {
    if (block.isDestroyed) continue;
    activeBlockIds.add(block.id);

    const def = blockDefinitions[block.definitionId];
    const frameName = def?.visualId ?? 'block_basic';

    let img = objects.blockMap.get(block.id);
    if (!img) {
      img = scene.add
        .image(block.x, block.y, frameName)
        .setOrigin(0, 0)
        .setDisplaySize(BLOCK_WIDTH, BLOCK_HEIGHT);
      objects.blockMap.set(block.id, img);
    }
    // 매 프레임 setTexture — 스테이지 전환 시 ID 재사용 잔재 fix.
    img.setTexture(frameName);

    if (flashBlockIds.has(block.id)) img.setTintFill(0xffffff);
    else img.clearTint();
    img.setPosition(block.x, block.y).setVisible(true);

    // drop 블록 위 흰색 아이콘 overlay.
    const iconKey = DROP_BLOCK_ICON[frameName];
    const existingIcon = objects.blockIconMap.get(block.id);
    if (iconKey !== undefined) {
      let icon = existingIcon;
      if (!icon) {
        icon = scene.add
          .image(0, 0, iconKey)
          .setOrigin(0.5, 0.5)
          .setDisplaySize(ICON_W, ICON_H);
        objects.blockIconMap.set(block.id, icon);
      }
      icon
        .setTexture(iconKey)
        .setPosition(block.x + BLOCK_WIDTH / 2, block.y + BLOCK_HEIGHT / 2)
        .setVisible(true);
    } else if (existingIcon) {
      // 같은 ID 가 drop → non-drop 으로 재배치되면 (스테이지 전환) icon hide.
      existingIcon.setVisible(false);
    }
  }

  for (const [id, img] of objects.blockMap) {
    if (!activeBlockIds.has(id)) img.setVisible(false);
  }
  for (const [id, icon] of objects.blockIconMap) {
    if (!activeBlockIds.has(id)) icon.setVisible(false);
  }
}

export function hideBlocks(objects: BlocksObjects): void {
  for (const img of objects.blockMap.values()) img.setVisible(false);
  for (const icon of objects.blockIconMap.values()) icon.setVisible(false);
}
