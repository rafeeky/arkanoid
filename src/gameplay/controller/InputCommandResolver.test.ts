import { describe, it, expect } from 'vitest';
import { resolveGameplayCommands } from './InputCommandResolver';
import type { GameplayRuntimeState } from '../state/GameplayRuntimeState';
import type { InputSnapshot } from '../../input/InputSnapshot';

// --- Fixtures ---

const noInput: InputSnapshot = { leftDown: false, rightDown: false, spaceJustPressed: false };
const spaceInput: InputSnapshot = { leftDown: false, rightDown: false, spaceJustPressed: true };
const leftInput: InputSnapshot = { leftDown: true, rightDown: false, spaceJustPressed: false };
const rightInput: InputSnapshot = { leftDown: false, rightDown: true, spaceJustPressed: false };

function makeState(
  overrides: Partial<{
    activeEffect: 'none' | 'expand' | 'magnet' | 'laser';
    attachedBallIds: readonly string[];
    laserCooldownRemaining: number;
    ballActive: boolean;
  }> = {},
): GameplayRuntimeState {
  const activeEffect = overrides.activeEffect ?? 'none';
  const attachedBallIds = overrides.attachedBallIds ?? [];
  const laserCooldownRemaining = overrides.laserCooldownRemaining ?? 0;
  const ballActive = overrides.ballActive ?? false;

  return {
    session: { currentStageIndex: 0, score: 0, lives: 3, highScore: 0 },
    bar: {
      x: 480,
      y: 660,
      width: 120,
      moveSpeed: 420,
      activeEffect,
    },
    balls: [
      {
        id: 'ball_0',
        x: 480,
        y: 640,
        vx: 0,
        vy: 0,
        isActive: ballActive,
      },
    ],
    blocks: [],
    itemDrops: [],
    isStageCleared: false,
    magnetRemainingTime: 0,
    attachedBallIds,
    laserCooldownRemaining,
    laserShots: [],
    spinnerStates: [],
  };
}

// --- MoveBar 커맨드 테스트 ---

describe('InputCommandResolver - MoveBar', () => {
  it('입력 없으면 direction=0 MoveBar 커맨드를 반환한다', () => {
    const cmds = resolveGameplayCommands(noInput, makeState());
    const moveCmd = cmds.find((c) => c.type === 'MoveBar');
    expect(moveCmd).toBeDefined();
    expect(moveCmd?.type === 'MoveBar' && moveCmd.direction).toBe(0);
  });

  it('왼쪽 입력이면 direction=-1 MoveBar를 반환한다', () => {
    const cmds = resolveGameplayCommands(leftInput, makeState());
    const moveCmd = cmds.find((c) => c.type === 'MoveBar');
    expect(moveCmd?.type === 'MoveBar' && moveCmd.direction).toBe(-1);
  });

  it('오른쪽 입력이면 direction=1 MoveBar를 반환한다', () => {
    const cmds = resolveGameplayCommands(rightInput, makeState());
    const moveCmd = cmds.find((c) => c.type === 'MoveBar');
    expect(moveCmd?.type === 'MoveBar' && moveCmd.direction).toBe(1);
  });

  it('양쪽 동시 입력이면 direction=0 MoveBar를 반환한다', () => {
    const bothInput: InputSnapshot = { leftDown: true, rightDown: true, spaceJustPressed: false };
    const cmds = resolveGameplayCommands(bothInput, makeState());
    const moveCmd = cmds.find((c) => c.type === 'MoveBar');
    expect(moveCmd?.type === 'MoveBar' && moveCmd.direction).toBe(0);
  });
});

// --- 스페이스 분기 테스트 ---

