export type IntroSequenceEntry = {
  pageIndex: number;         // 0, 1, 2
  text: string;
  typingSpeedMs: number;     // 글자당 ms (기본 40)
  holdDurationMs: number;    // 완전 표시 후 유지 시간 (기본 1500)
  eraseSpeedMs: number;      // 지우기 속도 (기본 20)
};
