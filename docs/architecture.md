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

## 5. 아키텍처 패턴

### 5-1. 베이스 패턴: MVVM

본 프로젝트의 코어 코드 아키텍처는 **MVVM (Model-View-ViewModel)** 을 베이스로 한다.

선택 이유:
- 매 프레임 전체 상태를 다시 읽어 화면을 갱신하는 게임 루프는 MVVM 의 **단방향 pull 갱신**과 정확히 일치한다.
- ViewModel 은 불변 스냅샷이라 테스트가 쉽고, TS 렌더 함수와 Unity MonoBehaviour 뷰가 **동일한 ViewModel 소비 계약**을 공유해 포팅이 쉽다.
- 화면별로 ViewModel + Factory + View 세 파일만 독립적으로 확장되므로 Title / IntroStory / RoundIntro / InGame / GameOver / GameClear 6개 화면 추가/수정 비용이 선형.

역할 매핑:
- **Model**: 게임 규칙과 상태. `Flow` + `Gameplay` + `Definitions`.
- **ViewModel**: 특정 화면이 표시할 데이터 스냅샷. `Presentation/ViewModels/*` 의 불변 record 들.
- **View**: 화면에 그리는 최종 레이어. TS 의 `presentation/renderer/*`, Unity 의 `Presentation/View/*` MonoBehaviour.

MVVM 규칙:
- Model 은 View 와 ViewModel 의 존재를 모른다.
- ViewModel 은 View 의 존재를 모른다. ViewModel 은 Model 의 데이터로 구성되지만 Model 타입을 직접 노출하지 않도록 가능한 한 변환한다.
- View 는 ViewModel 만 소비한다. Model 을 직접 읽거나 수정하지 않는다.
- 데이터 흐름은 **Model → ViewModel → View** 단방향. 사용자 입력은 별도 경로(Command / Event)로 Model 에 전달된다.

### 5-2. 보조 패턴: FSM (상위 상태기계)

상위 게임 상태(Title / IntroStory / RoundIntro / InGame / GameOver / GameClear) 전환은 유한 상태 기계로 관리한다.
MVVM 과 **직교** 한다. FSM 이 현재 상태를 결정하면, 그 상태를 기반으로 ViewModel Factory 가 적절한 ViewModel 을 빌드한다.

구성: `GameFlowState` + `FlowTransitionPolicy` (pure) + `FlowInputResolver` (pure) + `GameFlowController` (state 보유).

### 5-3. 보조 패턴: Hexagonal / Ports & Adapters (엔진 경계)

엔진/플랫폼 의존 기능(입력 / 오디오 / 렌더링 / 영속성)은 **Port (인터페이스)** 와 **Adapter (구현체)** 로 분리한다.

MVVM 과 **직교** 한다. Adapter 는 View / Model 어느 쪽에도 직접 속하지 않는 경계 계층이다.

예시:
- `ISaveRepository` (Port) ← `LocalSaveRepository` (TS Adapter) / `PlayerPrefsRepository` (Unity Adapter) / `InMemorySaveRepository` (Test Adapter)
- `IAudioPlayer` (Port) ← `PhaserAudioPlayer` / `AudioPlayerAdapter` / `NoopAudioPlayer`
- Input / Renderer 도 동일 원칙

### 5-4. 패턴 조합 요약

```
┌─────────────────────────────────────────────────────┐
│            Hexagonal Adapter 경계                    │
│                                                      │
│   [Input Adapter] → InputSnapshot ──┐                │
│                                      ▼               │
│   ┌───────────────────────────────────┐              │
│   │  Model 계층 (MVVM Model)          │              │
│   │  ┌──────────────┐                 │              │
│   │  │ FSM (Flow)   │─────┐           │              │
│   │  └──────────────┘     │           │              │
│   │  ┌──────────────┐     │           │              │
│   │  │ Gameplay     │◀────┘ 이벤트   │              │
│   │  │ (RuntimeState│                │              │
│   │  │  + Systems)  │                 │              │
│   │  └──────────────┘                 │              │
│   │  ┌──────────────┐                 │              │
│   │  │ Definitions  │                 │              │
│   │  │ (Tables)     │                 │              │
│   │  └──────────────┘                 │              │
│   └────────────────┬──────────────────┘              │
│                    │                                 │
│   ┌────────────────▼──────────────────┐              │
│   │  ViewModel 계층 (MVVM ViewModel)  │              │
│   │  ViewModelFactory (pure)          │              │
│   │  ViewState (Presentation 전용)    │              │
│   └────────────────┬──────────────────┘              │
│                    │ 단방향 pull                     │
│   ┌────────────────▼──────────────────┐              │
│   │  View 계층 (MVVM View)            │              │
│   │  Renderer (TS) / View (Unity)     │              │
│   └───────────────────────────────────┘              │
│                                                      │
│   [Audio Adapter]  [Save Adapter]  [Render Adapter]  │
└─────────────────────────────────────────────────────┘
```

- **Model ⇄ Adapter**: Model 은 Port 인터페이스만 앎 (의존성 역전)
- **Model → ViewModel**: Factory 가 pure 변환
- **ViewModel → View**: 매 프레임 pull
- **View → Model**: ❌ 직접 참조 금지. 입력은 Adapter → Model 경로로만.

