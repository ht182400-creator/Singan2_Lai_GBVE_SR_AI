import React, { useMemo } from 'react';
import { buildGraphStats, sigmaCompute } from '../utils/graphStats.js';

/**
 * Make Graph 绘图区：复刻 OLD OnDrawPaint.cpp DrawGraphBoth / OnDrawGraph.cpp 的直方图。
 *
 * 绘图语义：
 *   - 横轴 = 函数列值（value），纵轴 = 该值出现的 record 数（count）。
 *   - 绿色竖线 = 前半记录（file1），蓝色竖线 = 后半记录（file2）。
 *   - 右侧显示 Avg / Std / Min / Max 与 Gap / Middle value。
 *
 * 参数：
 *   - graphData: { rows:[{record, s2[32], etc[12]}] }
 *   - fn: 函数列号 1..44
 *   - include1/include2: 是否显示 file1/file2
 *   - bw: 'black'|'white'（仅用于标题显示）
 *   - area/th: 是否把区域/阈值信息加入标题
 *   - cmp12: 保留参数（复刻 OLD IDC_CHECK_CompareOption），本组件仅用于 Gap 显示兼容
 *   - mousePos/mouseSize/channelLabel/threshold: 标题里显示的 Area / TH 信息
 */
export default function GraphPlot({
  graphData,
  fn = 1,
  include1 = true,
  include2 = true,
  bw = 'black',
  area = true,
  th = true,
  cmp12 = false,
  mousePos = null,
  mouseSize = { w: 20, h: 20 },
  channelLabel = 'IR1',
  threshold = 128,
}) {
  const W = 360;
  const H = 200;
  const padL = 38;
  const padR = 4;
  const padT = 28;
  const padB = 16;
  const gx0 = padL;
  const gx1 = W - padR;
  const gy0 = padT;
  const gy1 = H - padB;
  const gW = gx1 - gx0;
  const gH = gy1 - gy0;

  const { dist1, dist2, stats1, stats2 } = useMemo(
    () => buildGraphStats(graphData, fn, { include1, include2 }),
    [graphData, fn, include1, include2]
  );

  const hasData = dist1.length > 0 || dist2.length > 0;

  const allValues = useMemo(() => {
    const a = [];
    dist1.forEach((d) => a.push(d.value));
    dist2.forEach((d) => a.push(d.value));
    return a;
  }, [dist1, dist2]);

  const allCounts = useMemo(() => {
    const a = [];
    dist1.forEach((d) => a.push(d.count));
    dist2.forEach((d) => a.push(d.count));
    return a;
  }, [dist1, dist2]);

  const minValue = allValues.length ? Math.min(...allValues) : 0;
  const maxValue = allValues.length ? Math.max(...allValues) : 0;
  const allSame = allValues.length > 0 && maxValue === minValue;
  const valueRange = Math.max(1e-9, maxValue - minValue);
  const maxCount = allCounts.length ? Math.max(...allCounts) : 1;

  const xOf = (v) => gx0 + ((v - minValue) / valueRange) * gW;
  const yOf = (c) => gy1 - (c / maxCount) * gH;

  // 当某函数列在所有 record 取相同值时，按绘制序号均匀铺开，避免柱状图全挤在左边缘看不见
  let barSeq = 0;
  const xBar = (v) => {
    if (allSame) {
      const total = (dist1.length + dist2.length) || 1;
      const idx = barSeq++;
      return gx0 + ((idx + 0.5) / total) * gW;
    }
    return xOf(v);
  };

  const bars1 = dist1.map((d, i) => (
    <line
      key={`g1-${i}`}
      x1={xBar(d.value)}
      y1={gy1}
      x2={xBar(d.value)}
      y2={yOf(d.count)}
      stroke="#0b0"
      strokeWidth="1.2"
    />
  ));
  const bars2 = dist2.map((d, i) => (
    <line
      key={`g2-${i}`}
      x1={xBar(d.value)}
      y1={gy1}
      x2={xBar(d.value)}
      y2={yOf(d.count)}
      stroke="#00f"
      strokeWidth="1.2"
    />
  ));

  // 网格线：横 8 条，纵 8 条
  const hLines = [];
  for (let i = 0; i <= 8; i++) {
    const y = gy0 + (i / 8) * gH;
    hLines.push(<line key={`h${i}`} x1={gx0} y1={y} x2={gx1} y2={y} stroke="#e0e0e0" strokeWidth="0.5" />);
  }
  const vLines = [];
  for (let i = 0; i <= 8; i++) {
    const x = gx0 + (i / 8) * gW;
    vLines.push(<line key={`v${i}`} x1={x} y1={gy0} x2={x} y2={gy1} stroke="#e0e0e0" strokeWidth="0.5" />);
  }

  // 左侧 Y 轴刻度（count）
  const yLabels = [];
  for (let i = 0; i <= 8; i++) {
    const y = gy0 + (i / 8) * gH;
    const val = Math.round((1 - i / 8) * maxCount);
    yLabels.push(
      <text key={`yl${i}`} x={2} y={y + 3} fontSize="7" fill="#666" fontFamily="monospace">{val}</text>
    );
  }

  // 底部 X 轴刻度（value）
  const xLabels = [];
  for (let i = 0; i <= 8; i++) {
    const x = gx0 + (i / 8) * gW;
    const val = Math.round(minValue + (i / 8) * valueRange);
    xLabels.push(
      <text key={`xl${i}`} x={x - 10} y={H - 2} fontSize="7" fill="#666" fontFamily="monospace">{val}</text>
    );
  }

  // 标题区域信息
  const areaText = useMemo(() => {
    if (!area || !mousePos) return '';
    const x1 = mousePos.x;
    const y1 = mousePos.y;
    const x2 = x1 + mouseSize.w;
    const y2 = y1 + mouseSize.h;
    return `Area[ ${x1}, ${y1}, ${x2}, ${y2} ] (${mouseSize.w} x ${mouseSize.h}) [${channelLabel}${th ? ` - TH (${threshold})` : ''}]`;
  }, [area, mousePos, mouseSize, channelLabel, th, threshold]);

  // Gap / Middle value（复刻 OLD DrawGraphBoth 的 absDiff 逻辑）
  // OLD 代码会同时处理两种分离方向：
  //   Graph2 整体高于 Graph1：lastMin2 - lastMax1 > 0
  //   Graph1 整体高于 Graph2：lastMin1 - lastMax2 > 0
  // 只要两组数据范围不重叠，就计算 Gap 并在中间画红色区分线。
  const gapInfo = useMemo(() => {
    if (!stats1.count || !stats2.count) return null;
    const lastMin1 = stats1.min;
    const lastMax1 = stats1.max;
    const lastMin2 = stats2.min;
    const lastMax2 = stats2.max;
    let absDiff = 0;
    let middle = 0;
    let d1Name = '';
    let d2Name = '';
    if (lastMin2 - lastMax1 > 0) {
      // Graph2（蓝色）整体高于 Graph1（绿色）
      absDiff = lastMin2 - lastMax1;
      middle = (lastMax1 + lastMin2) / 2;
      d1Name = `Graph1=${lastMax1.toFixed(0)}`;
      d2Name = `Graph2=${lastMin2.toFixed(0)}`;
    } else if (lastMin1 - lastMax2 > 0) {
      // Graph1（绿色）整体高于 Graph2（蓝色）
      absDiff = lastMin1 - lastMax2;
      middle = (lastMax2 + lastMin1) / 2;
      d1Name = `Graph1=${lastMin1.toFixed(0)}`;
      d2Name = `Graph2=${lastMax2.toFixed(0)}`;
    } else {
      // 两范围重叠，无 Gap
      return { absDiff: 0, middle: 0, sig1: 0, sig2: 0, d1Name: '', d2Name: '' };
    }
    const sig1 = sigmaCompute(stats1.std, stats1.avg, middle);
    const sig2 = sigmaCompute(stats2.std, stats2.avg, middle);
    return { absDiff, middle, sig1, sig2, d1Name, d2Name };
  }, [stats1, stats2]);

  return (
    <div className="graph-plot">
      <div className="gp-header">
        <span className="gp-area">
          {areaText || '（先点 Make Graph 生成跨 record 曲线）'}
        </span>
        <span className="gp-gap">Gap: {gapInfo ? String(Math.round(gapInfo.absDiff)).padStart(3, '0') : '000'}</span>
      </div>
      <div className="gp-body">
        <svg className="gp-svg" viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none">
          {hLines}
          {vLines}
          <line x1={gx0} y1={gy1} x2={gx1} y2={gy1} stroke="#999" strokeWidth="0.7" />
          <line x1={gx0} y1={gy0} x2={gx0} y2={gy1} stroke="#999" strokeWidth="0.7" />
          {yLabels}
          {xLabels}
          {hasData ? bars1 : null}
          {hasData ? bars2 : null}
          {gapInfo?.middle != null && gapInfo.middle > 0 && (
            <line
              x1={xOf(gapInfo.middle)}
              y1={gy1}
              x2={xOf(gapInfo.middle)}
              y2={gy0}
              stroke="#f00"
              strokeWidth="0.7"
              strokeDasharray="2,2"
            />
          )}
        </svg>
        <div className="gp-stats">
          {stats1.count > 0 && (
            <>
              <div>1: Avg={stats1.avg.toFixed(0)}, Std={stats1.std.toFixed(0)}, {stats1.min.toFixed(0)}-{stats1.max.toFixed(0)}</div>
              {stats2.count > 0 && (
                <div>2: Avg={stats2.avg.toFixed(0)}, Std={stats2.std.toFixed(0)}, {stats2.min.toFixed(0)}-{stats2.max.toFixed(0)}</div>
              )}
            </>
          )}
          {gapInfo && gapInfo.absDiff > 0 && (
            <>
              <div>Gap: {gapInfo.absDiff.toFixed(0)}</div>
              <div>{gapInfo.d1Name}</div>
              <div>{gapInfo.d2Name}</div>
              <div>Sig({gapInfo.sig1.toFixed(2)} / {gapInfo.sig2.toFixed(2)})</div>
              <div>Mid {gapInfo.middle.toFixed(0)}</div>
            </>
          )}
          {(!stats1.count && !stats2.count) && (
            <>
              <div>1: Avg= 0, Std= 0, 0- 0</div>
              <div>2: Avg= 0, Std= 0, 0- 0</div>
              <div>Black: 0</div>
              <div>White: 0</div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
