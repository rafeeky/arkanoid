/**
 * Regression test: ball becomes vertical or stalls after hitting left/right wall.
 *
 * Root cause: accumulatedSweptWallFacts were passed into applyCollisions,
 * causing reflectBallWall to re-flip vx that moveBallWithCollisions had
 * already flipped — restoring the original (wrong) direction.
 *
 * MVP1 §15-2 (공 반사 규칙 테스트) / §13-1 (Ball ↔ Wall 충돌 포함)
 */
import { describe, it, expect } from 'vitest';
import { createAppContext } from './createAppContext';
import type { GameplayRuntimeState } from '../gameplay/state/GameplayRuntimeState';

const noInput = { leftDown: false, rightDown: false, spaceJustPressed: false };
const spaceInput = { leftDown: false, rightDown: false, spaceJustPressed: true };

/**
 * Title → RoundIntro → InGame 으로 진행하는 헬퍼.
 * roundIntroDuration 타이머를 tick 으로 소화 후 inGame 상태를 보장한다.
 */
async function enterInGame(): Promise<Awaited<ReturnType<typeof createAppContext>>> {
  const ctx = await createAppContext();
  // Title → RoundIntro
  ctx.tick(spaceInput, 0.016);
  // RoundIntroFinished 를 직접 발행해서 즉시 inGame 진입
  ctx.handlePresentationEvent({ type: 'RoundIntroFinished' });
  expect(ctx.getFlowState().kind).toBe('inGame');
  // 공 발사
  ctx.tick(spaceInput, 0.016);
  return ctx;
}

