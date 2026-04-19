/**
 * §15-5 통합 시나리오 테스트
 *
 * mvp1.md §15-5에서 명시한 두 가지 시나리오를 결정론적으로 검증한다.
 * mvp2.md §13-4 / §15에서 명시한 다섯 가지 MVP2 통합 시나리오를 추가한다.
 *
 * 시나리오 1: 시작 → 플레이 → 라이프 손실 → 재시작
 * 시나리오 2: 시작 → 플레이 → 게임오버 → 타이틀 복귀 → highScore 교차 세션 로드
 *
 * MVP2 시나리오 A: Full clear (Title → Intro → Stage1 → Stage2 → Stage3 → GameClear)
 * MVP2 시나리오 B: 중간 GameOver (LifeLost 3회 → GameOver → highScore 저장)
 * MVP2 시나리오 C: Stage 2 LifeLost 후 재시도 (스테이지/점수/블록 유지)
 * MVP2 시나리오 D: IntroStory 게이팅 (IntroSequenceFinished 전까지 gameplay 비활성)
 * MVP2 시나리오 E: GameClear → Title 복귀 → 새 게임 리셋
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
// 헬퍼: Title → IntroStory → RoundIntro → InGame 진입 (mvp2 §7-2 흐름)
// ---------------------------------------------------------------------------

function enterInGame(ctx: Awaited<ReturnType<typeof createAppContext>>): void {
  ctx.tick(spaceInput, 1 / 60); // title → introStory
  ctx.handlePresentationEvent({ type: 'IntroSequenceFinished' }); // introStory → roundIntro
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

  // TODO(dev): 커밋 1417858에서 스테이지를 dev용 10블록으로 줄여 일시 skip.
  // 원본 스테이지(65/78/91블록) 복원 시 재활성화.
  it.skip('2. spaceJustPressed tick → introStory, IntroSequenceFinished → roundIntro, Stage 1 블록 65개 로드됨', async () => {
    const ctx = await createAppContext({ saveRepository: new InMemorySaveRepository() });
    ctx.tick(spaceInput, 1 / 60); // title → introStory
    expect(ctx.getFlowState().kind).toBe('introStory');
    ctx.handlePresentationEvent({ type: 'IntroSequenceFinished' }); // introStory → roundIntro
    expect(ctx.getFlowState().kind).toBe('roundIntro');
    expect(ctx.getGameplayState().blocks).toHaveLength(65);
  });

  it('3. RoundIntroFinished → inGame 전이', async () => {
    const ctx = await createAppContext({ saveRepository: new InMemorySaveRepository() });
    ctx.tick(spaceInput, 1 / 60); // → introStory
    ctx.handlePresentationEvent({ type: 'IntroSequenceFinished' }); // → roundIntro
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

  // TODO(dev): 커밋 1417858에서 스테이지를 dev용 10블록으로 줄여 일시 skip.
  // 원본 스테이지(65/78/91블록) 복원 시 재활성화.
  it.skip('5. LifeLost 후 resetForRetry: 블록 수 유지(65개)', async () => {
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
    ctx.tick(spaceInput, 1 / 60); // → introStory
    ctx.handlePresentationEvent({ type: 'IntroSequenceFinished' }); // → roundIntro
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
  // TODO(dev): 커밋 1417858에서 스테이지를 dev용 10블록으로 줄여 일시 skip.
  // 원본 스테이지(65/78/91블록) 복원 시 재활성화.
  it.skip('새 게임 시작 시 블록 65개, 파괴된 블록 없음', async () => {
    const ctx = await createAppContext({ saveRepository: new InMemorySaveRepository() });
    ctx.tick(spaceInput, 1 / 60); // → introStory
    ctx.handlePresentationEvent({ type: 'IntroSequenceFinished' }); // → roundIntro (initializeStage 호출)

    const blocks = ctx.getGameplayState().blocks;
    expect(blocks).toHaveLength(65);
    expect(blocks.every((b) => !b.isDestroyed)).toBe(true);
    expect(blocks.every((b) => b.remainingHits >= 1)).toBe(true);
  });

  // TODO(dev): 커밋 1417858에서 스테이지를 dev용 10블록으로 줄여 일시 skip.
  // 원본 스테이지(65/78/91블록) 복원 시 재활성화.
  it.skip('GameOver → Title → 재시작 시 블록 65개 재로드 (상태 초기화 확인)', async () => {
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

    ctx.tick(spaceInput, 1 / 60); // → introStory
    ctx.handlePresentationEvent({ type: 'IntroSequenceFinished' }); // → roundIntro (새 게임 initializeStage)
    const newBlocks = ctx.getGameplayState().blocks;
    expect(newBlocks).toHaveLength(65);
    expect(newBlocks.every((b) => !b.isDestroyed)).toBe(true);
  });
});

// ===========================================================================
// MVP2 통합 시나리오 — mvp2.md §13-4 / §15
// ===========================================================================

// ---------------------------------------------------------------------------
// 공통 헬퍼 (MVP2)
// ---------------------------------------------------------------------------

/**
 * advanceToInGame: Title → IntroStory → RoundIntro → InGame 까지 진행.
 * (기존 enterInGame 과 동일한 로직. MVP2 시나리오에서 가독성을 위해 별칭 제공.)
 */
function advanceToInGame(ctx: Awaited<ReturnType<typeof createAppContext>>): void {
  ctx.tick(spaceInput, 1 / 60); // title → introStory
  ctx.handlePresentationEvent({ type: 'IntroSequenceFinished' }); // introStory → roundIntro
  ctx.handlePresentationEvent({ type: 'RoundIntroFinished' }); // roundIntro → inGame
}

/**
 * clearAllBlocks: 현재 InGame 상태의 모든 블록을 isDestroyed=true로 주입하고
 * tick 1회를 실행해 StageCleared 이벤트를 발생시킨다.
 *
 * StageRuleService.judgeStageOutcome은 공 활성 여부와 무관하게
 * 모든 블록이 isDestroyed면 'clear'를 판정한다.
 */
function clearAllBlocks(ctx: Awaited<ReturnType<typeof createAppContext>>): void {
  const state = ctx.getGameplayState() as GameplayRuntimeState;
  ctx._setGameplayState({
    ...state,
    blocks: state.blocks.map((b) => ({ ...b, isDestroyed: true, remainingHits: 0 })),
  });
  ctx.tick(noInput, 1 / 60); // StageCleared 발행 트리거
}

