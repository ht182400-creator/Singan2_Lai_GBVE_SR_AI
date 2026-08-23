import React from 'react';

/**
 * 右侧 ATB 区（IDC_ATBFILE/COMBO/IDC_LIST/IDC_LOADSHOW/IDC_ATB_RUN 等）
 * 11 个控件：filename/TH下拉/列表/4 Radio/Clear 4D/Load/Show/Show All/Save/Set 4D
 */
export default function AtbPanel({
  fileName, setFileName, version, setVersion, list, selected, setSelected,
  radioMode, setRadioMode, onContextMenu, pushHistory,
}) {
  return (
    <div className="atb-panel" onContextMenu={onContextMenu}>
      <div className="atb-row1">
        <span className="atb-label">ATB:</span>
        <input className="atb-input" value={fileName} onChange={(e) => setFileName(e.target.value)} />
        <select className="atb-combo" value={version} onChange={(e) => setVersion(e.target.value)}>
          <option>TH1</option><option>TH2</option><option>TH3</option><option>TH4</option>
        </select>
      </div>

      <div className="atb-row2">
        <label><input type="radio" checked={radioMode === 0} onChange={() => setRadioMode(0)} /> Radio1</label>
        <label><input type="radio" checked={radioMode === 1} onChange={() => setRadioMode(1)} /> Radio2</label>
        <label><input type="radio" checked={radioMode === 2} onChange={() => setRadioMode(2)} /> Radio3</label>
        <label><input type="radio" checked={radioMode === 3} onChange={() => setRadioMode(3)} /> Radio4</label>
      </div>

      <div className="atb-list">
        <select multiple size={6} className="atb-listbox" value={selected >= 0 ? [String(selected)] : []}
          onChange={(e) => setSelected(Number(e.target.value))}>
          {list.map((it, i) => (
            <option key={it} value={String(i)}>{it}</option>
          ))}
        </select>
      </div>

      <div className="atb-row3">
        <button className="btn" onClick={() => pushHistory('Clear 4D')}>Clear 4D</button>
        <button className="btn" onClick={() => pushHistory('Load')}>Load</button>
        <button className="btn" onClick={() => pushHistory('Show')}>Show</button>
        <button className="btn" onClick={() => pushHistory('Show All')}>Show All</button>
        <button className="btn" onClick={() => pushHistory('Save')}>Save</button>
        <button className="btn" onClick={() => pushHistory('Set 4D')}>Set 4D</button>
      </div>
    </div>
  );
}
