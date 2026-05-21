import type Phaser from 'phaser';
import type { BallState } from '../../../gameplay/state/BallState';
import { BALL_RADIUS } from '../../../gameplay/systems/playfieldLayout';
import { applyGlossyStyle } from '../../ui/GlossyStyle';
import { createBallTrail, type BallTrail } from '../../ui/BallTrail';
import { TRAIL_STYLES, type TrailStyleId } from '../../../definitions/tables/TrailStyleTable';

// 공 발사 궤적 — 발사 전 (ball.isActive=false) 미리보기.
const TRAJECTORY_DOT_COUNT = 18;
const TRAJECTORY_DOT_RADIUS = 5;
const TRAJECTORY_DOT_COLOR = 0x88ffff;
const TRAJECTORY_STEP_DT = 0.07;
const PLAYFIELD_LOCAL_WIDTH = 720;
const TRAJECTORY_BALL_RADIUS = 8;

// 공 톤 — 살짝 청록 톤 (순백 X). 톤 결정 후 갱신.
const BALL_COLORS = {
  base: 0xc8d6e4,      // 청회색 톤 (구슬 같은 인상)
  highlight: 0xffffff, // specular 점은 흰색 OK (작아서 안 떠 보임)
  outline: 0x2a3a4a,
};

export type BallObjects = {
  /** 공 본체 — Graphics 한 객체. shadow/base/specular/outline. */
  graphics: Phaser.GameObjects.Graphics;
  trajectoryDots: Phaser.GameObjects.Arc[];
  /** 트레일 인스턴스 — 스타일 별 미리 생성. 현재 stage 의 styleId 만 active. */
  trails: Record<TrailStyleId, BallTrail>;
};

export function createBallObjects(scene: Phaser.Scene): BallObjects {
  // 3 trail 미리 생성 — 라운드 바뀔 때 setActive 토글로 전환. style 별 glow postFX 도 미리 적용됨.
  const trails: Record<TrailStyleId, BallTrail> = {
    golden_sun:  createBallTrail(scene, TRAIL_STYLES.golden_sun),
    blue_meteor: createBallTrail(scene, TRAIL_STYLES.blue_meteor),
    sunset:      createBallTrail(scene, TRAIL_STYLES.sunset),
  };

  const graphics = scene.add.graphics().setVisible(false);

  const trajectoryDots: Phaser.GameObjects.Arc[] = [];
  for (let i = 0; i < TRAJECTORY_DOT_COUNT; i++) {
    const dot = scene.add
      .arc(0, 0, TRAJECTORY_DOT_RADIUS, 0, 360, false, TRAJECTORY_DOT_COLOR)
      .setVisible(false);
    trajectoryDots.push(dot);
  }
  return { graphics, trajectoryDots, trails };
}

export function renderBall(
  objects: BallObjects,
  ball: Readonly<BallState> | undefined,
  isBreaking: boolean,
  ballConfig?: { ballInitialSpeed: number; ballInitialAngleDeg: number },
  trailStyleId: TrailStyleId = 'golden_sun',
): void {
  if (ball && !isBreaking) {
    applyGlossyStyle(objects.graphics, {
      cx: ball.x,
      cy: ball.y,
      w: BALL_RADIUS * 2,
      h: BALL_RADIUS * 2,
      shape: 'circle',
      baseColor: BALL_COLORS.base,
      highlight: BALL_COLORS.highlight,
      outline: BALL_COLORS.outline,
    });
    objects.graphics.setAlpha(1).setVisible(true);
    // 파워 상태 — 현재 stage 의 trail 만 active, 나머지는 inactive.
    const powered = ball.isPowered === true;
    for (const [id, t] of Object.entries(objects.trails) as [TrailStyleId, BallTrail][]) {
      if (powered && id === trailStyleId) {
        t.setActive(true);
        t.update(ball.x, ball.y);
      } else {
        t.setActive(false);
      }
    }
  } else {
    objects.graphics.setVisible(false);
    for (const t of Object.values(objects.trails)) t.setActive(false);
  }

  if (ball && !ball.isActive && !isBreaking && ballConfig) {
    renderBallTrajectory(objects.trajectoryDots, ball.x, ball.y, ballConfig);
  } else {
    for (const dot of objects.trajectoryDots) dot.setVisible(false);
  }
}

export function hideBall(objects: BallObjects): void {
  objects.graphics.setVisible(false);
  for (const t of Object.values(objects.trails)) t.setActive(false);
  for (const dot of objects.trajectoryDots) dot.setVisible(false);
}

/** 공 발사 궤적 시뮬레이션 + cyan 점 표시. 좌/우 벽 반사. 천장 도달 이후는 hidden. */
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

    if (x < TRAJECTORY_BALL_RADIUS) {
      x = TRAJECTORY_BALL_RADIUS * 2 - x;
      vx = -vx;
    } else if (x > PLAYFIELD_LOCAL_WIDTH - TRAJECTORY_BALL_RADIUS) {
      x = (PLAYFIELD_LOCAL_WIDTH - TRAJECTORY_BALL_RADIUS) * 2 - x;
      vx = -vx;
    }

    if (y < TRAJECTORY_BALL_RADIUS) {
      for (let j = i; j < dots.length; j++) dots[j]!.setVisible(false);
      return;
    }

    const alpha = 1 - i / dots.length;
    dots[i]!.setPosition(x, y).setAlpha(alpha).setVisible(true);
  }
}
