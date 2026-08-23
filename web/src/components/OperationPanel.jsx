import React, { useState } from 'react';

/**
 * 右侧 Operation 区（仿 MFC IDC_STATIC_OPERATION）—— 严格对齐原版布局：
 *  行 1: Real | Test       （radio：选 Real/Test）
 *  行 2: ☑Check note | Reason | Function processing | Other mode （4 个 checkbox）
 *  行 3: IR-Vi | Normal Id | Manual Lw | Thickness | Standard | End Processing | reserved  （7 按钮）
 *  行 4: F1~F8 ＋ Ope. (Start) |  Load VER... （function 选择下拉 + 加载按钮）
 */
const FUNCS = ['F1', 'F2', 'F3', 'F4', 'F5', 'F6', 'F7', 'F8'];

export default function OperationPanel({ pushHistory }) {
  const [mode, setMode] = useState('Real');
  const [checkNote, setCheckNote] = useState(true);
  const [reason, setReason] = useState(false);
  const [funcProc, setFuncProc] = useState(false);
  const [otherMode, setOtherMode] = useState(false);
  const [func, setFunc] = useState('F1');

  const btn = (label) => (
    <button key={label} className="btn btn-xs" onClick={() => pushHistory?.(label)}>{label}</button>
  );

  return (
    <fieldset className="op-compact">
      <legend>Operation</legend>

      {/* 行 1: Real / Test radio */}
      <div className="op-row op-row1">
        <label>
          <input type="radio" name="op-mode" checked={mode === 'Real'}
            onChange={() => { setMode('Real'); pushHistory?.('Mode → Real'); }} />
          Real
        </label>
        <label>
          <input type="radio" name="op-mode" checked={mode === 'Test'}
            onChange={() => { setMode('Test'); pushHistory?.('Mode → Test'); }} />
          Test
        </label>
      </div>

      {/* 行 2: 4 个 checkbox */}
      <div className="op-row op-row2">
        <label>
          <input type="checkbox" checked={checkNote}
            onChange={(e) => setCheckNote(e.target.checked)} />
          Check note
        </label>
        <label>
          <input type="checkbox" checked={reason}
            onChange={(e) => setReason(e.target.checked)} />
          Reason
        </label>
        <label>
          <input type="checkbox" checked={funcProc}
            onChange={(e) => setFuncProc(e.target.checked)} />
          Function processing
        </label>
        <label>
          <input type="checkbox" checked={otherMode}
            onChange={(e) => setOtherMode(e.target.checked)} />
          Other mode
        </label>
      </div>

      {/* 行 3: 7 个按钮 */}
      <div className="op-row op-row3">
        {btn('IR-Vi')}{btn('Normal Id')}{btn('Manual Lw')}
        {btn('Thickness')}{btn('Standard')}{btn('End Processing')}{btn('reserved')}
      </div>

      {/* 行 4: F1~F8 按钮组（原版 X:780-900, Y:420-440） */}
      <div className="op-row op-row4">
        {FUNCS.map((f) => (
          <button key={f} className="btn btn-fkey" onClick={() => pushHistory?.(f)}>{f}</button>
        ))}
      </div>

      {/* 行 5: Ope. (Start)（原版右下角独立按钮）+ 函数选择 + Load VER... */}
      <div className="op-row op-row5">
        <select value={func} onChange={(e) => setFunc(e.target.value)} className="op-func-select">
          {FUNCS.map((f) => <option key={f} value={f}>{f}</option>)}
        </select>
        <button className="btn btn-xs" onClick={() => pushHistory?.('Load VER...')}>Load VER...</button>
        <button className="btn btn-start" onClick={() => pushHistory?.('Ope. (Start)')}>Ope. (Start)</button>
      </div>
    </fieldset>
  );
}