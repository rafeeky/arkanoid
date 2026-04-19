/**
 * SubStepCollision.test.ts
 *
 * sub-step AABB 알고리즘 회귀 테스트.
 * 고속 공, 수직 터널, 연속 블록 시나리오를 명세에 따라 검증.
 *
 * 재작성 배경:
 *   swept AABB 구조의 누적 엣지 케이스로 인해 실제 플레이에서
 *   수직 터널링이 반복 발생. sub-step(4px/step) 방식으로 전면 재작성.
 *
 * Architecture §17 (시뮬레이션 틱 순서), §18 (충돌 정책), MVP1 §13, §15-2
 */

import { describe, it, expect } from 'vitest';
import { moveBallWithCollisions } from './MovementSystem';
import type { BallState } from '../state/BallState';
import type { BlockState } from '../state/BlockState';

const BLOCK_WIDTH = 64;
const BLOCK_HEIGHT = 24;
const BALL_RADIUS = 8;
const CANVAS_HEIGHT = 720;
const CANVAS_WIDTH = 720;

function isBallCenterInsideBlock(ball: BallState, block: BlockState): boolean {
  if (block.isDestroyed) return false;
  return (
    ball.x > block.x &&
    ball.x < block.x + BLOCK_WIDTH &&
    ball.y > block.y &&
    ball.y < block.y + BLOCK_HEIGHT
  );
}