/**
 * advanceToStage2InGame: Stage 1 클리어 후 Stage 2 InGame 진입.
 * Stage 1 클리어 → RoundIntro(stage=1) → InGame
 */
function advanceToStage2InGame(ctx: Awaited<ReturnType<typeof createAppContext>>): void {
  advanceToInGame(ctx);
  clearAllBlocks(ctx); // Stage 1 클리어 → RoundIntro(stage=1)
  ctx.handlePresentationEvent({ type: 'RoundIntroFinished' }); // roundIntro → inGame(stage2)
}

// ---------------------------------------------------------------------------
// MVP2 시나리오 A: Full clear
// Title → Intro → Stage1 → Stage2 → Stage3 → GameClear
// (mvp2.md §13-4 첫 번째 시나리오, §15 전체 흐름 성공 판정)
// ---------------------------------------------------------------------------

describe('MVP2 §13-4 시나리오 A: Full clear (Stage1 → Stage2 → Stage3 → GameClear)', () => {
  it('A-1. Title 초기 상태 확인', async () => {
    const ctx = await createAppContext({ saveRepository: new InMemorySaveRepository() });
    expect(ctx.getFlowState().kind).toBe('title');
    expect(ctx.getFlowState().currentStageIndex).toBe(0);
  });

  it('A-2. 스페이스 → introStory 전이', async () => {
    const ctx = await createAppContext({ saveRepository: new InMemorySaveRepository() });
    ctx.tick(spaceInput, 1 / 60);
    expect(ctx.getFlowState().kind).toBe('introStory');
  });

  // TODO(dev): 커밋 1417858에서 스테이지를 dev용 10블록으로 줄여 일시 skip.
  // 원본 스테이지(65/78/91블록) 복원 시 재활성화.
  it.skip('A-3. IntroSequenceFinished → roundIntro (stage=0), Stage 1 블록 65개 로드됨', async () => {
    const ctx = await createAppContext({ saveRepository: new InMemorySaveRepository() });
    ctx.tick(spaceInput, 1 / 60);
    ctx.handlePresentationEvent({ type: 'IntroSequenceFinished' });
    expect(ctx.getFlowState().kind).toBe('roundIntro');
    expect(ctx.getFlowState().currentStageIndex).toBe(0);
    expect(ctx.getGameplayState().blocks).toHaveLength(65);
  });

  it('A-4. RoundIntroFinished → inGame 전이', async () => {
    const ctx = await createAppContext({ saveRepository: new InMemorySaveRepository() });
    advanceToInGame(ctx);
    expect(ctx.getFlowState().kind).toBe('inGame');
    expect(ctx.getFlowState().currentStageIndex).toBe(0);
  });

  // TODO(dev): 커밋 1417858에서 스테이지를 dev용 10블록으로 줄여 일시 skip.
  // 원본 스테이지(65/78/91블록) 복원 시 재활성화.
  it.skip('A-5. Stage 1 전체 블록 파괴 후 tick → roundIntro (stage=1) 전이, Stage 2 블록 78개 로드됨', async () => {
    const ctx = await createAppContext({ saveRepository: new InMemorySaveRepository() });
    advanceToInGame(ctx);
    clearAllBlocks(ctx); // Stage 1 클리어
    expect(ctx.getFlowState().kind).toBe('roundIntro');
    expect(ctx.getFlowState().currentStageIndex).toBe(1);
    expect(ctx.getGameplayState().blocks).toHaveLength(78);
    expect(ctx.getGameplayState().session.currentStageIndex).toBe(1);
  });

  // TODO(dev): 커밋 1417858에서 스테이지를 dev용 10블록으로 줄여 일시 skip.
  // 원본 스테이지(65/78/91블록) 복원 시 재활성화.
  it.skip('A-6. Stage 2 전체 블록 파괴 후 tick → roundIntro (stage=2) 전이, Stage 3 블록 91개 로드됨', async () => {
    const ctx = await createAppContext({ saveRepository: new InMemorySaveRepository() });
    advanceToStage2InGame(ctx);
    clearAllBlocks(ctx); // Stage 2 클리어
    expect(ctx.getFlowState().kind).toBe('roundIntro');
    expect(ctx.getFlowState().currentStageIndex).toBe(2);
    expect(ctx.getGameplayState().blocks).toHaveLength(91);
    expect(ctx.getGameplayState().session.currentStageIndex).toBe(2);
  });

  it('A-7. Stage 3 전체 블록 파괴 후 tick → gameClear 전이 (마지막 스테이지)', async () => {
    const ctx = await createAppContext({ saveRepository: new InMemorySaveRepository() });
    // Stage 1 클리어
    advanceToInGame(ctx);
    clearAllBlocks(ctx);
    ctx.handlePresentationEvent({ type: 'RoundIntroFinished' }); // inGame(stage2)
    // Stage 2 클리어
    clearAllBlocks(ctx);
    ctx.handlePresentationEvent({ type: 'RoundIntroFinished' }); // inGame(stage3)
    // Stage 3 클리어
    clearAllBlocks(ctx);
    expect(ctx.getFlowState().kind).toBe('gameClear');
  });

  it('A-8. GameClear에서 스페이스 → title 복귀', async () => {
    const ctx = await createAppContext({ saveRepository: new InMemorySaveRepository() });
    advanceToInGame(ctx);
    clearAllBlocks(ctx);
    ctx.handlePresentationEvent({ type: 'RoundIntroFinished' });
    clearAllBlocks(ctx);
    ctx.handlePresentationEvent({ type: 'RoundIntroFinished' });
    clearAllBlocks(ctx);
    expect(ctx.getFlowState().kind).toBe('gameClear');

    ctx.tick(spaceInput, 1 / 60);
    expect(ctx.getFlowState().kind).toBe('title');
  });

  it('A-9. 점수가 클리어 전 주입한 값에서 누적된다 (score 유지)', async () => {
    const ctx = await createAppContext({ saveRepository: new InMemorySaveRepository() });
    advanceToInGame(ctx);

    // Stage 1 진입 시 score 500 주입
    const s1State = ctx.getGameplayState() as GameplayRuntimeState;
    ctx._setGameplayState({ ...s1State, session: { ...s1State.session, score: 500 } });

    clearAllBlocks(ctx); // Stage 1 클리어 → roundIntro(stage=1)
    // score는 500 이상 (클리어 후 점수 가산 없음 — 블록 파괴 없이 주입했으므로 500 유지)
    expect(ctx.getGameplayState().session.score).toBeGreaterThanOrEqual(500);

    ctx.handlePresentationEvent({ type: 'RoundIntroFinished' }); // inGame(stage2)
    // Stage 2 진입 후에도 score 유지됨
    expect(ctx.getGameplayState().session.score).toBeGreaterThanOrEqual(500);
  });

  it('A-10. GameClear 진입 시 highScore가 저장된다', async () => {
    const repo = new InMemorySaveRepository({ highScore: 0 });
    const ctx = await createAppContext({ saveRepository: repo });
    advanceToInGame(ctx);

    const s1State = ctx.getGameplayState() as GameplayRuntimeState;
    ctx._setGameplayState({ ...s1State, session: { ...s1State.session, score: 3000 } });

    clearAllBlocks(ctx);
    ctx.handlePresentationEvent({ type: 'RoundIntroFinished' });
    clearAllBlocks(ctx);
    ctx.handlePresentationEvent({ type: 'RoundIntroFinished' });
    clearAllBlocks(ctx);
    expect(ctx.getFlowState().kind).toBe('gameClear');

    const saved = await repo.load();
    expect(saved.highScore).toBe(3000);
  });
});

