import type Phaser from 'phaser';
import type { BallState } from '../../../gameplay/state/BallState';
import { BALL_RADIUS } from '../../../gameplay/systems/playfieldLayout';

// 공 발사 궤적 — 발사 전 (ball.isActive=false) 미리보기.
const TRAJECTORY_DOT_COUNT = 18;
const TRAJECTORY_DOT_RADIUS = 5;
const TRAJECTORY_DOT_COLOR = 0x88ffff;
const TRAJECTORY_STEP_DT = 0.07;
const PLAYFIELD_LOCAL_WIDTH = 720;
const TRAJECTORY_BALL_RADIUS = 8;

export type BallObjects = {
  ball: Phaser.GameObjects.Image;
  trajectoryDots: Phaser.GameObjects.Arc[];
};

export function createBallObjects(scene: Phaser.Scene): BallObjects {
  const ball = scene.add
    .image(360, 660, 'ball')
    .setDisplaySize(BALL_RADIUS * 2, BALL_RADIUS * 2)
    .setVisible(false);

  const trajectoryDots: Phaser.GameObjects.Arc[] = [];
  for (let i = 0; i < TRAJECTORY_DOT_COUNT; i++) {
    const dot = scene.add
      .arc(0, 0, TRAJECTORY_DOT_RADIUS, 0, 360, false, TRAJECTORY_DOT_COLOR)
      .setVisible(false);
    trajectoryDots.push(dot);
  }
  return { ball, trajectoryDots };
}

export function renderBall(
  objects: BallObjects,
  ball: Readonly<BallState> | undefined,
  isBreaking: boolean,
  ballConfig?: { ballInitialSpeed: number; ballInitialAngleDeg: number },
): void {
  if (ball && !isBreaking) {
    objects.ball.setPosition(ball.x, ball.y).setAlpha(1).setVisible(true);
  } else {
    objects.ball.setVisible(false);
  }

  if (ball && !ball.isActive && !isBreaking && ballConfig) {
    renderBallTrajectory(objects.trajectoryDots, ball.x, ball.y, ballConfig);
  } else {
    for (const dot of objects.trajectoryDots) dot.setVisible(false);
  }
}

export function hideBall(objects: BallObjects): void {
  objects.ball.setVisible(false);
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
