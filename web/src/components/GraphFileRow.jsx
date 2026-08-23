import React, { useState } from 'react';

/**
 * Graph 文件行：文件名 + Mul-X + 系数 + ABS + Load/Save + Graph1/2 + Clear + Combine
 * （自给自足）
 */
export default function GraphFileRow({ pushHistory }) {
  const [file, setFile] = useState('graph1.grp');
  const [mulX, setMulX] = useState(1.0);
  const [coef, setCoef] = useState(1.0);
  const [abs, setAbs] = useState(true);
  const [g1, setG1] = useState('graph1.grp');
  const [g2, setG2] = useState('graph2.grp');
  return (
    <div className="graph-file-row">
      <input className="graph-input" value={file} onChange={(e) => setFile(e.target.value)} />
      <label className="graph-mulx">Mul-X
        <input type="number" step="0.1" value={mulX} onChange={(e) => setMulX(Number(e.target.value))} className="graph-num" />
      </label>
      <label className="graph-coef">系数
        <input type="number" value={coef} onChange={(e) => setCoef(Number(e.target.value))} className="graph-num" />
      </label>
      <label><input type="checkbox" checked={abs} onChange={(e) => setAbs(e.target.checked)} /> ABS</label>
      <button className="btn" onClick={() => pushHistory?.('Load Graph')}>Load Graph</button>
      <button className="btn" onClick={() => pushHistory?.('Save Graph')}>Save Graph</button>
      <input className="graph-txt" value={g1} onChange={(e) => setG1(e.target.value)} />
      <input className="graph-txt" value={g2} onChange={(e) => setG2(e.target.value)} />
      <button className="btn" onClick={() => pushHistory?.('Clear')}>Clear</button>
      <button className="btn" onClick={() => pushHistory?.('Combine')}>Combine</button>
    </div>
  );
}