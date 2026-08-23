import React from 'react';

/**
 * 底部 TH 行：
 * "( TH1/IR1/IR2/UV1/IR3 ) | r | ( TH2/IR2 ) | r | Clear 4D | Load... | Show All | Save List..."
 */
export default function ThRow({ pushHistory }) {
  return (
    <div className="th-row">
      <span className="th-paren">(</span>
      <select className="th-combo" defaultValue="TH1">
        <option>TH1</option><option>TH2</option><option>TH3</option>
      </select>
      <select className="th-combo" defaultValue="IR1">
        <option>IR1</option><option>IR2</option><option>IR3</option>
        <option>UV1</option><option>UV2</option>
      </select>
      <select className="th-combo" defaultValue="IR2">
        <option>IR2</option><option>IR1</option><option>IR3</option>
      </select>
      <select className="th-combo" defaultValue="UV1">
        <option>UV1</option><option>UV2</option>
      </select>
      <select className="th-combo" defaultValue="IR3">
        <option>IR3</option><option>IR1</option>
      </select>
      <span className="th-paren">)</span>
      <span className="th-r">r</span>
      <span className="th-paren">(</span>
      <select className="th-combo" defaultValue="TH2">
        <option>TH1</option><option>TH2</option>
      </select>
      <select className="th-combo" defaultValue="IR2">
        <option>IR1</option><option>IR2</option>
      </select>
      <span className="th-paren">)</span>
      <span className="th-r">r</span>
      <button className="btn btn-xs" onClick={() => pushHistory?.('Clear 4D')}>Clear 4D</button>
      <button className="btn btn-xs" onClick={() => pushHistory?.('Load...')}>Load...</button>
      <button className="btn btn-xs" onClick={() => pushHistory?.('Show All')}>Show All</button>
      <button className="btn btn-xs" onClick={() => pushHistory?.('Save List...')}>Save List...</button>
    </div>
  );
}