---

## 6. 아키텍처 설계 원칙

### 6-1. 상위 구조는 소유권 기준으로 분리한다
상위 책임 구조는 "무슨 행동을 하느냐"보다 "무엇을 소유하느냐" 기준으로 나눈다.

### 6-2. 하위 구조는 행동 기준으로 분리한다
상위 축 아래의 세부 모듈은 이동, 충돌, 저장, 타이핑 같은 행동 기준으로 쪼갠다.

### 6-3. 상태 / 정의 / 자산을 분리한다
- RuntimeState: 현재 변하는 값 (Model)
- Definition: 고정 설계 데이터 (Model 의 상수)
- Asset: 실제 파일/리소스 참조 (Adapter 경계)
- ViewState: 화면 표현 전용 상태 (ViewModel 계층에 속함)

### 6-4. 게임 규칙과 표현을 분리한다 (MVVM Model/View 경계)
Model 은 규칙만 계산하고, View 는 ViewModel 을 통해 받은 데이터를 표현만 담당한다.
Presentation 계층은 Model → ViewModel 변환(Factory) 과 ViewState 소유만 담당한다.

### 6-5. 이벤트는 Model 내부 반응 연결로만 사용한다
이벤트는 Flow / Gameplay / Adapter 간 결합을 낮추는 수단으로 사용한다.
**View 는 이벤트를 직접 구독하지 않는다** — 이벤트의 결과가 RuntimeState 또는 ViewState 에 반영된 뒤, ViewModel 을 거쳐 View 에 도달한다.
과도한 이벤트 남발은 피한다.

### 6-6. 지금 구현하지 않을 기능은 확장 포인트로만 남긴다
미래 기능을 위해 구조는 열어두되, 현재 MVP에 포함하지 않은 코드는 만들지 않는다.

---

## 7. 상위 책임 구조

전체 상위 구조는 8축으로 나눈다. 각 축을 MVVM 역할로 표시한다.

