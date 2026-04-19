# MVP2_구현.md

## 1. 문서 목적

본 문서는 `풀아키텍처.md`와 `MVP1_구현.md`를 기준으로, **MVP 1 검증 이후 제품 흐름을 확장하는 두 번째 구현 단계**를 정의한다.

MVP 2의 목적은 다음과 같다.

1. 코어 플레이가 검증된 구조 위에 **제품 흐름을 완성**
2. 단일 스테이지 게임이 아니라 **시작 → 인트로 → 다중 스테이지 → 클리어 결과**까지 이어지는 최소 완성형 경험 검증
3. 기존 Flow / Presentation / Definitions 구조가 **콘텐츠 볼륨 증가를 버티는지 확인**

이 문서는 Claude Code에 **MVP 2 범위만 정확히 구현하도록 지시하는 문서**다.

---

## 2. MVP 2 목표

MVP 2의 목표는 **제품 흐름 완성**이다.

이번 단계에서 반드시 증명해야 하는 것은 다음과 같다.

- IntroStory가 추가되어도 Flow와 Presentation의 경계가 유지된다.
- Stage 2, Stage 3이 추가되어도 StageDefinition 기반 구조가 유지된다.
- 마지막 스테이지 클리어 시 GameClear 화면으로 자연스럽게 이어진다.
- 결과 화면과 라운드 진행이 단일 스테이지가 아닌 다단계 플레이 흐름을 버틴다.

즉, MVP 2는  
**“게임이 한 판 돌아간다”를 넘어서 “제품 흐름이 완성된다”**를 검증하는 단계다.

---

## 3. 포함 범위

### 3-1. 게임 흐름
포함 상태:
- Title
- IntroStory
- RoundIntro
- InGame
- GameOver
- GameClear

포함 흐름:
- Title에서 시작
- IntroStory 진입
- Intro 종료 후 RoundIntro
- Stage 1 → Stage 2 → Stage 3 진행
- 마지막 Stage 클리어 시 GameClear
- GameOver / GameClear에서 Title 복귀

### 3-2. 플레이 규칙
MVP 1의 플레이 규칙을 유지한다.

추가되는 것은 규칙 자체보다 **여러 스테이지를 순차 진행하는 흐름**이다.

포함:
- Stage 진행 인덱스 증가
- StageCleared 이후 다음 스테이지 로드
- 마지막 StageCleared 이후 GameClear 전환

### 3-3. 콘텐츠
포함 콘텐츠:
- Stage 1
- Stage 2
- Stage 3
- IntroStory 텍스트 시퀀스
- GameClear 결과 화면

여전히 제외:
- 자석
- 레이저
- 회전체

### 3-4. UI
추가 UI:
- IntroStory 화면
- GameClear 화면
- Stage 2 / Stage 3 라운드 표시
- 결과 화면 정교화
  - 최종 점수
  - HIGH SCORE 반영
  - 재도전 문구

### 3-5. 사운드
추가 사운드:
- GameClear 징글

선택:
- IntroStory 전용 짧은 BGM 또는 무음
  - MVP 2에서는 무음 유지 가능

### 3-6. 저장
MVP 1과 동일:
- 최고 점수 로컬 저장 / 로드

---

## 4. 제외 범위

### 4-1. 아이템 / 효과
제외:
- 자석
- 레이저
- 다중 공
- 전체 효과 교체 정책 확장 검증

### 4-2. 기믹
제외:
- 회전체 전부

### 4-3. 확장 기능
제외:
- 로그인
- 구글 연동
- 닉네임 입력
- 온라인 랭킹

---

## 5. MVP 2 완료 기준

다음이 모두 동작하면 MVP 2 완료로 본다.

