import { describe, it, expect, vi } from 'vitest';
import { GameFlowController } from './GameFlowController';
import type { FlowEvent } from '../events/flowEvents';
import type { GameplayEvent } from '../../gameplay/events/gameplayEvents';
import type { PresentationEvent } from '../../presentation/events/presentationEvents';
import type { InputSnapshot } from '../../input/InputSnapshot';

const snapSpace: InputSnapshot = {
  leftDown: false,
  rightDown: false,
  spaceJustPressed: true,
};

const snapNoSpace: InputSnapshot = {
  leftDown: false,
  rightDown: false,
  spaceJustPressed: false,
};

function makeController(totalStageCount = 1): {
  controller: GameFlowController;
  events: FlowEvent[];
} {
  const events: FlowEvent[] = [];
  const controller = new GameFlowController((e) => events.push(e), {
    totalStageCount,
  });
  return { controller, events };
}

/** Title → IntroStory → RoundIntro → InGame 경로 헬퍼 */
function advanceToInGame(
  controller: GameFlowController,
): void {
  controller.handleInput(snapSpace); // Title → IntroStory
  controller.handlePresentationEvent({ type: 'IntroSequenceFinished' }); // IntroStory → RoundIntro
  controller.handlePresentationEvent({ type: 'RoundIntroFinished' }); // RoundIntro → InGame
}

