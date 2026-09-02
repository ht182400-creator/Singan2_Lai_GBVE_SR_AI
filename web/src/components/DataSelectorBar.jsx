import React, { useEffect, useRef, useState } from 'react';

/**
 * Data1 / Data2 双行数据选择器（复刻 OLD resource.rc IDC_NAME_COMBO2 组合框）。
 *
 * 每行结构：
 *   Data1: Edit | Clear | Open | [path ▼] | < | <(B) | >(N) | > | Go | 枚数 [n] / [total] 枚
 *   Data2: [Sync Move] | Open | [path ▼] | < | <(B) | >(N) | > | Go | 枚数 [n] / [total] 枚
 *
 * 路径框为组合框：input + 下拉箭头，点击箭头展开最近路径列表，选择后写入输入框。
 * Open 触发隐藏 file input，选择本地 .dat 后回调 onOpenFile。
 * Go / 方向键回调由 App.jsx 的 handleOpen / handleNav 处理。
 */
const DEFAULT_PATH = 'E:\\AI_Studio\\NCR_tool\\Singan2_Lai_GBVE_SR_AI\\data\\2A_DA_111017_115542.dat';

/**
 * 单个路径组合框：input + 下拉箭头 + 最近路径列表。
 * @param {Object} props
 * @param {string} props.path 当前路径
 * @param {(string) => void} props.onPathChange 路径变化回调
 * @param {string[]} props.recentPaths 最近路径列表
 */
function PathCombo({ path, onPathChange, recentPaths = [] }) {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);

  useEffect(() => {
    const onClick = (e) => {
      if (ref.current && !ref.current.contains(e.target)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', onClick);
    return () => document.removeEventListener('mousedown', onClick);
  }, []);

  const select = (p) => {
    onPathChange(p);
    setOpen(false);
  };

  return (
    <div className="data-path-combo" ref={ref}>
      <input
        className="data-path"
        value={path}
        onChange={(e) => onPathChange(e.target.value)}
        onKeyDown={(e) => { if (e.key === 'Escape') setOpen(false); }}
      />
      <button
        type="button"
        className="data-path-arrow"
        onClick={() => setOpen((v) => !v)}
        aria-label="展开最近路径"
      >
        ▼
      </button>
      {open && (
        <ul className="data-path-dropdown">
          {recentPaths.map((p, i) => (
            <li key={i} onClick={() => select(p)} title={p}>
              {p}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

/**
 * 单行数据选择器。
 * @param {Object} props
 * @param {boolean} props.isData2 是否为 Data2 行（区别 Edit/Clear 与 Sync Move）
 * @param {string} props.path 当前路径
 * @param {(string) => void} props.setPath 设置路径
 * @param {number} props.count 当前记录号（1 基显示）
 * @param {(number) => void} props.setCount 设置记录号
 * @param {number} props.totalBatch 总记录数
 * @param {string[]} props.recentPaths 最近路径
 * @param {(string) => void} props.pushHistory 操作历史回调
 * @param {(number) => void} props.onNav 方向导航回调
 * @param {(string, number) => void} props.onGo Go 按钮回调
 * @param {() => void} [props.onEdit] Data1 Edit 回调
 * @param {() => void} [props.onClear] Data1 Clear 回调
 */
function DataRow({
  isData2, path, setPath, count, setCount, totalBatch, recentPaths,
  pushHistory, onNav, onGo, onEdit, onClear, onOpenFile,
  syncMove, setSyncMove,
}) {
  const nav = (key, delta) => {
    pushHistory?.(key);
    onNav?.(delta);
  };
  const fileRef = React.useRef(null);

  return (
    <div className="data-selector">
      {!isData2 && (
        <>
          <button type="button" className="btn" onClick={() => { pushHistory?.('Edit'); onEdit?.(); }}>Edit</button>
          <button type="button" className="btn" onClick={() => { pushHistory?.('Clear'); onClear?.(); }}>Clear</button>
        </>
      )}
      {isData2 && (
        <label className="data-label">
          <input
            type="checkbox"
            checked={!!syncMove}
            onChange={(e) => setSyncMove?.(e.target.checked)}
          /> Sync Move
        </label>
      )}
      <button type="button" className="btn" onClick={() => fileRef.current?.click()}>Open</button>
      <input
        ref={fileRef}
        type="file"
        accept=".dat"
        style={{ display: 'none' }}
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) onOpenFile?.(f);
          e.target.value = '';
        }}
      />
      <PathCombo path={path} onPathChange={setPath} recentPaths={recentPaths} />
      <button type="button" className="btn" onClick={() => nav('<', -1)}>&lt;</button>
      <button type="button" className="btn" onClick={() => nav('<(B)', -10)}>&lt;(B)</button>
      <button type="button" className="btn" onClick={() => nav('>(N)', 10)}>&gt;(N)</button>
      <button type="button" className="btn" onClick={() => nav('>', 1)}>&gt;</button>
      <button type="button" className="btn" onClick={() => { pushHistory?.('Go'); onGo?.(path, count); }}>Go</button>
      <span className="data-label">枚数</span>
      <input
        type="number"
        min={1}
        value={count}
        onChange={(e) => setCount(Number(e.target.value))}
        className="data-count"
      />
      <span className="data-divider">/</span>
      <span className="data-total">{totalBatch}</span>
      <span className="data-batch">枚</span>
    </div>
  );
}

/**
 * Data1 / Data2 双行数据选择器容器。
 */
export default function DataSelectorBar({
  pushHistory,
  datPath1, setDatPath1,
  datPath2, setDatPath2,
  record1, recordCount1,
  record2, recordCount2,
  onNav1, onNav2,
  onGo1, onGo2,
  onEdit, onClear,
  onOpenFile1, onOpenFile2,
  syncMove, setSyncMove,
  recentPaths1 = [DEFAULT_PATH],
  recentPaths2 = [DEFAULT_PATH],
}) {
  const [path1, setPath1] = useState(datPath1 ?? DEFAULT_PATH);
  const [path2, setPath2] = useState(datPath2 ?? DEFAULT_PATH);
  const [count1, setCount1] = useState(record1 != null ? record1 + 1 : 1);
  const [count2, setCount2] = useState(record2 != null ? record2 + 1 : 1);

  useEffect(() => {
    if (datPath1 != null) setPath1(datPath1);
  }, [datPath1]);
  useEffect(() => {
    if (datPath2 != null) setPath2(datPath2);
  }, [datPath2]);
  useEffect(() => {
    if (record1 != null) setCount1(record1 + 1);
  }, [record1]);
  useEffect(() => {
    if (record2 != null) setCount2(record2 + 1);
  }, [record2]);

  const totalBatch1 = recordCount1 ?? 0;
  const totalBatch2 = recordCount2 ?? 0;

  return (
    <div className="data-selector-stack">
      <DataRow
        isData2={false}
        path={path1}
        setPath={setPath1}
        count={count1}
        setCount={setCount1}
        totalBatch={totalBatch1}
        recentPaths={recentPaths1}
        pushHistory={pushHistory}
        onNav={onNav1}
        onGo={onGo1}
        onEdit={onEdit}
        onClear={onClear}
        onOpenFile={onOpenFile1}
      />
      <DataRow
        isData2={true}
        path={path2}
        setPath={setPath2}
        count={count2}
        setCount={setCount2}
        totalBatch={totalBatch2}
        recentPaths={recentPaths2}
        pushHistory={pushHistory}
        onNav={onNav2}
        onGo={onGo2}
        onOpenFile={onOpenFile2}
        syncMove={syncMove}
        setSyncMove={setSyncMove}
      />
    </div>
  );
}
