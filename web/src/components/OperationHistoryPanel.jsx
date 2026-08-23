import React from 'react';

/**
 * Operation History ListBox + Clear 按钮
 */
export default function OperationHistoryPanel({ history, onClear }) {
  return (
    <fieldset className="op-hist-box">
      <legend>Operation History</legend>
      <select multiple size={4} className="op-hist-list">
        {history.map((h, i) => (
          <option key={i} value={String(i)}>{h}</option>
        ))}
      </select>
      <button className="btn" onClick={onClear}>Clear</button>
    </fieldset>
  );
}
