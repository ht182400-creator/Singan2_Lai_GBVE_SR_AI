import React, { useMemo } from 'react';

/**
 * IR 真币图占位画布（仿 MFC CStatic）—— 黑白噪点 + 右端直方图 strip。
 * props: title (左上 label), height, small, withHist (默认 true, 原版所有大图都带直方图)
 */
export default function ImagePane({ title, height, small, withHist = true, onContextMenu }) {
  const cols = small ? 60 : 80;
  const rows = small ? 30 : 50;
  const dots = useMemo(() => {
    const arr = [];
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        const v = ((r * 31 + c * 17) % 100) / 100;
        const darkness = Math.floor((1 - v) * 255);
        arr.push(`${(c * 100 / cols).toFixed(0)}% ${(r * 100 / rows).toFixed(0)}% rgba(${darkness},${darkness},${darkness},0.85)`);
      }
    }
    return arr.join(',');
  }, [rows, cols]);

  // 右端直方图：256 根 1px 灰度柱，模拟 MFC IDC_HISTOGRAM
  const histBars = useMemo(() => {
    const bars = [];
    for (let i = 0; i < 256; i++) {
      // 模拟灰度直方图：暗像素多、亮像素少的钟形分布
      const t = i / 255;
      const h = Math.max(0, Math.floor((1 - Math.abs(t - 0.35) * 1.6) * 100));
      bars.push({ h, dark: i < 128 });
    }
    return bars;
  }, []);

  return (
    <div className="image-pane" style={height ? { height } : null} onContextMenu={onContextMenu}>
      <div className="image-pane-label">{title}</div>
      <div className="image-pane-body">
        <div
          className="image-pane-canvas"
          style={{
            background: `radial-gradient(${cols * 6}px ${rows * 6}px at 50% 50%, #555 0%, #1a1a1a 100%), radial-gradient(circle, ${dots})`,
          }}
        />
        {withHist && (
          <div className="image-pane-hist">
            {histBars.map((b, i) => (
              <span key={i} className="hist-bar" style={{
                height: `${b.h}%`,
                background: b.dark ? '#000' : '#ddd',
              }} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}