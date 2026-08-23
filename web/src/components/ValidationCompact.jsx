import React from 'react';

/**
 * 右侧 Validation Result（贴近原始 UI）：
 *  N=1 / N=2 各两行 label-value 对，紧密排列。
 */
const ROWS_N1 = [
  [
    { label: 'sion', value: '0000' },
    { label: 'Validation Result', value: '84003E16' },
    { label: 'ng', value: '126' },
    { label: 'rt', value: '68' },
  ],
  [
    { label: 'IR addition', value: '0' },
    { label: 'Green', value: '24' },
    { label: 'Binary', value: '28' },
    { label: 'Speed', value: '0' },
  ],
];
const ROWS_N2 = [
  [
    { label: 'Ver.', value: '0000' },
    { label: 'Validation Result', value: '84003E16' },
    { label: 'LE', value: '127' },
    { label: 'SE', value: '68' },
  ],
  [
    { label: 'IR Adictive', value: '0' },
    { label: 'G Adictive', value: '7' },
    { label: 'Binary', value: '27' },
    { label: 'Speed', value: '0' },
  ],
];

function ValRow({ pairs }) {
  return (
    <div className="val-original-row">
      {pairs.map(({ label, value }) => (
        <div key={`${label}-${value}`} className="val-original-pair">
          <span className="val-original-label">{label}</span>
          <span className="val-original-value">{value}</span>
        </div>
      ))}
    </div>
  );
}

export default function ValidationCompact() {
  return (
    <fieldset className="val-compact val-original">
      <legend>Validation Result</legend>
      <div className="val-original-section">
        <ValRow pairs={ROWS_N1[0]} />
        <ValRow pairs={ROWS_N1[1]} />
      </div>
      <div className="val-original-section">
        <ValRow pairs={ROWS_N2[0]} />
        <ValRow pairs={ROWS_N2[1]} />
      </div>
    </fieldset>
  );
}