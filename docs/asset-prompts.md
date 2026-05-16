# Asset Prompts — Jelly Block 스타일

**용도:** 이 문서의 프롬프트를 ChatGPT (DALL·E 3, gpt-image-1) 또는 Midjourney 등에 그대로 붙여넣어 자산 생성. 일관된 스타일 유지를 위해 §1 "공통 스타일 가이드" 를 모든 프롬프트의 헤더로 사용 권장.

**짝 문서:** [`asset-spec.md`](./asset-spec.md) (크기/용도/파일 경로).

---

## 1. 공통 스타일 가이드 (Jelly Block Style)

> **Style:** Glossy 3D jelly block, soft rounded corners, vibrant saturated color, smooth gradient with bright highlight on top, subtle inner glow, slight translucency suggesting depth (like gummy candy), soft drop shadow underneath, no outline / stroke. Mobile casual game aesthetic, polished modern look (reference: "Block Blast" game). Rendered as if backlit, cheerful and inviting. Strict isolation on pure transparent background (or pure white if alpha unavailable), centered, fully visible, no cropping.

(이 단락을 모든 프롬프트의 머리에 붙이면 톤 일관성 ↑)

**색상 톤 가이드:**
- Vibrant saturated primary colors with white highlight (NOT pastel, NOT muted)
- Top 30% of asset has brighter highlight (light coming from top)
- Bottom 20% slightly darker / shadowed
- Side faces slightly desaturated for 3D illusion

**금지 (Negative prompt 권장):**
- Outline / black border / pixel art / flat 2D / cartoon線 / 사진 사실주의 / 텍스트 / 워터마크 / 배경

---

## 2. 자산별 프롬프트

### 2-1. 블록 (Block) — 5종

#### `block_basic` — 회색 일반 블럭
```
[Jelly Block Style 공통 가이드]

Create a glossy jelly-style rectangular block, ratio 8:3 (wide), gray-silver color (#888888 base) with vibrant white highlight on top, smooth and bouncy looking, rounded corners, slight translucency. Single isolated block, centered on transparent background. Square canvas. Style consistency: this is the "basic" block from a series of 5 jelly block types.

Size hint: target 64×24 px in-game, generate at 512×192 or 1024×384 for downsizing.
```

#### `block_basic_drop` — 노랑 (확장 아이템 드롭)
```
[Jelly Block Style 공통 가이드]

Same jelly block shape as `block_basic` but in vibrant warm yellow (#dddd00 base) — like lemon jelly. A small bright white star or sparkle icon centered on the block face indicating "powerup drop". Otherwise identical proportions and style. Transparent background, centered.
```

#### `block_magnet_drop` — 파랑 (자석 드롭)
```
[Jelly Block Style 공통 가이드]

Same jelly block shape as `block_basic` but vibrant electric blue (#3377cc base) — like blueberry jelly. A small white magnet/horseshoe icon centered. Otherwise identical proportions and glossy jelly style. Transparent background.
```

#### `block_laser_drop` — 빨강 (레이저 드롭)
```
[Jelly Block Style 공통 가이드]

Same jelly block shape as `block_basic` but vibrant red (#cc3333 base) — like cherry jelly. A small white lightning-bolt icon centered. Otherwise identical proportions and glossy jelly style. Transparent background.
```

#### `block_tough` — 어두운 강화 (2히트)
```
[Jelly Block Style 공통 가이드]

A "tough" version of the jelly block: same shape but darker (#444444 base, gunmetal jelly), with a subtle metallic sheen layered on top of the jelly highlight. Looks slightly more solid, like obsidian jelly. Inner darker outline (within the jelly, not as a hard stroke). Transparent background.
```

---

### 2-2. 테두리 / 문 (Border / Door)

#### `border_horizontal` — 상단 테두리 셀
```
[Jelly Block Style 공통 가이드 — 단, 채도 약간 낮춤]

A short, narrow horizontal jelly bar — ratio about 16:3 (much thinner than a block). Metallic silver-gray with cool blue tint (#555566 base), with a glassy translucent quality. This is a "border" segment for a playfield boundary. Rounded corners, top highlight, no icon. Transparent background.
```