| # | 축 | MVVM 역할 | 엔진 의존 |
|:-:|---|---|:---:|
| 1 | Input Acquisition | **Adapter** (입력 Port 구현체) | ✅ |
| 2 | Flow State | **Model** (FSM, 순수 C#/TS) | ❌ |
| 3 | Gameplay Simulation | **Model** (RuntimeState + Systems) | ❌ |
| 4 | Presentation | **ViewModel 계층** (ViewModel + Factory + ViewState) + **View 계층** (Renderer) | 부분 |
| 5 | Audio Playback | **Adapter** (오디오 Port 구현체) | ✅ |
| 6 | Persistence | **Adapter** (저장 Port 구현체) | ✅ |
| 7 | Game Definitions | **Model** (불변 상수) | ❌ |
| 8 | Asset Resolution | **Adapter** (리소스 매핑) | ✅ |

Model 축 4개(Flow / Gameplay / Definitions / ViewState 일부) + View 축 1개(Renderer) + ViewModel 축 1개(Presentation Factory) + Adapter 축 4개(Input / Audio / Persistence / Asset) 로 조합된다.

---

## 8. 상위 책임 상세

### 8-1. Input Acquisition (Adapter)

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

### 8-2. Flow State (Model — FSM)

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

### 8-3. Gameplay Simulation (Model)

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

### 8-4. Presentation (ViewModel 계층 + View 계층)

Presentation 은 내부적으로 **ViewModel 계층** 과 **View 계층** 두 부분으로 다시 나뉜다.

#### 8-4-1. ViewModel 계층

##### 책임
- Model(Flow / Gameplay / Definitions) 을 화면 표시용 **불변 ViewModel** 로 변환
- 화면 표현 전용 상태 (ViewState) 소유
- 시간 기반 시각 연출 타이머 진행 (플래시, 바 파괴, Intro 타이핑)

##### 금지 책임
- 게임 규칙 계산
- 상태 전환 결정
- 저장 처리
- 실제 Unity/Phaser API 직접 호출

##### 소유 데이터
- `ScreenState` (ViewState)
- 연출 타이머 (VisualEffectService 내부)

##### 입력
- FlowState
- GameplayRuntimeState
- Gameplay / Flow 이벤트 (타이머 트리거용)
- Definition 데이터

##### 출력
- 각 화면의 `*ViewModel`
- Presentation 완료 이벤트 (`RoundIntroFinished`, `IntroSequenceFinished`, `LifeLostPresentationFinished`)

#### 8-4-2. View 계층

##### 책임
- ViewModel 을 받아 실제 화면에 그림
- TS: Phaser Scene/Sprite 조작
- Unity: MonoBehaviour 로 SceneObject / UI 갱신

##### 금지 책임
- Model 직접 참조 (FlowState, RuntimeState 읽기 금지 — ViewModel 경유)
- ViewModel 수정
- 게임 로직 계산

##### 입력
- ViewModel
- Asset 참조

##### 출력
- 실제 화면 렌더링 부수효과

---

### 8-5. Audio Playback (Adapter)

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

### 8-6. Persistence (Adapter)

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

### 8-7. Game Definitions (Model — 상수)

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

### 8-8. Asset Resolution (Adapter)

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

## 9. 상위 책임 간 관계 (MVVM 레이어 규칙)

### 9-1. 허용 의존성 (Model/ViewModel/View 계층 규칙)

**Model 계층**:
- `shared` → 없음 (leaf)
- `definitions` → `shared`
- `flow` → `shared`, `definitions`
- `gameplay` → `shared`, `definitions`

**ViewModel 계층**:
- `presentation/state` (ViewState) → `shared`, `gameplay` 타입 참조 최소화
- `presentation/view-models` → `shared`, `gameplay` 타입 (enum 수준)
- `presentation/controller` (Factory/Director/VisualEffectService) → `flow`, `gameplay`, `definitions`, `shared`

**View 계층**:
- `presentation/renderer` (TS) / `presentation/view` (Unity) → `presentation/view-models`, `presentation/state`, `definitions`, `assets`, `shared`
- ❗ **View 는 `flow`, `gameplay` 직접 참조 금지** — ViewModel 경유

**Adapter 계층**:
- `audio` → `definitions`, `assets`, `shared`
- `persistence` → `shared`
- `input` → `shared`
- `assets` → `shared`

**조립 계층**:
- `app` 은 전부 조립 가능 (Composition Root)

### 9-2. 금지 의존성 (계층 역참조 방지)
- `gameplay` → `presentation` 금지 (Model 이 View/VM 을 모름)
- `gameplay` → `audio` 금지 (Model 이 Adapter 를 모름)
- `flow` → `presentation/renderer` 금지
- `presentation/renderer` (View) → `flow`, `gameplay` 금지 (View 는 ViewModel 만 소비)
- `definitions` → `runtime state` 금지 (상수는 런타임 값 모름)
- `assets` → `gameplay`, `flow` 금지

### 9-3. 직접 참조 vs 이벤트 vs 바인딩 구분
세 가지 결합 수단을 명확히 나눈다.

| 방식 | 용도 | 예 |
|---|---|---|
| **직접 참조** | 같은 계층 내부 호출 / Composition Root 에서 의존성 주입 | `GameplayController` 가 `MovementSystem` 호출 |
| **이벤트** | Model 내부 계층 간(Flow↔Gameplay↔Adapter) 반응 연결 | `LifeLostEvent` → `FlowEventRouter` → `GameFlowController` + AudioAdapter |
| **단방향 바인딩 (pull)** | Model → ViewModel → View 의 매 프레임 갱신 | `BallView.Refresh(ballViewModel)` |

- 상태 전환과 인게임 결과는 **이벤트** 로 연결한다 (Model 내부).
- 렌더링은 **ViewModel 을 읽는다** (pull 바인딩).
- 사운드는 **이벤트를 듣고 반응한다** (Adapter).
- **View 는 이벤트 구독 금지** — 모든 시각 변화는 ViewModel 필드 변화로 드러나야 한다.

---

## 10. Flow State 상세 설계 (FSM — Model)

### 10-1. 하위 구성
- `GameFlowState`
- `GameFlowController`
- `FlowInputResolver`
- `FlowTransitionPolicy`
- `FlowLifecycleHandler`

### 10-2. 각 구성의 역할

#### GameFlowState
현재 상위 상태를 저장한다. 불변 값 타입.

#### GameFlowController (StateMachine Service)
상태 전환 전체를 orchestration 한다. 실질적인 **FSM 서비스**.

#### FlowInputResolver
비인게임 상태에서 입력을 흐름 명령으로 해석한다. **순수 함수**.

#### FlowTransitionPolicy
어떤 조건에서 어떤 상태로 갈지 결정한다. **순수 함수**.

#### FlowLifecycleHandler
상태 진입/종료 후처리를 담당한다. **순수 함수**.

### 10-3. 전체 제품 상태 목록
- Title
- IntroStory
- RoundIntro
- InGame
- GameOver
- GameClear

### 10-4. MVP 1 상태 목록
- Title
- RoundIntro
- InGame
- GameOver

---

## 11. Gameplay Simulation 상세 설계 (Model)

### 11-1. 하위 구성
- `GameplayRuntimeState`
- `GameplayController`
- `InputCommandResolver`
- `MovementSystem`
- `CollisionService`
- `CollisionResolutionService`
- `StageRuleService`
- `StageRuntimeFactory`

### 11-2. 각 구성의 역할

#### GameplayRuntimeState (Model 상태)
현재 인게임 세계 상태를 보관하는 불변 데이터 컨테이너.

#### GameplayController (Controller — 진짜 MVC 의미)
한 틱의 진행 순서를 조정한다. 시스템들을 순서대로 호출.

#### InputCommandResolver
raw input 을 인게임 명령으로 해석한다. **순수 함수**.

#### MovementSystem / CollisionService / CollisionResolutionService / StageRuleService
각각 이동 / 충돌 감지 / 충돌 반영 / 클리어 판정. 모두 **순수 함수(Service)**.

#### StageRuntimeFactory
StageDefinition 을 RuntimeState 로 변환한다. **순수 팩토리**.

---

## 12. Presentation 상세 설계 (ViewModel 계층 + View 계층)

### 12-1. 하위 구성

**ViewState (화면 표현 전용 상태)**
- `ScreenState` — 현재 화면 종류, RoundIntro 남은 시간, 플래시 목록, Intro 타이핑 진행도 등

**화면별 ViewModel (불변 스냅샷)**
- `TitleScreenViewModel` / `IntroScreenViewModel` / `RoundIntroViewModel` / `HudViewModel` / `GameOverViewModel` / `GameClearViewModel`

**InGame 엔티티별 ViewModel (불변 스냅샷)** — A안 채택 (2026-05-09)
- `BarViewModel` / `BallViewModel` / `BlockViewModel` / `ItemDropViewModel` / `LaserShotViewModel` / `SpinnerViewModel`
- 각각이 `*State` (Model) 의 표현용 변환 결과. View 는 이 VM 만 받고 `gameplay/state` 를 직접 import 하지 않는다.
- 표현 전용 derived 값(예: 색 보정, 페이드 비율, 플래시 여부)은 VM 안에서 결정.

**ViewModelFactory (순수 변환 함수)**
- `ScreenViewModelFactory` (구 `ScreenPresenter`) — 6개 화면별 ViewModel 빌드 메서드. **pure**.
- `HudViewModelFactory` (구 `HUDPresenter`) — HUD 전용 VM 빌더. **pure**.
- `InGameViewModelFactory` — InGame 엔티티별 VM 묶음 빌드. **pure**. (신규)

**Service (상태 보유)**
- `ScreenDirector` — ScreenState 소유. FlowState 변화에 따라 CurrentScreen 동기화 + 타이머 감소.
- `VisualEffectService` (기존 `VisualEffectController` 리네이밍 대상) — 플래시/바 파괴/Intro 타이핑 타이머 상태 소유.

**View**
- TS: `SceneRenderer` + `render*Screen` 함수들 (Phaser 직접 호출)
- Unity: `ScreenViewRoot` + 각 `*ScreenView` / `*View` / `*ViewPool` MonoBehaviour

### 12-2. 각 구성의 역할

#### ScreenState (ViewState)
현재 화면 표현 상태를 저장하는 **불변 record**. FlowState 와는 별개.

#### ScreenDirector (Service)
FlowState 의 Kind 변화를 감지해 ScreenState.CurrentScreen 을 동기화하고, RoundIntro 타이머 같은 시간 기반 상태를 매 틱 갱신한다.

#### ScreenViewModelFactory (구 ScreenPresenter) — pure
`GameSessionState` + `ScreenState` + DifficultyKind 등을 받아 각 화면용 ViewModel 을 반환한다. **상태 없음, 부수효과 없음, 테스트 쉬움**.

#### HudViewModelFactory (구 HUDPresenter) — pure
`GameplayRuntimeState` 전체를 받아 `HudViewModel` 을 만든다. 점수/라이프/라운드/효과 타이머를 매핑만.

#### InGameViewModelFactory — pure (신규, A안 채택)
`GameplayRuntimeState` + `ScreenState` (플래시 ID 등) 를 받아 InGame 엔티티별 VM 묶음을 반환한다. View 가 Model 을 import 하지 않게 하기 위한 핵심 경계.

#### VisualEffectService (Service)
타이핑, 피격 플래시, 배너 타이머, 바 파괴 연출 같은 **시간 기반 표현 상태**를 소유한다. ScreenDirector 가 매 틱 호출.

#### SceneRenderer / ScreenViewRoot (View)
화면 전환 coordinator. 현재 ScreenKind 에 맞는 하위 View 만 활성화. Renderer 는 ViewModel 을 받아 그릴 뿐 규칙 계산을 하지 않는다.

### 12-3. Presenter / Controller 명명 변경 결정 (2026-05-09 채택)

본 프로젝트의 `ScreenPresenter`, `HUDPresenter` 는 **MVP 의 Presenter 가 아니다**.
이들은 **MVVM 의 ViewModel Factory** 이며, 초기 구현 시 관례로 남았던 이름이다.
또한 `*Controller` 중 일부는 실체가 FSM 또는 Service 이므로 이름이 역할을 가린다.

**결정**: 다음 리네이밍을 채택한다. **Phase 1A (TS) 에서 일괄 적용. 현재 Unity 코드 (드래프트) 는 손대지 않으며, Phase 6 재포팅 시 새 이름으로 작성한다.**

| 현재 | 변경 후 (MVVM 정통 명명) | 이유 |
|---|---|---|
| `ScreenPresenter` | `ScreenViewModelFactory` | MVP 와 혼동 방지 |
| `HUDPresenter` | `HudViewModelFactory` | 동일 |
| `VisualEffectController` | `VisualEffectService` | 상태 보유 서비스 |
| `GameFlowController` | `FlowStateMachine` | 실체는 FSM |

부록 A 의 접미사 규칙 (`...Factory`, `...Service`, `...StateMachine`) 과 일관된다.

### 12-4. 화면과 연출 분리 원칙
- 정적 UI 표시(VM 의 필드 값) 와 시간 기반 연출(플래시/페이드/타이핑) 은 Presentation 내부에서 분리한다.
- Flow 는 "어느 화면인가" 만 소유하고, Intro 세부 진행도, 플래시 타이머 같은 것은 Presentation(ViewState) 가 소유한다.

---

## 13. Audio / Persistence / Definitions / Asset 상세 설계 (Adapter 계층)

### 13-1. Audio Playback (Adapter)
구성:
- `AudioCueResolver` — eventType → AudioCueEntry[] 조회. **순수.**
- `IAudioPlayer` (Port) — 오디오 재생 인터페이스
- `PhaserAudioPlayer` / `AudioPlayerAdapter` / `NoopAudioPlayer` (Adapter 구현체)

원칙:
- Audio 는 이벤트를 듣고 재생만 한다.
- Audio 가 상태 전환이나 규칙을 판단하지 않는다.

### 13-2. Persistence (Adapter)
구성:
- `SaveData` — 저장 데이터 shape
- `ISaveRepository` (Port)
- `LocalSaveRepository` / `PlayerPrefsRepository` / `InMemorySaveRepository` (Adapter 구현체)

원칙:
- 현재는 highScore 만 저장한다.
- 인증/랭킹은 후속 확장이다.

### 13-3. Game Definitions (Model — 상수)
MVP 1 기준 테이블:
- `StageDefinitionTable`
- `BlockDefinitionTable`
- `ItemDefinitionTable`
- `GameplayConfigTable`
- `UITextTable`
- `AudioCueTable`

Definitions 는 엄밀히는 Adapter 가 아니라 **Model 의 상수 부분**. 이 절에 배치한 이유는 "고정 데이터 / 외부 리소스 / 저장 / 오디오"를 외부 경계 관점에서 한데 묶기 위함.

### 13-4. Asset Resolution / 리소스 로딩 전략 (Adapter)

#### 13-4-1. 책임과 경계
- `IAssetCatalog` (Port): `resourceId` → 실제 에셋 핸들 해석. 엔진 무관 인터페이스.
- 구현체 (Adapter): TS 는 `PhaserAssetCatalog`, Unity 는 `ResourcesAssetCatalog` (확장 시 `AddressablesAssetCatalog`).
- Definitions 테이블은 `resourceId` 만 가진다. 실제 파일 경로 / 엔진 핸들은 Adapter 만 안다.
- AppContext 가 `IAssetCatalog` 1개를 생성해 필요한 곳 (AudioPlayer, View 등) 에 주입한다. 글로벌 정적 접근점 금지.

#### 13-4-2. 리소스 카테고리
- **Sprite**: 블록, 바, 공, 아이템, 스피너, 게이트, 레이저, UI 아이콘
- **Sprite atlas**: 화면 단위 묶음 (`atlas.title`, `atlas.ingame_world`, `atlas.hud`, `atlas.intro`)
- **Audio**: BGM (`bgm.title`), 징글 (`jingle.round_start`), SFX (`sfx.block_hit_1`)
- **Font**: UI 텍스트용 (TS 는 웹폰트, Unity 는 TMP_FontAsset)
- **Shader**: Unity 전용 (`Arkanoid/SpinnerUnlit` 등) — 카탈로그에 포함 + Always Included Shaders 등록

#### 13-4-3. 시맨틱 ID 명명 규약
- 형식: `<카테고리>.<용도>` (예: `block.basic`, `bgm.title`, `sfx.item_collect`)
- 카테고리 prefix: `block.`, `ball.`, `bar.`, `item.`, `spinner.`, `gate.`, `bgm.`, `jingle.`, `sfx.`, `ui.`, `atlas.`, `font.`, `shader.`
- 변형 표기: `_v2` 같은 임시 suffix 금지. 의미가 다른 자산은 새 ID 로 (`block.basic_cracked`).
- 다국어 텍스트 ID 는 `UITextTable` 이 별도 관리하므로 본 카탈로그에 포함 안 됨.

#### 13-4-4. 로딩 시점 정책
- **Phase 1 (현재): 모든 자산 Eager 로딩.** Bootstrap 시점에 카탈로그가 모두 로드된 상태로 진입한다. 게임 규모가 작아 Lazy 분리 효익 < 복잡도 비용.
- **확장 trigger**: 자산 총 크기가 모바일 메모리 부담을 만들거나, 스테이지별 배경이 다양해질 때 Lazy / Addressables 전환 검토.

#### 13-4-5. 에러 정책
- 자산 로드 실패: 1) 로그에 `resourceId` + 실제 경로 명시, 2) placeholder 자산 (분홍 사각형 / 무음 AudioClip) 으로 폴백, 3) 게임은 계속 진행.
- 시맨틱 ID 가 카탈로그에 없을 때: `IAssetCatalog.Resolve` 가 명시적 예외 (`AssetNotFoundException`) 발생. Adapter 가 catch 하여 폴백.
- Editor / Test 모드: 폴백 대신 즉시 fail 권장 (회귀 빠르게 잡기).

