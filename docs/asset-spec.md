# Asset Specification — 알카노이드 (알바트로스 프로젝트)

**용도:** GPT 등 생성 도구로 자산 제작 시 입력 사양. 모든 시각/오디오/폰트 리소스의 규격, 용도, 파일 경로 명시.

**플랫폼:** 모바일 Google Play (1차), iOS (2차). 베이스 캔버스 **1080×1920 (FHD 세로, 16:9)**.

**최신화:** 2026-05-17. 코드 SSOT 와 동기화 필수 — 변경 시 LayoutConfigTable / BlockDefinitionTable / AudioCueTable / MascotTable 도 같이 확인.

---

## 1. 이미지 / 스프라이트

### 1-1. 블록 (Block) — 5종

| ID | 용도 | 크기 | 색상 (현재 placeholder) | 비고 |
|---|---|---|---|---|
| `block_basic` | 일반 블럭 (1히트) | **64×24 px** | 회색 0x888888 / 플래시 0xffffff | 점수 10 |
| `block_basic_drop` | 일반 + 확장 아이템 드롭 | 64×24 | 노랑 0xdddd00 / 플래시 0xffffcc | 점수 10, 우하단 점 표시 |
| `block_magnet_drop` | 일반 + 자석 드롭 | 64×24 | (코드 placeholder 없음) | 점수 10 |
| `block_laser_drop` | 일반 + 레이저 드롭 | 64×24 | (코드 placeholder 없음) | 점수 10 |
| `block_tough` | 강화 블럭 (2히트) | 64×24 | 파랑 0x4488ff / 플래시 0xaaccff | 점수 30, 이중 테두리 |

**파일 경로:** `public/assets/sprites/blocks/<id>.png`
**포맷:** PNG (alpha 채널 권장 — 블럭 모서리 둥근 효과 등)

### 1-2. 테두리 / 문 (Border / Door)

| ID | 용도 | 크기 | 색상 |
|---|---|---|---|
| `border_horizontal` | 상단 테두리 셀 1개 | 64×12 | 메탈릭 회색 0x555566 + stroke 0x8899aa |
| `border_vertical` | 좌/우 테두리 셀 1개 | 12×64 | 동일 |
| `door_closed` | 닫힌 문 (상단 전용) | 64×12 | 진한 갈색 0x6b4226 + 황색 stroke 0xddaa44 |
| `door_opening_frames` | 문 열림 슬라이드 애니 (선택, frame-by-frame) | 64×12 × N프레임 | 동일 톤 |

**파일 경로:** `public/assets/sprites/borders/<id>.png`

### 1-3. 바 (Bar / Paddle)

| ID | 용도 | 크기 | 색상 |
|---|---|---|---|
| `bar_normal` | 일반 바 | **120×16** (기본 폭) — 확장 시 폭 180 | 흰색 0xffffff |
| `bar_expand_tint` | 확장 효과 활성 (틴트만) | 동일 | 연 노랑 0xffee99 |
| `bar_magnet_tint` | 자석 효과 활성 | 동일 | 연 파랑 0x88ccff |
| `bar_laser_tint` | 레이저 효과 활성 | 동일 | 연 빨강 0xff8888 |

**파일 경로:** `public/assets/sprites/bar.png`
**확장 가능 권장:** 9-slice 가능한 형태 (가운데 stretch, 양 끝 캡)

### 1-4. 공 (Ball)

| ID | 용도 | 크기 |
|---|---|---|
| `ball` | 게임 공 | 반지름 8 → 16×16 정사각 캔버스 |

**파일 경로:** `public/assets/sprites/ball.png`
**색상:** 흰색 / 약한 발광 효과 권장

### 1-5. 아이템 드롭 (Item drop capsule)

| ID | 종류 | 크기 | 색상 (fill / stroke / 첫글자) |
|---|---|---|---|
| `item_expand` | 확장 | 24×12 캡슐 | (확장 색상 — 코드 LookUp 필요) |
| `item_magnet` | 자석 | 24×12 | 파랑 톤 |
| `item_laser` | 레이저 | 24×12 | 빨강 톤 |

