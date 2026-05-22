# progress.md

알카노이드 프로젝트 진척 현황. 최종 갱신 **2026-05-23**.

전체 흐름 요약: **TS 선구현 → Unity 포팅 → 기능 확장 + 모바일 대응 → 출시 전 TS 폴리싱 단계** 진행 중.
출시 목표: 1개월 내 Google Play. 현재는 TS-side 폴리싱 (해상도/HUD/Mascot/Pause/오디오/궤적 등) + 데이터 단일화 단계.

---

## 0-rec3. 2026-05-23 — Unity 포팅 전 ABC 점검 + dead asset cleanup

### 점검 결과
| # | 항목 | 결과 |
|---|---|---|
| A1 | gameplay/ Phaser 의존 | ✅ 0건 |
| A2 | 비결정 source (Math.random/Date.now/performance.now) | ✅ 0건 (주석만) |
| A3 | state 직렬화 (순수 데이터) | ✅ 10/10 type alias |
| B1 | 데이터 테이블 인벤토리 | ✅ 13개, Unity SO 1:1 매핑 가능 |
| B2 | 흩어진 magic hex | ✅ 0건, 모두 const 그룹 또는 시각 디테일 |
| C1 | scrollFactor 명시 | ✅ 13/13 의도 명확 |
| C2 | 화면별 정석 일관 | ✅ 50 호출, 위반 0 |

→ **도메인 코어 Unity-portable 한 이상적 상태.**

### B3 cleanup
- Dead PNG 4 제거: `slider_knob/track`, `spinner_cube/triangle` (코드 사용 0)
- `public/assets/sheets/*` 11 파일 제거 (sheet_blocks/borders/mascot 등 — 모두 dead)
- `process-assets.cjs` 의 sheet_backgrounds 추출 로직 제거 (사용자가 새 bg_gameover/clear 자산 직접 받음, 옛 추출 로직 재실행 시 새 자산 덮어쓸 위험)

## 0-rec2. 2026-05-23 추가 (인게임 시각·사운드 미세 조정)

| 항목 | 내용 |
|---|---|
| **borderBottom 위치 fix** | playfieldBg(900px) 끝에 맞춤 (y=903). borderTop 과 시각 대칭. 옛 (PLAYFIELD_HEIGHT 720+3) 은 playfieldBg 안에 끼어있어 어색했음 |
| **바 반사음 pitch** | `cue_ball_hit_bar` pitch 0.85 (둔탁) → **1.1**. 블록 (1.4~1.6) 보다는 낮음 |
| **바 디자인 — 분리 형태** | applyGlossyStyle('pill') → 직접 그리기. 구조: `[반원좌 (semicircle)] [흰띠 4px] [사각 (base)] [흰띠] [반원우]`. activeEffect 별 색 매핑 (none=회색+하늘 / expand=구리+금 / magnet=진파랑+파랑 / laser=진빨강+빨강) |

## 0-rec. 2026-05-20~22 추가 작업 (UI/시각 폴리싱 + 데이터 토큰화)

### 공용 UI 컴포넌트 통합

| 항목 | 내용 | 파일 |
|---|---|---|
| **공용 Button** | 5곳 흩어진 버튼 그리기 코드 → `createButton(style)` 한 곳. variant primary/danger/neutral, toggle, glow, fillColor 오버라이드, setDisabled. container 기반 (transform SSOT) | `src/presentation/ui/Button.ts` |
| **12개 버튼 통합** | HUD pause / GameOver/Clear retry+quit / Pause bgm+sfx+quit+resume / Title NORMAL+HARD+UNLOCK | (위 5 호출처) |
| **GlossyStyle 헬퍼** | 바/공 Graphics 직접 그리기. shape: pill/circle. baseColor/highlight/outline 토큰 주입. 자산 PNG 폐기 (bar/ball) | `src/presentation/ui/GlossyStyle.ts` |
| **Toast 컴포넌트** | "Not enough gold" 같은 짧은 알림. fade-in/hold/fade-out | `src/presentation/ui/Toast.ts` |

### 카메라 정석 (diegetic / non-diegetic)

- multi-camera 환경의 **카메라 컨벤션 표** 명문화 + 메모리 박음
- 화면별 정석: Title/GameOver/Clear = 전부 UI. 인게임/일시정지 = 혼합. RoundIntro = 혼합 (메시지만 UI).
- **GameOver/Clear/RoundIntro 정석 통일** — main 카메라 잔재 → UI 카메라로 일제 이전. canvas 좌표계 직접 재배치.
- **Phaser default `scrollFactor=1` 함정** 알리기 + `Container.setScrollFactor()` 가 자식 비전파 발견 + 명시 룰.

