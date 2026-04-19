# 풀아키텍처.md

## 1. 문서 목적

본 문서는 2D 알카노이드형 게임의 전체 아키텍처 기준서다.  
목표는 단순히 게임을 빠르게 만드는 것이 아니라, **TypeScript 선구현 후 Unity로 포팅 가능한 구조를 먼저 설계하고 검증하는 것**이다.

이 문서는 다음을 위한 기준 문서다.

- 전체 시스템을 어떤 책임 축으로 분리할지 정의
- 각 책임이 무엇을 맡고 무엇을 맡지 않는지 정의
- 상태 전이, 런타임 상태, 데이터 테이블, 이벤트, 충돌, 틱 순서를 고정
- 이후 작성할 `MVP1_구현.md`, `MVP2_구현.md`, `MVP3_구현.md`의 상위 기준 제공
- Claude Code가 구조를 임의로 바꾸지 않고, 정해진 원칙 안에서 구현하도록 제약

이 문서는 구현 코드가 아니라 **구조와 계약을 고정하는 설계 문서**다.

---

## 2. 프로젝트 개요

### 2-1. 게임 한 줄 설명
좌우 이동과 스페이스 입력만 사용하는 2D 알카노이드형 게임.

### 2-2. 프로젝트 목표
- 코어 플레이 루프가 명확한 작은 게임을 대상으로
- 프로덕트 레벨 아키텍처를 직접 설계하고
- TypeScript로 먼저 구현한 뒤
- 이후 Unity로 포팅 가능한 구조를 만드는 것

### 2-3. 기술 목표
- 게임 규칙과 표현 분리
- 상태 전이 명시화
- Definition 데이터와 Runtime 상태 분리
- 리소스 의미 ID와 실제 에셋 참조 분리
- 로컬 저장 구조 분리
- 단계적 기능 확장 가능 구조 확보

### 2-4. 비기능 목표
- 책임 경계가 선명할 것
- 확장 시 기존 계층의 의미가 무너지지 않을 것
- MVP 단위로 구현 범위를 통제할 수 있을 것
- Claude Code에 문서 기반 구현 지시가 가능할 것

---

## 3. 제품 범위와 단계적 구현 전략

전체 제품은 처음부터 한 번에 구현하지 않는다.  
전체 구조는 먼저 설계하되, 구현은 단계적으로 진행한다.

### MVP 1
코어 플레이와 상위 아키텍처 뼈대를 검증하는 단계

포함:
- Title
- RoundIntro
- InGame
- GameOver
- Stage 1
- 확장 아이템 1종
- 로컬 최고 점수 저장

제외:
- IntroStory
- GameClear
- Stage 2, 3
- 자석
- 레이저
- 회전체
- 로그인/구글/닉네임/랭킹

### MVP 2
제품 흐름을 확장하는 단계

포함 후보:
- IntroStory
- GameClear
- Stage 2, 3
- 결과 화면 정교화

### MVP 3
예외와 복잡도가 높은 시스템 확장 단계

포함 후보:
- 자석
- 레이저
- 효과 교체 정책 전체
- 회전체
- 충돌 정책 확장
- RuntimeState 확장

원칙은 다음과 같다.

- **풀 아키텍처는 먼저 설계**
- **구현은 MVP 단위로 단계적 진행**
- **MVP 검증 후 구조를 보정하고 다음 단계로 넘어감**

---

## 4. 핵심 게임 규칙 요약

### 4-1. 기본 플레이 루프
- 플레이어는 바를 좌우로 이동시킨다.
- 공은 벽, 바, 블록에 반사된다.
- 블록을 전부 파괴하면 스테이지를 클리어한다.
- 공을 놓치면 라이프가 감소한다.
- 라이프가 0이 되면 게임오버다.

### 4-2. 입력
- 좌우 이동: 바 이동
- 스페이스:
  - Title에서는 시작
  - RoundIntro에서는 사용하지 않음
  - InGame에서는 발사/효과 행동
  - GameOver에서는 재시작

