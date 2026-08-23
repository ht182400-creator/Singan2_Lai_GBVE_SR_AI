import React, { useState } from 'react';

/**
 * 状态栏：Coordinate File + Function Name File + Change
 * （自给自足：可点击 Change 通过回调触发父组件弹 dialog）
 */
export default function StatusBar({ onChangeCoord, onChangeFunc }) {
  const [coord] = useState('E:\\WS_Studi\\WRK_tool\\Kingzo\\Jia_GBVE_SR_AtlaKataWORK_ATL_240_10309\\85901.txt');
  const [func] = useState('functions.txt');
  return (
    <div className="status-bar">
      <span className="status-label">Coordinate File:</span>
      <span className="status-value">{coord}</span>
      <button className="btn-xs" onClick={onChangeCoord}>Change</button>
      <span className="status-label" style={{ marginLeft: 12 }}>Function Name File:</span>
      <span className="status-value">{func}</span>
      <button className="btn-xs" onClick={onChangeFunc}>Change</button>
    </div>
  );
}