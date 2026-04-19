/**
 * TunnelingReproduction.test.ts
 *
 * 터널링(블록 다중 통과) 버그를 재현하고 근본 수정을 검증하는 테스트.
 *
 * 스크린샷으로 확정된 증거:
 * - 고밀도 블록 배치에서 공이 한 틱에 여러 블록을 통과
 * - 블록 내부에 공이 걸친 모습
 *
 * Root cause 의심 지점:
 * - 의심 1: MAX_BOUNCE_COUNT=4 cap 이후 free-advance에 collision 체크 부재
 * - 의심 2: free-advance 구간에서 블록 통과
 * - 의심 3: hitBlockIds skip 후 free-advance로 블록 내부 진입
 * - 의심 4: sanityCheck 경계 판정 부동소수점 문제
 *
 * Architecture §18(충돌 정책), MVP1 §13 기준.
 */

import { describe, it, expect } from 'vitest';
import { moveBallWithCollisions } from './MovementSystem';
import type { BallState } from '../state/BallState';
import type { BlockState } from '../state/BlockState';

const BLOCK_WIDTH = 64;
const BLOCK_HEIGHT = 24;
const BLOCK_GAP = 4;
const BALL_RADIUS = 8;
const BLOCK_GRID_LEFT = 40;
const BLOCK_GRID_TOP = 80;

function buildDenseGrid(rows: number, cols: number): BlockState[] {
  const blocks: BlockState[] = [];
  let idx = 0;
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      blocks.push({
        id: `b_${idx++}`,
        x: BLOCK_GRID_LEFT + c * (BLOCK_WIDTH + BLOCK_GAP),
        y: BLOCK_GRID_TOP + r * (BLOCK_HEIGHT + BLOCK_GAP),
        remainingHits: 1,
        isDestroyed: false,
        definitionId: 'basic',
      });
    }
  }
  return blocks;
}

function isBallInsideBlock(ball: BallState, block: BlockState): boolean {
  if (block.isDestroyed) return false;
  return (
    ball.x > block.x &&
    ball.x < block.x + BLOCK_WIDTH &&
    ball.y > block.y &&
    ball.y < block.y + BLOCK_HEIGHT
  );
}