- Title에서 시작 가능
- IntroStory 진입 가능
- IntroStory 종료 후 RoundIntro 진입 가능
- Stage 1 클리어 후 Stage 2 진입 가능
- Stage 2 클리어 후 Stage 3 진입 가능
- Stage 3 클리어 후 GameClear 진입 가능
- GameOver / GameClear에서 Title 복귀 가능
- 최고 점수 저장/로드 유지
- 기존 MVP 1 플레이 규칙이 깨지지 않음

---

## 6. MVP 2 아키텍처 확장 범위

MVP 2에서 주요하게 확장되는 축은 다음과 같다.

- Flow State
- Presentation
- Game Definitions
- Audio Playback

Gameplay Simulation의 핵심 규칙은 거의 유지하되,  
Flow와 Stage 로딩, 결과 화면 분기 쪽이 확장된다.

---

## 7. 상태 전이 범위

### 7-1. MVP 2 상태 목록
- Title
- IntroStory
- RoundIntro
- InGame
- GameOver
- GameClear

### 7-2. MVP 2 상태 전이표

| 현재 상태 | 조건 / 입력 | 다음 상태 | 비고 |
|---|---|---|---|
| Title | `StartGameRequested` | IntroStory | 스페이스 입력 |
| IntroStory | `IntroSequenceFinished` | RoundIntro | 인트로 종료 |
| RoundIntro | `RoundIntroFinished` | InGame | 연출 종료 |
| InGame | `LifeLost` + `remainingLives > 0` | RoundIntro | 같은 스테이지 재시작 |
| InGame | `GameOverConditionMet` | GameOver | 라이프 0 |
| InGame | `StageCleared` + 마지막 스테이지 아님 | RoundIntro | 다음 스테이지 진입 |
| InGame | `StageCleared` + 마지막 스테이지임 | GameClear | 최종 클리어 |
| GameOver | `RetryRequested` | Title | 스페이스 입력 |
| GameClear | `RetryRequested` | Title | 스페이스 입력 |

---

## 8. 구현 대상 변경점

### 8-1. flow
추가/수정:
- `FlowTransitionPolicy.ts`
  - IntroStory 전이 추가
  - Stage 1/2/3 진행 분기 추가
  - GameClear 분기 추가
- `GameFlowState.ts`
  - currentStageIndex 관리 강화

### 8-2. presentation
추가/수정:
- `renderIntroStoryScreen.ts`
- `renderGameClearScreen.ts`
- `IntroScreenViewModel.ts`
- `GameClearViewModel.ts`
- `VisualEffectController.ts`
  - 인트로 시퀀스 진행
  - `IntroSequenceFinished`
- `ScreenDirector.ts`
  - IntroStory / GameClear 화면 활성화 처리

### 8-3. definitions
추가/수정:
- `StageDefinitionTable.ts`
  - stage_02, stage_03 추가
- `UITextTable.ts`
  - IntroStory 문구
  - GameClear 문구
  - `txt_round_02`
  - `txt_round_03`

### 8-4. audio
추가:
- `EnteredGameClear` → `jingle_gameclear` 매핑

---

## 9. MVP 2 RuntimeState 변경점

### 유지
- `GameplayRuntimeState` 구조는 MVP 1과 동일하게 유지 가능

### 보강
- `GameSessionState.currentStageIndex`가 실제 다중 스테이지 진행에 사용됨

### Presentation 확장
- `ScreenState`에 IntroStory 진행 상태 추가 가능

예:
- `introPageIndex`
- `introTypingProgress`
- `isIntroErasing`

단, 이 값은 GameplayRuntimeState가 아니라 ScreenState에 둔다.

---

## 10. MVP 2 Definition 데이터 범위

### 추가 테이블
- `IntroSequenceTable` 추가

### IntroSequenceTable 예시 역할
- Intro 페이지 목록
- 각 페이지 텍스트
- 타이핑 속도
- 지우기 속도
- 유지 시간

### StageDefinitionTable 확장
- stage_02
- stage_03

