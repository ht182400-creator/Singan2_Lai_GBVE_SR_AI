import React, { useMemo } from 'react';
import GraphPlot from './GraphPlot.jsx';
import { S2_FUNC_NAMES } from '../utils/analysis.js';

const ETC_LABELS = Array.from({ length: 12 }, (_, i) => `ETC[${i + 1}]`);

/**
 * Graph 视图覆盖层：复刻 MFC Switch View 后的界面。
 *
 * 布局：
 *   - 左侧：GraphPlot（跨 record 直方图）
 *   - 右侧：函数列表（S2[1..32]）+ View All Result / Switch View 按钮
 *
 * 功能：
 *   - 选择函数列即时切换 graphFn
 *   - View All Result：将 Statistics / Make Graph 生成的跨 record 数据导出为 CSV
 */
export default function GraphViewOverlay({
  graphData,
  batchStatsAll,
  fn = 1,
  setFn,
  pushHistory,
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
  onViewAllResult,
  onClose,
}) {
  const items = useMemo(
    () => S2_FUNC_NAMES.map((name, i) => `[${String(i + 1).padStart(2, ' ')}:${name}]`),
    []
  );
  const hasData = (batchStatsAll?.length || graphData?.rows?.length) > 0;

  const handleSelect = (e) => {
    const idx = Number(e.target.value);
    const next = idx + 1;
    setFn?.(next);
    pushHistory?.(`Graph Fn[${next}] ${S2_FUNC_NAMES[idx] || ''}`.trim());
  };

  return (
    <div className="graph-view-overlay" role="dialog" aria-label="Graph View">
      <div className="gvo-left">
        <GraphPlot
          graphData={graphData}
          fn={fn}
          include1={include1}
          include2={include2}
          bw={bw}
          area={area}
          th={th}
          cmp12={cmp12}
          mousePos={mousePos}
          mouseSize={mouseSize}
          channelLabel={channelLabel}
          threshold={threshold}
        />
      </div>
      <div className="gvo-right">
        <div className="gvo-title">Function List</div>
        <select
          className="gvo-list"
          size={24}
          value={fn - 1}
          onChange={handleSelect}
          title="选择要绘制的函数列（对应 OLD IDC_LIST_GR）"
        >
          {items.map((label, i) => (
            <option key={i} value={i}>
              {label}
            </option>
          ))}
        </select>
        <div className="gvo-actions">
          <button
            className="btn btn-xs gvo-view-all"
            onClick={onViewAllResult}
            disabled={!hasData}
            title={hasData ? '导出全部 record 的 S2/ETC 数值为 CSV' : '请先运行 Statistics 或 Make Graph'}
          >
            View All Result
          </button>
          <button className="btn btn-xs" onClick={onClose} title="返回图像视图">
            Switch View
          </button>
        </div>
        {!hasData && (
          <div className="gvo-hint">
            提示：请先运行 Statistics 或 Make Graph，生成跨 record 数据后再点击 View All Result。
          </div>
        )}
      </div>
    </div>
  );
}

export { S2_FUNC_NAMES, ETC_LABELS };
