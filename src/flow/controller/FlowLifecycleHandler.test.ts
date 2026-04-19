import { describe, it, expect } from 'vitest';
import { onEnter } from './FlowLifecycleHandler';

describe('FlowLifecycleHandler — onEnter()', () => {
  it('title 진입 → EnteredTitle', () => {
    expect(onEnter('title', 'gameOver')).toEqual({ type: 'EnteredTitle', from: 'gameOver' });
  });

  it('introStory 진입 → EnteredIntroStory', () => {
    expect(onEnter('introStory', 'title')).toEqual({ type: 'EnteredIntroStory', from: 'title' });
  });

  it('roundIntro 진입 (from introStory) → EnteredRoundIntro', () => {
    expect(onEnter('roundIntro', 'introStory')).toEqual({ type: 'EnteredRoundIntro', from: 'introStory' });
  });

  it('roundIntro 진입 (from inGame) → EnteredRoundIntro', () => {
    expect(onEnter('roundIntro', 'inGame')).toEqual({ type: 'EnteredRoundIntro', from: 'inGame' });
  });

  it('inGame 진입 → EnteredInGame', () => {
    expect(onEnter('inGame', 'roundIntro')).toEqual({ type: 'EnteredInGame', from: 'roundIntro' });
  });

  it('gameOver 진입 → EnteredGameOver', () => {
    expect(onEnter('gameOver', 'inGame')).toEqual({ type: 'EnteredGameOver', from: 'inGame' });
  });

  it('gameClear 진입 → EnteredGameClear', () => {
    expect(onEnter('gameClear', 'inGame')).toEqual({ type: 'EnteredGameClear', from: 'inGame' });
  });

  it('title 복귀 (from gameClear) → EnteredTitle with from=gameClear', () => {
    expect(onEnter('title', 'gameClear')).toEqual({ type: 'EnteredTitle', from: 'gameClear' });
  });
});
