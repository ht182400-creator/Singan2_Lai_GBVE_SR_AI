import React from 'react';

/**
 * 右侧 Validation Result（贴近原始 UI：resource.rc 630,216 区域 + OLD/MainRun.cpp 第 833-843 行）。
 *
 * 【数据来源修正】原版该面板的值来自 global_small_image（小图/速度图）的固定字节偏移，
 * 在“打开/预览记录”时由 readSmallImage 分支填充，与当前记录一一对应；并非来自 ALL32 的 s2。
 * 现由 server /api/small-image 的 validation 字段驱动，随预览图像变化：
 *   han      = small_image[4220..4223]  %X%X%X%X        (Ver.)
 *   kekka    = small_image[0..3]        %02X%02X%02X%02X (Validation Result)
 *   le       = small_image[894..895]
 *   se       = small_image[896..897]
 *   ir_adictive     = small_image[898..899]
 *   g_adictive      = small_image[890..891]
 *   binary_adictive = small_image[892..893]
 *   speed    = small_image[4438..4439]
 */

function fmt(v) {
  if (v === null || v === undefined || v === '') return '-';
  return String(v);
}

function ValRow({ pairs }) {
  return (
    <div className="val-original-row">
      {pairs.map(({ label, value }) => (
        <div key={label} className="val-original-pair">
          <span className="val-original-label">{label}</span>
          <span className="val-original-value">{value}</span>
        </div>
      ))}
    </div>
  );
}

export default function ValidationCompact({ validation = null, record = 0 }) {
  if (!validation) {
    return (
      <fieldset className="val-compact val-original">
        <legend>Validation Result</legend>
        <div className="val-empty">无小图数据 — 请先 Go 打开数据并预览记录</div>
      </fieldset>
    );
  }

  const v = validation;
  const ROWS = [
    [
      { label: 'Ver.', value: fmt(v.han) },
      { label: 'Validation Result', value: fmt(v.kekka) },
      { label: 'LE', value: fmt(v.le) },
      { label: 'SE', value: fmt(v.se) },
    ],
    [
      { label: 'IR Adictive', value: fmt(v.ir_adictive) },
      { label: 'G Adictive', value: fmt(v.g_adictive) },
      { label: 'Binary Addictive', value: fmt(v.binary_adictive) },
      { label: 'Speed', value: fmt(v.speed) },
    ],
  ];

  return (
    <fieldset className="val-compact val-original">
      <legend>Validation Result</legend>
      <div className="val-original-section">
        <ValRow pairs={ROWS[0]} />
      </div>
      <div className="val-original-section">
        <ValRow pairs={ROWS[1]} />
      </div>
    </fieldset>
  );
}
