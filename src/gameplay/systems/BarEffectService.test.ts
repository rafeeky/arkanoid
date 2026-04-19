import { describe, it, expect } from 'vitest';
import { BarEffectService } from './BarEffectService';
import type { BarState } from '../state/BarState';
import type { ItemDefinition } from '../../definitions/types/ItemDefinition';

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const baseBarWidth = 120;

const itemDefinitions: Record<string, ItemDefinition> = {
  expand: {
    itemType: 'expand',
    displayNameTextId: 'txt_expand',
    descriptionTextId: 'txt_expand_desc',
    iconId: 'icon_expand',
    fallSpeed: 160,
    effectType: 'expand',
    expandMultiplier: 1.5,
  },
  magnet: {
    itemType: 'magnet',
    displayNameTextId: 'txt_magnet',
    descriptionTextId: 'txt_magnet_desc',
    iconId: 'icon_magnet',
    fallSpeed: 160,
    effectType: 'magnet',
    magnetDurationMs: 8000,
  },
  laser: {
    itemType: 'laser',
    displayNameTextId: 'txt_laser',
    descriptionTextId: 'txt_laser_desc',
    iconId: 'icon_laser',
    fallSpeed: 160,
    effectType: 'laser',
    laserCooldownMs: 500,
    laserShotCount: 2,
  },
};

