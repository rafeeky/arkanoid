import type Phaser from 'phaser';
import type { GameplayRuntimeState } from '../../gameplay/state/GameplayRuntimeState';
import type { HudViewModel } from '../view-models/HudViewModel';
import type { BlockDefinition } from '../../definitions/types/BlockDefinition';
import type { SpinnerDefinition } from '../../definitions/types/SpinnerDefinition';
import type { ScreenState } from '../state/ScreenState';
import { SPAWN_DURATION_MS } from '../../gameplay/systems/SpinnerSystem';

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

// 회전체 pseudo-3D 색상
// cube: Y축 회전 시 3면(front/top/side)을 shade 차이로 구분
const CUBE_FRONT = 0xaa88ff; // 정면 — 중간 보라
const CUBE_TOP   = 0xccaaff; // 윗면 — 밝은 보라
const CUBE_SIDE  = 0x8866dd; // 옆면 — 어두운 보라

// tetrahedron: 3면을 shade 차이로 구분
const TRI_FACE0 = 0xff99cc; // 정면
const TRI_FACE1 = 0xffbbdd; // 옆면 1 (밝음)
const TRI_FACE2 = 0xcc6699; // 옆면 2 (어두움)

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
  // 회전체 풀: spinnerId → Graphics
  // cube/triangle 모두 Graphics로 통일. 매 프레임 clear() 후 pseudo-3D 재그림.
  // Unity 포팅 시: SpinnerView MonoBehaviour + ObjectPool 형태로 대응.
  spinnerMap: Map<string, Phaser.GameObjects.Graphics>;
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

  // 공 표시 (바 파괴 연출 중이 아니면 항상 표시)
  // - 발사 전(isActive=false): moveAttachedBallToBar 가 바 위 좌표를 세팅
  // - 자석 부착(isActive=false + attachedOffsetX): 바 이동에 동기 이동 중
  // - 일반 플레이(isActive=true): ball.x/y 그대로
  // 바 파괴 연출 중엔 공 숨김 (사망 연출)
  const ballToRender = gameplayState.balls[0];
  if (ballToRender && !screenState.isBarBreaking) {
    objects.ball.setPosition(ballToRender.x, ballToRender.y).setAlpha(1).setVisible(true);
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

    // spawning phase: spawnElapsedMs → 0~1 progress로 변환
    const spawnProgress = spinner.phase === 'spawning'
      ? Math.min(1, spinner.spawnElapsedMs / SPAWN_DURATION_MS)
      : 1.0;

    // spawning phase: fade-in alpha 계산
    const spinnerAlpha =
      spinner.phase === 'spawning'
        ? 0.3 + 0.7 * spawnProgress
        : 1.0;

    // Graphics 오브젝트 취득 또는 신규 생성 (cube/triangle 모두 Graphics)
    let gfx = objects.spinnerMap.get(spinner.id);
    if (gfx === undefined) {
      gfx = scene.add.graphics();
      objects.spinnerMap.set(spinner.id, gfx);
    }
    gfx.clear().setAlpha(spinnerAlpha).setVisible(true);

    if (def.kind === 'cube') {
      // ---- pseudo-3D 큐브 (Y축 회전) ----
      // angleRad를 Y축 회전각으로 해석.
      // 로컬 8 vertex: half-size = s
      // 직교투영(orthographic): x→2D_x, y→2D_y (z는 depth 판정용)
      // Y축 회전 행렬:
      //   x' = x*cos(a) - z*sin(a)
      //   z' = x*sin(a) + z*cos(a)
      //   y' = y (불변)
      // 6면 정의 (vertex index 순서: CCW from camera):
      //   front [4,5,6,7], back [0,1,2,3]
      //   top [0,1,5,4], bottom [3,2,6,7]
      //   right [1,2,6,5], left [0,3,7,4]
      // 가시 판정: 각 면의 법선 Z 성분(nz)이 카메라 방향(nz>0)이면 표시.
      // painter's algorithm: 각 가시 면의 평균 z 기준 오름차순 정렬 후 그리기.
      const s = def.size / 2;
      const cosA = Math.cos(spinner.angleRad);
      const sinA = Math.sin(spinner.angleRad);

      // 3D→회전→투영 헬퍼. 반환 [x2d, y2d, z_depth]
      const project = (lx: number, ly: number, lz: number): [number, number, number] => {
        const rx = lx * cosA - lz * sinA;
        const rz = lx * sinA + lz * cosA;
        return [spinner.x + rx, spinner.y + ly, rz];
      };

      // 8 vertex 투영 (tuple 타입으로 명시 → undefined 제거)
      type Vtx = [number, number, number];
      const V: [Vtx, Vtx, Vtx, Vtx, Vtx, Vtx, Vtx, Vtx] = [
        project(-s, -s, -s), // 0 back-top-left
        project( s, -s, -s), // 1 back-top-right
        project( s,  s, -s), // 2 back-bot-right
        project(-s,  s, -s), // 3 back-bot-left
        project(-s, -s,  s), // 4 front-top-left
        project( s, -s,  s), // 5 front-top-right
        project( s,  s,  s), // 6 front-bot-right
        project(-s,  s,  s), // 7 front-bot-left
      ];

      // 면 정의: [vi0, vi1, vi2, vi3, colorHex]
      type Face = { idx: [number, number, number, number]; color: number };
      const faces: Face[] = [
        { idx: [4, 5, 6, 7], color: CUBE_FRONT },  // front
        { idx: [0, 1, 2, 3], color: CUBE_FRONT },  // back
        { idx: [0, 1, 5, 4], color: CUBE_TOP   },  // top
        { idx: [3, 2, 6, 7], color: CUBE_TOP   },  // bottom
        { idx: [1, 2, 6, 5], color: CUBE_SIDE  },  // right
        { idx: [0, 3, 7, 4], color: CUBE_SIDE  },  // left
      ];

      // 가시 판정 & depth 정렬
      type VisibleFace = { color: number; pts: { x: number; y: number }[]; avgZ: number };
      const visibleFaces: VisibleFace[] = [];

      for (const face of faces) {
        const [i0, i1, i2, i3] = face.idx;
        // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
        const v0 = V[i0]!; const v1 = V[i1]!;
        // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
        const v2 = V[i2]!; const v3 = V[i3]!;

        // 면 법선 Z 성분 (2D 외적): (v1-v0) × (v3-v0) Z
        const ex1 = v1[0] - v0[0]; const ey1 = v1[1] - v0[1];
        const ex2 = v3[0] - v0[0]; const ey2 = v3[1] - v0[1];
        const nz = ex1 * ey2 - ey1 * ex2; // nz > 0 → 카메라쪽 (CW 정렬이면 부호 반전)

        if (nz >= 0) {
          // 평균 depth = 4 vertex의 z 평균
          const avgZ = (v0[2] + v1[2] + v2[2] + v3[2]) / 4;
          visibleFaces.push({
            color: face.color,
            pts: [
              { x: v0[0], y: v0[1] },
              { x: v1[0], y: v1[1] },
              { x: v2[0], y: v2[1] },
              { x: v3[0], y: v3[1] },
            ],
            avgZ,
          });
        }
      }

      // painter's algorithm: avgZ 오름차순(먼 것 먼저)
      visibleFaces.sort((a, b) => a.avgZ - b.avgZ);

      for (const vf of visibleFaces) {
        gfx.fillStyle(vf.color, 1).fillPoints(vf.pts, true);
      }

    } else {
      // ---- pseudo-3D 정사면체(tetrahedron) (Y축 회전) ----
      // 4 vertex 정의:
      //   T0 = ( 0,   -h,          0       )  — top
      //   T1 = ( s,    h/3, -s/sqrt(3)     )  — base 1
      //   T2 = (-s,    h/3, -s/sqrt(3)     )  — base 2
      //   T3 = ( 0,    h/3,  2s/sqrt(3)    )  — base 3 (front)
      // h = size * sqrt(6) / 3  (정사면체 높이)
      // 4면: [0,1,3], [0,3,2], [0,2,1], [1,2,3] (base)
      const s = def.size / 2;
      const h = def.size * (Math.sqrt(6) / 3);
      const inv3 = 1 / Math.sqrt(3);
      const cosA = Math.cos(spinner.angleRad);
      const sinA = Math.sin(spinner.angleRad);

      const projectTri = (lx: number, ly: number, lz: number): [number, number, number] => {
        const rx = lx * cosA - lz * sinA;
        const rz = lx * sinA + lz * cosA;
        return [spinner.x + rx, spinner.y + ly, rz];
      };

      type TVtx = [number, number, number];
      const T: [TVtx, TVtx, TVtx, TVtx] = [
        projectTri(  0,    -h,        0         ), // 0 top
        projectTri(  s,  h / 3, -s * inv3       ), // 1 base 1
        projectTri( -s,  h / 3, -s * inv3       ), // 2 base 2
        projectTri(  0,  h / 3,  2 * s * inv3   ), // 3 base 3 (front)
      ];

      type TriFace = { idx: [number, number, number]; color: number };
      const triFaces: TriFace[] = [
        { idx: [0, 1, 3], color: TRI_FACE0 },
        { idx: [0, 3, 2], color: TRI_FACE1 },
        { idx: [0, 2, 1], color: TRI_FACE2 },
        { idx: [1, 2, 3], color: TRI_FACE1 }, // base
      ];

      type VisTriFace = { color: number; x0: number; y0: number; x1: number; y1: number; x2: number; y2: number; avgZ: number };
      const visTriFaces: VisTriFace[] = [];

      for (const tf of triFaces) {
        const [i0, i1, i2] = tf.idx;
        // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
        const t0 = T[i0]!; const t1 = T[i1]!; const t2 = T[i2]!;

        // 법선 Z 성분
        const ex1 = t1[0] - t0[0]; const ey1 = t1[1] - t0[1];
        const ex2 = t2[0] - t0[0]; const ey2 = t2[1] - t0[1];
        const nz = ex1 * ey2 - ey1 * ex2;

        if (nz >= 0) {
          const avgZ = (t0[2] + t1[2] + t2[2]) / 3;
          visTriFaces.push({
            color: tf.color,
            x0: t0[0], y0: t0[1],
            x1: t1[0], y1: t1[1],
            x2: t2[0], y2: t2[1],
            avgZ,
          });
        }
      }

      visTriFaces.sort((a, b) => a.avgZ - b.avgZ);

      for (const vf of visTriFaces) {
        gfx.fillStyle(vf.color, 1).fillTriangle(vf.x0, vf.y0, vf.x1, vf.y1, vf.x2, vf.y2);
      }
    }

    // Gate 연출
    // Gate openRatio: 0=완전 닫힘, 1=완전 열림.
    // 각 door 의 실제 width = (def.size / 2) * (1 - openRatio).
    // left door: 오른쪽 끝 = spinner.x. right door: 왼쪽 끝 = spinner.x.
    // 즉, left door 의 center x = spinner.x - doorWidth / 2,
    //     right door 의 center x = spinner.x + doorWidth / 2.
    if (spinner.phase === 'spawning') {
      let openRatio: number;
      if (spawnProgress < GATE_OPEN_END) {
        // 열리는 구간: 0 → 1
        openRatio = spawnProgress / GATE_OPEN_END;
      } else if (spawnProgress < GATE_CLOSE_START) {
        // 완전 열림 구간
        openRatio = 1.0;
      } else {
        // 닫히는 구간: 1 → 0
        openRatio = 1.0 - (spawnProgress - GATE_CLOSE_START) / (1.0 - GATE_CLOSE_START);
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
