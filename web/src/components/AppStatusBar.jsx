import React from 'react';

/**
 * 应用底栏：Hongkong / IR offset = 128 / GP offset = 128 / 切替機種機種通報 / MODE 1 / Normal Mode / 切替済 / 位置調整 / 標準機時 / 0%
 */
export default function AppStatusBar() {
  return (
    <div className="app-status-bar">
      <span className="status-item">Hongkong</span>
      <span className="status-item">IR offset = 128</span>
      <span className="status-item">GP offset = 128</span>
      <span className="status-item">切替機種機種通報</span>
      <span className="status-item">MODE 1</span>
      <span className="status-item">Normal Mode</span>
      <span className="status-item">切替済</span>
      <span className="status-item">位置調整</span>
      <span className="status-item">標準機時</span>
      <span className="status-spacer" />
      <span className="status-item">0%</span>
    </div>
  );
}