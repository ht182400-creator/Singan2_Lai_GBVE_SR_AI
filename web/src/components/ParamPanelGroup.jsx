import React from 'react';

/**
 * 右侧 Image Processing 面板（贴近原始 UI）：
 *  - Sobel 下拉 + 数值
 *  - Binary Segmentation（slider / - / + / Threshold）
 *  - step movement（slider / Movement）
 *  - Noise reduction（MoveAverage + Start）
 *  - Restore Image (M) + Fix Image
 */
export default function ParamPanelGroup({ pushHistory, onProcess, onRestore }) {
  const [sobel, setSobel] = React.useState('Sobel');
  const [sobelVal, setSobelVal] = React.useState(1);
  const [binary, setBinary] = React.useState(39);
  const [step, setStep] = React.useState(0);
  const [noise, setNoise] = React.useState('MoveAverage');
  const [fix, setFix] = React.useState(false);

  // P2：算子防抖应用（滑块拖动时避免请求风暴）
  const timer = React.useRef(null);
  const applyOps = (ops) => {
    if (!onProcess) return;
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => onProcess(ops), 250);
  };
  // gtype：Sobel=0 / Roberts=1 / 其余(Normal/Laplacian/Prewitt)=2（core imageops 约定）
  const gtype = sobel === 'Sobel' ? 0 : sobel === 'Roberts' ? 1 : 2;

  return (
    <fieldset className="param-group-compact">
      <legend>Image Processing</legend>

      <div className="param-sobel-row">
        <span>Sobel</span>
        <select value={sobel} onChange={(e) => { setSobel(e.target.value); applyOps([{ op: 'gradient', gtype: e.target.value === 'Sobel' ? 0 : e.target.value === 'Roberts' ? 1 : 2, amp: sobelVal }]); }}>
          <option>Sobel</option>
          <option>Roberts</option>
          <option>Normal</option>
          <option>Laplacian</option>
          <option>Prewitt</option>
        </select>
        <input
          type="number" min={0} value={sobelVal}
          onChange={(e) => { setSobelVal(Number(e.target.value)); applyOps([{ op: 'gradient', gtype, amp: Number(e.target.value) }]); }}
          className="param-num-xs"
        />
      </div>

      <fieldset className="param-sub-fieldset">
        <legend>Binary Segmentation</legend>
        <div className="param-binary-row">
          <button className="btn btn-xs" onClick={() => { const v = Math.max(0, binary - 1); setBinary(v); applyOps([{ op: 'niti', s: v }]); }}>-</button>
          <input
            type="range" min={0} max={100} value={binary}
            onChange={(e) => { setBinary(Number(e.target.value)); applyOps([{ op: 'niti', s: Number(e.target.value) }]); }}
          />
          <button className="btn btn-xs" onClick={() => { const v = Math.min(100, binary + 1); setBinary(v); applyOps([{ op: 'niti', s: v }]); }}>+</button>
          <input
            type="number" min={0} max={100} value={binary}
            onChange={(e) => { setBinary(Number(e.target.value)); applyOps([{ op: 'niti', s: Number(e.target.value) }]); }}
            className="param-num-sm"
          />
          <span>Threshold</span>
        </div>
      </fieldset>

      <fieldset className="param-sub-fieldset">
        <legend>step movement</legend>
        <div className="param-step-row">
          <button className="btn" onClick={() => setStep(0)}>Default</button>
          <input
            type="number" min={0} max={100} value={step}
            onChange={(e) => setStep(Number(e.target.value))}
            className="param-num-sm"
          />
          <input
            type="range" min={0} max={100} value={step}
            onChange={(e) => setStep(Number(e.target.value))}
          />
          <span>Movement</span>
        </div>
      </fieldset>

      <div className="param-noise-row">
        <span>Noise reduction</span>
        <select value={noise} onChange={(e) => setNoise(e.target.value)}>
          <option>MoveAverage</option>
          <option>MoveAverageMet</option>
          <option>Median</option>
        </select>
        <button className="btn btn-xs" onClick={() => { pushHistory?.('Noise reduction Start'); onProcess?.([{ op: 'smooth' }]); }}>Start</button>
      </div>

      <div className="param-restore-row">
        <button className="btn" onClick={() => { pushHistory?.('Restore Image'); onRestore?.(); }}>Restore Image (M)</button>
        <label><input type="checkbox" checked={fix} onChange={(e) => setFix(e.target.checked)} /> Fix Image</label>
      </div>
    </fieldset>
  );
}