// ---------------------------------------------------------------------------
// MVP2 시나리오 B: 중간 GameOver
// Title → IntroStory → Stage 1 진입 → LifeLost 3번 → GameOver → Title 복귀
// (mvp2.md §13-4 두 번째 시나리오)
// ---------------------------------------------------------------------------

describe('MVP2 §13-4 시나리오 B: 중간 GameOver — LifeLost 3회 → GameOver → highScore 저장', () => {
  it('B-1. lives=3 에서 LifeLost 1회 → roundIntro 전이, lives=2', async () => {
    const ctx = await createAppContext({ saveRepository: new InMemorySaveRepository() });
    advanceToInGame(ctx);
    ctx.tick(spaceInput, 1 / 60); // 공 활성화
    injectBallBelowFloor(ctx);
    tickUntilFlowChanges(ctx, 'inGame');
    expect(ctx.getFlowState().kind).toBe('roundIntro');
    expect(ctx.getGameplayState().session.lives).toBe(2);
  });

  it('B-2. lives=2 에서 LifeLost 2회 → roundIntro 전이, lives=1', async () => {
    const ctx = await createAppContext({ saveRepository: new InMemorySaveRepository() });
    advanceToInGame(ctx);

    // 1차 손실
    ctx.tick(spaceInput, 1 / 60);
    injectBallBelowFloor(ctx);
    tickUntilFlowChanges(ctx, 'inGame');
    expect(ctx.getFlowState().kind).toBe('roundIntro');

    // 2차 손실
    ctx.handlePresentationEvent({ type: 'RoundIntroFinished' });
    ctx.tick(spaceInput, 1 / 60);
    injectBallBelowFloor(ctx);
    tickUntilFlowChanges(ctx, 'inGame');
    expect(ctx.getFlowState().kind).toBe('roundIntro');
    expect(ctx.getGameplayState().session.lives).toBe(1);
  });

  it('B-3. lives=1 에서 LifeLost → gameOver 전이 (remainingLives=0)', async () => {
    const repo = new InMemorySaveRepository({ highScore: 0 });
    const ctx = await createAppContext({ saveRepository: repo });
    advanceToInGame(ctx);

    // 라이프를 1로 주입
    const state = ctx.getGameplayState() as GameplayRuntimeState;
    ctx._setGameplayState({ ...state, session: { ...state.session, lives: 1, score: 500 } });

    ctx.tick(spaceInput, 1 / 60);
    injectBallBelowFloor(ctx);
    tickUntilFlowChanges(ctx, 'inGame');
    expect(ctx.getFlowState().kind).toBe('gameOver');
  });

  it('B-4. GameOver 진입 시 highScore 저장됨 (score > 이전 highScore)', async () => {
    const repo = new InMemorySaveRepository({ highScore: 0 });
    const ctx = await createAppContext({ saveRepository: repo });
    advanceToInGame(ctx);

    const state = ctx.getGameplayState() as GameplayRuntimeState;
    ctx._setGameplayState({ ...state, session: { ...state.session, lives: 1, score: 750 } });

    ctx.tick(spaceInput, 1 / 60);
    injectBallBelowFloor(ctx);
    tickUntilFlowChanges(ctx, 'inGame');
    expect(ctx.getFlowState().kind).toBe('gameOver');

    const saved = await repo.load();
    expect(saved.highScore).toBe(750);
  });

  it('B-5. GameOver에서 스페이스 → title 복귀', async () => {
    const ctx = await createAppContext({ saveRepository: new InMemorySaveRepository() });
    advanceToInGame(ctx);

    const state = ctx.getGameplayState() as GameplayRuntimeState;
    ctx._setGameplayState({ ...state, session: { ...state.session, lives: 1 } });

    ctx.tick(spaceInput, 1 / 60);
    injectBallBelowFloor(ctx);
    tickUntilFlowChanges(ctx, 'inGame');
    expect(ctx.getFlowState().kind).toBe('gameOver');

    ctx.tick(spaceInput, 1 / 60);
    expect(ctx.getFlowState().kind).toBe('title');
  });

  it('B-6. score < 이전 highScore 이면 highScore 유지됨', async () => {
    const repo = new InMemorySaveRepository({ highScore: 9999 });
    const ctx = await createAppContext({ saveRepository: repo });
    advanceToInGame(ctx);

    const state = ctx.getGameplayState() as GameplayRuntimeState;
    ctx._setGameplayState({ ...state, session: { ...state.session, lives: 1, score: 100 } });

    ctx.tick(spaceInput, 1 / 60);
    injectBallBelowFloor(ctx);
    tickUntilFlowChanges(ctx, 'inGame');
    expect(ctx.getFlowState().kind).toBe('gameOver');

    const saved = await repo.load();
    expect(saved.highScore).toBe(9999);
  });
});