### 충돌 정확도

- **회전체 swept 콜리전** — `Spinner.handleBallCollision` 에 `prevBall?` 옵션. 선분-변 교차 검사로 터널링 fix. broad-phase 반경에 `travel` 더함. 단위 테스트 2개 추가.
- **테두리 빈틈 fix** — `BORDER_LENGTH 64 → 60` (720 약수). `BORDER_TOP_COLS / SIDE_ROWS 11 → 12`. 모든 stage JSON 의 placement 갯수 갱신.

### 공 파워 상태 + 라운드별 트레일

| 항목 | 내용 |
|---|---|
| BallState 신규 필드 | `blocksSincePaddle?: number`, `isPowered?: boolean` |
| 상태 로직 | 블록 destroy → counter +1. ≥2 시 isPowered=true. 바 충돌 (반사/자석 부착) 시 reset. 벽 튕김은 reset 안 함. spawn/respawn 시 명시 reset (StageRuntimeFactory, applyLaunchBall) |
| **단일 trail 컴포넌트** | `createBallTrail(scene, style)` + config 주입. 시간 기반 push (`pushIntervalMs` 18, 60fps 매 frame) + 정지 보호. 머리 또렷 → 꼬리 fade. depth -1 (공 뒤) |
| **TrailStyleTable SSOT** | golden_sun / blue_meteor / sunset 3 프리셋 (color/glow/segmentCount/headAlpha/segmentRadius/pushIntervalMs) |
| **라운드별 매핑** | `StageDefinition.trailStyle` 옵셔널 필드. stage1/2/3.json 에 각각 지정. GameplayRuntimeState.currentTrailStyle 로 전달. BallObjects 가 3 trail 미리 생성, 현재 stage 만 active |

### 파워업 데이터 토큰화 + 토스트 팝

| 항목 | 내용 |
|---|---|
| **PowerupTable SSOT** | expand/magnet/laser 각 `{color, iconKey, label}` 단일 정의. `colorToHex` helper | `src/definitions/tables/PowerupTable.ts` |
| **토스트 색 일관성** | 옛 노랑 #ffff66 고정 제거 → POWERUP_TABLE 참조. expand 주황 / magnet 파랑 / laser 빨강. 아이콘 + 라벨 가로 배열 |
| **토스트 팝 애니메이션** | 일정 위치 (canvas 가운데 + bar.y - 32). scale 0.5→1 + alpha 0→1 (100ms, Back.out) → hold 500ms → fade 300ms. 총 ~800ms |
| **HUD 잔량 카운터 토큰 경유** | 옛 인라인 hex → POWERUP_TABLE.color 참조 |

### 인게임 배경 + HUD 가독성

| 항목 | 내용 |
|---|---|
| **스테이지별 배경** | `bg_pixel_01/02/03` PNG (941×1672 RGB) — `SceneRenderer.BG_BY_STAGE` 테이블. inGame/roundIntro 시 `backgroundImage` 가 stageIndex 별 bg_pixel_0X. playfieldBg (검정) 가 가운데 덮어 플레이필드 유지 |
| **하단 시각 회색 띠** | HUD 의 `borderTop` 미러 → `borderBottom` 추가 (y = PLAYFIELD_HEIGHT + thickness/2). **충돌 X (시각만)** — 죽음 로직 무변경 |
| **HUD 텍스트 stroke** | 배경 라운드별 변동 → 고정 색 글씨 가독성 한쪽 무조건 묻힘. 모든 HUD/RoundIntro/Slider 텍스트에 검정 stroke (외곽선 thickness 2~6 폰트 비례). "자막 패턴" — 맥락 무관 가독성 |

### 자동 발사

| 항목 | 내용 |
|---|---|
| **`autoLaunchDelayMs` config** | 라운드 시작/사망 후 N ms 발사 안 하면 자동 launch. default 7000ms | `GameplayConfig.ts` / `GameplayConfigTable.ts` |
| Controller timer | `autoLaunchTimerMs` private 필드. tick 안에서 비활성 공만 있을 때 누적, 임계 도달 시 `applyLaunchBall`. 활성 공 있으면 reset |

### 자산 / 마스코트 / dev

