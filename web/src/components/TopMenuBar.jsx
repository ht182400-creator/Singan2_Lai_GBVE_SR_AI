import React, { useState, useRef, useEffect } from 'react';

/**
 * 顶部菜单栏（紧贴主通道 Tab 上方，对照原版 MFC IDR_MENU 标题栏下的菜单行）
 *  4 项：tool / View / Setting / Short
 *  子项来自 WinMain.cpp + resource.rc IDR_MENU：
 *   - tool     : History / Finish
 *   - View     : Grid / Information / Image→7 Reductions…/Brightness Adjust…
 *   - Setting  : Setting Dialogue… / Load→Coordinate/ATB/Data / Create1/2/3 / Country…
 *   - Short    : Calculate all / Finish (Alt+F)
 */
const MENUS = [
  {
    key: 'tool', label: 'tool',
    items: [
      { key: 'history', label: 'History' },
      { key: 'finish', label: 'Finish' },
    ],
  },
  {
    key: 'view', label: 'View',
    items: [
      { key: 'grid', label: 'Grid' },
      { key: 'info', label: 'Information' },
      { key: 'image', label: 'Image', sub: [
        { key: 'img-th', label: '7 Reductions…' },
        { key: 'img-bright', label: 'Brightness Adjust…' },
      ] },
    ],
  },
  {
    key: 'setting', label: 'Setting',
    items: [
      { key: 'sdialog', label: 'Setting Dialogue…' },
      { key: 'load', label: 'Load', sub: [
        { key: 'l-coord', label: 'Coordinate' },
        { key: 'l-atb', label: 'ATB' },
        { key: 'l-data', label: 'Data' },
      ] },
      { key: 'create', label: 'Create1/2/3', sub: [
        { key: 'c1', label: 'Create1' },
        { key: 'c2', label: 'Create2' },
        { key: 'c3', label: 'Create3' },
      ] },
      { key: 'country', label: 'Country…' },
    ],
  },
  {
    key: 'short', label: 'Short',
    items: [
      { key: 'calcall', label: 'Calculate all' },
      { key: 'fin', label: 'Finish (Alt+F)' },
    ],
  },
];

export default function TopMenuBar({ activeMenu, setActiveMenu, setActiveDialog, pushHistory }) {
  const [open, setOpen] = useState(null);
  const [subOpen, setSubOpen] = useState(null);
  const rootRef = useRef(null);

  useEffect(() => {
    if (activeMenu === null) return;
    setOpen(activeMenu);
  }, [activeMenu]);

  useEffect(() => {
    const handler = (e) => {
      if (!rootRef.current?.contains(e.target)) {
        setOpen(null); setSubOpen(null);
        setActiveMenu?.(null);
      }
    };
    document.addEventListener('click', handler);
    return () => document.removeEventListener('click', handler);
  }, [setActiveMenu]);

  const fire = (k) => {
    pushHistory?.(`Menu → ${k}`);
    if (k === 'finish' || k === 'fin') setActiveDialog?.('finish');
    if (k === 'info') setActiveDialog?.('info');
    if (k === 'sdialog' || k === 'country') setActiveDialog?.('setting');
    if (k === 'l-coord') setActiveDialog?.('coordinate');
    if (k === 'img-th') setActiveDialog?.('bigimg');
    if (k === 'calcall') setActiveDialog?.('export');
  };

  return (
    <div ref={rootRef} className="top-menu">
      {MENUS.map((m) => (
        <div key={m.key}
          className={'top-menu-item' + (open === m.key ? ' open' : '')}
          onClick={(e) => { e.stopPropagation(); setOpen(open === m.key ? null : m.key); setSubOpen(null); }}
        >
          {m.label}
          {open === m.key && (
            <div className="top-menu-popup" onClick={(ev) => ev.stopPropagation()}>
              {m.items.map((it) => (
                <div key={it.key} className="top-menu-row"
                  onClick={(e) => {
                    e.stopPropagation();
                    if (it.sub) {
                      setSubOpen(subOpen === it.key ? null : it.key);
                    } else {
                      fire(it.key);
                      setOpen(null); setSubOpen(null);
                      setActiveMenu?.(null);
                    }
                  }}>
                  {it.label}
                  {it.sub && <span className="caret">▶</span>}
                  {subOpen === it.key && it.sub && (
                    <div className="top-menu-sub">
                      {it.sub.map((c) => (
                        <div key={c.key} className="top-menu-row" onClick={(e) => {
                          e.stopPropagation();
                          fire(c.key);
                          setOpen(null); setSubOpen(null);
                          setActiveMenu?.(null);
                        }}>
                          {c.label}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      ))}
    </div>
  );
}