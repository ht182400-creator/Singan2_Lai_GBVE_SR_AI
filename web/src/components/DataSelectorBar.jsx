import React, { useState } from 'react';

/**
 * 原版 Data1/Data2 双行数据选择器（嵌入在两张真币图之间）：
 *   Row 1 (Data1): Edit | Clear | [path] | < | <(B) | >(N) > | Go | 1 / 4 / 40
 *   Row 2 (Data2): Sync Move | [path] | < | <(C) | >(2) > | Go | 1 / 6 / 40
 */
const DEFAULT_PATH_1 = 'E:\\A1_Studio\\NCR_tool\\Singan2_Lai_GBVE_SR_AI\\data\\2A_DA_111017_115542.dat';
const DEFAULT_PATH_2 = 'E:\\A1_Studio\\NCR_tool\\Singan2_Lai_GBVE_SR_AI\\data\\2A_DA_111017_115542.dat';

function DataRow({ isData2, path, setPath, count, setCount, totalBatch, pushHistory }) {
  return (
    <div className="data-selector">
      {!isData2 && (
        <>
          <button className="btn" onClick={() => pushHistory?.('Edit')}>Edit</button>
          <button className="btn" onClick={() => pushHistory?.('Clear')}>Clear</button>
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
      <button className="btn" onClick={() => pushHistory?.(`<`)}>&lt;</button>
      <button className="btn" onClick={() => pushHistory?.(`<(B)`)}>&lt;(B)</button>
      <button className="btn" onClick={() => pushHistory?.(`>(N)`)}>&gt;(N)</button>
      <button className="btn" onClick={() => pushHistory?.(`>`)}>&gt;</button>
      <button className="btn" onClick={() => pushHistory?.('Go')}>Go</button>
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

export default function DataSelectorBar({ pushHistory }) {
  const [path1, setPath1] = useState(DEFAULT_PATH_1);
  const [path2, setPath2] = useState(DEFAULT_PATH_2);
  const [count1, setCount1] = useState(1);
  const [count2, setCount2] = useState(1);
  const totalBatch1 = 4;
  const totalBatch2 = 6;
  return (
    <div className="data-selector-stack">
      <DataRow isData2={false} path={path1} setPath={setPath1} count={count1}
        setCount={setCount1} totalBatch={totalBatch1} pushHistory={pushHistory} />
      <DataRow isData2={true} path={path2} setPath={setPath2} count={count2}
        setCount={setCount2} totalBatch={totalBatch2} pushHistory={pushHistory} />
    </div>
  );
}