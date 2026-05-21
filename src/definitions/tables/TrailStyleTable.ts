/**
 * 공 파워 상태 트레일 스타일 — 데이터 테이블.
 *
 * `createBallTrail(style)` 컴포넌트에 주입할 config 프리셋들.
 * 새 스타일 추가는 *값만* 이 테이블에 추가하면 됨 (코드 변경 X).
 *
 * Unity 포팅 시 ScriptableObject 한 장으로 매핑 가능.
 */

export type TrailStyleId = 'golden_sun' | 'blue_meteor' | 'sunset';

export type TrailStyle = {
  /** 머리(head, 공 가까운 끝) 색 — 또렷. 16진수 RGB. */
  headColor: number;
  /** 꼬리(tail) 색 — fade 마지막. 보통 head 보다 옅거나 다른 톤. */
  tailColor: number;
  /** glow 색 (postFX). WebGL only — Canvas 렌더러에선 무시. */
  glowColor: number;
  /** 점 개수 — 길이 결정. 많을수록 김. */
  segmentCount: number;
  /** 머리쪽 알파 (또렷). 0..1. */
  headAlpha: number;
  /** 점 반지름 (px). 머리에서 꼬리로 갈수록 축소. */
  segmentRadius: number;
  /**
   * push 간격 (ms) — 시간 기반 샘플링. 16~20ms 권장 (60fps 기준 매 frame 또는 거의).
   * 짧을수록 촘촘/연속, 길수록 듬성. 너무 길면 (50ms+) 빠른 공에서 점선 끊김.
   */
  pushIntervalMs: number;
};

export const TRAIL_STYLES: Record<TrailStyleId, TrailStyle> = {
  // 황금~주황 + 강한 글로우. 강렬한 파워 시각.
  golden_sun: {
    headColor:      0xffdd44, // 황금
    tailColor:      0xff6622, // 주황
    glowColor:      0xffaa33,
    segmentCount:   16,
    headAlpha:      0.95,
    segmentRadius:  9,
    pushIntervalMs: 18,
  },
  // (정의 예약 — 값은 나중에 인게임 확인 후 튜닝)
  blue_meteor: {
    headColor:      0xeeffff,
    tailColor:      0x4488ff,
    glowColor:      0x66aaff,
    segmentCount:   16,
    headAlpha:      0.95,
    segmentRadius:  9,
    pushIntervalMs: 18,
  },
  sunset: {
    headColor:      0xff8866,
    tailColor:      0xff44aa,
    glowColor:      0xff6688,
    segmentCount:   16,
    headAlpha:      0.95,
    segmentRadius:  9,
    pushIntervalMs: 18,
  },
};
