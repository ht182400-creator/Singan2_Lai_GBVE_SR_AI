import React, { useEffect, useState } from 'react';

/**
 * 原版 Data1/Data2 双行数据选择器（嵌入在两张真币图之间）：
 *   Row 1 (Data1): Edit | Clear | [path] | < | <(B) | >(N) > | Go | 1 / 4 / 40
 *   Row 2 (Data2): Sync Move | [path] | < | <(C) | >(2) > | Go | 1 / 6 / 40
 *
 * 功能接线（P0 基础数据链路，对应 MFC WinMain.cpp 的 NEXT/BACK/DATA_GO）：
 *   <      → 记录 -1        (IDC_BACK)
 *   <(B)   → 记录 -10       (IDC_BACK10)
 *   >(N)   → 记录 +10       (IDC_NEXT10)
 *   >      → 记录 +1        (IDC_NEXT)
 *   Go     → 打开/跳转（IDC_BUTTON_DATA_GO1：按路径 open，枚数框=跳转目标记录号）
 * 未传回调时保持纯 UI 行为（pushHistory 记日志），不破坏既有测试。
 */
const DEFAULT_PATH_1 = 'E:\\AI_Studio\\NCR_tool\\Singan2_Lai_GBVE_SR_AI\\data\\2A_DA_111017_115542.dat';
const DEFAULT_PATH_2 = 'E:\\AI_Studio\\NCR_tool\\Singan2_Lai_GBVE_SR_AI\\data\\2A_DA_111017_115542.dat';

function DataRow({
  isData2, path, setPath, count, setCount, totalBatch, pushHistory,
  onNav, onGo, onEdit, onClear,
}) {
  const nav = (key, delta) => {
    pushHistory?.(key);
    onNav?.(delta);
  };
  return (
    <div className="data-selector">
      {!isData2 && (
        <>
          <button className="btn" onClick={() => { pushHistory?.('Edit'); onEdit?.(); }}>Edit</button>
          <button className="btn" onClick={() => { pushHistory?.('Clear'); onClear?.(); }}>Clear</button>
        </>
      )}
      {isData2 && (
        <label className="data-label">
          <input type="checkbox" defaultChecked /> Sync Move
        </label>
      )}
      <input
        className="data-path"
        value={path}
        onChange={(e) => setPath(e.target.value)}
      />
      <button className="btn" onClick={() => nav('<', -1)}>&lt;</button>
      <button className="btn" onClick={() => nav('<(B)', -10)}>&lt;(B)</button>
      <button className="btn" onClick={() => nav('>(N)', 10)}>&gt;(N)</button>
      <button className="btn" onClick={() => nav('>', 1)}>&gt;</button>
      <button className="btn" onClick={() => { pushHistory?.('Go'); onGo?.(path, count); }}>Go</button>
      <span className="data-label">枚数</span>
      <input
        type="number" min={1} value={count}
        onChange={(e) => setCount(Number(e.target.value))}
        className="data-count"
      />
      <span className="data-divider">/</span>
      <span className="data-total">{totalBatch}</span>
      <span className="data-batch">40</span>
    </div>
  );
}

export default function DataSelectorBar({
  pushHistory,
  datPath, setDatPath,
  record, recordCount,
  onNav, onGo, onEdit, onClear,
}) {
  const [path1, setPath1] = useState(datPath ?? DEFAULT_PATH_1);
  const [path2, setPath2] = useState(datPath ?? DEFAULT_PATH_2);
  // 枚数框 = 当前记录号（1 基显示，可编辑作为跳转目标）
  const [count1, setCount1] = useState(record != null ? record + 1 : 1);
  const [count2, setCount2] = useState(record != null ? record + 1 : 1);
  const totalBatch1 = recordCount ?? 4;
  const totalBatch2 = recordCount ?? 6;

  useEffect(() => {
    if (datPath != null) {
      setPath1(datPath);
      setPath2(datPath);
    }
  }, [datPath]);
  useEffect(() => {
    if (record != null) {
      setCount1(record + 1);
      setCount2(record + 1);
    }
  }, [record]);

  return (
    <div className="data-selector-stack">
      <DataRow
        isData2={false} path={path1} setPath={setPath1} count={count1}
        setCount={setCount1} totalBatch={totalBatch1} pushHistory={pushHistory}
        onNav={onNav}
        onGo={(p, n) => onGo?.(p, n)}
        onEdit={onEdit} onClear={onClear}
      />
      <DataRow
        isData2={true} path={path2} setPath={setPath2} count={count2}
        setCount={setCount2} totalBatch={totalBatch2} pushHistory={pushHistory}
        onNav={onNav}
        onGo={(p, n) => onGo?.(p, n)}
      />
    </div>
  );
}