| 항목 | 내용 |
|---|---|
| Story 풀스크린 배경 | OneDrive `story01~04.png` → 풀스크린 (1080×1920). 옛 세로 짧은 일러스트 폐기. IntroStory 도 UI 카메라 정석 통일 |
| GameOver/Clear 마스코트 | gameover_frame_1~4 (개별 RGBA PNG, 수동 timer 토글) + dance_sheet (1 spritesheet, Phaser anim). 각 화면 하단 *3마리 가로 배치* |
| Endscreen 배경 | bg_gameover/gameclear PNG 풀스크린 |
| **Dev overlay 토글** | URL 쿼리 `?dev-overlay=1` 일 때만 dev 시각화 (block ID, trail, 충돌 로그). 평소 dev 서버 깨끗 |
| **자산 cleanup** | dead PNG (bar_normal/expand/magnet/laser_tint, ball) + AssetLoader 키 제거 |

### 학습 누적

- 학습 로그 (Notion `📓 알바트로스 학습 로그`): "implicit coupling", "diegetic / non-diegetic", "Swept 콜리전 / 터널링"
- Voca 추가: `diegetic`, `non-diegetic`, `멘탈 모델`, `swept collision`, `tunneling`, `broad-phase / narrow-phase`
- 학습 원칙 메모리 갱신: 카메라 정석 표 + Phaser default 함정 + 인프라 변경 시 전수 재점검 룰 + 버튼 시각 규칙 (glow/cornerRadius)

---

## 0. 2026-05-09~10 추가 작업 (출시 폴리싱)

이 섹션은 *현재 세션 그룹*에서 추가된 항목만 정리. 이전 작업은 §1 이하 참조.

### 0-1. 캔버스 / 화면 구조

| 항목 | 변경 | 파일 |
|---|---|---|
| **캔버스 해상도** | 720×720 → **1080×1920 FHD baseline (16:9)**. 19.5:9 등은 letterbox | `src/presentation/renderer/canvasLayout.ts` (신규), `src/app/main.ts`, `index.html` |
| **Multi-camera + zoom 1.5x** | 메인 카메라 zoom 1.5 + centerOn(playfield 중심) → 720×720 플레이필드를 1080×1080 으로 시각 확대. UI 카메라 (zoom 1, scroll 0) 추가 | `src/presentation/renderer/GameScene.ts` |
| **화면 영역 분리** | Top HUD (y=0..420) / 플레이필드 (y=420..1500) / Bottom (y=1500..1920). HUD/Lives/Title/Pause 는 UI 카메라 (scrollFactor=0). 게임 월드만 메인 카메라 | `GameScene.classifyCameras()` 매 프레임 자동 분류 |
| **단일 배경색** | Phaser game `backgroundColor: '#0a0a0a'` + index.html `html, body { background: #0a0a0a }`. letterbox 도 동일색 | `src/app/main.ts`, `index.html` |

### 0-2. HUD 재배치 + 플레이필드 경계

- **SCORE** 좌상단, **HIGH SCORE** 중앙상단 (빨강), **ROUND** 우상단 — 라벨/값 2줄 (캔버스 절대 좌표, 폰트 36/52)
- **Lives** 좌하단, 바 모양 0.4x 작게 가로 나열
- **플레이필드 경계** (top/left/right) 회색 띠 6px
- 모두 `scrollFactor=0` — UI 카메라가 렌더, zoom 면제
- 파일: `src/presentation/renderer/renderInGameScreen.ts`

### 0-3. Title 화면 전면 재구성

- 로고 **"ALBATROSS"**
- 도트 캐릭터 영역 — **MASCOT 캐러셀** (5종, 화살표 클릭으로 cycle, 잠금/해제 표시)
- **POWERUPS 영역** — 3개 아이템 (Expand/Magnet/Laser) 가로 배치. 각각 회전하는 캡슐 아이콘 + 이름(2글자 영역 띄어쓰기) + 2줄 영문 설명
- **HIGH SCORE** + **GOLD** 표시
- **NORMAL / HARD** 난이도 커서 (←/→ 키)
- 파일: `src/presentation/renderer/renderTitleScreen.ts`

### 0-4. RoundIntro READY 연출

- 지속 시간 1500 → **2000ms**
- 바 깜빡 (4 cycle, alpha 1.0/0.35) + 공 부착 visible + InGame 뷰 같이 렌더
- 짧은 jingle (`jingle_round_start`) 재생 → InGame 진입 시 정지
- 파일: `GameplayConfigTable.ts`, `SceneRenderer.ts`, `FlowEventRouter.ts`, `IAudioPlayer.stop(cueId)`

### 0-5. 일시정지 메뉴 (ESC)

- ESC 토글 — InGame 동안만 작동
- 4 버튼: **배경음 / 효과음 토글 (가로 2개)** + **나가기 → Title** + **돌아가기 → Resume**
- Phaser `setInteractive` + `pointerdown` 마우스/터치 클릭. 키보드 fallback (ESC=Resume, Q=Quit) 유지
- 일시정지 중 게임 시뮬레이션 정지 (`appContext.tick` 스킵)
- 파일: `src/presentation/renderer/renderPauseOverlay.ts` (신규), `GameScene.ts`