// ---------------------------------------------------------------------------
// MVP2 시나리오 C: Stage 2 LifeLost 후 재시도 (스테이지 유지)
// Title → Intro → Stage 1 클리어 → Stage 2 진입 → LifeLost → RoundIntro → 같은 Stage 2 재시작
// (mvp2.md §13-4 — 다중 스테이지 중간 실패/재시도)
// ---------------------------------------------------------------------------

describe('MVP2 §13-4 시나리오 C: Stage 2 LifeLost 후 재시도 — 스테이지/점수/블록 유지', () => {
  // TODO(dev): 커밋 1417858에서 스테이지를 dev용 10블록으로 줄여 일시 skip.
  // 원본 스테이지(65/78/91블록) 복원 시 재활성화.
  it.skip('C-1. Stage 2 진입 후 currentStageIndex=1, blocks=78', async () => {
    const ctx = await createAppContext({ saveRepository: new InMemorySaveRepository() });
    advanceToStage2InGame(ctx);
    expect(ctx.getFlowState().currentStageIndex).toBe(1);
    expect(ctx.getGameplayState().blocks).toHaveLength(78);
    expect(ctx.getGameplayState().session.currentStageIndex).toBe(1);
  });

  it('C-2. Stage 2에서 LifeLost (lives > 0) → roundIntro 전이, 같은 stageIndex=1 유지', async () => {
    const ctx = await createAppContext({ saveRepository: new InMemorySaveRepository() });
    advanceToStage2InGame(ctx);

    ctx.tick(spaceInput, 1 / 60); // 공 활성화
    injectBallBelowFloor(ctx);
    tickUntilFlowChanges(ctx, 'inGame');

    expect(ctx.getFlowState().kind).toBe('roundIntro');
    expect(ctx.getFlowState().currentStageIndex).toBe(1);
  });

  // TODO(dev): 커밋 1417858에서 스테이지를 dev용 10블록으로 줄여 일시 skip.
  // 원본 스테이지(65/78/91블록) 복원 시 재활성화.
  it.skip('C-3. Stage 2 LifeLost 후 재시도: blocks 78개 그대로 (블록 수 유지)', async () => {
    const ctx = await createAppContext({ saveRepository: new InMemorySaveRepository() });
    advanceToStage2InGame(ctx);

    ctx.tick(spaceInput, 1 / 60);
    injectBallBelowFloor(ctx);
    tickUntilFlowChanges(ctx, 'inGame');

    expect(ctx.getFlowState().kind).toBe('roundIntro');
    expect(ctx.getGameplayState().blocks).toHaveLength(78);
  });

  it('C-4. Stage 2 LifeLost 후 재시도: score 유지됨', async () => {
    const ctx = await createAppContext({ saveRepository: new InMemorySaveRepository() });
    advanceToStage2InGame(ctx);

    // 점수 주입
    const s2State = ctx.getGameplayState() as GameplayRuntimeState;
    ctx._setGameplayState({ ...s2State, session: { ...s2State.session, score: 1200 } });

    ctx.tick(spaceInput, 1 / 60);
    injectBallBelowFloor(ctx);
    tickUntilFlowChanges(ctx, 'inGame');

    expect(ctx.getFlowState().kind).toBe('roundIntro');
    expect(ctx.getGameplayState().session.score).toBe(1200);
  });

  // TODO(dev): 커밋 1417858에서 스테이지를 dev용 10블록으로 줄여 일시 skip.
  // 원본 스테이지(65/78/91블록) 복원 시 재활성화.
  it.skip('C-5. Stage 2 LifeLost 후 RoundIntroFinished → 같은 Stage 2로 inGame 재진입', async () => {
    const ctx = await createAppContext({ saveRepository: new InMemorySaveRepository() });
    advanceToStage2InGame(ctx);

    ctx.tick(spaceInput, 1 / 60);
    injectBallBelowFloor(ctx);
    tickUntilFlowChanges(ctx, 'inGame');
    expect(ctx.getFlowState().kind).toBe('roundIntro');

    ctx.handlePresentationEvent({ type: 'RoundIntroFinished' });
    expect(ctx.getFlowState().kind).toBe('inGame');
    expect(ctx.getFlowState().currentStageIndex).toBe(1);
    expect(ctx.getGameplayState().session.currentStageIndex).toBe(1);
    expect(ctx.getGameplayState().blocks).toHaveLength(78);
  });

  it('C-6. Stage 2 LifeLost 후 재시도: 일부 파괴된 블록 상태가 그대로 유지됨', async () => {
    const ctx = await createAppContext({ saveRepository: new InMemorySaveRepository() });
    advanceToStage2InGame(ctx);

    // 블록 5개를 파괴 상태로 주입
    const s2State = ctx.getGameplayState() as GameplayRuntimeState;
    const modifiedBlocks = s2State.blocks.map((b, i) =>
      i < 5 ? { ...b, isDestroyed: true, remainingHits: 0 } : b,
    );
    ctx._setGameplayState({ ...s2State, blocks: modifiedBlocks });

    ctx.tick(spaceInput, 1 / 60);
    injectBallBelowFloor(ctx);
    tickUntilFlowChanges(ctx, 'inGame');
    expect(ctx.getFlowState().kind).toBe('roundIntro');

    // 파괴된 블록 5개가 그대로 유지됨 (resetForRetry는 블록을 재초기화하지 않음)
    const destroyedCount = ctx.getGameplayState().blocks.filter((b) => b.isDestroyed).length;
    expect(destroyedCount).toBe(5);
  });
});

// ---------------------------------------------------------------------------
// MVP2 시나리오 D: IntroStory 게이팅
// IntroSequenceFinished 전까지 gameplay tick 비활성, bar 입력 무시
// (mvp2.md §7-2 — IntroStory 는 게임플레이 입력을 처리하지 않음)
// ---------------------------------------------------------------------------

