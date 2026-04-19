# MVP1_구현.md

## 1. 문서 목적

본 문서는 `풀아키텍처.md`를 기준으로, **MVP 1 구현 범위와 작업 순서를 고정하는 구현 지시서**다.

목표는 다음 두 가지다.

1. 2D 알카노이드형 게임의 **코어 플레이 루프가 실제로 동작하는지 검증**
2. 전체 아키텍처 중 핵심 축인 **Flow / Gameplay / Presentation / Persistence / Definitions / Asset Resolution**이 최소 범위 안에서 연결되는지 검증

이 문서는 Claude Code에 구현을 지시할 때, **무엇을 만들고 무엇을 만들지 말아야 하는지**를 명확히 하기 위한 기준 문서다.

---

## 2. MVP 1 목표

MVP 1의 목표는 **완성본 축소판**이 아니라, **코어 루프와 구조 검증판**을 만드는 것이다.

이번 단계에서 반드시 증명해야 하는 것은 다음과 같다.

- Title → RoundIntro → InGame → GameOver 흐름이 실제로 동작한다.
- 바 이동, 공 반사, 블록 파괴, 라이프 감소, 게임오버가 실제로 동작한다.
- StageDefinition 기반으로 Stage 1이 로드된다.
- 확장 아이템 1종이 드랍 → 획득 → 효과 적용까지 동작한다.
- 최고 점수가 로컬 저장되고, 다음 실행 시 다시 표시된다.

---

## 3. 포함 범위

### 3-1. 게임 흐름
포함 상태:
- Title
- RoundIntro
- InGame
- GameOver

포함 흐름:
- Title에서 스페이스 입력으로 시작
- RoundIntro 연출 후 InGame 진입
- 공 하단 이탈 후 라이프가 남아 있으면 RoundIntro를 거쳐 같은 스테이지 재시작
- 라이프가 0이면 GameOver 진입
- GameOver에서 스페이스 입력으로 Title 복귀

### 3-2. 플레이 규칙
포함 규칙:
- 바 좌우 이동
- 공 1개
- 공 발사
- 공의 벽 / 바 / 블록 반사
- 블록 `maxHits` 규칙
- 블록 파괴 시 점수 증가
- 공 하단 이탈 시 라이프 감소
- 라이프 0 시 GameOver 조건 충족
- Stage 1 클리어 시 MVP 1에서는 임시 클리어 처리 후 Title 복귀

### 3-3. 콘텐츠
포함 콘텐츠:
- Stage 1만 구현
- 기본 블록
- 드랍 블록
- 아이템 1종만 구현: `expand`

### 3-4. UI
포함 화면 요소:
- Title 화면
  - 타이틀 로고
  - 시작 문구
  - HIGH SCORE 표시
- RoundIntro 화면
  - `ROUND 1`
  - `READY`
- InGame HUD
  - 현재 점수
  - 남은 라이프
  - 현재 라운드
- GameOver 화면
  - `GAME OVER`
  - 최종 점수
  - 재도전 문구

### 3-5. 사운드
포함 사운드:
- 타이틀 BGM
- Round Start 징글
- `BlockHit` SFX
- `BlockDestroyed` SFX
- `ItemCollected` SFX
- `LifeLost` SFX
- GameOver 징글
- UI confirm SFX

### 3-6. 저장
포함 저장:
- 최고 점수 로컬 저장 / 로드

### 3-7. 데이터
포함 Definition 테이블:
- `StageDefinitionTable`
- `BlockDefinitionTable`
- `ItemDefinitionTable`
- `GameplayConfigTable`
- `UITextTable`
- `AudioCueTable`

---

## 4. 제외 범위

### 4-1. 상태 / 화면
제외:
- IntroStory
- GameClear
- Stage 2
- Stage 3

### 4-2. 아이템 / 효과
제외:
- 자석
- 레이저
- 다중 공
- 효과 교체 정책 전체 검증

### 4-3. 기믹
제외:
- 회전체 전부

### 4-4. 표현
제외:
- 타이핑 연출
- 고급 결과 화면 장식
- 추가 특수 이펙트

### 4-5. 확장 기능
제외:
- 로그인
- 구글 연동
- 닉네임 입력
- 온라인 랭킹

---

## 5. MVP 1 완료 기준

다음이 모두 동작하면 MVP 1 완료로 본다.

