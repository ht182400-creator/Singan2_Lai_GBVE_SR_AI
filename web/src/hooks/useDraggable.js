import { useEffect, useRef, useState } from 'react';

const PREFIX = 'rcpos:';

/**
 * 让绝对定位容器可用鼠标拖动，位置写入 localStorage（刷新后保持）。
 * 仅在非交互元素（标题栏/卡片空白区）上按下时触发拖动，
 * 点击 input/textarea/select/button 等控件不会误拖。
 */
export function useDraggable(id, dl, dt) {
  const [pos, setPos] = useState(() => {
    try {
      const s = localStorage.getItem(PREFIX + id);
      if (s) {
        const p = JSON.parse(s);
        if (typeof p.left === 'number' && typeof p.top === 'number') return p;
      }
    } catch (e) { /* ignore */ }
    return { left: dl, top: dt };
  });
  const start = useRef(null);

  useEffect(() => {
    try { localStorage.setItem(PREFIX + id, JSON.stringify(pos)); } catch (e) { /* ignore */ }
  }, [pos, id]);

  const onMouseDown = (e) => {
    if (e.button !== 0) return;
    // 交互控件不触发拖动（避免误拖）
    if (e.target.closest('input, textarea, select, button, label, option')) return;
    e.preventDefault();
    const sx = e.clientX;
    const sy = e.clientY;
    const ol = pos.left;
    const ot = pos.top;
    const onMove = (ev) => {
      const nl = Math.max(0, ol + ev.clientX - sx);
      const nt = Math.max(0, ot + ev.clientY - sy);
      setPos({ left: nl, top: nt });
    };
    const onUp = () => {
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
      document.body.style.userSelect = '';
    };
    document.body.style.userSelect = 'none';
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
  };

  return { style: { position: 'absolute', left: pos.left, top: pos.top }, onMouseDown };
}