#### `border_vertical` — 좌/우 테두리 셀
```
Same as `border_horizontal` but rotated 90°: tall narrow vertical jelly bar, ratio 3:16. Same color/style. Transparent background.
```

#### `door_closed` — 닫힌 문
```
[Jelly Block Style 공통 가이드]

A wide jelly door panel, same dimensions as `border_horizontal` (16:3 ratio). Color: warm dark amber/brown (#6b4226) with a bright golden highlight (#ddaa44). The door has a subtle vertical "seam" hint down the middle suggesting it can split-open. Glossy jelly finish. Transparent background.
```

#### `door_opening` — 슬라이드 열림 중 (선택, 프레임 시퀀스)
```
Same as `door_closed` but appearing to slide-open to the left: the left edge has receded, revealing a darker void behind. Generate as 5-frame sequence (closed, 25%, 50%, 75%, fully open) on a transparent strip — or 5 separate images.
```

---

### 2-3. 바 (Paddle)

#### `bar_normal` — 기본 바
```
[Jelly Block Style 공통 가이드]

A wide jelly paddle, ratio 15:2 (very wide and shallow). Pure white jelly with subtle blue-tinted highlight on top. Center has a faint logo/dot or smooth (no detail). Rounded full corners. This is the player's paddle in an Arkanoid-style game. The center 60% can stretch (9-slice friendly). Transparent background.

Variants needed: tinted versions
- `bar_expand_tint`: soft yellow tint (#ffee99)
- `bar_magnet_tint`: soft blue tint (#88ccff)
- `bar_laser_tint`: soft red tint (#ff8888)
```

---

### 2-4. 공 (Ball)
```
[Jelly Block Style 공통 가이드]

A small spherical jelly ball, perfectly round, 1:1 ratio. Pure white with soft pearlescent sheen and a bright single highlight near the top-left (light source). Slight pale-blue inner glow. Looks like a glossy gumball. Transparent background, centered, fully visible.

Size hint: target 16×16 px, generate at 256×256.
```

---

### 2-5. 아이템 드롭 (Item drops)

#### `item_expand` — 확장 아이템
```
[Jelly Block Style 공통 가이드]

A small jelly capsule (ratio 2:1, rounded rectangle), color: warm yellow (#dddd00). Centered icon: white outward-pointing arrows "↔" or letter "E". Glossy jelly finish. Falls in-game so the icon should be readable at small size. Transparent background.
```

#### `item_magnet` — 자석 아이템
```
Same capsule shape as `item_expand` but vibrant blue (#3377cc). Center: white horseshoe magnet "U-shape" icon or letter "M".
```

#### `item_laser` — 레이저 아이템
```
Same capsule shape as `item_expand` but vibrant red (#cc3333). Center: white lightning-bolt "⚡" icon or letter "L".
```

---

### 2-6. 회전체 (Spinner) — 2종

회전체는 게임 중 Y축으로 회전. **single static front-view 이미지로 생성** 한 다음 코드가 회전 (또는 Y축 회전 sprite-sheet 별도 의뢰).

#### `spinner_cube` — 큐브 회전체
```
[Jelly Block Style 공통 가이드]

A glossy 3D jelly cube, viewed from straight-on (front face dominant). Three faces visible: front (medium purple #aa88ff), top (light purple #ccaaff), right side (dark purple #8866dd). Soft rounded edges where faces meet. Pseudo-3D pixel-art mobile game style. Transparent background, centered, fully visible.

Generate at 256×256.
```

#### `spinner_triangle` — 삼각 회전체 (테트라헤드론)
```
[Jelly Block Style 공통 가이드]

A glossy 3D jelly tetrahedron (pyramid with triangle base), viewed from front. Three visible faces: front (#ff99cc pink), side-1 (#ffbbdd light pink), side-2 (#cc6699 dark pink). Soft jelly look, pseudo-3D. Top vertex pointing up. Transparent background.
```

---

### 2-7. 마스코트 (Mascot) — 5종

각 마스코트는 4-frame cheer/dance animation. 일관된 비례 + 위치.