#### 13-4-6. TS 구현 (Phase 1A 범위)
- Phaser `TextureManager` / `SoundManager` 의 키를 `resourceId` 와 일치시킨다.
- Phaser preload 단계에서 모든 자산 등록.
- TS 는 placeholder 운용 (5-B 결정에 따라 최종 PNG 임포트 안 함). Phase 1A 에서 Port 와 placeholder adapter 만 정비한다.

#### 13-4-7. Unity 구현 (Phase 6 재포팅 시점)
- 기본: `Resources.Load<Sprite>("Sprites/" + resourceId.replace('.', '/'))` 패턴 (소규모 적합).
- 확장 trigger 시: Addressables 전환.
- `IAssetCatalog` 구현체는 Bootstrap 에서 1회 인스턴스화하여 AppContext 에 주입.
- 셰이더는 Always Included Shaders 등록을 카탈로그 어댑터가 책임지지 않음 — Project Settings 와 카탈로그가 일관되도록 빌드 시 검증한다.

---

## 14. 상태 전이 구조

### 14-1. MVP 1 상태 전이표

| 현재 상태 | 조건 / 입력 | 다음 상태 | 비고 |
|---|---|---|---|
| Title | StartGameRequested | RoundIntro | 스페이스 입력 |
| RoundIntro | RoundIntroFinished | InGame | 배너 연출 종료 |
| InGame | LifeLost + remainingLives > 0 | RoundIntro | 같은 스테이지 재시작 |
| InGame | GameOverConditionMet | GameOver | 라이프 0 |
| InGame | StageCleared | Title | MVP 1에서는 임시 클리어 처리 후 Title 복귀 |
| GameOver | RetryRequested | Title | 스페이스 입력 |

