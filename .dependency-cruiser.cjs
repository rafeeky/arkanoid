/** @type {import('dependency-cruiser').IConfiguration} */
module.exports = {
  forbidden: [
    // §8-2: gameplay → presentation 금지
    {
      name: 'no-gameplay-to-presentation',
      severity: 'error',
      comment: 'gameplay must not import presentation (architecture §8-2)',
      from: { path: '^src/gameplay/' },
      to: { path: '^src/presentation/' },
    },
    // §8-2: gameplay → audio 금지
    {
      name: 'no-gameplay-to-audio',
      severity: 'error',
      comment: 'gameplay must not import audio (architecture §8-2)',
      from: { path: '^src/gameplay/' },
      to: { path: '^src/audio/' },
    },
    // §8-2: flow → presentation/renderer 금지
    // renderer는 presentation 하위 폴더로 간주
    {
      name: 'no-flow-to-presentation-renderer',
      severity: 'error',
      comment: 'flow must not import presentation renderer (architecture §8-2)',
      from: { path: '^src/flow/' },
      to: { path: '^src/presentation/' },
    },
    // §8-2: definitions → gameplay runtime state 금지
    {
      name: 'no-definitions-to-gameplay',
      severity: 'error',
      comment: 'definitions must not import gameplay (architecture §8-2)',
      from: { path: '^src/definitions/' },
      to: { path: '^src/gameplay/' },
    },
    // §8-2: assets → gameplay 금지
    {
      name: 'no-assets-to-gameplay',
      severity: 'error',
      comment: 'assets must not import gameplay (architecture §8-2)',
      from: { path: '^src/assets/' },
      to: { path: '^src/gameplay/' },
    },
    // §8-2: assets → flow 금지
    {
      name: 'no-assets-to-flow',
      severity: 'error',
      comment: 'assets must not import flow (architecture §8-2)',
      from: { path: '^src/assets/' },
      to: { path: '^src/flow/' },
    },
    // shared는 역참조 금지: shared → 다른 레이어
    {
      name: 'no-shared-to-other-layers',
      severity: 'error',
      comment: 'shared must not import other layers (architecture §8-2)',
      from: { path: '^src/shared/' },
      to: {
        path: '^src/(app|input|flow|gameplay|presentation|audio|persistence|definitions|assets)/',
      },
    },
    // node_modules(Phaser 등 엔진 API) 사용은 presentation/, audio/, input/KeyboardInputSource.ts, app/에서만 허용
    // 다른 레이어에서의 node_modules 직접 import는 error
    // 단, *.test.ts 파일은 예외
    {
      name: 'no-engine-api-outside-adapter-layers',
      severity: 'error',
      comment:
        'node_modules imports are only allowed in presentation/, audio/, input/KeyboardInputSource.ts, and app/ (architecture §Unity 매핑 원칙)',
      from: {
        path: '^src/(flow|gameplay|persistence|definitions|assets|shared)/',
        pathNot: '\\.test\\.ts$',
      },
      to: {
        dependencyTypes: ['npm', 'npm-dev', 'npm-optional', 'npm-peer'],
      },
    },
  ],
  options: {
    doNotFollow: {
      path: 'node_modules',
    },
    tsConfig: {
      fileName: 'tsconfig.json',
    },
    reporterOptions: {
      text: {
        highlightFocused: true,
      },
    },
  },
};
