// src/editor/EditorUI.ts
// DOM UI 패널 구성 및 이벤트 발행.
// Unity 포팅 시 EditorUIPanel (MonoBehaviour or UI Toolkit Document) 하나로 매핑.
// DOM 조작은 이 파일 안에서만 수행.

import type { EditorState, StageMetadata, BlockTypeId, SpinnerTypeId } from './editorTypes';
import { BLOCK_COLORS, BLOCK_LABELS, SPINNER_COLORS } from './editorTypes';

export type EditorUICallbacks = {
  onSelectBlockType: (type: BlockTypeId) => void;
  onSelectSpinnerType: (type: SpinnerTypeId) => void;
  onSetActiveStage: (idx: 0 | 1 | 2) => void;
  onExportCurrent: () => void;
  onImportCurrent: (text: string) => void;
  onExportAll: () => void;
  onImportAll: (text: string) => void;
  onClearCurrent: () => void;
  onClearAll: () => void;
  onMetadataChange: (patch: Partial<StageMetadata>) => void;
};

const BLOCK_TYPES: BlockTypeId[] = [
  'basic',
  'basic_drop',
  'magnet_drop',
  'laser_drop',
  'tough',
  'empty',
];

const SPINNER_TYPES: SpinnerTypeId[] = ['spinner_cube', 'spinner_triangle'];

export class EditorUI {
  private readonly root: HTMLElement;
  private readonly callbacks: EditorUICallbacks;

  // 탭 버튼
  private tabBtns: [HTMLButtonElement, HTMLButtonElement, HTMLButtonElement] | null = null;

  // 팔레트 버튼 참조
  private blockBtns: Map<BlockTypeId, HTMLButtonElement> = new Map();
  private spinnerBtns: Map<SpinnerTypeId, HTMLButtonElement> = new Map();

  // 메타데이터 입력 참조
  private metaInputs: Partial<Record<keyof StageMetadata, HTMLInputElement>> = {};

  // 텍스트 영역
  private exportCurrentTextarea!: HTMLTextAreaElement;
  private importCurrentTextarea!: HTMLTextAreaElement;
  private exportAllTextarea!: HTMLTextAreaElement;
  private importAllTextarea!: HTMLTextAreaElement;
  private errorCurrentDiv!: HTMLDivElement;
  private errorAllDiv!: HTMLDivElement;

  constructor(container: HTMLElement, callbacks: EditorUICallbacks) {
    this.callbacks = callbacks;

    this.root = document.createElement('div');
    this.root.style.cssText = [
      'display:flex',
      'flex-direction:column',
      'gap:12px',
      'width:280px',
      'min-width:280px',
      'padding:12px',
      'background:#2a2a2a',
      'overflow-y:auto',
      'font-family:monospace',
      'font-size:12px',
      'color:#ccc',
    ].join(';');

    this.build();
    container.appendChild(this.root);
  }

  // ─── UI 구축 ─────────────────────────────────────────────────────────────

  private build(): void {
    this.root.appendChild(this.buildTitle());
    this.root.appendChild(this.buildStageTabs());
    this.root.appendChild(this.buildBlockPalette());
    this.root.appendChild(this.buildSpinnerPanel());
    this.root.appendChild(this.buildMetadataPanel());
    this.root.appendChild(this.buildExportCurrentPanel());
    this.root.appendChild(this.buildImportCurrentPanel());
    this.root.appendChild(this.buildExportAllPanel());
    this.root.appendChild(this.buildImportAllPanel());
    this.root.appendChild(this.buildClearButtons());
  }

  private buildTitle(): HTMLElement {
    const el = document.createElement('div');
    el.style.cssText = 'font-size:14px;font-weight:bold;color:#fff;border-bottom:1px solid #444;padding-bottom:8px';
    el.textContent = 'Arkanoid Stage Editor';
    return el;
  }

  // ─── 스테이지 탭 ─────────────────────────────────────────────────────────