- Title 진입
- 스페이스 입력으로 시작
- RoundIntro 표시 후 InGame 진입
- Stage 1 로드
- 바 이동 가능
- 공 발사 가능
- 공 반사 가능
- 블록 1회 / 2회 피격 규칙 동작
- 블록 파괴 시 점수 증가
- 확장 아이템 드랍
- 확장 아이템 획득
- 바 길이 1.5배 증가
- 공 하단 이탈 시 라이프 감소
- 라이프가 남아 있으면 같은 스테이지 재시작
- 라이프가 0이면 GameOver
- GameOver에서 스페이스 입력으로 Title 복귀
- 최고 점수 저장/로드 가능

---

## 6. 아키텍처 범위

MVP 1에서 실제로 검증할 상위 축은 다음과 같다.

- Input Acquisition
- Flow State
- Gameplay Simulation
- Presentation
- Audio Playback
- Persistence
- Game Definitions
- Asset Resolution

단, **전체 축을 풀기능으로 구현하는 것이 아니라 MVP 1에서 필요한 최소 연결만 구현**한다.

---

## 7. 상태 전이 범위

### 7-1. MVP 1 상태 목록
- Title
- RoundIntro
- InGame
- GameOver

### 7-2. MVP 1 상태 전이표

| 현재 상태 | 조건 / 입력 | 다음 상태 | 비고 |
|---|---|---|---|
| Title | `StartGameRequested` | RoundIntro | 스페이스 입력 |
| RoundIntro | `RoundIntroFinished` | InGame | 연출 종료 |
| InGame | `LifeLost` + `remainingLives > 0` | RoundIntro | 같은 스테이지 재시작 |
| InGame | `GameOverConditionMet` | GameOver | 라이프 0 |
| InGame | `StageCleared` | Title | MVP 1에서는 임시 클리어 처리 후 Title 복귀 |
| GameOver | `RetryRequested` | Title | 스페이스 입력 |

---

## 8. 구현 대상 폴더/파일 범위

### 8-1. app
- `bootstrapGame.ts`
- `createAppContext.ts`
- `main.ts`

### 8-2. input
- `KeyboardInputSource.ts`
- `InputSnapshot.ts`
- `InputMapper.ts`

### 8-3. flow
- `state/GameFlowState.ts`
- `controller/GameFlowController.ts`
- `controller/FlowInputResolver.ts`
- `controller/FlowTransitionPolicy.ts`
- `controller/FlowLifecycleHandler.ts`
- `events/flowEvents.ts`

### 8-4. gameplay
- `state/GameplayRuntimeState.ts`
- `state/GameSessionState.ts`
- `state/BarState.ts`
- `state/BallState.ts`
- `state/BlockState.ts`
- `state/ItemDropState.ts`
- `controller/GameplayController.ts`
- `controller/InputCommandResolver.ts`
- `systems/MovementSystem.ts`
- `systems/CollisionService.ts`
- `systems/CollisionResolutionService.ts`
- `systems/StageRuleService.ts`
- `systems/StageRuntimeFactory.ts`
- `events/gameplayEvents.ts`

### 8-5. presentation
- `state/ScreenState.ts`
- `controller/ScreenDirector.ts`
- `controller/ScreenPresenter.ts`
- `controller/HUDPresenter.ts`
- `controller/VisualEffectController.ts`
- `renderer/SceneRenderer.ts`
- `renderer/renderTitleScreen.ts`
- `renderer/renderRoundIntroScreen.ts`
- `renderer/renderInGameScreen.ts`
- `renderer/renderGameOverScreen.ts`
- `events/presentationEvents.ts`
- `view-models/TitleScreenViewModel.ts`
- `view-models/RoundIntroViewModel.ts`
- `view-models/HudViewModel.ts`
- `view-models/GameOverViewModel.ts`

### 8-6. audio
- `AudioCueResolver.ts`
- `AudioPlayer.ts`

### 8-7. persistence
- `ISaveRepository.ts`
- `LocalSaveRepository.ts`
- `SaveData.ts`

### 8-8. definitions
- `tables/StageDefinitionTable.ts`
- `tables/BlockDefinitionTable.ts`
- `tables/ItemDefinitionTable.ts`
- `tables/GameplayConfigTable.ts`
- `tables/UITextTable.ts`
- `tables/AudioCueTable.ts`
- 각 타입 파일
- 각 validator 파일

