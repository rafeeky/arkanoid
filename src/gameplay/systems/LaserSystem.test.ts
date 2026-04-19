import { describe, it, expect } from 'vitest';
import { LaserSystem } from './LaserSystem';
import type { BarState } from '../state/BarState';
import type { BlockState } from '../state/BlockState';
import type { BlockDefinition } from '../../definitions/types/BlockDefinition';
import type { LaserShotState } from '../state/LaserShotState';

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

function makeBar(overrides: Partial<BarState> = {}): BarState {
  return {
    x: 360,
    y: 660,
    width: 120,
    moveSpeed: 420,
    activeEffect: 'laser',
    ...overrides,
  };
}

function makeBlock(overrides: Partial<BlockState> = {}): BlockState {
  return {
    id: 'block_0',
    x: 320,
    y: 100,
    remainingHits: 1,
    isDestroyed: false,
    definitionId: 'basic',
    ...overrides,
  };
}

const blockDefs: Record<string, BlockDefinition> = {
  basic: { definitionId: 'basic', maxHits: 1, score: 10, dropItemType: 'none', visualId: 'v' },
  tough: { definitionId: 'tough', maxHits: 2, score: 30, dropItemType: 'none', visualId: 'v' },
};

function makeSystem(): { system: LaserSystem; idCounter: { value: number } } {
  const idCounter = { value: 0 };
  const system = new LaserSystem(() => `laser_${idCounter.value++}`);
  return { system, idCounter };
}

// ---------------------------------------------------------------------------
// fireLaser
// ---------------------------------------------------------------------------

describe('LaserSystem.fireLaser', () => {
  it('2발이 생성된다', () => {
    const { system } = makeSystem();
    const bar = makeBar();
    const result = system.fireLaser(bar, [], 400);
    expect(result.newShots).toHaveLength(2);
  });

  it('기존 shots에 2발이 추가된다', () => {
    const { system } = makeSystem();
    const bar = makeBar();
    const existing: LaserShotState[] = [{ id: 'laser_old', x: 200, y: 300, vy: -1200 }];
    const result = system.fireLaser(bar, existing, 400);
    expect(result.newShots).toHaveLength(3);
  });

  it('shot1 x = bar.x - bar.width/3', () => {
    const { system } = makeSystem();
    const bar = makeBar({ x: 360, width: 120 });
    const result = system.fireLaser(bar, [], 400);
    // 빈 배열에서 시작 → index 0 = shot1
    const shot1 = result.newShots[0];
    expect(shot1?.x).toBeCloseTo(360 - 120 / 3);
  });

  it('shot2 x = bar.x + bar.width/3', () => {
    const { system } = makeSystem();
    const bar = makeBar({ x: 360, width: 120 });
    const result = system.fireLaser(bar, [], 400);
    // 빈 배열에서 시작 → index 1 = shot2
    const shot2 = result.newShots[1];
    expect(shot2?.x).toBeCloseTo(360 + 120 / 3);
  });

  it('발사 위치 y = bar.y - BAR_HALF_HEIGHT', () => {
    const { system } = makeSystem();
    const bar = makeBar({ y: 660 });
    const result = system.fireLaser(bar, [], 400);
    expect(result.newShots[0]?.y).toBeCloseTo(660 - 8);
    expect(result.newShots[1]?.y).toBeCloseTo(660 - 8);
  });

  it('shot vy = -1200', () => {
    const { system } = makeSystem();
    const result = system.fireLaser(makeBar(), [], 400);
    expect(result.newShots[0]?.vy).toBe(-1200);
    expect(result.newShots[1]?.vy).toBe(-1200);
  });

  it('nextCooldownMs = laserCooldownMs 인자', () => {
    const { system } = makeSystem();
    const result = system.fireLaser(makeBar(), [], 400);
    expect(result.nextCooldownMs).toBe(400);
  });

  it('laserCooldownMs 인자가 undefined이면 기본값 400 사용', () => {
    const { system } = makeSystem();
    const result = system.fireLaser(makeBar(), [], undefined);
    expect(result.nextCooldownMs).toBe(400);
  });

  it('LaserFired 이벤트가 1개 발행된다', () => {
    const { system } = makeSystem();
    const result = system.fireLaser(makeBar(), [], 400);
    expect(result.events).toHaveLength(1);
    expect(result.events[0]).toMatchObject({ type: 'LaserFired', shotCount: 2 });
  });

  it('nextId 함수가 순서대로 호출된다 — id가 결정론적', () => {
    const ids: string[] = [];
    const system = new LaserSystem(() => {
      const id = `test_${ids.length}`;
      ids.push(id);
      return id;
    });
    const result = system.fireLaser(makeBar(), [], 400);
    expect(result.newShots[0]?.id).toBe('test_0');
    expect(result.newShots[1]?.id).toBe('test_1');
  });
});

