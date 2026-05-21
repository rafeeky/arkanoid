import Phaser from 'phaser';
import type { TrailStyle } from '../../definitions/tables/TrailStyleTable';

/**
 * BallTrail — 공 파워 상태 시각 트레일.
 *
 * **단일 컴포넌트 + style config 주입** — 효과별로 따로 만들지 않음.
 * 새 트레일 스타일 추가는 `TrailStyleTable.ts` 값만 추가하면 됨.
 *
 * 동작:
 *   - 매 update(x, y) 호출 시 head 위치를 트레일 버퍼 앞에 추가.
 *   - 버퍼 크기 = style.segmentCount. 오래된 점은 자동 drop.
 *   - 각 점은 segment 인덱스에 따라 색/알파/반지름 fade.
 *   - 머리 (index 0) 는 공 위치 — 가독성 위해 *공 그림 뒤로* 배치 (depth 더 낮게).
 *
 * 사용자 가독성 룰: 꼬리가 공 위치를 가리면 안 됨 → 트레일 머리는 *공 뒤로*,
 * 공이 항상 위에 그려져 또렷.
 */
export type BallTrail = {
  /** 매 프레임 공 위치 update — 공이 움직였을 때만 호출 권장. */
  update(x: number, y: number): void;
  /** 켜기/끄기 (파워 상태 토글). 끄면 즉시 자식 모두 hide + 버퍼 clear. */
  setActive(active: boolean): void;
  /** 정리 (scene shutdown 시). */
  destroy(): void;
};

export function createBallTrail(scene: Phaser.Scene, style: TrailStyle): BallTrail {
  // 트레일 그래픽스 — 모든 segment 를 한 Graphics 에 매 프레임 다시 그림.
  // Phaser 의 setBlendMode 'ADD' 로 발광 느낌 강화 (검은 배경에서 색이 더 살아남).
  const graphics = scene.add.graphics();
  graphics.setBlendMode(Phaser.BlendModes.ADD);
  graphics.setDepth(-1); // 공 (default depth 0) 보다 뒤. 가독성 — 공이 트레일 위.
  graphics.setVisible(false);

  // glow postFX — graphics 외곽 발광.
  graphics.postFX?.addGlow(style.glowColor, 6, 0, false, 0.1, 16);

  // 트레일 점들의 *최근 N 위치* 버퍼. 머리(앞) → 꼬리(뒤).
  const buffer: { x: number; y: number }[] = [];
  let active = false;
  // 시간 기반 push — 마지막 push 시각 (performance.now()) 추적.
  let lastPushAt = 0;

  const draw = (): void => {
    graphics.clear();
    if (!active || buffer.length === 0) return;
    for (let i = 0; i < buffer.length; i++) {
      const t = i / Math.max(1, style.segmentCount - 1); // 0 (head) → 1 (tail)
      const alpha = style.headAlpha * (1 - t);            // fade out
      const radius = style.segmentRadius * (1 - t * 0.7); // 점점 작아짐
      const color = lerpColor(style.headColor, style.tailColor, t);
      const p = buffer[i]!;
      graphics.fillStyle(color, alpha);
      graphics.fillCircle(p.x, p.y, radius);
    }
  };

  return {
    update(x: number, y: number) {
      if (!active) return;
      const now = performance.now();
      // 간격 안 됐으면 skip (시간 기반 샘플링).
      if (now - lastPushAt < style.pushIntervalMs) return;
      // 정지 보호: 머리 위치가 *완전히 같으면* skip (일시정지 케이스 — 같은 위치에 누적 X).
      const head = buffer[0];
      if (head && head.x === x && head.y === y) return;
      // 새 segment push (머리에 추가). 오래된 건 자동 drop.
      buffer.unshift({ x, y });
      if (buffer.length > style.segmentCount) buffer.length = style.segmentCount;
      lastPushAt = now;
      draw();
    },
    setActive(next: boolean) {
      if (active === next) return;
      active = next;
      if (!next) {
        buffer.length = 0;
        graphics.clear();
        graphics.setVisible(false);
      } else {
        graphics.setVisible(true);
      }
    },
    destroy() {
      graphics.destroy();
    },
  };
}

/** 두 16진 색 사이 선형 보간. t=0 → c1, t=1 → c2. */
function lerpColor(c1: number, c2: number, t: number): number {
  const r1 = (c1 >> 16) & 0xff;
  const g1 = (c1 >> 8) & 0xff;
  const b1 = c1 & 0xff;
  const r2 = (c2 >> 16) & 0xff;
  const g2 = (c2 >> 8) & 0xff;
  const b2 = c2 & 0xff;
  const r = Math.round(r1 + (r2 - r1) * t);
  const g = Math.round(g1 + (g2 - g1) * t);
  const b = Math.round(b1 + (b2 - b1) * t);
  return (r << 16) | (g << 8) | b;
}