### 14-2. 상태 진입 후처리 원칙
- 상태 진입 사실은 `Entered...` 이벤트로 알린다.
- BGM/징글/화면 구성은 상태 진입 이벤트에 반응한다.

### 14-3. 연출 완료와 상태 전이 관계
- `RoundIntroFinished` 는 Presentation(ViewState) 이 발행하고 Flow 가 수신한다.
- `LifeLostPresentationFinished` 는 바 파괴 연출 종료 신호다.

---

## 부록 A. 명명 규칙 (Naming Convention)

MVVM + FSM + Hexagonal 조합에서 클래스 역할이 이름에 명확히 드러나도록 접미사 규칙을 둔다.

| 접미사 | 역할 | 상태 보유? | Pure? | 예 |
|---|---|:---:|:---:|---|
| `...Service` | 도메인 규칙/연출 실행 + 상태 소유 | ○ | ✕ | `VisualEffectService`, `FlowService` |
| `...Controller` | 매 틱 시스템 조합 + 오케스트레이션 | ○ | ✕ | `GameplayController` (한 틱의 진행 순서 조정) |
| `...StateMachine` | 명시적 FSM | ○ | ✕ | `FlowStateMachine` (현 `GameFlowController`) |
| `...Policy` | 조건→결과 결정 | ✕ | ○ | `FlowTransitionPolicy` |
| `...Resolver` | 입력/ID → 커맨드/데이터 변환 | ✕ | ○ | `FlowInputResolver`, `InputCommandResolver`, `AudioCueResolver` |
| `...Factory` / `...Builder` | 불변 객체 생성 (특히 ViewModel) | ✕ | ○ | `HudViewModelFactory`, `StageRuntimeFactory` |
| `...Handler` | 단일 동작 실행 | ✕ | ○ | `FlowLifecycleHandler`, `GameplayLifecycleHandler` |
| `...Router` | 이벤트 분기 + 부수효과 | △ | ✕ | `FlowEventRouter` |
| `...Director` | 시간 기반 진행 조정 (ScreenState 등 얇은 상태 소유) | ○ | ✕ | `ScreenDirector` |
| `...Repository` | 영속성 Port/Adapter | ○ | ✕ | `ISaveRepository` / `LocalSaveRepository` |
| `...Adapter` | 엔진 API 래핑 (MonoBehaviour / 브릿지) | △ | ✕ | `AudioPlayerAdapter`, `KeyboardTouchInputAdapter` |
| `...Injector` | 외부 입력 주입 | ○ | ✕ | `OnScreenInputInjector` |
| `...Relay` | 이벤트를 Injector 로 전달 | ✕ | ✕ | `OnScreenButtonRelay` |
| `...State` | 불변 데이터 상태 record | ○ (데이터) | ○ (값 타입) | `GameFlowState`, `GameplayRuntimeState`, `ScreenState` |
| `...ViewModel` | View 바인딩용 불변 스냅샷 | ○ (데이터) | ○ | `HudViewModel`, `TitleScreenViewModel` |
| `...View` / `...ViewPool` | 렌더링 전용 MonoBehaviour (Unity) | △ (참조) | ✕ | `BallView`, `BlockViewPool`, `ScreenViewRoot` |
| `...Renderer` | 렌더링 함수 (TS) | ✕ | ✕ (부수효과) | `SceneRenderer`, `renderInGameScreen` |

