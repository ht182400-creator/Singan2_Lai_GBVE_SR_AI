import React from 'react';

/**
 * Make Graph 下方绘图区：图例(Area/Gap) + 网格曲线 + 统计。
 * 纯静态示意，与原版 Make Graph 结果区外观一致。
 */
export default function GraphPlot() {
  const W = 360;
  const H = 200;
  const x0 = 30;
  const y0 = 8;
  const x1 = W;
  const y1 = H - 12;
  const vLines = [];
  for (let x = x0; x <= x1; x += 41.5) vLines.push(x);
  const hLines = [];
  for (let y = y0; y <= y1; y += 23.5) hLines.push(y);

  const leftLabels = ['039', '034', '029', '024', '019', '014', '009', '004', '000'];
  const labelYs = [];
  for (let i = 0; i < leftLabels.length; i++) {
    labelYs.push(y0 + (i * (y1 - y0)) / (leftLabels.length - 1));
  }

  const line = '0,150 18,140 37,120 55,100 74,80 92,55 111,35 129,25 148,30 166,45 185,65 203,85 222,100 240,110 259,95 277,75 296,55 314,40 333,30 351,25 360,22';

  return (
    <div className="graph-plot">
      <div className="gp-header">
        <span className="gp-area">Area [36, 28, 56, 48] [20 x 20] [GP - TH (39)]</span>
        <span className="gp-gap">Gap: 000</span>
      </div>
      <div className="gp-body">
        <svg className="gp-svg" viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none">
          {hLines.map((y, i) => (
            <line key={`h${i}`} x1={x0} y1={y} x2={x1} y2={y} stroke="#e0e0e0" strokeWidth="0.5" />
          ))}
          {vLines.map((x, i) => (
            <line key={`v${i}`} x1={x} y1={y0} x2={x} y2={y1} stroke="#e0e0e0" strokeWidth="0.5" />
          ))}
          <line x1={x0} y1={y1} x2={x1} y2={y1} stroke="#999" strokeWidth="0.7" />
          <line x1={x0} y1={y0} x2={x0} y2={y1} stroke="#999" strokeWidth="0.7" />
          {leftLabels.map((t, i) => (
            <text key={`l${i}`} x={2} y={labelYs[i] + 3} fontSize="7" fill="#666" fontFamily="monospace">{t}</text>
          ))}
          <text x={(x0 + x1) / 2 - 14} y={H - 1} fontSize="7" fill="#666" fontFamily="monospace">00000</text>
          <polyline fill="none" stroke="#06c" strokeWidth="1" points={line} />
        </svg>
        <div className="gp-stats">
          <div>1: Avg= 0, Std= 0, 0- 0</div>
          <div>2: Avg= 0, Std= 0, 0- 0</div>
          <div>Black: 0</div>
          <div>White: 0</div>
        </div>
      </div>
    </div>
  );
}
