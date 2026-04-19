/**
 * AssetCatalog — resourceId → 실제 파일 경로 매핑.
 *
 * Definition 계층(AudioCueTable 등)은 resourceId만 보유하고,
 * 실제 파일 경로나 URL은 이 카탈로그만 안다.
 *
 * Phase 9: Audio 리소스만 등록. 시각 에셋은 placeholder 그래픽 단계이므로 미등록.
 *
 * Unity 매핑: Resources/Addressables 경로 매핑 ScriptableObject에 해당.
 */
export const AssetCatalog: Readonly<Record<string, string>> = {
  // BGM
  bgm_title: 'assets/sfx/bgm_title.wav',

  // 징글
  jingle_round_start: 'assets/sfx/jingle_round_start.wav',
  jingle_gameover: 'assets/sfx/jingle_gameover.wav',

  // SFX
  sfx_block_hit: 'assets/sfx/sfx_block_hit.wav',
  sfx_block_destroyed: 'assets/sfx/sfx_block_destroyed.wav',
  sfx_item_collected: 'assets/sfx/sfx_item_collected.wav',
  sfx_life_lost: 'assets/sfx/sfx_life_lost.wav',
  sfx_ui_confirm: 'assets/sfx/sfx_ui_confirm.wav',
} as const;