### 0-6. 오디오 시스템 확장

| API | 설명 |
|---|---|
| `AudioCueEntry.volume?` | 0..1, 미지정 시 1 |
| `AudioCueEntry.playDurationMs?` | 지정 시 setTimeout 으로 강제 stop (긴 파일에서 짧은 음 cut) |
| `AudioCueEntry.pitch?` | Phaser sound rate (이미 있던 필드) |
| `IAudioPlayer.setBgmMuted(bool)` | BGM 음소거. true 시 현재 BGM 정지 |
| `IAudioPlayer.setSfxMuted(bool)` | SFX/jingle 음소거 |
| `IAudioPlayer.stop(cueId)` | 특정 cue 강제 정지 (RoundIntro jingle 끊기) |

신규/수정 cue:
- `cue_ball_launch` (BallLaunched, pitch 1.0)
- `cue_ball_hit_bar` (BallHitBar, pitch 0.85, **playDurationMs 60ms** — "삡" 1음절 cut)
- `cue_item_bar_extend / laser / magnet` (ItemCollected_*)
- `cue_block_hit` pitch 1.35 → **1.6**, `cue_block_destroyed` pitch 1.15 → **1.4**

신규 BGM 파일: `public/assets/sfx/bgm_title.mp3` (Bensound funkyelement, 2.6MB MP3, 20% 볼륨). **출시 시 attribution 필수** — 또는 CC0 트랙으로 교체.

Title BGM 초기 발동 fix: Flow 가 처음부터 Title 로 생성되어 EnteredTitle 이벤트가 안 나옴 → `main.ts` 의 `GameSceneBootstrap.create()` 에서 직접 트리거.

### 0-7. Mascot 시스템 (data-driven)

| 항목 | 내용 |
|---|---|
| 캐릭터 5종 | albatross(0G) / kongming(100G) / snowrabbit(300G) / reaper(600G) / seraphin(1000G) |
| Title 캐러셀 | ←/→ 클릭 화살표로 cycle, 잠금 상태 표시 (UNLOCKED 초록 / LOCKED—N GOLD 빨강), UNLOCK 버튼 |
| Cursor 자동 선택 | 잠금 해제된 캐릭터에 cursor 가 가면 자동 selectMascot |
| InGame 응원 | 캔버스 우하단 `(920, 1750)` 110×110 placeholder. 4프레임 댄스 (250ms 간격, 회전 ±6° + 스케일 1.0/1.05) |
| Gold 적립 | EnteredGameOver/Clear 시 `addGoldFromScore(score)` (1:1, 추후 튜닝 가능) |
| 영속 | SaveData 에 `gold`, `unlockedMascots`, `selectedMascot` 추가. LocalSaveRepository load 에 마이그레이션 |

신규 파일:
- `src/definitions/types/MascotDefinition.ts`
- `src/definitions/tables/MascotTable.ts` — 한 줄 추가로 캐릭터 추가 가능
- AppContext API: `getGold/getUnlockedMascots/getSelectedMascot/selectMascot/tryUnlockMascot`

### 0-8. 난이도 NORMAL / HARD

- **NORMAL**: Lives 5, 스피너 OFF
- **HARD**: Lives 3, 스피너 ON
- Title 화면 ←/→ 키로 커서 이동 (기존)
- `selectedDifficulty` 가 FlowState 에 추가, FlowEventRouter 가 stage 초기화 시 적용

신규 파일:
- `src/definitions/types/DifficultyKind.ts` / `DifficultyConfig.ts`
- `src/definitions/tables/DifficultyConfigTable.ts`

### 0-9. 입력 확장

`InputSnapshot` 에 추가:
- `qJustPressed` (Q → 타이틀 복귀)
- `escJustPressed` (ESC → Pause)
- `leftJustPressed` / `rightJustPressed` (난이도 커서 edge)
- `targetBarX?` (마우스/터치 드래그 — 미사용 자리)

`KeyboardInputSource` 에 Q, ESC 키 등록 + edge 추적.

### 0-10. Q → Title 전이 (모든 비-Title 상태에서)

- `ReturnToTitleRequestedCommand` 추가
- `FlowTransitionPolicy`: IntroStory/RoundIntro/InGame/GameOver/GameClear → Title
- `FlowEventRouter.routeFlowAudio`: EnteredTitle 의 from 이 새 상태들이어도 UiConfirm + Title BGM 트리거

