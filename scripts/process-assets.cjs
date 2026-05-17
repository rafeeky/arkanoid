/* eslint-disable @typescript-eslint/no-var-requires */
/**
 * process-assets.cjs — sharp 기반 자산 후처리 일괄 스크립트.
 *
 * 입력: assets-raw/<category>/*.png — 원본 raw 자산 (프로젝트 내, 영문 파일명)
 * 출력: public/assets/<category>/*.png — 후처리된 게임 자산
 *
 * 처리:
 *   1. flood-fill 누끼 (흰 캐릭터 내부 흰색 보존)
 *   2. 마스코트는 추가로 auto-trim + center (프레임 간 jitter 제거)
 *   3. 일부 자산은 단순 copy (이미 alpha 누끼됨)
 *
 * 모든 경로는 프로젝트 상대 (외부 OneDrive 등 의존 없음).
 * 새 raw 자산 추가 시 assets-raw/<category>/ 에 영문 파일명으로 넣고 이 파일의 매핑만 갱신.
 *
 * 사용: node scripts/process-assets.cjs
 */

const sharp = require('sharp');
const fs = require('fs/promises');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const RAW = path.join(ROOT, 'assets-raw');               // 원본 raw 자산 (프로젝트 내, 영문 파일명)
const SHEETS = path.join(ROOT, 'public/assets/sheets');  // 옛 시트 (gameover/gameclear 추출용)
const OUT = path.join(ROOT, 'public/assets');            // 최종 출력

const WHITE_THRESHOLD = 235; // R,G,B > this → 투명 처리

// -------------------------------------------------------------------
// 유틸: 단순 흰 → 투명 (블록 같이 캐릭터 내부 흰색이 없는 경우)
// -------------------------------------------------------------------
async function whiteToTransparent(buffer) {
  const { data, info } = await sharp(buffer)
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });
  const { width, height, channels } = info;
  for (let i = 0; i < data.length; i += channels) {
    const r = data[i];
    const g = data[i + 1];
    const b = data[i + 2];
    if (r > WHITE_THRESHOLD && g > WHITE_THRESHOLD && b > WHITE_THRESHOLD) {
      data[i + 3] = 0;
    }
  }
  return sharp(data, { raw: { width, height, channels } }).png().toBuffer();
}

// -------------------------------------------------------------------
// 유틸: 외곽 흰 픽셀만 flood-fill 로 투명화 (캐릭터 내부 흰 유지).
// 흰 캐릭터(알바트로스 깃털, 토끼, 햄스터 배 등) 가 흰 배경과 같은 색이라도
// 외곽 BFS 가 캐릭터 윤곽에서 멈춰 내부 흰색은 보존된다.
// 단, 캐릭터 윤곽이 배경과 동색이면 윤곽 일부가 잘려나갈 수 있음 (원본 한계).
// -------------------------------------------------------------------
async function whiteFloodFillToTransparent(buffer, threshold = 240) {
  const { data, info } = await sharp(buffer)
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });
  const { width: w, height: h, channels: c } = info;
  const isWhite = (px) =>
    data[px] >= threshold && data[px + 1] >= threshold && data[px + 2] >= threshold;
  const visited = new Uint8Array(w * h);
  const stack = [];
  const seed = (x, y) => {
    if (x < 0 || y < 0 || x >= w || y >= h) return;
    const ni = y * w + x;
    if (visited[ni]) return;
    if (!isWhite(ni * c)) return;
    visited[ni] = 1;
    stack.push(x, y);
  };
  for (let x = 0; x < w; x++) { seed(x, 0); seed(x, h - 1); }
  for (let y = 0; y < h; y++) { seed(0, y); seed(w - 1, y); }
  while (stack.length) {
    const y = stack.pop();
    const x = stack.pop();
    data[(y * w + x) * c + 3] = 0;
    seed(x - 1, y); seed(x + 1, y); seed(x, y - 1); seed(x, y + 1);
  }
  return sharp(data, { raw: { width: w, height: h, channels: c } }).png().toBuffer();
}

// -------------------------------------------------------------------
// extract 영역 → 누끼 → 파일 저장
// -------------------------------------------------------------------
async function extractAndSave(
  sheetPath,
  region,
  outPath,
  { transparent = true, resize = null } = {},
) {
  let pipeline = sharp(sheetPath).extract(region);
  if (resize) {
    pipeline = pipeline.resize(resize.width, resize.height, { fit: 'fill' });
  }
  const buf = await pipeline.png().toBuffer();
  const finalBuf = transparent ? await whiteToTransparent(buf) : buf;
  await fs.mkdir(path.dirname(outPath), { recursive: true });
  await fs.writeFile(outPath, finalBuf);
  console.log('  ✓', path.relative(ROOT, outPath));
}

