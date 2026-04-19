// src/editor/EditorUI.ts
// DOM UI 패널 구성 및 이벤트 발행.
// Unity 포팅 시 EditorUIPanel (MonoBehaviour or UI Toolkit Document) 하나로 매핑.
// DOM 조작은 이 파일 안에서만 수행.

import type { EditorState, StageMetadata, BlockTypeId, SpinnerTypeId } from './editorTypes';
import { BLOCK_COLORS, BLOCK_LABELS, SPINNER_COLORS } from './editorTypes';

export type EditorUICallbacks = {
  onSelectBlockType: (type: BlockTypeId) => void;
  onSelectSpinnerType: (type: SpinnerTypeId) => void;
  onExport: () => void;
  onImport: (text: string) => void;
  onClear: () => void;
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

  // 팔레트 버튼 참조
  private blockBtns: Map<BlockTypeId, HTMLButtonElement> = new Map();
  private spinnerBtns: Map<SpinnerTypeId, HTMLButtonElement> = new Map();

  // 메타데이터 입력 참조
  private metaInputs: Partial<Record<keyof StageMetadata, HTMLInputElement>> = {};

  // 텍스트 영역
  private jsonTextarea!: HTMLTextAreaElement;
  private importTextarea!: HTMLTextAreaElement;
  private errorDiv!: HTMLDivElement;

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
    this.root.appendChild(this.buildBlockPalette());
    this.root.appendChild(this.buildSpinnerPanel());
    this.root.appendChild(this.buildMetadataPanel());
    this.root.appendChild(this.buildExportPanel());
    this.root.appendChild(this.buildImportPanel());
    this.root.appendChild(this.buildClearButton());
  }

  private buildTitle(): HTMLElement {
    const el = document.createElement('div');
    el.style.cssText = 'font-size:14px;font-weight:bold;color:#fff;border-bottom:1px solid #444;padding-bottom:8px';
    el.textContent = 'Arkanoid Stage Editor';
    return el;
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

  private buildExportPanel(): HTMLElement {
    const section = this.buildSection('Export JSON');

    this.jsonTextarea = document.createElement('textarea');
    this.jsonTextarea.style.cssText = [
      'width:100%',
      'height:120px',
      'background:#111',
      'border:1px solid #444',
      'color:#8f8',
      'font-family:monospace',
      'font-size:10px',
      'padding:5px',
      'resize:vertical',
      'box-sizing:border-box',
    ].join(';');
    this.jsonTextarea.readOnly = true;
    this.jsonTextarea.placeholder = 'JSON output will appear here';

    const btnRow = document.createElement('div');
    btnRow.style.cssText = 'display:flex;gap:6px';

    const exportBtn = this.makeButton('Export', '#1a7a1a', () => {
      this.callbacks.onExport();
    });

    const copyBtn = this.makeButton('Copy', '#1a4a7a', () => {
      if (this.jsonTextarea.value) {
        navigator.clipboard.writeText(this.jsonTextarea.value).catch(() => {
          this.jsonTextarea.select();
          document.execCommand('copy');
        });
      }
    });

    const downloadBtn = this.makeButton('Download', '#4a3a7a', () => {
      if (!this.jsonTextarea.value) return;
      const blob = new Blob([this.jsonTextarea.value], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'stage.json';
      a.click();
      URL.revokeObjectURL(url);
    });

    btnRow.appendChild(exportBtn);
    btnRow.appendChild(copyBtn);
    btnRow.appendChild(downloadBtn);

    section.appendChild(this.jsonTextarea);
    section.appendChild(btnRow);
    return section;
  }

  private buildImportPanel(): HTMLElement {
    const section = this.buildSection('Import JSON');

    this.importTextarea = document.createElement('textarea');
    this.importTextarea.style.cssText = [
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
    this.importTextarea.placeholder = 'Paste stage JSON here...';

    this.errorDiv = document.createElement('div');
    this.errorDiv.style.cssText = 'font-size:10px;color:#f66;min-height:14px';

    const importBtn = this.makeButton('Import', '#7a3a1a', () => {
      this.callbacks.onImport(this.importTextarea.value);
    });

    section.appendChild(this.importTextarea);
    section.appendChild(this.errorDiv);
    section.appendChild(importBtn);
    return section;
  }

  private buildClearButton(): HTMLElement {
    const btn = this.makeButton('Clear All', '#5a1a1a', () => {
      if (confirm('전체를 초기화합니다. 계속하시겠습니까?')) {
        this.callbacks.onClear();
      }
    });
    btn.style.marginTop = '4px';
    return btn;
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

  // ─── 상태 동기화 ─────────────────────────────────────────────────────────

  syncState(state: Readonly<EditorState>): void {
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

    // 메타데이터 입력 동기화 (포커스 중인 필드는 건드리지 않음)
    const meta = state.metadata;
    for (const [key, input] of Object.entries(this.metaInputs)) {
      if (input === undefined) continue;
      if (document.activeElement === input) continue;
      const val = (meta as Record<string, unknown>)[key];
      input.value = val !== undefined ? String(val) : '';
    }
  }

  // ─── JSON 출력 갱신 ──────────────────────────────────────────────────────

  setJsonOutput(json: string): void {
    this.jsonTextarea.value = json;
  }

  showError(msg: string): void {
    this.errorDiv.textContent = msg;
  }

  clearError(): void {
    this.errorDiv.textContent = '';
  }

  clearImportTextarea(): void {
    this.importTextarea.value = '';
  }
}
