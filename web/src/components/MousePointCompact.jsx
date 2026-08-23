import React, { useState } from 'react';

/**
 * 右侧顶部 Mouse Point + Switch View + Clear（紧凑版）
 */
export default function MousePointCompact({ pushHistory }) {
  const [showV, setShowV] = useState(true);
  return (
    <fieldset className="mp-compact">
      <legend>Mouse Point</legend>
      <div className="mp-row">
        <button className={`btn btn-xs mp-show-btn${showV ? ' active' : ''}`} onClick={() => setShowV(!showV)}>Show(V)</button>
        <button className="btn btn-xs" onClick={() => pushHistory?.('Switch View')}>Switch View</button>
        <button className="btn btn-xs" onClick={() => pushHistory?.('Clear Op History')}>Clear</button>
      </div>
      <div className="mp-row2">
        <span>Width</span>
        <input type="number" defaultValue={33} className="mp-num" />
        <span>Hight</span>
        <input type="number" defaultValue={24} className="mp-num" />
        <span>Decide</span>
        <input type="number" defaultValue={5} className="mp-num" />
      </div>
    </fieldset>
  );
}