// ---------------------------------------------------------------------------
// 테스트 1: 초고속 공 (2000px/s) 에서도 블록 통과 없음
//
// 명세:
//   공 (480, 300), vx=0, vy=-2000 (초고속 위)
//   블록 (400, 100, 64, 24) — 공 경로에 정확히
//   dt=0.033 (30fps, 최악 시나리오)
//   이동 거리: 2000 * 0.033 = 66px.
//   기대: blockFacts에 해당 블록 1개, vy > 0 (아래로 반사)
// ---------------------------------------------------------------------------
describe('고속 공 터널링 방지', () => {
  it('공이 초당 2000px 속도에서도 블록 통과 없음 (30fps 최악 dt)', () => {
    // 공: (480, 300), vy=-2000, dt=0.033
    // 이동 거리: 2000 * 0.033 = 66px → 최종 y ≈ 234
    // 블록 y=240 → expanded top = 240-8 = 232 → 공이 300→234로 이동 시 232 통과 → 히트
    const block: BlockState = {
      id: 'fast_block',
      x: 448,  // center 480 기준으로 공 경로에 정렬 (448~512)
      y: 240,
      remainingHits: 1,
      isDestroyed: false,
      definitionId: 'basic',
    };

    const ball: BallState = {
      id: 'ball_0',
      x: 480,
      y: 300,
      vx: 0,
      vy: -2000,
      isActive: true,
    };

    const dt = 0.033; // 30fps 최악 시나리오

    const result = moveBallWithCollisions(ball, dt, [block]);

    // 공이 블록 내부에 없어야 함
    expect(isBallCenterInsideBlock(result.ball, block)).toBe(false);

    // blockFacts에 해당 블록이 1개 있어야 함
    expect(result.blockFacts.length).toBeGreaterThanOrEqual(1);
    const hitIds = result.blockFacts.map((f) => f.blockId);
    expect(hitIds).toContain('fast_block');

    // 반사 후 vy가 양수 (아래로) 여야 함 (위에서 아래로 반사)
    expect(result.ball.vy).toBeGreaterThan(0);
  });

  it('공이 초당 1500px 속도에서도 블록 통과 없음 (60fps)', () => {
    const block: BlockState = {
      id: 'fast_block_60',
      x: 448,
      y: 400,
      remainingHits: 1,
      isDestroyed: false,
      definitionId: 'basic',
    };

    const ball: BallState = {
      id: 'ball_0',
      x: 480,
      y: 450,
      vx: 0,
      vy: -1500,
      isActive: true,
    };

    const dt = 1 / 60;

    const result = moveBallWithCollisions(ball, dt, [block]);

    expect(isBallCenterInsideBlock(result.ball, block)).toBe(false);
  });

  it('극한 속도 3000px/s 에서도 블록 내부 진입 없음', () => {
    const block: BlockState = {
      id: 'extreme_block',
      x: 448,
      y: 300,
      remainingHits: 2,  // 파괴되지 않음
      isDestroyed: false,
      definitionId: 'basic',
    };

    const ball: BallState = {
      id: 'ball_0',
      x: 480,
      y: 450,
      vx: 0,
      vy: -3000,
      isActive: true,
    };

    const result = moveBallWithCollisions(ball, 0.016, [block]);
    expect(isBallCenterInsideBlock(result.ball, block)).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// 테스트 2: 수직 경로에 연속 블록 4개 시 한 번에 하나만 파괴
//
// 명세:
//   수직 공, 연속 블록 4개
//   1 tick → 최대 1개 파괴 기대
//   (sub-step 방식에서는 한 번에 여러 블록에 반사되지 않음)
// ---------------------------------------------------------------------------
describe('수직 경로 연속 블록 — 한 틱 한 블록 반사', () => {
  it('수직 연속 블록 4개에서 한 틱에 1개 이하의 블록만 반사됨', () => {
    const blocks: BlockState[] = [];
    for (let i = 0; i < 4; i++) {
      blocks.push({
        id: `vert_${i}`,
        x: 448,
        y: 200 + i * (BLOCK_HEIGHT + 4),  // 200, 228, 256, 284
        remainingHits: 1,
        isDestroyed: false,
        definitionId: 'basic',
      });
    }

    const ball: BallState = {
      id: 'ball_0',
      x: 480,
      y: 450,
      vx: 0,
      vy: -600,
      isActive: true,
    };

    let current = { ...ball };
    let currentBlocks = blocks.map((b) => ({ ...b }));

    for (let tick = 0; tick < 50; tick++) {
      if (current.y < 0 || current.y > CANVAS_HEIGHT) break;

      const result = moveBallWithCollisions(current, 1 / 60, currentBlocks);
      current = result.ball;

      // 한 틱에 hit된 블록 수 확인 — 1개 이하여야 함
      // (같은 블록 ID 중복 제거 후)
      const uniqueHits = new Set(result.blockFacts.map((f) => f.blockId));
      if (uniqueHits.size > 1) {
        throw new Error(
          `tick=${tick}: 한 틱에 ${uniqueHits.size}개 블록 반사` +
          ` (${[...uniqueHits].join(', ')})`,
        );
      }
      expect(uniqueHits.size).toBeLessThanOrEqual(1);

      for (const f of result.blockFacts) {
        currentBlocks = currentBlocks.map((b) =>
          b.id === f.blockId ? { ...b, isDestroyed: true } : b,
        );
      }
    }
  });

  it('고속(1400px/s) 수직 공도 한 틱에 1개 이하 블록만 반사', () => {
    const blocks: BlockState[] = [];
    for (let i = 0; i < 6; i++) {
      blocks.push({
        id: `hspeed_${i}`,
        x: 448,
        y: 100 + i * (BLOCK_HEIGHT + 4),
        remainingHits: 1,
        isDestroyed: false,
        definitionId: 'basic',
      });
    }

    const ball: BallState = {
      id: 'ball_0',
      x: 480,
      y: 350,
      vx: 0,
      vy: -1400,
      isActive: true,
    };

    let current = { ...ball };
    let currentBlocks = blocks.map((b) => ({ ...b }));

    for (let tick = 0; tick < 30; tick++) {
      if (current.y < 0) break;

      const result = moveBallWithCollisions(current, 1 / 60, currentBlocks);
      current = result.ball;

      const uniqueHits = new Set(result.blockFacts.map((f) => f.blockId));
      if (uniqueHits.size > 1) {
        throw new Error(
          `고속 tick=${tick}: 한 틱에 ${uniqueHits.size}개 블록 반사`,
        );
      }
      expect(uniqueHits.size).toBeLessThanOrEqual(1);

      for (const f of result.blockFacts) {
        currentBlocks = currentBlocks.map((b) =>
          b.id === f.blockId ? { ...b, isDestroyed: true } : b,
        );
      }
    }
  });
});

// ---------------------------------------------------------------------------
// 테스트 3: 공이 블록 내부에 절대 머물지 않음 (100 tick 시뮬)
//
// 명세:
//   다양한 시나리오 100 tick 돌리고 매 tick 후 공이 블록 내부인지 체크.
// ---------------------------------------------------------------------------
describe('100 tick 시뮬레이션 — 공이 블록 내부에 절대 머물지 않음', () => {
  function buildGrid(rows: number, cols: number, startX: number, startY: number): BlockState[] {
    const result: BlockState[] = [];
    let idx = 0;
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        result.push({
          id: `g_${idx++}`,
          x: startX + c * (BLOCK_WIDTH + 4),
          y: startY + r * (BLOCK_HEIGHT + 4),
          remainingHits: 1,
          isDestroyed: false,
          definitionId: 'basic',
        });
      }
    }
    return result;
  }

  const scenarios: Array<{
    label: string;
    ball: BallState;
    blocks: BlockState[];
  }> = [
    {
      label: '45도 각도 표준 속도 5x3 그리드',
      ball: { id: 'ball_0', x: 480, y: 600, vx: 300, vy: -300, isActive: true },
      blocks: buildGrid(5, 3, 400, 80),
    },
    {
      label: '수직 고속 단열 블록',
      ball: { id: 'ball_0', x: 480, y: 500, vx: 0, vy: -900, isActive: true },
      blocks: buildGrid(1, 5, 350, 200),
    },
    {
      label: '수평에 가까운 각도 벽 근처',
      ball: { id: 'ball_0', x: 100, y: 300, vx: 800, vy: -200, isActive: true },
      blocks: buildGrid(3, 2, 600, 250),
    },
    {
      label: '좌상향 고속',
      ball: { id: 'ball_0', x: 700, y: 600, vx: -600, vy: -600, isActive: true },
      blocks: buildGrid(4, 4, 100, 100),
    },
    {
      label: '수직 터널 패턴 재현 (스크린샷 패턴)',
      ball: { id: 'ball_0', x: 480, y: 640, vx: 10, vy: -420, isActive: true },
      blocks: buildGrid(5, 13, 40, 80),
    },
  ];

  for (const { label, ball, blocks } of scenarios) {
    it(`${label}`, () => {
      let current = { ...ball };
      let currentBlocks = blocks.map((b) => ({ ...b }));

      for (let tick = 0; tick < 100; tick++) {
        if (!current.isActive) break;
        if (current.y - BALL_RADIUS > CANVAS_HEIGHT) break;
        if (current.y < 0) break;

        const result = moveBallWithCollisions(current, 1 / 60, currentBlocks);
        current = result.ball;

        // 블록 파괴 반영
        for (const f of result.blockFacts) {
          currentBlocks = currentBlocks.map((b) =>
            b.id === f.blockId ? { ...b, isDestroyed: true } : b,
          );
        }

        // 간단한 벽 반사 (테스트 시뮬레이션용)
        if (current.x - BALL_RADIUS <= 0) current = { ...current, vx: Math.abs(current.vx) };
        if (current.x + BALL_RADIUS >= CANVAS_WIDTH) current = { ...current, vx: -Math.abs(current.vx) };
        if (current.y - BALL_RADIUS <= 0) current = { ...current, vy: Math.abs(current.vy) };

        // 매 tick 후 블록 내부 체크
        for (const block of currentBlocks) {
          if (isBallCenterInsideBlock(current, block)) {
            throw new Error(
              `[${label}] tick=${tick}: ball=(${current.x.toFixed(2)},${current.y.toFixed(2)})` +
              ` inside ${block.id} at (${block.x},${block.y})`,
            );
          }
        }
      }

      // 여기까지 왔으면 터널링 없음
      expect(true).toBe(true);
    });
  }
});

// ---------------------------------------------------------------------------
// 테스트 4: sub-step 경계 조건 — 매우 느린 공도 정상 동작
// ---------------------------------------------------------------------------
describe('sub-step 경계 조건', () => {
  it('비활성 공은 그대로 반환된다', () => {
    const ball: BallState = {
      id: 'ball_0',
      x: 480,
      y: 600,
      vx: 300,
      vy: -300,
      isActive: false,
    };
    const block: BlockState = {
      id: 'b', x: 448, y: 400, remainingHits: 1, isDestroyed: false, definitionId: 'basic',
    };

    const result = moveBallWithCollisions(ball, 1 / 60, [block]);
    expect(result.ball).toBe(ball); // reference equality — unchanged
    expect(result.blockFacts.length).toBe(0);
    expect(result.wallFacts.length).toBe(0);
  });

  it('파괴된 블록은 충돌 판정에서 완전히 제외된다', () => {
    const ball: BallState = {
      id: 'ball_0',
      x: 480,
      y: 300,
      vx: 0,
      vy: -600,
      isActive: true,
    };
    const destroyedBlock: BlockState = {
      id: 'destroyed',
      x: 448,
      y: 200,
      remainingHits: 0,
      isDestroyed: true,
      definitionId: 'basic',
    };

    const result = moveBallWithCollisions(ball, 1 / 60, [destroyedBlock]);
    expect(result.blockFacts.length).toBe(0);
  });

  it('블록 없이 이동 시 dt*v 만큼 정확히 이동한다', () => {
    const ball: BallState = {
      id: 'ball_0',
      x: 480,
      y: 400,
      vx: 100,
      vy: -100,
      isActive: true,
    };
    const dt = 1 / 60;

    const result = moveBallWithCollisions(ball, dt, []);
    expect(result.ball.x).toBeCloseTo(480 + 100 * dt, 5);
    expect(result.ball.y).toBeCloseTo(400 - 100 * dt, 5);
    expect(result.blockFacts.length).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// 테스트 5: 반사 후 재진입 방지
// ---------------------------------------------------------------------------
describe('반사 후 재진입 방지', () => {
  it('블록 상단 반사 후 다음 틱에 같은 블록과 재충돌하지 않는다', () => {
    const block: BlockState = {
      id: 'reentry_block',
      x: 448,
      y: 300,
      remainingHits: 2,
      isDestroyed: false,
      definitionId: 'basic',
    };

    // 공: y=310, vy=-400, dt=1/30 → dy=13.3px → y=296.7
    // 블록 expanded top = 300-8=292 → 296.7 > 292 → 통과하지 않음
    // dt=1/20 → dy=20px → y=290 → expanded top(292) 통과 → 히트
    const ball: BallState = {
      id: 'ball_0',
      x: 480,
      y: 310,
      vx: 0,
      vy: -400,
      isActive: true,
    };

    const dt = 1 / 20;  // 큰 dt로 확실히 블록에 닿게

    // 첫 번째 틱: 충돌 + 반사
    const frame1 = moveBallWithCollisions(ball, dt, [block]);
    expect(frame1.blockFacts.length).toBeGreaterThanOrEqual(1);
    expect(frame1.ball.vy).toBeGreaterThan(0); // 위→아래로 반사

    // 두 번째 틱: 같은 블록과 재충돌 없어야 함 (ball이 이미 위로 이동 중)
    // 반사 후 vy > 0이므로 공이 아래로 이동 → 블록 하단으로 가야 함
    // 그러나 공이 블록 바로 위에서 반사됐으므로 블록 밖에 있어야 함
    const frame2 = moveBallWithCollisions(frame1.ball, dt, [block]);
    expect(isBallCenterInsideBlock(frame2.ball, block)).toBe(false);
  });

  it('공이 블록 expanded AABB 경계에서 시작할 때 올바르게 반사된다', () => {
    // 공이 이미 블록 overlap 상태에서 시작하는 케이스 (이전 틱 누락 시나리오)
    const block: BlockState = {
      id: 'overlap_block',
      x: 448,
      y: 300,
      remainingHits: 2,
      isDestroyed: false,
      definitionId: 'basic',
    };

    // 공이 블록 내부에서 시작 (실제로는 발생하면 안 되지만 방어용)
    const ball: BallState = {
      id: 'ball_0',
      x: 480,
      y: 310,  // 블록 y=300, h=24 → y∈[300,324] 내부
      vx: 0,
      vy: -200,
      isActive: true,
    };

    const dt = 1 / 60;
    const result = moveBallWithCollisions(ball, dt, [block]);

    // 결과 공이 블록 내부에 없어야 함
    expect(isBallCenterInsideBlock(result.ball, block)).toBe(false);
  });
});
