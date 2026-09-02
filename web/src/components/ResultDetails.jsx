import React from 'react';
import { buildResultRows, S2_FUNC_NAMES } from '../utils/analysis.js';
import { downloadTextFile } from '../utils/file.js';

/**
 * Result Details 面板：显示当前 record 的 S2[1..32] 判定结果，并提供导出/清空按钮。
 *
 * 原版 MFC 中没有完全对应的"Result Details"容器，但有类似输出逻辑：
 *   - Out_.cpp 的 outfunc/DSPandSM 将 S2 与 DSP 对比文本写到 IDC_ATAI 编辑框。
 *   - WinMain.cpp 的 IDC_BUTTON_GR 将 S2_gr 数组导出为 CSV。
 * Web 端将这两类能力合并为"Export..."按钮（导出 CSV）和"Clear"按钮（清空当前结果）。
 *
 * 列含义：
 *   Detail：S2 函数序号 R1–R32
 *   Name：  S2 维度业务名称
 *   Thresh：判定阈值
 *   Value：  当前 record 的实际输出值
 *   Judge：  Value ≥ Thresh 为 OK，否则 NG
 *
 * @param {Object} props
 * @param {Function} [props.pushHistory] - 操作历史回调。
 * @param {Array<{id:string,name:string,th:number,val:number,ok:boolean}>} [props.rows] - 已构建的结果行。
 * @param {number[]} [props.s2] - 原始 S2 值；rows 为空时自动 buildResultRows。
 * @param {string} [props.title] - 面板标题。
 * @param {Function} [props.onClear] - Clear 按钮回调。
 */
export default function ResultDetails({ pushHistory, rows, s2, title = "Result Details", onClear }) {
  const data = rows && rows.length ? rows : buildResultRows(s2);

  /**
   * 将当前 Result Details 表格导出为 CSV 文件。
   * 列：Detail, Name, Thresh, Value, Judge。
   */
  const handleExport = () => {
    try {
      if (!data.length) {
        pushHistory?.('Export Result：无数据可导出');
        return;
      }
      const header = 'Detail,Name,Thresh,Value,Judge';
      const lines = data.map((r) => [
        r.id ?? '',
        (r.name ?? '').replace(/,/g, ' '),
        Number.isFinite(r.th) ? r.th.toFixed(2) : '',
        Number.isFinite(r.val) ? r.val.toFixed(2) : '',
        r.ok ? 'OK' : 'NG',
      ].join(','));
      const csv = [header, ...lines].join('\n');
      const suffix = title.replace(/[^a-zA-Z0-9_]+/g, '_').replace(/^_+|_+$/g, '');
      const filename = `ResultDetails_${suffix}_${new Date().toISOString().slice(0, 10).replace(/-/g, '')}.csv`;
      if (downloadTextFile(filename, csv, 'text/csv;charset=utf-8;')) {
        pushHistory?.(`Export Result：已导出 ${data.length} 行 → ${filename}`);
      } else {
        pushHistory?.('Export Result：导出失败');
      }
    } catch (e) {
      pushHistory?.(`Export Result 异常: ${e.message}`);
    }
  };

  /** 清空当前 Result Details 显示。 */
  const handleClear = () => {
    try {
      onClear?.();
      pushHistory?.('Clear Result：已清空 Result Details');
    } catch (e) {
      pushHistory?.(`Clear Result 异常: ${e.message}`);
    }
  };

  if (!data.length) {
    return (
      <fieldset className="result-details">
        <legend title="R1–R32 是 S2[1..32] 的判定结果">{title}</legend>
        <div className="rd-empty">（先运行「分析」或「Make Graph」后显示）</div>
      </fieldset>
    );
  }
  const ok = data.filter((r) => r.ok).length;
  const ng = data.length - ok;
  return (
    <fieldset className="result-details">
      <legend title="R1–R32 对应 S2[1..32]；Name=业务名称；Thresh=判定阈值；Value=实际值；Judge=OK/NG">{title}</legend>
      <div
        className="rd-summary"
        title={`OK=${ok} = 32 个检查项中 Value ≥ Thresh 的数量；NG=${ng} = 32 - OK。Judge 规则：每行 Value 与 Thresh 比较，大于等于阈值记 OK，否则记 NG。`}
      >
        <span className="rd-ok">OK: {ok}</span>
        <span className="rd-ng">NG: {ng}</span>
      </div>
      <div className="rd-count-help" title="OK/NG 计数说明">
        计数方式：R1–R32 共 32 项，逐项比较 Value ≥ Thresh，满足即 OK，否则 NG。
      </div>
      <div className="rd-table-wrapper">
        <table className="rd-table">
          <thead>
            <tr>
              <th className="rd-col-detail" title="函数序号 R1–R32（对应 S2[1..32]）">Detail</th>
              <th className="rd-col-name" title="S2 维度业务名称">Name</th>
              <th className="rd-col-th" title="判定阈值（默认 0.5）">Thresh</th>
              <th className="rd-col-val" title="当前 record 的实际输出值">Value</th>
              <th className="rd-col-judge" title="Value ≥ Thresh 为 OK，否则 NG">Judge</th>
            </tr>
          </thead>
          <tbody>
            {data.map((r, idx) => {
              const fullName = S2_FUNC_NAMES[idx] ?? r.name ?? '';
              return (
                <tr key={r.id} className={r.ok ? 'rd-pass' : 'rd-fail'}>
                  <td className="rd-col-detail" title={`S2[${r.id.slice(1)}]`}>{r.id}</td>
                  <td className="rd-col-name" title={fullName}>
                    <span className="rd-name">{fullName}</span>
                  </td>
                  <td className="rd-col-th">{Number.isFinite(r.th) ? r.th.toFixed(2) : '—'}</td>
                  <td className="rd-col-val">{Number.isFinite(r.val) ? r.val.toFixed(2) : '—'}</td>
                  <td className="rd-col-judge">{r.ok ? 'OK' : 'NG'}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <div className="rd-buttons">
        <button className="btn btn-xs" onClick={handleExport}>Export...</button>
        <button className="btn btn-xs" onClick={handleClear}>Clear</button>
      </div>
    </fieldset>
  );
}
