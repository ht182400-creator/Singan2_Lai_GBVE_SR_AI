import React from 'react';

/**
 * Graph 区（文件标签 + 函数列表 + 绘图区）
 * - IDC_GRAPH_FILE 标签
 * - IDC_GRAPH_FUNC ListBox（多选）
 * - 绘图占位（白色画布）
 */
export default function GraphPanel({ fileName, funcs, g1, g2, onChange1, onChange2 }) {
  return (
    <div className="graph-panel">
      <div className="graph-func-row">
        <span className="graph-file-label">{fileName}</span>
        <span className="graph-text-display">{g1} / {g2}</span>
      </div>
      <select multiple size={3} className="graph-func-list">
        {funcs.map((f) => <option key={f}>{f}</option>)}
      </select>
      <div className="graph-canvas">
        <svg viewBox="0 0 400 120" className="graph-svg">
          <polyline fill="none" stroke="#06c"
            points="0,60 25,55 50,40 75,30 100,15 125,5 150,2 175,5 200,15 225,30 250,45 275,55 300,60 325,55 350,40 375,30 400,20" />
          <line x1="0" y1="60" x2="400" y2="60" stroke="#999" strokeWidth="0.5" />
        </svg>
        <div className="graph-legend">Graph1 - Graph2 | S2 sample plot</div>
      </div>
    </div>
  );
}
