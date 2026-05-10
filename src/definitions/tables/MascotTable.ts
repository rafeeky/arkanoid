import type { MascotDefinition } from '../types/MascotDefinition';

/**
 * MascotTable — 응원 픽셀아트 캐릭터 5종 (data-driven).
 *
 * 추가 캐릭터:
 *   1. 이 배열에 새 객체 한 줄 추가
 *   2. (Unity 포팅 시) 해당 캐릭터의 sprite 에셋 추가
 *   → 자동으로 Title 캐러셀 + InGame 응원 영역에 노출.
 *
 * 잠금 해제 비용은 *대략* 진행도에 비례:
 *   - albatross: 0 (기본)
 *   - kongming: 100
 *   - snowrabbit: 300
 *   - reaper: 600
 *   - seraphin: 1000
 * 1 score = 1 gold 변환. 출시 전 밸런스 조정 가능.
 */
export const MascotTable: readonly MascotDefinition[] = [
  {
    id: 'albatross',
    displayName: 'ALBATROSS',
    subtitle: '알바트로스',
    unlockCost: 0,
    placeholderColor: 0xffffff,
    placeholderStrokeColor: 0x666666,
    spriteFrameIds: ['mascot.albatross.frame0', 'mascot.albatross.frame1', 'mascot.albatross.frame2', 'mascot.albatross.frame3'],
  },
  {
    id: 'kongming',
    displayName: 'KONGMING',
    subtitle: '콩밍이 (햄스터)',
    unlockCost: 100,
    placeholderColor: 0xffe0a0,
    placeholderStrokeColor: 0xc89060,
    spriteFrameIds: ['mascot.kongming.frame0', 'mascot.kongming.frame1', 'mascot.kongming.frame2', 'mascot.kongming.frame3'],
  },
  {
    id: 'snowrabbit',
    displayName: 'SNOW RABBIT',
    subtitle: '눈토끼',
    unlockCost: 300,
    placeholderColor: 0xeaf6ff,
    placeholderStrokeColor: 0x88aacc,
    spriteFrameIds: ['mascot.snowrabbit.frame0', 'mascot.snowrabbit.frame1', 'mascot.snowrabbit.frame2', 'mascot.snowrabbit.frame3'],
  },
  {
    id: 'reaper',
    displayName: 'REAPER',
    subtitle: '저승이 (해골)',
    unlockCost: 600,
    placeholderColor: 0x444466,
    placeholderStrokeColor: 0xaaaadd,
    spriteFrameIds: ['mascot.reaper.frame0', 'mascot.reaper.frame1', 'mascot.reaper.frame2', 'mascot.reaper.frame3'],
  },
  {
    id: 'seraphin',
    displayName: 'SERAPHIN',
    subtitle: '세라핀 (분홍 세이렌)',
    unlockCost: 1000,
    placeholderColor: 0xffb0d0,
    placeholderStrokeColor: 0xcc6699,
    spriteFrameIds: ['mascot.seraphin.frame0', 'mascot.seraphin.frame1', 'mascot.seraphin.frame2', 'mascot.seraphin.frame3'],
  },
];

/** ID 로 MascotDefinition 조회. 없으면 albatross fallback. */
export function getMascotById(id: string): MascotDefinition {
  return MascotTable.find((m) => m.id === id) ?? MascotTable[0]!;
}

/** 기본 마스코트 ID — 신규 SaveData 의 selectedMascot / unlockedMascots[0]. */
export const DEFAULT_MASCOT_ID = MascotTable[0]!.id;
