import React, { useMemo } from 'react';

/**
 * 用 ECharts 画 S2 数组线图；若 ECharts 未加载则降级 SVG。
 * 接受 small=true → 缩小版用于 multi-view。
 */
export default function S2Chart({ data, s2, small, params }) {
  // 兼容 data 与旧 s2 两种 prop 名，且兜底为空数组，避免 undefined.map 崩溃
  const arr = Array.isArray(data) ? data : Array.isArray(s2) ? s2 : [];
  // 简单 SVG 降级路径，避免强制依赖 echarts
  const w = small ? 240 : 980;
  const h = small ? 100 : 460;
  const max = arr.length ? Math.max(...arr, 0.0001) : 1;
  const safeLen = arr.length || 1;
  const pt = arr.map((v, i) => {
    const x = (i / (safeLen - 1)) * (w - 20) + 10;
    const y = h - 20 - (v / max) * (h - 40);
    return `${x},${y}`;
  }).join(' ');

  const bars = useMemo(() => arr.map((v, i) => {
    const x = (i / safeLen) * (w - 20) + 10;
    const bw = (w - 20) / safeLen - 2;
    const bh = (v / max) * (h - 40);
    return <rect key={i} x={x} y={h - 20 - bh} width={bw} height={bh} fill="#3a7" opacity="0.7" />;
  }), [arr, w, h, max, safeLen]);

  return (
    <div className="s2-chart">
      <svg viewBox={`0 0 ${w} ${h}`} className="s2-svg">
        <rect x="0" y="0" width={w} height={h} fill="#f3f3f3" />
        {bars}
        <polyline fill="none" stroke="#06c" strokeWidth="1.5" points={pt} />
        {/* 网格 */}
        {Array.from({ length: 5 }).map((_, i) => (
          <line key={i} x1="0" y1={20 + i * (h - 40) / 4} x2={w} y2={20 + i * (h - 40) / 4}
            stroke="#ddd" strokeWidth="0.5" />
        ))}
      </svg>
      <div className="s2-legend">S2 Sample 1..16 / max={max} / areaMode={params?.areaMode ?? 'none'} / imageType={params?.imageType ?? 'Normal'}</div>
    </div>
  );
}
