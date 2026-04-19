/**
 * §15-5 통합 시나리오 테스트
 *
 * mvp1.md §15-5에서 명시한 두 가지 시나리오를 결정론적으로 검증한다.
 *
 * 시나리오 1: 시작 → 플레이 → 라이프 손실 → 재시작
 * 시나리오 2: 시작 → 플레이 → 게임오버 → 타이틀 복귀 → highScore 교차 세션 로드
 *
 * 원칙:
 * - Math.random 미사용. 상태 주입(_setGameplayState)으로 결정론적 재현.
 * - 공개 API만 사용(getFlowState, getGameplayState, tick, handlePresentationEvent, _setGameplayState).
 * - Phaser/엔진 API 미참조.
 */

import { describe, it, expect, vi } from 'vitest';
import { createAppContext } from './createAppContext';
import { InMemorySaveRepository } from '../persistence/InMemorySaveRepository';
import type { GameplayRuntimeState } from '../gameplay/state/GameplayRuntimeState';
import type { InputSnapshot } from '../input/InputSnapshot';

// ---------------------------------------------------------------------------
// 공통 입력 픽스처
// ---------------------------------------------------------------------------

const noInput: InputSnapshot = { leftDown: false, rightDown: false, spaceJustPressed: false };
const spaceInput: InputSnapshot = { leftDown: false, rightDown: false, spaceJustPressed: true };

// ---------------------------------------------------------------------------
// 헬퍼: ball.y를 바닥 아래로 주입해 LifeLost를 즉시 유발한다.
// GameplayConfig.fieldHeight 를 명시적으로 참조하지 않고,
// 720을 초과하는 y값(화면 하단)을 직접 주입한다.
// ---------------------------------------------------------------------------

function injectBallBelowFloor(ctx: Awaited<ReturnType<typeof createAppContext>>): void {
  const state = ctx.getGameplayState() as GameplayRuntimeState;
  ctx._setGameplayState({
    ...state,
    balls: state.balls.map((b, i) =>
      i === 0 ? { ...b, isActive: true, x: 480, y: 730, vx: 0, vy: 300 } : b,
    ),
  });
}

// ---------------------------------------------------------------------------
// 헬퍼: flowState が変わるまで最大 maxTicks 回 tick する
// ---------------------------------------------------------------------------

function tickUntilFlowChanges(
  ctx: Awaited<ReturnType<typeof createAppContext>>,
  fromKind: string,
  maxTicks = 20,
): void {
  for (let i = 0; i < maxTicks; i++) {
    if (ctx.getFlowState().kind !== fromKind) break;
    ctx.tick(noInput, 1 / 60);
  }
}

// ---------------------------------------------------------------------------
// 헬퍼: Title → RoundIntro → InGame 진입
// ---------------------------------------------------------------------------

function enterInGame(ctx: Awaited<ReturnType<typeof createAppContext>>): void {
  ctx.tick(spaceInput, 1 / 60); // title → roundIntro
  ctx.handlePresentationEvent({ type: 'RoundIntroFinished' }); // roundIntro → inGame
}

// ---------------------------------------------------------------------------
// 시나리오 1: 시작 → 플레이 → 라이프 손실 → 재시작
// ---------------------------------------------------------------------------

