import { describe, it, expect } from 'vitest';
import { createAppContext } from './createAppContext';
import type { InputSnapshot } from '../input/InputSnapshot';

const noInput: InputSnapshot = {
  leftDown: false,
  rightDown: false,
  spaceJustPressed: false,
};

const spaceInput: InputSnapshot = {
  leftDown: false,
  rightDown: false,
  spaceJustPressed: true,
};

const leftInput: InputSnapshot = {
  leftDown: true,
  rightDown: false,
  spaceJustPressed: false,
};

describe('AppContext — Title 상태', () => {
  it('초기 상태는 title', () => {
    const ctx = createAppContext();
    expect(ctx.getFlowState().kind).toBe('title');
  });

  it('Title 상태에서 tick: leftDown=true 여도 바 이동 없음 (Gameplay 틱 비활성)', () => {
    const ctx = createAppContext();
    const barXBefore = ctx.getGameplayState().bar.x;
    ctx.tick(leftInput, 1 / 60);
    expect(ctx.getGameplayState().bar.x).toBe(barXBefore);
  });
});

describe('AppContext — Title → RoundIntro: Stage 1 로드', () => {
  it('스페이스 입력 시 RoundIntro 로 전이', () => {
    const ctx = createAppContext();
    ctx.tick(spaceInput, 1 / 60);
    expect(ctx.getFlowState().kind).toBe('roundIntro');
  });

  it('스페이스 입력 후 블록 65개 로드됨', () => {
    const ctx = createAppContext();
    ctx.tick(spaceInput, 1 / 60);
    expect(ctx.getGameplayState().blocks).toHaveLength(65);
  });

  it('스페이스 입력 후 score=0, lives=3', () => {
    const ctx = createAppContext();
    ctx.tick(spaceInput, 1 / 60);
    const state = ctx.getGameplayState();
    expect(state.session.score).toBe(0);
    expect(state.session.lives).toBe(3);
  });
});

describe('AppContext — RoundIntro → InGame → 바 이동', () => {
  it('RoundIntroFinished 수신 후 inGame 으로 전이', () => {
    const ctx = createAppContext();
    ctx.tick(spaceInput, 1 / 60); // → roundIntro
    ctx.handlePresentationEvent({ type: 'RoundIntroFinished' });
    expect(ctx.getFlowState().kind).toBe('inGame');
  });

  it('InGame 에서 leftDown=true tick 시 바 이동', () => {
    const ctx = createAppContext();
    ctx.tick(spaceInput, 1 / 60); // → roundIntro
    ctx.handlePresentationEvent({ type: 'RoundIntroFinished' }); // → inGame
    const barXBefore = ctx.getGameplayState().bar.x;
    ctx.tick(leftInput, 1 / 60);
    expect(ctx.getGameplayState().bar.x).toBeLessThan(barXBefore);
  });
});

/**
 * 공이 바닥에 떨어질 때까지 틱을 반복한다.
 * 최대 maxTicks 번 반복 후에도 상태가 바뀌지 않으면 중단한다.
 * 작은 dt(1/60)로 반복해 충돌 감지가 프레임 단위로 동작하도록 한다.
 */
function tickUntilFlowChanges(
  ctx: ReturnType<typeof createAppContext>,
  fromKind: string,
  maxTicks = 600,
): void {
  const dt = 1 / 60;
  for (let i = 0; i < maxTicks; i++) {
    if (ctx.getFlowState().kind !== fromKind) break;
    ctx.tick(noInput, dt);
  }
}