// -------------------------------------------------------------------
// 마스코트 frame 추출 — extract → 누끼 → trim → 중앙 정렬 (jitter 제거)
// -------------------------------------------------------------------
async function extractMascotFrame(sheetPath, region, outPath, finalSize) {
  // 1. extract → flood-fill 누끼 (캐릭터 내부 흰색 유지)
  const extracted = await sharp(sheetPath).extract(region).png().toBuffer();
  const transparent = await whiteFloodFillToTransparent(extracted);

  // 2. trim: 투명 픽셀 제거해 캐릭터 bbox 만 남김
  const trimmed = await sharp(transparent)
    .trim({ threshold: 10 })
    .png()
    .toBuffer();
  const trimmedMeta = await sharp(trimmed).metadata();

  // 3. 중앙 정렬 된 정사각형 캔버스에 합성
  const canvasSize = finalSize;
  const tw = trimmedMeta.width || canvasSize;
  const th = trimmedMeta.height || canvasSize;
  // 캐릭터가 canvas 의 80% 이하면 그대로, 더 크면 비율 유지하며 다운스케일
  const maxFill = canvasSize * 0.9;
  let resizedBuf = trimmed;
  let rw = tw;
  let rh = th;
  if (tw > maxFill || th > maxFill) {
    const scale = Math.min(maxFill / tw, maxFill / th);
    rw = Math.round(tw * scale);
    rh = Math.round(th * scale);
    resizedBuf = await sharp(trimmed).resize(rw, rh).png().toBuffer();
  }
  const left = Math.round((canvasSize - rw) / 2);
  const top = Math.round((canvasSize - rh) / 2);

  const finalBuf = await sharp({
    create: {
      width: canvasSize,
      height: canvasSize,
      channels: 4,
      background: { r: 0, g: 0, b: 0, alpha: 0 },
    },
  })
    .composite([{ input: resizedBuf, left, top }])
    .png()
    .toBuffer();

  await fs.mkdir(path.dirname(outPath), { recursive: true });
  await fs.writeFile(outPath, finalBuf);
  console.log('  ✓', path.relative(ROOT, outPath), `(trim ${tw}x${th} → center ${canvasSize}x${canvasSize})`);
}

