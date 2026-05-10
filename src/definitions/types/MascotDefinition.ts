/**
 * MascotDefinition — 응원 픽셀아트 캐릭터 정의 (한 종류).
 *
 * Title 화면에서 선택 / 잠금 해제 가능. InGame 우측 하단에서 4프레임 댄스 애니메이션.
 *
 * 추가 캐릭터는 MascotTable 에 한 줄 더 넣으면 자동 노출 (data-driven).
 *
 * Unity 매핑: ScriptableObject (MascotData) — id 별 sprite 4장 + 이름 + 비용.
 */
export type MascotDefinition = {
  /** 고유 ID — 'albatross', 'kongming', 'snowrabbit', 'reaper', 'seraphin' 등. */
  id: string;
  /** Title/InGame 표시 이름 (영문 대문자 권장). */
  displayName: string;
  /** 한국어 부제 (Title 에 작은 글씨로 표시 가능). */
  subtitle: string;
  /** 잠금 해제에 필요한 골드. 0 이면 시작부터 해제 (default: albatross). */
  unlockCost: number;
  /** placeholder 채움색 (Phaser Rectangle fill). Unity 포팅 시 sprite 로 교체. */
  placeholderColor: number;
  /** placeholder 외곽선 색. */
  placeholderStrokeColor: number;
  /**
   * 4프레임 댄스 애니메이션의 sprite ID 배열 (Phase 후 단계용).
   * 현재 placeholder 단계라 미사용 — Unity 포팅 시 실제 sprite 연결.
   */
  spriteFrameIds: readonly string[];
};
