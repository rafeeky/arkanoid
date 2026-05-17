import type { IntroSequenceEntry } from '../types/IntroSequenceEntry';

/**
 * 알바트로스 도입 스토리 4장면. 타이틀 → IntroStory → RoundIntro 흐름의 IntroStory 단계.
 * 사실 트리비아 톤. typing 40ms / hold 1.8s / erase 20ms.
 */
export const IntroSequenceTable: IntroSequenceEntry[] = [
  {
    pageIndex: 0,
    text: '알바트로스는 날개를 펼치면 3.5미터에 이르는 놀라운 비행 능력을 가진 새입니다.',
    typingSpeedMs: 40,
    holdDurationMs: 1800,
    eraseSpeedMs: 20,
  },
  {
    pageIndex: 1,
    text: '알바트로스는 바다 위를 수천 킬로미터 비행하며 먹이를 찾습니다.',
    typingSpeedMs: 40,
    holdDurationMs: 1800,
    eraseSpeedMs: 20,
  },
  {
    pageIndex: 2,
    text: '일부 알바트로스는 먹이를 찾아 한 번에 지구를 한 바퀴 돌기도 합니다.',
    typingSpeedMs: 40,
    holdDurationMs: 1800,
    eraseSpeedMs: 20,
  },
  {
    pageIndex: 3,
    text: '알바트로스의 놀라운 비행 능력을 기억해 주세요!',
    typingSpeedMs: 40,
    holdDurationMs: 1800,
    eraseSpeedMs: 20,
  },
];