### 0-11. 공 발사 궤적

- `ball.isActive=false` 상태 (발사 전 또는 자석 부착) 동안 18개 cyan 점으로 궤적 표시
- 시뮬레이션: `ballInitialAngleDeg=-60`, `ballInitialSpeed=588`, 좌/우 벽 반사, 천장 도달 시 종료. alpha 페이드 (가까운 점 진하게)
- 파일: `renderInGameScreen.ts` 의 `renderBallTrajectory()`

### 0-12. 공 spawn 30px 우측 (`INITIAL_LAUNCH_OFFSET_X`)

- 발사 각도 -60° (cos=0.5, 우측) 와 시각 일치하도록 비활성 공이 바 중심에서 우측 30px 에 위치
- 적용: `StageRuntimeFactory.ts` 초기 spawn, `GameplayLifecycleHandler.resetForRetry`, `MovementSystem.moveAttachedBallToBar`

### 0-13. 아이템 캡슐 모양 + 회전 낙하

- Container = body(stroked Rectangle 64×24) + 첫 글자(노란색 + 검은 그림자)
- 낙하 시 `container.angle = (item.y * 2) % 360` 회전 (구르는 효과)
- 타입별 색상: Expand 노랑 / Magnet 파랑 / Laser 빨강
- 파일: `renderInGameScreen.ts`

### 0-14. GameOver 텍스트 분리

- 기존 highScoreText (y=360) 와 retryText (y=360) 가 *동일 위치 겹침* 버그 수정
- retryText 를 y=490 으로 분리 (highScore=360 → newHighScore?=410 → retry=490)
- 파일: `renderGameOverScreen.ts`

### 0-15. IntroStory 이미지 placeholder

- 텍스트 (y=200) 아래 480×220 흰 사각형 placeholder + "STORY IMAGE" 라벨 (y=530)
- Unity 포팅 시 페이지별 일러스트로 교체
- 파일: `renderIntroStoryScreen.ts`

### 0-16. DevOverlay 비-게임 화면 hide

- DevOverlayRenderer 가 `flowState.kind` 가 `inGame` / `roundIntro` 외에는 즉시 hide
- 이전엔 dev 모드일 때 placeholder gameplayState 의 block_X 라벨이 Title 에 노출됨

### 0-17. SaveData 확장 + Partial save

- `gold: number`, `unlockedMascots: readonly string[]`, `selectedMascot: string` 추가
- `ISaveRepository.save(data: Partial<SaveData>)` — 기존 필드 보존하며 머지
- `LocalSaveRepository.load()` — 누락 필드 default 마이그레이션
- `InMemorySaveRepository` constructor 도 `Partial<SaveData>` 받음

### 0-18. 새 GameplayEvent: BallHitBarEvent

- 일반 반사 시 (자석 부착 제외) `CollisionResolutionService.resolveBar` 가 발행
- AudioCueResolver 가 `cue_ball_hit_bar` (낮은 피치, 짧은 cut) 트리거

### 0-19. playfield 단일 소스 모듈

- 신규 `src/gameplay/systems/playfieldLayout.ts` — 플레이필드 좌표 모든 상수 + 헬퍼
  - `PLAYFIELD_WIDTH/HEIGHT`, `BLOCK_*`, `BAR_HEIGHT`, `BALL_RADIUS`, `INITIAL_LAUNCH_OFFSET_X`
  - 스피너: `CIRCLE_RADIUS`, `CIRCLE_CLAMP_MARGIN`, `MIN_CIRCLE_CENTER_Y`, `BAR_CLEARANCE`
  - helper: `blockGridPosition(col, row)`, `clampSpinnerCenter(spawnX, descentEndY)`
- `StageRuntimeFactory.ts` / `MovementSystem.ts` / `SpinnerSystem.ts` 가 import (중복 제거)
- **편집기 (`src/editor/`) 도 동일 모듈 import** — 이전엔 BLOCK_W=72 (게임 64), GRID_OFFSET=16 (게임 56/80) 으로 drift 되어 있던 것 해결
- 편집기와 게임 런타임이 동일 위치에 블록 렌더 보장

### 0-20. 출시 / Phase 결정사항

- **Unity 재포팅 결정 유지** (1달 출시 일정 하에)
- **5-B 채택**: TS 는 placeholder, Unity 에서 실제 에셋
- **A안 채택**: 엔티티별 ViewModel 도입 (코드는 추후 적용)
- **명명 변경 채택**: `*Presenter` → `*ViewModelFactory` (코드 추후 적용)
- 자세한 결정 배경: `architecture.md` §12-3, §13-4, Unity 매핑 §9 + memory

