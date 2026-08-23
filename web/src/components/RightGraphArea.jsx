import React, { useState } from 'react';
import S2Chart from './S2Chart.jsx';

/**
 * 右侧 Graph 区（原版 resource.rc y265–631 真实布局整合）：
 *  - 文件名编辑框 IDC_EDIT_GRAPH_FILE x997 y265 w304 h14（文件名 graph1.grp）
 *  - 函数列表 IDC_LIST_GRAPH_FUNC x991 y280 w106 h60（多选 S2/S2_DIFF/...）
 *  - Make Graph 区按钮（原版 y325–342）：1/2/Black/White/+Area/+TH checkbox + Make Graph
 *  - Statistics 行（原版 x1024 y341）：Start/Step/Times/1<2 + Statistics
 *  - Graph File 行（原版 x1098 y325）：Mul-X/系数/ABS/Load/Save/Graph1/Graph2/Clear/Combine
 *  - GRAPH1 编辑框 x1068 y361 h128；GRAPH2 编辑框 x1068 y492 h139
 *  - GraphCombine 操作（Mul-X/Load/Save/AB/Combine/Clear）
 */
export default function RightGraphArea({ pushHistory }) {
  const [start, setStart] = useState(0);
  const [step, setStep] = useState(1);
  const [times, setTimes] = useState(16);
  const [cmp12, setCmp12] = useState(false);
  const [file, setFile] = useState('graph1.grp');
  const [mulX, setMulX] = useState(1.0);
  const [coef, setCoef] = useState(1.0);
  const [abs, setAbs] = useState(true);
  const [g1, setG1] = useState('graph1.grp');
  const [g2, setG2] = useState('graph2.grp');
  const [mg, setMgState] = useState({ m1: true, m2: true, bw: 'black', area: true, th: true });
  const setMg = (k) => (e) => setMgState((p) => ({ ...p, [k]: e.target.checked }));

  return (
    <div className="graph-area">
      {/* Make Graph 行（原版 X:613-1279, Y:590-610）：1/2/Black/White/+Area/+TH + Make Graph */}
      <div className="ga-make-row">
        <label><input type="checkbox" checked={mg.m1} onChange={setMg('m1')} /> 1</label>
        <label><input type="checkbox" checked={mg.m2} onChange={setMg('m2')} /> 2</label>
        <label><input type="radio" name="mg-bw" checked={mg.bw === 'black'} onChange={() => setMgState((p) => ({ ...p, bw: 'black' }))} /> Black</label>
        <label><input type="radio" name="mg-bw" checked={mg.bw === 'white'} onChange={() => setMgState((p) => ({ ...p, bw: 'white' }))} /> White</label>
        <label><input type="checkbox" checked={mg.area} onChange={setMg('area')} /> +Area</label>
        <label><input type="checkbox" checked={mg.th} onChange={setMg('th')} /> +TH</label>
        <button className="btn btn-xs" onClick={() => pushHistory?.('Make Graph')}>Make Graph</button>
      </div>

      {/* 文件名 + 函数列表 */}
      <div className="ga-file-row">
        <input className="ga-file" value={file} onChange={(e) => setFile(e.target.value)} />
        <select multiple size={3} className="ga-func-list">
          {['S2', 'S2_DIFF', 'S2_SUM', 'S2_AVG'].map((f) => <option key={f}>{f}</option>)}
        </select>
      </div>

      {/* Statistics 行（Start/Step/Times/1<2 + Statistics，原版 MakeGraph 区内 y560） */}
      <div className="ga-stat-row">
        <span className="ga-lbl">Start</span>
        <input type="number" value={start} onChange={(e) => setStart(Number(e.target.value))} className="ga-num" />
        <span className="ga-lbl">Step</span>
        <input type="number" value={step} onChange={(e) => setStep(Number(e.target.value))} className="ga-num" />
        <span className="ga-lbl">Times</span>
        <input type="number" value={times} onChange={(e) => setTimes(Number(e.target.value))} className="ga-num" />
        <label><input type="checkbox" checked={cmp12} onChange={(e) => setCmp12(e.target.checked)} /> 1&lt;2</label>
        <button className="btn btn-xs" onClick={() => pushHistory?.('Statistics')}>Statistics</button>
      </div>

      {/* Graph File 行 */}
      <div className="ga-file-op-row">
        <label className="ga-mulx">Mul-X
          <input type="number" step="0.1" value={mulX} onChange={(e) => setMulX(Number(e.target.value))} className="ga-num" />
        </label>
        <label className="ga-coef">系数
          <input type="number" value={coef} onChange={(e) => setCoef(Number(e.target.value))} className="ga-num" />
        </label>
        <label><input type="checkbox" checked={abs} onChange={(e) => setAbs(e.target.checked)} /> ABS</label>
        <button className="btn btn-xs" onClick={() => pushHistory?.('Load Graph')}>Load Graph</button>
        <button className="btn btn-xs" onClick={() => pushHistory?.('Save Graph')}>Save Graph</button>
        <input className="ga-txt" value={g1} onChange={(e) => setG1(e.target.value)} />
        <input className="ga-txt" value={g2} onChange={(e) => setG2(e.target.value)} />
        <button className="btn btn-xs" onClick={() => pushHistory?.('Clear')}>Clear</button>
        <button className="btn btn-xs" onClick={() => pushHistory?.('Combine')}>Combine</button>
      </div>

      {/* 两个 Graph 编辑框 + 绘图 */}
      <div className="ga-graphs">
        <fieldset className="ga-graph-box">
          <legend>Graph1</legend>
          <textarea className="ga-graph-edit" defaultValue={'0.12\n0.05\n0.88\n0.91\n0.79'} />
        </fieldset>
        <fieldset className="ga-graph-box">
          <legend>Graph2</legend>
          <textarea className="ga-graph-edit" defaultValue={'0.10\n0.07\n0.85\n0.93\n0.81'} />
        </fieldset>
        <div className="ga-plot">
          <S2Chart fileName={file} />
        </div>
      </div>

      {/* GraphCombine 操作 */}
      <div className="ga-combine">
        <button className="btn btn-xs" onClick={() => pushHistory?.('Mul-X')}>Mul-X</button>
        <button className="btn btn-xs" onClick={() => pushHistory?.('AB Graph')}>AB(Graph1 - Graph2)</button>
        <button className="btn btn-xs" onClick={() => pushHistory?.('Graph Combine')}>Graph (Combine)</button>
        <span className="ga-meta">different neighbour R<input type="number" defaultValue={0} className="ga-num" />W<input type="number" defaultValue={0} className="ga-num" />Diff<input type="number" defaultValue={0} className="ga-num" /></span>
      </div>
    </div>
  );
}
