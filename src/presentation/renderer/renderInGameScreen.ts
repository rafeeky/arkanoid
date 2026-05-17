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

// 아이템 텍스처 키 매핑 (캡슐 스프라이트, 24×12).
const ITEM_TEX: Record<string, string> = {
  expand: 'item_expand',
  magnet: 'item_magnet',
  laser:  'item_laser',
};
const ITEM_TEX_DEFAULT = 'item_expand';

// 드랍 블록 visualId → 표시할 아이템 텍스처 (블록 위 작은 오버레이로 어떤 아이템인지 알림).
const BLOCK_ITEM_OVERLAY: Record<string, string> = {
  block_basic_drop:  'item_expand',
  block_magnet_drop: 'item_magnet',
  block_laser_drop:  'item_laser',
};
const BLOCK_ICON_W = 40;
const BLOCK_ICON_H = 20;

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

// 바 스프라이트 키 — activeEffect 별
const BAR_TEX_NORMAL = 'bar_normal';
const BAR_TEX_EXPAND = 'bar_expand_tint';
const BAR_TEX_MAGNET = 'bar_magnet_tint';
const BAR_TEX_LASER  = 'bar_laser_tint';

export type InGameObjects = {
  bar: Phaser.GameObjects.Image;
  ball: Phaser.GameObjects.Image;
  // 블록은 동적으로 캐시: blockId → Image (sprite sheet 의 sub-frame).
  blockMap: Map<string, Phaser.GameObjects.Image>;
  // 아이템 블록 위 아이콘 오버레이 — drop 블록만. blockId → 작은 item Image.
  blockIconMap: Map<string, Phaser.GameObjects.Image>;
  // 테두리(BorderBlock) — 동적 캐시: borderId → Image (border_horizontal / border_vertical).
  borderMap: Map<string, Phaser.GameObjects.Image>;
  // 문(Door) — 동적 캐시: doorId → Image. opening 단계는 frame0..4 로 텍스처 교체.
  doorMap: Map<string, Phaser.GameObjects.Image>;
  // 하단 슬라이더 — track Rectangle + knob Arc.
  sliderTrack: Phaser.GameObjects.Rectangle;
  sliderKnob: Phaser.GameObjects.Arc;
  // 아이템 드랍: itemId → Image (스프라이트, 회전 가능). 24×12 캡슐 모양.
  itemMap: Map<string, Phaser.GameObjects.Image>;
  // 레이저 발사체 풀: shotId → Rectangle
  laserMap: Map<string, Phaser.GameObjects.Rectangle>;
  // 회전체 풀 — Graphics (pseudo-3D 큐브/정사면체 매 프레임 재그림).
  spinnerMap: Map<string, Phaser.GameObjects.Graphics>;
  // Gate 풀
  gateMap: Map<string, [Phaser.GameObjects.Rectangle, Phaser.GameObjects.Rectangle]>;
  // 공 발사 궤적 dot 풀 (ball.isActive=false 동안 표시)
  trajectoryDots: Phaser.GameObjects.Arc[];
  // 응원 마스코트 — 캔버스 우하단 4프레임 댄스 placeholder.
  cheerMascotContainer: Phaser.GameObjects.Container;
  /** 4프레임 마스코트 sprite — container 안에 frame0~3 모두 추가하고 시간에 따라 한 장만 visible. */
  cheerMascotSprite: Phaser.GameObjects.Image;
  // HUD — Phase 4 재배치 (플레이필드 외부)
  scoreLabel: Phaser.GameObjects.Text;       // 좌상단 SCORE 라벨
  scoreValue: Phaser.GameObjects.Text;       // 좌상단 점수 값
  highScoreLabel: Phaser.GameObjects.Text;   // 중앙상단 HIGH SCORE 라벨 (빨강)
  highScoreValue: Phaser.GameObjects.Text;   // 중앙상단 하이스코어 값
  roundLabel: Phaser.GameObjects.Text;       // 우상단 ROUND 라벨
  roundValue: Phaser.GameObjects.Text;       // 우상단 라운드 값
  // 라이프 (좌하단, 픽셀아트 하트). 단일 Graphics 에 lives 만큼 매 프레임 redraw.
  livesGraphics: Phaser.GameObjects.Graphics;
  // 플레이필드 경계 (top/left/right)
  borderTop: Phaser.GameObjects.Rectangle;
  borderLeft: Phaser.GameObjects.Rectangle;
  borderRight: Phaser.GameObjects.Rectangle;
  // 바 효과 남은 시간 표시 (magnet/laser 활성 시에만 visible)
  hudEffectTimer: Phaser.GameObjects.Text;
  // 아이템 토스트 — 바 옆에 "Expand!" / "Magnet!" / "Laser!" 2초 표시.
  itemToastText: Phaser.GameObjects.Text;
  // 토스트 derive state — activeEffect 변경 감지 + 종료 시각.
  toastState: { prevEffect: string; endTime: number };
  // 슬라이더 발사 hint — 발사 가능 시 (비활성 공 OR 자석 부착) 슬라이더 위에 표시.
  sliderLaunchHint: Phaser.GameObjects.Text;
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
// Lives — 픽셀아트 하트. LayoutConfigTable.livesBar 의 startX/y/gap/maxDisplay 만 활용.
const LIVES_X_START_CANVAS = LayoutConfigTable.livesBar.startX;
const LIVES_Y_CANVAS = LayoutConfigTable.livesBar.y;
const LIVES_GAP = 14;
const MAX_LIVES_DISPLAY = LayoutConfigTable.livesBar.maxDisplay;
// 하트 픽셀 (7×6 grid, 1=채움). 알카노이드 클래식 픽셀아트 하트.
const HEART_PIXEL = 6;
const HEART_W = 7 * HEART_PIXEL;  // 42
const HEART_H = 6 * HEART_PIXEL;  // 36
const HEART_COLOR = 0xff3344;
const HEART_PATTERN: ReadonlyArray<ReadonlyArray<number>> = [
  [0, 1, 1, 0, 1, 1, 0],
  [1, 1, 1, 1, 1, 1, 1],
  [1, 1, 1, 1, 1, 1, 1],
  [0, 1, 1, 1, 1, 1, 0],
  [0, 0, 1, 1, 1, 0, 0],
  [0, 0, 0, 1, 0, 0, 0],
];

function drawHeart(gfx: Phaser.GameObjects.Graphics, x: number, y: number): void {
  gfx.fillStyle(HEART_COLOR, 1);
  for (let row = 0; row < HEART_PATTERN.length; row++) {
    const pat = HEART_PATTERN[row]!;
    for (let col = 0; col < pat.length; col++) {
      if (pat[col]) {
        gfx.fillRect(x + col * HEART_PIXEL, y + row * HEART_PIXEL, HEART_PIXEL, HEART_PIXEL);
      }
    }
  }
}
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
      fontFamily: 'DNFBitBitv2, monospace',
    })
    .setOrigin(0, 0)
    .setScrollFactor(0)
    .setVisible(false);
  const scoreValue = scene.add
    .text(HUD_LEFT_X, HUD_TOP_VALUE_Y, '0', {
      fontSize: HUD_VALUE_FONT,
      color: '#ffffff',
      fontFamily: 'DNFBitBitv2, monospace',
    })
    .setOrigin(0, 0)
    .setScrollFactor(0)
    .setVisible(false);

  // HIGH SCORE — 중앙상단 (빨강 라벨 + 값)
  const highScoreLabel = scene.add
    .text(HUD_CENTER_X, HUD_TOP_LABEL_Y, 'HIGH SCORE', {
      fontSize: HUD_LABEL_FONT,
      color: '#ff3333',
      fontFamily: 'DNFBitBitv2, monospace',
      fontStyle: 'bold',
    })
    .setOrigin(0.5, 0)
    .setScrollFactor(0)
    .setVisible(false);
  const highScoreValue = scene.add
    .text(HUD_CENTER_X, HUD_TOP_VALUE_Y, '0', {
      fontSize: HUD_VALUE_FONT,
      color: '#ffffff',
      fontFamily: 'DNFBitBitv2, monospace',
    })
    .setOrigin(0.5, 0)
    .setScrollFactor(0)
    .setVisible(false);

  // ROUND — 우상단
  const roundLabel = scene.add
    .text(HUD_RIGHT_X, HUD_TOP_LABEL_Y, 'ROUND', {
      fontSize: HUD_LABEL_FONT,
      color: '#ffffff',
      fontFamily: 'DNFBitBitv2, monospace',
    })
    .setOrigin(1, 0)
    .setScrollFactor(0)
    .setVisible(false);
  const roundValue = scene.add
    .text(HUD_RIGHT_X, HUD_TOP_VALUE_Y, '1', {
      fontSize: HUD_VALUE_FONT,
      color: '#ffffff',
      fontFamily: 'DNFBitBitv2, monospace',
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

  // 응원 mascot — Image (개별 PNG). 매 프레임 mascot.<id>.frame<N> 키로 텍스처 교체.
  const cheerMascotSprite = scene.add
    .image(0, 0, 'mascot.albatross.frame0')
    .setOrigin(0.5, 0.5)
    .setDisplaySize(CHEER_MASCOT_SIZE, CHEER_MASCOT_SIZE);
  const cheerMascotContainer = scene.add
    .container(CHEER_MASCOT_CANVAS_X, CHEER_MASCOT_CANVAS_Y, [cheerMascotSprite])
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

  // 라이프 — 단일 Graphics 에 lives 만큼 픽셀아트 하트 매 프레임 redraw.
  const livesGraphics = scene.add
    .graphics()
    .setScrollFactor(0)
    .setVisible(false);
  void MAX_LIVES_DISPLAY;

  // 바 — Image (스프라이트). activeEffect 에 따라 매 프레임 텍스처 교체.
  const bar = scene.add
    .image(360, 680, BAR_TEX_NORMAL)
    .setDisplaySize(120, BAR_HEIGHT)
    .setVisible(false);

  // 공 — Image (스프라이트). BALL_RADIUS*2 = 16×16. playfield 가 검정이라 흰색 그대로.
  const ball = scene.add
    .image(360, 660, 'ball')
    .setDisplaySize(BALL_RADIUS * 2, BALL_RADIUS * 2)
    .setVisible(false);

  // 바 효과 남은 시간 텍스트 (화면 하단 중앙, 바 위)
  const hudEffectTimer = scene.add
    .text(360, 648, '', {
      fontSize: '14px',
      color: '#88ccff',
      fontFamily: 'DNFBitBitv2, monospace',
    })
    .setOrigin(0.5, 1)
    .setVisible(false);

  // 아이템 토스트 — 바 옆에 펑 뜨는 큰 텍스트. 위치/visible 은 매 프레임 갱신.
  // playfield-local 좌표 (main camera 에 그려짐).
  const itemToastText = scene.add
    .text(0, 0, '', {
      fontSize: '32px',
      color: '#ffff66',
      fontFamily: 'DNFBitBitv2, monospace',
      fontStyle: 'bold',
      stroke: '#000000',
      strokeThickness: 4,
    })
    .setOrigin(0.5, 1)
    .setVisible(false);

  // 슬라이더 발사 hint — 슬라이더 트랙 바로 위. 발사 가능 시에만 visible + 깜빡임.
  // canvas 절대 좌표 (scrollFactor=0).
  const sliderLaunchHint = scene.add
    .text(
      LayoutConfigTable.canvas.width / 2,
      LayoutConfigTable.barSlider.centerY - 50,
      'TAP HERE TO LAUNCH',
      {
        fontSize: '24px',
        color: '#ffff66',
        fontFamily: 'DNFBitBitv2, monospace',
        fontStyle: 'bold',
      },
    )
    .setOrigin(0.5, 0.5)
    .setScrollFactor(0)
    .setVisible(false);

  // 하단 슬라이더 — 모바일 한 손 조작용. 캔버스 절대 좌표(scrollFactor=0).
  // Rectangle 트랙 + Arc 노브 (스프라이트 안 씀 — 트랙 길이 픽셀 정확 매칭).
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
    blockIconMap: new Map(),
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
    livesGraphics,
    borderTop,
    borderLeft,
    borderRight,
    trajectoryDots,
    cheerMascotContainer,
    cheerMascotSprite,
    hudEffectTimer,
    itemToastText,
    toastState: { prevEffect: 'none', endTime: 0 },
    sliderLaunchHint,
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
  cheerMascot?: { id: string; displayName: string; placeholderColor: number; placeholderStrokeColor: number },
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

  // 라이프 (좌하단, 픽셀아트 하트). lives 만큼 redraw. y 는 하트 가운데가 LIVES_Y 가 되게 보정.
  objects.livesGraphics.clear().setVisible(true);
  const heartY = LIVES_Y_CANVAS - HEART_H / 2;
  for (let i = 0; i < hudViewModel.lives; i++) {
    const hx = LIVES_X_START_CANVAS + i * (HEART_W + LIVES_GAP);
    drawHeart(objects.livesGraphics, hx, heartY);
  }

  const flashBlockIdSet = new Set(screenState.blockHitFlashBlockIds);

  // 바 — 파괴 연출: progress(1.0→0.0) 기반으로 alpha/displayWidth 선형 감소.
  // 스프라이트는 activeEffect 별 4종 (normal/expand/magnet/laser) 텍스처 교체.
  const bar = gameplayState.bar;
  let barTex: string;
  if (bar.activeEffect === 'expand') {
    barTex = BAR_TEX_EXPAND;
  } else if (bar.activeEffect === 'magnet') {
    barTex = BAR_TEX_MAGNET;
  } else if (bar.activeEffect === 'laser') {
    barTex = BAR_TEX_LASER;
  } else {
    barTex = BAR_TEX_NORMAL;
  }
  objects.bar.setTexture(barTex);
  if (screenState.isBarBreaking) {
    // barBreakProgress: 1.0 = 연출 시작, 0.0 = 연출 종료
    const alpha = barBreakProgress;                      // 1.0 → 0.0
    const scaleX = 0.5 + barBreakProgress * 0.5;         // 1.0 → 0.5
    objects.bar
      .setPosition(bar.x, bar.y)
      .setDisplaySize(bar.width * scaleX, BAR_HEIGHT)
      .setAlpha(alpha * barAlphaOverride)
      .setVisible(true);
  } else {
    objects.bar
      .setPosition(bar.x, bar.y)
      .setDisplaySize(bar.width, BAR_HEIGHT)
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

  // 응원 mascot — 4프레임 댄스. 200ms 마다 frame 교체. 개별 PNG (trim+center 처리됨).
  if (cheerMascot) {
    const frameIdx = Math.floor(performance.now() / 200) % 4;
    objects.cheerMascotSprite.setTexture(`mascot.${cheerMascot.id}.frame${frameIdx}`);
    objects.cheerMascotContainer.setVisible(true);
  } else {
    objects.cheerMascotContainer.setVisible(false);
  }

  // 테두리(BorderBlock) — 깨지지 않는 벽. orientation 에 따라 가로/세로 스프라이트 선택.
  const activeBorderIds = new Set<string>();
  for (const border of gameplayState.borders) {
    activeBorderIds.add(border.id);
    const w = border.orientation === 'horizontal' ? BORDER_LENGTH : BORDER_THICKNESS;
    const h = border.orientation === 'horizontal' ? BORDER_THICKNESS : BORDER_LENGTH;
    const key = border.orientation === 'horizontal' ? 'border_horizontal' : 'border_vertical';

    let img = objects.borderMap.get(border.id);
    if (!img) {
      img = scene.add
        .image(border.x, border.y, key)
        .setOrigin(0, 0)
        .setDisplaySize(w, h);
      objects.borderMap.set(border.id, img);
    }
    img.setPosition(border.x, border.y).setDisplaySize(w, h).setVisible(true);
  }
  for (const [id, img] of objects.borderMap) {
    if (!activeBorderIds.has(id)) img.setVisible(false);
  }

  // 문(Door) — closed/opening/opened. 스프라이트 5프레임 애니메이션.
  // closed → door_closed. opening → opening_frame0..4 (시간에 따라 선형 매핑).
  // opened → invisible.
  const activeDoorIds = new Set<string>();
  for (const door of gameplayState.doors) {
    activeDoorIds.add(door.id);
    let img = objects.doorMap.get(door.id);
    if (!img) {
      img = scene.add
        .image(door.x, door.y, 'door_closed')
        .setOrigin(0, 0)
        .setDisplaySize(BORDER_LENGTH, BORDER_THICKNESS);
      objects.doorMap.set(door.id, img);
    }
    if (door.phase === 'opened') {
      img.setVisible(false);
    } else if (door.phase === 'opening') {
      // 600ms 동안 frame0 → frame4 선형. floor 로 인덱스 산출.
      const t = Math.min(1, door.openingElapsedMs / 600);
      const frameIdx = Math.min(4, Math.floor(t * 5));
      img.setTexture(`door_opening_${frameIdx}`);
      img.setPosition(door.x, door.y)
        .setDisplaySize(BORDER_LENGTH, BORDER_THICKNESS)
        .setVisible(true);
    } else {
      // closed
      img.setTexture('door_closed');
      img.setPosition(door.x, door.y)
        .setDisplaySize(BORDER_LENGTH, BORDER_THICKNESS)
        .setVisible(true);
    }
  }
  for (const [id, img] of objects.doorMap) {
    if (!activeDoorIds.has(id)) img.setVisible(false);
  }

  // 아이템 토스트 — bar.activeEffect 변경 감지 (derive).
  // 'none' → effect 면 새 아이템 먹은 것. effect → 다른 effect 도 새 토스트.
  // 같은 effect 갱신(타이머 연장)은 trigger 안 함.
  const currEffect = bar.activeEffect;
  if (currEffect !== objects.toastState.prevEffect && currEffect !== 'none') {
    const text = currEffect === 'expand' ? 'EXPAND!'
               : currEffect === 'magnet' ? 'MAGNET!'
               : currEffect === 'laser'  ? 'LASER!'
               : '';
    if (text !== '') {
      objects.itemToastText.setText(text);
      objects.toastState.endTime = performance.now() + 1500;
    }
  }
  objects.toastState.prevEffect = currEffect;

  if (performance.now() < objects.toastState.endTime) {
    // 위치: 바 우상단 (바의 오른쪽 끝 + 약간 간격, 바보다 위).
    const tx = bar.x + bar.width / 2 + 24;
    const ty = bar.y - 16;
    objects.itemToastText.setPosition(tx, ty).setVisible(true);
  } else {
    objects.itemToastText.setVisible(false);
  }

  // 슬라이더 발사 hint — 비활성 공 OR 자석 부착 공이 있으면 깜빡임으로 표시.
  // 공 발사 = 슬라이더 트랙 어디든 탭하면 SPACE 같은 효과.
  // 다만 현재 pointer 입력은 슬라이더 = 바 이동만 처리하므로 별도 launch 입력은 키보드/공간 클릭.
  // 일단 hint 만 표시해 사용자에게 슬라이더 영역이 발사 가능함을 알림 (실제 launch 입력 연결은 별도 작업).
  const needsLaunchHint =
    gameplayState.balls.some((b) => !b.isActive) ||
    (bar.activeEffect === 'magnet' && gameplayState.attachedBallIds.length > 0);
  if (needsLaunchHint) {
    // 600ms 주기 blink.
    const blink = Math.floor(performance.now() / 600) % 2 === 0;
    objects.sliderLaunchHint.setAlpha(blink ? 1 : 0.45).setVisible(true);
  } else {
    objects.sliderLaunchHint.setVisible(false);
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

  // 블록: 파괴되지 않은 블록만 visible. 시트 프레임 사용.
  // setOrigin(0,0): BlockState.{x,y}는 좌상단 (collision/editor와 동일 컨벤션).
  const activeBlockIds = new Set<string>();
  for (const block of gameplayState.blocks) {
    if (block.isDestroyed) continue;
    activeBlockIds.add(block.id);

    const def = blockDefinitions[block.definitionId];
    const frameName = def?.visualId ?? 'block_basic';
    const isFlashing = flashBlockIdSet.has(block.id);

    let img = objects.blockMap.get(block.id);
    if (!img) {
      img = scene.add
        .image(block.x, block.y, frameName)
        .setOrigin(0, 0)
        .setDisplaySize(BLOCK_WIDTH, BLOCK_HEIGHT);
      objects.blockMap.set(block.id, img);
    }

    // 플래시 = tint 로 밝게. 평소 = tint 없음.
    if (isFlashing) {
      img.setTintFill(0xffffff);
    } else {
      img.clearTint();
    }
    img.setPosition(block.x, block.y).setVisible(true);

    // 드랍 블록이면 위에 아이템 아이콘 오버레이.
    const overlayKey = BLOCK_ITEM_OVERLAY[frameName];
    if (overlayKey !== undefined) {
      let icon = objects.blockIconMap.get(block.id);
      if (!icon) {
        icon = scene.add
          .image(0, 0, overlayKey)
          .setOrigin(0.5, 0.5)
          .setDisplaySize(BLOCK_ICON_W, BLOCK_ICON_H);
        objects.blockIconMap.set(block.id, icon);
      }
      icon
        .setTexture(overlayKey)
        .setPosition(block.x + BLOCK_WIDTH / 2, block.y + BLOCK_HEIGHT / 2)
        .setVisible(true);
    }
  }

  // 파괴된 블록 + 아이콘 숨기기
  for (const [id, rect] of objects.blockMap) {
    if (!activeBlockIds.has(id)) {
      rect.setVisible(false);
    }
  }
  for (const [id, icon] of objects.blockIconMap) {
    if (!activeBlockIds.has(id)) {
      icon.setVisible(false);
    }
  }

  // 아이템 드랍 — 캡슐 스프라이트 (24×12) + 낙하 시 회전.
  // 스프라이트 자체에 색/외곽선/글자가 포함되어 별도 합성 없음.
  const activeItemIds = new Set<string>();
  for (const item of gameplayState.itemDrops) {
    if (item.isCollected) continue;
    activeItemIds.add(item.id);

    let img = objects.itemMap.get(item.id);
    if (!img) {
      const key = ITEM_TEX[item.itemType] ?? ITEM_TEX_DEFAULT;
      img = scene.add
        .image(item.x, item.y, key)
        .setDisplaySize(ITEM_WIDTH, ITEM_HEIGHT)
        .setOrigin(0.5, 0.5);
      objects.itemMap.set(item.id, img);
    }

    // 위치 + 회전 (낙하 거리 기반 굴러가는 효과).
    img.setPosition(item.x, item.y);
    img.angle = (item.y * 2) % 360;
    img.setVisible(true);
  }

  // 수집/소멸된 아이템 숨기기
  for (const [id, img] of objects.itemMap) {
    if (!activeItemIds.has(id)) {
      img.setVisible(false);
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
      // angleRad를 Y축 회전각으로 해석. 6면 painter's algorithm + 가시 판정.
      const s = def.size / 2;
      const cosA = Math.cos(spinner.angleRad);
      const sinA = Math.sin(spinner.angleRad);

      const project = (lx: number, ly: number, lz: number): [number, number, number] => {
        const rx = lx * cosA - lz * sinA;
        const rz = lx * sinA + lz * cosA;
        return [spinner.x + rx, spinner.y + ly, rz];
      };

      type Vtx = [number, number, number];
      const V: [Vtx, Vtx, Vtx, Vtx, Vtx, Vtx, Vtx, Vtx] = [
        project(-s, -s, -s), project( s, -s, -s),
        project( s,  s, -s), project(-s,  s, -s),
        project(-s, -s,  s), project( s, -s,  s),
        project( s,  s,  s), project(-s,  s,  s),
      ];

      type Face = { idx: [number, number, number, number]; color: number };
      const faces: Face[] = [
        { idx: [4, 5, 6, 7], color: CUBE_FRONT },
        { idx: [3, 2, 1, 0], color: CUBE_FRONT },
        { idx: [0, 1, 5, 4], color: CUBE_TOP   },
        { idx: [3, 2, 6, 7], color: CUBE_TOP   },
        { idx: [1, 2, 6, 5], color: CUBE_SIDE  },
        { idx: [4, 7, 3, 0], color: CUBE_SIDE  },
      ];

      type VisibleFace = { color: number; pts: { x: number; y: number }[]; avgZ: number };
      const visibleFaces: VisibleFace[] = [];

      for (const face of faces) {
        const [i0, i1, i2, i3] = face.idx;
        // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
        const v0 = V[i0]!; const v1 = V[i1]!;
        // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
        const v2 = V[i2]!; const v3 = V[i3]!;

        const ex1 = v1[0] - v0[0]; const ey1 = v1[1] - v0[1];
        const ex2 = v3[0] - v0[0]; const ey2 = v3[1] - v0[1];
        const nz = ex1 * ey2 - ey1 * ex2;

        if (nz >= 0) {
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

      visibleFaces.sort((a, b) => a.avgZ - b.avgZ);

      for (const vf of visibleFaces) {
        gfx.fillStyle(vf.color, 1).fillPoints(vf.pts, true);
      }

    } else {
      // ---- pseudo-3D 정사면체(tetrahedron) (Y축 회전) ----
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
        projectTri(  0,    -h,        0         ),
        projectTri(  s,  h / 3, -s * inv3       ),
        projectTri( -s,  h / 3, -s * inv3       ),
        projectTri(  0,  h / 3,  2 * s * inv3   ),
      ];

      type TriFace = { idx: [number, number, number]; color: number };
      const triFaces: TriFace[] = [
        { idx: [0, 1, 3], color: TRI_FACE0 },
        { idx: [0, 3, 2], color: TRI_FACE1 },
        { idx: [0, 2, 1], color: TRI_FACE2 },
        { idx: [1, 2, 3], color: TRI_FACE1 },
      ];

      type VisTriFace = { color: number; x0: number; y0: number; x1: number; y1: number; x2: number; y2: number; avgZ: number };
      const visTriFaces: VisTriFace[] = [];

      for (const tf of triFaces) {
        const [i0, i1, i2] = tf.idx;
        // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
        const t0 = T[i0]!; const t1 = T[i1]!; const t2 = T[i2]!;

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
  objects.livesGraphics.clear().setVisible(false);
  for (const dot of objects.trajectoryDots) {
    dot.setVisible(false);
  }
  objects.cheerMascotContainer.setVisible(false);
  objects.hudEffectTimer.setVisible(false);
  objects.itemToastText.setVisible(false);
  objects.sliderLaunchHint.setVisible(false);
  objects.sliderTrack.setVisible(false);
  objects.sliderKnob.setVisible(false);
  objects.bar.setVisible(false);
  objects.ball.setVisible(false);
  for (const rect of objects.blockMap.values()) {
    rect.setVisible(false);
  }
  for (const icon of objects.blockIconMap.values()) {
    icon.setVisible(false);
  }
  for (const img of objects.itemMap.values()) {
    img.setVisible(false);
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
