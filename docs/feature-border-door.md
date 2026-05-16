# Feature Design — BorderBlock + Door (스피너 등장 게이트)

**상태:** v1 (2026-05-16 결정 확정) → **구현 완료** (Checkpoint A~E 모두 완료, 2026-05-16~17). 966/966 테스트 통과.

**Checkpoint 완료 내역:**
- A: BorderBlock entity + state + render + collision + stage1 테스트 데이터
- B: Door state + entity + 닫힌 상태 충돌
- C: Door opening 애니메이션 (600ms slide-left, ease-out)
- D: opened 전이 시 SpinnerSystem.spawnFromDoor (descending phase 바로 진입, spawning skip)
- E: 에디터 Border/Door 배치 UI + JSON 스키마 확장 (병존 B안)

## 확정 결정 (2026-05-16)

| # | 결정 |
|---|---|
| 1 | Border: 상단 64×12 (가로), 좌/우 12×64 (세로). `orientation` 필드로 구분 |
| 2 | JSON 스키마 B (병존) — 기존 `spinners` 유지 + 새 `doors` 추가 |
| 3 | State 분리 — `state.borders`, `state.doors` (state.blocks 와 별개) |
| 4 | Door 위치: 상단 테두리만 (스피너는 위에서 떨어지는 컨셉 유지) |
| 5 | SpinnerSystem 의 `spawning` phase 유지 — 직접 spawn 케이스(B 스키마에서 spinners 필드) 용. door 통한 스피너는 spawning 스킵하고 바로 descending |
| 6 | door 없는 스피너는 기존처럼 직접 spawn (B 스키마니까 자연스럽게 가능) |
| 7 | Door 애니메이션 길이 — 600ms (왼쪽 슬라이드, ease-out). 기존 spawning 400ms 보다 약간 김 — door 시각 강조 |

**연관 doc:** [`architecture.md` §14-3-x 오브젝트 카탈로그](./architecture.md), 기존 SpinnerSystem (3-phase: spawning → descending → circling)

---

## 1. 배경 / 목적

현재 플레이필드(720×720)는 단순히 캔버스 edge가 `Wall` 충돌 경계. HUD는 캔버스 절대 좌표라 playfield 밖. 시각적으로 "여기까지가 플레이 영역" 이라는 경계 표시가 없음.

새 시스템:
- **테두리(Border)** — 좌/우/상단에 *시각적 테두리* + 충돌 있는 벽. 일반 block보다 가늘게 (세로 1/2).
- **문(Door)** — 테두리 라인 위에 배치되는 게이트. 닫혀있다가 스테이지 시작 시 왼쪽 슬라이드로 열림. 열림 = 그 위치에서 스피너 spawn.

기존 `SpinnerSystem.spawning` phase (400ms gate 연출) 와 통합 가능 — 사실상 이미 절반은 구현돼 있음.

---

## 2. 두 신규 엔티티 정의

### 2-1. BorderBlock

- **역할:** 좌/우/상단 테두리. 시각적 영역 구분 + 안 깨지는 벽.
- **좌표 컨벤션:** 좌상단 (Block과 동일).
- **크기:** `BORDER_WIDTH × BORDER_HEIGHT`
  - **결정 필요:** 가로는 BLOCK_WIDTH=64 (동일), 세로는 BLOCK_HEIGHT/2=12 — 사용자 명시.
  - 가로 64 유지하면 세로 테두리(좌/우) 도 가로 64로 들어가야 함. playfield 너비에서 차지하는 비중 큼.
  - 대안: 좌/우 테두리는 회전 적용 (세로로 긴 64×12) — 하지만 데이터 모델 복잡.
- **충돌:** AABB. 공 부딪히면 반사. **안 깨짐** (`indestructible: true`).
- **렌더:** 일반 block과 다른 색/패턴 (예: 메탈릭 회색, 또는 빗금).
- **Entity 모듈:** `src/gameplay/entities/BorderBlock.ts`
  - `bounds(b): { x, y, w, h }`
  - `handleBallCollision(ball, side, b, physics): BallState` (Block 과 유사하지만 HP 감소 없음)

### 2-2. Door

- **역할:** 테두리 위에 배치. 닫힘 → 열림 애니메이션 → 스피너 spawn.
- **좌표 컨벤션:** 좌상단 (BorderBlock 라인 위).
- **크기:** BorderBlock 과 동일 (64 × 12).
- **상태 (3 phase):**
  | Phase | 충돌 | 공 차단 | 스피너 통과 | 비주얼 |
  |---|---|---|---|---|
  | `closed` | BorderBlock 처럼 작동 | ✅ 차단 | ✅ 차단 | 닫힌 문 |
  | `opening` | BorderBlock 처럼 작동 (애니 중에도 차단) | ✅ 차단 | ✅ 차단 | 슬라이드 애니 |
  | `opened` | 공 충돌만 | ✅ 차단 (사용자 결정) | ❌ 통과 가능 | 열린 문 |
