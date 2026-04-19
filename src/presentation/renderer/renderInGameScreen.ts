import type Phaser from 'phaser';
import type { GameplayRuntimeState } from '../../gameplay/state/GameplayRuntimeState';
import type { HudViewModel } from '../view-models/HudViewModel';
import type { BlockDefinition } from '../../definitions/types/BlockDefinition';
import type { SpinnerDefinition } from '../../definitions/types/SpinnerDefinition';
import type { ScreenState } from '../state/ScreenState';

// 블록 시각 ID → 기본 색상 매핑
// Phaser API 없이 순수 값 매핑. Unity 포팅 시 Material/Sprite 참조로 교체된다.
const BLOCK_COLOR_MAP: Record<string, number> = {
  block_basic: 0x888888,
  block_basic_drop: 0xdddd00,
  block_tough: 0x4488ff,
};
// 블록 피격 플래시 색상 매핑 — 기본 색보다 밝은 색으로 강조
const BLOCK_FLASH_COLOR_MAP: Record<string, number> = {
  block_basic: 0xffffff,       // 회색 → 흰색
  block_basic_drop: 0xffffcc,  // 노랑 → 연한 흰노랑
  block_tough: 0xaaccff,       // 파랑 → 연한 하늘색
};
const BLOCK_COLOR_DEFAULT = 0x888888;
const BLOCK_FLASH_COLOR_DEFAULT = 0xffffff;

// 아이템 색상
const ITEM_COLOR = 0xffdd00;

// 회전체 색상
const SPINNER_COLOR = 0xaa88ff; // 보라 계열 임시 색상

// Gate 연출 파라미터
// Gate: 천장 근처에서 좌/우 두 문이 수평으로 열리는 입구 연출.
// Unity 포팅 시: SpawnGateView.Animator 또는 Tween으로 대응.
const GATE_COLOR = 0x888888;          // 입구 색상: 회색
const GATE_HEIGHT = 12;               // 문 높이 (px)
const GATE_Y = 6;                     // 천장 기준 y 위치 (중심)
const GATE_OPEN_END = 0.15;           // spawnProgress < 0.15: 열리는 구간
const GATE_CLOSE_START = 0.85;        // spawnProgress >= 0.85: 닫히는 구간

// 바 색상 — activeEffect 별
const BAR_COLOR_NORMAL = 0xffffff;
const BAR_COLOR_EXPAND = 0xffee99; // 연한 노랑 틴트: 확장 효과 중임을 표시
const BAR_COLOR_MAGNET = 0x88ccff; // 연한 파랑 틴트: 자석 효과 중임을 표시
const BAR_COLOR_LASER  = 0xff8888; // 연한 빨강 틴트: 레이저 효과 중임을 표시 (Phase 5 대비)

