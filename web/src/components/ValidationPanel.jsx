import React from 'react';

/**
 * Validation Panel — 验证结果区（IDC_VER ~ IDC_SPEED 共 9 个 CText）
 * 显示结果数组首项的 ver/le/se/ir/g/binary/speed。
 */
export default function ValidationPanel({ results }) {
  const r = results[0];
  const cell = (k) => (
    <React.Fragment key={k}><span className="val-label">{k}</span><span className="val-text">{r?.[k] ?? '-'}</span></React.Fragment>
  );

  return (
    <fieldset className="validation-box">
      <legend>Validation</legend>
      <div className="validation-grid">
        {cell('ver')} {cell('le')} {cell('se')}
        {cell('irAdd')} {cell('gAdd')} {cell('binaryAdd')}
        {cell('speed')}
      </div>
      <div className="validation-compare">Not Match: {r?.ver === 'NG' ? 'YES' : 'NO'} | Reduction ok</div>
    </fieldset>
  );
}
