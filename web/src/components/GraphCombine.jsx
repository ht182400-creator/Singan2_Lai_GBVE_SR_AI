import React from 'react';

/**
 * 右侧底部 Graph Combine 操作按钮：
 *  Mul-X / Load Graph / Save Graph / AB(Graph1 - Graph2) / Save Graph / Graph (Combine) / Clear
 *  + 状态：different neighbour / R / W / Diff / R / W / Diff
 */
export default function GraphCombine({ pushHistory }) {
  return (
    <div className="graph-combine">
      <div className="graph-combine-buttons">
        <button className="btn" onClick={() => pushHistory?.('Mul-X')}>Mul-X</button>
        <button className="btn" onClick={() => pushHistory?.('Load Graph')}>Load Graph</button>
        <button className="btn" onClick={() => pushHistory?.('Save Graph')}>Save Graph</button>
        <button className="btn" onClick={() => pushHistory?.('AB Graph')}>AB(Graph1 - Graph2)</button>
        <button className="btn" onClick={() => pushHistory?.('Combine')}>Graph (Combine)</button>
        <button className="btn" onClick={() => pushHistory?.('Clear Graph')}>Clear</button>
      </div>
      <div className="graph-combine-meta">
        <span className="meta-label">different neighbour</span>
        <span>R</span>
        <input type="number" defaultValue={0} className="meta-num" />
        <span>W</span>
        <input type="number" defaultValue={0} className="meta-num" />
        <span>Diff</span>
        <input type="number" defaultValue={0} className="meta-num" />
      </div>
    </div>
  );
}