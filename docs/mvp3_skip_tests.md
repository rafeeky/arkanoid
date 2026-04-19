# MVP3 Skip 테스트 분류

## 개요

현재 35건의 테스트가 `it.skip` 처리되어 있다.
skip 사유는 크게 두 가지이며, 각각 복원 시점이 다르다.

- **Category A**: 스테이지 블록 수 관련 (32건) — dev 스테이지 10블록 대체로 인한 임시 skip
- **Category B**: Intro Erasing 로직 관련 (3건) — erasing phase 미사용 결정 검토 대기
- **Category C**: MVP3 중 복원 예정 — 해당 없음 (현재 기준)

---

## Category A: 스테이지 데이터 원복 대기 (32건)

커밋 `1417858` 에서 개발 편의를 위해 모든 스테이지를 10블록 dev 버전으로 대체했다.
원본 스테이지(65/78/91블록) 복원 시 아래 테스트를 재활성화한다.

### src/definitions/validators/validateStageDefinition.test.ts (6건)

| 라인 | 테스트명 |
|------|---------|
| 17 | `stage1 has exactly 65 block placements` |
| 24 | `stage1 has exactly 6 "basic_drop" placements` |
| 42 | `stage2 has exactly 78 block placements (6 rows x 13 cols)` |
| 49 | `stage2 has exactly 8 "basic_drop" placements` |
| 67 | `stage3 has exactly 91 block placements (7 rows x 13 cols)` |
| 74 | `stage3 has exactly 10 "basic_drop" placements` |

### src/gameplay/controller/GameplayLifecycleHandler.test.ts (5건)

| 라인 | 테스트명 |
|------|---------|
| 20 | `블록 65개 생성` |
| 28 | `드랍 블록(basic_drop) 6개` |
| 227 | `stage1 → stage2: 블록 수가 78개로 교체된다` |
| 236 | `stage2 → stage3: 블록 수가 91개로 교체된다` |
| 245 | `stage1(65블록) → stage2(78블록): 이전 블록과 다른 개수` |

### src/app/integrationScenarios.test.ts (11건)

| 라인 | 테스트명 |
|------|---------|
| 88 | `2. spaceJustPressed tick → introStory, IntroSequenceFinished → roundIntro, Stage 1 블록 65개 로드됨` |
| 119 | `5. LifeLost 후 resetForRetry: 블록 수 유지(65개)` |
| 402 | `새 게임 시작 시 블록 65개, 파괴된 블록 없음` |
| 415 | `GameOver → Title → 재시작 시 블록 65개 재로드 (상태 초기화 확인)` |
| 508 | `A-3. IntroSequenceFinished → roundIntro (stage=0), Stage 1 블록 65개 로드됨` |
| 526 | `A-5. Stage 1 전체 블록 파괴 후 tick → roundIntro (stage=1) 전이, Stage 2 블록 78개 로드됨` |
| 538 | `A-6. Stage 2 전체 블록 파괴 후 tick → roundIntro (stage=2) 전이, Stage 3 블록 91개 로드됨` |
| 724 | `C-1. Stage 2 진입 후 currentStageIndex=1, blocks=78` |
| 746 | `C-3. Stage 2 LifeLost 후 재시도: blocks 78개 그대로 (블록 수 유지)` |
| 776 | `C-5. Stage 2 LifeLost 후 RoundIntroFinished → 같은 Stage 2로 inGame 재진입` |
| 949 | `E-5. Title 복귀 후 새 게임 시작 → Stage 1 블록 65개 로드됨 (블록 재초기화)` |

### src/app/createAppContext.test.ts (10건)

| 라인 | 테스트명 |
|------|---------|
| 60 | `IntroSequenceFinished 후 RoundIntro 전이, 블록 65개 로드됨` |
| 193 | `GameOver → Title → IntroStory → RoundIntro → blocks=65 (새 게임 초기화)` |
| 329 | `드랍 블록 파괴 시 itemDrops 에 아이템이 추가된다 (ItemSpawned)` |
| 349 | `아이템 획득 후 bar.width === baseBarWidth * 1.5 (= 180)` |
| 461 | `아이템 낙하 중(itemDrops.length>0)이면 같은 드랍 블록 파괴 시 아이템 spawn 안 됨 — 1개 제약` |
| 730 | `BlockHit/BlockDestroyed 이벤트 시 해당 sfx cue 재생` |
| 851 | `Title → IntroStory → RoundIntro(from=introStory): Stage 0 로드, blocks=65` |
| 862 | `Stage 0 클리어 → RoundIntro(from=inGame): Stage 1 로드, blocks=78` |
| 916 | `Stage 1 클리어 → Stage 2 로드, blocks=91` |
| 960 | `Stage 0 LifeLost 후 RoundIntro: 같은 스테이지(blocks=65) 유지` |

---

## Category B: Intro Erasing 제거 대기 (3건)

`VisualEffectController` 의 `erasing` phase 관련 테스트.
현재 erasing 미사용 결정이 확정되면 삭제 처리한다.
확정 전까지는 skip 유지.

### src/presentation/controller/VisualEffectController.test.ts

| 라인 | 테스트명 |
|------|---------|
| 223 | `hold 200ms 경과 시 phase = erasing 으로 전환` |
| 235 | `erasing 시작 직후 progress ≈ 1 (아직 elapsed=0)` |
| 246 | `erasing 중간(25ms): progress ≈ 0.5 (eraseDuration=50ms)` |

---

## Category C: MVP3 중 복원 예정 (1건)

### src/gameplay/systems/CeilingBlockTunnel.test.ts

| 라인 | 테스트명 |
|------|---------|
| 39 | `재현 실패 — F1 오버레이로 실제 발생 순간 로그 수집 후 구체 케이스 추가` |

이 테스트는 MVP1 회귀 버그(천장 반사 직후 블록 통과)의 회귀 스켈레톤이다.
F1 오버레이로 실제 발생 순간을 캡처한 뒤 구체 파라미터를 채워 skip 해제한다.

---

## 복원 절차

### Category A 복원 (스테이지 데이터 원복)

1. `git log` 에서 커밋 `1417858` 확인
2. `stage*.json` 또는 `StageDefinitionTable.ts` 의 원본(65/78/91블록) 복원
3. `grep -rn "TODO(dev): 커밋 1417858"` 으로 skip 마커 찾기
4. 해당 `it.skip` → `it` 으로 변경
5. `npm run test` 실행 후 fail 이면 개별 수정

### Category B 복원 (Erasing 삭제 확정 시)

1. `erasing` phase 코드가 실제로 제거되었는지 확인
2. `VisualEffectController.test.ts` 의 3건 `it.skip` 라인을 완전 삭제
3. `npm run test` 실행 확인

### Category C 복원 (천장 반사 버그 재현 시)

1. F1 오버레이(`DevOverlayRenderer.ts`) 로 실제 발생 순간 로그 수집
2. `CeilingBlockTunnel.test.ts` 의 `it.skip` → `it` 으로 변경 후 구체 파라미터 채우기
3. 재현 성공 시 버그 수정 → 테스트 green 확인
