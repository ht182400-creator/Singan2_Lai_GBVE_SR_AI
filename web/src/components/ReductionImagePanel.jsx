import React from 'react';
import { reduction1Lines, reduction2Lines } from '../data/sample.js';

/**
 * Reduction Image 1 + Reduction Image 2 + Comparison Result 区
 * （IDC_REDUCTION1/IDC_GASOTI2/IDC_ZAHYO2 + IDC_COMP_RESULT）
 */
export default function ReductionImagePanel({ pushHistory }) {
  return (
    <div className="reduction-row">
      <fieldset className="reduction-box">
        <legend>Reduction Image 1</legend>
        <textarea readOnly className="reduction-text" value={reduction1Lines.join('\n')} />
        <input readOnly className="reduction-xy" value="(0, 0)" />
      </fieldset>
      <fieldset className="reduction-box">
        <legend>Reduction Image 2</legend>
        <textarea readOnly className="reduction-text" value={reduction2Lines.join('\n')} />
        <input readOnly className="reduction-xy" value="(0, 0)" />
      </fieldset>
      <fieldset className="comparison-box">
        <legend>Comparison result</legend>
        <div className="comparison-text">Result：OK &nbsp;|&nbsp; Ver: MATCH</div>
        <button className="btn" onClick={() => pushHistory('Comparison check')}>Re-Check</button>
      </fieldset>
    </div>
  );
}
