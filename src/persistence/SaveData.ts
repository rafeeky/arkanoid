import { DEFAULT_MASCOT_ID } from '../definitions/tables/MascotTable';

/**
 * 영속 저장 데이터.
 *
 * - highScore: 최고 점수
 * - gold: 누적 골드 (스테이지 점수에서 적립)
 * - unlockedMascots: 잠금 해제된 마스코트 ID 목록 (default: [albatross])
 * - selectedMascot: 현재 선택된 마스코트 ID (Title 캐러셀 + InGame 응원 표시)
 *
 * Unity 매핑: PlayerPrefs / 파일 직렬화 대상 객체.
 */
export type SaveData = {
  highScore: number;
  gold: number;
  unlockedMascots: readonly string[];
  selectedMascot: string;
};

export const createDefaultSaveData = (): SaveData => ({
  highScore: 0,
  gold: 0,
  unlockedMascots: [DEFAULT_MASCOT_ID],
  selectedMascot: DEFAULT_MASCOT_ID,
});
