import React from 'react';

/**
 * 右侧 Validation Compact：
 *  8 cells: ver / OK / le / se / irAdd / gAdd / binaryAdd / speed
 *  + 标签: IR_Additive
 */
const CELLS_1 = [
  ['ver', '0'], ['OK', 'gAdd'],
  ['le', '0.12'], ['se', '0.05'],
  ['irAdd', '128'], ['gAdd', '0'],
  ['binaryAdd', 'Speed'], ['speed', '0.95'],
];
const CELLS_2 = [
  ['N=2', '1'], ['ver', '0'],
  ['irAdd', '128'], ['gAdd', '0'],
  ['IR Adictive', '0'], ['G Adictive', '0'],
  ['binaryAdd', 'Speed'], ['speed', '0.95'],
];
function ValGroup({ cells, title }) {
  return (
    <div className="val-group">
      <div className="val-group-title">{title}</div>
      <div className="val-grid">
        {cells.map(([k, v]) => (
          <div key={k} className="val-cell">
            <span className="val-k">{k}</span>
            <span className="val-v">{v}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
export default function ValidationCompact() {
  return (
    <fieldset className="val-compact">
      <legend>Validation Result</legend>
      <ValGroup cells={CELLS_1} title="N=1" />
      <ValGroup cells={CELLS_2} title="N=2" />
      <div className="val-row-add">
        <span className="val-label">IR_Additive:</span>
        <input className="val-num" defaultValue="0" />
      </div>
    </fieldset>
  );
}