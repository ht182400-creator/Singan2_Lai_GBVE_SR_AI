import React, { useEffect, useMemo, useRef, useState, useCallback } from 'react';
import { decodeImage } from '../utils/image.js';

/**
 * IR 真币图画布（仿 MFC CStatic + IDC_HISTOGRAM）。
 * - 传入 imageData（/api/image 返回：width/height/encoding/min/max/data）时渲染真实图像，
 *   直方图改为由真实像素统计生成；
 * - 未传时保持原占位渲染（噪点背景 + 模拟直方图），不破坏既有测试与视觉。
 *
 * 鼠标点（复刻 OLD Mouse.cpp）双模式：
 * - freeHand=false（Show(V) 关，global_free_hand=FALSE）：
 *   onHover 上报光标图像坐标（20×20 框跟随），onClick 点击固定（L_Down 切 bClic）。
 * - freeHand=true（Show(V) 开，global_free_hand=TRUE）：
 *   左键拖拽选择区域（Freemove_mouse + Draw_Eria），拖拽中 onSizeChange({w,h}) 实时刷新
 *   MousePoint 的 Width/Height；松开时 onSelect({x1,y1,x2,y2})，App 写入 mousePos/mouseSize
 *   （对应 OLD L_Up 写 IDC_M_WIDTH/HEIGHT）。
 *
 * 绘制复刻 OLD 视觉：
 *   props.box = { x, y, w, h }（图像像素，选区左上角 + 尺寸）；
 *   props.showBox=true 时画「红十字线」（2 条全宽横线 + 2 条全高竖线，RGB 255,0,0）
 *   + 白色矩形框（RGB 255,255,255）；拖拽中画青色（RGB 0,255,255）十字格线。
 * props: title, height, small, withHist, onContextMenu, imageData,
 *        showGrid, box, showBox, onHover, onClick, freeHand, onSelect, onSizeChange
 */