---

## 1. 단계별 진척

| 단계 | 상태 | 비고 |
|---|:---:|---|
| 아키텍처 설계 (architecture.md) | ✅ MVVM 반영 1차 완료 | §15 이후 마크다운 일부 깨짐 (pre-existing) |
| TS 선구현 (MVP 1~3) | ✅ 완료 | 103개 .ts 파일, 단위/통합 테스트 다수 |
| Unity 포팅 — Logic 레이어 | ✅ 완료 | 374개 EditMode 테스트 통과 |
| Unity 포팅 — View 레이어 | ✅ 1차 완료 | 명명/리소스 정책 정리 필요 |
| 기능 확장 (F/G/A/B/C/D/E/H) | ✅ 완료 | 사운드 / HUD / 스피너 3D / 난이도 / 모바일 |
| 모바일 빌드 환경 | ✅ Android 모듈 설치 + 빌드 메뉴 | 실기기 검증 미실시 |
| 최종 명명 정리 (MVVM 일관성) | ⏳ 보류 | md 결정만 됨, 코드 미반영 |
| 리소스 로딩 전략 명문화 | ⏳ 보류 | 원칙만 있고 구현 정책 공백 |

---

## 2. 완료된 작업 (Done)

### 2-1. TypeScript 선구현
- 8축 책임 분리 구조 확립 (Flow / Gameplay / Presentation / Audio / Persistence / Definitions / Asset / Input)
- MVP1: Title / RoundIntro / InGame / GameOver + Stage1 + Expand 아이템
- MVP2: IntroStory / GameClear / Stage2~3
- MVP3: 자석 / 레이저 / 회전체 / 효과 교체 정책
- Stage Editor (별도 Phaser 앱)
- 개발 도구: `BallTrail`, `CollisionLog`, `InvariantChecker`, `ReplayRecorder`

### 2-2. Unity 포팅 — 코어 (Phase 1~7)
- Pure C# Logic 계층 1:1 포팅
  - `Shared`, `Definitions`(타입+테이블+밸리데이터), `Flow`, `Gameplay`, `Presentation`(VM/Factory/Director/VisualEffect)
  - `Persistence` (`PlayerPrefsRepository` + `InMemorySaveRepository`)
  - `Audio` (`AudioCueResolver` + `AudioPlayerAdapter`)
  - `Input` (`InputSnapshot` + `KeyboardTouchInputAdapter`)
- `AppContext` Composition Root + `FlowEventRouter` 라우팅
- 374 EditMode 테스트 통과
- `GameBootstrap` MonoBehaviour 진입점
- `ArkanoidSceneSetup` 에디터 메뉴 (`Tools > Arkanoid > Create Default Scene`)
- 좌표계 변환: `PlayfieldRoot.localScale.y = -1` 패턴

### 2-3. Unity 포팅 — View
- 화면 6종: Title / IntroStory / RoundIntro / InGame / GameOver / GameClear
- InGame 하위: Ball / Bar / HUD / Block / ItemDrop / LaserShot / Gate / Spinner View(Pool)
- ScreenSpaceOverlay Canvas + UGUI Text (LegacyRuntime.ttf)
- Background SpriteRenderer 자동 생성

### 2-4. 기능 확장 (이번 세션 + 이전 세션)

| 묶음 | 항목 | 결과 |
|:---:|---|---|
| **F** | Q → 타이틀 복귀 | `ReturnToTitleRequestedCommand` + 모든 게임 상태에서 Title 전이 + HUD 우상단 `Q ↩ TITLE` 버튼 |
| **G** | HUD 우측 세로 재배치 | 반투명 검정 스트립 + HIGH SCORE / 1UP / Lives 세로 스택 / ROUND N / 3 |
| **A** | 사운드 5종 + 피치 | `AudioCueEntry.Pitch` 추가, `BallLaunched`(1.0) / `BallHitBar`(0.7 저음) / `BlockHit`(1.35 고음) / `BlockDestroyed`(1.15) / `ItemCollected_*`(타입별 분기) |
| **B** | 스피너 3D + 코인플립 + Hit 하이라이트 | `Arkanoid/SpinnerUnlit` 셰이더 + 프로시저럴 큐브/사면체 메시 + Y축 자체회전 + `SpinnerHitEvent` 흰색 틴트 180ms |
| **C** | 바 파괴 연출 | Perlin 흔들림 + 빨강/흰 점멸 + 가로/세로 수축 + alpha fade 700ms |
| **D** | 목숨 손실 RoundIntro 오버레이 | 검정 풀스크린 제거 → 게임 화면 위 텍스트만 + `\|sin(p·π·3)\|` 3회 점멸 |
| **E** | 난이도 NORMAL / HARD | `DifficultyConfig` (Normal: Lives=5, 스피너 OFF / Hard: Lives=3, 스피너 ON) + Title 버튼 UI + 방향키/탭 선택 |
| **H1** | 터치 드래그 바 컨트롤 | `InputSnapshot.TargetBarX` + `MoveBarToCommand` |
| **H2** | 온스크린 UI 버튼 | `OnScreenInputInjector` + `OnScreenButtonRelay` + Q/Difficulty 버튼 |
| **H3** | Safe Area 대응 | `SafeAreaFitter` MonoBehaviour |
| **H4** | 카메라 비율 | CanvasScaler ReferenceResolution(720,720) + 플레이필드 0.778 축소 |
| **H5** | 빌드 설정 메뉴 | `Tools > Arkanoid > Configure Android Build Settings` (Portrait / IL2CPP / ARM64 / API26+) |