describe('GameFlowController — 통합 시나리오', () => {
  it('초기 상태는 title, stageIndex=0', () => {
    const { controller } = makeController();
    expect(controller.getState()).toEqual({ kind: 'title', currentStageIndex: 0 });
  });

  describe('Title → IntroStory → RoundIntro → InGame → LifeLost(lives=1) → RoundIntro → LifeLost(lives=0) → GameOver → Title', () => {
    it('전체 흐름을 순서대로 통과하고 각 Entered 이벤트를 1회씩 발행', () => {
      const { controller, events } = makeController();

      // Title → IntroStory
      controller.handleInput(snapSpace);
      expect(controller.getState().kind).toBe('introStory');
      expect(events.at(-1)).toEqual({ type: 'EnteredIntroStory', from: 'title' });

      // IntroStory → RoundIntro
      const introFinished: PresentationEvent = { type: 'IntroSequenceFinished' };
      controller.handlePresentationEvent(introFinished);
      expect(controller.getState().kind).toBe('roundIntro');
      expect(events.at(-1)).toEqual({ type: 'EnteredRoundIntro', from: 'introStory' });

      // RoundIntro → InGame
      const roundIntroFinished: PresentationEvent = { type: 'RoundIntroFinished' };
      controller.handlePresentationEvent(roundIntroFinished);
      expect(controller.getState().kind).toBe('inGame');
      expect(events.at(-1)).toEqual({ type: 'EnteredInGame', from: 'roundIntro' });

      // InGame → RoundIntro (LifeLost, lives=1)
      const lifeLost1: GameplayEvent = { type: 'LifeLost', remainingLives: 1 };
      controller.handleGameplayEvent(lifeLost1);
      expect(controller.getState().kind).toBe('roundIntro');
      expect(events.at(-1)).toEqual({ type: 'EnteredRoundIntro', from: 'inGame' });

      // RoundIntro → InGame (다시)
      controller.handlePresentationEvent(roundIntroFinished);
      expect(controller.getState().kind).toBe('inGame');
      expect(events.at(-1)).toEqual({ type: 'EnteredInGame', from: 'roundIntro' });

      // InGame → GameOver (LifeLost, lives=0 → Controller가 GameOverConditionMet으로 변환)
      const lifeLost0: GameplayEvent = { type: 'LifeLost', remainingLives: 0 };
      controller.handleGameplayEvent(lifeLost0);
      expect(controller.getState().kind).toBe('gameOver');
      expect(events.at(-1)).toEqual({ type: 'EnteredGameOver', from: 'inGame' });

      // GameOver → Title (스페이스)
      controller.handleInput(snapSpace);
      expect(controller.getState().kind).toBe('title');
      expect(events.at(-1)).toEqual({ type: 'EnteredTitle', from: 'gameOver' });
    });

    it('각 전이마다 Entered 이벤트가 정확히 1회 발행됨', () => {
      const { controller, events } = makeController();

      controller.handleInput(snapSpace); // → introStory
      controller.handlePresentationEvent({ type: 'IntroSequenceFinished' }); // → roundIntro
      controller.handlePresentationEvent({ type: 'RoundIntroFinished' }); // → inGame
      controller.handleGameplayEvent({ type: 'LifeLost', remainingLives: 0 }); // → gameOver
      controller.handleInput(snapSpace); // → title

      expect(events).toEqual([
        { type: 'EnteredIntroStory', from: 'title' },
        { type: 'EnteredRoundIntro', from: 'introStory' },
        { type: 'EnteredInGame', from: 'roundIntro' },
        { type: 'EnteredGameOver', from: 'inGame' },
        { type: 'EnteredTitle', from: 'gameOver' },
      ]);
    });
  });

  describe('IntroSequenceFinished → RoundIntro 전이', () => {
    it('IntroStory 상태에서 IntroSequenceFinished Presentation 이벤트 수신 시 RoundIntro 전이', () => {
      const { controller, events } = makeController();

      controller.handleInput(snapSpace); // Title → IntroStory
      expect(controller.getState().kind).toBe('introStory');

      controller.handlePresentationEvent({ type: 'IntroSequenceFinished' });
      expect(controller.getState().kind).toBe('roundIntro');
      expect(events.at(-1)).toEqual({ type: 'EnteredRoundIntro', from: 'introStory' });
    });
  });

  describe('다중 스테이지 진행 (totalStageCount=3)', () => {
    it('stageIndex=0에서 StageCleared → stageIndex=1 + RoundIntro', () => {
      const { controller } = makeController(3);
      advanceToInGame(controller);
      expect(controller.getState().currentStageIndex).toBe(0);

      controller.handleGameplayEvent({ type: 'StageCleared' });
      expect(controller.getState().kind).toBe('roundIntro');
      expect(controller.getState().currentStageIndex).toBe(1);
    });

    it('stageIndex=1에서 StageCleared → stageIndex=2 + RoundIntro', () => {
      const { controller } = makeController(3);
      advanceToInGame(controller);

      // Stage 0 클리어
      controller.handleGameplayEvent({ type: 'StageCleared' }); // → roundIntro, index=1
      controller.handlePresentationEvent({ type: 'RoundIntroFinished' }); // → inGame

      // Stage 1 클리어
      controller.handleGameplayEvent({ type: 'StageCleared' });
      expect(controller.getState().kind).toBe('roundIntro');
      expect(controller.getState().currentStageIndex).toBe(2);
    });

    it('stageIndex=2(마지막)에서 StageCleared → GameClear, stageIndex 유지', () => {
      const { controller, events } = makeController(3);
      advanceToInGame(controller);

      // Stage 0, 1 클리어
      controller.handleGameplayEvent({ type: 'StageCleared' }); // → roundIntro, index=1
      controller.handlePresentationEvent({ type: 'RoundIntroFinished' }); // → inGame
      controller.handleGameplayEvent({ type: 'StageCleared' }); // → roundIntro, index=2
      controller.handlePresentationEvent({ type: 'RoundIntroFinished' }); // → inGame

      // Stage 2(마지막) 클리어
      controller.handleGameplayEvent({ type: 'StageCleared' });
      expect(controller.getState().kind).toBe('gameClear');
      expect(controller.getState().currentStageIndex).toBe(2);
      expect(events.at(-1)).toEqual({ type: 'EnteredGameClear', from: 'inGame' });
    });
  });

  describe('StartGameRequested 시 currentStageIndex 리셋', () => {
    it('GameClear 후 Title 복귀, 다시 StartGameRequested 하면 stageIndex=0으로 리셋', () => {
      const { controller } = makeController(1);
      advanceToInGame(controller);

      // Stage 0(마지막) 클리어 → GameClear
      controller.handleGameplayEvent({ type: 'StageCleared' });
      expect(controller.getState().kind).toBe('gameClear');

      // GameClear → Title
      controller.handleInput(snapSpace);
      expect(controller.getState().kind).toBe('title');

      // Title → IntroStory (stageIndex 리셋 확인)
      controller.handleInput(snapSpace);
      expect(controller.getState().kind).toBe('introStory');
      expect(controller.getState().currentStageIndex).toBe(0);
    });

    it('Title 진입 후 StartGameRequested 하면 stageIndex=0', () => {
      const { controller } = makeController();
      controller.handleInput(snapSpace); // → introStory
      // stageIndex 는 0 유지
      expect(controller.getState().currentStageIndex).toBe(0);
    });
  });

  describe('GameClear → Title 복귀', () => {
    it('GameClear + spaceJustPressed → Title + EnteredTitle 발행', () => {
      const { controller, events } = makeController(1);
      advanceToInGame(controller);

      controller.handleGameplayEvent({ type: 'StageCleared' }); // → gameClear
      expect(controller.getState().kind).toBe('gameClear');

      controller.handleInput(snapSpace); // → title
      expect(controller.getState().kind).toBe('title');
      expect(events.at(-1)).toEqual({ type: 'EnteredTitle', from: 'gameClear' });
    });
  });

  describe('Entered 이벤트 발행 확인', () => {
    it('EnteredIntroStory 이벤트 발행 확인', () => {
      const { controller, events } = makeController();
      controller.handleInput(snapSpace); // Title → IntroStory
      expect(events).toContainEqual({ type: 'EnteredIntroStory', from: 'title' });
    });

    it('EnteredGameClear 이벤트 발행 확인', () => {
      const { controller, events } = makeController(1);
      advanceToInGame(controller);
      controller.handleGameplayEvent({ type: 'StageCleared' }); // → gameClear
      expect(events).toContainEqual({ type: 'EnteredGameClear', from: 'inGame' });
    });
  });

  describe('무효 입력은 상태를 바꾸지 않음', () => {
    it('Title 에서 space 없이 handleInput → 상태 유지', () => {
      const { controller, events } = makeController();
      controller.handleInput(snapNoSpace);
      expect(controller.getState().kind).toBe('title');
      expect(events).toHaveLength(0);
    });

    it('InGame 에서 BallLaunched Gameplay 이벤트 → 상태 유지 (Flow 무관 이벤트)', () => {
      const { controller, events } = makeController();
      advanceToInGame(controller);
      const prevLength = events.length;

      const ballLaunched: GameplayEvent = { type: 'BallLaunched' };
      controller.handleGameplayEvent(ballLaunched);
      expect(controller.getState().kind).toBe('inGame');
      expect(events).toHaveLength(prevLength);
    });

    it('GameOver 에서 GameOverConditionMet 은 무효 (이미 gameOver 상태)', () => {
      const { controller, events } = makeController();
      advanceToInGame(controller);
      controller.handleGameplayEvent({ type: 'LifeLost', remainingLives: 0 }); // → gameOver
      const prevLength = events.length;

      controller.handleGameplayEvent({ type: 'GameOverConditionMet' });
      expect(controller.getState().kind).toBe('gameOver');
      expect(events).toHaveLength(prevLength);
    });

    it('IntroStory 에서 space 입력 → 상태 유지 (IntroStory는 Presentation이 진행)', () => {
      const { controller, events } = makeController();
      controller.handleInput(snapSpace); // → introStory
      const prevLength = events.length;

      controller.handleInput(snapSpace); // IntroStory에서 space → 무효
      expect(controller.getState().kind).toBe('introStory');
      expect(events).toHaveLength(prevLength);
    });
  });

  describe('이벤트 구독자 mock 검증', () => {
    it('각 전이마다 listener 가 정확히 1번 호출됨', () => {
      const listener = vi.fn();
      const controller = new GameFlowController(listener, { totalStageCount: 1 });

      controller.handleInput(snapSpace); // → introStory
      expect(listener).toHaveBeenCalledTimes(1);
      expect(listener).toHaveBeenLastCalledWith({ type: 'EnteredIntroStory', from: 'title' });

      controller.handlePresentationEvent({ type: 'IntroSequenceFinished' }); // → roundIntro
      expect(listener).toHaveBeenCalledTimes(2);
      expect(listener).toHaveBeenLastCalledWith({ type: 'EnteredRoundIntro', from: 'introStory' });

      controller.handlePresentationEvent({ type: 'RoundIntroFinished' }); // → inGame
      expect(listener).toHaveBeenCalledTimes(3);
      expect(listener).toHaveBeenLastCalledWith({ type: 'EnteredInGame', from: 'roundIntro' });

      controller.handleGameplayEvent({ type: 'StageCleared' }); // → gameClear (totalStageCount=1, 마지막)
      expect(listener).toHaveBeenCalledTimes(4);
      expect(listener).toHaveBeenLastCalledWith({ type: 'EnteredGameClear', from: 'inGame' });
    });
  });
});