// -------------------------------------------------------------------
// 메인
// -------------------------------------------------------------------
async function main() {
  // ── 배경: title + stage 1-3 은 bg/ 폴더 개별 PNG (941×1672) → 1080×1920 리사이즈. ──
  //         gameover / gameclear 는 새 자산 미지급으로 sheet_backgrounds 에서 추출 유지.
  console.log('[backgrounds]');
  const bgSrcDir = path.join(RAW, 'bg');
  const bgFiles = [
    { src: 'bg_title.png',    dst: 'bg_title.png'    },
    { src: 'bg_stage01.png',  dst: 'bg_stage_01.png' },
    { src: 'bg_stage02.png',  dst: 'bg_stage_02.png' },
    { src: 'bg_stage03.png',  dst: 'bg_stage_03.png' },
  ];
  const bgOutDir = path.join(OUT, 'backgrounds');
  await fs.mkdir(bgOutDir, { recursive: true });
  for (const b of bgFiles) {
    const final = await sharp(path.join(bgSrcDir, b.src))
      .resize(1080, 1920, { fit: 'fill' })
      .png()
      .toBuffer();
    const out = path.join(bgOutDir, b.dst);
    await fs.writeFile(out, final);
    console.log('  ✓', path.relative(ROOT, out));
  }
  // gameover / gameclear — 기존 sheet 에서 추출 (자산 받으면 위 패턴으로 교체).
  const sheetBgCells = [
    { name: 'bg_gameover',  x: 512,  y: 512 },
    { name: 'bg_gameclear', x: 1024, y: 512 },
  ];
  for (const cell of sheetBgCells) {
    await extractAndSave(
      path.join(SHEETS, 'sheet_backgrounds.png'),
      { left: cell.x, top: cell.y, width: 512, height: 512 },
      path.join(bgOutDir, `${cell.name}.png`),
      { transparent: false, resize: { width: 1080, height: 1920 } },
    );
  }

  // ── 마스코트: 5종 × 4프레임. 입력 파일은 960×240 horizontal strip (각 240×240). ──
  // 소스 파일명(한국어/영어) → AssetLoader 키 매핑.
  // hamster = kongming (제갈공명 햄스터). 매핑은 docs/asset-spec.md 와 일치.
  console.log('[mascots]');
  const MASCOT_FRAME_SIZE = 480; // 240 × 2x 픽셀아트 정수배
  const FRAME_CELL = 240;
  const mascotFiles = [
    { src: 'albatross_4frames.png',  dst: 'albatross'  },
    { src: 'hamster_4frames.png',    dst: 'kongming'   },
    { src: 'snowrabbit_4frames.png', dst: 'snowrabbit' },
    { src: 'reaper_4frames.png',     dst: 'reaper'     },
    { src: 'seraphin_4frames.png',   dst: 'seraphin'   },
  ];
  for (const m of mascotFiles) {
    const sheetPath = path.join(RAW, 'mascots', m.src);
    for (let i = 0; i < 4; i++) {
      await extractMascotFrame(
        sheetPath,
        { left: i * FRAME_CELL, top: 0, width: FRAME_CELL, height: FRAME_CELL },
        path.join(OUT, 'mascots', m.dst, `frame${i}.png`),
        MASCOT_FRAME_SIZE,
      );
    }
  }

  // ── 해금 portrait — 캐러셀 잠금해제 미리보기. 단일 PNG (~1620×971) ──
  // 누끼(flood-fill) + trim + center 처리. 사이즈 900×900 (이전 360 × 2.5).
  // 파일명: unlock_<id>.png (한글 → 영문화). hamster=kongming, snowrabbit=눈토끼, reaper=사신.
  console.log('[portraits]');
  const PORTRAIT_SIZE = 900;
  const portraitFiles = [
    { src: 'unlock_albatross.png',  dst: 'albatross'  },
    { src: 'unlock_hamster.png',    dst: 'kongming'   },
    { src: 'unlock_snowrabbit.png', dst: 'snowrabbit' },
    { src: 'unlock_reaper.png',     dst: 'reaper'     },
    { src: 'unlock_seraphin.png',   dst: 'seraphin'   },
  ];
  for (const p of portraitFiles) {
    const srcPath = path.join(RAW, 'portraits', p.src);
    const meta = await sharp(srcPath).metadata();
    await extractMascotFrame(
      srcPath,
      { left: 0, top: 0, width: meta.width, height: meta.height },
      path.join(OUT, 'portraits', `${p.dst}.png`),
      PORTRAIT_SIZE,
    );
  }

  // ── Slider 스프라이트 — 흰 배경 PNG. flood-fill 누끼 + 리사이즈. ──
  console.log('[slider]');
  const sliderTrackSrc = path.join(RAW, 'slider', 'slider_track.png');
  const sliderKnobSrc  = path.join(RAW, 'slider', 'slider_knob.png');
  const sliderOutDir = path.join(OUT, 'ui');
  await fs.mkdir(sliderOutDir, { recursive: true });
  {
    const buf = await sharp(sliderTrackSrc).png().toBuffer();
    const trans = await whiteFloodFillToTransparent(buf);
    // 800×20 fill (원본 2172×724, 종횡비 무시하고 늘림 — 트랙은 단색 영역이 커서 왜곡 거의 안 보임)
    const final = await sharp(trans).resize(800, 20, { fit: 'fill' }).png().toBuffer();
    const out = path.join(sliderOutDir, 'slider_track.png');
    await fs.writeFile(out, final);
    console.log('  ✓', path.relative(ROOT, out));
  }
  {
    const buf = await sharp(sliderKnobSrc).png().toBuffer();
    const trans = await whiteFloodFillToTransparent(buf);
    // 80×80 (원본 1254×1254 정사각형, 단순 다운스케일)
    const final = await sharp(trans).resize(80, 80, { fit: 'fill' }).png().toBuffer();
    const out = path.join(sliderOutDir, 'slider_knob.png');
    await fs.writeFile(out, final);
    console.log('  ✓', path.relative(ROOT, out));
  }

  // ── Spinner 스프라이트 — 48×48, alpha 누끼됨. cube / triangle 2종. ──
  console.log('[spinners]');
  const spinnerOutDir = path.join(OUT, 'spinners');
  await fs.mkdir(spinnerOutDir, { recursive: true });
  for (const f of ['spinner_cube.png', 'spinner_triangle.png']) {
    await fs.copyFile(path.join(RAW, 'spinners', f), path.join(spinnerOutDir, f));
    console.log('  ✓', path.relative(ROOT, path.join(spinnerOutDir, f)));
  }

  // ── Ball 스프라이트 — 16×16, alpha 누끼됨. ──
  console.log('[ball]');
  const ballSrcDir = path.join(RAW, 'ball');
  const gameplayOutDir = path.join(OUT, 'gameplay');
  await fs.mkdir(gameplayOutDir, { recursive: true });
  await fs.copyFile(path.join(ballSrcDir, 'ball.png'), path.join(gameplayOutDir, 'ball.png'));
  console.log('  ✓', path.relative(ROOT, path.join(gameplayOutDir, 'ball.png')));

  // ── Item 스프라이트 — 흰 배경 1774×887. flood-fill 누끼 + 192×96 으로 다운스케일. ──
  // 게임 표시 사이즈는 24×12 (renderer 에서 setDisplaySize). 큰 사이즈로 저장해 다운스케일 시 매끄럽게.
  console.log('[items]');
  const itemSrcDir = path.join(RAW, 'items');
  for (const f of ['item_expand.png', 'item_magnet.png', 'item_laser.png']) {
    const buf = await sharp(path.join(itemSrcDir, f)).png().toBuffer();
    const trans = await whiteFloodFillToTransparent(buf);
    const final = await sharp(trans).resize(192, 96, { fit: 'fill' }).png().toBuffer();
    const out = path.join(gameplayOutDir, f);
    await fs.writeFile(out, final);
    console.log('  ✓', path.relative(ROOT, out));
  }

  // ── Bar 스프라이트 — 120×16, alpha 누끼됨. 4종 (normal/expand/magnet/laser). ──
  console.log('[bars]');
  const barSrcDir = path.join(RAW, 'bars');
  const barFiles = [
    'bar_normal.png',
    'bar_expand_tint.png',
    'bar_magnet_tint.png',
    'bar_laser_tint.png',
  ];
  const barOutDir = path.join(OUT, 'bars');
  await fs.mkdir(barOutDir, { recursive: true });
  for (const f of barFiles) {
    await fs.copyFile(path.join(barSrcDir, f), path.join(barOutDir, f));
    console.log('  ✓', path.relative(ROOT, path.join(barOutDir, f)));
  }

  // ── Border / Door 스프라이트 — 이미 alpha 누끼 되어있어 단순 복사. ──
  // 소스: border_door_sprites/public/assets/sprites/borders/*.png
  // 출력: public/assets/borders/*.png
  console.log('[borders]');
  const borderSrcDir = path.join(RAW, 'borders');
  const borderFiles = [
    'border_horizontal.png',
    'border_vertical.png',
    'door_closed.png',
    'door_opening_frame0.png',
    'door_opening_frame1.png',
    'door_opening_frame2.png',
    'door_opening_frame3.png',
    'door_opening_frame4.png',
  ];
  const borderOutDir = path.join(OUT, 'borders');
  await fs.mkdir(borderOutDir, { recursive: true });
  for (const f of borderFiles) {
    await fs.copyFile(path.join(borderSrcDir, f), path.join(borderOutDir, f));
    console.log('  ✓', path.relative(ROOT, path.join(borderOutDir, f)));
  }

  // ── 블록 5종 — block/blocks/ 폴더의 개별 PNG (이미 alpha 누끼됨). ──
  // 색상 → 시각 ID 매핑:
  //   mint   → basic        (일반 블록 — 밝고 중립적)
  //   yellow → basic_drop   (드랍 블록 노랑)
  //   blue   → magnet_drop  (자석 효과 파랑)
  //   red    → laser_drop   (레이저 효과 빨강)
  //   purple → tough        (단단함 짙은 보라)
  console.log('[blocks]');
  const blockSrcDir = path.join(RAW, 'blocks');
  const blockMap = [
    { src: 'block_mint.png',   dst: 'block_basic.png'       },
    { src: 'block_yellow.png', dst: 'block_basic_drop.png'  },
    { src: 'block_blue.png',   dst: 'block_magnet_drop.png' },
    { src: 'block_red.png',    dst: 'block_laser_drop.png'  },
    { src: 'block_purple.png', dst: 'block_tough.png'       },
  ];
  const blockOutDir = path.join(OUT, 'blocks');
  await fs.mkdir(blockOutDir, { recursive: true });
  for (const b of blockMap) {
    await fs.copyFile(
      path.join(blockSrcDir, b.src),
      path.join(blockOutDir, b.dst),
    );
    console.log('  ✓', path.relative(ROOT, path.join(blockOutDir, b.dst)));
  }

  // ── Intro story 일러스트 — alpha 누끼 / 리사이즈 없이 단순 복사. ──
  console.log('[intro]');
  const introSrcDir = path.join(RAW, 'intro');
  const introOutDir = path.join(OUT, 'intro');
  await fs.mkdir(introOutDir, { recursive: true });
  for (let i = 1; i <= 4; i++) {
    const f = `intro_story_${String(i).padStart(2, '0')}.png`;
    await fs.copyFile(path.join(introSrcDir, f), path.join(introOutDir, f));
    console.log('  ✓', path.relative(ROOT, path.join(introOutDir, f)));
  }

  console.log('done.');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
