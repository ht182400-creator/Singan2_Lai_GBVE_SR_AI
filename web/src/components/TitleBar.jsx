import React from 'react';

/**
 * 窗口顶部标题栏（原版 Authentic2(20060112) 31 denomination supplemental function | Adjust to 1400x1050）
 * 严格对照原版：
 *  - 左：App 标题（固定文字）
 *  - 右：Demonstration supplemental function 标记 + Adjust to 1400x1050 缩放按钮
 */
export default function TitleBar({ onResize }) {
  return (
    <div className="title-bar">
      <span className="title-bar-text">
        Authentic2(20060112) 31 denomination supplemental function
      </span>
      <span style={{ flex: 1 }} />
      <button
        className="title-bar-resize"
        onClick={() => onResize?.('1400x1050')}
        title="Adjust to 1400x1050"
      >
        Adjust to 1400x1050
      </button>
    </div>
  );
}