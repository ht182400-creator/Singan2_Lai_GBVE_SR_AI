import React from 'react';

/**
 * Notes 行：Real / Text / BV check note / Other note / General note / Thickness /
 * BV end / End Processing / Incorrect 共 9 项
 */
const ITEMS = ['Real', 'Text', 'BV check note', 'Other note', 'General note', 'Thickness', 'BV end', 'End Processing', 'Incorrect'];
export default function NotesRow() {
  return (
    <fieldset className="notes-row">
      <legend>Notes</legend>
      <div className="notes-grid">
        {ITEMS.map((it) => <span key={it} className="note-cell">{it}</span>)}
      </div>
    </fieldset>
  );
}