- **타이밍:**
  - 스테이지 시작 시 (`EnteredInGame` 이벤트) `closed` → `opening` 전환
  - 애니메이션 길이: **결정 필요** — 권장 600ms (왼쪽으로 슬라이드, easing ease-out)
  - 애니 끝나면 `opened` + 스피너 spawn 트리거
- **공 충돌 동작:** *항상 차단* (사용자 결정). 즉 door 가 열려도 공은 통과 못함. 스피너만 통과.
- **렌더:** opening 중에는 width 가 0으로 줄어드는 애니 (왼쪽으로 슬라이드라면 x 가 줄고 width 도 줄어듦)
- **Entity 모듈:** `src/gameplay/entities/Door.ts`
  - `bounds(d): { x, y, w, h }`
  - `handleBallCollision(ball, side, d, physics): BallState` — 공은 *항상* 반사
  - `tickAnimation(d, dt): Door` — closed → opening → opened 진행
  - `isOpenForSpinner(d): boolean` — opening 끝났는지

---

## 3. Stage JSON 스키마 확장

**현재:**
```json
{
  "stageId": "...",
  "blocks": [...],
  "spinners": [{ "definitionId": "...", "x": ..., "y": ... }]
}
```

**제안 (옵션 A — 통합):**
```json
{
  "blocks": [...],
  "borders": [{ "row": 0, "col": 0 }, ...],
  "doors": [
    {
      "row": 0, "col": 4,           // 테두리 grid 좌표
      "spinnerDefinitionId": "spinner_cube"
    }
  ]
}
```
- 기존 `spinners` 필드 제거 → 모든 스피너는 door 통해서만 등장
- 장점: 스피너 spawn 위치가 명시적, door 없이 떠다니는 스피너 불가능
- 단점: 기존 stage JSON 마이그레이션 필요 (자동 변환 스크립트로 처리 가능)

**제안 (옵션 B — 병존):**
```json
{
  "blocks": [...],
  "borders": [...],
  "spinners": [...],     // 기존 호환 (door 없이 직접 spawn)
  "doors": [...]         // 신규 (door 통해 spawn)
}
```
- 장점: 마이그레이션 없음
- 단점: 같은 결과를 두 경로로 만들 수 있어 혼란

**결정 필요:** A vs B.

---

## 4. 기존 시스템과의 통합

### 4-1. Wall.ts 와의 관계

- 기존: `Wall` 은 캔버스 edge (0, 720) 에서 공을 반사.
- BorderBlock 도입 후: BorderBlock 이 시각상 안쪽에 있으면 공은 BorderBlock 에서 먼저 부딪힘. Wall 은 BorderBlock 뒤의 "최종 안전망" 역할.
- **결정 필요:** BorderBlock 이 playfield 의 *실질적 경계* 가 되고 Wall 은 죽은 코드가 됨? 또는 둘 다 살림 (BorderBlock 이 비어있을 가능성 대비)?
- 권장: BorderBlock 이 있을 때는 Wall 충돌이 안 일어나도록 자연스럽게 흐름 (BorderBlock 이 먼저 swept AABB 에 잡힘). Wall 코드는 유지.

### 4-2. SpinnerSystem.spawning phase 와의 관계

기존 SpinnerSystem 3-phase:
```
spawning (400ms, y=0 고정, ghost)
  → descending (선형 하강 80 px/s)
  → circling (원 궤도 1.5 rad/s, 반지름 150)
```

door 시스템이 도입되면:
- `spawning` phase 의 "gate 열림 연출 400ms" 가 **door 의 opening phase 로 흡수**됨.
- 스피너는 door 의 opening 끝난 시점에 생성됨 → 바로 descending phase 로 진입.
- 즉 SpinnerSystem 의 spawning phase 가 **사라지고**, door 가 그 역할을 맡음.

**결정 필요:**
- (i) 스피너 phase 를 `descending → circling` 2개로 줄임 (spawning 삭제)
- (ii) 스피너 phase 는 유지하되 door 가 시각 연출만 추가 (중복)

권장: (i). 책임 단일화. door 가 게이트 연출 + spawn 트리거, spinner 는 descending+circling 만.

### 4-3. 충돌 파이프라인