export type InGameObjects = {
  bar: Phaser.GameObjects.Rectangle;
  ball: Phaser.GameObjects.Arc;
  // 블록은 동적으로 캐시: blockId → Rectangle
  blockMap: Map<string, Phaser.GameObjects.Rectangle>;
  // 아이템 드랍: itemId → Rectangle
  itemMap: Map<string, Phaser.GameObjects.Rectangle>;
  // 레이저 발사체 풀: shotId → Rectangle
  // 매 프레임 laserShots 배열과 id 기준으로 add/remove 동기화
  laserMap: Map<string, Phaser.GameObjects.Rectangle>;
  // 회전체 풀: spinnerId → Rectangle(cube) | Graphics(triangle)
  // 매 프레임 spinnerStates 배열과 id 기준으로 add/remove 동기화
  // Unity 포팅 시: SpinnerView MonoBehaviour + ObjectPool 형태로 대응.
  spinnerMap: Map<string, Phaser.GameObjects.Rectangle | Phaser.GameObjects.Graphics>;
  // Gate 풀: spinnerId → [leftDoor, rightDoor]
  // spawning phase 동안만 표시. active 전환 후 숨김.
  // Unity 포팅 시: SpawnGateView MonoBehaviour 형태로 대응.
  gateMap: Map<string, [Phaser.GameObjects.Rectangle, Phaser.GameObjects.Rectangle]>;
  // HUD
  hudScore: Phaser.GameObjects.Text;
  hudLives: Phaser.GameObjects.Text;
  hudRound: Phaser.GameObjects.Text;
  // HUD 구분선
  hudDivider: Phaser.GameObjects.Rectangle;
  // 바 효과 남은 시간 표시 (magnet/laser 활성 시에만 visible)
  hudEffectTimer: Phaser.GameObjects.Text;
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
    .rectangle(360, HUD_HEIGHT, 720, 2, 0x444444)
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
    .text(360, 10, 'LIVES  3', {
      fontSize: '20px',
      color: '#ffffff',
      fontFamily: 'monospace',
    })
    .setOrigin(0.5, 0)
    .setVisible(false);

  const hudRound = scene.add
    .text(700, 10, 'RD 1', {
      fontSize: '20px',
      color: '#ffffff',
      fontFamily: 'monospace',
    })
    .setOrigin(1, 0)
    .setVisible(false);

  // 바
  const bar = scene.add
    .rectangle(360, 680, 120, BAR_HEIGHT, 0xffffff)
    .setVisible(false);

  // 공
  const ball = scene.add
    .arc(360, 660, BALL_RADIUS, 0, 360, false, 0xffffff)
    .setVisible(false);

  // 바 효과 남은 시간 텍스트 (화면 하단 중앙, 바 위)
  // activeEffect が magnet/laser の時だけ visible になる
  const hudEffectTimer = scene.add
    .text(360, 648, '', {
      fontSize: '14px',
      color: '#88ccff',
      fontFamily: 'monospace',
    })
    .setOrigin(0.5, 1)
    .setVisible(false);

  return {
    bar,
    ball,
    blockMap: new Map(),
    itemMap: new Map(),
    laserMap: new Map(),
    spinnerMap: new Map(),
    gateMap: new Map(),
    hudScore,
    hudLives,
    hudRound,
    hudDivider,
    hudEffectTimer,
  };
}

/**
 * renderInGameScreen — InGame 화면 오브젝트를 gameplayState / hudViewModel에 맞게 갱신한다.
 * 매 프레임 visible/position/text 갱신만 수행. 오브젝트 신규 생성은 최소화.
 *
 * screenState.blockHitFlashBlockIds: 플래시 중인 블록은 밝은 색으로 그린다.
 * screenState.isBarBreaking: true 이면 바를 opacity/scale 감소 애니메이션으로 표현.
 *   barBreakProgress 가 없으므로 SceneRenderer 에서 VisualEffectController.getBarBreakProgress()
 *   를 별도로 전달받거나, screenState 에 progress 를 포함시켜야 한다.
 *   현재는 barBreakProgress 를 추가 인자로 받는다.
 *
 * Unity 매핑: BarView.Refresh(), BallView.Refresh(), BlockViewPool.Refresh() 형태.
 */