describe('§15-5 시나리오 1: 시작 → 플레이 → 라이프 손실 → 재시작', () => {
  it('1. 초기 flowState는 title이다', async () => {
    const ctx = await createAppContext({ saveRepository: new InMemorySaveRepository() });
    expect(ctx.getFlowState().kind).toBe('title');
  });

  it('2. spaceJustPressed tick → roundIntro, Stage 1 블록 65개 로드됨', async () => {
    const ctx = await createAppContext({ saveRepository: new InMemorySaveRepository() });
    ctx.tick(spaceInput, 1 / 60);
    expect(ctx.getFlowState().kind).toBe('roundIntro');
    expect(ctx.getGameplayState().blocks).toHaveLength(65);
  });

  it('3. RoundIntroFinished → inGame 전이', async () => {
    const ctx = await createAppContext({ saveRepository: new InMemorySaveRepository() });
    ctx.tick(spaceInput, 1 / 60);
    ctx.handlePresentationEvent({ type: 'RoundIntroFinished' });
    expect(ctx.getFlowState().kind).toBe('inGame');
  });

  it('4. inGame에서 ball.y > 720 주입 → LifeLost → roundIntro 전이', async () => {
    const ctx = await createAppContext({ saveRepository: new InMemorySaveRepository() });
    enterInGame(ctx);

    // 공 발사 + 바닥 아래로 주입
    ctx.tick(spaceInput, 1 / 60); // LaunchBall 명령 (ball.isActive=true)
    injectBallBelowFloor(ctx);
    tickUntilFlowChanges(ctx, 'inGame');

    expect(ctx.getFlowState().kind).toBe('roundIntro');
  });

  it('5. LifeLost 후 resetForRetry: 블록 수 유지(65개)', async () => {
    const ctx = await createAppContext({ saveRepository: new InMemorySaveRepository() });
    enterInGame(ctx);
    ctx.tick(spaceInput, 1 / 60); // ball 활성화
    injectBallBelowFloor(ctx);
    tickUntilFlowChanges(ctx, 'inGame');

    expect(ctx.getFlowState().kind).toBe('roundIntro');
    // 블록이 전혀 파괴되지 않은 상태이므로 65개 유지
    expect(ctx.getGameplayState().blocks).toHaveLength(65);
  });

  it('6. LifeLost 후 resetForRetry: lives = 2 (초기 3에서 1 감소)', async () => {
    const ctx = await createAppContext({ saveRepository: new InMemorySaveRepository() });
    enterInGame(ctx);
    ctx.tick(spaceInput, 1 / 60);
    injectBallBelowFloor(ctx);
    tickUntilFlowChanges(ctx, 'inGame');

    expect(ctx.getFlowState().kind).toBe('roundIntro');
    expect(ctx.getGameplayState().session.lives).toBe(2);
  });

  it('7. LifeLost 후 resetForRetry: score 유지됨', async () => {
    const ctx = await createAppContext({ saveRepository: new InMemorySaveRepository() });
    enterInGame(ctx);

    // score 를 임의 값으로 주입
    const state = ctx.getGameplayState() as GameplayRuntimeState;
    ctx._setGameplayState({
      ...state,
      session: { ...state.session, score: 500 },
    });

    ctx.tick(spaceInput, 1 / 60);
    injectBallBelowFloor(ctx);
    tickUntilFlowChanges(ctx, 'inGame');

    expect(ctx.getFlowState().kind).toBe('roundIntro');
    expect(ctx.getGameplayState().session.score).toBe(500);
  });

  it('8. LifeLost 후 resetForRetry: ball.isActive=false (공 비활성 상태로 리셋)', async () => {
    const ctx = await createAppContext({ saveRepository: new InMemorySaveRepository() });
    enterInGame(ctx);
    ctx.tick(spaceInput, 1 / 60);
    injectBallBelowFloor(ctx);
    tickUntilFlowChanges(ctx, 'inGame');

    expect(ctx.getFlowState().kind).toBe('roundIntro');
    const balls = ctx.getGameplayState().balls;
    expect(balls.length).toBeGreaterThan(0);
    expect(balls[0]!.isActive).toBe(false);
  });

  it('9. LifeLost 후 resetForRetry: bar.width = 120 (baseBarWidth 복구)', async () => {
    const ctx = await createAppContext({ saveRepository: new InMemorySaveRepository() });
    enterInGame(ctx);
    ctx.tick(spaceInput, 1 / 60);
    injectBallBelowFloor(ctx);
    tickUntilFlowChanges(ctx, 'inGame');

    expect(ctx.getFlowState().kind).toBe('roundIntro');
    expect(ctx.getGameplayState().bar.width).toBe(120);
  });

  it('10. roundIntro에서 RoundIntroFinished → 다시 inGame 복귀 가능', async () => {
    const ctx = await createAppContext({ saveRepository: new InMemorySaveRepository() });
    enterInGame(ctx);
    ctx.tick(spaceInput, 1 / 60);
    injectBallBelowFloor(ctx);
    tickUntilFlowChanges(ctx, 'inGame');

    expect(ctx.getFlowState().kind).toBe('roundIntro');

    // 재시작 후 다시 inGame 진입
    ctx.handlePresentationEvent({ type: 'RoundIntroFinished' });
    expect(ctx.getFlowState().kind).toBe('inGame');
    // 블록이 여전히 있어 게임 계속 가능
    const activeBlocks = ctx.getGameplayState().blocks.filter((b) => !b.isDestroyed);
    expect(activeBlocks.length).toBeGreaterThan(0);
  });
});

// ---------------------------------------------------------------------------
// 시나리오 2: 시작 → 플레이 → 게임오버 → 타이틀 복귀 + highScore 교차 세션 로드
// ---------------------------------------------------------------------------

