import { useRef, useState } from 'react';

const PREFIX = 'rcsize:';

/**
 * 让绝对定位的 .rc 容器可用鼠标拖右下角改变宽高，尺寸持久化到 localStorage（刷新保持）。
 * 初始尺寸为空（null）→ 沿用 styles.css 里的 width/height；一旦用户拖过，就改用内联尺寸。
 *
 * @param {string} id 面板唯一 id（与 useDraggable 共用）
 * @returns {{ size: {w:number,h:number}|null, onResizeDown: (e, zoom)=>void }}
 */
export function useResizable(id) {
  const [size, setSize] = useState(() => {
    try {
      const s = localStorage.getItem(PREFIX + id);
      if (s) {
        const p = JSON.parse(s);
        if (typeof p.w === 'number' && typeof p.h === 'number') return p;
      }
    } catch (e) { /* ignore */ }
    return null;
  });
  const sizeRef = useRef(size);
  sizeRef.current = size;

  const onResizeDown = (e, zoom = 1) => {
    if (e.button !== 0) return;
    e.preventDefault();
    e.stopPropagation();
    const el = e.currentTarget.parentElement; // .rc 容器
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const z = zoom > 0 ? zoom : 1;
    const startW = rect.width / z;
    const startH = rect.height / z;
    const sx = e.clientX;
    const sy = e.clientY;

    const onMove = (ev) => {
      const dw = (ev.clientX - sx) / z;
      const dh = (ev.clientY - sy) / z;
      const nw = Math.max(80, Math.round(startW + dw));
      const nh = Math.max(60, Math.round(startH + dh));
      const next = { w: nw, h: nh };
      sizeRef.current = next;
      setSize(next);
    };
    const onUp = () => {
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
      document.body.style.userSelect = '';
      try { localStorage.setItem(PREFIX + id, JSON.stringify(sizeRef.current)); } catch (e) { /* ignore */ }
    };
    document.body.style.userSelect = 'none';
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
  };

  return { size, onResizeDown };
}
