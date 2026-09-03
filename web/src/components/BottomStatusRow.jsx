import React, { useState, useEffect } from 'react';

/**
 * 底部状态条（y633–670 全宽横跨）：
 *  - 左侧：当前操作/忙状态 + 运行模式信息（HongKong / IR offset / GP offset / MODE ...）
 *  - Coordinate File / Function Name File 已移入右侧 .rc-file-paths 容器
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
    </div>
  );
}