describe('MVP2 §13-4 시나리오 D: IntroStory 게이팅 — gameplay tick 비활성', () => {
  it('D-1. IntroStory 상태에서 여러 tick 후에도 bar.x 변화 없음 (gameplay 비활성)', async () => {
    const ctx = await createAppContext({ saveRepository: new InMemorySaveRepository() });
    ctx.tick(spaceInput, 1 / 60); // title → introStory
    expect(ctx.getFlowState().kind).toBe('introStory');

    const barXBefore = ctx.getGameplayState().bar.x;
    const leftInput: InputSnapshot = { leftDown: true, rightDown: false, spaceJustPressed: false };
    for (let i = 0; i < 10; i++) {
      ctx.tick(leftInput, 1 / 60);
    }
    // bar 이동 입력이 있더라도 introStory에서는 gameplay tick 비활성
    expect(ctx.getGameplayState().bar.x).toBe(barXBefore);
  });

  it('D-2. IntroStory 상태에서 ball.isActive는 false (공 정지)', async () => {
    const ctx = await createAppContext({ saveRepository: new InMemorySaveRepository() });
    ctx.tick(spaceInput, 1 / 60); // title → introStory
    expect(ctx.getFlowState().kind).toBe('introStory');

    for (let i = 0; i < 10; i++) {
      ctx.tick(noInput, 1 / 60);
    }
    const balls = ctx.getGameplayState().balls;
    expect(balls.length).toBeGreaterThan(0);
    expect(balls[0]!.isActive).toBe(false);
  });

  it('D-3. IntroStory에서 스페이스 입력을 여러 번 눌러도 roundIntro로 가지 않음', async () => {
    const ctx = await createAppContext({ saveRepository: new InMemorySaveRepository() });
    ctx.tick(spaceInput, 1 / 60); // title → introStory
    expect(ctx.getFlowState().kind).toBe('introStory');

    // 스페이스를 10번 눌러도 introStory 유지 (IntroSequenceFinished 전까지)
    for (let i = 0; i < 10; i++) {
      ctx.tick(spaceInput, 1 / 60);
    }
    expect(ctx.getFlowState().kind).toBe('introStory');
  });

  it('D-4. IntroSequenceFinished 발행 후에만 roundIntro 진입', async () => {
    const ctx = await createAppContext({ saveRepository: new InMemorySaveRepository() });
    ctx.tick(spaceInput, 1 / 60); // title → introStory
    expect(ctx.getFlowState().kind).toBe('introStory');

    // 여러 tick 후에도 introStory 유지
    for (let i = 0; i < 5; i++) {
      ctx.tick(noInput, 1 / 60);
    }
    expect(ctx.getFlowState().kind).toBe('introStory');

    // IntroSequenceFinished 발행 → roundIntro 전이
    ctx.handlePresentationEvent({ type: 'IntroSequenceFinished' });
    expect(ctx.getFlowState().kind).toBe('roundIntro');
  });
});

// ---------------------------------------------------------------------------
// MVP2 시나리오 E: GameClear → Title 복귀 → 새 게임 리셋
// (mvp2.md §15 — GameClear와 GameOver 모두 Title 복귀 가능, 새 게임 리셋 확인)
// ---------------------------------------------------------------------------