### 4-3. 블록 규칙
- 블록은 `maxHits` 값만큼 피격되어야 파괴된다.
- 피격 시 블록 테두리 하이라이트를 재생한다.
- 파괴 시 별도 파괴 이펙트 없이 즉시 제거된다.
- 일부 블록은 아이템을 드랍한다.

### 4-4. 아이템 규칙
- 아이템은 화면에 동시에 1개만 존재한다.
- 아래로 수직 낙하한다.
- 바가 획득하면 즉시 효과를 적용한다.
- 바닥까지 떨어지면 사라진다.

### 4-5. 바 효과 규칙
전체 제품 기준 효과 종류:
- 확장
- 자석
- 레이저

정책:
- 동시에 1개만 유지
- 새 아이템 획득 시 기존 효과 제거 후 교체

MVP 1에서는 확장만 구현한다.

### 4-6. 사운드 규칙
- 타이틀 BGM 사용
- 인게임 루프 BGM 없음
- Round Start / GameOver / GameClear 징글 사용
- 핵심 SFX만 유지
- 벽 반사음 없음

### 4-7. 저장 규칙
- 최고 점수만 로컬 저장한다.
- 로그인/구글/닉네임/온라인 랭킹은 현재 범위에서 제외한다.

---

## 5. 아키텍처 설계 원칙

### 5-1. 상위 구조는 소유권 기준으로 분리한다
상위 책임 구조는 "무슨 행동을 하느냐"보다 "무엇을 소유하느냐" 기준으로 나눈다.

### 5-2. 하위 구조는 행동 기준으로 분리한다
상위 축 아래의 세부 모듈은 이동, 충돌, 저장, 타이핑 같은 행동 기준으로 쪼갠다.

### 5-3. 상태 / 정의 / 자산을 분리한다
- RuntimeState: 현재 변하는 값
- Definition: 고정 설계 데이터
- Asset: 실제 파일/리소스 참조

### 5-4. 게임 규칙과 표현을 분리한다
Gameplay는 규칙만 계산하고, Presentation은 표현만 담당한다.

### 5-5. 이벤트는 반응을 위한 최소 연결로 사용한다
이벤트는 계층 간 결합을 낮추는 수단으로 사용하되, 과도한 이벤트 남발은 피한다.

### 5-6. 지금 구현하지 않을 기능은 확장 포인트로만 남긴다
미래 기능을 위해 구조는 열어두되, 현재 MVP에 포함하지 않은 코드는 만들지 않는다.

---

## 6. 상위 책임 구조

전체 상위 구조는 8축으로 나눈다.

1. Input Acquisition
2. Flow State
3. Gameplay Simulation
4. Presentation
5. Audio Playback
6. Persistence
7. Game Definitions
8. Asset Resolution

---

## 7. 상위 책임 상세

### 7-1. Input Acquisition

#### 책임
- 키 입력 수집
- raw input 상태 제공

#### 금지 책임
- 입력 의미 해석
- 상태 전환 결정
- 인게임 규칙 계산

#### 소유 데이터
- 키 입력 스냅샷

#### 입력
- 플랫폼 입력

#### 출력
- `InputSnapshot`

---

### 7-2. Flow State

#### 책임
- 상위 게임 상태 소유
- 상태 전환 결정
- 비인게임 입력 의미 해석
- 상태 진입/종료 후처리
- 상태 진입 이벤트 발행

#### 금지 책임
- 인게임 물리 계산
- UI 직접 렌더링
- 사운드 직접 재생

#### 소유 데이터
- 현재 상위 상태
- 현재 스테이지 인덱스 등 상위 진행 맥락

#### 입력
- raw input에서 파생된 flow command
- Gameplay 결과 이벤트
- Presentation 완료 이벤트

#### 출력
- 새 상태
- Flow 이벤트

---

### 7-3. Gameplay Simulation

#### 책임
- 인게임 세계 상태 소유
- 인게임 입력 의미 해석
- 이동 / 충돌 / 규칙 계산
- 점수 / 라이프 / 클리어 판정
- Gameplay 이벤트 발행