현재 `GameplayController.tick` 의 충돌 경로:
```
1. moveBallWithCollisions (Block + Wall swept)
2. sanityCheckBallBlockSeparation
3. detectCollisions (Bar + Item)
4. applyCollisions
5. SpinnerSystem.handleBallCollisions
6. SpinnerSystem.handleBlockCollisions
```

BorderBlock + Door 추가 후:
- BorderBlock 은 Block 과 동일한 swept AABB 처리에 포함 — `moveBallWithCollisions` 의 `blocks` 인자에 BorderBlock 도 포함시키면 됨 (단, HP 감소 분기에서 indestructible 체크).
- Door 는 BorderBlock 의 *변형* — 같은 swept 처리 + opening 애니 tick + spawn 트리거.

**결정 필요:** BorderBlock/Door 를 기존 `state.blocks` 에 포함시킬지 vs 별도 `state.borders`/`state.doors`?
- 포함: 충돌 코드 재사용 ↑, 하지만 일반 block 과 분리해서 다뤄야 하는 곳이 늘어남 (HP/destroy/score)
- 별도: 충돌 코드를 BorderBlock 별로 작성해야 함

권장: **별도** (`state.borders`, `state.doors`). entity 모듈도 별개. 일관성 ↑.

---

## 5. 에디터 UI 변경

에디터 (`src/editor/`) 에 다음 추가:
- **Border 배치 모드** — 클릭으로 테두리 셀에 BorderBlock 배치/제거
- **Door 배치 모드** — 클릭으로 테두리 셀에 Door 배치. 어떤 spinner 가 나올지 dropdown 으로 선택
- **테두리 셀 그리드 표시** — 현재 그리드(9×7)와 별개로, 좌/우/상단에 *얇은* 테두리 셀 라인 표시

기존 EditorUI 의 stage 1/2/3 탭 + Export/Import 는 그대로. JSON 스키마 확장에 맞춰 import/export 만 갱신.

---

## 6. 확정 데이터 형태

### Border state
```ts
type BorderBlockState = {
  id: string;
  x: number;        // 좌상단
  y: number;        // 좌상단
  orientation: 'horizontal' | 'vertical';  // horizontal = 64×12, vertical = 12×64
};
```

### Door state
```ts
type DoorState = {
  id: string;
  x: number;        // 좌상단 (상단 테두리 라인 위)
  y: number;        // 좌상단 (= 0 또는 BORDER_TOP_Y)
  orientation: 'horizontal';  // 상단만이라 항상 horizontal
  phase: 'closed' | 'opening' | 'opened';
  openingElapsedMs: number;  // 0 ~ 600
  spinnerDefinitionId: string;  // 열리면 어떤 스피너가 나올지
  spawnedSpinnerId: string | null;  // opened 후 생성된 spinner id
};
```

### Stage JSON 확장 (B 병존)
```json
{
  "stageId": "...",
  "blocks": [...],
  "borders": [
    { "row": 0, "col": 0, "orientation": "horizontal" },
    { "row": 0, "col": 1, "orientation": "horizontal" },
    { "row": 1, "col": 0, "orientation": "vertical" }
  ],
  "doors": [
    {
      "col": 4,
      "spinnerDefinitionId": "spinner_cube"
    }
  ],
  "spinners": [
    { "definitionId": "spinner_triangle", "x": 155, "y": 51 }
  ]
}
```

---

## 7. 구현 의존성 (leaf-first)

leaf 부터 빌드 순서:
```
1. playfieldLayout 에 BORDER_HEIGHT, BORDER_WIDTH 등 상수 추가
2. BorderBlock entity 모듈 + 충돌
3. BorderBlock 렌더링 + 에디터 배치
4. Door entity 모듈 (3-phase 상태 + 충돌 + 애니 tick)
5. Door 렌더링 (슬라이드 애니) + 에디터 배치 (spinner 선택 dropdown)
6. Stage JSON 스키마 확장 + 마이그레이션 (옵션 A 선택 시)
7. SpinnerSystem 의 spawning phase 와 door 통합
8. EnteredInGame 이벤트 → door opening 트리거 연결
9. 기존 stage JSON 들에 border + door 배치 (디자이너 작업)
```

각 단계는 독립적으로 빌드+검증 가능. 1~3 까지 가면 시각적으로 테두리 확인 가능 (door 없이).

---

## 8. 다음 액션

위 7개 open question 결정 → 그 결정을 이 doc 에 박음 → 단계별 구현 시작 (leaf 부터). 큰 단위로 한 번에 만들지 말고 한 step 씩.