function drawGray(canvas, pixels) {
  if (!canvas || !pixels) return;
  let ctx;
  try {
    ctx = canvas.getContext && canvas.getContext('2d');
  } catch (e) {
    return; // jsdom 等无 2D 上下文时跳过
  }
  if (!ctx) return;
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
  title, height, small, withHist = true, onContextMenu, imageData, showGrid = false,
  box, showBox = false, onHover, onClick, freeHand = false, onSelect, onSizeChange,
  onFileDrop, areas,
}) {
  const canvasRef = useRef(null);
  const containerRef = useRef(null);
  // 优先使用已解码的原始灰度缓冲（整通道预载场景：imageData.gray 为 Uint8Array，
  // 翻帧时只做内存切片、无需再走 base64 解码）；否则回退到 /api/image 的 base64 解码路径。
  const pixels = useMemo(() => {
    if (!imageData) return null;
    if (imageData.gray) {
      return { width: imageData.width, height: imageData.height, gray: imageData.gray };
    }
    return decodeImage(imageData);
  }, [imageData]);
  // 自由手拖拽中暂存（图像像素坐标）
  const [drag, setDrag] = useState(null);

  useEffect(() => {
    if (pixels) drawGray(canvasRef.current, pixels);
  }, [pixels]);

  // 容器坐标 → 图像像素坐标（floor，匹配 OLD 的 /5*5 取整）
  const toImg = useCallback((e) => {
    const el = containerRef.current;
    if (!el || !pixels) return null;
    const r = el.getBoundingClientRect();
    const sx = (e.clientX - r.left) / Math.max(1, r.width);
    const sy = (e.clientY - r.top) / Math.max(1, r.height);
    return {
      x: Math.max(0, Math.min(pixels.width - 1, Math.floor(sx * pixels.width))),
      y: Math.max(0, Math.min(pixels.height - 1, Math.floor(sy * pixels.height))),
    };
  }, [pixels]);

  const handleMouseDown = useCallback((e) => {
    if (e.button !== 0 || !pixels) return;
    const p = toImg(e);
    if (!p) return;
    e.preventDefault();
    if (freeHand) {
      // 自由手模式：开始拖拽选区（Freemove_mouse / L_Down）
      setDrag({ startX: p.x, startY: p.y, curX: p.x, curY: p.y });
    } else if (onClick) {
      // 普通模式：点击固定（L_Down 切 bClic）
      onClick(p);
    }
  }, [pixels, toImg, freeHand, onClick]);

  const handleMouseMove = useCallback((e) => {
    const p = toImg(e);
    if (!p) return;
    if (freeHand && drag) {
      // 实时回传选区尺寸（复刻 OLD Freemove_mouse 动态刷新 IDC_M_WIDTH/HEIGHT）
      // 注意：必须在 setDrag 更新函数【之外】调用，否则 React 会在渲染阶段调用父组件
      // setState（StrictMode 下表现为 "Cannot update a component while rendering" 警告，
      // 并可能引发渲染死循环导致界面卡死、按钮无响应）。
      const w = Math.abs(p.x - drag.startX) + 1;
      const h = Math.abs(p.y - drag.startY) + 1;
      if (onSizeChange) onSizeChange({ w, h });
      setDrag((d) => (d ? { ...d, curX: p.x, curY: p.y } : d));
    } else if (!freeHand && onHover) {
      onHover(p);
    }
  }, [toImg, freeHand, drag, onHover, onSizeChange]);

  const finishDrag = useCallback(() => {
    if (!drag) return;
    const x1 = Math.min(drag.startX, drag.curX);
    const x2 = Math.max(drag.startX, drag.curX);
    const y1 = Math.min(drag.startY, drag.curY);
    const y2 = Math.max(drag.startY, drag.curY);
    setDrag(null);
    // 有效选区（≥2 像素宽高）才写回（L_Up 写 IDC_M_WIDTH/HEIGHT）
    if (x2 - x1 >= 1 && y2 - y1 >= 1 && onSelect) {
      onSelect({ x1, y1, x2, y2 });
    } else if (onSelect) {
      onSelect(null);
    }
  }, [drag, onSelect]);

  // 拖拽期间全局监听 mousemove/mouseup，避免鼠标移出画布后丢失
  useEffect(() => {
    if (!drag) return undefined;
    const mm = (e) => {
      const p = toImg(e);
      if (!p) return;
      // 同样在 setDrag 更新函数之外回传选区尺寸，避免渲染阶段 setState
      if (onSizeChange) {
        const w = Math.abs(p.x - drag.startX) + 1;
        const h = Math.abs(p.y - drag.startY) + 1;
        onSizeChange({ w, h });
      }
      setDrag((d) => (d ? { ...d, curX: p.x, curY: p.y } : d));
    };
    const mu = () => finishDrag();
    window.addEventListener('mousemove', mm);
    window.addEventListener('mouseup', mu);
    return () => {
      window.removeEventListener('mousemove', mm);
      window.removeEventListener('mouseup', mu);
    };
  }, [drag, toImg, finishDrag, onSizeChange]);

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

  const W = pixels ? pixels.width : 1;
  const H = pixels ? pixels.height : 1;

  // 有效显示框：拖拽中显示拖拽矩形（青色十字格线 + 白框），否则显示 props.box
  const effBox = drag
    ? {
        x: Math.min(drag.startX, drag.curX),
        y: Math.min(drag.startY, drag.curY),
        w: Math.max(1, Math.abs(drag.curX - drag.startX) + 1),
        h: Math.max(1, Math.abs(drag.curY - drag.startY) + 1),
      }
    : box;

  const showSel = showBox && effBox && pixels && effBox.w > 0 && effBox.h > 0;
  const isDragging = !!drag;

  // 拖入文件：复刻 OLD DropDlg（落点在 IR1→Data1 / IR2→Data2）。浏览器无法拿到本地绝对路径，
  // 故读出 File 对象交给上层上传到后端（onFileDrop）。必须 preventDefault 阻止浏览器“下载/导航”。
  const handleDragOver = (e) => { if (onFileDrop) e.preventDefault(); };
  const handleDragEnter = (e) => { if (onFileDrop) e.preventDefault(); };
  const handleDrop = (e) => {
    if (!onFileDrop) return;
    e.preventDefault();
    const f = e.dataTransfer.files && e.dataTransfer.files[0];
    if (f) onFileDrop(f);
  };

  return (
    <div
      className="image-pane"
      style={height ? { height } : null}
      onContextMenu={onContextMenu}
      onDragEnter={handleDragEnter}
      onDragOver={handleDragOver}
      onDrop={handleDrop}
    >
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
          ref={containerRef}
          className="image-pane-canvas"
          style={{
            background: `radial-gradient(${cols * 6}px ${rows * 6}px at 50% 50%, #555 0%, #1a1a1a 100%), radial-gradient(circle, ${dots})`,
          }}
          onMouseDown={handleMouseDown}
          onMouseMove={handleMouseMove}
        >
          {pixels && (
            <canvas
              ref={canvasRef}
              className="image-pane-real"
              width={pixels.width}
              height={pixels.height}
            />
          )}
          {showGrid && (
            <div className="image-pane-grid" aria-hidden="true" />
          )}
          {/* Show All 叠加层：ATB 各 note 矩形（4 色轮换 + "noteA" 标签，复刻 OLD OnDrawPaint；
              OLD 中选区白框与 area 彩框同时绘制，故不受 showSel 影响） */}
          {Array.isArray(areas) && areas.length > 0 && pixels && areas.map((a, i) => (
            <div
              key={`${a.label}-${i}`}
              className="image-pane-atb-rect"
              style={{
                left: `${(a.x / W) * 100}%`,
                top: `${(a.y / H) * 100}%`,
                width: `${(a.w / W) * 100}%`,
                height: `${(a.h / H) * 100}%`,
                borderColor: a.color,
              }}
            >
              <span className="image-pane-atb-label" style={{ color: a.color }}>{a.label}</span>
            </div>
          ))}
          {/* 红十字线（全宽/全高）+ 白色框；自由手拖拽中额外画青色十字格线 */}
          {showSel && (
            <>
              <div className="image-pane-cross-h" style={{ top: `${(effBox.y / H) * 100}%` }} />
              <div className="image-pane-cross-h" style={{ top: `${((effBox.y + effBox.h) / H) * 100}%` }} />
              <div className="image-pane-cross-v" style={{ left: `${(effBox.x / W) * 100}%` }} />
              <div className="image-pane-cross-v" style={{ left: `${((effBox.x + effBox.w) / W) * 100}%` }} />
              <div
                className={isDragging ? 'image-pane-box image-pane-box-drag' : 'image-pane-box'}
                style={{
                  left: `${(effBox.x / W) * 100}%`,
                  top: `${(effBox.y / H) * 100}%`,
                  width: `${(effBox.w / W) * 100}%`,
                  height: `${(effBox.h / H) * 100}%`,
                }}
              />
              {/* 自由手拖拽中：青色调绘格线（Draw_Eria RGB 0,255,255） */}
              {isDragging && (
                <>
                  <div
                    className="image-pane-hatch-v"
                    style={{ left: `${(effBox.x / W) * 100}%`, top: `${(effBox.y / H) * 100}%`, height: `${(effBox.h / H) * 100}%` }}
                  />
                  <div
                    className="image-pane-hatch-h"
                    style={{ left: `${(effBox.x / W) * 100}%`, top: `${(effBox.y / H) * 100}%`, width: `${(effBox.w / W) * 100}%` }}
                  />
                </>
              )}
            </>
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
