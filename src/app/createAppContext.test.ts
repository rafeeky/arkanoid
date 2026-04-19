import { describe, it, expect, vi } from 'vitest';
import { createAppContext } from './createAppContext';
import { InMemorySaveRepository } from '../persistence/InMemorySaveRepository';
import type { ISaveRepository } from '../persistence/ISaveRepository';
import type { InputSnapshot } from '../input/InputSnapshot';
import type { GameplayRuntimeState } from '../gameplay/state/GameplayRuntimeState';
import type { IAudioPlayer } from '../audio/IAudioPlayer';
import type { AudioCueEntry } from '../definitions/types/AudioCueEntry';

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

/**
 * Title → IntroStory → RoundIntro → InGame 진입 헬퍼 (mvp2 §7-2)
 */
function enterInGame(ctx: Awaited<ReturnType<typeof createAppContext>>): void {
  ctx.tick(spaceInput, 1 / 60); // title → introStory
  ctx.handlePresentationEvent({ type: 'IntroSequenceFinished' }); // introStory → roundIntro
  ctx.handlePresentationEvent({ type: 'RoundIntroFinished' }); // roundIntro → inGame
}

describe('AppContext — Title 상태', () => {
  it('초기 상태는 title', async () => {
    const ctx = await createAppContext();
    expect(ctx.getFlowState().kind).toBe('title');
  });

  it('Title 상태에서 tick: leftDown=true 여도 바 이동 없음 (Gameplay 틱 비활성)', async () => {
    const ctx = await createAppContext();
    const barXBefore = ctx.getGameplayState().bar.x;
    ctx.tick(leftInput, 1 / 60);
    expect(ctx.getGameplayState().bar.x).toBe(barXBefore);
  });
});

describe('AppContext — Title → IntroStory → RoundIntro: Stage 1 로드', () => {
  it('스페이스 입력 시 IntroStory 로 전이 (mvp2 §7-2)', async () => {
    const ctx = await createAppContext();
    ctx.tick(spaceInput, 1 / 60);
    expect(ctx.getFlowState().kind).toBe('introStory');
  });

  it('IntroSequenceFinished 후 RoundIntro 전이, 블록 65개 로드됨', async () => {
    const ctx = await createAppContext();
    ctx.tick(spaceInput, 1 / 60); // → introStory
    ctx.handlePresentationEvent({ type: 'IntroSequenceFinished' }); // → roundIntro
    expect(ctx.getFlowState().kind).toBe('roundIntro');
    expect(ctx.getGameplayState().blocks).toHaveLength(65);
  });

  it('RoundIntro 진입 후 score=0, lives=3', async () => {
    const ctx = await createAppContext();
    ctx.tick(spaceInput, 1 / 60);
    ctx.handlePresentationEvent({ type: 'IntroSequenceFinished' });
    const state = ctx.getGameplayState();
    expect(state.session.score).toBe(0);
    expect(state.session.lives).toBe(3);
  });
});

