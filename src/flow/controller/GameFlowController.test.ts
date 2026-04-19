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

function makeController(): {
  controller: GameFlowController;
  events: FlowEvent[];
} {
  const events: FlowEvent[] = [];
  const controller = new GameFlowController((e) => events.push(e));
  return { controller, events };
}

describe('GameFlowController — 통합 시나리오', () => {
  it('초기 상태는 title, stageIndex=0', () => {
    const { controller } = makeController();
    expect(controller.getState()).toEqual({ kind: 'title', currentStageIndex: 0 });
  });

  describe('Title → RoundIntro → InGame → LifeLost(lives=1) → RoundIntro → LifeLost(lives=0) → GameOver → Title', () => {
    it('전체 흐름을 순서대로 통과하고 각 Entered 이벤트를 1회씩 발행', () => {
      const { controller, events } = makeController();

      // Title → RoundIntro
      controller.handleInput(snapSpace);
      expect(controller.getState().kind).toBe('roundIntro');
      expect(events.at(-1)).toEqual({ type: 'EnteredRoundIntro' });

      // RoundIntro → InGame
      const roundIntroFinished: PresentationEvent = { type: 'RoundIntroFinished' };
      controller.handlePresentationEvent(roundIntroFinished);
      expect(controller.getState().kind).toBe('inGame');
      expect(events.at(-1)).toEqual({ type: 'EnteredInGame' });

      // InGame → RoundIntro (LifeLost, lives=1)
      const lifeLost1: GameplayEvent = { type: 'LifeLost', remainingLives: 1 };
      controller.handleGameplayEvent(lifeLost1);
      expect(controller.getState().kind).toBe('roundIntro');
      expect(events.at(-1)).toEqual({ type: 'EnteredRoundIntro' });

      // RoundIntro → InGame (다시)
      controller.handlePresentationEvent(roundIntroFinished);
      expect(controller.getState().kind).toBe('inGame');
      expect(events.at(-1)).toEqual({ type: 'EnteredInGame' });

      // InGame → GameOver (LifeLost, lives=0 → Controller가 GameOverConditionMet으로 변환)
      const lifeLost0: GameplayEvent = { type: 'LifeLost', remainingLives: 0 };
      controller.handleGameplayEvent(lifeLost0);
      expect(controller.getState().kind).toBe('gameOver');
      expect(events.at(-1)).toEqual({ type: 'EnteredGameOver' });

      // GameOver → Title (스페이스)
      controller.handleInput(snapSpace);
      expect(controller.getState().kind).toBe('title');
      expect(events.at(-1)).toEqual({ type: 'EnteredTitle' });
    });

    it('각 전이마다 Entered 이벤트가 정확히 1회 발행됨', () => {
      const { controller, events } = makeController();

      controller.handleInput(snapSpace); // → roundIntro
      controller.handlePresentationEvent({ type: 'RoundIntroFinished' }); // → inGame
      controller.handleGameplayEvent({ type: 'LifeLost', remainingLives: 0 }); // → gameOver
      controller.handleInput(snapSpace); // → title

      expect(events).toEqual([
        { type: 'EnteredRoundIntro' },
        { type: 'EnteredInGame' },
        { type: 'EnteredGameOver' },
        { type: 'EnteredTitle' },
      ]);
    });
  });

  describe('Title → ... → InGame → StageCleared → Title', () => {
    it('StageCleared 시 Title 로 복귀하고 EnteredTitle 발행', () => {
      const { controller, events } = makeController();

      controller.handleInput(snapSpace); // → roundIntro
      controller.handlePresentationEvent({ type: 'RoundIntroFinished' }); // → inGame

      const stageCleared: GameplayEvent = { type: 'StageCleared' };
      controller.handleGameplayEvent(stageCleared);

      expect(controller.getState().kind).toBe('title');
      expect(events.at(-1)).toEqual({ type: 'EnteredTitle' });
    });
  });

  describe('StartGameRequested 시 currentStageIndex 리셋', () => {
    it('Title 진입 후 StartGameRequested 하면 stageIndex=0', () => {
      const { controller } = makeController();
      controller.handleInput(snapSpace); // → roundIntro
      // stageIndex 는 0 유지
      expect(controller.getState().currentStageIndex).toBe(0);
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
      controller.handleInput(snapSpace); // → roundIntro
      controller.handlePresentationEvent({ type: 'RoundIntroFinished' }); // → inGame
      const prevLength = events.length;

      const ballLaunched: GameplayEvent = { type: 'BallLaunched' };
      controller.handleGameplayEvent(ballLaunched);
      expect(controller.getState().kind).toBe('inGame');
      expect(events).toHaveLength(prevLength);
    });

    it('GameOver 에서 GameOverConditionMet 은 무효 (이미 gameOver 상태)', () => {
      const { controller, events } = makeController();
      controller.handleInput(snapSpace); // → roundIntro
      controller.handlePresentationEvent({ type: 'RoundIntroFinished' }); // → inGame
      controller.handleGameplayEvent({ type: 'LifeLost', remainingLives: 0 }); // → gameOver
      const prevLength = events.length;

      controller.handleGameplayEvent({ type: 'GameOverConditionMet' });
      expect(controller.getState().kind).toBe('gameOver');
      expect(events).toHaveLength(prevLength);
    });
  });

  describe('이벤트 구독자 mock 검증', () => {
    it('각 전이마다 listener 가 정확히 1번 호출됨', () => {
      const listener = vi.fn();
      const controller = new GameFlowController(listener);

      controller.handleInput(snapSpace); // → roundIntro
      expect(listener).toHaveBeenCalledTimes(1);
      expect(listener).toHaveBeenLastCalledWith({ type: 'EnteredRoundIntro' });

      controller.handlePresentationEvent({ type: 'RoundIntroFinished' }); // → inGame
      expect(listener).toHaveBeenCalledTimes(2);
      expect(listener).toHaveBeenLastCalledWith({ type: 'EnteredInGame' });

      controller.handleGameplayEvent({ type: 'StageCleared' }); // → title
      expect(listener).toHaveBeenCalledTimes(3);
      expect(listener).toHaveBeenLastCalledWith({ type: 'EnteredTitle' });
    });
  });
});
