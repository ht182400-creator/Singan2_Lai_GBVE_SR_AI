import React, { useState, useEffect } from 'react';

/**
 * 底部状态条（DeepSeek 逆向 y633–670 全宽横跨 0–1283）：
 *  - 左侧：Coordinate File / Function Name File + 当前操作/忙状态
 *  - 右侧：AppStatus 底栏（HongKong / IR offset / GP offset / MODE ...）
 */
export default function BottomStatusRow({ busy = false, busyText = '', busyStart = null }) {
  const [elapsed, setElapsed] = useState(0);
  useEffect(() => {
    if (!busy || !busyStart) {
      setElapsed(0);
      return;
    }
    const tick = () => setElapsed(Math.floor((Date.now() - busyStart) / 1000));
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [busy, busyStart]);

  return (
    <div className="bottom-status">
      <div className="bottom-status-left">
        {busy && (
          <span className="bs-busy" title={busyText}>
            <span className="bs-spinner" /> {busyText} {elapsed > 0 && `(${elapsed}s)`}
          </span>
        )}
        <span>HongKong</span>
        <span>IR offset = 128</span>
        <span>GP offset = 128</span>
        <span>二值图像清</span>
        <span>回忆速度 32</span>
        <span>[MODE] 1</span>
        <span>Normal Mode</span>
      </div>
      <div className="bottom-status-right">
        <div className="bs-row">
          <span className="bs-lbl">Coordinate File:</span>
          <input className="bs-val-input" defaultValue="E:\\AI_Studio\\NCR_tool\\Singan2_Lai_GBVE_SR_OLD" readOnly />
          <button className="btn-tiny">Change</button>
          <button className="btn-tiny">Clear</button>
        </div>
        <div className="bs-row">
          <span className="bs-lbl">Function Name File:</span>
          <input className="bs-val-input" defaultValue="functions.txt" readOnly />
          <button className="btn-tiny">Change port...</button>
        </div>
      </div>
    </div>
  );
}