### 8-9. assets
- `AssetCatalog.ts`
- `AssetResolver.ts`
- `assetIds.ts`

---

## 9. MVP 1 RuntimeState 범위

### 9-1. GameSessionState
- `currentStageIndex`
- `score`
- `lives`
- `highScore`

### 9-2. GameplayRuntimeState
- `session`
- `bar`
- `balls`
- `blocks`
- `itemDrops`
- `isStageCleared`

### 9-3. BarState
- `x`
- `y`
- `width`
- `moveSpeed`
- `activeEffect: 'none' | 'expand'`

### 9-4. BallState
- `id`
- `x`
- `y`
- `vx`
- `vy`
- `isActive`

### 9-5. BlockState
- `id`
- `x`
- `y`
- `remainingHits`
- `isDestroyed`
- `definitionId`

### 9-6. ItemDropState
- `id`
- `itemType: 'expand'`
- `x`
- `y`
- `fallSpeed`
- `isCollected`

### 9-7. ScreenState
- `currentScreen`
- `roundIntroRemainingTime`
- `blockHitFlashBlockIds`
- `isBarBreaking`

---

## 10. MVP 1 Definition 데이터 범위

### 10-1. StageDefinitionTable
포함:
- `stageId`
- `displayName`
- `backgroundId`
- `barSpawnX`
- `barSpawnY`
- `ballSpawnX`
- `ballSpawnY`
- `ballInitialSpeed`
- `ballInitialAngleDeg`
- `blocks`

### 10-2. BlockDefinitionTable
포함:
- `definitionId`
- `maxHits`
- `score`
- `dropItemType: 'none' | 'expand'`
- `visualId`

### 10-3. ItemDefinitionTable
포함:
- `itemType: 'expand'`
- `displayNameTextId`
- `descriptionTextId`
- `iconId`
- `fallSpeed`
- `effectType: 'expand'`
- `expandMultiplier`

### 10-4. GameplayConfigTable
포함:
- `initialLives`
- `baseBarWidth`
- `barMoveSpeed`
- `roundIntroDurationMs`
- `blockHitFlashDurationMs`
- `barBreakDurationMs`

### 10-5. UITextTable
필수 키:
- `txt_title_start`
- `txt_title_highscore`
- `txt_round_01`
- `txt_ready`
- `txt_gameover`
- `txt_retry`
- `txt_item_expand_name`
- `txt_item_expand_desc`

### 10-6. AudioCueTable
필수 매핑:
- `EnteredTitle`
- `EnteredRoundIntro`
- `BlockHit`
- `BlockDestroyed`
- `ItemCollected`
- `LifeLost`
- `EnteredGameOver`
- `UiConfirm`

---

## 11. 이벤트 범위

### 11-1. Flow 이벤트
- `EnteredTitle`
- `EnteredRoundIntro`
- `EnteredInGame`
- `EnteredGameOver`

### 11-2. Gameplay 이벤트
- `BallLaunched`
- `BlockHit`
- `BlockDestroyed`
- `ItemSpawned`
- `ItemCollected`
- `LifeLost`
- `StageCleared`
- `GameOverConditionMet`

### 11-3. Presentation 이벤트
- `RoundIntroFinished`
- `LifeLostPresentationFinished`

### 11-4. payload 원칙
- payload는 반응에 필요한 최소 정보만 담는다.
- 필요 없는 이벤트에는 payload를 붙이지 않는다.

---

## 12. 시뮬레이션 틱 순서

MVP 1에서 Gameplay 틱은 다음 순서로 수행한다.

1. 인게임 입력 해석
2. 즉시 명령 적용
3. 이동 갱신
4. 충돌 감지
5. 충돌 결과 반영
6. 라이프 손실 판정
7. 스테이지 클리어 / 게임오버 판정
8. RuntimeState 최종 반영
9. Gameplay 이벤트 발행

---

## 13. 충돌 정책 범위

### 13-1. 포함 충돌
- Ball ↔ Wall
- Ball ↔ Bar
- Ball ↔ Block
- Ball ↔ Floor
- ItemDrop ↔ Bar
- ItemDrop ↔ Floor

### 13-2. 제외 충돌
- Bar ↔ Block
- Ball ↔ ItemDrop
- ItemDrop ↔ Block

### 13-3. 특수 처리
- Bar ↔ Wall은 충돌이 아니라 clamp 처리

---

## 14. 구현 순서

