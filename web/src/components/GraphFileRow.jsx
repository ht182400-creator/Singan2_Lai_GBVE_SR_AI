import React from 'react';

/**
 * Graph 操作区（1:1 复刻 OLD resource.rc 991-1279, y265-341）：
 * - IDC_EDIT_GRAPH_FILE_NAME  (997,265,256)  图形文件名编辑框（原版无 handler，仅存储名称）
 * - IDC_LIST_GRAPH_FUNS       (991,280,106x60) 测量方法列表，供 Make Graph 的 ComputeSuppleResult：
 *     0 - Sum pixels / 1 - width / 2 - height (TBD) / 3 - differenct neighbour / 4 - (TBD)
 * - IDC_BUTTON_GRAPH_MULTI "Mul-X" + IDC_EDIT_GRAPH_MULTI (1098,283)  原版死控件（无 handler，TBD）
 * - IDC_BUTTON_GRAPH1_2_DETRACT_ABS "ABS (Graph1 - Graph2)" (1097,299)  原版死控件
 * - IDC_BUTTON_LOAD_GRAPH "Load Graph..." (1190,284)  载入 .GPH 并加入名单立即显示
 * - IDC_BUTTON_SAVE_GRAPH "Save Graph"   (1190,299)  当前序列存为 <名字>.GPH
 * - IDC_BUTTON_CLEAR_GRAPH_LIST "Clear"  (1098,326)  清空已载名单（原版 IDC_EDIT_AREA_LIST 为隐藏多行框）
 * - IDC_BUTTON_MAKE_COMBINE_GRAPH "Graph (Combine)" (1172,325)  名单内全部 .GPH 累加显示
 *
 * 注：Mul-X / ABS 按钮按原版行为「无实现」处理——点击仅记 History 提示 TBD，不伪造功能。
 */
export default function GraphFileRow({
  gphName, setGphName,
  resultMethod, setResultMethod,
  onLoadGraph, onSaveGraph, onClearList, onCombine,
  onContextMenu,
}) {
  const FUNS = [
    '0 - Sum pixels',
    '1 - width',
    '2 - height (TBD)',
    '3 - differenct neighbour',
    '4 - (TBD)',
  ];
  return (
    <div className="graph-ops" onContextMenu={onContextMenu}>
      {/* 图形文件名（IDC_EDIT_GRAPH_FILE_NAME） */}
      <input
        className="graph-ops-name"
        value={gphName}
        onChange={(e) => setGphName(e.target.value)}
        placeholder="graph file name"
      />

      <div className="graph-ops-mid">
        {/* 测量方法列表（IDC_LIST_GRAPH_FUNS，Make Graph 用） */}
        <select
          className="graph-ops-funs"
          size={5}
          value={String(resultMethod)}
          onChange={(e) => setResultMethod(Number(e.target.value))}
          title="Make Graph 测量方法（ComputeSuppleResult）"
        >
          {FUNS.map((f, i) => (
            <option key={f} value={String(i)}>{f}</option>
          ))}
        </select>

        {/* Mul-X + 编辑框 / ABS（原版死控件，位置 1:1，点击提示 TBD）+ Load/Save（右列） */}
        <div className="graph-ops-col2">
          <div className="graph-ops-line">
            <button className="btn" onClick={() => onTbd('Mul-X')}
              title="原版无实现（TBD）">Mul-X</button>
            <input className="graph-ops-num" defaultValue="1" readOnly title="原版无实现（TBD）" />
          </div>
          <div className="graph-ops-line">
            <button className="btn graph-ops-abs" onClick={() => onTbd('ABS (Graph1 - Graph2)')}
              title="原版无实现（TBD）">ABS (Graph1 - Graph2)</button>
          </div>
        </div>
        <div className="graph-ops-col3">
          <button className="btn" onClick={onLoadGraph}>Load Graph...</button>
          <button className="btn" onClick={onSaveGraph}>Save Graph</button>
        </div>
      </div>

      {/* Clear + Graph (Combine)（IDC_BUTTON_CLEAR_GRAPH_LIST / IDC_BUTTON_MAKE_COMBINE_GRAPH） */}
      <div className="graph-ops-bottom">
        <button className="btn" onClick={onClearList}>Clear</button>
        <button className="btn graph-ops-combine" onClick={onCombine}>Graph (Combine)</button>
      </div>

      {/* 使用说明（用户要求在面板内说明死控件与各按钮功能） */}
      <div className="graph-ops-help">
        说明：列表选择 Make Graph 测量方法（0=黑/白像素数，1=黑/白水平跨度，3=相邻差分&gt;阈值累加）。
        Load Graph 载入 .GPH 并入名单；Save Graph 按上方文件名存当前序列；Combine 将名单内全部 .GPH 逐点累加显示。
        Mul-X（序列×倍数）与 ABS（|Graph1−Graph2|）原版未实现（TBD），点击仅提示。
      </div>
    </div>
  );
}

// 原版死控件统一提示（Mul-X / ABS 在 OLD WinMain 无任何 case，属 TBD 功能）
function onTbd(label) {
  window.alert(`${label}: original MFC has no handler for this control (TBD).`);
}