### UITextTable 확장
추가 키 예:
- `txt_intro_page_01`
- `txt_intro_page_02`
- `txt_intro_page_03`
- `txt_round_02`
- `txt_round_03`
- `txt_gameclear`

---

## 11. 이벤트 범위

### 11-1. 추가 Flow 이벤트
- `EnteredIntroStory`
- `EnteredGameClear`

### 11-2. 추가 Presentation 이벤트
- `IntroSequenceFinished`

### 11-3. 유지되는 핵심 원칙
- Gameplay는 여전히 `StageCleared`만 발행
- 마지막 스테이지 여부 판단은 Flow가 담당
- Presentation은 IntroStory의 세부 진행을 소유하지만, 상위 상태 전환은 하지 않음

---

## 12. 구현 순서

### 1단계. Definition 데이터 확장
- `StageDefinitionTable`에 stage_02, stage_03 추가
- `UITextTable` 확장
- `IntroSequenceTable` 추가

### 2단계. Flow 확장
- Title → IntroStory
- IntroStory → RoundIntro
- Stage 진행 분기
- GameClear 전이

### 3단계. IntroStory Presentation 구현
- Intro 화면 ViewModel
- Intro 타이핑/지우기 연출
- `IntroSequenceFinished`

### 4단계. 다중 Stage 로드 검증
- currentStageIndex 반영
- 각 Stage 데이터 로드

### 5단계. GameClear 화면 구현
- 최종 점수 표시
- 재도전 문구 표시
- 징글 연결

---

## 13. 테스트 범위

### 13-1. 상태 전이 테스트
- Title → IntroStory
- IntroStory → RoundIntro
- Stage 1 → Stage 2
- Stage 2 → Stage 3
- Stage 3 → GameClear
- GameClear → Title

### 13-2. Presentation 테스트
- IntroStory 타이핑 완료
- IntroStory 종료 이벤트 발생
- GameClear 화면 표시

### 13-3. 데이터 테스트
- Stage 1/2/3 참조 무결성
- IntroSequenceTable 필수 데이터 존재
- UIText 추가 키 누락 여부

### 13-4. 통합 시나리오 테스트
- 시작 → Intro → Stage 1 → Stage 2 → Stage 3 → GameClear
- 시작 → Intro → 플레이 도중 실패 → GameOver → Title

---

## 14. Claude Code 구현 지시 원칙

### 14-1. 이번 단계에서 해야 하는 것
- IntroStory 추가
- GameClear 추가
- Stage 2, 3 추가
- 결과 화면 확장

### 14-2. 이번 단계에서도 하지 말아야 하는 것
- 자석 구현 금지
- 레이저 구현 금지
- 회전체 구현 금지
- 로그인/구글/닉네임/랭킹 구현 금지

### 14-3. 아키텍처 원칙 유지
- IntroStory의 세부 진행은 Presentation에서 처리
- 최종 클리어 판단은 Flow에서 처리
- Gameplay는 여전히 코어 규칙만 담당

---

## 15. 성공 판정

MVP 2는 다음 질문에 모두 “예”라고 답할 수 있으면 성공이다.

- IntroStory가 제품 흐름에 자연스럽게 들어가는가?
- 3개 스테이지가 순차적으로 진행되는가?
- 마지막 스테이지 클리어 후 GameClear로 전환되는가?
- GameOver와 GameClear 모두 Title로 복귀 가능한가?
- 기존 MVP 1의 코어 플레이 규칙이 깨지지 않았는가?

---

## 16. 다음 단계 연결

MVP 2 검증 후 다음 단계는 `MVP3_구현.md`다.

다음 단계에서는 다음을 확장한다.

- 자석
- 레이저
- 효과 교체 정책 전체
- 회전체
- 복잡한 입력 해석
- 충돌 정책 확장

---

## 17. 한 줄 정의

**MVP 2는 IntroStory, 다중 스테이지, GameClear를 추가해 제품 흐름을 완성하는 구현 단계다.**