describe('AppContext — InGame 공 바닥 이탈 → LifeLost → RoundIntro → resetForRetry', () => {
  it('LifeLost 게임플레이 이벤트가 Flow 에 전달되어 RoundIntro 전이', () => {
    const ctx = createAppContext();
    ctx.tick(spaceInput, 1 / 60); // → roundIntro
    ctx.handlePresentationEvent({ type: 'RoundIntroFinished' }); // → inGame

    // 공 발사
    ctx.tick(spaceInput, 1 / 60);

    // 공이 바닥에 떨어질 때까지 tick (최대 10초 상당 = 600 프레임)
    tickUntilFlowChanges(ctx, 'inGame');

    // LifeLost 또는 GameOver 중 하나로 전이했는지 확인
    const kind = ctx.getFlowState().kind;
    expect(kind === 'roundIntro' || kind === 'gameOver').toBe(true);
  });

  it('LifeLost 후 RoundIntro 전이 시 블록 수 유지 (resetForRetry)', () => {
    const ctx = createAppContext();
    ctx.tick(spaceInput, 1 / 60); // → roundIntro
    ctx.handlePresentationEvent({ type: 'RoundIntroFinished' }); // → inGame
    ctx.tick(spaceInput, 1 / 60); // 공 발사

    const blocksBeforeLifeLost = ctx.getGameplayState().blocks.length;

    // 공이 바닥에 떨어질 때까지 tick
    tickUntilFlowChanges(ctx, 'inGame');

    if (ctx.getFlowState().kind === 'roundIntro') {
      // resetForRetry 가 실행됐으면 블록 수 동일해야 함
      expect(ctx.getGameplayState().blocks.length).toBe(blocksBeforeLifeLost);
    }
  });
});

/**
 * inGame 상태에서 공을 발사하고 바를 왼쪽 끝으로 이동시켜 공이 바닥에 떨어지게 한다.
 * 공이 발사 직후 위쪽으로 올라가다가 반사되어 내려오면 바가 없으므로 바닥을 통과한다.
 * RoundIntro 전이 시 자동으로 InGame 으로 다시 진입한다.
 * lives 를 전부 소진하면 gameOver 상태가 된다.
 */
function drainAllLives(ctx: ReturnType<typeof createAppContext>): void {
  const moveLeft: InputSnapshot = { leftDown: true, rightDown: false, spaceJustPressed: false };
  const launchAndMoveLeft: InputSnapshot = { leftDown: true, rightDown: false, spaceJustPressed: true };
  const dt = 1 / 60;

  for (let attempt = 0; attempt < 6; attempt++) {
    if (ctx.getFlowState().kind === 'gameOver') break;
    if (ctx.getFlowState().kind === 'roundIntro') {
      ctx.handlePresentationEvent({ type: 'RoundIntroFinished' });
    }
    if (ctx.getFlowState().kind === 'inGame') {
      // 공을 발사하면서 동시에 바를 왼쪽으로 이동 → 공이 바닥에 떨어지도록
      ctx.tick(launchAndMoveLeft, dt);
      // 바를 계속 왼쪽으로 밀면서 공이 바닥에 떨어지길 기다림 (최대 15초)
      for (let i = 0; i < 900 && ctx.getFlowState().kind === 'inGame'; i++) {
        ctx.tick(moveLeft, dt);
      }
    }
  }
}

describe('AppContext — GameOver 시나리오', () => {
  it('3번 바닥 이탈 후 GameOver', () => {
    const ctx = createAppContext();
    ctx.tick(spaceInput, 1 / 60); // → roundIntro
    drainAllLives(ctx);
    expect(ctx.getFlowState().kind).toBe('gameOver');
  });

  it('GameOver 에서 스페이스 입력으로 Title 복귀', () => {
    const ctx = createAppContext();
    ctx.tick(spaceInput, 1 / 60); // → roundIntro
    drainAllLives(ctx);
    expect(ctx.getFlowState().kind).toBe('gameOver');

    ctx.tick(spaceInput, 1 / 60); // GameOver → Title
    expect(ctx.getFlowState().kind).toBe('title');
  });
});

describe('AppContext — Title 복귀 후 재시작 시 Stage 1 재로드', () => {
  it('GameOver → Title → Space → blocks=65 (새 게임 초기화)', () => {
    const ctx = createAppContext();

    ctx.tick(spaceInput, 1 / 60); // → roundIntro
    drainAllLives(ctx);
    expect(ctx.getFlowState().kind).toBe('gameOver');

    ctx.tick(spaceInput, 1 / 60); // → title
    expect(ctx.getFlowState().kind).toBe('title');

    // 새 게임 시작
    ctx.tick(spaceInput, 1 / 60); // → roundIntro
    expect(ctx.getFlowState().kind).toBe('roundIntro');
    expect(ctx.getGameplayState().blocks).toHaveLength(65);
    expect(ctx.getGameplayState().session.score).toBe(0);
    expect(ctx.getGameplayState().session.lives).toBe(3);
  });
});
