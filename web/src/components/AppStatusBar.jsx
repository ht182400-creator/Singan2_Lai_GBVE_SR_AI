import React from 'react';

/**
 * 应用底栏（右侧状态栏）：
 *  左侧放置 Coordinate File / Function Name File 两行输入
 *  右侧保留原版状态信息
 */
export default function AppStatusBar() {
  return (
    <div className="app-status-bar">
      <div className="app-status-left">
        <div className="app-status-row">
          <span className="bs-lbl">Coordinate File:</span>
          <input className="bs-val-input" defaultValue="E:\\AI_Studio\\NCR_tool\\Singan2_Lai_GBVE_SR_OLD" readOnly />
          <button className="btn-tiny">Change</button>
          <button className="btn-tiny">Clear</button>
        </div>
        <div className="app-status-row">
          <span className="bs-lbl">Function Name File:</span>
          <input className="bs-val-input" defaultValue="functions.txt" readOnly />
          <button className="btn-tiny">Change port...</button>
        </div>
      </div>
      <span className="status-spacer" />
      <div className="app-status-right">
        <span className="status-item">HongKong</span>
        <span className="status-item">IR offset = 128</span>
        <span className="status-item">GP offset = 128</span>
        <span className="status-item">二值图像清</span>
        <span className="status-item">回忆速度 32</span>
        <span className="status-item">[MODE] 1</span>
        <span className="status-item">Normal Mode</span>
        <span className="status-item">-25%</span>
      </div>
    </div>
  );
}
