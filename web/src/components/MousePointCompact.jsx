import React, { useState } from 'react';

/**
 * 右侧顶部 Mouse Point（紧凑版）。Switch View 已移至 Operation History 之后。
 * 复刻 OLD resource.rc（IDC_MH_CHECK Show(V) / IDC_M_WIDTH / IDC_M_HEIGHT / IDC_M_SET Decide）：
 * - Show(V)：切换鼠标点十字线/白框显隐
 * - Width / Height：鼠标选区尺寸（默认 20×20，对应 OLD mouse_range_point）
 * - Decide 按钮（IDC_M_SET）：提交手动输入的 Width/Height 作为新选区尺寸
 */
export default function MousePointCompact({ pushHistory, showV, setShowV, size, onApply }) {
  const [internalShowV, setInternalShowV] = useState(true);
  const active = showV !== undefined ? showV : internalShowV;
  const toggle = () => {
    const next = !active;
    if (setShowV) setShowV(next);
    else setInternalShowV(next);
    if (pushHistory) pushHistory(`MousePoint(V) ${next ? 'ON' : 'OFF'}`);
  };

  const w = size ? size.w : 0;
  const h = size ? size.h : 0;

  // 手动输入区：原版允许用户键入 Width/Height 后按 Decide 应用
  const [wInput, setWInput] = useState(20);
  const [hInput, setHInput] = useState(20);
  const onDecide = () => {
    if (onApply) onApply({ w: Math.max(1, wInput | 0), h: Math.max(1, hInput | 0) });
    if (pushHistory) pushHistory(`Decide → ${wInput}x${hInput}`);
  };

  return (
    <fieldset className="mp-compact">
      <legend>Mouse Point</legend>
      <div className="mp-row">
        <button className={`btn btn-xs mp-show-btn${active ? ' active' : ''}`} onClick={toggle}>Show(V)</button>
      </div>
      <div className="mp-input-row">
        <span>Width</span>
        <input type="number" className="mp-num" value={w} readOnly title="当前选区宽度（20×20 默认）" />
      </div>
      <div className="mp-input-row">
        <span>Height</span>
        <input type="number" className="mp-num" value={h} readOnly title="当前选区高度（20×20 默认）" />
      </div>
      <div className="mp-input-row">
        <span>Set</span>
        <input type="number" className="mp-num" value={wInput} onChange={(e) => setWInput(parseInt(e.target.value || '0', 10))} style={{ width: 32 }} />
        <input type="number" className="mp-num" value={hInput} onChange={(e) => setHInput(parseInt(e.target.value || '0', 10))} style={{ width: 32 }} />
        <button className="btn btn-xs" onClick={onDecide} title="原版 Decide 按钮（IDC_M_SET）：应用 W×H 作为新选区">Decide</button>
      </div>
    </fieldset>
  );
}
