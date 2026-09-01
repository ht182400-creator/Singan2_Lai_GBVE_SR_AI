import React, { useEffect, useMemo, useRef } from 'react';

/**
 * IR 真币图画布（仿 MFC CStatic + IDC_HISTOGRAM）。
 * - 传入 imageData（/api/image 返回：width/height/encoding/min/max/data）时渲染真实图像，
 *   直方图改为由真实像素统计生成；
 * - 未传时保持原占位渲染（噪点背景 + 模拟直方图），不破坏既有测试与视觉。
 * props: title, height, small, withHist, onContextMenu, imageData
 */

// 解码 base64 图像 -> { width, height, gray:Uint8Array }（u16le 按 min/max 归一化到 0..255）
function decodeImage(img) {
  const { width, height, encoding, min, max, data } = img;
  const bin = atob(data);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  const gray = new Uint8Array(width * height);
  if (encoding === 'u16le') {
    const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
    const range = Math.max(1, max - min);
    for (let i = 0; i < width * height; i++) {
      const v = view.getUint16(i * 2, true);
      gray[i] = Math.max(0, Math.min(255, Math.round(((v - min) / range) * 255)));
    }
  } else {
    gray.set(bytes.subarray(0, gray.length));
  }
  return { width, height, gray };
}

function drawGray(canvas, pixels) {
  if (!canvas || !pixels) return;
  const ctx = canvas.getContext && canvas.getContext('2d');
  if (!ctx) return; // jsdom 等无 2D 上下文时跳过
  const { width, height, gray } = pixels;
  canvas.width = width;
  canvas.height = height;
  const out = ctx.createImageData(width, height);
  for (let i = 0; i < width * height; i++) {
    const g = gray[i];
    const o = i * 4;
    out.data[o] = g;
    out.data[o + 1] = g;
    out.data[o + 2] = g;
    out.data[o + 3] = 255;
  }
  ctx.putImageData(out, 0, 0);
}

// 真实直方图：256 桶灰度统计，高度按最大桶归一化
function realHistBars(gray) {
  const bins = new Array(256).fill(0);
  for (let i = 0; i < gray.length; i++) bins[gray[i]]++;
  let peak = 1;
  for (let i = 0; i < 256; i++) if (bins[i] > peak) peak = bins[i];
  return bins.map((c, i) => ({
    h: Math.max(2, Math.round((c / peak) * 100)),
    dark: i < 128,
  }));
}

// 模拟直方图（无真实数据时的占位）
function fakeHistBars() {
  const bars = [];
  for (let i = 0; i < 256; i++) {
    const t = i / 255;
    const h = Math.max(0, Math.floor((1 - Math.abs(t - 0.35) * 1.6) * 100));
    bars.push({ h, dark: i < 128 });
  }
  return bars;
}

export default function ImagePane({
  title, height, small, withHist = true, onContextMenu, imageData,
}) {
  const canvasRef = useRef(null);
  const pixels = useMemo(() => (imageData ? decodeImage(imageData) : null), [imageData]);

  useEffect(() => {
    if (pixels) drawGray(canvasRef.current, pixels);
  }, [pixels]);

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

  // 右端直方图：有真实图像时用真实统计，否则用模拟
  const histBars = useMemo(
    () => (pixels ? realHistBars(pixels.gray) : fakeHistBars()),
    [pixels],
  );

  return (
    <div className="image-pane" style={height ? { height } : null} onContextMenu={onContextMenu}>
      <div className="image-pane-label">
        {title}
        {imageData && (
          <span className="image-pane-info">
            {` #${imageData.record ?? ''} ${imageData.wave ?? ''}`}
          </span>
        )}
      </div>
      <div className="image-pane-body">
        <div
          className="image-pane-canvas"
          style={{
            background: `radial-gradient(${cols * 6}px ${rows * 6}px at 50% 50%, #555 0%, #1a1a1a 100%), radial-gradient(circle, ${dots})`,
          }}
        >
          {pixels && (
            <canvas
              ref={canvasRef}
              className="image-pane-real"
              width={pixels.width}
              height={pixels.height}
            />
          )}
        </div>
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