### 2-5. 환경 / 인프라
- Unity Hub Android 모듈 설치 완료 (Build Support / SDK / NDK / OpenJDK / Platform 34~36 / Build Tools / CMake)
- Audio 파일 9종 `Resources/Audio/*.wav` 배치
- Stage JSON 3종 `StreamingAssets/Stages/stage{1,2,3}.json`

### 2-6. 아키텍처 문서 정비
- `architecture.md` MVVM + FSM + Hexagonal 조합 명문화
  - §5 신설 (아키텍처 패턴 선언)
  - §7 8축을 MVVM 역할로 매핑
  - §9 의존성 규칙을 MVVM 용어로 재작성
  - §12-3 Presenter → ViewModelFactory 리네이밍 권고 추가
  - 부록 A 명명 규칙 표 신설 (16개 접미사 + 금지 접미사 + decision tree)
  - Unity 매핑 표에 MVVM 계층 컬럼 추가

---

## 3. 진행 중 / 보류 (In flight)

### 3-1. 코드 명명 리팩토링 (MVVM 일관성)
md 결정 완료, 코드 미반영. 우선순위 순:

| 현재 | 대상 명칭 | 영향 범위 |
|---|---|:---:|
| `HUDPresenter` | `HudViewModelFactory` | 작음 |
| `ScreenPresenter` | `ScreenViewModelFactory` | 중간 (각 화면 빌더 메서드 다수) |
| `VisualEffectController` | `VisualEffectService` | 중간 (`AppContext`, `ScreenDirector` 참조) |
| `GameFlowController` | `FlowStateMachine` | 큼 (테스트 다수, FlowEventRouter 참조) |

→ 일괄 리네이밍 + 테스트 갱신 필요. **리네이밍 안 해도 동작은 하므로 보류 가능.**

### 3-2. 정적 캐시 정리 (CLAUDE.md §3 위반 1건)
`SpinnerViewPool` 의 `_cachedMaterial` / `_cachedCubeMesh` / `_cachedTriMesh` static 필드 →
인스턴스 필드 + `OnDestroy` 정리 또는 ScriptableObject 자산화.

