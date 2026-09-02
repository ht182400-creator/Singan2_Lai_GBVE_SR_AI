import React from 'react';

/**
 * 右侧 Image Processing 面板：1:1 复刻 OLD resource.rc 布局与参数
 * - Gradient（Sobel/Roberts/Normal/Laplacian/Prewitt）+ 利得 Gain（1..50，默认 1）
 * - Binary Segmentation（Gra+Bin/Bin/NiBlack）+ 阈值 Threshold（0..255，默认 90）
 * - step movement（Default + Movement，slider 0..300，显示值 = slider-150，默认 0）
 * - Noise reduction（MoveAverage/Median）+ Start
 * - Restore Image (M) + Fix Image
 *
 * 每次参数变化都会把当前完整算子管线传给 onProcess(ops)（debounce 250ms）。
 */
const GRAD_TYPES = ['Sobel', 'Roberts', 'Normal', 'Laplacian', 'Prewitt'];
const NITI_TYPES = ['Gra+Bin', 'Bin', 'NiBlack'];
const NOISE_TYPES = ['MoveAverage', 'Median'];

export default function ParamPanelGroup({ pushHistory, onProcess, onRestore, threshold: thresholdProp, onThresholdChange, onParamsChange } ) {
  const [gradType, setGradType] = React.useState('Sobel'); // 对应 IDC_COMBO_GRADIENT
  const [gain, setGain] = React.useState(1);               // 对应 IDC_GRADIENT_RITOKU_BOX / IDC_SLIDER_GRADIENT（1..50）
  const [nitiType, setNitiType] = React.useState('Gra+Bin'); // 对应 IDC_COMBO_NITI
  // 阈值：优先使用 App 提升后的受控值（threshold/onThresholdChange），未传时回落到内部状态
  const [innerThreshold, setInnerThreshold] = React.useState(90); // 对应 IDC_NITI_SIKI_BOX / IDC_SLIDER_NITI（0..255）
  const threshold = thresholdProp !== undefined ? thresholdProp : innerThreshold;
  const setThreshold = onThresholdChange || setInnerThreshold;
  const [colorPos, setColorPos] = React.useState(150);     // 对应 IDC_SLIDER_COLOR（0..300，默认 150 → 显示 0）
  const [noiseType, setNoiseType] = React.useState('MoveAverage'); // 对应 IDC_COMBO_ZATUON
  const [fix, setFix] = React.useState(false);             // 对应 IDC_HOJI

  const timer = React.useRef(null);
  const applyOps = React.useCallback((ops) => {
    if (!onProcess) return;
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => onProcess(ops), 250);
  }, [onProcess]);

  // 根据当前 UI 状态构造完整算子管线
  const buildOps = React.useCallback(() => {
    const ops = [];
    // step movement：color offset = slider - 150
    const offset = colorPos - 150;
    if (offset !== 0) ops.push({ op: 'color', offset });
    // Gradient / Laplacian / Prewitt
    const gtype = GRAD_TYPES.indexOf(gradType);
    if (gtype >= 0 && gain !== 0) ops.push({ op: 'gradient', gtype, amp: gain });
    // Binary Segmentation
    if (nitiType === 'Gra+Bin' || nitiType === 'Bin') {
      ops.push({ op: 'niti', s: threshold });
    } else if (nitiType === 'NiBlack') {
      ops.push({ op: 'niblack', s: threshold });
    }
    return ops;
  }, [gradType, gain, nitiType, threshold, colorPos]);

  React.useEffect(() => {
    applyOps(buildOps());
  }, [buildOps, applyOps]);

  // 向父组件同步当前图像处理参数（供 Make Graph 复刻 OLD CreateGraph1 使用）
  React.useEffect(() => {
    if (!onParamsChange) return;
    const gtype = GRAD_TYPES.indexOf(gradType);
    onParamsChange({
      gradType: gtype >= 0 ? gtype : 0,
      gain,
      nitiType,
      threshold,
      colorPoint: colorPos,
    });
  }, [gradType, gain, nitiType, threshold, colorPos, onParamsChange]);

  const handleNoiseStart = () => {
    const noiseOp = noiseType === 'Median' ? { op: 'median' } : { op: 'smooth' };
    const ops = [...buildOps(), noiseOp];
    pushHistory?.(`Noise reduction Start (${noiseType})`);
    onProcess?.(ops);
  };

  const handleRestore = () => {
    setGradType('Sobel');
    setGain(1);
    setNitiType('Gra+Bin');
    setThreshold(90);
    setColorPos(150);
    setNoiseType('MoveAverage');
    setFix(false);
    pushHistory?.('Restore Image (M)');
    onRestore?.();
  };

  return (
    <fieldset className="param-group-compact">
      <legend>Image Processing</legend>

      {/* Gradient：combo + slider + Gain 数值 */}
      <fieldset className="param-sub-fieldset">
        <legend>Gradient</legend>
        <div className="param-gradient-row">
          <select value={gradType} onChange={(e) => setGradType(e.target.value)} title="Gradient operator">
            {GRAD_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
          </select>
          <input
            type="range" min={1} max={50} value={gain}
            onChange={(e) => setGain(Number(e.target.value))}
            title="Gain (利得) 1..50"
          />
          <input
            type="number" min={1} max={50} value={gain}
            onChange={(e) => setGain(Number(e.target.value))}
            className="param-num-sm"
            readOnly
            title="Gain"
          />
          <span>Gain</span>
        </div>
      </fieldset>

      {/* Binary Segmentation：combo + slider + Threshold 数值 */}
      <fieldset className="param-sub-fieldset">
        <legend>Binary Segmentation</legend>
        <div className="param-binary-row">
          <select value={nitiType} onChange={(e) => setNitiType(e.target.value)} title="Binarization method">
            {NITI_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
          </select>
          <input
            type="range" min={0} max={255} value={threshold}
            onChange={(e) => setThreshold(Number(e.target.value))}
            title="Threshold 0..255"
          />
          <input
            type="number" min={0} max={255} value={threshold}
            onChange={(e) => setThreshold(Number(e.target.value))}
            className="param-num-sm"
            readOnly
            title="Threshold"
          />
          <span>Threshold</span>
        </div>
      </fieldset>

      {/* step movement：Default + slider + Movement（显示 slider-150） */}
      <fieldset className="param-sub-fieldset">
        <legend>step movement</legend>
        <div className="param-step-row">
          <button className="btn" onClick={() => setColorPos(150)}>Default</button>
          <span className="param-value-box">{colorPos - 150}</span>
          <input
            type="range" min={0} max={300} value={colorPos}
            onChange={(e) => setColorPos(Number(e.target.value))}
            title="Movement -150..+150"
          />
          <span>Movement</span>
        </div>
      </fieldset>

      {/* Noise reduction */}
      <fieldset className="param-sub-fieldset">
        <legend>Noise reduction</legend>
        <div className="param-noise-row">
          <select value={noiseType} onChange={(e) => setNoiseType(e.target.value)} title="Noise reduction method">
            {NOISE_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
          </select>
          <button className="btn btn-xs" onClick={handleNoiseStart}>Start</button>
        </div>
      </fieldset>

      <div className="param-restore-row">
        <button className="btn" onClick={handleRestore}>Restore Image (M)</button>
        <label><input type="checkbox" checked={fix} onChange={(e) => setFix(e.target.checked)} /> Fix Image</label>
      </div>
    </fieldset>
  );
}