function makeBar(overrides: Partial<BarState> = {}): BarState {
  return {
    x: 360,
    y: 660,
    width: baseBarWidth,
    moveSpeed: 420,
    activeEffect: 'none',
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// applyEffect 전환 매트릭스
// ---------------------------------------------------------------------------

describe('BarEffectService.applyEffect', () => {
  const svc = new BarEffectService(itemDefinitions);

  it('none → expand: 바 너비 1.5배, activeEffect=expand', () => {
    const result = svc.applyEffect(makeBar(), 0, 0, [], 'expand', baseBarWidth);
    expect(result.nextBar.activeEffect).toBe('expand');
    expect(result.nextBar.width).toBeCloseTo(baseBarWidth * 1.5);
    expect(result.releasedBallIds).toHaveLength(0);
    expect(result.events).toHaveLength(0);
  });

  it('none → magnet: activeEffect=magnet, magnetRemaining=8000, 너비 리셋', () => {
    const result = svc.applyEffect(makeBar({ width: 180 }), 0, 0, [], 'magnet', baseBarWidth);
    expect(result.nextBar.activeEffect).toBe('magnet');
    expect(result.nextBar.width).toBe(baseBarWidth);
    expect(result.nextMagnetRemaining).toBe(8000);
    expect(result.nextAttachedBalls).toHaveLength(0);
    expect(result.releasedBallIds).toHaveLength(0);
    expect(result.events).toHaveLength(0);
  });

  it('none → laser: activeEffect=laser, laserCooldown=0, 너비 리셋', () => {
    const result = svc.applyEffect(makeBar({ width: 180 }), 0, 500, [], 'laser', baseBarWidth);
    expect(result.nextBar.activeEffect).toBe('laser');
    expect(result.nextBar.width).toBe(baseBarWidth);
    expect(result.nextLaserCooldown).toBe(0);
    expect(result.releasedBallIds).toHaveLength(0);
  });

  it('expand → magnet: 기존 expand 정리 없음, 새 magnet 적용', () => {
    const bar = makeBar({ activeEffect: 'expand', width: baseBarWidth * 1.5 });
    const result = svc.applyEffect(bar, 0, 0, [], 'magnet', baseBarWidth);
    expect(result.nextBar.activeEffect).toBe('magnet');
    expect(result.nextBar.width).toBe(baseBarWidth);
    expect(result.nextMagnetRemaining).toBe(8000);
    expect(result.releasedBallIds).toHaveLength(0);
    expect(result.events).toHaveLength(0);
  });

  it('magnet → laser: 부착 공 있으면 BallsReleased(replaced) 발행', () => {
    const bar = makeBar({ activeEffect: 'magnet' });
    const attachedBalls = ['ball_0', 'ball_1'];
    const result = svc.applyEffect(bar, 5000, 0, attachedBalls, 'laser', baseBarWidth);

    expect(result.nextBar.activeEffect).toBe('laser');
    expect(result.nextMagnetRemaining).toBe(0);
    expect(result.nextAttachedBalls).toHaveLength(0);
    expect(result.releasedBallIds).toEqual(attachedBalls);
    expect(result.events).toHaveLength(1);
    const evt = result.events[0];
    expect(evt?.type).toBe('BallsReleased');
    if (evt?.type === 'BallsReleased') {
      expect(evt.releaseReason).toBe('replaced');
      expect(evt.ballIds).toEqual(attachedBalls);
    }
  });

  it('magnet → expand: 부착 공 없으면 BallsReleased 발행 안 함', () => {
    const bar = makeBar({ activeEffect: 'magnet' });
    const result = svc.applyEffect(bar, 3000, 0, [], 'expand', baseBarWidth);
    expect(result.nextBar.activeEffect).toBe('expand');
    expect(result.nextMagnetRemaining).toBe(0);
    expect(result.events).toHaveLength(0);
    expect(result.releasedBallIds).toHaveLength(0);
  });

  it('laser → magnet: laserCooldown 리셋', () => {
    const bar = makeBar({ activeEffect: 'laser' });
    const result = svc.applyEffect(bar, 0, 300, [], 'magnet', baseBarWidth);
    expect(result.nextBar.activeEffect).toBe('magnet');
    expect(result.nextLaserCooldown).toBe(0);
    expect(result.nextMagnetRemaining).toBe(8000);
  });

  it('magnet → magnet: 기존 자석 타이머 리셋, 새 타이머 시작', () => {
    const bar = makeBar({ activeEffect: 'magnet' });
    const result = svc.applyEffect(bar, 3000, 0, [], 'magnet', baseBarWidth);
    expect(result.nextMagnetRemaining).toBe(8000);
    expect(result.nextBar.activeEffect).toBe('magnet');
  });
});

// ---------------------------------------------------------------------------
// tickMagnet
// ---------------------------------------------------------------------------

describe('BarEffectService.tickMagnet', () => {
  const svc = new BarEffectService(itemDefinitions);

  it('자석 비활성 상태(activeEffect=none)에서는 아무것도 하지 않는다', () => {
    const bar = makeBar({ activeEffect: 'none' });
    const result = svc.tickMagnet(0, [], bar, 100);
    expect(result.nextMagnetRemaining).toBe(0);
    expect(result.nextBar).toBe(bar); // 동일 참조
    expect(result.releasedBallIds).toHaveLength(0);
    expect(result.events).toHaveLength(0);
  });

  it('잔여 시간 감소: 8000 - 16.7ms = 7983.3ms', () => {
    const bar = makeBar({ activeEffect: 'magnet' });
    const result = svc.tickMagnet(8000, [], bar, 16.7);
    expect(result.nextMagnetRemaining).toBeCloseTo(7983.3);
    expect(result.nextBar.activeEffect).toBe('magnet');
    expect(result.releasedBallIds).toHaveLength(0);
  });

  it('잔여 시간 0 이하: activeEffect=none, 부착 공 해제, BallsReleased(timeout)', () => {
    const bar = makeBar({ activeEffect: 'magnet' });
    const attachedBalls = ['ball_0'];
    const result = svc.tickMagnet(50, attachedBalls, bar, 100); // 50ms 남았는데 100ms 경과

    expect(result.nextMagnetRemaining).toBe(0);
    expect(result.nextBar.activeEffect).toBe('none');
    expect(result.releasedBallIds).toEqual(attachedBalls);
    expect(result.events).toHaveLength(1);
    const evt = result.events[0];
    expect(evt?.type).toBe('BallsReleased');
    if (evt?.type === 'BallsReleased') {
      expect(evt.releaseReason).toBe('timeout');
      expect(evt.ballIds).toEqual(attachedBalls);
    }
  });

  it('타임아웃 시 부착 공 없으면 BallsReleased 발행 안 함', () => {
    const bar = makeBar({ activeEffect: 'magnet' });
    const result = svc.tickMagnet(50, [], bar, 100);
    expect(result.nextBar.activeEffect).toBe('none');
    expect(result.events).toHaveLength(0);
    expect(result.releasedBallIds).toHaveLength(0);
  });

  it('정확히 8000ms 경과 후 해제', () => {
    const bar = makeBar({ activeEffect: 'magnet' });
    const attachedBalls = ['ball_0'];

    // 1ms씩 감소 시뮬레이션 (효율을 위해 큰 단위로)
    let remaining = 8000;
    let currentBar = bar;
    let released: readonly string[] = [];
    const steps = [100, 500, 1000, 1000, 2000, 2000, 1400]; // 합계 = 8000
    for (const step of steps) {
      const r = svc.tickMagnet(remaining, attachedBalls, currentBar, step);
      remaining = r.nextMagnetRemaining;
      currentBar = r.nextBar;
      if (r.releasedBallIds.length > 0) {
        released = r.releasedBallIds;
      }
    }
    expect(remaining).toBe(0);
    expect(currentBar.activeEffect).toBe('none');
    expect(released).toEqual(attachedBalls);
  });
});

// ---------------------------------------------------------------------------
// releaseManually
// ---------------------------------------------------------------------------

describe('BarEffectService.releaseManually', () => {
  const svc = new BarEffectService(itemDefinitions);

  it('자석 상태 + 부착 공 있음 → activeEffect=none, BallsReleased(space)', () => {
    const bar = makeBar({ activeEffect: 'magnet' });
    const attachedBalls = ['ball_0', 'ball_1'];
    const result = svc.releaseManually(bar, attachedBalls);

    expect(result.nextBar.activeEffect).toBe('none');
    expect(result.releasedBallIds).toEqual(attachedBalls);
    expect(result.events).toHaveLength(1);
    const evt = result.events[0];
    expect(evt?.type).toBe('BallsReleased');
    if (evt?.type === 'BallsReleased') {
      expect(evt.releaseReason).toBe('space');
      expect(evt.ballIds).toEqual(attachedBalls);
    }
  });

  it('부착 공 없으면 BallsReleased 발행 안 함', () => {
    const bar = makeBar({ activeEffect: 'magnet' });
    const result = svc.releaseManually(bar, []);
    expect(result.nextBar.activeEffect).toBe('none');
    expect(result.events).toHaveLength(0);
    expect(result.releasedBallIds).toHaveLength(0);
  });

  it('릴리즈 후 바 상태는 불변 (기존 bar 객체 수정 안 함)', () => {
    const bar = makeBar({ activeEffect: 'magnet' });
    const result = svc.releaseManually(bar, ['ball_0']);
    // 원본 변경 없음
    expect(bar.activeEffect).toBe('magnet');
    // 새 객체가 반환됨
    expect(result.nextBar).not.toBe(bar);
  });
});