export function renderInGameScreen(
  scene: Phaser.Scene,
  objects: InGameObjects,
  gameplayState: Readonly<GameplayRuntimeState>,
  hudViewModel: HudViewModel,
  blockDefinitions: Readonly<Record<string, BlockDefinition>>,
  spinnerDefinitions: Readonly<Record<string, SpinnerDefinition>>,
  screenState: Readonly<ScreenState>,
  barBreakProgress: number,
): void {
  // HUD 표시
  objects.hudDivider.setVisible(true);
  objects.hudScore.setText(`SCORE  ${hudViewModel.score}`).setVisible(true);
  objects.hudLives.setText(`LIVES  ${hudViewModel.lives}`).setVisible(true);
  objects.hudRound.setText(`RD ${hudViewModel.round}`).setVisible(true);

  const flashBlockIdSet = new Set(screenState.blockHitFlashBlockIds);

  // 바 — 파괴 연출: progress(1.0→0.0) 기반으로 alpha/scaleX 선형 감소
  const bar = gameplayState.bar;
  // activeEffect に応じた色を選択
  // expand → 연한 노랑, magnet → 연한 파랑, laser → 연한 빨강, 기본 → 흰색
  let barColor: number;
  if (bar.activeEffect === 'expand') {
    barColor = BAR_COLOR_EXPAND;
  } else if (bar.activeEffect === 'magnet') {
    barColor = BAR_COLOR_MAGNET;
  } else if (bar.activeEffect === 'laser') {
    barColor = BAR_COLOR_LASER;
  } else {
    barColor = BAR_COLOR_NORMAL;
  }
  if (screenState.isBarBreaking) {
    // barBreakProgress: 1.0 = 연출 시작, 0.0 = 연출 종료
    const alpha = barBreakProgress;                      // 1.0 → 0.0
    const scaleX = 0.5 + barBreakProgress * 0.5;         // 1.0 → 0.5
    objects.bar
      .setPosition(bar.x, bar.y)
      .setSize(bar.width * scaleX, BAR_HEIGHT)
      .setFillStyle(barColor)
      .setAlpha(alpha)
      .setVisible(true);
  } else {
    objects.bar
      .setPosition(bar.x, bar.y)
      .setSize(bar.width, BAR_HEIGHT)
      .setFillStyle(barColor)
      .setAlpha(1)
      .setVisible(true);
  }

  // 공 (isActive 이고 바 파괴 연출 중이 아닐 때만 표시)
  const activeBall = gameplayState.balls.find((b) => b.isActive);
  if (activeBall && !screenState.isBarBreaking) {
    objects.ball.setPosition(activeBall.x, activeBall.y).setAlpha(1).setVisible(true);
  } else {
    objects.ball.setVisible(false);
  }

  // 블록: 파괴되지 않은 블록만 visible
  const activeBlockIds = new Set<string>();
  for (const block of gameplayState.blocks) {
    if (block.isDestroyed) continue;
    activeBlockIds.add(block.id);

    const def = blockDefinitions[block.definitionId];
    const isFlashing = flashBlockIdSet.has(block.id);

    let rect = objects.blockMap.get(block.id);
    if (!rect) {
      // 최초 등장 시 1회 생성 (기본 색으로 생성)
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

    // 플래시 중이면 밝은 색으로, 아니면 기본 색으로
    const normalColor = def
      ? (BLOCK_COLOR_MAP[def.visualId] ?? BLOCK_COLOR_DEFAULT)
      : BLOCK_COLOR_DEFAULT;
    const flashColor = def
      ? (BLOCK_FLASH_COLOR_MAP[def.visualId] ?? BLOCK_FLASH_COLOR_DEFAULT)
      : BLOCK_FLASH_COLOR_DEFAULT;

    rect
      .setFillStyle(isFlashing ? flashColor : normalColor)
      .setPosition(block.x, block.y)
      .setVisible(true);
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

  // 레이저 발사체 렌더링
  // laserShots 배열과 laserMap을 id 기준으로 add/remove 동기화.
  // 각 shot은 2×16px 세로 선분(Rectangle)으로 표현. 중심 기준 위치.
  // Unity 포팅 시: LaserShotView MonoBehaviour + ObjectPool 형태로 대응.
  const LASER_WIDTH = 2;
  const LASER_HEIGHT = 16;
  const LASER_COLOR = 0xff4444; // 빨강
  const activeShotIds = new Set<string>();
  for (const shot of gameplayState.laserShots) {
    activeShotIds.add(shot.id);
    let rect = objects.laserMap.get(shot.id);
    if (!rect) {
      // 최초 등장 시 1회 생성
      rect = scene.add.rectangle(shot.x, shot.y, LASER_WIDTH, LASER_HEIGHT, LASER_COLOR);
      objects.laserMap.set(shot.id, rect);
    }
    rect.setPosition(shot.x, shot.y).setVisible(true);
  }

  // 소멸된 레이저 발사체 숨기기
  for (const [id, rect] of objects.laserMap) {
    if (!activeShotIds.has(id)) {
      rect.setVisible(false);
    }
  }

  // 회전체 렌더링
  // spinnerStates 배열과 spinnerMap을 id 기준으로 add/remove 동기화.
  // cube: Rectangle + setRotation(angleRad). 한 변 = size.
  // triangle: Graphics로 매 틱 재그림. 정삼각형, 한 변 = size.
  //   정삼각형의 3 vertex를 angleRad 기준으로 계산: 외접원 반지름 = size / sqrt(3).
  //
  // spawning phase 처리:
  //   alpha = 0.3 + 0.7 * spawnProgress (반투명 fade-in: 시작 희미 → 도착 완전)
  //   위치: core가 계산한 spinner.y 그대로 사용.
  //
  // Gate 연출 (천장 입구 열림/닫힘):
  //   spawnProgress < GATE_OPEN_END: 열리는 중 (openRatio 0 → 1)
  //   GATE_OPEN_END <= spawnProgress < GATE_CLOSE_START: 완전 열림 (openRatio = 1)
  //   spawnProgress >= GATE_CLOSE_START: 닫히는 중 (openRatio 1 → 0)
  //   phase = 'active': gate 숨김
  //
  // Unity 포팅 시: SpinnerView MonoBehaviour + ObjectPool 형태로 대응.
  //                Gate: SpawnGateView.Animator 또는 DOTween으로 대응.
  const activeSpinnerIds = new Set<string>();
  for (const spinner of gameplayState.spinnerStates) {
    activeSpinnerIds.add(spinner.id);
    const def = spinnerDefinitions[spinner.definitionId];
    if (def === undefined) continue;

    // spawning phase: fade-in alpha 계산
    const spinnerAlpha =
      spinner.phase === 'spawning'
        ? 0.3 + 0.7 * spinner.spawnProgress
        : 1.0;

    if (def.kind === 'cube') {
      // cube: Rectangle. setRotation(angleRad)으로 회전 반영.
      // kind는 런타임에 변경되지 않으므로 동일 id에 항상 Rectangle이 들어온다.
      const existingCube = objects.spinnerMap.get(spinner.id);
      let rect: Phaser.GameObjects.Rectangle;
      if (existingCube === undefined) {
        rect = scene.add.rectangle(
          spinner.x,
          spinner.y,
          def.size,
          def.size,
          SPINNER_COLOR,
        );
        objects.spinnerMap.set(spinner.id, rect);
      } else {
        rect = existingCube as Phaser.GameObjects.Rectangle;
      }
      rect
        .setPosition(spinner.x, spinner.y)
        .setRotation(spinner.angleRad)
        .setAlpha(spinnerAlpha)
        .setVisible(true);
    } else {
      // triangle: Graphics. 매 틱 재그림.
      // 정삼각형: 한 변 = size. 외접원 반지름 R = size / sqrt(3).
      // vertex i = (x + R * cos(angleRad + i * 2π/3), y + R * sin(angleRad + i * 2π/3))
      // kind는 런타임에 변경되지 않으므로 동일 id에 항상 Graphics가 들어온다.
      const existingTriangle = objects.spinnerMap.get(spinner.id);
      let gfx: Phaser.GameObjects.Graphics;
      if (existingTriangle === undefined) {
        gfx = scene.add.graphics();
        objects.spinnerMap.set(spinner.id, gfx);
      } else {
        gfx = existingTriangle as Phaser.GameObjects.Graphics;
      }

      const R = def.size / Math.sqrt(3);
      const TWO_PI_OVER_3 = (2 * Math.PI) / 3;
      const x0 = spinner.x + R * Math.cos(spinner.angleRad);
      const y0 = spinner.y + R * Math.sin(spinner.angleRad);
      const x1 = spinner.x + R * Math.cos(spinner.angleRad + TWO_PI_OVER_3);
      const y1 = spinner.y + R * Math.sin(spinner.angleRad + TWO_PI_OVER_3);
      const x2 = spinner.x + R * Math.cos(spinner.angleRad + 2 * TWO_PI_OVER_3);
      const y2 = spinner.y + R * Math.sin(spinner.angleRad + 2 * TWO_PI_OVER_3);

      gfx
        .clear()
        .fillStyle(SPINNER_COLOR, spinnerAlpha)
        .fillTriangle(x0, y0, x1, y1, x2, y2)
        .setVisible(true);
    }

    // Gate 연출
    // Gate openRatio: 0=완전 닫힘, 1=완전 열림.
    // 각 door 의 실제 width = (def.size / 2) * (1 - openRatio).
    // left door: 오른쪽 끝 = spinner.x. right door: 왼쪽 끝 = spinner.x.
    // 즉, left door 의 center x = spinner.x - doorWidth / 2,
    //     right door 의 center x = spinner.x + doorWidth / 2.
    if (spinner.phase === 'spawning') {
      let openRatio: number;
      if (spinner.spawnProgress < GATE_OPEN_END) {
        // 열리는 구간: 0 → 1
        openRatio = spinner.spawnProgress / GATE_OPEN_END;
      } else if (spinner.spawnProgress < GATE_CLOSE_START) {
        // 완전 열림 구간
        openRatio = 1.0;
      } else {
        // 닫히는 구간: 1 → 0
        openRatio = 1.0 - (spinner.spawnProgress - GATE_CLOSE_START) / (1.0 - GATE_CLOSE_START);
      }

      const halfSize = def.size / 2;
      const doorWidth = halfSize * (1.0 - openRatio);

      let gates = objects.gateMap.get(spinner.id);
      if (gates === undefined) {
        const leftDoor = scene.add.rectangle(
          spinner.x - doorWidth / 2,
          GATE_Y,
          doorWidth,
          GATE_HEIGHT,
          GATE_COLOR,
        );
        const rightDoor = scene.add.rectangle(
          spinner.x + doorWidth / 2,
          GATE_Y,
          doorWidth,
          GATE_HEIGHT,
          GATE_COLOR,
        );
        gates = [leftDoor, rightDoor];
        objects.gateMap.set(spinner.id, gates);
      }

      const [leftDoor, rightDoor] = gates;
      if (doorWidth > 0) {
        leftDoor
          .setPosition(spinner.x - doorWidth / 2, GATE_Y)
          .setSize(doorWidth, GATE_HEIGHT)
          .setFillStyle(GATE_COLOR)
          .setAlpha(1)
          .setVisible(true);
        rightDoor
          .setPosition(spinner.x + doorWidth / 2, GATE_Y)
          .setSize(doorWidth, GATE_HEIGHT)
          .setFillStyle(GATE_COLOR)
          .setAlpha(1)
          .setVisible(true);
      } else {
        leftDoor.setVisible(false);
        rightDoor.setVisible(false);
      }
    } else {
      // phase === 'active': gate 숨김
      const gates = objects.gateMap.get(spinner.id);
      if (gates !== undefined) {
        gates[0].setVisible(false);
        gates[1].setVisible(false);
      }
    }
  }

  // 소멸된 회전체 숨기기
  for (const [id, obj] of objects.spinnerMap) {
    if (!activeSpinnerIds.has(id)) {
      obj.setVisible(false);
    }
  }

  // 소멸된 회전체의 gate 숨기기
  for (const [id, gates] of objects.gateMap) {
    if (!activeSpinnerIds.has(id)) {
      gates[0].setVisible(false);
      gates[1].setVisible(false);
    }
  }

  // 바 효과 타이머 HUD
  // magnet 활성: "MAGNET X.Xs" 형태로 표시. laser는 Phase 5에서 추가 예정.
  if (hudViewModel.activeEffect === 'magnet' && hudViewModel.magnetRemainingMs > 0) {
    const seconds = (hudViewModel.magnetRemainingMs / 1000).toFixed(1);
    objects.hudEffectTimer
      .setText(`MAGNET ${seconds}s`)
      .setColor('#88ccff')
      .setVisible(true);
  } else if (hudViewModel.activeEffect === 'laser') {
    // Phase 5 대비 laser 쿨다운 표시 (쿨다운 0이면 READY 표시)
    const cdSeconds = (hudViewModel.laserCooldownMs / 1000).toFixed(1);
    const laserText = hudViewModel.laserCooldownMs > 0 ? `LASER CD ${cdSeconds}s` : 'LASER READY';
    objects.hudEffectTimer
      .setText(laserText)
      .setColor('#ff8888')
      .setVisible(true);
  } else {
    objects.hudEffectTimer.setVisible(false);
  }

  // scene 파라미터는 블록/아이템 생성에만 사용됨. 명시적 void 처리 불필요.
  void scene;
}

/**
 * hideInGameScreen — InGame 화면 오브젝트를 전부 숨긴다.
 */
export function hideInGameScreen(objects: InGameObjects): void {
  objects.hudDivider.setVisible(false);
  objects.hudScore.setVisible(false);
  objects.hudLives.setVisible(false);
  objects.hudRound.setVisible(false);
  objects.hudEffectTimer.setVisible(false);
  objects.bar.setVisible(false);
  objects.ball.setVisible(false);
  for (const rect of objects.blockMap.values()) {
    rect.setVisible(false);
  }
  for (const rect of objects.itemMap.values()) {
    rect.setVisible(false);
  }
  for (const rect of objects.laserMap.values()) {
    rect.setVisible(false);
  }
  for (const obj of objects.spinnerMap.values()) {
    obj.setVisible(false);
  }
  for (const gates of objects.gateMap.values()) {
    gates[0].setVisible(false);
    gates[1].setVisible(false);
  }
}