**공통 base prompt:**
```
[Jelly Block Style 공통 가이드 — but for character art]

Character art for "{name}", cute and chibi-proportioned (head 1.5x body), big expressive eyes, cheerful smile, vibrant jelly-like glossy look matching the game art style. Standing in a cheer/dance pose, arms slightly raised. Generate 4 frames in a 2×2 grid (or horizontal strip):
- frame0: arms down, neutral
- frame1: arms half-up
- frame2: arms fully up cheering
- frame3: arms back to half-up
Loop animation friendly. Transparent background. Centered, fully visible.

Each frame: 240×240 final, generate at 512×512 per frame.
```

#### `mascot.albatross` — 알바트로스 (메인 캐릭터)
```
{공통 mascot base}

{name} = "albatross". A cute chibi white-and-gray seabird (albatross) with large wings folded by sides, big black eyes, orange beak. Cheering pose dancing. Background: transparent.
```

#### `mascot.kongming` — 공명/제갈량
```
{공통 mascot base}

{name} = "kongming" (Zhuge Liang). Chibi ancient Chinese strategist character with white scholar's robe, fan in one hand, neatly-tied hair with traditional cap, sage smile. Cheering pose.
```

#### `mascot.snowrabbit` — 눈토끼
```
{공통 mascot base}

{name} = "snowrabbit". Chibi white rabbit with snow crystals on ear tufts, pink nose, fluffy white body, big blue eyes. Standing on hind legs cheering with paws up.
```

#### `mascot.reaper` — 사신
```
{공통 mascot base}

{name} = "reaper" — cute friendly version. Chibi grim reaper, small dark hooded cloak, tiny scythe held lightly, glowing soft purple eyes (not scary, more playful). Cheering pose.
```

#### `mascot.seraphin` — 세라핀 (천사)
```
{공통 mascot base}

{name} = "seraphin". Chibi six-winged angel character, white feathered wings (two pairs visible, third pair hinted), golden halo above head, soft white robe, peaceful smile. Cheering pose.
```

---

### 2-8. 배경 (Stage backgrounds)

#### `bg_title` — 타이틀 화면
```
[Background art for mobile game]

Vertical 9:16 background for game title screen. Dark deep-space gradient (deep purple to navy blue), scattered stars, soft nebula clouds in distance, very subtle. No text, no characters. Empty top-center area where game logo will be placed (so the focus point should be slightly below center). Polished mobile casual game aesthetic. 1080×1920.
```

#### `bg_stage_01` — 스테이지 1
```
Vertical 9:16 background for an Arkanoid stage. Dark cosmic blue-purple gradient with starfield, slight purple nebula glow, subtle. No characters, no UI. The middle portion (40% of vertical) should be slightly darker to make in-game blocks pop. 1080×1920.
```

#### `bg_stage_02` — 스테이지 2
```
Same composition as `bg_stage_01` but with warmer reddish-purple cosmic theme (Mars-like nebula). 1080×1920.
```

#### `bg_stage_03` — 스테이지 3
```
Same composition as `bg_stage_01` but with greenish cyan cosmic theme (nebula clouds). 1080×1920.
```

#### `bg_gameover` — 게임오버
```
Vertical 9:16, dark moody background. Deep red/maroon gradient with faint smoke/fog. Empty composition for text overlay. 1080×1920.
```

#### `bg_gameclear` — 게임 클리어
```
Vertical 9:16, celebratory bright background. Golden/yellow radiant gradient from center outward with light rays, confetti silhouettes in distance, glowing warm tones. 1080×1920.
```

---

### 2-9. UI 아이콘 (64×64)

각 아이콘은 일관된 스타일:
- White or single-color icon
- Soft shadow / glow
- Rounded shapes
- Match jelly aesthetic