### 1단계. 타입과 Definition 데이터 고정
- RuntimeState 타입 정의
- Definition 타입 정의
- 이벤트 타입 정의
- MVP 1 예시 데이터 파일 작성

### 2단계. Flow 구현
- `GameFlowState`
- `FlowTransitionPolicy`
- `FlowInputResolver`
- `GameFlowController`

### 3단계. Gameplay 최소 루프 구현
- `GameplayRuntimeState`
- `InputCommandResolver`
- `MovementSystem`
- `CollisionService`
- `CollisionResolutionService`
- `StageRuleService`
- `GameplayController`

### 4단계. Stage 1 로드 연결
- `StageRuntimeFactory`
- StageDefinition → RuntimeState 변환

### 5단계. 최소 Presentation 연결
- `ScreenDirector`
- `ScreenPresenter`
- `HUDPresenter`
- `SceneRenderer`

### 6단계. 필수 연출 연결
- `VisualEffectController`
- RoundIntro 종료
- 블록 피격 플래시
- 바 파괴 연출

### 7단계. 확장 아이템 1종 연결
- 드랍 생성
- 낙하
- 획득
- 바 길이 확장

### 8단계. 저장 연결
- highScore 로드 / 갱신 / 저장

### 9단계. 오디오 연결
- 타이틀 BGM
- 징글
- 핵심 SFX

---

## 15. 테스트 범위

### 15-1. 상태 전이 테스트
- Title → RoundIntro
- RoundIntro → InGame
- InGame → RoundIntro (라이프 남음)
- InGame → GameOver
- GameOver → Title

### 15-2. Gameplay 규칙 테스트
- 바 이동
- 바 clamp
- 공 반사
- 블록 피격
- 블록 파괴
- 점수 증가
- 아이템 생성
- 아이템 획득
- 라이프 감소
- 게임오버 조건

### 15-3. 데이터 검증 테스트
- StageDefinition 참조 무결성
- BlockDefinition 값 범위
- ItemDefinition 값 범위
- UIText 필수 키 존재 여부

### 15-4. 저장 테스트
- highScore load
- highScore update
- highScore save

### 15-5. 통합 시나리오 테스트
- 시작 → 플레이 → 라이프 손실 → 재시작
- 시작 → 플레이 → 게임오버 → 타이틀 복귀

---

## 16. Claude Code 구현 지시 원칙

### 16-1. 절대 하지 말아야 할 것
- IntroStory 구현 금지
- GameClear 구현 금지
- Stage 2, 3 구현 금지
- 자석 구현 금지
- 레이저 구현 금지
- 회전체 구현 금지
- 로그인/구글/닉네임/랭킹 구현 금지

### 16-2. 아키텍처 위반 금지
- gameplay에서 presentation import 금지
- gameplay에서 audio import 금지
- definitions에 runtime state 넣지 말 것
- assets에 게임 규칙 넣지 말 것

### 16-3. 구현 원칙
- 타입과 데이터부터 만든다.
- Flow와 Gameplay 코어를 먼저 만든다.
- 시각 퀄리티보다 상태 변화와 규칙 검증을 우선한다.

---

## 17. 성공 판정

MVP 1은 다음 질문에 모두 “예”라고 답할 수 있으면 성공이다.

- Title에서 시작할 수 있는가?
- RoundIntro를 거쳐 InGame으로 진입하는가?
- Stage 1이 Definition 데이터에서 로드되는가?
- 공 반사와 블록 파괴가 동작하는가?
- 확장 아이템 드랍/획득/적용이 동작하는가?
- 공을 놓치면 라이프가 줄어드는가?
- 라이프가 0이면 GameOver로 가는가?
- 최고 점수가 저장되고 다음 실행 시 다시 보이는가?

---

## 18. 다음 단계 연결

MVP 1 검증 후에는 바로 전체 기능을 한 번에 구현하지 않는다.  
먼저 구조를 회고하고 보정한 뒤, 다음 단계로 넘어간다.

다음 단계:
- `MVP2_구현.md`
  - IntroStory
  - GameClear
  - Stage 2, 3
  - 결과 화면 확장

그다음:
- `MVP3_구현.md`
  - 자석
  - 레이저
  - 회전체
  - 고복잡도 충돌/이벤트 확장

---

## 19. 한 줄 정의

**MVP 1은 Stage 1 기반 코어 알카노이드 플레이와 최소 제품 구조를 검증하는 구현 단계다.**