#### 금지 책임
- 상위 상태 전환 실행
- 화면 표시
- 사운드 재생

#### 소유 데이터
- 바 / 공 / 블록 / 아이템 / 세션 상태

#### 입력
- `InputSnapshot`
- Definition 데이터
- 현재 Flow 상태가 InGame이라는 전제

#### 출력
- 갱신된 RuntimeState
- Gameplay 이벤트

---

### 7-4. Presentation

#### 책임
- 현재 상태와 결과를 화면으로 표현
- 화면별 표시 데이터 준비
- HUD 갱신
- 시간 기반 시각 연출 진행
- 렌더링

#### 금지 책임
- 게임 규칙 계산
- 상태 전환 결정
- 저장 처리

#### 소유 데이터
- 화면 표현 상태
- 연출 타이머/플래시 상태

#### 입력
- Flow 상태
- Gameplay RuntimeState
- 이벤트
- Definition 데이터
- Asset 참조

#### 출력
- 화면 렌더링 결과
- Presentation 완료 이벤트

---

### 7-5. Audio Playback

#### 책임
- 이벤트를 오디오 cue로 해석
- BGM / 징글 / SFX 재생

#### 금지 책임
- 상태 전환 판단
- 충돌 계산
- 이벤트 발생

#### 소유 데이터
- 현재 재생 중인 오디오 상태

#### 입력
- Flow / Gameplay / Presentation 이벤트
- AudioCue 정의
- Asset 참조

#### 출력
- 오디오 재생 실행

---

### 7-6. Persistence

#### 책임
- 최고 점수 로드/저장

#### 금지 책임
- 로그인
- 온라인 랭킹
- 점수 계산
- 화면 표시

#### 소유 데이터
- 저장 데이터

#### 입력
- 저장 시점 이벤트
- 세션 점수 정보

#### 출력
- 저장 데이터
- highScore 값

---

### 7-7. Game Definitions

#### 책임
- 고정 규칙/콘텐츠 정의 제공
- 테이블 데이터 관리

#### 금지 책임
- 런타임 상태 변경
- 파일 실제 로드
- 규칙 계산 실행

#### 소유 데이터
- Stage / Block / Item / Config / UI / AudioCue 테이블

#### 입력
- 없음 (고정 데이터)

#### 출력
- Definition 데이터

---

### 7-8. Asset Resolution

#### 책임
- 리소스 의미 ID를 실제 에셋 참조로 해석

#### 금지 책임
- 게임 규칙 계산
- 사용 맥락 결정
- 상태 전환

#### 소유 데이터
- resourceId ↔ 실제 리소스 참조 매핑

#### 입력
- resourceId

#### 출력
- 실제 에셋 참조

---

## 8. 상위 책임 간 관계

### 8-1. 허용 의존성
- `app`은 전부 조립 가능
- `flow`는 `shared`, `definitions` 참조 가능
- `gameplay`는 `shared`, `definitions` 참조 가능
- `presentation`은 `flow`, `gameplay`, `definitions`, `assets`, `shared` 참조 가능
- `audio`는 `definitions`, `assets`, `shared` 참조 가능
- `persistence`는 `shared` 참조 가능

### 8-2. 금지 의존성
- `gameplay` → `presentation` 직접 참조 금지
- `gameplay` → `audio` 직접 참조 금지
- `flow` → renderer 직접 참조 금지
- `definitions` → runtime state 참조 금지
- `assets` → gameplay/flow 참조 금지

### 8-3. 직접 참조와 이벤트 반응 구분
- 상태 전환과 인게임 결과는 이벤트로 연결한다.
- 렌더링은 상태를 읽는다.
- 사운드는 이벤트를 듣고 반응한다.

---

## 9. Flow State 상세 설계

### 9-1. 하위 구성
- `GameFlowState`
- `GameFlowController`
- `FlowInputResolver`
- `FlowTransitionPolicy`
- `FlowLifecycleHandler`