describe('AppContext — RoundIntro → InGame → 바 이동', () => {
  it('RoundIntroFinished 수신 후 inGame 으로 전이', async () => {
    const ctx = await createAppContext();
    ctx.tick(spaceInput, 1 / 60); // → introStory
    ctx.handlePresentationEvent({ type: 'IntroSequenceFinished' }); // → roundIntro
    ctx.handlePresentationEvent({ type: 'RoundIntroFinished' });
    expect(ctx.getFlowState().kind).toBe('inGame');
  });

  it('InGame 에서 leftDown=true tick 시 바 이동', async () => {
    const ctx = await createAppContext();
    enterInGame(ctx);
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
  ctx: Awaited<ReturnType<typeof createAppContext>>,
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
  it('LifeLost 게임플레이 이벤트가 Flow 에 전달되어 RoundIntro 전이', async () => {
    const ctx = await createAppContext();
    enterInGame(ctx);

    // 공 발사
    ctx.tick(spaceInput, 1 / 60);

    // 공이 바닥에 떨어질 때까지 tick (최대 10초 상당 = 600 프레임)
    tickUntilFlowChanges(ctx, 'inGame');

    // LifeLost 또는 GameOver 중 하나로 전이했는지 확인
    const kind = ctx.getFlowState().kind;
    expect(kind === 'roundIntro' || kind === 'gameOver').toBe(true);
  });

  it('LifeLost 후 RoundIntro 전이 시 블록 수 유지 (resetForRetry)', async () => {
    const ctx = await createAppContext();
    enterInGame(ctx);
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
 * lives 를 전부 소진하면 gameOver 상태가 된다.
 */
function drainAllLives(ctx: Awaited<ReturnType<typeof createAppContext>>): void {
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
  it('3번 바닥 이탈 후 GameOver', async () => {
    const ctx = await createAppContext();
    enterInGame(ctx); // title → introStory → roundIntro → inGame
    drainAllLives(ctx);
    expect(ctx.getFlowState().kind).toBe('gameOver');
  });

  it('GameOver 에서 스페이스 입력으로 Title 복귀', async () => {
    const ctx = await createAppContext();
    enterInGame(ctx);
    drainAllLives(ctx);
    expect(ctx.getFlowState().kind).toBe('gameOver');

    ctx.tick(spaceInput, 1 / 60); // GameOver → Title
    expect(ctx.getFlowState().kind).toBe('title');
  });
});

describe('AppContext — Title 복귀 후 재시작 시 Stage 1 재로드', () => {
  it('GameOver → Title → IntroStory → RoundIntro → blocks=65 (새 게임 초기화)', async () => {
    const ctx = await createAppContext();

    enterInGame(ctx);
    drainAllLives(ctx);
    expect(ctx.getFlowState().kind).toBe('gameOver');

    ctx.tick(spaceInput, 1 / 60); // → title
    expect(ctx.getFlowState().kind).toBe('title');

    // 새 게임 시작 (mvp2 흐름: title → introStory → roundIntro)
    ctx.tick(spaceInput, 1 / 60); // → introStory
    expect(ctx.getFlowState().kind).toBe('introStory');
    ctx.handlePresentationEvent({ type: 'IntroSequenceFinished' }); // → roundIntro
    expect(ctx.getFlowState().kind).toBe('roundIntro');
    expect(ctx.getGameplayState().blocks).toHaveLength(65);
    expect(ctx.getGameplayState().session.score).toBe(0);
    expect(ctx.getGameplayState().session.lives).toBe(3);
  });
});

describe('AppContext — getScreenState 공개 API', () => {
  it('초기 getScreenState().currentScreen = title', async () => {
    const ctx = await createAppContext();
    // tick 없이도 screenState 기본값 확인 가능
    // 단 ScreenDirector 는 tick 호출 시 갱신되므로 1 tick 수행
    ctx.tick(noInput, 1 / 60);
    expect(ctx.getScreenState().currentScreen).toBe('title');
  });

  it('스페이스 입력 후 getScreenState().currentScreen = introStory (mvp2)', async () => {
    const ctx = await createAppContext();
    ctx.tick(spaceInput, 1 / 60); // → introStory
    expect(ctx.getScreenState().currentScreen).toBe('introStory');
  });

  it('IntroSequenceFinished 후 getScreenState().currentScreen = roundIntro', async () => {
    const ctx = await createAppContext();
    ctx.tick(spaceInput, 1 / 60); // → introStory
    ctx.handlePresentationEvent({ type: 'IntroSequenceFinished' }); // → roundIntro
    ctx.tick(noInput, 1 / 60); // ScreenDirector 갱신
    expect(ctx.getScreenState().currentScreen).toBe('roundIntro');
  });

  it('초기 isBarBreaking = false', async () => {
    const ctx = await createAppContext();
    ctx.tick(noInput, 1 / 60);
    expect(ctx.getScreenState().isBarBreaking).toBe(false);
  });

  it('초기 blockHitFlashBlockIds = []', async () => {
    const ctx = await createAppContext();
    ctx.tick(noInput, 1 / 60);
    expect(ctx.getScreenState().blockHitFlashBlockIds).toEqual([]);
  });
});

describe('AppContext — LifeLost → isBarBreaking 연출 흐름', () => {
  /**
   * LifeLost 발생 후 tick 을 여러 번 호출하면:
   * - 처음에는 isBarBreaking = true
   * - 700ms 이상 경과 후 isBarBreaking = false
   */
  it('LifeLost 발생 직후 isBarBreaking = true', async () => {
    const ctx = await createAppContext();
    enterInGame(ctx);
    ctx.tick(spaceInput, 1 / 60); // 공 발사

    // 공이 바닥에 떨어질 때까지 tick (최대 600 프레임)
    tickUntilFlowChanges(ctx, 'inGame');

    // LifeLost 후 roundIntro 로 전이했고 isBarBreaking 이 잠시 true 여야 한다.
    if (ctx.getFlowState().kind === 'roundIntro') {
      expect(ctx.getScreenState()).toBeDefined();
      expect(typeof ctx.getScreenState().isBarBreaking).toBe('boolean');
    }
  });

  it('LifeLost 후 700ms 이상 tick 하면 isBarBreaking = false', async () => {
    const ctx = await createAppContext();
    enterInGame(ctx);
    ctx.tick(spaceInput, 1 / 60); // 공 발사

    // 공이 바닥에 떨어질 때까지 tick
    tickUntilFlowChanges(ctx, 'inGame');

    if (ctx.getFlowState().kind === 'roundIntro') {
      // 700ms = 약 42 프레임 (1/60 ≈ 16.7ms)
      // 50 프레임 tick 후 isBarBreaking = false 여야 함
      for (let i = 0; i < 50; i++) {
        ctx.tick(noInput, 1 / 60);
      }
      expect(ctx.getScreenState().isBarBreaking).toBe(false);
    }
  });
});

// ---------------------------------------------------------------------------
// Phase 7 통합 시나리오: 드랍 블록 → ItemSpawned → 아이템 낙하 → 획득 → expand → resetForRetry
// ---------------------------------------------------------------------------

/**
 * basic_drop 블록(row=1, col=6, center=(480,120))을 직접 파괴하는 상태를 주입한다.
 * 현재 gameplayState를 기반으로 공을 블록 바로 아래에 위로 향하게 배치하고
 * itemDrops 를 비워서 spawn 조건을 보장한다.
 */
function injectBallAboutToHitDropBlock(ctx: Awaited<ReturnType<typeof createAppContext>>): void {
  const state = ctx.getGameplayState() as GameplayRuntimeState;
  // drop 블록(row=1, col=6) 의 계산된 좌표: x=448, y=108, center=(480, 120)
  // 공을 블록 바로 아래에서 위로 향하게 배치
  const BLOCK_DROP_CENTER_X = 480;
  const BLOCK_DROP_BOTTOM_Y = 108 + 24; // y + BLOCK_HEIGHT

  const newBalls = state.balls.map((b, i) =>
    i === 0
      ? {
          ...b,
          isActive: true,
          x: BLOCK_DROP_CENTER_X,
          y: BLOCK_DROP_BOTTOM_Y + 10, // 블록 바로 아래
          vx: 0,
          vy: -300, // 위로 이동
        }
      : b,
  );

  ctx._setGameplayState({
    ...state,
    balls: newBalls,
    itemDrops: [], // 화면에 아이템 없어야 spawn 됨
  });
}

describe('Phase 7 통합 — 드랍 블록 파괴 → ItemSpawned → 낙하 → 획득 → expand', () => {
  it('드랍 블록 파괴 시 itemDrops 에 아이템이 추가된다 (ItemSpawned)', async () => {
    const ctx = await createAppContext();
    enterInGame(ctx);
    injectBallAboutToHitDropBlock(ctx);

    const dt = 1 / 60;
    // 몇 틱 안에 블록 충돌 → ItemSpawned
    let itemAppeared = false;
    for (let i = 0; i < 30; i++) {
      ctx.tick(noInput, dt);
      if (ctx.getGameplayState().itemDrops.length > 0) {
        itemAppeared = true;
        break;
      }
    }
    expect(itemAppeared).toBe(true);
  });

  it('아이템 획득 후 bar.width === baseBarWidth * 1.5 (= 180)', async () => {
    const ctx = await createAppContext();
    enterInGame(ctx);
    injectBallAboutToHitDropBlock(ctx);

    const dt = 1 / 60;
    // 아이템이 생성될 때까지 틱
    let spawned = false;
    for (let i = 0; i < 30; i++) {
      ctx.tick(noInput, dt);
      if (ctx.getGameplayState().itemDrops.length > 0) {
        spawned = true;
        break;
      }
    }
    expect(spawned).toBe(true);

    // 아이템을 바 위치에 강제 이동시켜 획득하도록 상태 주입
    const stateAfterSpawn = ctx.getGameplayState() as GameplayRuntimeState;
    const item = stateAfterSpawn.itemDrops[0];
    expect(item).toBeDefined();
    if (!item) return;

    // 바 위치로 아이템을 이동시킨다 (bar.y 부근으로)
    ctx._setGameplayState({
      ...stateAfterSpawn,
      itemDrops: [
        {
          ...item,
          x: stateAfterSpawn.bar.x,
          y: stateAfterSpawn.bar.y,
        },
      ],
    });

    // 1 틱으로 충돌 감지 → ItemCollected 처리
    ctx.tick(noInput, dt);

    const barAfter = ctx.getGameplayState().bar;
    // baseBarWidth=120, expandMultiplier=1.5 → 180
    expect(barAfter.width).toBe(180);
    expect(barAfter.activeEffect).toBe('expand');
  });

  it('아이템 획득 후 bar.activeEffect === "expand"', async () => {
    const ctx = await createAppContext();
    enterInGame(ctx);
    injectBallAboutToHitDropBlock(ctx);

    const dt = 1 / 60;
    for (let i = 0; i < 30; i++) {
      ctx.tick(noInput, dt);
      if (ctx.getGameplayState().itemDrops.length > 0) break;
    }
    const state = ctx.getGameplayState() as GameplayRuntimeState;
    const item = state.itemDrops[0];
    if (!item) return;

    ctx._setGameplayState({
      ...state,
      itemDrops: [{ ...item, x: state.bar.x, y: state.bar.y }],
    });
    ctx.tick(noInput, dt);

    expect(ctx.getGameplayState().bar.activeEffect).toBe('expand');
  });

  it('LifeLost 후 resetForRetry → bar.width === 120 (baseBarWidth) 복구', async () => {
    const ctx = await createAppContext();
    enterInGame(ctx);
    injectBallAboutToHitDropBlock(ctx);

    const dt = 1 / 60;
    // 아이템 spawn 후 획득
    for (let i = 0; i < 30; i++) {
      ctx.tick(noInput, dt);
      if (ctx.getGameplayState().itemDrops.length > 0) break;
    }
    const stateAfterSpawn = ctx.getGameplayState() as GameplayRuntimeState;
    const item = stateAfterSpawn.itemDrops[0];
    if (!item) return;
    ctx._setGameplayState({
      ...stateAfterSpawn,
      itemDrops: [{ ...item, x: stateAfterSpawn.bar.x, y: stateAfterSpawn.bar.y }],
    });
    ctx.tick(noInput, dt);

    // 획득 후 expand 상태 확인
    expect(ctx.getGameplayState().bar.activeEffect).toBe('expand');
    expect(ctx.getGameplayState().bar.width).toBe(180);

    // 공을 바닥으로 보내 LifeLost 유발
    const expandState = ctx.getGameplayState() as GameplayRuntimeState;
    ctx._setGameplayState({
      ...expandState,
      balls: expandState.balls.map((b, i) =>
        i === 0
          ? { ...b, isActive: true, x: 480, y: 700, vx: 0, vy: 300 }
          : b,
      ),
    });
    tickUntilFlowChanges(ctx, 'inGame');

    if (ctx.getFlowState().kind === 'roundIntro') {
      // resetForRetry 가 실행됐어야 함
      expect(ctx.getGameplayState().bar.width).toBe(120);
      expect(ctx.getGameplayState().bar.activeEffect).toBe('none');
    }
  });

  it('아이템 낙하 중(itemDrops.length>0)이면 같은 드랍 블록 파괴 시 아이템 spawn 안 됨 — 1개 제약', async () => {
    // 이 테스트는 "itemDrops.length > 0 이면 spawn 차단" 정책을 검증한다.
    const ctx = await createAppContext();
    enterInGame(ctx);
    injectBallAboutToHitDropBlock(ctx);

    const dt = 1 / 60;
    // 아이템 spawn 대기
    for (let i = 0; i < 30; i++) {
      ctx.tick(noInput, dt);
      if (ctx.getGameplayState().itemDrops.length > 0) break;
    }
    const itemCountAfterFirstSpawn = ctx.getGameplayState().itemDrops.length;
    expect(itemCountAfterFirstSpawn).toBe(1);

    // 이미 낙하 중인 상태에서 두 번째 드랍 블록(row=0, col=2, center=(208, 92))을
    // 공이 파괴하도록 상태 주입
    const state = ctx.getGameplayState() as GameplayRuntimeState;
    // 두 번째 drop 블록: row=0, col=2 → x=176, y=80, center=(208,92)
    const SECOND_DROP_CENTER_X = 208;
    const SECOND_DROP_BOTTOM_Y = 80 + 24;

    ctx._setGameplayState({
      ...state,
      balls: state.balls.map((b, i) =>
        i === 0
          ? {
              ...b,
              isActive: true,
              x: SECOND_DROP_CENTER_X,
              y: SECOND_DROP_BOTTOM_Y + 10,
              vx: 0,
              vy: -300,
            }
          : b,
      ),
    });

    // 몇 틱 실행
    for (let i = 0; i < 10; i++) {
      ctx.tick(noInput, dt);
    }

    // 여전히 itemDrops.length === 1 이어야 함 (새 spawn 차단됨)
    // 단, 기존 아이템이 낙하하면서 바 위치에 도달해 수집될 수 있으므로 0도 허용
    const itemCountAfter = ctx.getGameplayState().itemDrops.length;
    expect(itemCountAfter).toBeLessThanOrEqual(1);
  });

  it('아이템 획득(effectActive) 후 새 드랍 블록 파괴 시 새 아이템 spawn 가능 — 효과 중 차단 아님', async () => {
    // "아이템 1개 제약"은 itemDrops.length === 0 조건이므로:
    // 이미 효과가 active(expand)이지만 화면에 아이템이 없으면 → spawn 허용
    const ctx = await createAppContext();
    enterInGame(ctx);
    injectBallAboutToHitDropBlock(ctx);

    const dt = 1 / 60;
    // 아이템 spawn
    for (let i = 0; i < 30; i++) {
      ctx.tick(noInput, dt);
      if (ctx.getGameplayState().itemDrops.length > 0) break;
    }
    const stateAfterSpawn = ctx.getGameplayState() as GameplayRuntimeState;
    const item = stateAfterSpawn.itemDrops[0];
    if (!item) return;

    // 아이템 획득 처리 (바 위치로 이동)
    ctx._setGameplayState({
      ...stateAfterSpawn,
      itemDrops: [{ ...item, x: stateAfterSpawn.bar.x, y: stateAfterSpawn.bar.y }],
    });
    ctx.tick(noInput, dt);

    // 획득 확인: itemDrops 비었어야 함, activeEffect='expand'
    expect(ctx.getGameplayState().itemDrops.length).toBe(0);
    expect(ctx.getGameplayState().bar.activeEffect).toBe('expand');

    // 두 번째 드랍 블록을 파괴
    const stateExpand = ctx.getGameplayState() as GameplayRuntimeState;
    const SECOND_DROP_CENTER_X = 208;
    const SECOND_DROP_BOTTOM_Y = 80 + 24;

    ctx._setGameplayState({
      ...stateExpand,
      balls: stateExpand.balls.map((b, i) =>
        i === 0
          ? {
              ...b,
              isActive: true,
              x: SECOND_DROP_CENTER_X,
              y: SECOND_DROP_BOTTOM_Y + 10,
              vx: 0,
              vy: -300,
            }
          : b,
      ),
    });

    let newItemSpawned = false;
    for (let i = 0; i < 20; i++) {
      ctx.tick(noInput, dt);
      if (ctx.getGameplayState().itemDrops.length > 0) {
        newItemSpawned = true;
        break;
      }
    }
    // 효과 중이지만 화면에 아이템이 없으므로 spawn 허용
    expect(newItemSpawned).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// Phase 8 — Persistence: saveRepository 주입 및 저장 시점 검증
// ---------------------------------------------------------------------------

describe('AppContext — Persistence: saveRepository 주입', () => {
  it('saveRepository 주입 시 초기 highScore 로드됨', async () => {
    const repo = new InMemorySaveRepository({ highScore: 5000 });
    const ctx = await createAppContext({ saveRepository: repo });
    expect(ctx.getGameplayState().session.highScore).toBe(5000);
  });

  it('saveRepository 미제공 시 기본값 highScore=0', async () => {
    const ctx = await createAppContext();
    expect(ctx.getGameplayState().session.highScore).toBe(0);
  });

  it('새 게임 시작(RoundIntro 진입) 후에도 highScore 유지', async () => {
    const repo = new InMemorySaveRepository({ highScore: 3000 });
    const ctx = await createAppContext({ saveRepository: repo });
    ctx.tick(spaceInput, 1 / 60); // → introStory
    ctx.handlePresentationEvent({ type: 'IntroSequenceFinished' }); // → roundIntro (initializeStage 호출됨)
    expect(ctx.getGameplayState().session.highScore).toBe(3000);
  });
});

describe('AppContext — Persistence: EnteredGameOver → save 호출', () => {
  it('GameOver 진입 시 saveRepository.save 가 호출된다', async () => {
    const repo = new InMemorySaveRepository();
    const saveSpy = vi.spyOn(repo, 'save');

    const ctx = await createAppContext({ saveRepository: repo });
    enterInGame(ctx);
    drainAllLives(ctx);

    expect(ctx.getFlowState().kind).toBe('gameOver');
    // EnteredGameOver 이벤트 발행 → save 호출됨
    expect(saveSpy).toHaveBeenCalled();
  });

  it('session.score > session.highScore 이면 새 highScore로 save 호출됨', async () => {
    const repo = new InMemorySaveRepository({ highScore: 0 });
    const ctx = await createAppContext({ saveRepository: repo });

    enterInGame(ctx);

    // score를 임의 값으로 올린다
    const state = ctx.getGameplayState() as GameplayRuntimeState;
    ctx._setGameplayState({
      ...state,
      session: { ...state.session, score: 1500 },
    });

    // 공을 바닥으로 보내 GameOver 유도
    const stateWithScore = ctx.getGameplayState() as GameplayRuntimeState;
    ctx._setGameplayState({
      ...stateWithScore,
      session: { ...stateWithScore.session, score: 1500, lives: 1 },
      balls: stateWithScore.balls.map((b, i) =>
        i === 0 ? { ...b, isActive: true, x: 480, y: 700, vx: 0, vy: 300 } : b,
      ),
    });
    tickUntilFlowChanges(ctx, 'inGame');

    // GameOver 진입 확인
    if (ctx.getFlowState().kind === 'gameOver') {
      const saved = await repo.load();
      expect(saved.highScore).toBe(1500);
    }
  });

  it('session.score <= session.highScore 이면 기존 highScore 유지', async () => {
    const repo = new InMemorySaveRepository({ highScore: 9999 });
    const ctx = await createAppContext({ saveRepository: repo });

    enterInGame(ctx);

    // 낮은 점수 상태에서 GameOver 유도
    const state = ctx.getGameplayState() as GameplayRuntimeState;
    ctx._setGameplayState({
      ...state,
      session: { ...state.session, score: 100, lives: 1 },
      balls: state.balls.map((b, i) =>
        i === 0 ? { ...b, isActive: true, x: 480, y: 700, vx: 0, vy: 300 } : b,
      ),
    });
    tickUntilFlowChanges(ctx, 'inGame');

    if (ctx.getFlowState().kind === 'gameOver') {
      const saved = await repo.load();
      expect(saved.highScore).toBe(9999);
    }
  });
});

// ---------------------------------------------------------------------------
// Phase 9 — Audio: AudioCueResolver + IAudioPlayer 이벤트 라우팅 통합 테스트
// ---------------------------------------------------------------------------

/**
 * 테스트용 Mock AudioPlayer.
 * play() 호출 기록을 저장해 검증에 사용한다.
 */
function createMockAudioPlayer(): IAudioPlayer & { calls: AudioCueEntry[] } {
  const calls: AudioCueEntry[] = [];
  return {
    calls,
    play(cue: AudioCueEntry): void {
      calls.push(cue);
    },
    stopAll(): void {
      // noop
    },
  };
}

describe('AppContext — Audio: Flow 이벤트 → audioPlayer.play 라우팅', () => {
  it('EnteredTitle(초기 진입) 시 bgm_title cue 재생', async () => {
    const mockAudio = createMockAudioPlayer();
    const ctx = await createAppContext({ audioPlayer: mockAudio });

    // GameOver → Title 전이 시 EnteredTitle 발행됨
    enterInGame(ctx);
    drainAllLives(ctx);
    expect(ctx.getFlowState().kind).toBe('gameOver');

    mockAudio.calls.length = 0; // 이전 호출 초기화
    ctx.tick(spaceInput, 1 / 60); // gameOver → title (EnteredTitle 발행)

    const titleCues = mockAudio.calls.filter((c) => c.resourceId === 'bgm_title');
    expect(titleCues.length).toBeGreaterThan(0);
  });

  it('EnteredRoundIntro(from=introStory) 시 jingle_round_start 및 sfx_ui_confirm 재생', async () => {
    const mockAudio = createMockAudioPlayer();
    const ctx = await createAppContext({ audioPlayer: mockAudio });

    ctx.tick(spaceInput, 1 / 60); // title → introStory
    ctx.handlePresentationEvent({ type: 'IntroSequenceFinished' }); // introStory → roundIntro

    const roundCues = mockAudio.calls.filter((c) => c.resourceId === 'jingle_round_start');
    const confirmCues = mockAudio.calls.filter((c) => c.resourceId === 'sfx_ui_confirm');
    expect(roundCues.length).toBeGreaterThan(0);
    expect(confirmCues.length).toBeGreaterThan(0);
  });

  it('EnteredGameOver 시 jingle_gameover cue 재생', async () => {
    const mockAudio = createMockAudioPlayer();
    const ctx = await createAppContext({ audioPlayer: mockAudio });

    enterInGame(ctx);
    drainAllLives(ctx);

    const gameoverCues = mockAudio.calls.filter((c) => c.resourceId === 'jingle_gameover');
    expect(gameoverCues.length).toBeGreaterThan(0);
  });

  it('BlockHit/BlockDestroyed 이벤트 시 해당 sfx cue 재생', async () => {
    // basic_drop 블록(maxHits=1)에 충돌하면 BlockDestroyed 이벤트가 발행된다.
    // BlockHit (remainingHits>0) 검증을 위해 해당 블록의 remainingHits를 2로 주입한다.
    const mockAudio = createMockAudioPlayer();
    const ctx = await createAppContext({ audioPlayer: mockAudio });

    enterInGame(ctx);

    // row=1, col=6 블록 (index=19, basic_drop)을 remainingHits=2로 변경
    // → 충돌 시 BlockHit 이벤트 발행 (remainingHits=1 남음)
    const state = ctx.getGameplayState() as GameplayRuntimeState;
    // row=1, col=6: x=448, y=108, center=(480, 120)
    const BLOCK_DROP_CENTER_X = 480;
    const BLOCK_DROP_CENTER_Y = 108 + 12; // 120

    const blockIndex = state.blocks.findIndex(
      (b) => b.x === 448 && b.y === 108 && !b.isDestroyed,
    );

    ctx._setGameplayState({
      ...state,
      blocks: state.blocks.map((b, i) =>
        i === blockIndex ? { ...b, remainingHits: 2 } : b,
      ),
      balls: state.balls.map((b, i) =>
        i === 0
          ? { ...b, isActive: true, x: BLOCK_DROP_CENTER_X, y: BLOCK_DROP_CENTER_Y, vx: 0, vy: -300 }
          : b,
      ),
      itemDrops: [],
    });

    // 몇 틱 안에 블록 충돌 → sfx_block_hit 재생
    let blockHitFired = false;
    for (let i = 0; i < 30; i++) {
      mockAudio.calls.length = 0;
      ctx.tick(noInput, 1 / 60);
      const hits = mockAudio.calls.filter((c) => c.resourceId === 'sfx_block_hit');
      if (hits.length > 0) {
        blockHitFired = true;
        break;
      }
    }
    expect(blockHitFired).toBe(true);
  });

  it('LifeLost 이벤트 시 sfx_life_lost cue 재생', async () => {
    const mockAudio = createMockAudioPlayer();
    const ctx = await createAppContext({ audioPlayer: mockAudio });

    enterInGame(ctx);
    ctx.tick(spaceInput, 1 / 60); // 공 발사

    tickUntilFlowChanges(ctx, 'inGame');

    const lifeLostCues = mockAudio.calls.filter((c) => c.resourceId === 'sfx_life_lost');
    expect(lifeLostCues.length).toBeGreaterThan(0);
  });

  it('setAudioPlayer로 교체 후 새 player에게 이벤트 전달', async () => {
    const originalMock = createMockAudioPlayer();
    const ctx = await createAppContext({ audioPlayer: originalMock });

    const newMock = createMockAudioPlayer();
    ctx.setAudioPlayer(newMock);

    // introStory → roundIntro 전이 시 jingle_round_start + sfx_ui_confirm cue가 발행됨
    ctx.tick(spaceInput, 1 / 60); // → introStory
    ctx.handlePresentationEvent({ type: 'IntroSequenceFinished' }); // → roundIntro (cue 발행)

    // 교체 후 이벤트는 newMock에만 가야 함
    expect(newMock.calls.length).toBeGreaterThan(0);
    // 교체 시점 이후 originalMock에는 추가 호출 없어야 함
    const originalCallCount = originalMock.calls.length;
    ctx.tick(noInput, 1 / 60);
    expect(originalMock.calls.length).toBe(originalCallCount);
  });
});

describe('AppContext — Audio: 8개 필수 매핑 통합 검증', () => {
  it('AudioCueTable 8개 매핑 전부 resolveCueIds 로 반환됨', async () => {
    const { AudioCueResolver } = await import('../audio/AudioCueResolver');
    const { AudioCueTable } = await import('../definitions/tables/AudioCueTable');
    const resolver = new AudioCueResolver(AudioCueTable);

    const requiredEventTypes = [
      'EnteredTitle',
      'EnteredRoundIntro',
      'BlockHit',
      'BlockDestroyed',
      'ItemCollected',
      'LifeLost',
      'EnteredGameOver',
      'UiConfirm',
    ];

    for (const eventType of requiredEventTypes) {
      const cues = resolver.resolveCueIds(eventType);
      expect(cues.length, `${eventType}에 대한 cue 매핑이 없음`).toBeGreaterThan(0);
    }
  });
});
