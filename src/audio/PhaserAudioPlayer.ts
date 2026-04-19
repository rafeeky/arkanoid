import type Phaser from 'phaser';
import type { IAudioPlayer } from './IAudioPlayer';
import type { AudioCueEntry } from '../definitions/types/AudioCueEntry';
import type { AssetResolver } from '../assets/AssetResolver';

/**
 * PhaserAudioPlayer — Phaser.Sound API를 사용하는 IAudioPlayer 구현체.
 *
 * 생명주기:
 * 1. preload(scene, table): Scene.preload 단계에서 audio 파일 로드 등록
 * 2. create(scene, table): Scene.create 단계에서 sound 인스턴스 등록
 * 3. play(cue): 이벤트 발생 시 cue 재생
 *
 * BGM 전환 정책:
 * - 새 bgm 재생 전 기존 bgm stop
 * - 이미 재생 중인 bgm이면 skip (중복 재생 방지)
 *
 * Unity 매핑: AudioSource Adapter MonoBehaviour.
 * AudioSource 를 직접 래핑하고, BGM/SFX 채널을 분리하는 AudioBridge에 해당.
 */
export class PhaserAudioPlayer implements IAudioPlayer {
  private scene: Phaser.Scene | null = null;
  private readonly assetResolver: AssetResolver;
  private readonly soundMap = new Map<string, Phaser.Sound.BaseSound>();
  private currentBgmCueId: string | null = null;

  constructor(assetResolver: AssetResolver) {
    this.assetResolver = assetResolver;
  }

  /**
   * preload 단계에서 AudioCueTable 전체를 scene.load.audio 에 등록한다.
   * resourceId → 파일 경로 해석은 AssetResolver 경유.
   */
  preload(scene: Phaser.Scene, table: readonly AudioCueEntry[]): void {
    for (const entry of table) {
      const path = this.assetResolver.resolve(entry.resourceId);
      if (path) {
        scene.load.audio(entry.cueId, path);
      }
    }
  }

  /**
   * create 단계에서 scene.sound.add 로 사운드 인스턴스를 등록한다.
   * soundMap에 cueId → BaseSound 매핑을 유지한다.
   */
  create(scene: Phaser.Scene, table: readonly AudioCueEntry[]): void {
    this.scene = scene;
    for (const entry of table) {
      if (!this.soundMap.has(entry.cueId)) {
        const sound = scene.sound.add(entry.cueId);
        this.soundMap.set(entry.cueId, sound);
      }
    }
  }

  play(cue: AudioCueEntry): void {
    if (!this.scene) {
      return;
    }

    const sound = this.soundMap.get(cue.cueId);
    if (!sound) {
      return;
    }

    if (cue.playbackType === 'bgm') {
      // 이미 같은 bgm이 재생 중이면 skip
      if (this.currentBgmCueId === cue.cueId && sound.isPlaying) {
        return;
      }
      // 기존 bgm 정지
      if (this.currentBgmCueId && this.currentBgmCueId !== cue.cueId) {
        const prevBgm = this.soundMap.get(this.currentBgmCueId);
        if (prevBgm && prevBgm.isPlaying) {
          prevBgm.stop();
        }
      }
      this.currentBgmCueId = cue.cueId;
      sound.play({ loop: true });
    } else {
      // jingle / sfx: 1회 재생
      sound.play();
    }
  }

  stopAll(): void {
    if (!this.scene) {
      return;
    }
    this.scene.sound.stopAll();
    this.currentBgmCueId = null;
  }
}