**파일 경로:** `public/assets/sprites/items/<id>.png`
**현재 placeholder:** Phaser Rectangle + stroke + 첫글자 텍스트 + 회전.
**Unity 포팅 시:** 4꼭짓점 픽셀 빠진 캡슐 형태 (둥근 직사각형).

### 1-6. 회전체 (Spinner) — 2종

| ID | 종류 | 크기 (외접원 직경) | 시각 모델 |
|---|---|---|---|
| `spinner_cube` | 큐브형 | 48 | pseudo-3D 큐브, Y축 회전. silhouette = AABB (가로 펄스). 3가지 면 색 (front/top/side). |
| `spinner_triangle` | 삼각형(테트라헤드론) | 48 | pseudo-3D 테트라헤드론, Y축 회전. silhouette = 삼각형 (top + 2 base). |

**색상 (현재 placeholder):**
- cube: front 0xaa88ff, top 0xccaaff, side 0x8866dd (보라 톤)
- triangle: face0 0xff99cc, face1 0xffbbdd, face2 0xcc6699 (핑크 톤)

**파일 경로:** `public/assets/sprites/spinners/<id>.png` 또는 sprite sheet (회전 프레임)
**대안 — 정적 텍스처 + 코드 회전:** 단일 PNG 한 면씩 그려서 코드가 Y회전.

### 1-7. 회전체 게이트 (Spawning gate animation)

회전체가 등장할 때 상단에서 양쪽으로 열리는 게이트.

| ID | 크기 | 색상 |
|---|---|---|
| `gate_door_left` | 24×12 (반쪽) | 강화 보라 / 톤 일치 |
| `gate_door_right` | 24×12 | 동일 |

### 1-8. 마스코트 (Mascot) — 5종 × 4프레임 댄스

5종 캐릭터, 각 4-frame walk/cheer 애니메이션. 픽셀아트 스타일.

| ID prefix | 캐릭터 | 잠금해제 골드 |
|---|---|---|
| `mascot.albatross.frame{0..3}` | 알바트로스 (기본, 메인) | 0 (잠금해제 안 됨) |
| `mascot.kongming.frame{0..3}` | 공명 (제갈량) | 100 |
| `mascot.snowrabbit.frame{0..3}` | 눈토끼 | 300 |
| `mascot.reaper.frame{0..3}` | 사신 | 600 |
| `mascot.seraphin.frame{0..3}` | 세라핀 (천사) | 1000 |

**크기:** 캔버스 240×240 (in-game cheer 표시). Title 카루셀에서 더 크게 (예: 360×360).
**파일 경로:** `public/assets/mascots/<id>/frame<n>.png`
**대안 — sprite sheet:** `public/assets/mascots/<id>.png` (4프레임 가로 배치).

### 1-9. 배경 (Stage backgrounds)

| ID | 용도 | 크기 |
|---|---|---|
| `bg_title` | Title 화면 | 1080×1920 |
| `bg_stage_01` | Stage 1 | 1080×1920 |
| `bg_stage_02` | Stage 2 | 1080×1920 |
| `bg_stage_03` | Stage 3 | 1080×1920 |
| `bg_gameover` | GameOver | 1080×1920 |
| `bg_gameclear` | GameClear | 1080×1920 (선택) |

**파일 경로:** `public/assets/backgrounds/<id>.jpg` (또는 png)
**스타일:** 우주 / 별 / 그라데이션 어두운 톤 (참조: Block Blast 스크린샷)

### 1-10. UI 아이콘

| ID | 용도 | 크기 |
|---|---|---|
| `icon_item_expand` | 확장 아이템 (HUD/메뉴) | 64×64 |
| `icon_item_magnet` | 자석 아이템 | 64×64 |
| `icon_item_laser` | 레이저 아이템 | 64×64 |
| `icon_pause` | 일시정지 버튼 | 64×64 |
| `icon_play` | 재개 버튼 | 64×64 |
| `icon_bgm_on`/`icon_bgm_off` | BGM 토글 | 64×64 각 |
| `icon_sfx_on`/`icon_sfx_off` | SFX 토글 | 64×64 각 |
| `icon_quit` | 타이틀 복귀 | 64×64 |
| `icon_lock` | 마스코트 잠금 표시 | 32×32 |

