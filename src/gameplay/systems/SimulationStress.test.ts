/**
 * SimulationStress.test.ts
 *
 * Layer 1: 실제 게임플레이 수준 시뮬레이션 스트레스 테스트.
 * 블록 통과(터널링) 버그를 다양한 발사 각도·속도·dt 조합으로 노출하기 위한 테스트.
 *
 * 모든 테스트는 결정적(Math.random 사용 안 함)이며,
 * 입력 파라미터 조합을 하드코딩된 배열로 순회한다.
 *
 * 검사 기준:
 *   - 매 tick 후 활성 공의 중심이 어떤 비파괴 블록의 AABB 내부에도 없어야 한다.
 *   - "내부" 판정: 공 중심 x/y 가 블록 좌표 범위 안에 있는 경우
 *     (margin 없음 — 중심이 블록 면 정확히 위에 있는 경우는 허용).
 *
 * Architecture §17(시뮬레이션 틱 순서), §18(충돌 정책), MVP1 §13 기준.
 */

import { describe, it, expect } from 'vitest';
import { moveBallWithCollisions } from './MovementSystem';
import type { BallState } from '../state/BallState';
import type { BlockState } from '../state/BlockState';

// ---------------------------------------------------------------------------
// Constants — must match CollisionService internals
// ---------------------------------------------------------------------------

const BALL_RADIUS = 8;
const BLOCK_WIDTH = 64;
const BLOCK_HEIGHT = 24;
const CANVAS_WIDTH = 720;
const CANVAS_HEIGHT = 720;

// Stage 1 grid layout (from StageRuntimeFactory + stage1.json)
const BLOCK_GRID_START_Y = 80;
const BLOCK_GRID_LEFT_MARGIN = 56;
const BLOCK_GAP = 4;

// ---------------------------------------------------------------------------
// Stage 1 block grid builder
// ---------------------------------------------------------------------------

function buildStage1Blocks(): BlockState[] {
  const rows = 5;
  const cols = 13;
  const blocks: BlockState[] = [];
  let index = 0;
  for (let row = 0; row < rows; row++) {
    for (let col = 0; col < cols; col++) {
      const x = BLOCK_GRID_LEFT_MARGIN + col * (BLOCK_WIDTH + BLOCK_GAP);
      const y = BLOCK_GRID_START_Y + row * (BLOCK_HEIGHT + BLOCK_GAP);
      blocks.push({
        id: `block_${index}`,
        x,
        y,
        remainingHits: 1,
        isDestroyed: false,
        definitionId: 'basic',
      });
      index++;
    }
  }
  return blocks;
}

// ---------------------------------------------------------------------------
// Ball-inside-block check (공 중심 기준, margin 없음)
// ---------------------------------------------------------------------------

function isBallCenterInsideBlock(ball: BallState, block: BlockState): boolean {
  if (block.isDestroyed) return false;
  return (
    ball.x > block.x &&
    ball.x < block.x + BLOCK_WIDTH &&
    ball.y > block.y &&
    ball.y < block.y + BLOCK_HEIGHT
  );
}

// Wall reflection helpers (벽 반사, 단순 flip)
function applyWallReflections(ball: BallState): BallState {
  let { vx, vy } = ball;
  let { x, y } = ball;

  if (x - BALL_RADIUS <= 0) {
    x = BALL_RADIUS + 1;
    vx = Math.abs(vx);
  } else if (x + BALL_RADIUS >= CANVAS_WIDTH) {
    x = CANVAS_WIDTH - BALL_RADIUS - 1;
    vx = -Math.abs(vx);
  }

  if (y - BALL_RADIUS <= 0) {
    y = BALL_RADIUS + 1;
    vy = Math.abs(vy);
  }

  return { ...ball, x, y, vx, vy };
}

// ---------------------------------------------------------------------------
// Simulation runner
// Returns null on success (no tunnel detected), or a description on failure.
// ---------------------------------------------------------------------------

type TunnelInfo = {
  tick: number;
  ballX: number;
  ballY: number;
  ballVx: number;
  ballVy: number;
  blockId: string;
  blockX: number;
  blockY: number;
};

