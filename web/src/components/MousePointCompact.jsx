import React, { useState } from 'react';

/**
 * 右侧顶部 Mouse Point（紧凑版）。Switch View 已移至 Operation History 之后。
 */
export default function MousePointCompact({ pushHistory }) {
  const [showV, setShowV] = useState(true);
  return (
    <fieldset className="mp-compact">
      <legend>Mouse Point</legend>
      <div className="mp-row">
        <button className={`btn btn-xs mp-show-btn${showV ? ' active' : ''}`} onClick={() => setShowV(!showV)}>Show(V)</button>
      </div>
      <div className="mp-input-row"><span>Width</span><input type="number" defaultValue={33} className="mp-num" /></div>
      <div className="mp-input-row"><span>Height</span><input type="number" defaultValue={24} className="mp-num" /></div>
      <div className="mp-input-row"><span>Decide</span><input type="number" defaultValue={5} className="mp-num" /></div>
    </fieldset>
  );
}