import type Phaser from 'phaser';
import type { GameplayRuntimeState } from '../../gameplay/state/GameplayRuntimeState';
import type { HudViewModel } from '../view-models/HudViewModel';
import type { BlockDefinition } from '../../definitions/types/BlockDefinition';
import type { SpinnerDefinition } from '../../definitions/types/SpinnerDefinition';
import type { ScreenState } from '../state/ScreenState';
import { SPAWN_DURATION_MS } from '../../gameplay/systems/SpinnerSystem';
import {
  BLOCK_WIDTH,
  BLOCK_HEIGHT,
  BAR_HEIGHT,
  BALL_RADIUS,
  ITEM_WIDTH,
  ITEM_HEIGHT,
  BORDER_LENGTH,
  BORDER_THICKNESS,
} from '../../gameplay/systems/playfieldLayout';
import { LayoutConfigTable } from '../../definitions/tables/LayoutConfigTable';

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

// Phase 7: 아이템 색상 — 타입별 매핑 (바 효과 색과 동일).
// 캡슐 본체 채움색.
const ITEM_FILL_COLOR: Record<string, number> = {
  expand: 0xffee99, // 연한 노랑
  magnet: 0x88ccff, // 연한 파랑
  laser:  0xff8888, // 연한 빨강
};
// 외곽선 색상 — 채움색보다 살짝 연하게 (어둡게가 아니라 더 흐리게).
// 알카노이드 스타일: 채움색에 +30% white blend 한 색.
const ITEM_STROKE_COLOR: Record<string, number> = {
  expand: 0xfff7cc,
  magnet: 0xc0ddff,
  laser:  0xffbbbb,
};
const ITEM_FILL_DEFAULT = 0xffee99;
const ITEM_STROKE_DEFAULT = 0xfff7cc;
// 아이템 첫 글자 매핑.
const ITEM_INITIAL: Record<string, string> = {
  expand: 'E',
  magnet: 'M',
  laser:  'L',
};

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
  // 테두리(BorderBlock) — 동적 캐시: borderId → Rectangle
  borderMap: Map<string, Phaser.GameObjects.Rectangle>;
  // 문(Door) — 동적 캐시: doorId → Rectangle
  doorMap: Map<string, Phaser.GameObjects.Rectangle>;
  // 하단 슬라이더 — track + knob.
  sliderTrack: Phaser.GameObjects.Rectangle;
  sliderKnob: Phaser.GameObjects.Arc;
  // 아이템 드랍: itemId → Container (캡슐 본체 + 첫글자 텍스트, 회전 가능). Phase 7.
  itemMap: Map<string, Phaser.GameObjects.Container>;
  // 레이저 발사체 풀: shotId → Rectangle
  laserMap: Map<string, Phaser.GameObjects.Rectangle>;
  // 회전체 풀
  spinnerMap: Map<string, Phaser.GameObjects.Graphics>;
  // Gate 풀
  gateMap: Map<string, [Phaser.GameObjects.Rectangle, Phaser.GameObjects.Rectangle]>;
  // 공 발사 궤적 dot 풀 (ball.isActive=false 동안 표시)
  trajectoryDots: Phaser.GameObjects.Arc[];
  // 응원 마스코트 — 캔버스 우하단 4프레임 댄스 placeholder.
  cheerMascotContainer: Phaser.GameObjects.Container;
  cheerMascotBody: Phaser.GameObjects.Rectangle;
  cheerMascotLetter: Phaser.GameObjects.Text;
  // HUD — Phase 4 재배치 (플레이필드 외부)
  scoreLabel: Phaser.GameObjects.Text;       // 좌상단 SCORE 라벨
  scoreValue: Phaser.GameObjects.Text;       // 좌상단 점수 값
  highScoreLabel: Phaser.GameObjects.Text;   // 중앙상단 HIGH SCORE 라벨 (빨강)
  highScoreValue: Phaser.GameObjects.Text;   // 중앙상단 하이스코어 값
  roundLabel: Phaser.GameObjects.Text;       // 우상단 ROUND 라벨
  roundValue: Phaser.GameObjects.Text;       // 우상단 라운드 값
  // 라이프 (좌하단, 바 모양 0.3x). 최대 7개 미리 생성하고 lives 만큼 visible.
  livesBars: Phaser.GameObjects.Rectangle[];
  // 플레이필드 경계 (top/left/right)
  borderTop: Phaser.GameObjects.Rectangle;
  borderLeft: Phaser.GameObjects.Rectangle;
  borderRight: Phaser.GameObjects.Rectangle;
  // 바 효과 남은 시간 표시 (magnet/laser 활성 시에만 visible)
  hudEffectTimer: Phaser.GameObjects.Text;
};