### 9-2. 각 구성의 역할

#### GameFlowState
현재 상위 상태를 저장한다.

#### GameFlowController
상태 전환 전체를 orchestration한다.

#### FlowInputResolver
비인게임 상태에서 입력을 흐름 명령으로 해석한다.

#### FlowTransitionPolicy
어떤 조건에서 어떤 상태로 갈지 결정한다.

#### FlowLifecycleHandler
상태 진입/종료 후처리를 담당한다.

### 9-3. 전체 제품 상태 목록
- Title
- IntroStory
- RoundIntro
- InGame
- GameOver
- GameClear

### 9-4. MVP 1 상태 목록
- Title
- RoundIntro
- InGame
- GameOver

---

## 10. Gameplay Simulation 상세 설계

### 10-1. 하위 구성
- `GameplayRuntimeState`
- `GameplayController`
- `InputCommandResolver`
- `MovementSystem`
- `CollisionService`
- `CollisionResolutionService`
- `StageRuleService`
- `StageRuntimeFactory`

### 10-2. 각 구성의 역할

#### GameplayRuntimeState
현재 인게임 세계 상태를 보관한다.

#### GameplayController
한 틱의 진행 순서를 조정한다.

#### InputCommandResolver
raw input을 인게임 명령으로 해석한다.

#### MovementSystem
바, 공, 아이템 등의 이동을 갱신한다.

#### CollisionService
충돌 사실과 물리 결과를 계산한다.

#### CollisionResolutionService
충돌 결과를 게임 규칙 결과로 반영한다.

#### StageRuleService
라이프, 클리어, 게임오버 조건을 판정한다.

#### StageRuntimeFactory
StageDefinition을 RuntimeState로 변환한다.

---

## 11. Presentation 상세 설계

### 11-1. 하위 구성
- `ScreenState`
- `ScreenDirector`
- `ScreenPresenter`
- `HUDPresenter`
- `VisualEffectController`
- `SceneRenderer`

### 11-2. 각 구성의 역할

#### ScreenState
현재 화면 표현 상태를 저장한다.

#### ScreenDirector
현재 어떤 화면이 활성화되어야 하는지 결정한다.

#### ScreenPresenter
화면별 표시용 ViewModel을 만든다.

#### HUDPresenter
인게임 HUD용 표시 데이터를 만든다.

#### VisualEffectController
타이핑, 피격 플래시, 배너 타이머 같은 시간 기반 표현을 담당한다.

#### SceneRenderer
최종 화면을 실제로 렌더링한다.

### 11-3. 화면과 연출 분리 원칙
- 정적 UI 표시와 시간 기반 연출은 Presentation 아래에서 분리한다.
- Flow는 상태만 소유하고, Intro 세부 진행도는 Presentation이 소유한다.

---

## 12. Audio / Persistence / Definitions / Asset 상세 설계

### 12-1. Audio Playback
구성:
- `AudioCueResolver`
- `AudioPlayer`

원칙:
- Audio는 이벤트를 듣고 재생만 한다.
- Audio가 상태 전환이나 규칙을 판단하지 않는다.

### 12-2. Persistence
구성:
- `SaveData`
- `ISaveRepository`
- `LocalSaveRepository`

원칙:
- 현재는 highScore만 저장한다.
- 인증/랭킹은 후속 확장이다.

### 12-3. Game Definitions
MVP 1 기준 테이블:
- `StageDefinitionTable`
- `BlockDefinitionTable`
- `ItemDefinitionTable`
- `GameplayConfigTable`
- `UITextTable`
- `AudioCueTable`

### 12-4. Asset Resolution
구성:
- `AssetCatalog`
- `AssetResolver`

원칙:
- Definitions는 `resourceId`만 가진다.
- 실제 파일 경로나 엔진 에셋 참조는 Asset Resolution만 안다.

---

## 13. 상태 전이 구조

### 13-1. MVP 1 상태 전이표