### 금지 접미사
- ❌ `...Manager` — Unity 에서 "신 오브젝트 싱글톤" 연상. 구체 역할로 대체 (Service / Director / Controller).
- ❌ `...Presenter` — MVP 의 Presenter 와 혼동. MVVM 에서는 `Factory` / `Builder` 로 표기. 현재 `ScreenPresenter`, `HUDPresenter` 는 순차 리네이밍 대상.
- ❌ `...Helper`, `...Util` — 역할이 불분명. 구체 역할로 쪼개거나 `shared/` 에 pure 함수로.
- ❌ 접미사 없이 명사만 (예: `GameFlow`) — 상태 덩어리인지 서비스인지 구분 불가. 반드시 접미사로 역할 명시.

### 판단 기준 (decision tree)
```
상태 소유?
├─ ○ (mutable) → Service / Controller / Director / StateMachine / Router
│     └─ 시간 기반 tick 중심 → Director / Controller
│     └─ FSM → StateMachine
│     └─ 이벤트 분기 → Router
│     └─ 도메인 로직 실행 → Service
└─ ✕ (pure)
      ├─ 데이터 생성 → Factory / Builder
      ├─ 조건→결과 결정 → Policy / Resolver
      └─ 단발 실행 → Handler

엔진 API 사용?
├─ ○ → Adapter / View / Renderer / Injector / Relay
└─ ✕ → (위 규칙)
```

