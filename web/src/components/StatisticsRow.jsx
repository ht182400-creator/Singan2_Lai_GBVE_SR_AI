import React, { useState } from 'react';

/**
 * Statistics 行：Start / Step / Times / 1<2 / Statistics（自给自足）
 */
export default function StatisticsRow({ pushHistory, onStatistics }) {
  const [start, setStart] = useState(0);
  const [step, setStep] = useState(1);
  const [times, setTimes] = useState(16);
  const [cmp12, setCmp12] = useState(false);
  return (
    <div className="statistics-row">
      <span className="stat-label">Start</span>
      <input type="number" value={start} onChange={(e) => setStart(Number(e.target.value))} className="stat-num" />
      <span className="stat-label">Step</span>
      <input type="number" value={step} onChange={(e) => setStep(Number(e.target.value))} className="stat-num" />
      <span className="stat-label">Times</span>
      <input type="number" value={times} onChange={(e) => setTimes(Number(e.target.value))} className="stat-num" />
      <label><input type="checkbox" checked={cmp12} onChange={(e) => setCmp12(e.target.checked)} /> 1&lt;2</label>
      <button className="btn" onClick={() => { pushHistory?.('Statistics'); onStatistics?.(start, step, times); }}>Statistics</button>
    </div>
  );
}