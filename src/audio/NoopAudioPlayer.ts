import type { IAudioPlayer } from './IAudioPlayer';
import type { AudioCueEntry } from '../definitions/types/AudioCueEntry';

/**
 * NoopAudioPlayer — 아무 동작도 하지 않는 IAudioPlayer 구현체.
 *
 * 사용 목적:
 * - 테스트 환경 (Phaser 없음)
 * - AppContext 생성 시 PhaserAudioPlayer 준비 전 기본값
 * - 헤드리스 서버 환경
 *
 * Unity 매핑: NullAudioAdapter — 에디터 테스트용 빈 구현체에 해당.
 */
export class NoopAudioPlayer implements IAudioPlayer {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  play(_cue: AudioCueEntry): void {
    // 의도적으로 아무 동작 없음
  }

  stopAll(): void {
    // 의도적으로 아무 동작 없음
  }
}
