import React, { useState } from 'react';

/**
 * 右侧 Result Details 面板（差异清单 P0：原版最严重缺失项）
 *  - 标题 Result Details
 *  - 结果列表（Detail 列 + 阈值/实际/判定）
 *  - OK/NG 计数
 */
const SAMPLE = [
  { id: 'R1', th: 0.92, val: 0.97, ok: true },
  { id: 'R2', th: 0.88, val: 0.85, ok: false },
  { id: 'R3', th: 0.90, val: 0.93, ok: true },
  { id: 'R4', th: 0.85, val: 0.91, ok: true },
  { id: 'R5', th: 0.95, val: 0.79, ok: false },
];

export default function ResultDetails({ pushHistory }) {
  const [rows] = useState(SAMPLE);
  const ok = rows.filter((r) => r.ok).length;
  const ng = rows.length - ok;
  return (
    <fieldset className="result-details">
      <legend>Result Details</legend>
      <div className="rd-summary">
        <span className="rd-ok">OK: {ok}</span>
        <span className="rd-ng">NG: {ng}</span>
      </div>
      <table className="rd-table">
        <thead>
          <tr><th>Detail</th><th>Thresh</th><th>Value</th><th>Judge</th></tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.id} className={r.ok ? 'rd-pass' : 'rd-fail'}>
              <td>{r.id}</td>
              <td>{r.th.toFixed(2)}</td>
              <td>{r.val.toFixed(2)}</td>
              <td>{r.ok ? 'OK' : 'NG'}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <div className="rd-buttons">
        <button className="btn btn-xs" onClick={() => pushHistory?.('Export Result')}>Export...</button>
        <button className="btn btn-xs" onClick={() => pushHistory?.('Clear Result')}>Clear</button>
      </div>
    </fieldset>
  );
}
