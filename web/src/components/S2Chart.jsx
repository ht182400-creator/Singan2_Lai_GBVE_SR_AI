import React, { useMemo } from 'react';
import { S2_FUNC_NAMES } from '../utils/analysis.js';

/**
 * S2 Chart 区（Graph 区右侧）：复刻 OLD S2 输出
 *  - 上半：按函数列取值的跨 record 折线/柱状
 *  - 下半：IR1/IR2 txt 列表（每 record 一行：`recordNo  值`，对应 gr2.txt 的 Sheet#%5d %5d）
 * graphData = { record_count, rows: [{record, s2[32], etc[12]}] }
 * fn = 函数列号 1..44（1..32 S2，33..44 ETC）
 */
export default function S2Chart({ data, s2, small, params, fn = 1, graphData, recordNo, title = '' }) {
  // 优先用 graphData.rows（跨 record）；否则回退单条 s2
  const rows = graphData && graphData.rows ? graphData.rows : null;
  // 下游统一 0-based 纯值数组（后端 1-based 的下标 0 已在 App 入库处丢弃）；
  // 与 graphStats.getColumnValue 一致：fn 1..32 → s2[fn-1]，fn 33..44 → etc[fn-33]。
  const col = (r) => {
    if (fn <= 32) return r.s2 && r.s2[fn - 1];
    return r.etc && r.etc[fn - 33];
  };

  const arr = useMemo(() => {
    if (rows) return rows.map((r) => col(r)).filter((v) => Number.isFinite(v));
    const one = Array.isArray(data) ? data : Array.isArray(s2) ? s2 : [];
    return one;
  }, [rows, data, s2, fn]); // eslint-disable-line react-hooks/exhaustive-deps

  const hasData = arr.length > 0;

  const w = small ? 240 : 310;
  const h = small ? 60 : 70;
  const max = arr.length ? Math.max(...arr, 0.0001) : 1;
  const safeLen = arr.length || 1;
  const pt = arr.map((v, i) => {
    const x = (i / (safeLen - 1)) * (w - 20) + 10;
    const y = h - 10 - (v / max) * (h - 20);
    return `${x},${y}`;
  }).join(' ');

  const bars = useMemo(() => arr.map((v, i) => {
    const x = (i / safeLen) * (w - 20) + 10;
    const bw = (w - 20) / safeLen - 1;
    const bh = (v / max) * (h - 20);
    return <rect key={i} x={x} y={h - 10 - bh} width={bw} height={bh} fill="#3a7" opacity="0.7" />;
  }), [arr, w, h, max, safeLen]);

  const isS2 = fn <= 32;
  const fnName = isS2 ? `S2[${fn}] ${S2_FUNC_NAMES[fn - 1] || ''}`.trim() : `ETC[${fn - 32}]`;
  const headerText = title ? `${title} / ${fnName} / 跨 record 趋势` : `${fnName} / 跨 record 趋势`;

  // txt 列表：每 record 一行 `recordNo  fn值  函数名`（复刻 gr2.txt，并追加函数名说明）
  const txtList = useMemo(() => {
    if (rows) {
      return rows
        .filter((r) => Number.isFinite(col(r)))
        .map((r) => {
          const rec = `Sheet#${String(r.record + 1).padStart(4, ' ')}`;
          const val = Number.isFinite(col(r)) ? col(r).toFixed(2).padStart(9, ' ') : '        —';
          return `${rec} ${val}  ${fnName}`;
        })
        .join('\n');
    }
    const one = Array.isArray(data) ? data : Array.isArray(s2) ? s2 : [];
    return one.map((v) => (Number.isFinite(v) ? v.toFixed(2) : '—')).join('\n');
  }, [rows, data, s2, fn, fnName]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div className="s2-chart">
      <div
        className="s2-header"
        title={`跨 record 函数值趋势。Fn[${fn}] = ${fnName}。柱状/折线表示每个 record 的该函数值大小；下方文本列出 record 号与对应值。`}
      >
        {headerText}
      </div>
      {!hasData ? (
        <div className="s2-empty">
          暂无跨 record 数据：
          {rows && rows.length === 0
            ? '批量分析返回 0 条有效结果，请检查 History 中 IR2 的报错'
            : '请先运行「Make Graph」或「Statistics」'}
        </div>
      ) : (
        <svg viewBox={`0 0 ${w} ${h}`} className="s2-svg">
          <rect x="0" y="0" width={w} height={h} fill="#f3f3f3" />
          {bars}
          <polyline fill="none" stroke="#06c" strokeWidth="1.2" points={pt} />
        </svg>
      )}
      <div className="s2-help" title="Sheet# 列表说明">
        列表格式：Sheet# = record 序号；第二列 = 该 record 在当前函数列（Fn）上的计算值；最右 = 当前函数名称。
      </div>
      <textarea
        className="s2-txtlist"
        readOnly
        value={txtList || '（运行 Make Graph 或 Statistics 后显示）'}
        title={`Fn[${fn}] = ${fnName}。跨 record 数值列表：第一列 = Sheet#（record 序号，从 1 开始），第二列 = 该 record 在当前函数列上的值。`}
      />
      <div className="s2-legend" title={`${fnName}；areaMode：是否使用鼠标区域/阈值过滤`}>
        Fn[{fn}] {fnName} / {arr.length} 项 / max={max.toFixed(2)} / areaMode={params?.areaMode ?? 'none'}
      </div>
    </div>
  );
}