describe('WallVerticalStall — 우측 벽 충돌 후 공이 수직 상승 또는 정지하지 않는다', () => {
  it('우측 벽에서 발사된 공이 벽 충돌 후 speed 유지 및 non-vertical 유지', async () => {
    const ctx = await enterInGame();

    // 공을 우측 벽 직전에서 우측으로 빠르게 이동하도록 강제 주입
    const state = ctx.getGameplayState() as GameplayRuntimeState;
    ctx._setGameplayState({
      ...state,
      balls: [
        {
          id: 'ball_1',
          isActive: true,
          x: 900,   // 우측 벽(952)에서 52px
          y: 500,   // HUD 아래, 블록 없는 영역
          vx: 400,  // 우측으로 빠르게
          vy: -200, // 위로
        },
      ],
    });

    const speedHistory: number[] = [];
    const vxHistory: number[] = [];
    const vyHistory: number[] = [];

    for (let i = 0; i < 500; i++) {
      ctx.tick(noInput, 0.016);
      const ball = ctx.getGameplayState().balls[0];
      if (!ball || !ball.isActive) break;
      const speed = Math.sqrt(ball.vx ** 2 + ball.vy ** 2);
      speedHistory.push(speed);
      vxHistory.push(ball.vx);
      vyHistory.push(ball.vy);
    }

    expect(speedHistory.length).toBeGreaterThan(0);

    // 속도 크기가 유지되는가 (에너지 보존 — 벽/블록은 속도 크기 변경 없음)
    const initialSpeed = speedHistory[0]!;
    const minSpeed = Math.min(...speedHistory);
    expect(minSpeed).toBeGreaterThan(initialSpeed * 0.8); // 20% 이내 허용

    // vx 가 0 에 수렴하지 않는가 (수직 상승 = vx ≈ 0)
    // enforceMinAngle 이 최소 15° 를 보장하므로 |vx|/speed >= sin(15°) ≈ 0.259
    const minVxRatio = Math.min(
      ...vxHistory.map((vx, i) => Math.abs(vx) / (speedHistory[i] ?? 1)),
    );
    // 허용 마진: 0.1 (sin15° ≈ 0.259 보다 낮지 않아야 하지만 수치 오차 허용)
    expect(minVxRatio).toBeGreaterThan(0.1);
  });

  it('좌측 벽에서 발사된 공이 벽 충돌 후 speed 유지 및 non-vertical 유지', async () => {
    const ctx = await enterInGame();

    const state = ctx.getGameplayState() as GameplayRuntimeState;
    ctx._setGameplayState({
      ...state,
      balls: [
        {
          id: 'ball_1',
          isActive: true,
          x: 60,    // 좌측 벽(8)에서 52px
          y: 500,
          vx: -400, // 좌측으로 빠르게
          vy: -200, // 위로
        },
      ],
    });

    const speedHistory: number[] = [];
    const vxHistory: number[] = [];

    for (let i = 0; i < 500; i++) {
      ctx.tick(noInput, 0.016);
      const ball = ctx.getGameplayState().balls[0];
      if (!ball || !ball.isActive) break;
      const speed = Math.sqrt(ball.vx ** 2 + ball.vy ** 2);
      speedHistory.push(speed);
      vxHistory.push(ball.vx);
    }

    expect(speedHistory.length).toBeGreaterThan(0);

    const initialSpeed = speedHistory[0]!;
    const minSpeed = Math.min(...speedHistory);
    expect(minSpeed).toBeGreaterThan(initialSpeed * 0.8);

    const minVxRatio = Math.min(
      ...vxHistory.map((vx, i) => Math.abs(vx) / (speedHistory[i] ?? 1)),
    );
    expect(minVxRatio).toBeGreaterThan(0.1);
  });

  it('벽 충돌 직후 vx 부호가 올바르게 반전된다 (우측 벽: 충돌 전 vx>0 → 충돌 후 vx<0)', async () => {
    const ctx = await enterInGame();

    const state = ctx.getGameplayState() as GameplayRuntimeState;
    // 우측 벽(x=CANVAS_WIDTH-BALL_RADIUS=952)에 거의 닿아 있음.
    // vx=300, dt=0.016 → 이동 거리=4.8px.
    // x=949 → 949+4.8=953.8 > 952 → 이번 틱에 벽 충돌 확실.
    ctx._setGameplayState({
      ...state,
      balls: [
        {
          id: 'ball_1',
          isActive: true,
          x: 949,   // 다음 틱에 우측 벽 통과 보장
          y: 400,
          vx: 300,  // 우측으로
          vy: -100,
        },
      ],
    });

    // 1틱만 진행 — 벽 충돌 발생
    ctx.tick(noInput, 0.016);
    const ball = ctx.getGameplayState().balls[0];
    expect(ball).toBeDefined();
    if (!ball) return;

    // 우측 벽 충돌 후 vx 는 반드시 음수여야 함 (왼쪽으로 튕겨나감)
    expect(ball.vx).toBeLessThan(0);
    // 위치가 우측 벽 바깥으로 나가지 않아야 함
    expect(ball.x).toBeLessThanOrEqual(960 - 8);
  });

  it('벽 충돌 직후 vx 부호가 올바르게 반전된다 (좌측 벽: 충돌 전 vx<0 → 충돌 후 vx>0)', async () => {
    const ctx = await enterInGame();

    const state = ctx.getGameplayState() as GameplayRuntimeState;
    // 좌측 벽(x=BALL_RADIUS=8)에 거의 닿아 있음.
    // vx=-300, dt=0.016 → 이동 거리=-4.8px.
    // x=11 → 11-4.8=6.2 < 8 → 이번 틱에 벽 충돌 확실.
    ctx._setGameplayState({
      ...state,
      balls: [
        {
          id: 'ball_1',
          isActive: true,
          x: 11,    // 다음 틱에 좌측 벽 통과 보장
          y: 400,
          vx: -300, // 좌측으로
          vy: -100,
        },
      ],
    });

    ctx.tick(noInput, 0.016);
    const ball = ctx.getGameplayState().balls[0];
    expect(ball).toBeDefined();
    if (!ball) return;

    // 좌측 벽 충돌 후 vx 는 반드시 양수여야 함 (오른쪽으로 튕겨나감)
    expect(ball.vx).toBeGreaterThan(0);
    // 위치가 좌측 벽 바깥으로 나가지 않아야 함
    expect(ball.x).toBeGreaterThanOrEqual(8);
  });
});