// ---------------------------------------------------------------------------
// tick
// ---------------------------------------------------------------------------

describe('LaserSystem.tick', () => {
  it('shot y가 vy * dt만큼 이동한다', () => {
    const { system } = makeSystem();
    const shots: LaserShotState[] = [{ id: 'laser_0', x: 200, y: 400, vy: -1200 }];
    const result = system.tick(shots, 0, 1 / 60);
    expect(result.nextShots[0]?.y).toBeCloseTo(400 + -1200 * (1 / 60));
  });

  it('천장(y < 0)을 통과한 shot이 제거된다', () => {
    const { system } = makeSystem();
    const shots: LaserShotState[] = [
      { id: 'laser_0', x: 200, y: 5, vy: -1200 },   // 한 틱 후 y < 0
      { id: 'laser_1', x: 300, y: 400, vy: -1200 },  // 멀리 있음
    ];
    const result = system.tick(shots, 0, 1 / 60);
    expect(result.nextShots).toHaveLength(1);
    expect(result.nextShots[0]?.id).toBe('laser_1');
  });

  it('천장 바로 위에 있는 shot은 유지된다 (y - LASER_HALF_H >= 0)', () => {
    const { system } = makeSystem();
    // y = 5, LASER_HALF_H = 4 → top edge = 1 >= 0 → 유지
    const shots: LaserShotState[] = [{ id: 'laser_0', x: 200, y: 5, vy: 0 }];
    const result = system.tick(shots, 0, 0);
    expect(result.nextShots).toHaveLength(1);
  });

  it('쿨다운이 dt * 1000만큼 감소한다', () => {
    const { system } = makeSystem();
    const result = system.tick([], 400, 1 / 60);
    expect(result.nextCooldownMs).toBeCloseTo(400 - (1000 / 60));
  });

  it('쿨다운은 0 미만으로 내려가지 않는다', () => {
    const { system } = makeSystem();
    const result = system.tick([], 10, 1); // 1s → 1000ms 감소 시도
    expect(result.nextCooldownMs).toBe(0);
  });

  it('shots가 없으면 빈 배열이 반환된다', () => {
    const { system } = makeSystem();
    const result = system.tick([], 0, 1 / 60);
    expect(result.nextShots).toHaveLength(0);
  });
});

// ---------------------------------------------------------------------------
// handleBlockCollisions
// ---------------------------------------------------------------------------

