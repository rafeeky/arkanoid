/**
 * TunnelingRootCause.test.ts
 *
 * 터널링 Root Cause 재현 테스트.
 *
 * 확정된 버그 경로 (의심 1 + 3 복합):
 *
 * 한 틱 내에서 다음이 순서대로 발생할 때:
 *   1. 공이 블록 A를 반사 (hitBlockIds.add('A'), vy 반전)
 *   2. 남은 dt가 충분히 길어 상단 벽을 반사 (hitWalls.add('top'), vy 재반전)
 *   3. 공이 다시 아래로 이동 → 블록 A 방향
 *   4. sweep → blockHit = 블록 A, hitBlockIds.has('A') = true → blockFirst = false
 *   5. hitWalls.has('top') = true → wallFirst = false
 *   6. !wallFirst && !blockFirst → free-advance → 블록 A 내부 진입!
 *
 * 이 버그는 MAX_BOUNCE_COUNT 이전에도 발생 가능 (bounce 2회로 충분).
 */

import { describe, it, expect } from 'vitest';
import { moveBallWithCollisions } from './MovementSystem';
import type { BallState } from '../state/BallState';
import type { BlockState } from '../state/BlockState';

const BLOCK_WIDTH = 64;
const BLOCK_HEIGHT = 24;
const BALL_RADIUS = 8;
const CANVAS_HEIGHT = 720;

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
// Root Cause 재현 1: 블록 반사 → 벽 반사 → 블록 재접근 시나리오
//
// 블록: y=40 (상단 근처), expanded top = 32
// 벽: y=0 (상단), expanded boundary = BALL_RADIUS=8
//
// 공 시작: x=block_center_x, y=60, vy=-매우 빠름
// 한 틱에:
//   1. y=60 → (32): 블록 expanded top → t=(60-32)/(vy*dt) 반사 vy → +
//   2. 남은 dt로 위 → 상단 벽(y=8) → 반사 vy → -
//   3. 남은 dt로 아래 → 다시 y=32에 도달 → 블록 A hit 시도 → skip!
// ---------------------------------------------------------------------------
describe('Root Cause 재현: 블록→벽→블록 재접근 시나리오', () => {
  it('블록 반사 후 상단 벽 반사 후 다시 같은 블록에 접근 시 블록 내부 진입 금지', () => {
    // 블록을 상단 가까이 배치
    // 블록: y=36 → expanded top = 36-8=28
    // 상단 벽 expanded boundary: y=BALL_RADIUS=8
    // 공: y=48 (블록 expanded top(28) 아래), vy=-3000
    // dt=0.016: 3000*0.016=48px
    // 블록 top 도달: t=(48-28)/48=0.417
    // 반사 후 vy=+3000, remaining=(1-0.417)*0.016=0.00933s
    // 공 위치: y=28-0.5=27.5, vy=+3000 (아래로)
    // 아래로 이동: 3000*0.00933=28px → y=27.5+28=55.5
    // → 블록 expanded top(28) < 55.5 < expanded bottom(36+24+8=68) → 블록 내부!

    // 위의 계산에서 vy 방향을 재확인:
    // 공 y=48, vy=-3000 (위쪽): expanded top=28, 공이 위로 이동 → 블록 top에서 반사
    // 반사 후 vy=+3000 (아래쪽): 공이 아래로 이동 → 다시 블록 방향
    // 이 경우 hitBlockIds에 이미 이 블록이 있으므로 skip → free-advance?

    // 그러나 실제로는 vy=+3000이면 공이 아래로 이동하므로
    // 블록 expanded top(28)에서 이미 반사가 일어났고 공은 y=27.5에서 아래로 이동
    // 아래로 28px → y=55.5: 블록 y=36, bottom=60 → 55.5 > 36 이고 55.5 < 60 → 내부!

    // 실제로는 이 상황이 발생하지 않아야 함:
    // 반사 후 vy=+3000으로 아래 이동 시, sweepBallVsBlocks는 블록 A expanded bottom(68)을 확인
    // 공 y=27.5, vy=+3000*remaining → 블록 A의 top(28)보다 위에 있고 vy>0이므로
    // 블록 A expanded top(28)에 다시 진입 → sweep이 감지해야 함 → hitBlockIds.has(A) → skip!

    // 이것이 버그다!

    const block: BlockState = {
      id: 'block_A',
      x: 460,
      y: 36,  // expanded top = 28
      remainingHits: 2,  // 파괴되지 않음
      isDestroyed: false,
      definitionId: 'basic',
    };

    // 공: y=48, vy=-3000 (위로, 블록 방향)
    // dt를 크게 잡아서 반사 후 다시 같은 블록 범위로 돌아올 정도의 남은 시간 확보
    const ball: BallState = {
      id: 'ball_0',
      x: 492,  // 블록 중앙
      y: 48,
      vx: 0,
      vy: -3000,
      isActive: true,
    };

    const result = moveBallWithCollisions(ball, 0.016, [block]);

    const inside = isBallInsideBlock(result.ball, block);
    if (inside) {
      throw new Error(
        `[ROOT CAUSE 재현 성공] 블록 내부 진입 확인:` +
        ` ball.y=${result.ball.y.toFixed(2)} inside block(y=${block.y},bottom=${block.y + BLOCK_HEIGHT})` +
        ` blockFacts=${JSON.stringify(result.ball)}`,
      );
    }
    expect(inside).toBe(false);
  });

  it('벽 근처 블록에서 실제 top-wall-block 재진입 패턴 — 정밀 계산', () => {
    // 정밀 계산:
    // 블록: y=20, expanded top=12
    // 공: y=30, vy=-5000, dt=0.016
    // 5000*0.016=80px
    // 블록 top(y=12) 도달: t=(30-12)/(5000*0.016)=(18/80)=0.225
    // 반사 후 vy=+5000, remaining=(1-0.225)*0.016=0.012s
    // 공 위치: y=12-0.5=11.5, vy=+5000 (아래)
    // 아래로: 5000*0.012=60px → y=71.5
    // 블록 expanded bottom = 20+24+8=52 → 71.5 > 52 → 블록 아래를 통과
    // 이 시나리오에서는 블록 내부 통과 안 함 (공이 아래로 52px 이상 이동)

    // 버그 재현을 위한 올바른 파라미터:
    // 블록 top(y_top=T), remaining distance = D
    // 반사 후 공이 D 만큼 아래로 이동: y = (T - eps) + D
    // 블록 내부: T < y < T + BLOCK_HEIGHT
    // → T < T - eps + D < T + 24
    // → eps < D < 24 + eps
    // → D는 작아야 함 (24px 이내)

    // 즉, 반사 후 남은 이동 거리가 24px 이내 + 같은 블록 재접근 조건
    // 공: y=T+delta (delta 작게), vy=-V
    // dt=0.016: V*0.016px 이동
    // 블록 top 도달: t=(T+delta-T)/(V*0.016)=delta/(V*0.016)
    // remaining = (1 - delta/(V*0.016))*0.016
    // 남은 이동 = V * (1 - delta/(V*0.016)) * 0.016 = V*0.016 - delta
    // 조건: delta < V*0.016 - delta < 24 → 2delta < V*0.016 < 24 + delta

    // delta=2, V*0.016=10 → V=625, 남은 이동=8
    // 블록: y=100, top=100, expanded top=92
    // 공: y=94 (= T_expanded + 2), vy=-625
    // 625*0.016=10px
    // 블록 expanded top 도달: t=(94-92)/10=0.2
    // 반사 후 vy=+625, remaining=(1-0.2)*0.016=0.0128s
    // 공: y=92-0.5=91.5, vy=+625
    // 아래로: 625*0.0128=8px → y=91.5+8=99.5
    // 블록 y=100 → 99.5 < 100 → 블록 위 (내부 아님!)
    // 아슬아슬하게 블록 위에 있음

    // delta=1, V=750, V*0.016=12
    // 공: y=T_expanded+1=93 (블록 expanded top=92, block y=100)
    // 750*0.016=12px 이동
    // t=(93-92)/12=0.0833
    // 반사 vy=+750, remaining=0.9167*0.016=0.01467s
    // 공: y=92-0.5=91.5, 아래로: 750*0.01467=11px → y=102.5
    // 블록 y=100, bottom=124 → 100 < 102.5 < 124 → 블록 내부!

    const block: BlockState = {
      id: 'precise_block',
      x: 460,
      y: 100,
      remainingHits: 2,
      isDestroyed: false,
      definitionId: 'basic',
    };

    // 공: y=93 (블록 expanded top=92에서 1px 안쪽)
    // vy=-750, dt=0.016
    const ball: BallState = {
      id: 'ball_0',
      x: 492,
      y: 93,
      vx: 0,
      vy: -750,
      isActive: true,
    };

    const result = moveBallWithCollisions(ball, 0.016, [block]);

    const inside = isBallInsideBlock(result.ball, block);
    if (inside) {
      throw new Error(
        `[ROOT CAUSE 재현 성공] 단일 블록 내부 진입:` +
        ` ball=(${result.ball.x.toFixed(2)}, ${result.ball.y.toFixed(2)})` +
        ` vy=${result.ball.vy.toFixed(0)}` +
        ` block y=[${block.y}, ${block.y + BLOCK_HEIGHT}]`,
      );
    }
    expect(inside).toBe(false);
  });

  it('정밀 계산으로 hitBlockIds skip 유발 — delta=0.5px 케이스', () => {
    // 공이 블록 expanded top에서 0.5px 안쪽에서 시작
    // vy=-750으로 위로 이동 → t 매우 작게 → 반사 후 큰 remaining
    // 반사 후 vy=+750로 아래 이동 → 다시 블록 내부 방향
    // hitBlockIds에 이미 이 블록이 있으므로 free-advance 진입 가능

    const block: BlockState = {
      id: 'halfpx_block',
      x: 460,
      y: 100,
      remainingHits: 2,
      isDestroyed: false,
      definitionId: 'basic',
    };

    // expanded top = 100-8=92
    // 공: y=92.5 (expanded top에서 0.5px 안쪽), vy=-750
    // 750*0.016=12px
    // t=(92.5-92)/12=0.0417
    // 반사: vy=+750, remaining=(1-0.0417)*0.016=0.01533s
    // 공: y=92-0.5=91.5, vy=+750
    // 아래로: 750*0.01533=11.5px → y=103
    // 블록 y=100, bottom=124 → 100 < 103 < 124 → 내부!
    const ball: BallState = {
      id: 'ball_0',
      x: 492,
      y: 92.5,  // expanded top에서 0.5px 안쪽
      vx: 0,
      vy: -750,
      isActive: true,
    };

    const result = moveBallWithCollisions(ball, 0.016, [block]);

    const inside = isBallInsideBlock(result.ball, block);
    if (inside) {
      // 이 에러가 발생하면 버그가 재현된 것
      throw new Error(
        `[ROOT CAUSE 확인] hitBlockIds skip → free-advance 버그:` +
        ` ball=(${result.ball.x.toFixed(3)}, ${result.ball.y.toFixed(3)})` +
        ` vy=${result.ball.vy.toFixed(0)}` +
        ` blockFacts=${result.blockFacts.length}개` +
        ` block y=[${block.y}, ${block.y + BLOCK_HEIGHT}]`,
      );
    }
    expect(inside).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// Root Cause 재현 2: alreadyInside → remaining=0 설정의 부작용
//
// alreadyInside 케이스에서 remaining=0을 설정하는데,
// 이는 공이 이미 블록 내부에 있을 때 올바른 처리이다.
// 그러나 push-out 방향이 잘못되면 공이 여전히 블록 내부에 위치할 수 있음.
// ---------------------------------------------------------------------------
describe('alreadyInside 케이스 push-out 올바름 확인', () => {
  it('공이 블록 expanded AABB 내부에서 시작할 때 반사 후 외부에 위치한다', () => {
    const block: BlockState = {
      id: 'inside_block',
      x: 460,
      y: 100,
      remainingHits: 1,
      isDestroyed: false,
      definitionId: 'basic',
    };

    // 공이 expanded AABB 내부에서 다양한 방향으로 시작
    const testCases: Array<{ x: number; y: number; vx: number; vy: number; label: string }> = [
      // expanded AABB: x=[452, 532], y=[92, 132]
      { x: 492, y: 95, vx: 0, vy: -300, label: 'top-inside moving up' },
      { x: 492, y: 129, vx: 0, vy: 300, label: 'bottom-inside moving down' },
      { x: 455, y: 112, vx: -300, vy: 0, label: 'left-inside moving left' },
      { x: 529, y: 112, vx: 300, vy: 0, label: 'right-inside moving right' },
      { x: 492, y: 95, vx: 100, vy: -300, label: 'top-inside diagonal' },
      { x: 455, y: 95, vx: -200, vy: -200, label: 'corner-inside diagonal' },
    ];

    for (const tc of testCases) {
      const ball: BallState = { id: 'ball_0', ...tc, isActive: true };
      const result = moveBallWithCollisions(ball, 0.016, [block]);

      const inside = isBallInsideBlock(result.ball, block);
      if (inside) {
        throw new Error(
          `[${tc.label}] push-out 실패: ball=(${result.ball.x.toFixed(2)}, ${result.ball.y.toFixed(2)})` +
          ` block y=[${block.y}, ${block.y + BLOCK_HEIGHT}]`,
        );
      }
      expect(inside).toBe(false);
    }
  });
});

// ---------------------------------------------------------------------------
// Root Cause 재현 3: free-advance 구간에 새 블록이 있는 케이스
//
// MAX_BOUNCE_COUNT=4 후 remaining>0이고 경로 상에 새 블록이 있을 때.
// 단, 기존 hitBlockIds에 없는 새 블록이어도 sweep이 찾지 못하면 통과.
// ---------------------------------------------------------------------------
describe('free-advance 구간 새 블록 통과 확인', () => {
  it('bounce 루프 외부 remaining 구간에 새 블록이 있을 때 통과하지 않는다', () => {
    // 4번의 bounce를 유발하는 블록 배치:
    // 블록 1~4: 상하 교번 배치로 bounce 4회 유발
    // 블록 5: 경로 끝에 위치 (free-advance 구간)
    // 실제로 MAX_BOUNCE_COUNT=4에서 5번째가 문제

    // 간단화: 블록 1개만 있고, 반사 후 남은 경로에 두 번째 블록 배치
    // 공: y=150, vy=-2000, 블록1: y=100, 블록2: y=50
    // 블록1 expanded top = 92, 블록2 expanded bottom = 50+24+8=82
    // dt=0.016: 32px 이동
    // 블록1 top 도달: t=(150-92)/32=1.8125 > 1 → 블록1에 닿지 않음!

    // 공이 이미 블록1과 2 사이에서 시작하는 케이스로 변경:
    const block1: BlockState = {
      id: 'blk1', x: 460, y: 100, remainingHits: 2, isDestroyed: false, definitionId: 'basic',
    };
    const block2: BlockState = {
      id: 'blk2', x: 460, y: 64, remainingHits: 1, isDestroyed: false, definitionId: 'basic',
    };
    // 블록1 expanded top=92, 블록2 expanded bottom=64+24+8=96
    // → 두 블록이 expanded AABB에서 겹침!
    // 공: y=94 (블록1 expanded AABB 내부이자 블록2 expanded AABB 내부)
    // vy=+200 (아래로)

    const ball: BallState = {
      id: 'ball_0',
      x: 492,
      y: 94,
      vx: 0,
      vy: 200,
      isActive: true,
    };

    const result = moveBallWithCollisions(ball, 0.016, [block1, block2]);

    expect(isBallInsideBlock(result.ball, block1)).toBe(false);
    expect(isBallInsideBlock(result.ball, block2)).toBe(false);
  });

  it('high-speed 공이 4개 블록 연속 반사 후 5번째 블록(새 블록)을 통과하지 않는다', () => {
    // 블록 5개 수직 배치, 공이 아래서 위로 초고속 진입
    // 각 블록 expanded AABB가 겹치지 않도록 충분한 간격
    const blocks: BlockState[] = [];
    for (let i = 0; i < 5; i++) {
      blocks.push({
        id: `five_${i}`,
        x: 460,
        // gap=20px (expanded top/bottom 간 충분한 거리)
        y: 400 - i * (BLOCK_HEIGHT + 20),
        remainingHits: 2,
        isDestroyed: false,
        definitionId: 'basic',
      });
    }
    // y 위치: 400, 356, 312, 268, 224
    // expanded top: 392, 348, 304, 260, 216

    const ball: BallState = {
      id: 'ball_0',
      x: 492,
      y: 450,
      vx: 0,
      vy: -8000, // 매우 빠름: 128px/tick
      isActive: true,
    };

    let current = { ...ball };
    let currentBlocks = blocks.map((b) => ({ ...b }));
    let tunnelDetected = false;
    let detail = '';

    for (let tick = 0; tick < 20; tick++) {
      const result = moveBallWithCollisions(current, 0.016, currentBlocks);
      current = result.ball;

      for (const f of result.blockFacts) {
        // remainingHits를 감소시키되 2번 맞아야 파괴
        currentBlocks = currentBlocks.map((b) => {
          if (b.id !== f.blockId) return b;
          const newHits = b.remainingHits - 1;
          return { ...b, remainingHits: newHits, isDestroyed: newHits <= 0 };
        });
      }

      for (const b of currentBlocks) {
        if (isBallInsideBlock(current, b)) {
          tunnelDetected = true;
          detail = `tick=${tick} ball.y=${current.y.toFixed(2)} inside ${b.id}(y=${b.y})`;
          break;
        }
      }

      if (tunnelDetected) break;
      if (current.y < 0) break;
    }

    if (tunnelDetected) {
      throw new Error(`5번째 블록 통과 감지: ${detail}`);
    }
    expect(tunnelDetected).toBe(false);
  });
});