  private buildStageTabs(): HTMLElement {
    const section = this.buildSection('Stage');

    const row = document.createElement('div');
    row.style.cssText = 'display:flex;gap:4px';

    const tabs = ([0, 1, 2] as const).map((idx) => {
      const btn = document.createElement('button');
      btn.textContent = `STAGE ${idx + 1}`;
      btn.style.cssText = [
        'flex:1',
        'padding:6px 4px',
        'border:1px solid #444',
        'background:#333',
        'color:#aaa',
        'cursor:pointer',
        'font-family:monospace',
        'font-size:11px',
        'border-radius:3px',
        'font-weight:normal',
      ].join(';');
      btn.addEventListener('click', () => this.callbacks.onSetActiveStage(idx));
      row.appendChild(btn);
      return btn;
    }) as [HTMLButtonElement, HTMLButtonElement, HTMLButtonElement];

    this.tabBtns = tabs;
    section.appendChild(row);
    return section;
  }

  private buildSection(title: string): HTMLElement {
    const section = document.createElement('div');
    section.style.cssText = 'display:flex;flex-direction:column;gap:6px';
    const heading = document.createElement('div');
    heading.style.cssText = 'font-size:11px;color:#888;text-transform:uppercase;letter-spacing:1px';
    heading.textContent = title;
    section.appendChild(heading);
    return section;
  }

  private buildBlockPalette(): HTMLElement {
    const section = this.buildSection('Block Palette');
    const grid = document.createElement('div');
    grid.style.cssText = 'display:flex;flex-direction:column;gap:4px';

    for (const type of BLOCK_TYPES) {
      const btn = document.createElement('button');
      btn.style.cssText = [
        'display:flex',
        'align-items:center',
        'gap:8px',
        'padding:5px 8px',
        'border:1px solid #444',
        'background:#333',
        'color:#ccc',
        'cursor:pointer',
        'text-align:left',
        'font-family:monospace',
        'font-size:11px',
        'border-radius:3px',
      ].join(';');

      const swatch = document.createElement('span');
      swatch.style.cssText = `display:inline-block;width:14px;height:14px;background:${BLOCK_COLORS[type]};border:1px solid #666;flex-shrink:0`;

      btn.appendChild(swatch);
      btn.appendChild(document.createTextNode(BLOCK_LABELS[type]));

      btn.addEventListener('click', () => this.callbacks.onSelectBlockType(type));
      this.blockBtns.set(type, btn);
      grid.appendChild(btn);
    }

    section.appendChild(grid);
    return section;
  }

  private buildSpinnerPanel(): HTMLElement {
    const section = this.buildSection('Spinners');
    const hint = document.createElement('div');
    hint.style.cssText = 'font-size:10px;color:#666;margin-bottom:2px';
    hint.textContent = '클릭 후 캔버스에서 위치 지정 / 우클릭 제거 / 드래그 이동';
    section.appendChild(hint);

    const row = document.createElement('div');
    row.style.cssText = 'display:flex;gap:6px';

    for (const type of SPINNER_TYPES) {
      const btn = document.createElement('button');
      btn.style.cssText = [
        'flex:1',
        'padding:6px 4px',
        'border:1px solid #444',
        'background:#333',
        'color:#ccc',
        'cursor:pointer',
        'font-family:monospace',
        'font-size:10px',
        'border-radius:3px',
      ].join(';');

      const label = type === 'spinner_cube' ? 'Cube' : 'Triangle';
      const color = SPINNER_COLORS[type];
      btn.innerHTML = `<span style="color:${color}">${label}</span>`;

      btn.addEventListener('click', () => this.callbacks.onSelectSpinnerType(type));
      this.spinnerBtns.set(type, btn);
      row.appendChild(btn);
    }

    section.appendChild(row);
    return section;
  }

