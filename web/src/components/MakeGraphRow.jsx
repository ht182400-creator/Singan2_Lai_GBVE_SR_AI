import React from 'react';
import { S2_FUNC_NAMES } from '../utils/analysis.js';

/**
 * Make Graph 工具栏：复刻 OLD resource.rc 的 MakeGraph 参数行。
 *
 * 原版控件：
 *   - IDC_CHECK_MAKE_GRAPH / IDC_CHECK_MAKE_GRAPH2：是否生成 file1 / file2 的图
 *   - IDC_RADIO_BLACK_PIXELS / IDC_RADIO_WHITE_PIXELS：Black / White 单选
 *   - IDC_CHECK_AREA_MOVING_GRAPH：+Area（鼠标移动时自动重算）
 *   - IDC_CHECK_TH_CHANGING_GRAPH：+TH（阈值变化时自动重算）
 *   - IDC_LIST_GRAPH_FUNS：函数列（Web 用 S2[1..32] + ETC[1..12]）
 *   - IDC_EDIT_GRAPH_STATIS_START / STEP / TIMES：批量 record 范围
 *   - IDC_CHECK_CompareOption：1<2
 *   - IDC_BUTTON_MAKE_GRAPH / IDC_BUTTON_MAKE_GRAPH_ALL：Make Graph / Statistics
 *
 * Web 映射：
 *   - file1 = Data1（IR1，绿色），file2 = Data2（IR2，蓝色），分别对应两个独立 .dat 文件。
 *   - 1/2 复选框控制是否显示对应文件统计；IR1/IR2 为不同文件时绿/蓝柱状图分别统计。
 *   - Black/White 仅保留单选状态并传入绘图区做显示标记（Web 没有双像素计数）。
 */
export default function MakeGraphRow({
  pushHistory, onMakeGraph, onStatistics,
  include1 = true, setInclude1,
  include2 = true, setInclude2,
  bw = 'black', setBw,
  area = true, setArea,
  th = true, setTh,
  fn = 1, setFn,
  start = 10, setStart,
  step = 10, setStep,
  times = 5, setTimes,
  total,
  cmp12 = false, setCmp12,
  statDiag = null,
}) {
  // 生成函数列选项：S2[1..32] + 业务名称 + ETC[1..12]
  const opts = [];
  for (let i = 1; i <= 32; i++) {
    const name = S2_FUNC_NAMES[i - 1] || '';
    opts.push({ v: i, label: `S2[${i}] ${name}`.trim() });
  }
  for (let i = 1; i <= 12; i++) opts.push({ v: 32 + i, label: `ETC[${i}]` });

  const toggle = (checked) => (e) => checked?.(e.target.checked);

  return (
    <div className="mg-params">
      <label title="是否显示前半记录（file1）的统计图">
        <input type="checkbox" checked={include1} onChange={toggle(setInclude1)} /> 1
      </label>
      <label title="是否显示后半记录（file2）的统计图">
        <input type="checkbox" checked={include2} onChange={toggle(setInclude2)} /> 2
      </label>
      <label title="选择 Black 像素统计">
        <input
          type="radio"
          name="mg-bw"
          checked={bw === 'black'}
          onChange={() => setBw?.('black')}
        /> Black
      </label>
      <label title="选择 White 像素统计">
        <input
          type="radio"
          name="mg-bw"
          checked={bw === 'white'}
          onChange={() => setBw?.('white')}
        /> White
      </label>
      <label title="鼠标区域变化时自动重算">
        <input type="checkbox" checked={area} onChange={toggle(setArea)} /> +Area
      </label>
      <label title="阈值变化时自动重算">
        <input type="checkbox" checked={th} onChange={toggle(setTh)} /> +TH
      </label>
      <select
        className="mg-fn-select"
        value={fn}
        onChange={(e) => setFn?.(Number(e.target.value))}
        title="选择绘图的函数列（global_select_no）"
      >
        {opts.map((o) => <option key={o.v} value={o.v}>{o.label}</option>)}
      </select>
      <span style={{ fontWeight: 700 }}>Start</span>
      <input
        type="number"
        min="0"
        value={start}
        onChange={(e) => setStart?.(Number(e.target.value))}
        title="起始 record（0 基）"
      />
      <span style={{ fontWeight: 700 }}>Step</span>
      <input
        type="number"
        min="1"
        value={step}
        onChange={(e) => setStep?.(Number(e.target.value))}
        title="record 步长"
      />
      <span style={{ fontWeight: 700 }}>Times</span>
      <input
        type="number"
        min="1"
        value={times}
        onChange={(e) => setTimes?.(Number(e.target.value))}
        title={`分析 record 数（图像共 ${total != null ? total : '?'} 张，默认已自动填为全部）`}
      />
      {total != null && <span style={{ fontSize: 9, color: '#555' }}>/{total}</span>}
      <span
        className="mg-hint"
        title="Start=起始记录号，Step=采样间隔，Times=分析记录数。打开数据时已自动设为覆盖全部图像（上限 4096）。"
      >
        批量范围
      </span>
      <label title="比较时取 1<2 方向">
        <input
          type="checkbox"
          checked={cmp12}
          onChange={(e) => setCmp12?.(e.target.checked)}
        /> 1&lt;2
      </label>
      <button
        className="btn"
        onClick={() => {
          pushHistory?.(`Make Graph (fn=${fn} start=${start} step=${step} times=${times} ${bw})`);
          onMakeGraph?.();
        }}
      >
        Make Graph
      </button>
      <button
        className="btn"
        onClick={() => {
          pushHistory?.(`Statistics ${start}/${step}/${times}`);
          onStatistics?.(start, step, times);
        }}
      >
        Statistics
      </button>
      {statDiag && statDiag.length > 0 && (
        <div className="stat-diag" title="Statistics 批量分析诊断：请求/返回/有效/跳过 数量，便于定位 1044 不返回等问题">
          {statDiag.map((d, i) => (
            <div key={i} className={d.valid === 0 ? 'stat-diag-err' : 'stat-diag-ok'}>
              [{d.label}] 请求 {d.requested} 枚 / 返回 {d.returned} 条 / 有效 {d.valid} 条 / 跳过 {d.skipped} 条
              {Number(d.backendMs) > 0 && <span className="stat-diag-time"> ｜ 服务端耗时 {d.backendMs} ms</span>}
              {d.errors && d.errors.length > 0 && (
                <span className="stat-diag-errs"> ｜ 样例错误：{d.errors.slice(0, 3).join(' / ')}</span>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
