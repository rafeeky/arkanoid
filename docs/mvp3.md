# MVP3_구현.md

## 1. 문서 목적

본 문서는 `풀아키텍처.md`, `MVP1_구현.md`, `MVP2_구현.md`를 기준으로, **고복잡도 시스템과 예외 규칙을 확장하는 세 번째 구현 단계**를 정의한다.

MVP 3의 목적은 다음과 같다.

1. 자석 / 레이저 / 회전체 같은 **예외가 많은 시스템**을 구조적으로 추가
2. 단순 알카노이드에서 벗어나 **아이템 효과와 기믹이 결합된 제품 구조**를 검증
3. 기존 아키텍처가 복잡도 증가를 버티는지 확인

이 문서는 Claude Code에 **복잡도 높은 기능을 언제, 어디까지, 어떤 원칙으로 구현할지**를 고정하는 문서다.

---

## 2. MVP 3 목표

MVP 3의 목표는 **고복잡도 Gameplay 확장**이다.

이번 단계에서 반드시 증명해야 하는 것은 다음과 같다.

- 자석 효과가 기존 Flow / Gameplay / Presentation 구조를 깨지 않고 들어간다.
- 레이저 효과가 입력 해석과 쿨타임 구조 안에서 안정적으로 동작한다.
- 회전체가 충돌 정책 확장 안에서 처리된다.
- 효과 교체 정책이 실제로 버틴다.
- 이벤트, RuntimeState, Definition 테이블이 복잡한 규칙 추가를 감당한다.

즉, MVP 3는  
**“예외가 많아져도 구조가 무너지지 않는가”**를 검증하는 단계다.

---

## 3. 포함 범위

### 3-1. 아이템 / 효과
포함:
- 확장
- 자석
- 레이저

### 3-2. 효과 정책
포함:
- 바 효과는 동시에 1개만 유지
- 새 아이템 획득 시 기존 효과 제거 후 교체
- 자석 상태에서 공은 바에 부착 가능
- 자석 상태에서 스페이스 또는 시간 종료 시 공 발사
- 레이저 상태에서 스페이스 입력 시 레이저 2발 발사
- 레이저 쿨타임은 데이터 제어

### 3-3. 회전체 기믹
포함:
- 회전체 2종
- 정육면체형
- 삼각형형
- 회전체의 상태 기반 이동/회전
- 공 반사각 변화
- 블록 충돌 여부가 상태에 따라 달라지는 정책

### 3-4. 입력
확장:
- InGame 상태에서 스페이스 의미가 상황에 따라 달라짐
  - 일반 공 발사
  - 자석 공 해제
  - 레이저 발사

### 3-5. UI
추가:
- 현재 활성 바 효과 표시
- 필요 시 자석 / 레이저 효과 아이콘

### 3-6. 사운드
추가:
- `BallAttached`
- `BallsReleased`
- `LaserFired`

---

## 4. 제외 범위

### 4-1. 온라인 기능
제외:
- 로그인
- 구글 연동
- 닉네임 입력
- 온라인 랭킹

### 4-2. 네트워크 / 계정
제외:
- 계정 기반 저장
- 리더보드
- 클라우드 저장

---

## 5. MVP 3 완료 기준

다음이 모두 동작하면 MVP 3 완료로 본다.

- 자석 아이템 드랍 / 획득 / 적용 가능
- 자석 상태에서 공이 바에 붙음
- 자석 상태에서 스페이스 또는 시간 종료로 공 해제 가능
- 레이저 아이템 드랍 / 획득 / 적용 가능
- 레이저 상태에서 쿨타임 조건 하에 발사 가능
- 새 아이템 획득 시 기존 효과가 제거되고 새 효과로 교체됨
- 회전체가 배치되고, 공 반사에 영향을 줌
- 기존 Stage 진행, GameOver, GameClear 흐름이 깨지지 않음

---

## 6. 아키텍처 확장 범위

MVP 3에서 주로 확장되는 축은 다음과 같다.

- Gameplay Simulation
- Presentation
- Audio Playback
- Game Definitions

Flow의 상위 상태 구조는 크게 변하지 않지만,  
Gameplay 내부 규칙과 입력 해석, 이벤트, 충돌 정책이 크게 확장된다.

---

## 7. Gameplay 확장 범위

### 7-1. GameplayRuntimeState 확장
추가 후보:
- `activeEffect: 'none' | 'expand' | 'magnet' | 'laser'`
- `magnetRemainingTime`
- `attachedBallIds`
- `laserCooldownRemaining`
- `laserShots`
- `spinnerStates`

### 7-2. 하위 시스템 확장
기존 시스템 확장 또는 신규 서비스 추가 후보:
- `BarEffectService`
- `LaserSystem`
- `SpinnerSystem`

기존 구조는 유지하되, 복잡도가 커질 경우 아래를 고려한다.
- `MovementSystem` 분리
- `CollisionResolutionService` 하위 분리

---

## 8. Definition 데이터 확장 범위

### 8-1. ItemDefinitionTable 확장
추가 itemType:
- `magnet`
- `laser`

추가 필드 예:
- `magnetDurationMs`
- `laserCooldownMs`
- `laserShotCount`

### 8-2. StageDefinitionTable 확장
회전체 배치 데이터 추가 예:
- `spinners`

### 8-3. SpinnerDefinitionTable 추가
회전체 종류와 기본 성질 정의

예:
- `spinner_cube`
- `spinner_triangle`

### 8-4. UITextTable 확장
추가 키 예:
- `txt_item_magnet_name`
- `txt_item_magnet_desc`
- `txt_item_laser_name`
- `txt_item_laser_desc`