  private buildMetadataPanel(): HTMLElement {
    const section = this.buildSection('Stage Metadata');

    const fields: { key: keyof StageMetadata; label: string; type: string }[] = [
      { key: 'stageId', label: 'Stage ID', type: 'text' },
      { key: 'displayName', label: 'Display Name', type: 'text' },
      { key: 'backgroundId', label: 'Background ID', type: 'text' },
      { key: 'barSpawnX', label: 'Bar Spawn X', type: 'number' },
      { key: 'barSpawnY', label: 'Bar Spawn Y', type: 'number' },
      { key: 'ballSpawnX', label: 'Ball Spawn X', type: 'number' },
      { key: 'ballSpawnY', label: 'Ball Spawn Y', type: 'number' },
      { key: 'ballInitialSpeed', label: 'Ball Speed', type: 'number' },
      { key: 'ballInitialAngleDeg', label: 'Ball Angle°', type: 'number' },
    ];

    for (const field of fields) {
      const row = document.createElement('div');
      row.style.cssText = 'display:flex;align-items:center;gap:6px';

      const label = document.createElement('label');
      label.style.cssText = 'width:100px;font-size:10px;color:#888;flex-shrink:0';
      label.textContent = field.label;

      const input = document.createElement('input');
      input.type = field.type;
      input.style.cssText = [
        'flex:1',
        'background:#1a1a1a',
        'border:1px solid #444',
        'color:#ccc',
        'padding:3px 5px',
        'font-family:monospace',
        'font-size:11px',
        'border-radius:2px',
        'min-width:0',
      ].join(';');

      input.addEventListener('change', () => {
        const patch: Partial<StageMetadata> = {};
        const val = field.type === 'number' ? parseFloat(input.value) : input.value;
        (patch as Record<string, unknown>)[field.key] = val;
        this.callbacks.onMetadataChange(patch);
      });

      this.metaInputs[field.key] = input;

      row.appendChild(label);
      row.appendChild(input);
      section.appendChild(row);
    }

    return section;
  }

  // ─── Export Current ────────────────────────────────────────────────────────

  private buildExportCurrentPanel(): HTMLElement {
    const section = this.buildSection('Export Current Stage');

    this.exportCurrentTextarea = document.createElement('textarea');
    this.exportCurrentTextarea.style.cssText = [
      'width:100%',
      'height:100px',
      'background:#111',
      'border:1px solid #444',
      'color:#8f8',
      'font-family:monospace',
      'font-size:10px',
      'padding:5px',
      'resize:vertical',
      'box-sizing:border-box',
    ].join(';');
    this.exportCurrentTextarea.readOnly = true;
    this.exportCurrentTextarea.placeholder = 'Current stage JSON...';

    const btnRow = document.createElement('div');
    btnRow.style.cssText = 'display:flex;gap:6px';

    const exportBtn = this.makeButton('Export Current', '#1a7a1a', () => {
      this.callbacks.onExportCurrent();
    });

    const copyBtn = this.makeButton('Copy', '#1a4a7a', () => {
      if (this.exportCurrentTextarea.value) {
        this.copyToClipboard(this.exportCurrentTextarea);
      }
    });

    btnRow.appendChild(exportBtn);
    btnRow.appendChild(copyBtn);
    section.appendChild(this.exportCurrentTextarea);
    section.appendChild(btnRow);
    return section;
  }

  // ─── Import Current ───────────────────────────────────────────────────────