// HUD/Mascot/Lives 레이아웃은 LayoutConfigTable 단일 진실에서 읽음.
// 캡쳐된 값들 (분리 const 는 더 이상 없음).
const HUD_TOP_LABEL_Y = LayoutConfigTable.hud.labelY;
const HUD_TOP_VALUE_Y = LayoutConfigTable.hud.valueY;
const HUD_LEFT_X = LayoutConfigTable.hud.leftX;
const HUD_CENTER_X = LayoutConfigTable.hud.centerX;
const HUD_RIGHT_X = LayoutConfigTable.hud.rightX;
const HUD_LABEL_FONT = `${LayoutConfigTable.hud.labelFontPx}px`;
const HUD_VALUE_FONT = `${LayoutConfigTable.hud.valueFontPx}px`;
// 플레이필드 경계 — 시각 장식 (BorderBlock 과 별개). 추후 LayoutConfig 로 이관 가능.
const PLAYFIELD_BORDER_THICKNESS = 6;
const PLAYFIELD_BORDER_COLOR = 0x666666;
// Lives bar — LayoutConfigTable 참조.
const LIVES_BAR_SCALE = LayoutConfigTable.livesBar.scale;
const LIVES_BAR_WIDTH = 120 * LIVES_BAR_SCALE;
const LIVES_BAR_HEIGHT = 16 * LIVES_BAR_SCALE;
const LIVES_BAR_GAP = LayoutConfigTable.livesBar.gap;
const LIVES_BAR_X_START_CANVAS = LayoutConfigTable.livesBar.startX;
const LIVES_BAR_Y_CANVAS = LayoutConfigTable.livesBar.y;
const MAX_LIVES_DISPLAY = LayoutConfigTable.livesBar.maxDisplay;
// Cheer mascot — LayoutConfigTable 참조.
const CHEER_MASCOT_CANVAS_X = LayoutConfigTable.mascot.centerX;
const CHEER_MASCOT_CANVAS_Y = LayoutConfigTable.mascot.centerY;
const CHEER_MASCOT_SIZE = LayoutConfigTable.mascot.size;
// 공 발사 궤적 — 발사 전 (ball.isActive=false) 미리보기.
const TRAJECTORY_DOT_COUNT = 18;
const TRAJECTORY_DOT_RADIUS = 5;
const TRAJECTORY_DOT_COLOR = 0x88ffff;
const TRAJECTORY_STEP_DT = 0.07;          // 시뮬레이션 step (초)
const PLAYFIELD_LOCAL_WIDTH = 720;
const TRAJECTORY_BALL_RADIUS = 8;

const HUD_HEIGHT = 60;

/**
 * createInGameObjects — InGame 화면에 필요한 Phaser 오브젝트를 1회 생성한다.
 * 블록/아이템은 게임 진행 중 필요에 따라 캐시에 추가된다.
 * Unity 매핑: BarView, BallView, BlockViewPool, HudView MonoBehaviour에 대응.
 */