describe('§15-5 시나리오 2: 시작 → 플레이 → 게임오버 → 타이틀 복귀', () => {
  it('1. lives=1, score=1234 상태에서 ball 바닥 이탈 → gameOver 전이', async () => {
    const repo = new InMemorySaveRepository({ highScore: 0 });
    const ctx = await createAppContext({ saveRepository: repo });
    enterInGame(ctx);

    // session.score=1234, lives=1 주입
    const state = ctx.getGameplayState() as GameplayRuntimeState;
    ctx._setGameplayState({
      ...state,
      session: { ...state.session, score: 1234, lives: 1 },
    });

    ctx.tick(spaceInput, 1 / 60); // ball 활성화
    injectBallBelowFloor(ctx);
    tickUntilFlowChanges(ctx, 'inGame');

    expect(ctx.getFlowState().kind).toBe('gameOver');
  });

  it('2. gameOver 진입 시 saveRepository.save 가 호출된다', async () => {
    const repo = new InMemorySaveRepository({ highScore: 0 });
    const saveSpy = vi.spyOn(repo, 'save');
    const ctx = await createAppContext({ saveRepository: repo });
    enterInGame(ctx);

    const state = ctx.getGameplayState() as GameplayRuntimeState;
    ctx._setGameplayState({
      ...state,
      session: { ...state.session, score: 1234, lives: 1 },
    });

    ctx.tick(spaceInput, 1 / 60);
    injectBallBelowFloor(ctx);
    tickUntilFlowChanges(ctx, 'inGame');

    expect(ctx.getFlowState().kind).toBe('gameOver');
    expect(saveSpy).toHaveBeenCalled();
  });

  it('3. gameOver 진입 시 highScore=1234 가 저장된다', async () => {
    const repo = new InMemorySaveRepository({ highScore: 0 });
    const ctx = await createAppContext({ saveRepository: repo });
    enterInGame(ctx);

    const state = ctx.getGameplayState() as GameplayRuntimeState;
    ctx._setGameplayState({
      ...state,
      session: { ...state.session, score: 1234, lives: 1 },
    });

    ctx.tick(spaceInput, 1 / 60);
    injectBallBelowFloor(ctx);
    tickUntilFlowChanges(ctx, 'inGame');

    expect(ctx.getFlowState().kind).toBe('gameOver');
    const saved = await repo.load();
    expect(saved.highScore).toBe(1234);
  });

  it('4. gameOver에서 spaceJustPressed → title 복귀', async () => {
    const repo = new InMemorySaveRepository({ highScore: 0 });
    const ctx = await createAppContext({ saveRepository: repo });
    enterInGame(ctx);

    const state = ctx.getGameplayState() as GameplayRuntimeState;
    ctx._setGameplayState({
      ...state,
      session: { ...state.session, score: 1234, lives: 1 },
    });

    ctx.tick(spaceInput, 1 / 60);
    injectBallBelowFloor(ctx);
    tickUntilFlowChanges(ctx, 'inGame');

    expect(ctx.getFlowState().kind).toBe('gameOver');
    ctx.tick(spaceInput, 1 / 60);
    expect(ctx.getFlowState().kind).toBe('title');
  });

  it('5. 새 AppContext를 같은 saveRepository로 생성하면 highScore=1234 로드됨 (교차 세션)', async () => {
    // 1세션: 게임 플레이 후 highScore=1234 저장
    const repo = new InMemorySaveRepository({ highScore: 0 });
    const ctx1 = await createAppContext({ saveRepository: repo });
    enterInGame(ctx1);

    const state = ctx1.getGameplayState() as GameplayRuntimeState;
    ctx1._setGameplayState({
      ...state,
      session: { ...state.session, score: 1234, lives: 1 },
    });

    ctx1.tick(spaceInput, 1 / 60);
    injectBallBelowFloor(ctx1);
    tickUntilFlowChanges(ctx1, 'inGame');

    expect(ctx1.getFlowState().kind).toBe('gameOver');

    // 저장 완료를 기다린다 (fire-and-forget이므로 명시적 flush)
    await new Promise((resolve) => setTimeout(resolve, 0));

    // 2세션: 같은 repo로 새 AppContext 생성 → highScore 로드 확인
    const ctx2 = await createAppContext({ saveRepository: repo });
    expect(ctx2.getGameplayState().session.highScore).toBe(1234);
  });

  it('6. score < highScore 이면 기존 highScore 유지', async () => {
    const repo = new InMemorySaveRepository({ highScore: 9999 });
    const ctx = await createAppContext({ saveRepository: repo });
    enterInGame(ctx);

    const state = ctx.getGameplayState() as GameplayRuntimeState;
    ctx._setGameplayState({
      ...state,
      session: { ...state.session, score: 100, lives: 1 },
    });

    ctx.tick(spaceInput, 1 / 60);
    injectBallBelowFloor(ctx);
    tickUntilFlowChanges(ctx, 'inGame');

    expect(ctx.getFlowState().kind).toBe('gameOver');
    const saved = await repo.load();
    expect(saved.highScore).toBe(9999);
  });

  it('7. gameOver 화면에서 현재 session.score 유지됨 (결과 표시용)', async () => {
    const repo = new InMemorySaveRepository({ highScore: 0 });
    const ctx = await createAppContext({ saveRepository: repo });
    enterInGame(ctx);

    const state = ctx.getGameplayState() as GameplayRuntimeState;
    ctx._setGameplayState({
      ...state,
      session: { ...state.session, score: 1234, lives: 1 },
    });

    ctx.tick(spaceInput, 1 / 60);
    injectBallBelowFloor(ctx);
    tickUntilFlowChanges(ctx, 'inGame');

    expect(ctx.getFlowState().kind).toBe('gameOver');
    // GameOver 화면에서 최종 점수를 표시하기 위해 session.score가 유지되어야 함
    expect(ctx.getGameplayState().session.score).toBe(1234);
  });
});

