/**
 * generate-placeholder-sounds.mjs
 *
 * Node.js로 짧은 beep WAV 파일 8개를 생성한다.
 * 각 cue에 맞는 서로 다른 주파수/길이로 구분한다.
 *
 * 실행: node scripts/generate-placeholder-sounds.mjs
 * 출력: public/assets/sfx/*.wav
 */

import { writeFileSync, mkdirSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const OUTPUT_DIR = join(__dirname, '..', 'public', 'assets', 'sfx');

mkdirSync(OUTPUT_DIR, { recursive: true });

const SAMPLE_RATE = 44100;

/**
 * WAV PCM 헤더를 생성한다.
 * @param {number} numSamples - 샘플 수
 * @param {number} sampleRate - 샘플레이트 (Hz)
 * @param {number} numChannels - 채널 수 (1=mono)
 * @param {number} bitsPerSample - 비트 깊이 (16)
 */
function buildWavHeader(numSamples, sampleRate, numChannels, bitsPerSample) {
  const byteRate = sampleRate * numChannels * (bitsPerSample / 8);
  const blockAlign = numChannels * (bitsPerSample / 8);
  const dataSize = numSamples * numChannels * (bitsPerSample / 8);
  const totalSize = 36 + dataSize;

  const buf = Buffer.alloc(44);
  // RIFF chunk
  buf.write('RIFF', 0);
  buf.writeUInt32LE(totalSize, 4);
  buf.write('WAVE', 8);
  // fmt sub-chunk
  buf.write('fmt ', 12);
  buf.writeUInt32LE(16, 16);        // sub-chunk size
  buf.writeUInt16LE(1, 20);         // PCM format
  buf.writeUInt16LE(numChannels, 22);
  buf.writeUInt32LE(sampleRate, 24);
  buf.writeUInt32LE(byteRate, 28);
  buf.writeUInt16LE(blockAlign, 32);
  buf.writeUInt16LE(bitsPerSample, 34);
  // data sub-chunk
  buf.write('data', 36);
  buf.writeUInt32LE(dataSize, 40);

  return buf;
}

/**
 * 단순 사인파 beep WAV 버퍼를 생성한다.
 * @param {number} frequency - 주파수 (Hz)
 * @param {number} durationMs - 재생 시간 (ms)
 * @param {number} amplitude - 진폭 (0~1)
 * @param {string} shape - 'sine' | 'decay' (decay: 끝으로 갈수록 페이드아웃)
 */
function generateBeepWav(frequency, durationMs, amplitude = 0.5, shape = 'sine') {
  const numSamples = Math.floor(SAMPLE_RATE * durationMs / 1000);
  const header = buildWavHeader(numSamples, SAMPLE_RATE, 1, 16);
  const pcmData = Buffer.alloc(numSamples * 2);

  for (let i = 0; i < numSamples; i++) {
    const t = i / SAMPLE_RATE;
    const angle = 2 * Math.PI * frequency * t;
    let sample = Math.sin(angle);

    // 페이드인/아웃 envelope
    const progress = i / numSamples;
    let env = 1.0;
    if (shape === 'decay') {
      env = 1 - progress;
    } else {
      // 짧은 페이드인 (5%) + 페이드아웃 (15%)
      if (progress < 0.05) env = progress / 0.05;
      else if (progress > 0.85) env = (1 - progress) / 0.15;
    }

    const value = Math.round(sample * amplitude * env * 32767);
    pcmData.writeInt16LE(Math.max(-32768, Math.min(32767, value)), i * 2);
  }

  return Buffer.concat([header, pcmData]);
}

/**
 * 두 주파수를 순서대로 재생하는 2음 beep WAV.
 * 징글류에 사용.
 */
function generateDoubleBeepWav(freq1, freq2, dur1Ms, dur2Ms, amplitude = 0.5) {
  const n1 = Math.floor(SAMPLE_RATE * dur1Ms / 1000);
  const n2 = Math.floor(SAMPLE_RATE * dur2Ms / 1000);
  const numSamples = n1 + n2;
  const header = buildWavHeader(numSamples, SAMPLE_RATE, 1, 16);
  const pcmData = Buffer.alloc(numSamples * 2);

  for (let i = 0; i < numSamples; i++) {
    const freq = i < n1 ? freq1 : freq2;
    const localI = i < n1 ? i : i - n1;
    const localN = i < n1 ? n1 : n2;
    const t = localI / SAMPLE_RATE;
    const angle = 2 * Math.PI * freq * t;
    let sample = Math.sin(angle);
    const progress = localI / localN;
    let env = 1.0;
    if (progress < 0.05) env = progress / 0.05;
    else if (progress > 0.85) env = (1 - progress) / 0.15;
    const value = Math.round(sample * amplitude * env * 32767);
    pcmData.writeInt16LE(Math.max(-32768, Math.min(32767, value)), i * 2);
  }

  return Buffer.concat([header, pcmData]);
}

/**
 * 여러 주파수를 순서대로 재생하는 다중 음 WAV.
 * GameClear 징글 등 상행 시퀀스에 사용.
 * @param {Array<{freq: number, durationMs: number}>} notes
 * @param {number} amplitude
 */
function generateSequenceWav(notes, amplitude = 0.5) {
  const segments = notes.map((note) => ({
    n: Math.floor(SAMPLE_RATE * note.durationMs / 1000),
    freq: note.freq,
  }));
  const numSamples = segments.reduce((sum, s) => sum + s.n, 0);
  const header = buildWavHeader(numSamples, SAMPLE_RATE, 1, 16);
  const pcmData = Buffer.alloc(numSamples * 2);

  let offset = 0;
  for (const seg of segments) {
    for (let i = 0; i < seg.n; i++) {
      const t = i / SAMPLE_RATE;
      const angle = 2 * Math.PI * seg.freq * t;
      let sample = Math.sin(angle);
      const progress = i / seg.n;
      let env = 1.0;
      if (progress < 0.05) env = progress / 0.05;
      else if (progress > 0.85) env = (1 - progress) / 0.15;
      const value = Math.round(sample * amplitude * env * 32767);
      pcmData.writeInt16LE(Math.max(-32768, Math.min(32767, value)), (offset + i) * 2);
    }
    offset += seg.n;
  }

  return Buffer.concat([header, pcmData]);
}

// -------------------------------------------------------------------
// 각 cue에 맞는 소리 정의
// ResourceId 기준으로 파일명을 결정한다 (AssetCatalog.ts와 일치)
// -------------------------------------------------------------------
const sounds = [
  {
    filename: 'bgm_title.wav',
    description: '타이틀 BGM (낮고 긴 루프 beep)',
    generate: () => generateBeepWav(220, 2000, 0.35, 'sine'),
  },
  {
    filename: 'jingle_round_start.wav',
    description: 'Round Start 징글 (상승 2음)',
    generate: () => generateDoubleBeepWav(523, 784, 200, 300, 0.5),
  },
  {
    filename: 'jingle_gameover.wav',
    description: 'GameOver 징글 (하강 2음)',
    generate: () => generateDoubleBeepWav(440, 294, 250, 350, 0.5),
  },
  {
    filename: 'sfx_block_hit.wav',
    description: '블록 피격 SFX (짧고 높은 beep)',
    generate: () => generateBeepWav(880, 60, 0.4, 'decay'),
  },
  {
    filename: 'sfx_block_destroyed.wav',
    description: '블록 파괴 SFX (중간 높이, 약간 길게)',
    generate: () => generateBeepWav(660, 120, 0.45, 'decay'),
  },
  {
    filename: 'sfx_item_collected.wav',
    description: '아이템 획득 SFX (높고 밝은 beep)',
    generate: () => generateDoubleBeepWav(784, 1047, 80, 120, 0.5),
  },
  {
    filename: 'sfx_life_lost.wav',
    description: '라이프 손실 SFX (낮고 내려가는 beep)',
    generate: () => generateBeepWav(220, 400, 0.5, 'decay'),
  },
  {
    filename: 'sfx_ui_confirm.wav',
    description: 'UI 확인 SFX (짧고 깔끔한 beep)',
    generate: () => generateBeepWav(698, 80, 0.4, 'decay'),
  },
  {
    filename: 'jingle_gameclear.wav',
    description: 'GameClear 징글 (C→E→G→C 상행 4음, 약 1000ms)',
    generate: () => generateSequenceWav([
      { freq: 523,  durationMs: 200 }, // C5
      { freq: 659,  durationMs: 200 }, // E5
      { freq: 784,  durationMs: 200 }, // G5
      { freq: 1047, durationMs: 400 }, // C6 (길게 마무리)
    ], 0.5),
  },
  {
    filename: 'sfx_ball_attached.wav',
    description: '자석 공 부착 SFX (낮은 흡착음, 짧은 하강 beep)',
    generate: () => generateBeepWav(330, 100, 0.45, 'decay'),
  },
  {
    filename: 'sfx_balls_released.wav',
    description: '자석 공 해제 SFX (중간 높이, 짧고 밝은 beep)',
    generate: () => generateDoubleBeepWav(440, 660, 80, 100, 0.45),
  },
  {
    filename: 'sfx_laser_fired.wav',
    description: '레이저 발사 SFX (높고 짧은 beep)',
    generate: () => generateBeepWav(1200, 60, 0.4, 'decay'),
  },
];

let generated = 0;
for (const sound of sounds) {
  const filePath = join(OUTPUT_DIR, sound.filename);
  const wavBuffer = sound.generate();
  writeFileSync(filePath, wavBuffer);
  console.log(`  [OK] ${sound.filename} — ${sound.description} (${wavBuffer.length} bytes)`);
  generated++;
}

console.log(`\n총 ${generated}개 파일 생성 완료 → ${OUTPUT_DIR}`);
