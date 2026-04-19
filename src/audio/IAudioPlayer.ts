import type { AudioCueEntry } from '../definitions/types/AudioCueEntry';

/**
 * IAudioPlayer — 오디오 재생 추상화 인터페이스.
 *
 * Audio Playback 계층의 핵심 계약.
 * 구현체: NoopAudioPlayer (테스트/헤드리스), PhaserAudioPlayer (브라우저).
 *
 * Unity 매핑: AudioSource Adapter 인터페이스에 대응.
 */
export interface IAudioPlayer {
  /**
   * 주어진 cue를 재생한다.
   * playbackType에 따라 bgm/jingle/sfx 로직이 분기된다.
   */
  play(cue: AudioCueEntry): void;

  /** 현재 재생 중인 모든 소리를 정지한다. */
  stopAll(): void;
}