### 8-5. AudioCueTable 확장
추가 매핑:
- `BallAttached`
- `BallsReleased`
- `LaserFired`

---

## 9. 이벤트 확장 범위

### 9-1. 추가 Gameplay 이벤트
- `BallAttached`
- `BallsReleased`
- `LaserFired`

### 9-2. payload 원칙
추가 이벤트도 최소 payload 원칙 유지

예:
- `BallAttached`
  - `ballIds`
- `BallsReleased`
  - `ballIds`
  - `releaseReason: 'space' | 'timeout'`
- `LaserFired`
  - `shotCount`

### 9-3. 유지 원칙
- Gameplay는 여전히 상태 전환을 직접 수행하지 않음
- Flow는 여전히 상위 상태만 관리
- Presentation은 표현만 담당

---

## 10. 충돌 정책 확장 범위

### 10-1. 추가 충돌 대상
- Ball ↔ Spinner
- Laser ↔ Block
- Spinner ↔ Block (상태 의존)

### 10-2. 정책 원칙
- 충돌 감지와 결과 반영 분리 유지
- 회전체는 일반 블록이 아니라 별도 기믹으로 취급
- Floor 이탈은 여전히 실패 판정 후보로만 취급

### 10-3. 자석 / 레이저 예외 규칙
- Ball ↔ Bar 충돌 시 자석 상태면 반사가 아니라 부착 가능
- 레이저는 Block과 충돌하되 관통하지 않음

---

## 11. UI / Presentation 확장 범위

### 11-1. HUD 확장
추가 표시:
- 현재 활성 효과
- 필요 시 효과 아이콘

### 11-2. VisualEffectController 확장
추가 연출:
- 자석 부착 표현
- 레이저 발사 표현

### 11-3. SceneRenderer 확장
추가 렌더링 대상:
- 레이저 발사체
- 회전체
- 효과 아이콘

---

## 12. 구현 순서

### 1단계. Definition 확장
- `ItemDefinitionTable`에 magnet/laser 추가
- `StageDefinitionTable`에 spinner 배치 추가
- `SpinnerDefinitionTable` 작성
- `AudioCueTable` 확장

### 2단계. RuntimeState 확장
- magnet 관련 상태
- laser 관련 상태
- spinner 상태 추가

### 3단계. 입력 해석 확장
- `InputCommandResolver`에서 스페이스 의미 분기
  - 일반 발사
  - 자석 해제
  - 레이저 발사

### 4단계. 자석 구현
- 자석 획득
- 공 부착
- 스페이스/시간 종료 해제
- 관련 이벤트/사운드 연결

### 5단계. 레이저 구현
- 레이저 획득
- 쿨타임 관리
- 2발 발사
- 블록 충돌 반영

### 6단계. 효과 교체 정책 검증
- 기존 효과 제거
- 새 효과 적용
- HUD 갱신

### 7단계. 회전체 구현
- 회전체 상태
- 회전/이동
- 공 반사
- 상태 의존 충돌 정책 적용

---

## 13. 테스트 범위

### 13-1. 자석 테스트
- 자석 아이템 획득
- 공 부착
- 스페이스 해제
- 시간 종료 해제

### 13-2. 레이저 테스트
- 레이저 아이템 획득
- 쿨타임 동작
- 스페이스 발사
- Block 충돌 반영

### 13-3. 효과 교체 정책 테스트
- 확장 → 자석 교체
- 자석 → 레이저 교체
- 레이저 → 확장 교체

### 13-4. 회전체 테스트
- 회전체와 공 충돌
- 반사각 변화
- 상태에 따른 블록 충돌 여부 차이

### 13-5. 회귀 테스트
- MVP 1/2의 상태 전이 유지
- GameOver / GameClear 유지
- 최고 점수 저장 유지

---

## 14. Claude Code 구현 지시 원칙

### 14-1. 이번 단계에서 해야 하는 것
- 자석
- 레이저
- 효과 교체 정책
- 회전체
- 관련 이벤트/충돌/표현 확장

### 14-2. 이번 단계에서도 하지 말아야 하는 것
- 로그인 구현 금지
- 구글 연동 구현 금지
- 닉네임 입력 구현 금지
- 온라인 랭킹 구현 금지

### 14-3. 구조 원칙 유지
- gameplay가 presentation을 직접 제어하지 않음
- effect 로직이 flow를 직접 제어하지 않음
- 회전체는 별도 기믹 개념으로 유지
- Definition / Runtime / Asset 구분 유지

---

## 15. 성공 판정

MVP 3는 다음 질문에 모두 “예”라고 답할 수 있으면 성공이다.

- 자석과 레이저가 기존 구조를 깨지 않고 추가되었는가?
- 스페이스 입력이 상황에 따라 올바르게 해석되는가?
- 효과 교체 정책이 명확하게 동작하는가?
- 회전체가 충돌 정책 안에서 안정적으로 동작하는가?
- 기존 Stage 진행, GameOver, GameClear 흐름이 유지되는가?

---

## 16. 이후 확장 포인트

MVP 3 이후 남는 확장 포인트는 주로 서비스/계정 쪽이다.

- 로그인
- 구글 연동
- 닉네임 입력
- 온라인 랭킹
- 계정 기반 저장
- 리더보드
- 프로필 시스템

이 기능들은 현재 아키텍처의 `Persistence`를 확장하거나,  
별도 `Auth / Profile / Leaderboard` 축을 추가하는 방향으로 진행한다.

---

## 17. 한 줄 정의

**MVP 3는 자석, 레이저, 회전체처럼 예외와 복잡도가 높은 시스템을 기존 구조 위에 올려, 아키텍처가 복잡도 증가를 버티는지 검증하는 구현 단계다.**