  private buildImportCurrentPanel(): HTMLElement {
    const section = this.buildSection('Import Current Stage');

    this.importCurrentTextarea = document.createElement('textarea');
    this.importCurrentTextarea.style.cssText = [
      'width:100%',
      'height:80px',
      'background:#111',
      'border:1px solid #444',
      'color:#adf',
      'font-family:monospace',
      'font-size:10px',
      'padding:5px',
      'resize:vertical',
      'box-sizing:border-box',
    ].join(';');
    this.importCurrentTextarea.placeholder = 'Paste single stage JSON here...';

    this.errorCurrentDiv = document.createElement('div');
    this.errorCurrentDiv.style.cssText = 'font-size:10px;color:#f66;min-height:14px';

    const importBtn = this.makeButton('Import Current', '#7a3a1a', () => {
      this.callbacks.onImportCurrent(this.importCurrentTextarea.value);
    });

    section.appendChild(this.importCurrentTextarea);
    section.appendChild(this.errorCurrentDiv);
    section.appendChild(importBtn);
    return section;
  }

  // ─── Export All ───────────────────────────────────────────────────────────

  private buildExportAllPanel(): HTMLElement {
    const section = this.buildSection('Export All Stages');

    this.exportAllTextarea = document.createElement('textarea');
    this.exportAllTextarea.style.cssText = [
      'width:100%',
      'height:100px',
      'background:#111',
      'border:1px solid #2a4a2a',
      'color:#afa',
      'font-family:monospace',
      'font-size:10px',
      'padding:5px',
      'resize:vertical',
      'box-sizing:border-box',
    ].join(';');
    this.exportAllTextarea.readOnly = true;
    this.exportAllTextarea.placeholder = 'All stages JSON array...';

    const btnRow = document.createElement('div');
    btnRow.style.cssText = 'display:flex;gap:6px';

    const exportAllBtn = this.makeButton('Export All', '#2a5a2a', () => {
      this.callbacks.onExportAll();
    });

    const copyAllBtn = this.makeButton('Copy', '#1a4a7a', () => {
      if (this.exportAllTextarea.value) {
        this.copyToClipboard(this.exportAllTextarea);
      }
    });

    const downloadAllBtn = this.makeButton('Download', '#4a3a7a', () => {
      if (!this.exportAllTextarea.value) return;
      const blob = new Blob([this.exportAllTextarea.value], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'all_stages.json';
      a.click();
      URL.revokeObjectURL(url);
    });

    btnRow.appendChild(exportAllBtn);
    btnRow.appendChild(copyAllBtn);
    btnRow.appendChild(downloadAllBtn);

    section.appendChild(this.exportAllTextarea);
    section.appendChild(btnRow);
    return section;
  }

  // ─── Import All ───────────────────────────────────────────────────────────

  private buildImportAllPanel(): HTMLElement {
    const section = this.buildSection('Import All Stages');

    const hint = document.createElement('div');
    hint.style.cssText = 'font-size:10px;color:#666';
    hint.textContent = '[ {...stage1}, {...stage2}, {...stage3} ] 배열 형식';
    section.appendChild(hint);

    this.importAllTextarea = document.createElement('textarea');
    this.importAllTextarea.style.cssText = [
      'width:100%',
      'height:80px',
      'background:#111',
      'border:1px solid #2a4a2a',
      'color:#cfc',
      'font-family:monospace',
      'font-size:10px',
      'padding:5px',
      'resize:vertical',
      'box-sizing:border-box',
    ].join(';');
    this.importAllTextarea.placeholder = 'Paste all-stages JSON array here...';

    this.errorAllDiv = document.createElement('div');
    this.errorAllDiv.style.cssText = 'font-size:10px;color:#f66;min-height:14px';

    const importAllBtn = this.makeButton('Import All', '#2a5a2a', () => {
      this.callbacks.onImportAll(this.importAllTextarea.value);
    });

    section.appendChild(this.importAllTextarea);
    section.appendChild(this.errorAllDiv);
    section.appendChild(importAllBtn);
    return section;
  }

  // ─── Clear buttons ────────────────────────────────────────────────────────

  private buildClearButtons(): HTMLElement {
    const wrapper = document.createElement('div');
    wrapper.style.cssText = 'display:flex;flex-direction:column;gap:6px;margin-top:4px;border-top:1px solid #333;padding-top:8px';

    const clearCurrentBtn = this.makeButton('Clear Current Stage', '#5a3a1a', () => {
      if (confirm('현재 스테이지를 초기화합니다. 계속하시겠습니까?')) {
        this.callbacks.onClearCurrent();
      }
    });

    const clearAllBtn = this.makeButton('Clear All Stages', '#5a1a1a', () => {
      if (confirm('3개 스테이지를 모두 초기화합니다. 계속하시겠습니까?')) {
        this.callbacks.onClearAll();
      }
    });

    wrapper.appendChild(clearCurrentBtn);
    wrapper.appendChild(clearAllBtn);
    return wrapper;
  }

  private makeButton(
    label: string,
    bg: string,
    onClick: () => void,
  ): HTMLButtonElement {
    const btn = document.createElement('button');
    btn.textContent = label;
    btn.style.cssText = [
      `background:${bg}`,
      'border:1px solid #555',
      'color:#ccc',
      'padding:5px 10px',
      'cursor:pointer',
      'font-family:monospace',
      'font-size:11px',
      'border-radius:3px',
      'flex:1',
    ].join(';');
    btn.addEventListener('click', onClick);
    return btn;
  }

  private copyToClipboard(textarea: HTMLTextAreaElement): void {
    navigator.clipboard.writeText(textarea.value).catch(() => {
      textarea.select();
      document.execCommand('copy');
    });
  }

  // ─── 상태 동기화 ─────────────────────────────────────────────────────────

  syncState(state: Readonly<EditorState>): void {
    // 탭 하이라이트
    if (this.tabBtns !== null) {
      const tabs = this.tabBtns;
      ([0, 1, 2] as const).forEach((i) => {
        const btn = tabs[i];
        const isActive = state.activeStageIndex === i;
        btn.style.borderColor = isActive ? '#ffcc00' : '#444';
        btn.style.background = isActive ? '#443300' : '#333';
        btn.style.color = isActive ? '#ffcc00' : '#aaa';
        btn.style.fontWeight = isActive ? 'bold' : 'normal';
      });
    }

    // 블록 팔레트 하이라이트
    for (const [type, btn] of this.blockBtns) {
      const isActive = !state.isSpinnerPlacementMode && state.selectedBlockType === type;
      btn.style.borderColor = isActive ? '#fff' : '#444';
      btn.style.background = isActive ? '#555' : '#333';
    }

    // 스피너 버튼 하이라이트
    for (const [type, btn] of this.spinnerBtns) {
      const isActive = state.isSpinnerPlacementMode && state.selectedSpinnerType === type;
      btn.style.borderColor = isActive ? '#ffff00' : '#444';
      btn.style.background = isActive ? '#443300' : '#333';
    }

    // 활성 스테이지의 메타데이터로 입력 필드 동기화
    const meta = state.stages[state.activeStageIndex].metadata;
    for (const [key, input] of Object.entries(this.metaInputs)) {
      if (input === undefined) continue;
      if (document.activeElement === input) continue;
      const val = (meta as Record<string, unknown>)[key];
      input.value = val !== undefined ? String(val) : '';
    }
  }

  // ─── JSON 출력 갱신 ──────────────────────────────────────────────────────

  setCurrentJsonOutput(json: string): void {
    this.exportCurrentTextarea.value = json;
  }

  setAllJsonOutput(json: string): void {
    this.exportAllTextarea.value = json;
  }

  showCurrentError(msg: string): void {
    this.errorCurrentDiv.textContent = msg;
  }

  clearCurrentError(): void {
    this.errorCurrentDiv.textContent = '';
  }

  clearCurrentImportTextarea(): void {
    this.importCurrentTextarea.value = '';
  }

  showAllError(msg: string): void {
    this.errorAllDiv.textContent = msg;
  }

  clearAllError(): void {
    this.errorAllDiv.textContent = '';
  }

  clearAllImportTextarea(): void {
    this.importAllTextarea.value = '';
  }
}
