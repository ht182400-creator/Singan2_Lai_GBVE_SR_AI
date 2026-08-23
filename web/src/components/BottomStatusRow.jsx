import React from 'react';

/**
 * 底部状态条（DeepSeek 逆向 y660 全宽横跨 0–1283）：
 *  - Coordinate File: 输入框 + Change
 *  - Function Name File: 输入框 + Change
 *  - AppStatus 底栏（HongKong / IR offset / GP offset / MODE / 0% ...）
 */
export default function BottomStatusRow({ coordFileName, funcNameFile, onChangeCoord, onChangeFunc }) {
  return (
    <>
    <div className="bs-coord">
      <div className="bs-row">
        <span className="bs-lbl">Coordinate File:</span>
        <input className="bs-val-input" defaultValue={coordFileName} />
        <button className="btn-xs" onClick={onChangeCoord}>Change</button>
      </div>
      <div className="bs-row">
        <span className="bs-lbl">Function Name File:</span>
        <input className="bs-val-input" defaultValue={funcNameFile} />
        <button className="btn-xs" onClick={onChangeFunc}>Change</button>
      </div>
    </div>
    <div className="bottom-status">
      <div className="bs-app">
        <span>HongKong</span>
        <span>IR offset = 128</span>
        <span>GP offset = 128</span>
        <span>二值图像清</span>
        <span>回忆速度 32</span>
        <span>[MODE] 1</span>
        <span>Normal Mode</span>
        <span className="bs-spacer" />
        <span>-25%</span>
      </div>
    </div>
    </>
  );
}
