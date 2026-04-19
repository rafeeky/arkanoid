/**
 * CeilingBlockTunnel.test.ts
 *
 * MVP1 회귀 스켈레톤: 천장 반사 직후 블록 통과 버그 (1회/다수 관측).
 *
 * 현재 상태:
 *   - F1 오버레이로 실제 발생 순간 로그를 캡처하지 못해 재현 파라미터 미확정.
 *   - 결정론적 재현 시도를 1회 수행했으나 현재 코드베이스에서는 통과.
 *   - 재현 시 이 파일에 구체 파라미터를 추가하고 it.skip 을 it 으로 변경할 것.
 *
 * 재현 시도 시나리오:
 *   공 위치 (360, 50) → vy = -840 px/s → 천장(y = 8.5 스냅) 반사 →
 *   row 0 블록(y = 80 근처) 에 접근 → 블록 통과 여부 검증.
 *
 * Architecture 참조: architecture.md §18(충돌 정책), MVP1 §13.
 * 관련 파일: TunnelingReproduction.test.ts, SubStepCollision.test.ts
 */

import { describe, it, expect } from 'vitest';
import { moveBallWithCollisions } from './MovementSystem';
import type { BallState } from '../state/BallState';
import type { BlockState } from '../state/BlockState';

const BLOCK_WIDTH = 64;
const BLOCK_HEIGHT = 24;
const BALL_RADIUS = 8;

function makeBlock(id: string, x: number, y: number): BlockState {
  return { id, x, y, remainingHits: 1, isDestroyed: false, definitionId: 'basic' };
}

// ---------------------------------------------------------------------------
// Category: 천장 반사 직후 블록 진입 회귀
// ---------------------------------------------------------------------------

describe('MVP1 regression: 천장 반사 직후 블록 통과 (관측 1~2회)', () => {
  // TODO(mvp3): 재현 실패 — F1 오버레이로 실제 발생 순간 로그 수집 필요.
  // 재현 시 skip 제거하고 구체 파라미터 채울 것.
  it.skip('재현 실패 — F1 오버레이로 실제 발생 순간 로그 수집 후 구체 케이스 추가', () => {
    // 스켈레톤만. 실제 재현 시 아래 파라미터를 수정할 것.
    expect(true).toBe(true);
  });

  // ---------------------------------------------------------------------------
  // 결정론적 재현 시도 1: 천장 스냅 후 row 0 블록 통과 여부
  //
  // 시나리오:
  //   공이 (360, BALL_RADIUS+0.5) 에 있고 vy = +840 (아래 방향) 으로
  //   1 프레임(dt = 1/60) 이동 시 row 0 블록(y=80)과 충돌하는지 확인.
  //   (천장 반사 직후 상태: y ≈ 8.5, vy 부호가 양수로 전환된 직후)
  // ---------------------------------------------------------------------------
  it('ball near ceiling (vy > 0) → row 0 block hit without tunneling', () => {
    const ball: BallState = {
      id: 'ball_0',
      x: 360,
      // BALL_RADIUS + PUSH_OUT_EPSILON = 8.5 (천장 반사 직후 위치)
      y: 8.5,
      vx: 420,
      vy: 840, // 천장 반사 후 아래로
      isActive: true,
    };

    // row 0 블록 — 볼 경로에 직접 놓음
    const block = makeBlock('b_0', 360 - BLOCK_WIDTH / 2, 80);
    const blocks = [block];

    // 여러 틱 시뮬 (천장→블록 사이 거리: 80 - 8.5 = 71.5px, speed=840px/s → ~0.085s)
    const DT = 1 / 60;
    let current = ball;
    let hitCount = 0;
    let tunnelDetected = false;

    for (let tick = 0; tick < 10; tick++) {
      const result = moveBallWithCollisions(current, DT, blocks);
      hitCount += result.blockFacts.filter((f) => f.blockId === 'b_0').length;
      current = result.ball;

      // 블록 내부 진입 여부 (공 중심이 블록 AABB 안에 있으면 터널링)
      if (
        current.x > block.x &&
        current.x < block.x + BLOCK_WIDTH &&
        current.y > block.y &&
        current.y < block.y + BLOCK_HEIGHT
      ) {
        tunnelDetected = true;
        break;
      }
    }

    // 블록 통과(터널링) 없어야 함
    expect(tunnelDetected).toBe(false);
    // 블록에 최소 1회 충돌해야 함 (실제로 경로상에 있으므로)
    expect(hitCount).toBeGreaterThanOrEqual(1);
  });

  // ---------------------------------------------------------------------------
  // 결정론적 재현 시도 2: 고속 공 천장→블록 1틱 이내 도달 여부
  //
  // 시나리오:
  //   vy = -2400 (극단적 고속) → 천장 반사 직후 y ≈ 8.5, vy = +2400 →
  //   row 0 블록까지 (80 - 8.5 = 71.5px), dt = 1/30 → 이동 거리 = 80px
  //   공이 블록을 뛰어넘지 않는지 sub-step이 보장하는지 확인.
  // ---------------------------------------------------------------------------
  it('high-speed ball (2400 px/s) near ceiling → row 0 block not skipped', () => {
    const ball: BallState = {
      id: 'ball_0',
      x: 360,
      y: 8.5,
      vx: 0,
      vy: 2400, // 극단적 고속 — SUB_STEP_SIZE=4 기준 최소 ceil(80/4)=20 스텝
      isActive: true,
    };

    // row 0 블록 — 볼 경로 정중앙
    const block = makeBlock('b_0', 360 - BLOCK_WIDTH / 2, 80);
    const blocks = [block];

    // dt = 1/30 (느린 프레임)
    const result = moveBallWithCollisions(ball, 1 / 30, blocks);

    // 블록 AABB 내부에 공이 위치해서는 안 됨
    const bx = block.x;
    const by = block.y;
    const inside =
      result.ball.x > bx &&
      result.ball.x < bx + BLOCK_WIDTH &&
      result.ball.y > by &&
      result.ball.y < by + BLOCK_HEIGHT;

    expect(inside).toBe(false);

    // 충돌 사실 발생 여부 — 경로상에 블록이 있으므로 최소 1회
    const blockHit = result.blockFacts.some((f) => f.blockId === 'b_0');
    expect(blockHit).toBe(true);
  });
});
