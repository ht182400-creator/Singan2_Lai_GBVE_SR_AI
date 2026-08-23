import React from 'react';

/**
 * 右侧 ParamPanelGroup（紧凑版）：
 *  Gradient + Binary Segmentation + step movement + Noise reduction
 *  每行：[label] [combo] [slider] [value]
 *  底部：Restore Image 按钮 + Fix Image 勾选
 */
function ParamRow({ label, val, setVal, pushHistory }) {
  const cap = label.includes('Gradient') ? 'Gain' : label.includes('Binary') ? 'Threshold' : label.includes('step') ? 'Movement' : 'Start';
  return (
    <div className="param-row">
      <span className="param-row-label">{label}</span>
      <input type="range" min="0" max="100" value={val} onChange={(e) => setVal(Number(e.target.value))} className="param-row-slider" />
      <input type="number" value={val} onChange={(e) => setVal(Number(e.target.value))} className="param-row-val" />
      <span className="param-row-cap">{cap}</span>
    </div>
  );
}

export default function ParamPanelGroup({ pushHistory }) {
  const [v1, setV1] = React.useState(0);
  const [v2, setV2] = React.useState(0);
  const [v3, setV3] = React.useState(0);
  const [v4, setV4] = React.useState(0);
  const [fix, setFix] = React.useState(false);
  return (
    <fieldset className="param-group-compact">
      <legend>Image Processing</legend>
      <ParamRow label="Gradient" val={v1} setVal={setV1} />
      <ParamRow label="Binary Segmentation" val={v2} setVal={setV2} />
      <ParamRow label="step movement" val={v3} setVal={setV3} />
      <ParamRow label="Noise reduction" val={v4} setVal={setV4} />
      <div className="param-restore-row">
        <button className="btn" onClick={() => pushHistory?.('Restore Image')}>Restore Image</button>
        <label><input type="checkbox" checked={fix} onChange={(e) => setFix(e.target.checked)} /> Fix Image</label>
      </div>
    </fieldset>
  );
}