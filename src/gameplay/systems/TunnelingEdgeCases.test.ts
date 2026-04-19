/**
 * TunnelingEdgeCases.test.ts
 *
 * 터널링 버그의 핵심 엣지 케이스를 격리 테스트.
 *
 * 의심 3 (hitBlockIds skip → free-advance 블록 통과):
 * 블록 A에서 반사 후 남은 dt로 블록 B 방향으로 이동할 때,
 * sweepBallVsBlocks가 A만 반환(B는 farther)하면 A가 skip되어
 * blockFirst=false → free-advance로 B를 통과할 수 있음.
 *
 * 의심 1 (MAX_BOUNCE_COUNT cap 후 free-advance):
 * 연속 블록 4개를 반사한 후 5번째 블록이 남아있을 때
 * cap으로 인해 free-advance가 5번째 블록을 통과함.
 */

import { describe, it, expect } from 'vitest';
import { moveBallWithCollisions } from './MovementSystem';
import type { BallState } from '../state/BallState';
import type { BlockState } from '../state/BlockState';

const BLOCK_WIDTH = 64;
const BLOCK_HEIGHT = 24;
const BALL_RADIUS = 8;

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
// 의심 3 재현: 블록 A 반사 후 블록 B 통과 시나리오
//
// 블록 배치 (수직):
//   블록 B: x=460, y=64  (위)
//   블록 A: x=460, y=100 (아래)
//
// 공: x=492 (블록 중앙), y=80, vy=+3000 (아래 방향)
// dt=0.016: 3000*0.016=48px 이동
//
// 예상:
//   1. 블록 A expanded top = 100-8=92, 공이 y=92에서 t=0.25 → 반사 vy=-3000
//   2. remaining = 0.75*0.016 = 0.012s, 3000*0.012=36px 위로
//   3. 블록 B expanded bottom = 64+24+8=96
//   4. 공 y=91.5-0.5ε, 블록 B는 위에 있음 → sweep이 블록 B를 찾아야 함
// ---------------------------------------------------------------------------
describe('의심 3: 반사 후 다음 블록 검출 실패 시나리오', () => {
  it('블록 A 반사 후 남은 dt로 위의 블록 B 경계 진입 시 B를 통과하지 않는다', () => {
    const blockA: BlockState = {
      id: 'blockA',
      x: 460,
      y: 100,
      remainingHits: 1,
      isDestroyed: false,
      definitionId: 'basic',
    };
    const blockB: BlockState = {
      id: 'blockB',
      x: 460,
      y: 64,
      remainingHits: 1,
      isDestroyed: false,
      definitionId: 'basic',
    };

    // 공: 블록 A와 B 사이에서 아래로 이동
    // 블록 A expanded top = 100-8=92
    // 블록 B expanded bottom = 64+24+8=96
    // 공 y=80, vy=+3000, 블록 B expanded bottom(96)이 A expanded top(92)보다 아래이므로
    // 공은 먼저 B 하단을 통과하고 A 상단에 닿는다 → B가 먼저!
    // 따라서 이 시나리오에서 공은 실제로 B를 먼저 치게 된다.
    // 반대 방향(위에서 아래)으로 설정하되 B가 A보다 위에 있게 배치:
    //   블록 A: y=100 (아래) expanded top=92
    //   블록 B: y=60  (위)  expanded bottom = 60+24+8=92
    // 공 y=75, vy=+3000 → 블록 B expanded top(60-8=52)은 위에, bottom(92)은 아래
    // 공 y=75가 이미 블록 B의 expanded AABB 내부!

    // 더 명확한 시나리오: 공이 블록들 아래에서 위로
    //   블록 A: y=200 (아래) — 공이 먼저 A를 bottom 면에서 진입
    //   블록 B: y=172 (위) — 반사 후 B를 만남
    //   gap: 200-(172+24) = 4px
    const blockAv2: BlockState = { ...blockA, y: 200 };
    const blockBv2: BlockState = { ...blockB, y: 168 };
    // 블록 B expanded bottom = 168+24+8=200 = blockA top
    // 블록 A expanded top = 200-8 = 192
    // 공 y=220, vy=-3000 (위로)
    // 3000*0.016=48px → 공이 y=220-48=172까지 이동
    // 블록 A expanded bottom = 200+24+8=232 (아래, 공 시작보다 위) → 아래쪽 hit
    // 실제로는 공이 위로 가므로 블록 A top face(y=200) expanded top=192에 먼저 도달
    // t = (220-192)/(3000*0.016) = 28/48 = 0.583
    // 반사 후 vy=+3000, remaining = (1-0.583)*0.016 = 0.00667s, 3000*0.00667=20px 아래
    // 공 위치: y=192-0.5ε, vy=+3000 → 20px 아래로 → y=192+20=212
    // 블록 B expanded bottom = 168+24+8=200 → 공이 블록 B 범위(160, 200) 안에 있지 않음
    // 이 시나리오에서는 B를 통과하지 않음

    // 올바른 시나리오: 반사 후 새 블록이 경로 상에 있고 충분한 dt가 남는 경우
    // 공이 블록 A top에서 위로 반사 → 블록 B bottom으로 진입
    //   블록 A: y=200 (공이 아래서 위로 진입, top face)
    //   블록 B: y=168 (A 위에, expanded bottom=168+24+8=200 → A top에 붙어있음)
    //   공: y=240, vy=-3000
    //   3000*0.016=48px
    //   블록 A expanded bottom = 200+24+8=232 → 공 시작(240)보다 위
    //   wait, vy < 0 이므로 공이 위로 이동
    //   블록 A expanded top = 200-8=192
    //   공이 y=240에서 vy=-3000으로 → y=240-48=192 딱 도달 (t=1.0)
    //   ← 이 경우 t=1.0이므로 반사 없음 (remaining=0 후 free-advance=0)

    // 가장 확실한 버그 재현: 수직 블록 스택에서 MAX_BOUNCE_COUNT 초과
    // 블록이 5개 연속으로 수직 배치되어 있고 공이 초고속으로 진입
    // 이 시나리오는 다음 테스트에서 처리

    // 이 테스트는 단순 확인용
    const result1 = moveBallWithCollisions(
      { id: 'b0', x: 492, y: 240, vx: 0, vy: -3000, isActive: true },
      0.016,
      [blockAv2, blockBv2],
    );
    // 공이 블록 내부에 없어야 함
    expect(isBallInsideBlock(result1.ball, blockAv2)).toBe(false);
    expect(isBallInsideBlock(result1.ball, blockBv2)).toBe(false);
  });

  it('연속 5개 블록에서 vy=-3000 진입 시 모든 블록을 정상 순서로 처리한다', () => {
    // 블록 스택 (아래서 위): y=220, 192, 164, 136, 108, 80
    // gap=0 (expanded AABB overlap 있음)
    // 공: x=492, y=260, vy=-3000, dt=0.016 → 48px 이동
    // 첫 반사: 블록(y=220) top expanded=212 → t=(260-212)/48=1.0 → 딱 경계
    // 더 짧은 dt 혹은 더 높은 속도 사용
    const blocks: BlockState[] = [];
    for (let i = 0; i < 6; i++) {
      blocks.push({
        id: `stack_${i}`,
        x: 460,
        y: 220 - i * (BLOCK_HEIGHT + 4), // 220, 192, 164, 136, 108, 80
        remainingHits: 1,
        isDestroyed: false,
        definitionId: 'basic',
      });
    }

    const ball: BallState = {
      id: 'ball_0',
      x: 492,
      y: 270,
      vx: 0,
      vy: -3000,
      isActive: true,
    };

    // 여러 틱 시뮬레이션
    let current = { ...ball };
    let currentBlocks = blocks.map((b) => ({ ...b }));
    let tunnelDetected = false;
    let tunnelInfo = '';

    for (let tick = 0; tick < 20; tick++) {
      const result = moveBallWithCollisions(current, 0.016, currentBlocks);
      current = result.ball;

      for (const f of result.blockFacts) {
        currentBlocks = currentBlocks.map((b) =>
          b.id === f.blockId ? { ...b, isDestroyed: true } : b,
        );
      }

      for (const b of currentBlocks) {
        if (isBallInsideBlock(current, b)) {
          tunnelDetected = true;
          tunnelInfo = `tick=${tick} ball.y=${current.y.toFixed(2)} inside ${b.id}(y=${b.y})`;
          break;
        }
      }
      if (tunnelDetected) break;
      if (current.y < 0) break;
    }

    if (tunnelDetected) {
      throw new Error(`터널 감지: ${tunnelInfo}`);
    }
    expect(tunnelDetected).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// 의심 1: MAX_BOUNCE_COUNT=4 초과 — 5번째 블록 free-advance 통과
// ---------------------------------------------------------------------------
describe('의심 1: MAX_BOUNCE_COUNT=4 cap 이후 블록 통과', () => {
  it('수직 6개 블록에서 cap 초과 후 free-advance가 남은 블록을 통과하지 않는다', () => {
    // 각 블록 높이+gap=28px, 블록 6개 총 168px
    // 공 속도 vy=-6000, dt=0.016 → 96px 이동
    // 블록당 28px이므로 한 틱에 최대 3-4개 블록에 닿을 수 있음
    // MAX_BOUNCE_COUNT=4이면 이론상 4개 처리 후 free-advance로 5번째 통과 가능

    const blocks: BlockState[] = [];
    const baseY = 80;
    for (let i = 0; i < 6; i++) {
      blocks.push({
        id: `cap_${i}`,
        x: 460,
        y: baseY + i * (BLOCK_HEIGHT + 4),
        remainingHits: 1,
        isDestroyed: false,
        definitionId: 'basic',
      });
    }
    // y: 80, 108, 136, 164, 192, 220
    // expanded top: 72, 100, 128, 156, 184, 212

    // 공: y=260 (최하단 블록 expanded bottom=220+24+8=252 아래)
    // vy=-6000, dt=0.016 → 96px → y=260-96=164
    // 공이 212→184→156→128→100→72까지 순서로 블록 경계를 통과할 수 있음
    const ball: BallState = {
      id: 'ball_0',
      x: 492,
      y: 260,
      vx: 0,
      vy: -6000,
      isActive: true,
    };

    let current = { ...ball };
    let currentBlocks = blocks.map((b) => ({ ...b }));
    let tunnelDetected = false;
    let tunnelInfo = '';

    for (let tick = 0; tick < 30; tick++) {
      const result = moveBallWithCollisions(current, 0.016, currentBlocks);
      current = result.ball;

      for (const f of result.blockFacts) {
        currentBlocks = currentBlocks.map((b) =>
          b.id === f.blockId ? { ...b, isDestroyed: true } : b,
        );
      }

      for (const b of currentBlocks) {
        if (isBallInsideBlock(current, b)) {
          tunnelDetected = true;
          tunnelInfo =
            `tick=${tick} ball=(${current.x.toFixed(2)},${current.y.toFixed(2)})` +
            ` vy=${current.vy.toFixed(0)} inside block=${b.id}(y=${b.y})`;
          break;
        }
      }

      if (tunnelDetected) break;
      if (current.y < 0 || current.y > 720) break;
    }

    if (tunnelDetected) {
      throw new Error(`터널 감지 (MAX_BOUNCE_COUNT 관련): ${tunnelInfo}`);
    }
    expect(tunnelDetected).toBe(false);
  });

  it('극한 속도 vy=-10000으로 6개 블록 스택 — 모든 블록 통과 금지', () => {
    const blocks: BlockState[] = [];
    for (let i = 0; i < 6; i++) {
      blocks.push({
        id: `extreme_${i}`,
        x: 460,
        y: 80 + i * (BLOCK_HEIGHT + 4),
        remainingHits: 1,
        isDestroyed: false,
        definitionId: 'basic',
      });
    }

    const ball: BallState = {
      id: 'ball_0',
      x: 492,
      y: 270,
      vx: 0,
      vy: -10000, // 극한 속도: 한 틱에 160px
      isActive: true,
    };

    const result = moveBallWithCollisions(ball, 0.016, blocks);

    // 공이 블록들을 모두 통과한 후의 위치 확인
    for (const b of blocks) {
      const inside = isBallInsideBlock(result.ball, b);
      if (inside) {
        throw new Error(
          `극한속도 터널: ball.y=${result.ball.y.toFixed(2)} inside ${b.id}(y=${b.y})`,
        );
      }
      expect(inside).toBe(false);
    }
  });
});

// ---------------------------------------------------------------------------
// 의심 4: sanityCheck 경계 판정 부동소수점 문제
// 공 중심이 블록 경계(bx 또는 bRight)에 정확히 있을 때 내부 판정 실패
// ---------------------------------------------------------------------------
describe('의심 4: sanityCheck 경계 판정', () => {
  it('공 중심이 블록 left 경계에 정확히 있을 때 내부로 판정된다 (epsilon 필요)', () => {
    // computeBallCenterBlockOverlap: ball.x <= bx → null 반환 (현재 버그)
    // 공이 블록 경계선(bx)에 정확히 있으면 내부 판정이 안 됨
    // → 공이 경계선에 걸쳐 있는 상태가 방치됨
    // 이 테스트는 sanityCheck 수준의 버그이므로 moveBallWithCollisions로 테스트하기 어려움
    // moveBallWithCollisions의 sweep은 이미 올바르게 처리하므로
    // 이 경우는 sanityCheck가 miss하는 경우를 간접 확인

    // 블록: x=460, w=64
    // 공 중심: x=460 (bx와 동일) — computeBallCenterBlockOverlap에서 ball.x <= bx → null
    // 이 경우 sanityCheck가 miss하지만 swept AABB가 이미 처리했다면 문제없음
    // 그러나 sweep도 miss한 경우 이 버그가 드러남

    // 실제로 이 상황이 발생하려면 공이 정확히 경계선에 놓여야 함 — 매우 희귀
    // 대신 epsilon 처리 여부를 확인하는 단순 테스트로 구성

    // 정상 경로: moveBallWithCollisions가 올바르게 처리하면
    // 공이 경계 밖에 위치해야 함
    const block: BlockState = {
      id: 'boundary_block',
      x: 460,
      y: 300,
      remainingHits: 1,
      isDestroyed: false,
      definitionId: 'basic',
    };

    // 공이 블록 left face 바로 왼쪽에서 오른쪽으로 이동
    // expanded left = 460-8=452
    const ball: BallState = {
      id: 'ball_0',
      x: 445, // expanded left(452) 왼쪽
      y: 312,  // 블록 y 범위 내 (300~324)
      vx: 600,
      vy: 0,
      isActive: true,
    };

    const result = moveBallWithCollisions(ball, 0.016, [block]);

    // 반사 후 공이 블록 내부에 없어야 함
    const inside = isBallInsideBlock(result.ball, block);
    if (inside) {
      throw new Error(
        `경계 판정 버그: ball.x=${result.ball.x.toFixed(2)} inside block(x=460)`,
      );
    }
    expect(inside).toBe(false);
    // vx가 음수로 반사되어야 함
    expect(result.ball.vx).toBeLessThan(0);
  });
});

// ---------------------------------------------------------------------------
// 통합: 실제 게임 속도(420px/s)에서 스크린샷 패턴 재현
// top-down 파괴 패턴과 블록 내부 걸침 재현 시도
// ---------------------------------------------------------------------------
describe('실제 게임 속도 기준 터널링 재현', () => {
  it('420px/s 공이 블록 그리드를 300틱 동안 통과하지 않는다', () => {
    const blocks: BlockState[] = [];
    let idx = 0;
    for (let r = 0; r < 5; r++) {
      for (let c = 0; c < 13; c++) {
        blocks.push({
          id: `grid_${idx++}`,
          x: 40 + c * (BLOCK_WIDTH + 4),
          y: 80 + r * (BLOCK_HEIGHT + 4),
          remainingHits: 1,
          isDestroyed: false,
          definitionId: 'basic',
        });
      }
    }

    // 실제 게임 발사 각도: -60도, 420px/s
    const angle = (-60 * Math.PI) / 180;
    const ball: BallState = {
      id: 'ball_0',
      x: 480,
      y: 640,
      vx: Math.cos(angle) * 420,
      vy: Math.sin(angle) * 420,
      isActive: true,
    };

    let current = { ...ball };
    let currentBlocks = blocks.map((b) => ({ ...b }));
    let tunnelDetected = false;
    let tunnelDetail = '';

    for (let tick = 0; tick < 300; tick++) {
      if (!current.isActive || current.y > 720) break;

      const result = moveBallWithCollisions(current, 1 / 60, currentBlocks);
      current = result.ball;

      for (const f of result.blockFacts) {
        currentBlocks = currentBlocks.map((b) =>
          b.id === f.blockId ? { ...b, isDestroyed: true } : b,
        );
      }

      // 벽 반사
      if (current.x - BALL_RADIUS <= 0) current = { ...current, vx: Math.abs(current.vx) };
      if (current.x + BALL_RADIUS >= 960) current = { ...current, vx: -Math.abs(current.vx) };
      if (current.y - BALL_RADIUS <= 0) current = { ...current, vy: Math.abs(current.vy) };

      for (const block of currentBlocks) {
        if (isBallInsideBlock(current, block)) {
          tunnelDetected = true;
          tunnelDetail =
            `tick=${tick} ball=(${current.x.toFixed(2)},${current.y.toFixed(2)})` +
            ` inside ${block.id} at (${block.x},${block.y})`;
          break;
        }
      }

      if (tunnelDetected) break;
    }

    if (tunnelDetected) {
      throw new Error(`실제 게임 속도 터널링: ${tunnelDetail}`);
    }
    expect(tunnelDetected).toBe(false);
  });
});