### 3-3. architecture.md 마크다운 복구
§15 이후 코드블록(`​```ts`)이 닫히지 않아 §16~24 가 plain text 로 렌더링됨. 헤더 누락. **MVVM 적용과 무관한 pre-existing 이슈.**

---

## 4. 미진행 (Not started)

### 4-1. 리소스 로딩 전략 명문화 ⚠️ 우선
architecture.md 가 "의미 ID 와 파일 참조 분리" 원칙만 정해두고 실제 정책 공백.
다음을 §16 으로 신설 필요:

- **로드 API 결정**: TS 는 Phaser Loader, Unity 는 현재 `Resources.Load`. **Addressables 마이그레이션 검토** 필요.
- **에셋 분류 정책**: 오디오/스테이지/스프라이트/폰트/셰이더/UI 아이콘별 위치 + 로드 방식
- **`IAssetCatalog` 인터페이스 정의** (Port) — 현재 `GameBootstrap.LoadAudioClips` 가 직접 `Resources.Load` 하는 원칙 위반 캡슐화
- **resourceId 네이밍 컨벤션** (`bgm_*`, `sfx_*`, `jingle_*`, `icon_*`, `tex_*`, `sprite_*`, `shader_*`)
- **에러 정책**: 누락 시 fallback / Validator 검사
- **포팅 계약**: TS 와 Unity 의 동일 resourceId 공간 공유

### 4-2. Unity 미포팅 항목
TS 에는 있으나 Unity 에 아직 없는 것:

- **Stage Editor** (TS `editor/` 폴더에 별도 Phaser 앱) — Unity Editor Window 로 포팅
- **개발 도구** (`BallTrail`, `CollisionLog`, `InvariantChecker`, `ReplayRecorder`) — 디버깅용
- **`AssetCatalog` / `AssetResolver` C# 포트** — 현재 빈 껍데기

### 4-3. 모바일 검증
- Unity Remote 5 설치 + USB 연결 + 입력 라이브 테스트
- 실 APK 빌드 + 실기기 설치
- Touch 드래그 정밀도 / Q 버튼 탭 / 난이도 버튼 탭 검증
- Safe Area 적용 검증 (노치/홈 인디케이터)
- 다양한 화면 비율 letterbox 검증

### 4-4. 추가 콘텐츠 / 폴리싱
- 전용 오디오 파일 (현재 기존 파일 재활용 + pitch 만 분기):
  - `sfx_ball_launch.wav` (현재 `sfx_balls_released` 재사용)
  - `sfx_item_bar_extend.wav` (현재 `sfx_item_collected` 재사용)
  - `sfx_item_laser.wav` (현재 `sfx_laser_fired` 재사용)
  - `sfx_item_magnet.wav` (현재 `sfx_ball_attached` 재사용)
- 앱 아이콘 / 스플래시
- iOS 빌드 (Mac 필요)

### 4-5. 영속성 확장 (선택)
- 난이도 마지막 선택 저장 (현재 매번 NORMAL)
- 라운드별 점수 / 통계 / 도전 과제

### 4-6. Unity 프로젝트 git 초기화
현재 Unity 폴더(`C:\Users\rimse\UnityProjects\arkanoid-unity`)는 git 미초기화.
Unity 표준 `.gitignore` + 초기 커밋 필요.

---

## 5. 알려진 이슈

| # | 이슈 | 우선도 |
|:-:|---|:---:|
| 1 | `SpinnerViewPool` static cache (CLAUDE.md §3 위반) | 중 |
| 2 | `GameBootstrap.LoadAudioClips` 가 Asset Resolution 우회 (직접 `Resources.Load`) | 중 |
| 3 | architecture.md §15 이후 코드블록 미닫힘 | 낮 |
| 4 | TS 에는 있는 Stage Editor / Dev Tools 가 Unity 에 없음 | 낮 |
| 5 | "Presenter" 명명이 MVP 와 혼동 유발 | 낮 (md 명문화로 완화) |
| 6 | 셰이더 `Arkanoid/SpinnerUnlit` 가 Always Included Shaders 미등록 (빌드 시 누락 가능) | 중 |
| 7 | EventSystem 자동 생성 시 `InputSystemUIInputModule` 의존 — 일부 Unity 버전에서 실패 가능 | 낮 |
| 8 | RoundIntro 텍스트 위치가 좌측 정렬 (플레이필드 0..560 기준) — 가로 비율 변하면 어긋남 | 낮 |

---

## 6. 결정 필요 사항

| 항목 | 옵션 | 권고 |
|---|---|---|
| 리소스 로딩 API (Unity) | A) `Resources.Load` 유지 + IAssetCatalog 캡슐화 / B) Addressables 마이그레이션 | A 부터 (§16 신설), 이후 B |
| 명명 리팩토링 시점 | A) 즉시 / B) 다음 큰 기능 직전 / C) 영구 보류 | B (큰 변경 없을 때까진 동작 우선) |
| Stage Editor Unity 포팅 | A) 별도 Editor Window / B) Inspector 기반 ScriptableObject / C) JSON 직접 편집 유지 | C 당장은 충분 |
| iOS 지원 | A) 지금 / B) Android 검증 후 | B |
| 난이도 영속화 | A) 저장 / B) 미저장 | B (요구사항대로 매번 NORMAL) |
| 한국어 로컬라이제이션 | A) 도입 / B) 영어 유지 | B (아케이드 느낌) |

---

## 7. 다음 1주일 권장 순서

1. **architecture.md §16 리소스 로딩 전략 신설** — 공백 메우기
2. **`IAssetCatalog` 인터페이스 + Unity 구현체** — `GameBootstrap.LoadAudioClips` 캡슐화
3. **`SpinnerViewPool` static cache 제거** — 인스턴스 필드로 이동 + `OnDestroy` 정리
4. **셰이더 Always Included 등록** — 빌드 안정성
5. **모바일 실기기 검증** — Unity Remote 5 → 실 APK
6. **(선택) Presenter → Factory 리네이밍** — md 결정대로 코드 반영