describe('InputCommandResolver - spaceJustPressed 분기', () => {
  it('magnet 상태 + 부착 공 있음 + space → ReleaseAttachedBalls', () => {
    const state = makeState({
      activeEffect: 'magnet',
      attachedBallIds: ['ball_0'],
      ballActive: true,
    });
    const cmds = resolveGameplayCommands(spaceInput, state);
    expect(cmds.some((c) => c.type === 'ReleaseAttachedBalls')).toBe(true);
    expect(cmds.some((c) => c.type === 'LaunchBall')).toBe(false);
    expect(cmds.some((c) => c.type === 'FireLaser')).toBe(false);
  });

  it('magnet 상태 + 부착 공 없음 + space + 비활성 공 → LaunchBall', () => {
    const state = makeState({
      activeEffect: 'magnet',
      attachedBallIds: [],
      ballActive: false,
    });
    const cmds = resolveGameplayCommands(spaceInput, state);
    expect(cmds.some((c) => c.type === 'LaunchBall')).toBe(true);
    expect(cmds.some((c) => c.type === 'ReleaseAttachedBalls')).toBe(false);
  });

  it('laser 상태 + cooldown=0 + space → FireLaser', () => {
    const state = makeState({
      activeEffect: 'laser',
      laserCooldownRemaining: 0,
      ballActive: true,
    });
    const cmds = resolveGameplayCommands(spaceInput, state);
    expect(cmds.some((c) => c.type === 'FireLaser')).toBe(true);
    expect(cmds.some((c) => c.type === 'LaunchBall')).toBe(false);
    expect(cmds.some((c) => c.type === 'ReleaseAttachedBalls')).toBe(false);
  });

  it('laser 상태 + cooldown>0 + space → 커맨드 없음 (쿨타임 중)', () => {
    const state = makeState({
      activeEffect: 'laser',
      laserCooldownRemaining: 500,
      ballActive: true,
    });
    const cmds = resolveGameplayCommands(spaceInput, state);
    expect(cmds.some((c) => c.type === 'FireLaser')).toBe(false);
    expect(cmds.some((c) => c.type === 'LaunchBall')).toBe(false);
    expect(cmds.some((c) => c.type === 'ReleaseAttachedBalls')).toBe(false);
  });

  it('expand 상태 + 비활성 공 + space → LaunchBall (기존 동작 유지)', () => {
    const state = makeState({
      activeEffect: 'expand',
      ballActive: false,
    });
    const cmds = resolveGameplayCommands(spaceInput, state);
    expect(cmds.some((c) => c.type === 'LaunchBall')).toBe(true);
    expect(cmds.some((c) => c.type === 'FireLaser')).toBe(false);
    expect(cmds.some((c) => c.type === 'ReleaseAttachedBalls')).toBe(false);
  });

  it('none 상태 + 활성 공 + space → 커맨드 없음', () => {
    const state = makeState({
      activeEffect: 'none',
      ballActive: true,
    });
    const cmds = resolveGameplayCommands(spaceInput, state);
    expect(cmds.some((c) => c.type === 'LaunchBall')).toBe(false);
    expect(cmds.some((c) => c.type === 'FireLaser')).toBe(false);
    expect(cmds.some((c) => c.type === 'ReleaseAttachedBalls')).toBe(false);
  });

  it('space 없이는 magnet 상태에서도 커맨드 미생성', () => {
    const state = makeState({
      activeEffect: 'magnet',
      attachedBallIds: ['ball_0'],
    });
    const cmds = resolveGameplayCommands(noInput, state);
    expect(cmds.some((c) => c.type === 'ReleaseAttachedBalls')).toBe(false);
  });

  it('magnet 상태에서는 FireLaser 커맨드가 생성되지 않는다', () => {
    const state = makeState({
      activeEffect: 'magnet',
      attachedBallIds: ['ball_0'],
      laserCooldownRemaining: 0,
    });
    const cmds = resolveGameplayCommands(spaceInput, state);
    expect(cmds.some((c) => c.type === 'FireLaser')).toBe(false);
    // magnet이 우선순위 1이므로 ReleaseAttachedBalls여야 한다
    expect(cmds.some((c) => c.type === 'ReleaseAttachedBalls')).toBe(true);
  });

  it('스페이스 입력이 없으면 MoveBar만 반환한다', () => {
    const state = makeState({ activeEffect: 'none', ballActive: false });
    const cmds = resolveGameplayCommands(noInput, state);
    expect(cmds.length).toBe(1);
    expect(cmds[0]?.type).toBe('MoveBar');
  });
});
