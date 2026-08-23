import React from 'react';

/**
 * 副通道行（仿 MFC IDC_TAB 第二行）—— 严格对照原版 WinMain.cpp ImgType[] 第 11~22 项：
 *  IR - Gp / (IR-Gp)^2/8 / Gp - IR / IR & Gp / IR | Gp /
 *  Red Ref_F (F1) / Red Ref_B (F2) / UV1 / UV2 / IR2 (A2) / IR3_F (A3) / IR4_B (A4)
 *  注意：第 11 项是 "IR - Gp"（空格减号），不是 "IR-Gp"（连字符）。
 */
const ITEMS = [
  'IR - Gp',
  '(IR-Gp)^2/8',
  'Gp - IR',
  'IR & Gp',
  'IR | Gp',
  'Red Ref_F (F1)',
  'Red Ref_B (F2)',
  'UV1',
  'UV2',
  'IR2 (A2)',
  'IR3_F (A3)',
  'IR4_B (A4)',
];

export default function SubToolbarRow({ active, setActive, pushHistory }) {
  return (
    <div className="sub-toolbar">
      {ITEMS.map((it) => (
        <button
          key={it}
          className={`sub-btn ${it.startsWith('Red Ref') ? 'sub-btn-wide' : ''} ${active === it ? 'active' : ''}`}
          onClick={() => { setActive(it); pushHistory?.(`SubToolbar → ${it}`); }}
        >
          {it}
        </button>
      ))}
    </div>
  );
}