describe('LaserSystem.handleBlockCollisions', () => {
  it('shot이 블록과 겹치지 않으면 아무 일도 없다', () => {
    const { system } = makeSystem();
    const shots: LaserShotState[] = [{ id: 'laser_0', x: 0, y: 500, vy: -1200 }];
    const block = makeBlock({ x: 320, y: 100 });
    const result = system.handleBlockCollisions(shots, [block], blockDefs);
    expect(result.nextShots).toHaveLength(1);
    expect(result.nextBlocks[0]?.remainingHits).toBe(1);
    expect(result.events).toHaveLength(0);
  });

  it('shot이 블록과 겹치면 shot이 제거된다 (관통 없음)', () => {
    const { system } = makeSystem();
    const block = makeBlock({ x: 320, y: 100, remainingHits: 1 });
    // shot을 블록 중심에 정확히 위치
    const shots: LaserShotState[] = [{ id: 'laser_0', x: 352, y: 112, vy: -1200 }];
    const result = system.handleBlockCollisions(shots, [block], blockDefs);
    expect(result.nextShots).toHaveLength(0);
  });

  it('remainingHits=1 블록 피격 → isDestroyed=true, BlockDestroyed 이벤트', () => {
    const { system } = makeSystem();
    const block = makeBlock({ x: 320, y: 100, remainingHits: 1 });
    const shots: LaserShotState[] = [{ id: 'laser_0', x: 352, y: 112, vy: -1200 }];
    const result = system.handleBlockCollisions(shots, [block], blockDefs);
    expect(result.nextBlocks[0]?.isDestroyed).toBe(true);
    expect(result.events).toHaveLength(1);
    expect(result.events[0]).toMatchObject({ type: 'BlockDestroyed', blockId: 'block_0', scoreDelta: 10 });
    expect(result.destroyedBlockIds).toContain('block_0');
  });

  it('remainingHits=2 블록 피격 → remainingHits=1, BlockHit 이벤트', () => {
    const { system } = makeSystem();
    const block = makeBlock({ x: 320, y: 100, remainingHits: 2, definitionId: 'tough' });
    const shots: LaserShotState[] = [{ id: 'laser_0', x: 352, y: 112, vy: -1200 }];
    const result = system.handleBlockCollisions(shots, [block], blockDefs);
    expect(result.nextBlocks[0]?.remainingHits).toBe(1);
    expect(result.nextBlocks[0]?.isDestroyed).toBe(false);
    expect(result.events[0]).toMatchObject({ type: 'BlockHit', blockId: 'block_0', remainingHits: 1 });
  });

  it('이미 파괴된 블록은 충돌 검사에서 제외된다', () => {
    const { system } = makeSystem();
    const block = makeBlock({ x: 320, y: 100, isDestroyed: true });
    const shots: LaserShotState[] = [{ id: 'laser_0', x: 352, y: 112, vy: -1200 }];
    const result = system.handleBlockCollisions(shots, [block], blockDefs);
    expect(result.nextShots).toHaveLength(1); // shot 유지
    expect(result.events).toHaveLength(0);
  });

  it('첫 번째 hit 블록에서만 소멸 — 관통 없음', () => {
    const { system } = makeSystem();
    // 두 블록이 겹치는 위치 (y 방향으로 인접)
    const block1 = makeBlock({ id: 'b1', x: 320, y: 100, remainingHits: 1 });
    const block2 = makeBlock({ id: 'b2', x: 320, y: 124, remainingHits: 1 }); // y=124, 이전 블록 아래
    // shot을 두 블록 사이에 배치 (block1 내부 y=112)
    const shots: LaserShotState[] = [{ id: 'laser_0', x: 352, y: 112, vy: -1200 }];
    const result = system.handleBlockCollisions(shots, [block1, block2], blockDefs);
    // shot은 1개만 소멸 (관통 없음)
    expect(result.nextShots).toHaveLength(0); // 1발 소멸
    // block1만 피격 (첫 번째)
    const b1 = result.nextBlocks.find((b) => b.id === 'b1');
    expect(b1?.isDestroyed).toBe(true);
  });

  it('여러 shots가 서로 다른 블록에 각각 hit', () => {
    const { system } = makeSystem();
    const block1 = makeBlock({ id: 'b1', x: 320, y: 100, remainingHits: 1 });
    const block2 = makeBlock({ id: 'b2', x: 0, y: 200, remainingHits: 1 });
    const shots: LaserShotState[] = [
      { id: 'laser_0', x: 352, y: 112, vy: -1200 }, // block1 내부
      { id: 'laser_1', x: 32, y: 212, vy: -1200 },  // block2 내부
    ];
    const result = system.handleBlockCollisions(shots, [block1, block2], blockDefs);
    expect(result.nextShots).toHaveLength(0); // 2발 모두 소멸
    expect(result.nextBlocks.filter((b) => b.isDestroyed)).toHaveLength(2);
    expect(result.events.filter((e) => e.type === 'BlockDestroyed')).toHaveLength(2);
  });

  it('scoreDelta가 파괴된 블록 점수 합계를 반환한다', () => {
    const { system } = makeSystem();
    const block1 = makeBlock({ id: 'b1', x: 320, y: 100, remainingHits: 1, definitionId: 'basic' });
    const block2 = makeBlock({ id: 'b2', x: 0, y: 200, remainingHits: 1, definitionId: 'basic' });
    const shots: LaserShotState[] = [
      { id: 'laser_0', x: 352, y: 112, vy: -1200 },
      { id: 'laser_1', x: 32, y: 212, vy: -1200 },
    ];
    const result = system.handleBlockCollisions(shots, [block1, block2], blockDefs);
    expect(result.scoreDelta).toBe(20); // 10 + 10
  });
});
