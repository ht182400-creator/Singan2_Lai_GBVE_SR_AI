import React, { useState } from 'react';

/**
 * Make Graph 行：6 个 checkbox + Make Graph 按钮（自给自足）
 */
export default function MakeGraphRow({ pushHistory, onMakeGraph }) {
  const [s, setS] = useState({ mg1: true, mg2: true, black: true, white: true, area: true, th: true });
  const set = (k) => (e) => setS((p) => ({ ...p, [k]: e.target.checked }));
  return (
    <div className="make-graph-row">
      <label><input type="checkbox" checked={s.mg1} onChange={set('mg1')} /> 1</label>
      <label><input type="checkbox" checked={s.mg2} onChange={set('mg2')} /> 2</label>
      <label><input type="checkbox" checked={s.black} onChange={set('black')} /> Black</label>
      <label><input type="checkbox" checked={s.white} onChange={set('white')} /> White</label>
      <label><input type="checkbox" checked={s.area} onChange={set('area')} /> +Area</label>
      <label><input type="checkbox" checked={s.th} onChange={set('th')} /> +TH</label>
      <button className="btn" onClick={() => { pushHistory?.('Make Graph'); onMakeGraph?.(); }}>Make Graph</button>
    </div>
  );
}