function runSimulation(
  startBall: BallState,
  blocks: BlockState[],
  dt: number,
  maxTicks: number,
): TunnelInfo | null {
  let ball = startBall;
  // Clone blocks so we can destroy them as hits register
  let currentBlocks = blocks.map((b) => ({ ...b }));

  for (let tick = 0; tick < maxTicks; tick++) {
    // Skip if ball fell off or is inactive
    if (!ball.isActive) break;
    if (ball.y - BALL_RADIUS > CANVAS_HEIGHT) break;

    // Move with block collisions (swept AABB)
    const result = moveBallWithCollisions(ball, dt, currentBlocks);
    ball = result.ball;

    // Destroy any hit blocks so they don't re-collide
    for (const fact of result.blockFacts) {
      currentBlocks = currentBlocks.map((b) =>
        b.id === fact.blockId ? { ...b, isDestroyed: true } : b,
      );
    }

    // Apply simple wall reflections so the ball stays in play
    ball = applyWallReflections(ball);

    // POST-TICK SANITY: check if ball center is inside any active block
    for (const block of currentBlocks) {
      if (isBallCenterInsideBlock(ball, block)) {
        return {
          tick,
          ballX: ball.x,
          ballY: ball.y,
          ballVx: ball.vx,
          ballVy: ball.vy,
          blockId: block.id,
          blockX: block.x,
          blockY: block.y,
        };
      }
    }
  }

  return null;
}

// ---------------------------------------------------------------------------
// Test helpers
// ---------------------------------------------------------------------------

function makeBall(x: number, y: number, vx: number, vy: number): BallState {
  return { id: 'ball_0', x, y, vx, vy, isActive: true };
}

function formatTunnel(info: TunnelInfo, label: string): string {
  return (
    `TUNNEL DETECTED [${label}]:\n` +
    `  tick:  ${info.tick}\n` +
    `  ball:  (${info.ballX.toFixed(2)}, ${info.ballY.toFixed(2)})  vx=${info.ballVx.toFixed(1)} vy=${info.ballVy.toFixed(1)}\n` +
    `  block: ${info.blockId} at (${info.blockX}, ${info.blockY}, w=${BLOCK_WIDTH}, h=${BLOCK_HEIGHT})`
  );
}

// ---------------------------------------------------------------------------
// Test Suite 1: 다양한 발사 각도 × 속도 × dt 조합으로 3000 tick 시뮬레이션
//
// 발사 각도: -80°~-30° (우상향), -150°~-100° (좌상향) — 각 5도 간격
// 속도: 420, 600, 900 px/s
// dt: 1/60 (60fps), 1/30 (30fps)
// 발사 위치: 공 초기 위치 (480, 600)
// ---------------------------------------------------------------------------

describe('스트레스 테스트 — 발사 각도·속도·dt 3000 tick', () => {
  const anglesRight: number[] = [];
  for (let deg = -80; deg <= -30; deg += 5) anglesRight.push(deg);

  const anglesLeft: number[] = [];
  for (let deg = -150; deg <= -100; deg += 5) anglesLeft.push(deg);

  const angles = [...anglesRight, ...anglesLeft];
  const speeds = [420, 600, 900];
  const dts = [1 / 60, 1 / 30];
  const MAX_TICKS = 3000;

  const blocks = buildStage1Blocks();

  for (const angleDeg of angles) {
    for (const speed of speeds) {
      for (const dt of dts) {
        const label = `angle=${angleDeg}° speed=${speed} dt=${dt.toFixed(4)}`;
        it(label, () => {
          const rad = (angleDeg * Math.PI) / 180;
          const vx = Math.cos(rad) * speed;
          const vy = Math.sin(rad) * speed;
          const ball = makeBall(480, 600, vx, vy);

          const tunnel = runSimulation(ball, blocks, dt, MAX_TICKS);
          if (tunnel !== null) {
            throw new Error(formatTunnel(tunnel, label));
          }
          expect(tunnel).toBeNull();
        });
      }
    }
  }
});

// ---------------------------------------------------------------------------
// Test Suite 2: 바 반사 후 다양한 barContactX에서 1000 tick 간 블록 진입 없음
//
// 바에서 반사된 직후 공의 궤적을 1000 tick 추적.
// barContactX: -0.9 ~ +0.9, 20개 샘플
// 속도: 420, 600
// ---------------------------------------------------------------------------

