import React from 'react';

/**
 * 右键菜单（1:1 复刻 OLD resource.rc IDR_POPUP "Popup" + 分隔线位置）：
 *  Grid | ─ | Restore(IDC_RUN=MainRun) / MousePoint(&V) | ─ | Show Area▸(Don't Show/Absolute/Speed)
 *  | Show Information | ─ | Detail Setting | ─ | Image Prosess▸(Gradient/Binary/Noise/Restore)
 *  | ─ | Switch View | ─ | Re-Load Coordinate | ─ | Close(Web 便利项，OLD 无)
 */
const ITEMS = [
  { key: 'grid', label: 'Grid' },
  { sep: true },
  { key: 'restore', label: 'Restore' },
  { key: 'mousePoint', label: 'MousePoint(&V)' },
  { sep: true },
  { key: 'showArea', label: 'Show Area', sub: [
    { key: 'showArea-none', label: "Don't Show" },
    { key: 'showArea-abs', label: 'Absolute' },
    { key: 'showArea-speed', label: 'Speed' },
  ] },
  { key: 'showInfo', label: 'Show Information' },
  { sep: true },
  { key: 'detailSetting', label: 'Detail Setting' },
  { sep: true },
  { key: 'imgProsess', label: 'Image Prosess', sub: [
    { key: 'gradient', label: 'Gradient' },
    { key: 'binary', label: 'Binary' },
    { key: 'noise', label: 'Noise' },
    { key: 'restoreImg', label: 'Restore' },
  ] },
  { sep: true },
  { key: 'switchView', label: 'Switch View' },
  { sep: true },
  { key: 'reloadCoord', label: 'Re-Load Coordinate' },
  { sep: true },
];

export default function ContextMenu({ x, y, onClose, onAction }) {
  return (
    <div className="ctxmenu" style={{ left: x, top: y }} onClick={(e) => e.stopPropagation()}>
      {ITEMS.map((it, i) => (it.sep
        ? <div key={`sep-${i}`} className="ctxmenu-sep" />
        : (
          <div key={it.key} className="ctxmenu-row" onClick={() => !it.sub && onAction?.(it.key)}>
            {it.label}
            {it.sub && <span className="caret">▶</span>}
            {it.sub && (
              <div className="ctxmenu-sub">
                {it.sub.map((s) => (
                  <div key={s.key} className="ctxmenu-row" onClick={() => onAction?.(s.key)}>{s.label}</div>
                ))}
              </div>
            )}
          </div>
        )))}
      <div className="ctxmenu-sep" />
      <div className="ctxmenu-row" onClick={onClose}>Close</div>
    </div>
  );
}
