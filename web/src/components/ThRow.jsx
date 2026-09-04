import React from 'react';

/**
 * 底部 TH 行 —— ⚠️ Web 占位面板，原版 MFC 无此控件组。
 * 经全量比对 OLD 源码（resource.rc / WinMain.cpp 等）：
 * "( TH1/IR1/IR2/UV1/IR3 ) r ( TH2/IR2 ) r" 波段组合公式与
 * Clear 4D / Load... / Show All / Save List... 按钮组（此布局下）均无对应实现
 * （"Clear 4D"/"Show All" 属 ATB 区，与波段组合无关）。
 * 2026-09-04 起**全部禁用仅作展示**并附说明。
 */
export default function ThRow({ pushHistory }) {
  return (
    <div className="th-row">
      <div className="legacy-note">
        ⚠ Web 占位面板：原版 MFC 源码无此控件组（波段组合/Clear 4D/Show All/Save List 在此布局下无对应实现），功能未启用。
      </div>
      <span className="th-paren">(</span>
      <select className="th-combo" defaultValue="TH1" disabled title="原版 MFC 无此控件（Web 占位，未启用）">
        <option>TH1</option><option>TH2</option><option>TH3</option>
      </select>
      <select className="th-combo" defaultValue="IR1" disabled title="原版 MFC 无此控件（Web 占位，未启用）">
        <option>IR1</option><option>IR2</option><option>IR3</option>
        <option>UV1</option><option>UV2</option>
      </select>
      <select className="th-combo" defaultValue="IR2" disabled title="原版 MFC 无此控件（Web 占位，未启用）">
        <option>IR2</option><option>IR1</option><option>IR3</option>
      </select>
      <select className="th-combo" defaultValue="UV1" disabled title="原版 MFC 无此控件（Web 占位，未启用）">
        <option>UV1</option><option>UV2</option>
      </select>
      <select className="th-combo" defaultValue="IR3" disabled title="原版 MFC 无此控件（Web 占位，未启用）">
        <option>IR3</option><option>IR1</option>
      </select>
      <span className="th-paren">)</span>
      <span className="th-r">r</span>
      <span className="th-paren">(</span>
      <select className="th-combo" defaultValue="TH2" disabled title="原版 MFC 无此控件（Web 占位，未启用）">
        <option>TH1</option><option>TH2</option>
      </select>
      <select className="th-combo" defaultValue="IR2" disabled title="原版 MFC 无此控件（Web 占位，未启用）">
        <option>IR1</option><option>IR2</option>
      </select>
      <span className="th-paren">)</span>
      <span className="th-r">r</span>
      <button className="btn btn-xs" disabled title="原版 MFC 无此控件（Web 占位，未启用）"
        onClick={() => pushHistory?.('Clear 4D')}>Clear 4D</button>
      <button className="btn btn-xs" disabled title="原版 MFC 无此控件（Web 占位，未启用）"
        onClick={() => pushHistory?.('Load...')}>Load...</button>
      <button className="btn btn-xs" disabled title="原版 MFC 无此控件（Web 占位，未启用）"
        onClick={() => pushHistory?.('Show All')}>Show All</button>
      <button className="btn btn-xs" disabled title="原版 MFC 无此控件（Web 占位，未启用）"
        onClick={() => pushHistory?.('Save List...')}>Save List...</button>
    </div>
  );
}
