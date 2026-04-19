// src/editor/main.ts
// 에디터 엔트리포인트. EditorApp, EditorCanvas, EditorUI를 조립한다.
// 이벤트 리스너 연결은 이 파일에서만 수행.
// Unity 포팅 시 씬 진입점(Start 메서드나 Bootstrap)에 대응.

import { EditorApp } from './EditorApp';
import { EditorCanvas } from './EditorCanvas';
import { EditorUI } from './EditorUI';

function bootstrap(): void {
  const appRoot = document.getElementById('editor');
  if (appRoot === null) {
    throw new Error('#editor element not found');
  }

  // 레이아웃: 가로 배치 (캔버스 + 사이드 패널)
  appRoot.style.cssText = [
    'display:flex',
    'flex-direction:row',
    'gap:0',
    'height:100vh',
    'background:#1a1a1a',
    'overflow:hidden',
  ].join(';');

  // ─── 컴포넌트 생성 ────────────────────────────────────────────────────

  const canvasContainer = document.createElement('div');
  canvasContainer.style.cssText = [
    'display:flex',
    'align-items:flex-start',
    'justify-content:center',
    'padding:16px',
    'flex:1',
    'overflow:auto',
    'background:#1a1a1a',
  ].join(';');
  appRoot.appendChild(canvasContainer);

  const sidePanel = document.createElement('div');
  sidePanel.style.cssText = 'overflow-y:auto;height:100vh;border-left:1px solid #333';
  appRoot.appendChild(sidePanel);

  // ─── 상태 변경 시 리렌더 ──────────────────────────────────────────────

  const app = new EditorApp(() => {
    canvas.render(app.getState());
    ui.syncState(app.getState());
  });

  const canvas = new EditorCanvas(canvasContainer);

  const ui = new EditorUI(sidePanel, {
    onSetActiveStage: (idx) => {
      app.setActiveStageIndex(idx);
    },
    onSelectBlockType: (type) => {
      app.selectBlockType(type);
    },
    onSelectSpinnerType: (type) => {
      app.enterSpinnerPlacementMode(type);
    },

    // 현재 스테이지 export
    onExportCurrent: () => {
      const json = app.exportCurrentJson();
      ui.setCurrentJsonOutput(json);
    },

    // 현재 스테이지 import
    onImportCurrent: (text) => {
      const result = app.importCurrentJson(text);
      if (result.ok) {
        ui.clearCurrentError();
        ui.clearCurrentImportTextarea();
        ui.setCurrentJsonOutput('');
      } else {
        ui.showCurrentError(result.error);
      }
    },

    // 전체 스테이지 export
    onExportAll: () => {
      const json = app.exportAllJson();
      ui.setAllJsonOutput(json);
    },

    // 전체 스테이지 import
    onImportAll: (text) => {
      const result = app.importAllJson(text);
      if (result.ok) {
        ui.clearAllError();
        ui.clearAllImportTextarea();
        ui.setAllJsonOutput('');
      } else {
        ui.showAllError(result.error);
      }
    },

    // 현재 스테이지 초기화
    onClearCurrent: () => {
      app.clearCurrentStage();
      ui.setCurrentJsonOutput('');
      ui.clearCurrentError();
    },

    // 전체 스테이지 초기화
    onClearAll: () => {
      app.clearAllStages();
      ui.setCurrentJsonOutput('');
      ui.setAllJsonOutput('');
      ui.clearCurrentError();
      ui.clearAllError();
    },

    onMetadataChange: (patch) => {
      app.updateMetadata(patch);
    },
  });

  // ─── 캔버스 이벤트 연결 ──────────────────────────────────────────────

  canvas.onMouseDown((cx, cy, button) => {
    if (button === 2) return; // 우클릭은 contextmenu 이벤트로 처리

    const state = app.getState();

    if (state.isDraggingSpinner) return;

    // 스피너 배치 모드
    if (state.isSpinnerPlacementMode) {
      app.handleCanvasClick(cx, cy);
      return;
    }

    // 스피너 드래그 시작 시도
    const spinnerId = app.hitTestSpinner(cx, cy);
    if (spinnerId !== null) {
      app.startDragSpinner(spinnerId, cx, cy);
      return;
    }

    // 블록 배치/제거
    app.handleCanvasClick(cx, cy);
  });

  canvas.onMouseMove((cx, cy) => {
    if (app.getState().isDraggingSpinner) {
      app.dragSpinner(cx, cy);
    }
  });

  canvas.onMouseUp(() => {
    if (app.getState().isDraggingSpinner) {
      app.endDragSpinner();
    }
  });

  canvas.onContextMenu((cx, cy) => {
    const state = app.getState();

    // 스피너 배치 모드 취소
    if (state.isSpinnerPlacementMode) {
      app.exitSpinnerPlacementMode();
      return;
    }

    // 스피너 우클릭 제거
    const spinnerId = app.hitTestSpinner(cx, cy);
    if (spinnerId !== null) {
      app.removeSpinner(spinnerId);
    }
  });

  // ─── 초기 렌더 ───────────────────────────────────────────────────────

  canvas.render(app.getState());
  ui.syncState(app.getState());
}

bootstrap();
