import React, { useEffect, useMemo, useRef } from 'react';
import * as echarts from 'echarts';
import { S2_FUNC_NAMES } from '../utils/analysis.js';

/**
 * S2 Chart 区（ECharts 版，2026-09-03 重写）：
 *  - 单图叠加显示 IR1/Data1（绿）与 IR2/Data2（蓝）的跨 record 趋势，解决旧版两张小图割裂、看不清的问题。
 *  - 自带 dataZoom（框选/滚轮缩放）、axis tooltip、图例，体验对齐 Grafana/主流可视化面板。
 *  - 右侧保留数值列表，便于核对与导出。
 *
 * 模式：
 *  - 跨 record 模式：graphData/graphData2 = { record_count, rows:[{record,s2[32],etc[12]}] }（来自 Statistics）
 *  - 单条回退模式：仅传 s2（长度 32 的某 record 函数值）→ 横轴为函数列号 1..32
 *
 * fn = 函数列号 1..44（1..32 S2，33..44 ETC）
 */
export default function S2Chart({ data, s2, small, params, fn = 1, graphData, graphData2, recordNo, title = '' }) {
  const chartRef = useRef(null);
  const instRef = useRef(null);

  const isS2 = fn <= 32;
  const fnName = isS2 ? `S2[${fn}] ${S2_FUNC_NAMES[fn - 1] || ''}`.trim() : `ETC[${fn - 32}]`;

  const colOf = (r) => {
    if (!r) return undefined;
    if (fn <= 32) return r.s2 && r.s2[fn - 1];
    return r.etc && r.etc[fn - 33];
  };

  // 跨 record 模式：优先 graphData.rows；单条回退用 s2（横轴=函数列号）
  const ir1Rows = useMemo(() => {
    if (graphData && graphData.rows && graphData.rows.length) return graphData.rows;
    if (Array.isArray(s2) && s2.length) return [{ record: 0, s2, etc: null }];  // 单条：整段 s2
    return null;
  }, [graphData, s2]);

  const ir2Rows = useMemo(() => {
    if (graphData2 && graphData2.rows && graphData2.rows.length) return graphData2.rows;
    return null;
  }, [graphData2]);

  const crossMode = !!(graphData && graphData.rows && graphData.rows.length);

  const series1 = useMemo(() => {
    if (!ir1Rows) return [];
    return ir1Rows.map((r) => {
      const x = crossMode ? (r.record ?? 0) + 1 : fn;  // 跨 record→Sheet#；单条→函数列号
      const v = colOf(r);
      return [x, Number.isFinite(v) ? v : null];
    });
  }, [ir1Rows, crossMode, fn]);

  const series2 = useMemo(() => {
    if (!ir2Rows) return [];
    return ir2Rows.map((r) => {
      const x = (r.record ?? 0) + 1;
      const v = colOf(r);
      return [x, Number.isFinite(v) ? v : null];
    });
  }, [ir2Rows]);

  const hasData = series1.length > 0 || series2.length > 0;

  useEffect(() => {
    if (!chartRef.current) return undefined;
    if (!instRef.current) {
      instRef.current = echarts.init(chartRef.current);
    }
    const legendData = [];
    if (series1.length) legendData.push('IR1/Data1');
    if (series2.length) legendData.push('IR2/Data2');

    const option = {
      animation: false,
      grid: { left: 46, right: 14, top: 26, bottom: 46 },
      tooltip: {
        trigger: 'axis',
        axisPointer: { type: 'cross' },
        textStyle: { fontSize: 10 },
        formatter: (pts) => {
          if (!pts || !pts.length) return '';
          const x = pts[0].value[0];
          let s = `${crossMode ? 'Sheet# ' : 'Fn '}${x}<br/>`;
          for (const p of pts) {
            s += `${p.marker}${p.seriesName}: ${p.value[1] == null ? '—' : Number(p.value[1]).toFixed(2)}<br/>`;
          }
          return s;
        },
      },
      legend: { data: legendData, top: 2, left: 'center', textStyle: { fontSize: 10 }, itemWidth: 14, itemHeight: 8 },
      xAxis: {
        type: 'value',
        name: crossMode ? 'Sheet#' : 'Fn',
        nameTextStyle: { fontSize: 9 },
        axisLabel: { fontSize: 9 },
        scale: !crossMode,
      },
      yAxis: { type: 'value', scale: true, axisLabel: { fontSize: 9 } },
      dataZoom: [
        { type: 'inside', filterMode: 'none' },
        { type: 'slider', height: 14, bottom: 6, showDetail: false },
      ],
      series: [
        {
          name: 'IR1/Data1',
          type: 'line',
          showSymbol: false,
          sampling: 'lttb',
          data: series1,
          lineStyle: { color: '#1a9e44', width: 1.2 },
          itemStyle: { color: '#1a9e44' },
          connectNulls: false,
        },
        {
          name: 'IR2/Data2',
          type: 'line',
          showSymbol: false,
          sampling: 'lttb',
          data: series2,
          lineStyle: { color: '#1565d8', width: 1.2 },
          itemStyle: { color: '#1565d8' },
          connectNulls: false,
        },
      ],
    };
    instRef.current.setOption(option, true);
    instRef.current.resize();
    return undefined;
  }, [series1, series2, crossMode, fnName]);

  // 容器尺寸变化时同步 ECharts
  useEffect(() => {
    const onResize = () => instRef.current && instRef.current.resize();
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);

  const txtList = useMemo(() => {
    if (!ir1Rows && !ir2Rows) return '（运行 Make Graph 或 Statistics 后显示）';
    const lines = [];
    if (ir1Rows) {
      for (const r of ir1Rows) {
        if (!Number.isFinite(colOf(r))) continue;
        const rec = crossMode ? `Sheet#${String((r.record ?? 0) + 1).padStart(4, ' ')}` : 'IR1';
        lines.push(`${rec} ${colOf(r).toFixed(2).padStart(9, ' ')}  ${fnName}`);
      }
    }
    if (ir2Rows) {
      for (const r of ir2Rows) {
        if (!Number.isFinite(colOf(r))) continue;
        const rec = `Sheet#${String((r.record ?? 0) + 1).padStart(4, ' ')}`;
        lines.push(`${rec} ${colOf(r).toFixed(2).padStart(9, ' ')}  ${fnName} (IR2)`);
      }
    }
    return lines.join('\n') || '（无有效值）';
  }, [ir1Rows, ir2Rows, crossMode, fnName]);

  const headerText = title ? `${title} / ${fnName}` : fnName;

  return (
    <div className="s2-chart">
      <div className="s2-header" title={`跨 record 趋势：Fn[${fn}] = ${fnName}。绿线=IR1/Data1，蓝线=IR2/Data2；可滚轮/框选缩放，悬停查看数值。`}>
        {headerText}
      </div>
      <div className="s2-body">
        <div className="s2-chart-wrap">
          <div ref={chartRef} className="s2-echarts" />
          {!hasData && (
            <div className="s2-empty">
              暂无跨 record 数据：
              {ir1Rows && ir1Rows.length === 0 ? '批量分析返回 0 条有效结果' : '请先运行「Make Graph」或「Statistics」'}
            </div>
          )}
        </div>
        <textarea
          className="s2-txtlist"
          readOnly
          value={txtList}
          title={`Fn[${fn}] = ${fnName}。数值列表：Sheet#（record 序号，从 1 开始）+ 该 record 在当前函数列上的值（IR2 标注）。`}
        />
      </div>
    </div>
  );
}