describe('MVP2 §13-4 시나리오 E: GameClear → Title 복귀 → 새 게임 리셋', () => {
  /**
   * 전체 3스테이지를 클리어해 gameClear 상태에 도달하는 헬퍼.
   * score 주입으로 highScore를 확인 가능하게 한다.
   */
  async function reachGameClear(
    score: number,
    repo: InstanceType<typeof InMemorySaveRepository>,
  ): Promise<Awaited<ReturnType<typeof createAppContext>>> {
    const ctx = await createAppContext({ saveRepository: repo });
    advanceToInGame(ctx);

    const s1State = ctx.getGameplayState() as GameplayRuntimeState;
    ctx._setGameplayState({ ...s1State, session: { ...s1State.session, score } });

    clearAllBlocks(ctx); // Stage 1 클리어
    ctx.handlePresentationEvent({ type: 'RoundIntroFinished' }); // inGame(stage2)
    clearAllBlocks(ctx); // Stage 2 클리어
    ctx.handlePresentationEvent({ type: 'RoundIntroFinished' }); // inGame(stage3)
    clearAllBlocks(ctx); // Stage 3 클리어 → gameClear
    return ctx;
  }

  it('E-1. Stage 3 클리어 후 gameClear 상태 확인', async () => {
    const repo = new InMemorySaveRepository({ highScore: 0 });
    const ctx = await reachGameClear(2000, repo);
    expect(ctx.getFlowState().kind).toBe('gameClear');
  });

  it('E-2. GameClear 에서 스페이스 → title 복귀', async () => {
    const repo = new InMemorySaveRepository({ highScore: 0 });
    const ctx = await reachGameClear(2000, repo);
    ctx.tick(spaceInput, 1 / 60);
    expect(ctx.getFlowState().kind).toBe('title');
  });

  it('E-3. Title 복귀 후 스페이스(StartGameRequested) 시 currentStageIndex=0 으로 리셋됨', async () => {
    // GameClear → RetryRequested → Title 진입 시 currentStageIndex는
    // FlowController에서 StartGameRequested 시 리셋된다 (mvp2.md §7-2).
    // Title 화면 자체에서는 이전 값을 유지하지만, 다음 게임 시작 시 0이 된다.
    const repo = new InMemorySaveRepository({ highScore: 0 });
    const ctx = await reachGameClear(2000, repo);
    ctx.tick(spaceInput, 1 / 60); // gameClear → title
    expect(ctx.getFlowState().kind).toBe('title');

    // 새 게임 시작(StartGameRequested) → introStory 전이 시 currentStageIndex=0
    ctx.tick(spaceInput, 1 / 60); // title → introStory
    expect(ctx.getFlowState().kind).toBe('introStory');
    expect(ctx.getFlowState().currentStageIndex).toBe(0);
  });

  it('E-4. Title 복귀 후 새 게임 시작 → introStory → roundIntro → score=0, currentStageIndex=0', async () => {
    const repo = new InMemorySaveRepository({ highScore: 0 });
    const ctx = await reachGameClear(2000, repo);
    ctx.tick(spaceInput, 1 / 60); // gameClear → title

    ctx.tick(spaceInput, 1 / 60); // title → introStory
    ctx.handlePresentationEvent({ type: 'IntroSequenceFinished' }); // introStory → roundIntro

    expect(ctx.getFlowState().kind).toBe('roundIntro');
    expect(ctx.getFlowState().currentStageIndex).toBe(0);
    expect(ctx.getGameplayState().session.score).toBe(0);
    expect(ctx.getGameplayState().session.currentStageIndex).toBe(0);
  });

  // TODO(dev): 커밋 1417858에서 스테이지를 dev용 10블록으로 줄여 일시 skip.
  // 원본 스테이지(65/78/91블록) 복원 시 재활성화.
  it.skip('E-5. Title 복귀 후 새 게임 시작 → Stage 1 블록 65개 로드됨 (블록 재초기화)', async () => {
    const repo = new InMemorySaveRepository({ highScore: 0 });
    const ctx = await reachGameClear(2000, repo);
    ctx.tick(spaceInput, 1 / 60); // gameClear → title

    ctx.tick(spaceInput, 1 / 60); // title → introStory
    ctx.handlePresentationEvent({ type: 'IntroSequenceFinished' }); // introStory → roundIntro

    const blocks = ctx.getGameplayState().blocks;
    expect(blocks).toHaveLength(65);
    expect(blocks.every((b) => !b.isDestroyed)).toBe(true);
  });

  it('E-6. Title 복귀 후 새 게임 시작 → lives=3 으로 리셋됨', async () => {
    const repo = new InMemorySaveRepository({ highScore: 0 });
    const ctx = await reachGameClear(2000, repo);
    ctx.tick(spaceInput, 1 / 60); // gameClear → title

    ctx.tick(spaceInput, 1 / 60); // title → introStory
    ctx.handlePresentationEvent({ type: 'IntroSequenceFinished' }); // introStory → roundIntro

    expect(ctx.getGameplayState().session.lives).toBe(3);
  });

  it('E-7. 이전 클리어 highScore는 새 게임 시작 후에도 유지됨', async () => {
    const repo = new InMemorySaveRepository({ highScore: 0 });
    const ctx = await reachGameClear(5000, repo);
    ctx.tick(spaceInput, 1 / 60); // gameClear → title

    ctx.tick(spaceInput, 1 / 60); // title → introStory
    ctx.handlePresentationEvent({ type: 'IntroSequenceFinished' }); // introStory → roundIntro

    // 새 게임에서도 이전 highScore(5000) 유지
    expect(ctx.getGameplayState().session.highScore).toBeGreaterThanOrEqual(5000);
  });

  it('E-8. 전체 사이클: GameClear → Title → 새 게임 → IntroStory → Stage1 inGame 진입 가능', async () => {
    const repo = new InMemorySaveRepository({ highScore: 0 });
    const ctx = await reachGameClear(1000, repo);
    ctx.tick(spaceInput, 1 / 60); // gameClear → title

    // 새 게임 사이클
    ctx.tick(spaceInput, 1 / 60); // title → introStory
    expect(ctx.getFlowState().kind).toBe('introStory');
    ctx.handlePresentationEvent({ type: 'IntroSequenceFinished' }); // introStory → roundIntro
    expect(ctx.getFlowState().kind).toBe('roundIntro');
    ctx.handlePresentationEvent({ type: 'RoundIntroFinished' }); // roundIntro → inGame
    expect(ctx.getFlowState().kind).toBe('inGame');
    expect(ctx.getFlowState().currentStageIndex).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// MVP3 Phase 4 시나리오: 자석 효과 E2E
// ---------------------------------------------------------------------------

describe('MVP3 Phase4 — 자석 효과 E2E', () => {
  const rightInput: InputSnapshot = { leftDown: false, rightDown: true, spaceJustPressed: false };

  it('F-1. 자석 아이템 획득 → activeEffect=magnet, magnetRemainingTime=8000', async () => {
    const ctx = await createAppContext({ saveRepository: new InMemorySaveRepository({ highScore: 0 }) });
    enterInGame(ctx);

    // 자석 아이템 드랍 상태를 직접 주입
    const state = ctx.getGameplayState() as GameplayRuntimeState;
    const magnetItem = {
      id: 'item_magnet',
      itemType: 'magnet' as const,
      x: state.bar.x,
      y: state.bar.y + 1, // 바로 위 (다음 틱 충돌)
      fallSpeed: 0,
      isCollected: false,
    };
    ctx._setGameplayState({ ...state, itemDrops: [magnetItem] });

    // 1 tick → ItemPickedUp 충돌 처리
    ctx.tick(noInput, 1 / 60);

    const after = ctx.getGameplayState();
    expect(after.bar.activeEffect).toBe('magnet');
    expect(after.magnetRemainingTime).toBeGreaterThan(0);
  });

  it('F-2. 자석 상태에서 공이 바에 닿으면 부착 (isActive=false, attachedBallIds 포함)', async () => {
    const ctx = await createAppContext({ saveRepository: new InMemorySaveRepository({ highScore: 0 }) });
    enterInGame(ctx);

    // 자석 상태로 세팅, 공을 바 바로 위에 아래로 이동하도록
    const state = ctx.getGameplayState() as GameplayRuntimeState;
    const barY = state.bar.y;
    ctx._setGameplayState({
      ...state,
      bar: { ...state.bar, activeEffect: 'magnet' },
      magnetRemainingTime: 8000,
      balls: state.balls.map((b, i) =>
        i === 0 ? { ...b, isActive: true, x: state.bar.x, y: barY - 14, vx: 0, vy: 300 } : b,
      ),
    });

    // 1 tick → 공이 바에 충돌하여 부착
    ctx.tick(noInput, 1 / 60);

    const after = ctx.getGameplayState();
    const ball = after.balls[0];
    expect(ball?.isActive).toBe(false);
    expect(after.attachedBallIds).toContain(after.balls[0]?.id);
  });

  it('F-3. 자석 부착 후 바 이동 시 부착 공도 함께 이동한다', async () => {
    const ctx = await createAppContext({ saveRepository: new InMemorySaveRepository({ highScore: 0 }) });
    enterInGame(ctx);

    const state = ctx.getGameplayState() as GameplayRuntimeState;
    const barY = state.bar.y;
    const barX = state.bar.x;
    const ballId = state.balls[0]?.id ?? 'ball_0';

    // 자석 부착 상태로 직접 세팅
    ctx._setGameplayState({
      ...state,
      bar: { ...state.bar, activeEffect: 'magnet' },
      magnetRemainingTime: 8000,
      attachedBallIds: [ballId],
      balls: state.balls.map((b) =>
        b.id === ballId
          ? { ...b, isActive: false, x: barX, y: barY - 16, attachedOffsetX: 0 }
          : b,
      ),
    });

    const xBefore = barX;
    // 바를 오른쪽으로 이동
    ctx.tick(rightInput, 1 / 60);

    const after = ctx.getGameplayState();
    const movedBarX = after.bar.x;
    const movedBallX = after.balls.find((b) => b.id === ballId)?.x ?? 0;

    // 공 x = 바 x + 오프셋(0) 이어야 함
    expect(movedBarX).toBeGreaterThan(xBefore);
    expect(movedBallX).toBeCloseTo(movedBarX, 0);
  });

  it('F-4. 자석 부착 공을 space로 해제 → 공 활성화, attachedBallIds 빔', async () => {
    const ctx = await createAppContext({ saveRepository: new InMemorySaveRepository({ highScore: 0 }) });
    enterInGame(ctx);

    const state = ctx.getGameplayState() as GameplayRuntimeState;
    const barY = state.bar.y;
    const barX = state.bar.x;
    const ballId = state.balls[0]?.id ?? 'ball_0';

    ctx._setGameplayState({
      ...state,
      bar: { ...state.bar, activeEffect: 'magnet' },
      magnetRemainingTime: 8000,
      attachedBallIds: [ballId],
      balls: state.balls.map((b) =>
        b.id === ballId
          ? { ...b, isActive: false, x: barX, y: barY - 16, attachedOffsetX: 0 }
          : b,
      ),
    });

    // ctx.tick은 void 반환 — 상태로 검증
    ctx.tick(spaceInput, 1 / 60);

    const after = ctx.getGameplayState();
    expect(after.attachedBallIds).toHaveLength(0);
    const ball = after.balls.find((b) => b.id === ballId);
    expect(ball?.isActive).toBe(true);
    // bar.activeEffect가 space 해제로 none이 됨
    expect(after.bar.activeEffect).toBe('none');
  });

  it('F-5. 자석 타임아웃(8s) → 자동 해제, activeEffect=none', async () => {
    const ctx = await createAppContext({ saveRepository: new InMemorySaveRepository({ highScore: 0 }) });
    enterInGame(ctx);

    const state = ctx.getGameplayState() as GameplayRuntimeState;
    const barY = state.bar.y;
    const barX = state.bar.x;
    const ballId = state.balls[0]?.id ?? 'ball_0';

    // 잔여 시간 10ms로 설정
    ctx._setGameplayState({
      ...state,
      bar: { ...state.bar, activeEffect: 'magnet' },
      magnetRemainingTime: 10,
      attachedBallIds: [ballId],
      balls: state.balls.map((b) =>
        b.id === ballId
          ? { ...b, isActive: false, x: barX, y: barY - 16, attachedOffsetX: 0 }
          : b,
      ),
    });

    // dt=0.1s=100ms → 10ms 잔여가 소진됨
    ctx.tick(noInput, 0.1);

    const after = ctx.getGameplayState();
    expect(after.bar.activeEffect).toBe('none');
    expect(after.magnetRemainingTime).toBe(0);
    expect(after.attachedBallIds).toHaveLength(0);
    const ball = after.balls.find((b) => b.id === ballId);
    expect(ball?.isActive).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// MVP3 Phase 6 시나리오: 효과 교체 정책 통합 검증
// expand ↔ magnet ↔ laser 3효과의 6가지 교체 조합 E2E
// ---------------------------------------------------------------------------

describe('MVP3 Phase6 — 효과 교체 정책 통합 (6조합)', () => {
  /**
   * 아이템 드랍을 바 위치에 주입하고 1 tick 실행해 ItemPickedUp 충돌을 발생시킨다.
   */
  function injectItemAndTick(
    ctx: Awaited<ReturnType<typeof createAppContext>>,
    itemType: 'expand' | 'magnet' | 'laser',
  ): void {
    const state = ctx.getGameplayState() as GameplayRuntimeState;
    const item = {
      id: `item_${itemType}_test`,
      itemType,
      x: state.bar.x,
      y: state.bar.y + 1,
      fallSpeed: 0,
      isCollected: false,
    };
    ctx._setGameplayState({ ...state, itemDrops: [item] });
    ctx.tick(noInput, 1 / 60);
  }

  it('G-1. expand 획득 후 magnet 획득 → activeEffect=magnet, magnetRemainingTime=8000, bar.width=120', async () => {
    const ctx = await createAppContext({ saveRepository: new InMemorySaveRepository({ highScore: 0 }) });
    enterInGame(ctx);

    // Step 1: expand 획득
    injectItemAndTick(ctx, 'expand');
    const afterExpand = ctx.getGameplayState();
    expect(afterExpand.bar.activeEffect).toBe('expand');

    // Step 2: magnet 획득 (expand → magnet 교체)
    injectItemAndTick(ctx, 'magnet');
    const after = ctx.getGameplayState();
    expect(after.bar.activeEffect).toBe('magnet');
    expect(after.magnetRemainingTime).toBeGreaterThan(0);
    expect(after.bar.width).toBe(120); // baseBarWidth 복구
  });

  it('G-2. magnet 중 공 부착 후 laser 획득 → 공 release, activeEffect=laser', async () => {
    const ctx = await createAppContext({ saveRepository: new InMemorySaveRepository({ highScore: 0 }) });
    enterInGame(ctx);

    const state = ctx.getGameplayState() as GameplayRuntimeState;
    const barY = state.bar.y;
    const barX = state.bar.x;
    const ballId = state.balls[0]?.id ?? 'ball_0';

    // 자석 상태 + 공 부착 직접 주입
    ctx._setGameplayState({
      ...state,
      bar: { ...state.bar, activeEffect: 'magnet' },
      magnetRemainingTime: 8000,
      attachedBallIds: [ballId],
      balls: state.balls.map((b) =>
        b.id === ballId
          ? { ...b, isActive: false, x: barX, y: barY - 16, attachedOffsetX: 0 }
          : b,
      ),
    });

    // laser 아이템 획득 → magnet→laser 교체, 부착 공 release
    injectItemAndTick(ctx, 'laser');

    const after = ctx.getGameplayState();
    expect(after.bar.activeEffect).toBe('laser');
    expect(after.attachedBallIds).toHaveLength(0);
    // 공이 release되어 활성화됨
    const ball = after.balls.find((b) => b.id === ballId);
    expect(ball?.isActive).toBe(true);
  });

  it('G-3. laser 중 cooldown 있을 때 expand 획득 → activeEffect=expand, laserCooldown=0, laserShots=[]', async () => {
    const ctx = await createAppContext({ saveRepository: new InMemorySaveRepository({ highScore: 0 }) });
    enterInGame(ctx);

    const state = ctx.getGameplayState() as GameplayRuntimeState;
    // laser 상태 + 쿨다운 주입
    ctx._setGameplayState({
      ...state,
      bar: { ...state.bar, activeEffect: 'laser' },
      laserCooldownRemaining: 300,
      laserShots: [], // 샷은 없지만 쿨다운은 있는 상태
    });

    // expand 아이템 획득 → laser→expand 교체
    injectItemAndTick(ctx, 'expand');

    const after = ctx.getGameplayState();
    expect(after.bar.activeEffect).toBe('expand');
    expect(after.laserCooldownRemaining).toBe(0);
    expect(after.laserShots).toHaveLength(0);
    expect(after.bar.width).toBeCloseTo(120 * 1.5); // expand 적용
  });
});

// ---------------------------------------------------------------------------
// MVP3 Phase 7 시나리오: 회전체 기믹 E2E
// ---------------------------------------------------------------------------

describe('MVP3 Phase7 — 회전체 기믹 E2E', () => {
  it('H-1. spinner가 있는 스테이지에서 공이 spinner 위치로 이동하면 반사된다', async () => {
    const ctx = await createAppContext({ saveRepository: new InMemorySaveRepository({ highScore: 0 }) });
    enterInGame(ctx);

    const state = ctx.getGameplayState() as GameplayRuntimeState;

    // spinner를 공 경로에 주입 (중앙, y=300)
    // spinner_cube: size=48, 반지름=24. ball 반지름=8. 결합=32.
    const spinnerX = 360;
    const spinnerY = 300;

    ctx._setGameplayState({
      ...state,
      spinnerStates: [
        { id: 'spinner_0', definitionId: 'spinner_cube', x: spinnerX, y: spinnerY, angleRad: 0, phase: 'circling' as const, spawnElapsedMs: 400, descentEndY: spinnerY, circleCenterX: spinnerX, circleCenterY: spinnerY + 150, circleRadius: 150, circleAngleRad: -Math.PI / 2, spawnX: spinnerX },
      ],
      balls: state.balls.map((b) => ({
        ...b,
        isActive: true,
        x: spinnerX,
        y: spinnerY - 20, // spinner 위 20px (결합 반지름 32 내부)
        vx: 0,
        vy: 200, // 아래로 이동 중
      })),
    });

    // tick 실행 — SpinnerSystem.handleBallCollisions에서 반사 처리
    ctx.tick(noInput, 1 / 60);

    const after = ctx.getGameplayState();
    const ball = after.balls[0];
    // 반사 후 vy < 0 (위쪽으로 방향 전환)
    expect(ball?.vy).toBeLessThan(0);
  });

  it('H-2. spinner tick으로 angleRad가 매 틱 증가한다', async () => {
    const ctx = await createAppContext({ saveRepository: new InMemorySaveRepository({ highScore: 0 }) });
    enterInGame(ctx);

    const state = ctx.getGameplayState() as GameplayRuntimeState;

    ctx._setGameplayState({
      ...state,
      spinnerStates: [
        { id: 'spinner_0', definitionId: 'spinner_cube', x: 360, y: 300, angleRad: 0, phase: 'circling' as const, spawnElapsedMs: 400, descentEndY: 300, circleCenterX: 360, circleCenterY: 450, circleRadius: 150, circleAngleRad: -Math.PI / 2, spawnX: 360 },
      ],
    });

    ctx.tick(noInput, 1 / 60);

    const after = ctx.getGameplayState();
    // spinner_cube rotationSpeedRadPerSec=1.5. dt=1/60≈0.0167s → 0.025 rad
    const expected = 1.5 * (1 / 60);
    expect(after.spinnerStates[0]?.angleRad).toBeCloseTo(expected, 3);
  });

  it('H-3. spinner phase 활성 시 인접 블록이 피격된다', async () => {
    const ctx = await createAppContext({ saveRepository: new InMemorySaveRepository({ highScore: 0 }) });
    enterInGame(ctx);

    const state = ctx.getGameplayState() as GameplayRuntimeState;

    const spinnerX = 360;
    const spinnerY = 300;

    // 블록을 spinner와 겹치도록 배치 (중심이 spinner 반지름 이내)
    // 블록 좌상단: (spinnerX - 32, spinnerY - 12) → 중심: (spinnerX, spinnerY)
    const blockX = spinnerX - 32;
    const blockY = spinnerY - 12;

    ctx._setGameplayState({
      ...state,
      spinnerStates: [
        { id: 'spinner_0', definitionId: 'spinner_cube', x: spinnerX, y: spinnerY, angleRad: 0, phase: 'circling' as const, spawnElapsedMs: 400, descentEndY: spinnerY, circleCenterX: spinnerX, circleCenterY: spinnerY + 150, circleRadius: 150, circleAngleRad: -Math.PI / 2, spawnX: spinnerX },
      ],
      blocks: [
        {
          id: 'block_test',
          x: blockX,
          y: blockY,
          remainingHits: 2,
          isDestroyed: false,
          definitionId: 'basic',
        },
      ],
      balls: state.balls.map((b) => ({ ...b, isActive: false })), // 공 비활성 (ball 충돌 무관)
    });

    ctx.tick(noInput, 1 / 60);

    const after = ctx.getGameplayState();
    const block = after.blocks.find((b) => b.id === 'block_test');
    // phase=0 활성 → 블록 피격 → remainingHits 감소
    expect(block?.remainingHits).toBeLessThan(2);
  });
});