---

## 15. Runtime State 설계 (Model 의 가변 부분)

### 15-1. RuntimeState 정의
RuntimeState 는 현재 게임 진행 중 계속 변하는 값들의 묶음이다.
**MVVM 의 Model 에 해당하며**, ViewState 는 별개로 취급한다.

### 15-2. GameSessionState
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

### 4. Unity 구현 시 계층 매핑 원칙 (MVVM 관점)

| 아키텍처 구성 | MVVM 계층 | Unity 구현 형태 |
|---|---|---|
| `GameFlowState` | Model (State) | 불변 C# record |
| `GameFlowController` / `FlowStateMachine` | Model (Service) | 순수 C# 클래스 |
| `FlowTransitionPolicy` / `FlowInputResolver` | Model (Policy/Resolver) | 순수 C# 정적 함수 |
| `GameplayRuntimeState` | Model (State) | 불변 C# record |
| `GameplayController` | Model (Controller) | 순수 C# 클래스 |
| `MovementSystem` / `CollisionService` / `StageRuleService` | Model (Service) | 순수 C# 정적 함수 |
| `ScreenState` | ViewState | 불변 C# record |
| `ScreenDirector` | ViewModel 계층 (Service) | 순수 C# 클래스 |
| `VisualEffectService` (구 `VisualEffectController`) | ViewModel 계층 (Service) | 순수 C# 클래스 |
| `HudViewModel` / `TitleScreenViewModel` 등 6개 | ViewModel | 불변 C# record |
| `HudViewModelFactory` / `ScreenViewModelFactory` (구 `HUDPresenter` / `ScreenPresenter`) | ViewModel 계층 (Factory) | 순수 C# 정적 함수 |
| `ScreenViewRoot`, `InGameView`, `BallView`, `BarView`, `BlockViewPool` 등 | View | MonoBehaviour |
| `KeyboardTouchInputAdapter` / `OnScreenInputInjector` | Adapter (Input Port) | MonoBehaviour |
| `AudioPlayerAdapter` | Adapter (Audio Port) | MonoBehaviour |
| `ISaveRepository` / `PlayerPrefsRepository` | Adapter (Persistence Port) | MonoBehaviour 불필요 (pure 클래스) |
| `Definition` 테이블 | Model (상수) | `static readonly` 정적 클래스 (또는 ScriptableObject 마이그레이션) |
| `AppContext` | Composition Root | 순수 C# (인스턴스 1개) |
| `GameBootstrap` | Runner | MonoBehaviour (진입점) |

---

### 5. 컴포지션 기반 설계 원칙 (View 계층)
Unity MonoBehaviour 는 상속 중심으로 비대하게 만들지 않고, **역할별 컴포넌트 조합**으로 구성한다.

예 (View 계층):
- `ScreenViewRoot` — 화면 전환 coordinator
- `InGameView` — InGame 하위 View 를 묶는 composite
- `BallView` / `BarView` / `HudView`
- `BlockViewPool` / `ItemDropViewPool` / `SpinnerViewPool` / `GateViewPool` / `LaserShotViewPool` — 오브젝트 풀 관리
- 각 `*ScreenView` (Title/IntroStory/RoundIntro/GameOver/GameClear)

이 컴포넌트들은 **ViewModel 만 받아 그린다** — 게임 규칙을 직접 계산하지 않고, Model/ViewModel 의 값을 SpriteRenderer / Text / Transform 에 반영만 한다.

싱글톤 금지, "Manager" 명명 금지. 인스턴스는 `GameBootstrap` 이 Composition Root 로 조립하고 씬에 배치한다.

---

### 6. Prefab / RuntimeState 분리 원칙
Prefab 과 SceneObject 는 **표현용 실체(View)** 이고,  
실제 게임 상태는 `RuntimeState` 가 소유한다 (Model).

