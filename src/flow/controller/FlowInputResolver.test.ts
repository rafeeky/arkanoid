import { describe, it, expect } from 'vitest';
import { resolveFlowCommand } from './FlowInputResolver';
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

const snapLeft: InputSnapshot = {
  leftDown: true,
  rightDown: false,
  spaceJustPressed: false,
};

describe('FlowInputResolver — resolveFlowCommand()', () => {
  describe('Title 상태', () => {
    it('spaceJustPressed=true → StartGameRequested', () => {
      expect(resolveFlowCommand('title', snapSpace)).toEqual({
        type: 'StartGameRequested',
      });
    });

    it('spaceJustPressed=false → null', () => {
      expect(resolveFlowCommand('title', snapNoSpace)).toBeNull();
    });

    it('leftDown만 true → null', () => {
      expect(resolveFlowCommand('title', snapLeft)).toBeNull();
    });
  });

  describe('GameOver 상태', () => {
    it('spaceJustPressed=true → RetryRequested', () => {
      expect(resolveFlowCommand('gameOver', snapSpace)).toEqual({
        type: 'RetryRequested',
      });
    });

    it('spaceJustPressed=false → null', () => {
      expect(resolveFlowCommand('gameOver', snapNoSpace)).toBeNull();
    });
  });

  describe('GameClear 상태', () => {
    it('spaceJustPressed=true → RetryRequested', () => {
      expect(resolveFlowCommand('gameClear', snapSpace)).toEqual({
        type: 'RetryRequested',
      });
    });

    it('spaceJustPressed=false → null', () => {
      expect(resolveFlowCommand('gameClear', snapNoSpace)).toBeNull();
    });
  });

  describe('IntroStory / RoundIntro / InGame 상태 — 항상 null', () => {
    it('IntroStory + space → null (Presentation이 진행 담당)', () => {
      expect(resolveFlowCommand('introStory', snapSpace)).toBeNull();
    });

    it('RoundIntro + space → null (InGame 입력은 다른 계층 담당)', () => {
      expect(resolveFlowCommand('roundIntro', snapSpace)).toBeNull();
    });

    it('InGame + space → null', () => {
      expect(resolveFlowCommand('inGame', snapSpace)).toBeNull();
    });

    it('InGame + no input → null', () => {
      expect(resolveFlowCommand('inGame', snapNoSpace)).toBeNull();
    });
  });
});
