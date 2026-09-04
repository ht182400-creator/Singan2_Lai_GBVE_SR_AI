import React from 'react';

/**
 * Notes 行 —— ⚠️ Web 占位面板，原版 MFC 无此控件组。
 * 经全量比对 OLD 源码（resource.rc / WinMain.cpp 等），
 * "Real/Text/BV check note / Other note/General note/Thickness / BV end/End Processing/Incorrect"
 * 静态对照表无任何对应控件或数据来源。2026-09-04 起**灰化仅作展示**并附说明。
 */
const ITEMS = ['Real', 'Text', 'BV check note', 'Other note', 'General note', 'Thickness', 'BV end', 'End Processing', 'Incorrect'];
export default function NotesRow() {
  return (
    <fieldset className="notes-row">
      <legend>Notes</legend>
      <div className="legacy-note">
        ⚠ Web 占位面板：原版 MFC 源码无此对照表，内容未启用（仅展示）。
      </div>
      <div className="notes-grid">
        {ITEMS.map((it) => <span key={it} className="note-cell">{it}</span>)}
      </div>
    </fieldset>
  );
}