```
[Jelly Block Style 공통 가이드 — adapted for UI icon]

64×64 mobile game UI icon, glossy jelly-style with rounded edges. Centered icon on transparent background. Single dominant color matching its function. No text, just the shape/symbol.

생성할 아이콘:
- `icon_pause`: 두 개의 세로 막대 (||) 흰색 또는 옅은 회색
- `icon_play`: 오른쪽 가리키는 삼각형 (▶) 흰색
- `icon_bgm_on`: 음표 + 음파, 파랑
- `icon_bgm_off`: 음표 + 빨간 X, 회색
- `icon_sfx_on`: 스피커 + 음파, 파랑
- `icon_sfx_off`: 스피커 + 빨간 X, 회색
- `icon_quit`: 오른쪽 위 화살표 또는 X, 회색
- `icon_lock`: 자물쇠 모양, 황색

각 아이콘별로 별도 프롬프트로 의뢰 (DALL-E 가 그룹 의뢰 시 일관성 부족).
```

---

### 2-10. 슬라이더 컨트롤 (하단 바 조작)

#### `slider_track` — 트랙
```
[Jelly Block Style 공통 가이드]

Horizontal jelly slider track, ratio 40:1 (long and thin), deep blue (#2233aa) jelly bar with lighter blue inner glow (#4466cc). Mobile UI element for swipe control. Transparent background. Generate at 1600×40.
```

#### `slider_knob` — 노브
```
[Jelly Block Style 공통 가이드]

A pure white jelly sphere (1:1 ratio), like a gumball, highly glossy with a soft outer light gray ring/shadow. Mobile UI thumb knob for slider. Transparent background, centered. Generate at 256×256.
```

---

### 2-11. 레이저 발사체
```
[Jelly Block Style 공통 가이드]

A thin vertical jelly laser bolt, ratio 1:5 (tall and skinny). Bright cyan (#88ffff) energy with soft white core, soft outer glow. Looks like a glowing capsule. Transparent background. Generate at 32×160.
```

---

## 3. 폰트 (Font 직접 생성 X — 다운로드)

폰트는 AI 생성보다 기존 라이선스 폰트 사용 권장:

| 용도 | 추천 폰트 (한글 지원, 무료/CC) |
|---|---|
| HUD / 타이틀 | "Press Start 2P" (영문, 픽셀 느낌) + "DungGeunMo" (한글, CC0) |
| 메뉴 / Pause | "Noto Sans KR" (CJK 무료) |
| 픽셀아트 매칭 | "Galmuri" (한글 픽셀, OFL) |

다운로드 후 `public/assets/fonts/` 에 배치 + Phaser 에 등록.

---

## 4. ChatGPT/DALL-E 사용 팁

1. **한 세션 = 한 카테고리**: 같은 세션에서 연속해서 의뢰하면 스타일 일관성 ↑.
2. **헤더 + 콘텐츠 분리**: 매번 §1 공통 스타일 가이드를 헤더로 붙이면 모델이 톤 유지.
3. **negative prompt 명시**: "no text, no watermark, no outline, no shadow on background".
4. **사이즈/비율 지정**: DALL-E 3 는 1024×1024 / 1792×1024 / 1024×1792 만 지원. 정사각형으로 받고 후처리로 crop/resize.
5. **투명 배경**: DALL-E 는 진짜 alpha PNG 안 줌. "pure white background" 받고 외부에서 배경 제거 (예: remove.bg, Photoshop 일괄).
6. **iteration**: 첫 결과 만족 못 하면 "더 부드러운 jelly 느낌으로", "highlight 좀 더 강하게" 같은 follow-up.

---

## 5. 워크플로우 권장

1. 이 doc 보면서 §1 스타일 가이드를 ChatGPT 에 먼저 input (시스템 프롬프트처럼)
2. 같은 세션에서 §2 카테고리별 프롬프트 순차 입력
3. 결과 받아서 `remove.bg` 또는 Photoshop 으로 배경 제거 → PNG (alpha) 저장
4. `asset-spec.md` §5 의 파일 트리 구조대로 `public/assets/` 에 배치
5. `src/assets/AssetCatalog.ts` 에 resourceId → 경로 매핑 추가
6. 게임에서 시각 placeholder → 실제 이미지로 교체 (`renderInGameScreen.ts` 의 placeholder Rectangle 을 Image 로 변경 — 별도 작업)
