import React, { useState } from 'react';

/**
 * 右侧 Operation 区 —— ⚠️ Web 占位面板，原版 MFC 无此控件组。
 * 经全量比对 OLD 源码（resource.rc / WinMain.cpp / SProc.cpp 等）：
 * "Real/Test radio、Check note/Reason/Function processing/Other mode checkbox、
 *  IR-Vl/Normal Id/Manual Lw/Thickness/Standard/End Processing/reserved 按钮、
 *  F1~F8、Load VER...、Ope. (Start)" 均无任何对应控件 ID 或处理代码，
 * 疑似早期对照其它软件界面误建。2026-09-04 起**全部禁用仅作展示**并附说明。
 */
const FUNCS = ['F1', 'F2', 'F3', 'F4', 'F5', 'F6', 'F7', 'F8'];

export default function OperationPanel({ pushHistory, onRun }) {
  // 保留原 state 结构以便将来考证出真实语义后恢复；当前全部 disabled。
  const [mode, setMode] = useState('Real');
  const [checkNote, setCheckNote] = useState(true);
  const [reason, setReason] = useState(false);
  const [funcProc, setFuncProc] = useState(false);
  const [otherMode, setOtherMode] = useState(false);
  const [func, setFunc] = useState('F1');

  const btn = (label) => (
    <button key={label} className="btn btn-xs" disabled
      title="原版 MFC 无此控件（Web 占位，未启用）">{label}</button>
  );

  return (
    <fieldset className="op-compact">
      <legend>Operation</legend>

      {/* 占位说明（用户要求：OLD 无对应功能 → disable 显示 + 说明） */}
      <div className="legacy-note">
        ⚠ Web 占位面板：原版 MFC 源码（resource.rc / WinMain.cpp）无此控件组，功能未启用。
      </div>

      {/* 行 1: Real / Test radio */}
      <div className="op-row op-row1">
        <label>
          <input type="radio" name="op-mode" checked={mode === 'Real'} disabled
            onChange={() => { setMode('Real'); pushHistory?.('Mode → Real'); }} />
          Real
        </label>
        <label>
          <input type="radio" name="op-mode" checked={mode === 'Test'} disabled
            onChange={() => { setMode('Test'); pushHistory?.('Mode → Test'); }} />
          Test
        </label>
      </div>

      {/* 行 2: 4 个 checkbox */}
      <div className="op-row op-row2">
        <label>
          <input type="checkbox" checked={checkNote} disabled
            onChange={(e) => setCheckNote(e.target.checked)} />
          Check note
        </label>
        <label>
          <input type="checkbox" checked={reason} disabled
            onChange={(e) => setReason(e.target.checked)} />
          Reason
        </label>
        <label>
          <input type="checkbox" checked={funcProc} disabled
            onChange={(e) => setFuncProc(e.target.checked)} />
          Function processing
        </label>
        <label>
          <input type="checkbox" checked={otherMode} disabled
            onChange={(e) => setOtherMode(e.target.checked)} />
          Other mode
        </label>
      </div>

      {/* 行 3: 7 个按钮 */}
      <div className="op-row op-row3">
        {btn('IR-Vi')}{btn('Normal Id')}{btn('Manual Lw')}
        {btn('Thickness')}{btn('Standard')}{btn('End Processing')}{btn('reserved')}
      </div>

      {/* 行 4: F1~F8 按钮组 */}
      <div className="op-row op-row4">
        {FUNCS.map((f) => (
          <button key={f} className="btn btn-fkey" disabled
            title="原版 MFC 无此控件（Web 占位，未启用）">{f}</button>
        ))}
      </div>

      {/* 行 5: 函数选择 + Load VER... + Ope. (Start) */}
      <div className="op-row op-row5">
        <select value={func} onChange={(e) => setFunc(e.target.value)} className="op-func-select" disabled>
          {FUNCS.map((f) => <option key={f} value={f}>{f}</option>)}
        </select>
        <button className="btn btn-xs" disabled title="原版 MFC 无此控件（Web 占位，未启用）"
          onClick={() => pushHistory?.('Load VER...')}>Load VER...</button>
        <button className="btn btn-start" disabled title="原版 MFC 无此控件（Web 占位，未启用）"
          onClick={() => { pushHistory?.('Ope. (Start)'); onRun?.(); }}>Ope. (Start)</button>
      </div>
    </fieldset>
  );
}