**파일 경로:** `public/assets/ui/<id>.png`

### 1-11. 슬라이더 컨트롤 (하단 바 조작)

| ID | 용도 | 크기 |
|---|---|---|
| `slider_track` | 슬라이더 트랙 (배경) | 800×20 (또는 9-slice) |
| `slider_knob` | 슬라이더 노브 (드래그 핸들) | 80×80 (반지름 40) |

**색상 (현재 placeholder):**
- track: 진한 파랑 0x2233aa + stroke 0x4466cc
- knob: 흰색 0xeeeeee + stroke 0x666666

**파일 경로:** `public/assets/ui/slider_*.png`

### 1-12. 레이저 발사체

| ID | 용도 | 크기 |
|---|---|---|
| `laser_shot` | 레이저 빔 | 4×20 (얇고 긴) |

---

## 2. 폰트

| ID | 용도 | 권장 사이즈 (px) | 권장 스타일 |
|---|---|---|---|
| `font_hud_label` | HUD 라벨 (SCORE, HIGH SCORE, ROUND) | 36 | monospace, bold |
| `font_hud_value` | HUD 값 (점수, 라운드 번호) | 52 | monospace, regular |
| `font_title_main` | 타이틀 화면 메인 ("ALBATROSS") | 96~120 | sans-serif, bold |
| `font_button` | 메뉴 버튼 ("START", "QUIT" 등) | 32~40 | sans-serif |
| `font_pause_overlay` | 일시정지 메뉴 ("배경음", "효과음", "나가기", "돌아가기") | 28 | sans-serif |
| `font_intro_story` | 인트로 스토리 텍스트 | 24 | serif (분위기) |
| `font_round_intro` | "READY!" / 라운드 안내 | 64~80 | sans-serif, bold |
| `font_dev_overlay` | Dev 오버레이 (block ID, vx/vy 등) | 10~12 | monospace |
| `font_gameover` | "GAME OVER" / "GAME CLEAR" | 72 | sans-serif, bold |

**현재 사용 폰트:** `monospace` (브라우저 기본) 만 사용. 커스텀 폰트 미사용.

**한글 지원 필수.** 추천 (CC/OFL 라이선스):
- 본고딕 (Noto Sans CJK / Source Han Sans)
- 카페24 폰트 (CC BY-NC 무료, 상업 사용 시 확인)
- 갈무리 (픽셀아트)

**파일 경로:** `public/assets/fonts/<font-family>.ttf` 또는 `.woff2`

---

## 3. 오디오

전체 등록 표는 `src/assets/AssetCatalog.ts` 와 `src/definitions/tables/AudioCueTable.ts` 가 SSOT.

### 3-1. BGM (배경음)

| ID | 용도 | 길이 | 포맷 |
|---|---|---|---|
| `bgm_title` | 타이틀 화면 + 인게임 (현재 인게임 BGM 미사용 정책) | 60~120s loop | MP3 (현재 Bensound funkyelement) |
| (추가 가능) `bgm_stage` | 인게임 (장기 추가 시) | 60~120s loop | MP3 |

**볼륨 정책:** 0.2 (기본 20%) — 게임 SFX 가 묻히지 않게 낮춤.

### 3-2. 징글 (Jingle, 짧은 1회 재생)

| ID | 용도 | 길이 |
|---|---|---|
| `jingle_round_start` | 라운드 시작 ("READY" 연출) | 1~2s |
| `jingle_gameover` | 게임 오버 | 2~3s |
| `jingle_gameclear` | 게임 클리어 (전 스테이지 완료) | 3~4s |

**포맷:** WAV (즉시 재생 latency 0)

### 3-3. SFX (효과음)

