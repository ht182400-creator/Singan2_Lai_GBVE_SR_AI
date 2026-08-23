import React from 'react';

/**
 * Reduction Image 1 / 2 独立 GroupBox（.rc X1101 / X1182）。
 * variant=1 → Reduction Image 1；variant=2 → Reduction Image 2。
 * 每个框独立含：文件名 + 2 缩略图 + 按钮行（Clear 4D/Load/Show/Show All/Save/Set 4D）+ 对比结果。
 */
export default function ReductionImageCompact({ variant = 1, pushHistory }) {
  const thumbs = variant === 1
    ? ['Reduction 1', 'Reduction 2']
    : ['Reduction 3', 'Reduction 4'];
  const file = variant === 1 ? 'IR1_GASO_10309\\85901.bin' : 'IR2_GASO_10309\\85901.bin';
  return (
    <fieldset className="ri-box">
      <legend>Reduction Image {variant}</legend>
      <div className="ri-header">
        <input className="ri-filename" defaultValue={file} />
      </div>
      <div className="ri-thumbs">
        {thumbs.map((t) => (
          <div key={t} className="ri-thumb">
            <div className="ri-thumb-img" />
            <span className="ri-thumb-label">{t}</span>
          </div>
        ))}
      </div>
      <div className="ri-buttons">
        <button className="btn btn-xs" onClick={() => pushHistory?.('Clear 4D')}>Clear 4D</button>
        <button className="btn btn-xs" onClick={() => pushHistory?.('Load')}>Load...</button>
        <button className="btn btn-xs" onClick={() => pushHistory?.('Show')}>Show</button>
        <button className="btn btn-xs" onClick={() => pushHistory?.('Show All')}>Show All</button>
        <button className="btn btn-xs" onClick={() => pushHistory?.('Save List')}>Save List...</button>
        <button className="btn btn-xs" onClick={() => pushHistory?.('Set 4D')}>Set 4D</button>
      </div>
      <div className="ri-compare">
        <span>Comparison:</span>
        <input className="ri-compare-val" readOnly value="OK | Ver: MATCH" />
      </div>
    </fieldset>
  );
}