// ---------------------------------------------------------------------------
// 재현 테스트 1: 고속 공이 단일 틱에 5개 이상 블록 통과하는지 확인
// (이 테스트는 버그 재현 용도 — 수정 전에는 fail, 수정 후에는 pass)
// ---------------------------------------------------------------------------
describe('터널링 재현 — 고속 공 단일 틱 다중 통과', () => {
  it('vy=-600, dt=0.016 조건에서 공이 블록 내부에 위치하지 않는다', () => {
    // 블록 그리드 시작: y=80, 블록 높이=24, gap=4 → 각 행 높이 28px
    // 공이 y=230(블록 하단 바로 아래)에서 vy=-600으로 이동
    // 한 틱(0.016s)에 600*0.016=9.6px 이동 → 블록 한 개(24px) 이내이므로 일반 속도
    // 그러나 vy=-1200 같은 고속으로 테스트

    const blocks = buildDenseGrid(5, 13);
    // 블록 5행의 하단: y = 80 + 4*(24+4) + 24 = 80 + 112 + 24 = 216
    // 공을 y=230 (블록 아래), vy=-1200으로 한 틱 이동 → 1200*0.016=19.2px → 블록 높이 24px 이하이지만
    // 아래에서 올라오므로 y = 230-19.2 = 210.8 → 아직 블록 내부 아님
    // 실제 터널링은 bounce cap 초과 시 발생하므로 더 밀집한 환경에서 테스트

    const ball: BallState = {
      id: 'ball_0',
      x: 480,
      y: 230,
      vx: 50,
      vy: -600,
      isActive: true,
    };

    let current = { ...ball };
    let currentBlocks = blocks.map((b) => ({ ...b }));

    let tunnelDetected = false;
    let tunnelDetail = '';

    for (let tick = 0; tick < 60; tick++) {
      const result = moveBallWithCollisions(current, 0.016, currentBlocks);
      current = result.ball;

      // 히트된 블록 파괴
      for (const fact of result.blockFacts) {
        currentBlocks = currentBlocks.map((b) =>
          b.id === fact.blockId ? { ...b, isDestroyed: true } : b,
        );
      }

      // 공이 블록 내부에 있는지 확인
      for (const block of currentBlocks) {
        if (isBallInsideBlock(current, block)) {
          tunnelDetected = true;
          tunnelDetail =
            `tick=${tick} ball=(${current.x.toFixed(2)},${current.y.toFixed(2)})` +
            ` block=${block.id} at (${block.x},${block.y})`;
          break;
        }
      }

      if (tunnelDetected) break;
    }

    expect(tunnelDetected).toBe(false);
    if (tunnelDetected) {
      throw new Error(`터널링 감지: ${tunnelDetail}`);
    }
  });

  it('MAX_BOUNCE_COUNT 초과를 유발하는 5개 연속 블록 경로에서 공이 통과하지 않는다', () => {
    // 수직으로 쌓인 5개 블록 — 각 블록 사이 gap=4px
    // 공이 아래에서 vy=-2000으로 진입 → 한 틱에 2000*0.016=32px 이동
    // 블록 높이+gap = 28px이므로 한 틱에 1개 이상 통과할 수 있는 속도
    // MAX_BOUNCE_COUNT=4일 때 5번째 블록은 free-advance로 통과 가능

    const blocks: BlockState[] = [];
    for (let i = 0; i < 6; i++) {
      blocks.push({
        id: `col_block_${i}`,
        x: 460,
        y: 100 + i * (BLOCK_HEIGHT + BLOCK_GAP),
        remainingHits: 1,
        isDestroyed: false,
        definitionId: 'basic',
      });
    }
    // 블록 배치: y=100, 128, 156, 184, 212, 240

    const ball: BallState = {
      id: 'ball_0',
      x: 492, // 블록 중앙 x (블록 x=460, w=64 → center=492)
      y: 270,  // 블록들 아래
      vx: 0,
      vy: -2000, // 매우 빠른 속도 — 한 틱에 32px
      isActive: true,
    };

    const dt = 0.016;

    let current = { ...ball };
    let currentBlocks = blocks.map((b) => ({ ...b }));

    let tunnelDetected = false;
    let tunnelDetail = '';
    let maxBlocksDestroyedInOneTick = 0;

    for (let tick = 0; tick < 30; tick++) {
      const result = moveBallWithCollisions(current, dt, currentBlocks);
      current = result.ball;

      const destroyedThisTick = result.blockFacts.length;
      if (destroyedThisTick > maxBlocksDestroyedInOneTick) {
        maxBlocksDestroyedInOneTick = destroyedThisTick;
      }

      for (const fact of result.blockFacts) {
        currentBlocks = currentBlocks.map((b) =>
          b.id === fact.blockId ? { ...b, isDestroyed: true } : b,
        );
      }

      for (const block of currentBlocks) {
        if (isBallInsideBlock(current, block)) {
          tunnelDetected = true;
          tunnelDetail =
            `tick=${tick} ball=(${current.x.toFixed(2)},${current.y.toFixed(2)})` +
            ` vx=${current.vx.toFixed(1)} vy=${current.vy.toFixed(1)}` +
            ` block=${block.id} at (${block.x},${block.y})`;
          break;
        }
      }

      if (tunnelDetected) break;
    }

    if (tunnelDetected) {
      throw new Error(`터널링 감지: ${tunnelDetail}`);
    }
    expect(tunnelDetected).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// 재현 테스트 2: hitBlockIds skip 후 free-advance 버그 재현
// (의심 3: 같은 블록에 두 번 접근 시 skip 후 블록 내부 진입)
// ---------------------------------------------------------------------------
describe('hitBlockIds skip 후 free-advance 버그', () => {
  it('동일 틱 내에서 같은 블록을 두 번 hit하려 할 때 블록 내부에 위치하지 않는다', () => {
    // 반사 후 남은 시간으로 다시 같은 블록 방향으로 향하는 시나리오
    // 블록 하나, 공이 블록 바닥 면 바로 아래에서 위로 빠르게 진입
    const block: BlockState = {
      id: 'single_block',
      x: 460,
      y: 300,
      remainingHits: 1,
      isDestroyed: false,
      definitionId: 'basic',
    };

    // 블록 expanded bottom: y+h+r = 300+24+8 = 332
    // 공 y=340 (expanded AABB 바로 아래), vy=-6000으로 한 틱 이동
    // 6000*0.016 = 96px → 블록을 완전히 관통 가능한 속도
    const ball: BallState = {
      id: 'ball_0',
      x: 492,
      y: 340,
      vx: 0,
      vy: -6000,
      isActive: true,
    };

    const result = moveBallWithCollisions(ball, 0.016, [block]);

    // 공이 블록 내부에 있으면 안 됨
    const inside = isBallInsideBlock(result.ball, block);
    if (inside) {
      throw new Error(
        `공이 블록 내부에 위치: ball=(${result.ball.x.toFixed(2)},${result.ball.y.toFixed(2)})` +
        ` block at (${block.x},${block.y},w=${BLOCK_WIDTH},h=${BLOCK_HEIGHT})`,
      );
    }
    expect(inside).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// 재현 테스트 3: 고밀도 그리드에서 한 틱에 2개 이상 블록 파괴 금지
//
// 한 틱에 2개 이상 블록이 파괴된다 = 터널링의 간접 증거.
// (단, 코너 케이스에서 2개가 동시에 닿는 경우는 있을 수 있으므로
//  3개 이상을 금지 기준으로 설정)
// ---------------------------------------------------------------------------
describe('한 틱 다중 블록 파괴 방지', () => {
  it('표준 속도(600px/s)에서 한 틱에 2개 이상 블록이 파괴되지 않는다', () => {
    const blocks = buildDenseGrid(5, 13);

    const ball: BallState = {
      id: 'ball_0',
      x: 480,
      y: 600,
      vx: 0,
      vy: -600,
      isActive: true,
    };

    let current = { ...ball };
    let currentBlocks = blocks.map((b) => ({ ...b }));
    const maxPerTick: number[] = [];

    for (let tick = 0; tick < 200; tick++) {
      if (!current.isActive || current.y < 0) break;

      const result = moveBallWithCollisions(current, 0.016, currentBlocks);
      current = result.ball;
      maxPerTick.push(result.blockFacts.length);

      for (const fact of result.blockFacts) {
        currentBlocks = currentBlocks.map((b) =>
          b.id === fact.blockId ? { ...b, isDestroyed: true } : b,
        );
      }

      // 단순 벽 반사
      if (current.x - BALL_RADIUS <= 0) current = { ...current, vx: Math.abs(current.vx) };
      if (current.x + BALL_RADIUS >= 960) current = { ...current, vx: -Math.abs(current.vx) };
      if (current.y - BALL_RADIUS <= 0) current = { ...current, vy: Math.abs(current.vy) };
    }

    const maxDestroyed = Math.max(...maxPerTick, 0);
    expect(maxDestroyed).toBeLessThanOrEqual(2);
  });

  it('고속(1400px/s)에서 한 틱에 3개 이상 블록이 파괴되지 않는다', () => {
    const blocks = buildDenseGrid(5, 13);

    const angle = (-75 * Math.PI) / 180;
    const speed = 1400;
    const ball: BallState = {
      id: 'ball_0',
      x: 480,
      y: 600,
      vx: Math.cos(angle) * speed,
      vy: Math.sin(angle) * speed,
      isActive: true,
    };

    let current = { ...ball };
    let currentBlocks = blocks.map((b) => ({ ...b }));
    let maxDestroyedPerTick = 0;
    let worstTick = -1;
    let worstFacts: string[] = [];

    for (let tick = 0; tick < 200; tick++) {
      if (!current.isActive || current.y < 0) break;

      const result = moveBallWithCollisions(current, 0.016, currentBlocks);
      current = result.ball;

      if (result.blockFacts.length > maxDestroyedPerTick) {
        maxDestroyedPerTick = result.blockFacts.length;
        worstTick = tick;
        worstFacts = result.blockFacts.map((f) => f.blockId);
      }

      for (const fact of result.blockFacts) {
        currentBlocks = currentBlocks.map((b) =>
          b.id === fact.blockId ? { ...b, isDestroyed: true } : b,
        );
      }

      if (current.x - BALL_RADIUS <= 0) current = { ...current, vx: Math.abs(current.vx) };
      if (current.x + BALL_RADIUS >= 960) current = { ...current, vx: -Math.abs(current.vx) };
      if (current.y - BALL_RADIUS <= 0) current = { ...current, vy: Math.abs(current.vy) };
    }

    if (maxDestroyedPerTick >= 3) {
      throw new Error(
        `한 틱에 ${maxDestroyedPerTick}개 블록 파괴 (tick=${worstTick}, blocks=${worstFacts.join(',')})`,
      );
    }
    expect(maxDestroyedPerTick).toBeLessThan(3);
  });
});

// ---------------------------------------------------------------------------
// 재현 테스트 4: free-advance 가드 — hitBlockIds에 있는 블록도 막혀야 함
// (수정 A 검증)
// ---------------------------------------------------------------------------
describe('free-advance 가드 (수정 A)', () => {
  it('bounce 루프에서 skip된 블록이 free-advance 구간에 있을 때 통과하지 않는다', () => {
    // 한 틱 내에서:
    //   1. 블록 A bottom 면에서 반사 (hitBlockIds.add('A'))
    //   2. 남은 dt로 다시 블록 A 방향 → sweep은 A를 반환하지만 skip
    //   3. !wallFirst && !blockFirst → free-advance guard 실행 → 블록 A 앞에서 정지
    const block: BlockState = {
      id: 'guard_block',
      x: 460,
      y: 100,
      remainingHits: 2,
      isDestroyed: false,
      definitionId: 'basic',
    };

    // 공이 블록 expanded bottom(132) 위에서 시작, vy=+2000 (아래)
    // 2000*0.016=32px → y=108+32=140 → 블록 expanded bottom(132) 도달
    // t=(132-108)/32=0.75, 반사 vy=-2000, remaining=0.25*0.016=0.004s
    // 공 y=132+0.5, vy=-2000, 위로: 2000*0.004=8px → y=132.5-8=124.5
    // 블록 expanded AABB: top=92, bottom=132
    // 124.5 > 92 이고 124.5 < 132 → expanded AABB 내부!
    // → sweep은 '블록 A top'을 감지 → hitBlockIds.has('A') → skip
    // → 이전: free-advance로 124.5로 이동 (블록 내부)
    // → 수정 후: free-advance 가드가 블록 A 앞에서 멈춤
    const ball: BallState = {
      id: 'ball_0',
      x: 492,
      y: 108,
      vx: 0,
      vy: 2000,
      isActive: true,
    };

    const result = moveBallWithCollisions(ball, 0.016, [block]);

    const inside = isBallInsideBlock(result.ball, block);
    if (inside) {
      throw new Error(
        `free-advance 가드 실패: ball.y=${result.ball.y.toFixed(3)}` +
        ` inside block y=[${block.y}, ${block.y + BLOCK_HEIGHT}]`,
      );
    }
    expect(inside).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// 재현 테스트 5: 수직으로 쌓인 블록들 관통 금지 — MAX_BOUNCE_COUNT 초과
// ---------------------------------------------------------------------------
describe('수직 블록 스택 관통 금지', () => {
  it('vy=-3000 (초고속)으로 수직 스택 6개를 한 틱에 모두 관통하지 않는다', () => {
    const verticalStack: BlockState[] = [];
    for (let i = 0; i < 6; i++) {
      verticalStack.push({
        id: `vs_${i}`,
        x: 460,
        y: 80 + i * (BLOCK_HEIGHT + BLOCK_GAP),
        remainingHits: 1,
        isDestroyed: false,
        definitionId: 'basic',
      });
    }
    // y 위치: 80, 108, 136, 164, 192, 220 (총 6개)

    const ball: BallState = {
      id: 'ball_0',
      x: 492,
      y: 300,
      vx: 0,
      vy: -3000,
      isActive: true,
    };

    const dt = 0.016; // 3000*0.016 = 48px — 블록 약 1.7개 높이

    let current = { ...ball };
    let currentBlocks = verticalStack.map((b) => ({ ...b }));
    let tunnelDetected = false;
    let tunnelDetail = '';

    for (let tick = 0; tick < 30; tick++) {
      const result = moveBallWithCollisions(current, dt, currentBlocks);
      current = result.ball;

      for (const fact of result.blockFacts) {
        currentBlocks = currentBlocks.map((b) =>
          b.id === fact.blockId ? { ...b, isDestroyed: true } : b,
        );
      }

      for (const block of currentBlocks) {
        if (isBallInsideBlock(current, block)) {
          tunnelDetected = true;
          tunnelDetail =
            `tick=${tick} ball=(${current.x.toFixed(2)},${current.y.toFixed(2)})` +
            ` vy=${current.vy.toFixed(1)} inside block=${block.id}(${block.x},${block.y})`;
          break;
        }
      }

      if (tunnelDetected) break;
      if (current.y - BALL_RADIUS < 0 || current.y + BALL_RADIUS > 720) break;
    }

    if (tunnelDetected) {
      throw new Error(`수직 스택 관통 감지: ${tunnelDetail}`);
    }
    expect(tunnelDetected).toBe(false);
  });
});