describe('스트레스 테스트 — 바 반사 후 barContactX × 속도 1000 tick', () => {
  const blocks = buildStage1Blocks();
  const MAX_TICKS = 1000;
  const speeds = [420, 600];

  // 20 samples from -0.9 to +0.9
  const contactXSamples: number[] = [];
  for (let i = 0; i <= 19; i++) {
    contactXSamples.push(-0.9 + (i / 19) * 1.8);
  }

  for (const speed of speeds) {
    for (const contactX of contactXSamples) {
      // Bar reflection formula from CollisionResolutionService.reflectBallBar:
      //   vx = contactX * speed * 0.7
      //   vy = -sqrt(speed^2 - vx^2)   (always upward)
      const rawVx = contactX * speed * 0.7;
      const vyMag = Math.sqrt(Math.max(speed * speed - rawVx * rawVx, (speed * 0.3) ** 2));
      const vy = -vyMag;

      const label = `barContactX=${contactX.toFixed(3)} speed=${speed}`;

      it(label, () => {
        // Ball just above the bar, moving upward after reflection
        const ball = makeBall(480, 644, rawVx, vy);

        const tunnel = runSimulation(ball, blocks, 1 / 60, MAX_TICKS);
        if (tunnel !== null) {
          throw new Error(formatTunnel(tunnel, label));
        }
        expect(tunnel).toBeNull();
      });
    }
  }
});

// ---------------------------------------------------------------------------
// Test Suite 3: 극단적 조건 — 매우 빠른 공, 긴 dt, 좁은 모서리 접근
// ---------------------------------------------------------------------------

describe('스트레스 테스트 — 극단적 조건', () => {
  const blocks = buildStage1Blocks();

  it('매우 빠른 공 (1400 px/s) 이 60fps dt로 1000 tick 동안 블록을 통과하지 않는다', () => {
    const speed = 1400;
    const rad = (-60 * Math.PI) / 180;
    const ball = makeBall(480, 600, Math.cos(rad) * speed, Math.sin(rad) * speed);
    const tunnel = runSimulation(ball, blocks, 1 / 60, 1000);
    if (tunnel !== null) {
      throw new Error(formatTunnel(tunnel, 'extreme-speed-1400'));
    }
    expect(tunnel).toBeNull();
  });

  it('매우 느린 공 (120 px/s) 이 30fps dt로 2000 tick 동안 블록을 통과하지 않는다', () => {
    const speed = 120;
    const rad = (-75 * Math.PI) / 180;
    const ball = makeBall(480, 600, Math.cos(rad) * speed, Math.sin(rad) * speed);
    const tunnel = runSimulation(ball, blocks, 1 / 30, 2000);
    if (tunnel !== null) {
      throw new Error(formatTunnel(tunnel, 'slow-ball-120'));
    }
    expect(tunnel).toBeNull();
  });

  it('블록 모서리 정확히 대각선으로 진입하는 각도 (-45°) 에서 터널링 없음', () => {
    const speed = 420;
    const rad = (-45 * Math.PI) / 180;
    // Position ball so it aims at the top-right corner of a block
    // block_0: x=40, y=80 → top-right corner at (104, 80)
    // Start from a position that creates a diagonal approach to that corner
    const ball = makeBall(120, 400, Math.cos(rad) * speed, Math.sin(rad) * speed);
    const tunnel = runSimulation(ball, blocks, 1 / 60, 2000);
    if (tunnel !== null) {
      throw new Error(formatTunnel(tunnel, 'diagonal-corner-approach'));
    }
    expect(tunnel).toBeNull();
  });

  it('블록 행 상단 바로 위에서 수직에 가까운 각도 (-80°) 로 진입 시 터널링 없음', () => {
    // Near-vertical approach directly above the block grid row
    const speed = 420;
    const rad = (-80 * Math.PI) / 180;
    const ball = makeBall(480, 500, Math.cos(rad) * speed, Math.sin(rad) * speed);
    const tunnel = runSimulation(ball, blocks, 1 / 60, 1000);
    if (tunnel !== null) {
      throw new Error(formatTunnel(tunnel, 'near-vertical-entry'));
    }
    expect(tunnel).toBeNull();
  });

  it('공이 블록 사이 간격(4px)을 통과하는 경로에서 인접 블록 진입 없음', () => {
    // Block gap is 4px; BALL_RADIUS=8 > gap, so ball cannot fit through the gap.
    // The ball should always hit the adjacent block face, not pass through.
    // Aim at gap between col=0 and col=1: gap center x = 40 + 64 + 2 = 106
    const speed = 420;
    // Straight up toward the gap
    const ball = makeBall(106, 600, 0, -speed);
    const tunnel = runSimulation(ball, blocks, 1 / 60, 500);
    if (tunnel !== null) {
      throw new Error(formatTunnel(tunnel, 'between-block-gap'));
    }
    expect(tunnel).toBeNull();
  });
});

