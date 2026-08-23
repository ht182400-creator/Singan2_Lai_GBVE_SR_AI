import React from 'react';

/**
 * Mouse Point Panel: Show(V) / Width / Hight / Decide 4 控件
 * Width/Hight 对照原版"用 Show(V)"的输入决定
 */
export default function MousePointPanel({
  showV, setShowV, width, setWidth, height, setHeight, decide, setDecide,
}) {
  return (
    <fieldset className="mousepoint-box">
      <legend>Mouse Point</legend>
      <label><input type="checkbox" checked={showV} onChange={(e) => setShowV(e.target.checked)} /> Show(V)</label>
      <label>Width <input type="number" value={width} onChange={(e) => setWidth(Number(e.target.value))} className="mp-num" /></label>
      <label>Hight <input type="number" value={height} onChange={(e) => setHeight(Number(e.target.value))} className="mp-num" /></label>
      <label><input type="checkbox" checked={decide} onChange={(e) => setDecide(e.target.checked)} /> Decide</label>
    </fieldset>
  );
}