즉:
- Prefab = 보이는 것 (View 재료)
- RuntimeState = 실제 현재 값 (Model)
- ViewModel = 한 프레임의 화면용 스냅샷 (Model → View 중간 계약)
- View MonoBehaviour = ViewModel 을 받아 Prefab/SceneObject 에 반영

이 원칙을 지켜야 MonoBehaviour 가 상태 저장소가 되는 것을 막을 수 있다.
MonoBehaviour 에는 **프레임별 렌더링 상태 캐시** (예: 오브젝트 풀 Dictionary) 만 보유하고, **게임 규칙 상태는 절대 보유하지 않는다**.

---

### 7. Adapter / Runner / View 개념

| 역할 | 설명 | MVVM 위치 |
|---|---|---|
| **Runner** | Unity 수명주기(Update)에서 순수 로직 계층의 Tick 을 호출 | Composition Root (App) |
| **Adapter** | Unity 입력, 오디오, 저장 API 를 Port 인터페이스에 연결 | Hexagonal 경계 |
| **View** | ViewModel 을 SceneObject / UGUI 에 반영 | View 계층 |
| **Injector / Relay** | 온스크린 버튼 같은 엔진 이벤트를 Port 로 주입 | Adapter 의 보조 |

"Binder" 라는 용어는 본 문서에서 쓰지 않는다 — MVVM 에서 View 가 ViewModel 을 매 프레임 pull 하는 방식이 곧 Binder 역할이므로, 별도 개념으로 분리하지 않는다.

---

### 8. 최종 원칙

TypeScript 구현과 Unity 구현 모두에서 동일하게 유지해야 하는 핵심:

- 게임 규칙은 엔진 밖의 **Model 계층** (순수 로직) 에 둔다.
- **ViewModel 계층** 은 Model 을 받아 화면용 불변 스냅샷으로 변환한다.
- 엔진 계층(**View + Adapter**) 은 입력, 렌더링, 오디오, 저장 연결만 담당한다.
- 상태는 RuntimeState (Model) 와 ViewState (ViewModel 측) 가 소유하고, SceneObject 는 이를 표현만 한다.
- MonoBehaviour 는 얇게 유지하고, 비대한 `GameManager` / 싱글톤으로 키우지 않는다.
- 단일 조립 지점(`AppContext` / `createAppContext`) 에서만 의존성 주입을 한다.

**본 프로젝트는 MVVM + FSM + Hexagonal 의 조합 구조를 TS 와 Unity 양쪽에서 동일하게 유지한다. 엔진 포팅 시 변경되는 것은 오직 View 계층과 Adapter 계층뿐이다.**

---

### 9. 싱글톤 / 매니저 금지 규칙의 적용 조건과 재검토 trigger

§8 의 "비대한 `GameManager` / 싱글톤으로 키우지 않는다" 는 절대 금기가 아니라 **현 프로젝트의 적용 전제 하에서의 결론**이다. 후일 전제가 깨지면 규칙도 재검토 대상이다.

#### 적용 전제 (현재)
- 단일 씬 구성
- 의존성 그래프 깊이 ≤ 3 (`GameBootstrap → AppContext → 서비스 → 뷰` 정도)
- 외부 플러그인 / 모드 시스템 없음
- 동적 프리팹 로드 없음

#### 재검토 trigger (이 중 하나라도 발생 시)
- 씬이 2개 이상으로 늘어남 (예: 부트 씬 + 게임 씬, 메뉴 씬 + 게임 씬)
- 동적 로드된 프리팹이 서비스 주입을 필요로 하는데 SerializeField + Bootstrap 와이어링이 한계
- 외부 플러그인 / 모드 시스템 도입
- 의존성 그래프 깊이 4단계 초과

#### trigger 시 검토 옵션 (우선순위 순)
1. **구조 재정비** — 서비스 통합, 그래프 평탄화. 보통 첫 trigger 에선 이게 답.
2. **DI 컨테이너 도입** — VContainer 권장 (가벼움). Zenject 는 과함.
3. **경계가 명확한 ServiceLocator** — 마지막 수단. 도입 시 예외 주석으로 적용 범위와 도입 사유 명시 필수.

#### 금지 대상이 *아닌* 것 (혼동 방지)
- `static readonly` 데이터 테이블 (`BlockDefinitionTable` 등) — 컴파일타임 상수, 싱글톤 안티패턴 아님.
- 단일 Composition Root (`AppContext`) — 글로벌 정적 접근점이 없으므로 싱글톤 아님.
- Engine API 래퍼 (`Camera.main` 어댑터 등) — 엔진 자체가 싱글톤이라 불가피.

#### 왜 이 규칙이 적용되는가
- 매니저 / 싱글톤은 *글로벌 접근점*이 본질이고, 글로벌 접근점은 의존성을 숨겨 테스트와 유지보수를 어렵게 한다.
- 본 프로젝트는 위 적용 전제 하에서 생성자 주입만으로 충분하므로, 싱글톤 비용을 감수할 이유가 없다.
- 학습 목적상, 싱글톤이라는 *쉬운 도피처*를 막는 것이 의존성 그래프를 직시하는 훈련에 도움이 된다.