| 현재 상태 | 조건 / 입력 | 다음 상태 | 비고 |
|---|---|---|---|
| Title | StartGameRequested | RoundIntro | 스페이스 입력 |
| RoundIntro | RoundIntroFinished | InGame | 배너 연출 종료 |
| InGame | LifeLost + remainingLives > 0 | RoundIntro | 같은 스테이지 재시작 |
| InGame | GameOverConditionMet | GameOver | 라이프 0 |
| InGame | StageCleared | Title | MVP 1에서는 임시 클리어 처리 후 Title 복귀 |
| GameOver | RetryRequested | Title | 스페이스 입력 |

### 13-2. 상태 진입 후처리 원칙
- 상태 진입 사실은 `Entered...` 이벤트로 알린다.
- BGM/징글/화면 구성은 상태 진입 이벤트에 반응한다.

### 13-3. 연출 완료와 상태 전이 관계
- `RoundIntroFinished`는 Presentation이 발행하고 Flow가 수신한다.
- `LifeLostPresentationFinished`는 바 파괴 연출 종료 신호다.

---

## 14. Runtime State 설계

### 14-1. RuntimeState 정의
RuntimeState는 현재 게임 진행 중 계속 변하는 값들의 묶음이다.

### 14-2. GameSessionState
```ts
type GameSessionState = {
  currentStageIndex: number;
  score: number;
  lives: number;
  highScore: number;
};
14-3. GameplayRuntimeState
type GameplayRuntimeState = {
  session: GameSessionState;
  bar: BarState;
  balls: BallState[];
  blocks: BlockState[];
  itemDrops: ItemDropState[];
  isStageCleared: boolean;
};
14-4. BarState
type BarState = {
  x: number;
  y: number;
  width: number;
  moveSpeed: number;
  activeEffect: 'none' | 'expand';
};
14-5. BallState
type BallState = {
  id: string;
  x: number;
  y: number;
  vx: number;
  vy: number;
  isActive: boolean;
};
14-6. BlockState
type BlockState = {
  id: string;
  x: number;
  y: number;
  remainingHits: number;
  isDestroyed: boolean;
  definitionId: string;
};
14-7. ItemDropState
type ItemDropState = {
  id: string;
  itemType: 'expand';
  x: number;
  y: number;
  fallSpeed: number;
  isCollected: boolean;
};
14-8. ScreenState

Presentation 전용 상태는 GameplayRuntimeState와 별개다.

예:

type ScreenState = {
  currentScreen: 'title' | 'roundIntro' | 'inGame' | 'gameOver';
  roundIntroRemainingTime: number;
  blockHitFlashBlockIds: string[];
  isBarBreaking: boolean;
};
14-9. RuntimeState와 Definition 차이
Definition: 원래 정해진 값
RuntimeState: 지금 변하고 있는 값

예:

maxHits는 Definition
remainingHits는 RuntimeState
15. Definition 테이블 설계
15-1. StageDefinitionTable

역할:

스테이지 배치
시작 위치
시작 속도/각도
배경 지정

예시 스키마:

type StageDefinition = {
  stageId: string;
  displayName: string;
  backgroundId: string;
  barSpawnX: number;
  barSpawnY: number;
  ballSpawnX: number;
  ballSpawnY: number;
  ballInitialSpeed: number;
  ballInitialAngleDeg: number;
  blocks: StageBlockPlacement[];
};
15-2. BlockDefinitionTable

역할:

블록 기본 체력
점수
드랍 아이템
외형

예시 스키마:

type BlockDefinition = {
  definitionId: string;
  maxHits: number;
  score: number;
  dropItemType: 'none' | 'expand';
  visualId: string;
};
15-3. ItemDefinitionTable

역할:

아이템 효과 정의
표시용 텍스트/아이콘 참조

예시 스키마:

type ItemDefinition = {
  itemType: 'expand';
  displayNameTextId: string;
  descriptionTextId: string;
  iconId: string;
  fallSpeed: number;
  effectType: 'expand';
  expandMultiplier: number;
};
15-4. GameplayConfigTable

역할:

전역 수치 설정

예시 스키마:

type GameplayConfig = {
  initialLives: number;
  baseBarWidth: number;
  barMoveSpeed: number;
  roundIntroDurationMs: number;
  blockHitFlashDurationMs: number;
  barBreakDurationMs: number;
};
15-5. UITextTable

역할:

UI 문구 key-value 관리

예시 스키마:

type UITextEntry = {
  textId: string;
  value: string;
};
15-6. AudioCueTable

역할:

이벤트와 사운드 cue 연결

예시 스키마:

type AudioCueEntry = {
  cueId: string;
  eventType: string;
  resourceId: string;
  playbackType: 'bgm' | 'jingle' | 'sfx';
};
15-7. 테이블 참조 관계
Stage → BlockDefinition
BlockDefinition → ItemDefinition
ItemDefinition → UIText
AudioCue → AssetResolution
16. 이벤트 설계
16-1. 이벤트 사용 원칙
사건 이름만으로 충분하면 payload를 생략한다.
다른 계층이 반응하는 데 필요한 최소 정보만 payload에 넣는다.
이벤트는 발행자/구독자/발생 시점을 함께 정의한다.
16-2. Flow 이벤트
EnteredTitle
EnteredIntroStory
EnteredRoundIntro
EnteredInGame
EnteredGameOver
EnteredGameClear
16-3. Gameplay 이벤트
BallLaunched
BallAttached
BallsReleased
LaserFired
BlockHit
BlockDestroyed
ItemSpawned
ItemCollected
LifeLost
StageCleared
GameOverConditionMet
16-4. Presentation 이벤트
IntroSequenceFinished
RoundIntroFinished
LifeLostPresentationFinished
16-5. payload 원칙

예:

EnteredTitle: payload 없음
BlockHit: blockId, remainingHits
ItemCollected: itemType, replacedEffect, newEffect
16-6. 발행자/구독자 예시
StageCleared
발행자: StageRuleService
구독자: GameFlowController
BlockHit
발행자: CollisionResolutionService
구독자: AudioCueResolver, VisualEffectController
17. 시뮬레이션 틱 순서

Gameplay 틱은 Flow 상태가 InGame일 때만 수행한다.

순서:

인게임 입력 해석
즉시 적용 명령 처리
이동 갱신
충돌 감지
충돌 결과 반영
라이프 손실 판정
스테이지 클리어 / 게임오버 판정
RuntimeState 최종 반영
Gameplay 이벤트 발행

원칙:

감지와 반영을 분리한다.
이벤트는 확정된 결과를 기준으로 마지막에 발행한다.
18. 충돌 정책
18-1. MVP 1 충돌 대상
Ball ↔ Wall
Ball ↔ Bar
Ball ↔ Block
Ball ↔ Floor
ItemDrop ↔ Bar
ItemDrop ↔ Floor
18-2. 제외 충돌
Bar ↔ Block
Ball ↔ ItemDrop
ItemDrop ↔ Block
18-3. 특수 처리
Bar ↔ Wall은 충돌이 아니라 이동 제한(clamp)으로 처리한다.
18-4. 원칙
CollisionService는 충돌 사실만 계산한다.
CollisionResolutionService는 규칙 결과를 반영한다.
Floor는 반사 벽이 아니라 실패 판정 후보로 본다.
19. UI / 사운드 / 저장 정책
19-1. UI 정책

공통 UI:

HIGH SCORE
점수 표시
라이프 표시
라운드 표시

상태별 UI:

Title: 타이틀 로고, 시작 문구
RoundIntro: 라운드 배너
InGame: 플레이 화면 + HUD
GameOver: 최종 점수, 재도전 문구
19-2. 사운드 정책

사용:

타이틀 BGM
Round Start 징글
GameOver 징글
GameClear 징글
핵심 SFX

제외:

인게임 루프 BGM
벽 반사음
장식성 선택 이펙트 사운드
19-3. 저장 정책
highScore만 로컬 저장
저장 시점은 결과 상태 진입 시로 본다
로그인/랭킹/프로필은 후속 확장
20. 폴더 구조 원칙
20-1. 최상위 구조
app
input
flow
gameplay
presentation
audio
persistence
definitions
assets
shared
20-2. 하위 분리 기준
상위는 소유권 기준
하위는 행동 기준
20-3. shared 사용 원칙

shared는 공통 타입/유틸만 둔다.
잡다한 코드 저장소가 되면 안 된다.

20-4. Claude Code 사용 원칙
구조의 원칙은 사람이 먼저 고정한다.
에이전트는 디렉토리와 파일 스텁을 생성하게 한다.
gameplay가 presentation을 import하지 않도록 제약을 준다.
21. 테스트 전략
21-1. 테스트 목표
상태 전이가 문서대로 되는지
Gameplay 규칙이 문서대로 동작하는지
데이터 오입력을 초기에 잡는지
저장이 안정적인지
전체 흐름이 통합 시나리오에서 버티는지
21-2. 테스트 축
상태 전이 테스트
Gameplay 규칙 테스트
데이터/테이블 검증 테스트
저장 테스트
통합 시나리오 테스트
21-3. 우선순위

1순위:

Flow
Gameplay 핵심 규칙

2순위:

Definition 검증
Persistence

3순위:

통합 시나리오
22. 확장 포인트

현재 제외된 기능은 다음과 같다.

IntroStory
GameClear
Stage 2, 3
자석
레이저
회전체
로그인
구글 연동
닉네임
온라인 랭킹

확장 원칙:

현재 구조를 깨지 않고 해당 축을 확장한다.
예:
자석/레이저는 Gameplay와 ItemDefinition 확장
IntroStory는 Flow + Presentation 확장
로그인/랭킹은 Persistence/Auth/Profile 축 확장
23. 구현 단계 연결

이 문서는 전체 기준서다.
이후 문서는 이 문서를 잘라낸 구현 지시서다.

MVP1_구현.md: 코어 루프와 구조 검증 단계
MVP2_구현.md: 제품 흐름 확장 단계
MVP3_구현.md: 고복잡도 시스템 확장 단계

즉:

풀아키텍처.md = 전체 지도
MVP 문서들 = 실제 이동 경로
24. 부록
24-1. 용어 정리
RuntimeState: 현재 변하는 값
Definition: 고정 설계 데이터
Asset: 실제 파일/리소스
Flow: 상위 상태 전환
Gameplay: 인게임 규칙
Presentation: 화면 표현
24-2. 이벤트 요약표

Flow / Gameplay / Presentation 이벤트 목록은 별도 표로 관리 가능

24-3. 테이블 요약표

Definition 테이블 목록과 참조 관계 표는 별도 부록으로 유지 가능

24-4. 폴더 구조 요약표

최상위 폴더와 책임 요약은 별도 표로 유지 가능


## Unity 매핑 원칙

본 프로젝트는 TypeScript 선구현 후 Unity 포팅을 전제로 한다.  
따라서 아키텍처는 처음부터 **엔진 독립 로직과 Unity 엔진 연결부를 분리하는 방향**으로 유지한다.

### 1. 기본 원칙
Unity 구현에서 **MonoBehaviour는 엔진 이벤트 수신, 씬 오브젝트 참조, 렌더링 반영, 입력/오디오/저장 어댑터 역할만 맡는다.**  
게임 규칙 계산, 상태 전환 판단, 충돌 결과 처리 같은 핵심 로직은 가능한 한 **순수 C# 클래스 계층**에 둔다.

즉, MonoBehaviour는 게임 전체 로직의 본체가 아니라 **Adapter / Binder / Runner** 역할을 수행한다.

---

### 2. MonoBehaviour가 맡는 일
- Unity `Update` / `FixedUpdate` 수명주기 진입점 제공
- Input System 또는 키 입력 수집
- GameObject / Prefab / Scene 참조 보관
- SpriteRenderer / UI / AudioSource 반영
- 순수 로직 계층 호출
- 순수 로직 계층 결과를 Unity 오브젝트에 반영

---

### 3. MonoBehaviour가 맡지 않는 일
- 상위 상태 전환 규칙 판단
- 인게임 점수 계산
- 블록 체력 감소 규칙
- 아이템 효과 규칙 계산
- 클리어 / 게임오버 판정
- Definition 데이터 원본 수정

이런 로직은 `Flow`, `Gameplay`, `Definitions` 계층에 남긴다.

---

### 4. Unity 구현 시 계층 매핑 원칙

| 아키텍처 구성 | Unity 구현 형태 |
|---|---|
| `GameFlowController` | 순수 C# 클래스 |
| `FlowTransitionPolicy` | 순수 C# 클래스 |
| `GameplayController` | 순수 C# 클래스 |
| `MovementSystem` | 순수 C# 클래스 |
| `CollisionService` | 순수 C# 클래스 |
| `CollisionResolutionService` | 순수 C# 클래스 |
| `StageRuleService` | 순수 C# 클래스 |
| `KeyboardInputSource` | MonoBehaviour 또는 Input Adapter |
| `SceneRenderer` | MonoBehaviour + View/Binder 계층 |
| `AudioPlayer` | MonoBehaviour 또는 AudioSource Adapter |
| `LocalSaveRepository` | PlayerPrefs / File Adapter 구현체 |
| `Definition` 데이터 | ScriptableObject 또는 JSON 로드 계층 |
| `RuntimeState` | 순수 C# 상태 객체 |

---

### 5. 컴포지션 기반 설계 원칙
Unity 오브젝트는 상속 중심으로 비대하게 만들지 않고, **역할별 컴포넌트 조합**으로 구성한다.

예:
- `BallView`
- `BlockView`
- `BarView`
- `HudView`
- `ScreenViewRoot`
- `AudioBridge`
- `GameplayRunner`

중요한 원칙은, 이 컴포넌트들이 **게임 규칙을 직접 계산하지 않고**,  
순수 로직 계층의 상태와 결과를 **반영하거나 전달하는 역할**만 맡는다는 점이다.

---

### 6. Prefab / RuntimeState 분리 원칙
Prefab과 SceneObject는 **표현용 실체**이고,  
실제 게임 상태는 `RuntimeState`가 소유한다.

즉:
- Prefab = 보이는 것
- RuntimeState = 실제 현재 값
- Binder / Renderer = RuntimeState를 Prefab에 반영하는 계층

이 원칙을 지켜야 MonoBehaviour가 상태 저장소가 되는 것을 막을 수 있다.

---

### 7. Adapter / Binder 개념
Unity 포팅 시 다음 역할을 별도 개념으로 둔다.

- **Runner**: Unity 수명주기에서 순수 로직 계층을 호출
- **Adapter**: Unity 입력, 오디오, 저장 API를 순수 계층 인터페이스에 연결
- **Binder**: RuntimeState 결과를 SceneObject / UI에 반영
- **View**: 시각 오브젝트와 참조 보관

이 구조를 통해 도메인 로직은 Unity API에 직접 의존하지 않게 유지한다.

---

### 8. 최종 원칙
TypeScript 구현과 Unity 구현 모두에서 동일하게 유지해야 하는 핵심은 다음과 같다.

- 게임 규칙은 엔진 밖의 순수 로직 계층에 둔다.
- 엔진 계층은 입력, 렌더링, 오디오, 저장 연결만 담당한다.
- 상태는 RuntimeState가 소유하고, SceneObject는 이를 표현만 한다.
- MonoBehaviour는 얇게 유지하고, 비대한 GameManager로 키우지 않는다.

**본 프로젝트는 Unity 포팅 시에도 MonoBehaviour 중심 설계가 아니라, 순수 로직 계층 + MonoBehaviour 어댑터 계층의 컴포지션 구조를 유지하는 것을 원칙으로 한다.**