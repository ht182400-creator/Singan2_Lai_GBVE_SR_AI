import React from 'react';

/**
 * Coordinate File / Function Name File 面板（原 resource.rc 底部右区控件）。
 * 从底栏移入右侧 .rc 容器，支持拖拽/缩放。带标题框便于辨认。
 */
export default function FilePathPanel({ zfilePath, setZfilePath, setActiveDialog, pushHistory }) {
  return (
    <fieldset className="file-path-panel">
      <legend>Coordinate / Function File</legend>
      <div className="fp-row">
        <span className="fp-lbl">Coordinate File:</span>
        <input className="fp-input" value={zfilePath || ''} readOnly />
        <button
          className="btn-tiny"
          onClick={() => { pushHistory('Load Coordinate File'); setActiveDialog('loadCoord'); }}
        >
          Change
        </button>
        <button
          className="btn-tiny"
          onClick={() => { setZfilePath(''); pushHistory('Clear Coordinate File'); }}
        >
          Clear
        </button>
      </div>
      <div className="fp-row">
        <span className="fp-lbl">Function Name File:</span>
        <input className="fp-input" value="functions.txt" readOnly />
        <button
          className="btn-tiny"
          onClick={() => { pushHistory('Load Function Name File'); setActiveDialog('funcName'); }}
        >
          Change port...
        </button>
      </div>
    </fieldset>
  );
}