| ID | 트리거 이벤트 | 비고 |
|---|---|---|
| `sfx_block_hit` | BlockHit (강화 블럭 1히트 후 잔존) | pitch 1.6, 짧고 경쾌 |
| `sfx_block_destroyed` | BlockDestroyed | pitch 1.4 |
| `sfx_item_collected` | ItemCollected | |
| `sfx_life_lost` | LifeLost | 낮은 톤 |
| `sfx_ui_confirm` | 버튼 클릭 등 UI 확인 | |
| `sfx_ball_attached` | 자석 부착 시 | |
| `sfx_balls_released` | 공 발사 / 자석 해제 | 발사 pitch 1.0, 바 반사 pitch 0.85 (재사용) |
| `sfx_laser_fired` | 레이저 발사 | |

**포맷:** WAV 16-bit, 44.1kHz, mono. 길이 < 500ms (대부분).

### 3-4. 라이센스

- 현재 BGM: Bensound funkyelement — **출시 시 attribution 필수** 또는 Bensound Pro 라이선스 구매. 또는 CC0 대체 트랙으로 교체.
- SFX: 자체 제작 (또는 CC0 freesound).

---

## 4. 캔버스 영역 (디자이너 참고)

`docs/screen-layout.md` 가 SSOT. 요약:

```
캔버스 1080 × 1920 (FHD 세로)
┌─────────────────────────────────────┐ y=0
│  SCORE   HIGH SCORE  ROUND  | 🐦 MASCOT │  HUD 행 (y=80~200, 마스코트 y=160 중심, 200×200)
├─────────────────────────────────────┤ y=600
│  PLAYFIELD  720×900                  │  플레이필드 (게임 좌표계)
│  좌측 180px 여백, 우측 180px 여백   │
│  블럭 그리드 9×7, 테두리, 문, 스피너 │
│  bar at y=840 (playfield 내부)      │
├─────────────────────────────────────┤ y=1500 (= 600 + 900)
│  Lives bar (y=1700)                  │
│  Slider track (y=1850, 800×20)      │  하단 슬라이더
└─────────────────────────────────────┘ y=1920
```

`canvasLayout.ts` 와 `LayoutConfigTable.ts` 가 SSOT.

---

## 5. 파일 트리 권장 구조

```
public/assets/
├── backgrounds/        # 스테이지 배경 (1080×1920)
│   ├── bg_title.jpg
│   ├── bg_stage_01.jpg
│   └── ...
├── sprites/
│   ├── blocks/         # block_basic.png 등
│   ├── borders/        # border_*.png, door_*.png
│   ├── items/          # item_*.png
│   ├── spinners/       # spinner_*.png
│   ├── bar.png
│   └── ball.png
├── mascots/
│   ├── albatross/
│   │   ├── frame0.png
│   │   └── ...
│   └── ...
├── ui/                 # icon_*.png, slider_*.png
├── sfx/                # 오디오 (.mp3 BGM, .wav SFX/jingle)
└── fonts/              # 폰트 (.ttf/.woff2)
```

---

## 6. 제작 우선순위

| Tier | 카테고리 | 사유 |
|---|---|---|
| 1 (필수) | 블록 5종, 바, 공, 배경 3종 (stage1/2/3), 마스코트 albatross 4프레임 | MVP 시각 |
| 2 (필수) | UI 아이콘 (pause/play/bgm/sfx/quit), 슬라이더 컨트롤 | 모바일 조작 |
| 3 (출시) | 폰트 한글 지원, 아이템 아이콘, 게임 오버/클리어 배경 | 정식 출시 |
| 4 (확장) | 마스코트 4종 추가 + 잠금해제 UI, 추가 BGM | post-launch |
| 5 (선택) | 큐브/삼각 회전체 텍스처 (현재 placeholder solid color), 게이트 애니 | 폴리시 |

---

## 7. 변경 시 절차

자산 ID 추가/변경 시 함께 갱신:

1. **`src/assets/AssetCatalog.ts`** — resourceId → 파일 경로 매핑
2. **해당 정의 테이블** (예: 블럭은 `BlockDefinitionTable.ts` 의 `visualId`)
3. **이 doc (`docs/asset-spec.md`)** — 규격/용도 기록
4. **`docs/screen-layout.md`** (해당되면) — 화면 영역에 영향 있으면

자산이 추가되어도 코드 const 에 색상이 들어가 있으면 그곳도 같이 — 이상적으로는 코드 placeholder 색상은 자산 도입 시 모두 제거 (이미지 사용).