// ---------------------------------------------------------------------------
// 감사 중 발견 항목: edge case 보강
// ---------------------------------------------------------------------------

describe('§15-5 edge case: GameplayController flowState 비활성 시 tick 무효', () => {
  it('flowState가 title이면 gameplay tick 비활성 — bar.x 변화 없음', async () => {
    const ctx = await createAppContext({ saveRepository: new InMemorySaveRepository() });
    // 초기 상태 title
    const barXBefore = ctx.getGameplayState().bar.x;
    ctx.tick({ leftDown: true, rightDown: false, spaceJustPressed: false }, 1 / 60);
    expect(ctx.getGameplayState().bar.x).toBe(barXBefore);
  });

  it('flowState가 roundIntro이면 gameplay tick 비활성 — bar.x 변화 없음', async () => {
    const ctx = await createAppContext({ saveRepository: new InMemorySaveRepository() });
    ctx.tick(spaceInput, 1 / 60); // → roundIntro
    expect(ctx.getFlowState().kind).toBe('roundIntro');
    const barXBefore = ctx.getGameplayState().bar.x;
    ctx.tick({ leftDown: true, rightDown: false, spaceJustPressed: false }, 1 / 60);
    expect(ctx.getGameplayState().bar.x).toBe(barXBefore);
  });

  it('flowState가 gameOver이면 gameplay tick 비활성 — bar.x 변화 없음', async () => {
    const repo = new InMemorySaveRepository({ highScore: 0 });
    const ctx = await createAppContext({ saveRepository: repo });
    enterInGame(ctx);

    const state = ctx.getGameplayState() as GameplayRuntimeState;
    ctx._setGameplayState({
      ...state,
      session: { ...state.session, lives: 1 },
    });

    ctx.tick(spaceInput, 1 / 60);
    injectBallBelowFloor(ctx);
    tickUntilFlowChanges(ctx, 'inGame');

    expect(ctx.getFlowState().kind).toBe('gameOver');
    const barXBefore = ctx.getGameplayState().bar.x;
    ctx.tick({ leftDown: true, rightDown: false, spaceJustPressed: false }, 1 / 60);
    expect(ctx.getGameplayState().bar.x).toBe(barXBefore);
  });
});

describe('§15-5 edge case: StageRuntimeFactory — stage1.json 65개 블록 생성 통합 검증', () => {
  it('새 게임 시작 시 블록 65개, 파괴된 블록 없음', async () => {
    const ctx = await createAppContext({ saveRepository: new InMemorySaveRepository() });
    ctx.tick(spaceInput, 1 / 60); // → roundIntro (initializeStage 호출)

    const blocks = ctx.getGameplayState().blocks;
    expect(blocks).toHaveLength(65);
    expect(blocks.every((b) => !b.isDestroyed)).toBe(true);
    expect(blocks.every((b) => b.remainingHits >= 1)).toBe(true);
  });

  it('GameOver → Title → 재시작 시 블록 65개 재로드 (상태 초기화 확인)', async () => {
    const repo = new InMemorySaveRepository({ highScore: 0 });
    const ctx = await createAppContext({ saveRepository: repo });
    enterInGame(ctx);

    const state = ctx.getGameplayState() as GameplayRuntimeState;
    ctx._setGameplayState({
      ...state,
      session: { ...state.session, lives: 1 },
      // 블록 일부를 파괴 상태로 주입
      blocks: state.blocks.map((b, i) => (i < 5 ? { ...b, isDestroyed: true, remainingHits: 0 } : b)),
    });

    ctx.tick(spaceInput, 1 / 60);
    injectBallBelowFloor(ctx);
    tickUntilFlowChanges(ctx, 'inGame');

    expect(ctx.getFlowState().kind).toBe('gameOver');
    ctx.tick(spaceInput, 1 / 60); // → title

    ctx.tick(spaceInput, 1 / 60); // → roundIntro (새 게임 initializeStage)
    const newBlocks = ctx.getGameplayState().blocks;
    expect(newBlocks).toHaveLength(65);
    expect(newBlocks.every((b) => !b.isDestroyed)).toBe(true);
  });
});