export function createInGameObjects(scene: Phaser.Scene): InGameObjects {
  // HUD — 캔버스 절대 좌표 (scrollFactor=0). 카메라 스크롤/줌과 무관.
  // SCORE — 좌상단 (라벨/값 2줄)
  const scoreLabel = scene.add
    .text(HUD_LEFT_X, HUD_TOP_LABEL_Y, 'SCORE', {
      fontSize: HUD_LABEL_FONT,
      color: '#ffffff',
      fontFamily: 'monospace',
    })
    .setOrigin(0, 0)
    .setScrollFactor(0)
    .setVisible(false);
  const scoreValue = scene.add
    .text(HUD_LEFT_X, HUD_TOP_VALUE_Y, '0', {
      fontSize: HUD_VALUE_FONT,
      color: '#ffffff',
      fontFamily: 'monospace',
    })
    .setOrigin(0, 0)
    .setScrollFactor(0)
    .setVisible(false);

  // HIGH SCORE — 중앙상단 (빨강 라벨 + 값)
  const highScoreLabel = scene.add
    .text(HUD_CENTER_X, HUD_TOP_LABEL_Y, 'HIGH SCORE', {
      fontSize: HUD_LABEL_FONT,
      color: '#ff3333',
      fontFamily: 'monospace',
      fontStyle: 'bold',
    })
    .setOrigin(0.5, 0)
    .setScrollFactor(0)
    .setVisible(false);
  const highScoreValue = scene.add
    .text(HUD_CENTER_X, HUD_TOP_VALUE_Y, '0', {
      fontSize: HUD_VALUE_FONT,
      color: '#ffffff',
      fontFamily: 'monospace',
    })
    .setOrigin(0.5, 0)
    .setScrollFactor(0)
    .setVisible(false);

  // ROUND — 우상단
  const roundLabel = scene.add
    .text(HUD_RIGHT_X, HUD_TOP_LABEL_Y, 'ROUND', {
      fontSize: HUD_LABEL_FONT,
      color: '#ffffff',
      fontFamily: 'monospace',
    })
    .setOrigin(1, 0)
    .setScrollFactor(0)
    .setVisible(false);
  const roundValue = scene.add
    .text(HUD_RIGHT_X, HUD_TOP_VALUE_Y, '1', {
      fontSize: HUD_VALUE_FONT,
      color: '#ffffff',
      fontFamily: 'monospace',
    })
    .setOrigin(1, 0)
    .setScrollFactor(0)
    .setVisible(false);

  // 플레이필드 경계 — top / left / right (알카노이드풍 회색 띠)
  const borderTop = scene.add
    .rectangle(360, -PLAYFIELD_BORDER_THICKNESS / 2, 720 + PLAYFIELD_BORDER_THICKNESS * 2,
               PLAYFIELD_BORDER_THICKNESS, PLAYFIELD_BORDER_COLOR)
    .setOrigin(0.5, 0.5)
    .setVisible(false);
  const borderLeft = scene.add
    .rectangle(-PLAYFIELD_BORDER_THICKNESS / 2, 360, PLAYFIELD_BORDER_THICKNESS, 720,
               PLAYFIELD_BORDER_COLOR)
    .setOrigin(0.5, 0.5)
    .setVisible(false);
  const borderRight = scene.add
    .rectangle(720 + PLAYFIELD_BORDER_THICKNESS / 2, 360, PLAYFIELD_BORDER_THICKNESS, 720,
               PLAYFIELD_BORDER_COLOR)
    .setOrigin(0.5, 0.5)
    .setVisible(false);

  // 응원 mascot — 캔버스 우하단. scrollFactor=0 (UI 카메라).
  // body + letter 를 Container 로 묶어 회전/스케일 애니메이션.
  const cheerMascotBody = scene.add
    .rectangle(0, 0, CHEER_MASCOT_SIZE, CHEER_MASCOT_SIZE, 0xffffff)
    .setStrokeStyle(3, 0x666666)
    .setOrigin(0.5, 0.5);
  const cheerMascotLetter = scene.add
    .text(0, 0, '?', { fontSize: '40px', color: '#000000', fontFamily: 'monospace', fontStyle: 'bold' })
    .setOrigin(0.5, 0.5);
  const cheerMascotContainer = scene.add
    .container(CHEER_MASCOT_CANVAS_X, CHEER_MASCOT_CANVAS_Y, [cheerMascotBody, cheerMascotLetter])
    .setScrollFactor(0)
    .setVisible(false);

  // 공 발사 궤적 점 풀 — ball.isActive=false 일 때 미리 보이는 cyan 점들.
  // playfield-local 좌표 (카메라 스크롤로 표시).
  const trajectoryDots: Phaser.GameObjects.Arc[] = [];
  for (let i = 0; i < TRAJECTORY_DOT_COUNT; i++) {
    const dot = scene.add
      .arc(0, 0, TRAJECTORY_DOT_RADIUS, 0, 360, false, TRAJECTORY_DOT_COLOR)
      .setVisible(false);
    trajectoryDots.push(dot);
  }

  // 라이프 — 캔버스 절대 좌표 (scrollFactor=0). 캔버스 좌하단 가까이.
  const livesBars: Phaser.GameObjects.Rectangle[] = [];
  for (let i = 0; i < MAX_LIVES_DISPLAY; i++) {
    const x = LIVES_BAR_X_START_CANVAS + i * (LIVES_BAR_WIDTH + LIVES_BAR_GAP);
    const rect = scene.add
      .rectangle(x, LIVES_BAR_Y_CANVAS, LIVES_BAR_WIDTH, LIVES_BAR_HEIGHT, 0xffffff)
      .setOrigin(0, 0.5)
      .setScrollFactor(0)
      .setVisible(false);
    livesBars.push(rect);
  }

  // 바
  const bar = scene.add
    .rectangle(360, 680, 120, BAR_HEIGHT, 0xffffff)
    .setVisible(false);

  // 공
  const ball = scene.add
    .arc(360, 660, BALL_RADIUS, 0, 360, false, 0xffffff)
    .setVisible(false);

  // 바 효과 남은 시간 텍스트 (화면 하단 중앙, 바 위)
  const hudEffectTimer = scene.add
    .text(360, 648, '', {
      fontSize: '14px',
      color: '#88ccff',
      fontFamily: 'monospace',
    })
    .setOrigin(0.5, 1)
    .setVisible(false);

  // 하단 슬라이더 — 모바일 한 손 조작용. 캔버스 절대 좌표(scrollFactor=0).
  const L_slider = LayoutConfigTable.barSlider;
  const trackCenterX = LayoutConfigTable.canvas.width / 2;
  const sliderTrack = scene.add
    .rectangle(
      trackCenterX,
      L_slider.centerY,
      L_slider.trackHalfWidth * 2,
      L_slider.trackHeight,
      0x2233aa,
    )
    .setOrigin(0.5, 0.5)
    .setStrokeStyle(2, 0x4466cc)
    .setScrollFactor(0)
    .setVisible(false);
  const sliderKnob = scene.add
    .arc(
      trackCenterX,
      L_slider.centerY,
      L_slider.knobRadius,
      0,
      360,
      false,
      0xeeeeee,
    )
    .setStrokeStyle(3, 0x666666)
    .setScrollFactor(0)
    .setVisible(false);

  return {
    bar,
    ball,
    blockMap: new Map(),
    borderMap: new Map(),
    doorMap: new Map(),
    sliderTrack,
    sliderKnob,
    itemMap: new Map(),
    laserMap: new Map(),
    spinnerMap: new Map(),
    gateMap: new Map(),
    scoreLabel,
    scoreValue,
    highScoreLabel,
    highScoreValue,
    roundLabel,
    roundValue,
    livesBars,
    borderTop,
    borderLeft,
    borderRight,
    trajectoryDots,
    cheerMascotContainer,
    cheerMascotBody,
    cheerMascotLetter,
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
  /**
   * RoundIntro READY 깜빡 연출용 (Phase 2). 0.0..1.0.
   * 지정 시 바 alpha 에 곱해진다. 미지정/1.0 이면 기존 동작.
   */
  barAlphaOverride: number = 1,
  /**
   * 공 발사 궤적 시뮬레이션용 (ballInitialSpeed, ballInitialAngleDeg).
   * 미지정 시 궤적 표시 안 함.
   */
  ballConfig?: { ballInitialSpeed: number; ballInitialAngleDeg: number },
  /**
   * 응원 mascot 정보 — 우하단 댄스 placeholder 표시용.
   * 미지정 시 응원 mascot 숨김.
   */
  cheerMascot?: { displayName: string; placeholderColor: number; placeholderStrokeColor: number },
): void {
  // Phase 4: HUD 표시 (플레이필드 외부 위 영역)
  objects.scoreLabel.setVisible(true);
  objects.scoreValue.setText(String(hudViewModel.score)).setVisible(true);
  objects.highScoreLabel.setVisible(true);
  objects.highScoreValue.setText(String(hudViewModel.highScore)).setVisible(true);
  objects.roundLabel.setVisible(true);
  objects.roundValue.setText(String(hudViewModel.round)).setVisible(true);

  // 플레이필드 경계
  objects.borderTop.setVisible(true);
  objects.borderLeft.setVisible(true);
  objects.borderRight.setVisible(true);

  // 라이프 (좌하단, 바 모양 0.3x). lives 만큼만 visible.
  for (let i = 0; i < objects.livesBars.length; i++) {
    const rect = objects.livesBars[i]!;
    rect.setVisible(i < hudViewModel.lives);
  }

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
      .setAlpha(alpha * barAlphaOverride)
      .setVisible(true);
  } else {
    objects.bar
      .setPosition(bar.x, bar.y)
      .setSize(bar.width, BAR_HEIGHT)
      .setFillStyle(barColor)
      .setAlpha(barAlphaOverride)
      .setVisible(true);
  }

  // 공 표시 (바 파괴 연출 중이 아니면 항상 표시)
  const ballToRender = gameplayState.balls[0];
  if (ballToRender && !screenState.isBarBreaking) {
    objects.ball.setPosition(ballToRender.x, ballToRender.y).setAlpha(1).setVisible(true);
  } else {
    objects.ball.setVisible(false);
  }

  // 공 발사 궤적 — ball.isActive=false 일 때 (발사 전 / 자석 부착) 미리보기.
  if (ballToRender && !ballToRender.isActive && !screenState.isBarBreaking && ballConfig) {
    renderBallTrajectory(objects.trajectoryDots, ballToRender.x, ballToRender.y, ballConfig);
  } else {
    for (const dot of objects.trajectoryDots) dot.setVisible(false);
  }

  // 응원 mascot — 4프레임 댄스 placeholder (회전 ±5도 사이클 + 부드러운 스케일).
  if (cheerMascot) {
    objects.cheerMascotBody
      .setFillStyle(cheerMascot.placeholderColor)
      .setStrokeStyle(3, cheerMascot.placeholderStrokeColor);
    objects.cheerMascotLetter.setText(cheerMascot.displayName.charAt(0));
    // 4프레임 (250ms 단위) — 0/2 직립, 1 우측 살짝, 3 좌측 살짝.
    const frameIdx = Math.floor(performance.now() / 250) % 4;
    const angle = frameIdx === 1 ? 6 : frameIdx === 3 ? -6 : 0;
    const scale = frameIdx % 2 === 0 ? 1.0 : 1.05;
    objects.cheerMascotContainer.angle = angle;
    objects.cheerMascotContainer.setScale(scale);
    objects.cheerMascotContainer.setVisible(true);
  } else {
    objects.cheerMascotContainer.setVisible(false);
  }

  // 테두리(BorderBlock) — 깨지지 않는 벽. orientation 에 따라 가로/세로.
  // 메탈릭 회색 + 흰 stroke 으로 일반 블럭과 구분.
  const activeBorderIds = new Set<string>();
  for (const border of gameplayState.borders) {
    activeBorderIds.add(border.id);
    const w = border.orientation === 'horizontal' ? BORDER_LENGTH : BORDER_THICKNESS;
    const h = border.orientation === 'horizontal' ? BORDER_THICKNESS : BORDER_LENGTH;

    let rect = objects.borderMap.get(border.id);
    if (!rect) {
      rect = scene.add
        .rectangle(border.x, border.y, w, h, 0x555566)
        .setOrigin(0, 0)
        .setStrokeStyle(1, 0x8899aa);
      objects.borderMap.set(border.id, rect);
    }
    rect.setPosition(border.x, border.y).setSize(w, h).setVisible(true);
  }
  for (const [id, rect] of objects.borderMap) {
    if (!activeBorderIds.has(id)) rect.setVisible(false);
  }

  // 문(Door) — closed/opening/opened.
  // 닫힌 문: 진한 갈색 본체 + 황색 stroke.
  // opening: 왼쪽 anchor 유지, width 가 0 으로 줄어듦 (왼쪽으로 슬라이드 인 효과).
  // opened: 보이지 않음. (단, 공 collision 은 여전히 풀 사이즈 — 사용자 결정)
  const activeDoorIds = new Set<string>();
  for (const door of gameplayState.doors) {
    activeDoorIds.add(door.id);
    let rect = objects.doorMap.get(door.id);
    if (!rect) {
      rect = scene.add
        .rectangle(door.x, door.y, BORDER_LENGTH, BORDER_THICKNESS, 0x6b4226)
        .setOrigin(0, 0)
        .setStrokeStyle(2, 0xddaa44);
      objects.doorMap.set(door.id, rect);
    }
    if (door.phase === 'opened') {
      rect.setVisible(false);
    } else if (door.phase === 'opening') {
      // ease-out: 1 - (1-t)^2 — 시작 빠르고 끝 부드러움
      const t = Math.min(1, door.openingElapsedMs / 600);
      const eased = 1 - (1 - t) * (1 - t);
      const w = Math.max(0, BORDER_LENGTH * (1 - eased));
      rect.setPosition(door.x, door.y).setSize(w, BORDER_THICKNESS).setVisible(w > 0);
    } else {
      // closed
      rect.setPosition(door.x, door.y).setSize(BORDER_LENGTH, BORDER_THICKNESS).setVisible(true);
    }
  }
  for (const [id, rect] of objects.doorMap) {
    if (!activeDoorIds.has(id)) rect.setVisible(false);
  }

  // 하단 슬라이더 — knob 위치를 bar.x 에 매핑.
  // bar.x 범위 [halfBar, playfield.width - halfBar] → 트랙 [-trackHalfWidth, +trackHalfWidth]
  {
    const L_s = LayoutConfigTable.barSlider;
    const trackCenterX = LayoutConfigTable.canvas.width / 2;
    const halfBar = gameplayState.bar.width / 2;
    const playfieldW = LayoutConfigTable.playfield.width;
    const denom = playfieldW - 2 * halfBar;
    const ratio = denom > 0 ? (gameplayState.bar.x - halfBar) / denom : 0.5;
    const clampedRatio = Math.max(0, Math.min(1, ratio));
    const knobX = trackCenterX - L_s.trackHalfWidth + clampedRatio * (L_s.trackHalfWidth * 2);
    objects.sliderTrack.setVisible(true);
    objects.sliderKnob.setPosition(knobX, L_s.centerY).setVisible(true);
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
      // setOrigin(0,0): BlockState.{x,y}는 좌상단 (collision/editor와 동일 컨벤션).
      // Phaser 기본 origin(0.5)을 그대로 쓰면 시각이 (-W/2,-H/2)만큼 어긋나 공이 통과하는 것처럼 보임.
      const color = def
        ? (BLOCK_COLOR_MAP[def.visualId] ?? BLOCK_COLOR_DEFAULT)
        : BLOCK_COLOR_DEFAULT;
      rect = scene.add
        .rectangle(block.x, block.y, BLOCK_WIDTH, BLOCK_HEIGHT, color)
        .setOrigin(0, 0);
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

  // Phase 7: 아이템 드랍 — 캡슐 모양 (Rectangle + stroke) + 첫 글자 (노랑 + 검은 그림자) + 낙하 시 회전.
  // 4꼭짓점 픽셀 빠진 진짜 캡슐 모양은 동적 텍스처가 필요해서 Unity 포팅 시 구현.
  // 현재는 Stroked Rectangle + 첫글자 + 회전 으로 시각 의도만 표현.
  const activeItemIds = new Set<string>();
  for (const item of gameplayState.itemDrops) {
    if (item.isCollected) continue;
    activeItemIds.add(item.id);

    let container = objects.itemMap.get(item.id);
    if (!container) {
      const fillColor = ITEM_FILL_COLOR[item.itemType] ?? ITEM_FILL_DEFAULT;
      const strokeColor = ITEM_STROKE_COLOR[item.itemType] ?? ITEM_STROKE_DEFAULT;
      const initial = ITEM_INITIAL[item.itemType] ?? '?';

      const body = scene.add
        .rectangle(0, 0, ITEM_WIDTH, ITEM_HEIGHT, fillColor)
        .setStrokeStyle(2, strokeColor)
        .setOrigin(0.5, 0.5);

      // 첫 글자 — 노랑 + 검은 그림자 (Phaser Text shadow API).
      const letter = scene.add
        .text(0, 0, initial, {
          fontSize: '14px',
          color: '#ffff00',
          fontFamily: 'monospace',
          fontStyle: 'bold',
        })
        .setOrigin(0.5, 0.5);
      letter.setShadow(1, 1, '#000000', 0, true, true);

      container = scene.add.container(item.x, item.y, [body, letter]);
      objects.itemMap.set(item.id, container);
    }

    // 위치 + 회전 (낙하 거리 기반 굴러가는 효과).
    container.setPosition(item.x, item.y);
    container.angle = (item.y * 2) % 360;
    container.setVisible(true);
  }

  // 수집/소멸된 아이템 숨기기
  for (const [id, container] of objects.itemMap) {
    if (!activeItemIds.has(id)) {
      container.setVisible(false);
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
      // 각 면이 "OUTSIDE" 에서 봤을 때 동일한 chirality 가 되도록 vertex 순서 정렬.
      // 2D nz 체크는 모든 면에서 동일한 부호 규칙 (front-facing = positive) 이 성립
      // 해야 함. back/left 가 다른 면들과 반대로 listed 되어 있던 버그를 수정 —
      // 이전 버전에서는 angle ≈ π 근처에서 front+back 둘 다 hidden, 사이드만
      // narrow strip 으로 보여 큐브가 비어 보였음.
      type Face = { idx: [number, number, number, number]; color: number };
      const faces: Face[] = [
        { idx: [4, 5, 6, 7], color: CUBE_FRONT },  // front
        { idx: [3, 2, 1, 0], color: CUBE_FRONT },  // back (역순 — outside view 일치)
        { idx: [0, 1, 5, 4], color: CUBE_TOP   },  // top (degenerate, 순서 무관)
        { idx: [3, 2, 6, 7], color: CUBE_TOP   },  // bottom (degenerate)
        { idx: [1, 2, 6, 5], color: CUBE_SIDE  },  // right
        { idx: [4, 7, 3, 0], color: CUBE_SIDE  },  // left (역순)
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
 * 공 발사 궤적 시뮬레이션 + 점 표시.
 * 시작 위치(ball.x, ball.y) + 초기 속도(config) → 양 옆 벽 반사하며 dt 단위 전진.
 * MAX_DOTS 개 점을 alpha 페이드로 표시. 천장(y<0) 도달 시 그 이후 점 숨김.
 */
function renderBallTrajectory(
  dots: Phaser.GameObjects.Arc[],
  startX: number,
  startY: number,
  cfg: { ballInitialSpeed: number; ballInitialAngleDeg: number },
): void {
  const angleRad = (cfg.ballInitialAngleDeg * Math.PI) / 180;
  let vx = cfg.ballInitialSpeed * Math.cos(angleRad);
  let vy = cfg.ballInitialSpeed * Math.sin(angleRad);
  let x = startX;
  let y = startY;

  for (let i = 0; i < dots.length; i++) {
    x += vx * TRAJECTORY_STEP_DT;
    y += vy * TRAJECTORY_STEP_DT;

    // 좌/우 벽 반사 (공 반지름 고려).
    if (x < TRAJECTORY_BALL_RADIUS) {
      x = TRAJECTORY_BALL_RADIUS * 2 - x;
      vx = -vx;
    } else if (x > PLAYFIELD_LOCAL_WIDTH - TRAJECTORY_BALL_RADIUS) {
      x = (PLAYFIELD_LOCAL_WIDTH - TRAJECTORY_BALL_RADIUS) * 2 - x;
      vx = -vx;
    }

    // 천장 도달 시 이후 점 숨김.
    if (y < TRAJECTORY_BALL_RADIUS) {
      for (let j = i; j < dots.length; j++) dots[j]!.setVisible(false);
      return;
    }

    const alpha = 1 - i / dots.length;
    dots[i]!.setPosition(x, y).setAlpha(alpha).setVisible(true);
  }
}

/**
 * hideInGameScreen — InGame 화면 오브젝트를 전부 숨긴다.
 */
export function hideInGameScreen(objects: InGameObjects): void {
  // Phase 4: 새 HUD + 경계 + 라이프 모두 숨김
  objects.scoreLabel.setVisible(false);
  objects.scoreValue.setVisible(false);
  objects.highScoreLabel.setVisible(false);
  objects.highScoreValue.setVisible(false);
  objects.roundLabel.setVisible(false);
  objects.roundValue.setVisible(false);
  objects.borderTop.setVisible(false);
  objects.borderLeft.setVisible(false);
  objects.borderRight.setVisible(false);
  for (const rect of objects.livesBars) {
    rect.setVisible(false);
  }
  for (const dot of objects.trajectoryDots) {
    dot.setVisible(false);
  }
  objects.cheerMascotContainer.setVisible(false);
  objects.hudEffectTimer.setVisible(false);
  objects.sliderTrack.setVisible(false);
  objects.sliderKnob.setVisible(false);
  objects.bar.setVisible(false);
  objects.ball.setVisible(false);
  for (const rect of objects.blockMap.values()) {
    rect.setVisible(false);
  }
  for (const container of objects.itemMap.values()) {
    container.setVisible(false);
  }
  for (const rect of objects.laserMap.values()) {
    rect.setVisible(false);
  }
  for (const rect of objects.borderMap.values()) {
    rect.setVisible(false);
  }
  for (const rect of objects.doorMap.values()) {
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
