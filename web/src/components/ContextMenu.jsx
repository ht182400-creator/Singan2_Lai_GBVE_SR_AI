import React from 'react';

/**
 * 右键菜单（原版 MFC 右键 14 项）：
 *  Grid / Restore / MousePoint(&V) / Show Area(子: Don't Show/Absolute/Speed) /
 *  Show Information / Detail Setting / Image Prosess(子: Gradient/Binary/Noise/Restore) /
 *  Switch View / Re-Load Coordinate  +  分隔 + Close
 */
const ITEMS = [
  { key: 'grid', label: 'Grid' },
  { key: 'restore', label: 'Restore' },
  { key: 'mousePoint', label: 'MousePoint(&V)' },
  { key: 'showArea', label: 'Show Area', sub: [
    { key: 'showArea-none', label: "Don't Show" },
    { key: 'showArea-abs', label: 'Absolute' },
    { key: 'showArea-speed', label: 'Speed' },
  ] },
  { key: 'showInfo', label: 'Show Information' },
  { key: 'detailSetting', label: 'Detail Setting' },
  { key: 'imgProsess', label: 'Image Prosess', sub: [
    { key: 'gradient', label: 'Gradient' },
    { key: 'binary', label: 'Binary' },
    { key: 'noise', label: 'Noise' },
    { key: 'restoreImg', label: 'Restore' },
  ] },
  { key: 'switchView', label: 'Switch View' },
  { key: 'reloadCoord', label: 'Re-Load Coordinate' },
];

export default function ContextMenu({ x, y, onClose, onAction }) {
  return (
    <div className="ctxmenu" style={{ left: x, top: y }} onClick={(e) => e.stopPropagation()}>
      {ITEMS.map((it) => (
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
      ))}
      <div className="ctxmenu-sep" />
      <div className="ctxmenu-row" onClick={onClose}>Close</div>
    </div>
  );
}
