import React from 'react';

/**
 * 顶部主通道 Tab（仿 MFC IDC_TAB，TCS_MULTILINE 第一行）—— 严格对照原版 WinMain.cpp ImgType[] 前 10 项：
 *  IR1 (A1) / Green P (B) / Green Ref_F (C) / Green Ref_B (D) /
 *  Blue Ref_F (E1) / Blue Ref_B (E2) / IR^2/64 / IR-Gr+offset / Gp-Gr+offset / abs(IR-Gp)
 */
const CHANNELS = [
  'IR1 (A1)',
  'Green P (B)',
  'Green Ref_F (C)',
  'Green Ref_B (D)',
  'Blue Ref_F (E1)',
  'Blue Ref_B (E2)',
  'IR^2/64',
  'IR-Gr+offset',
  'Gp-Gr+offset',
  'abs(IR-Gp)',
];

export default function ChannelTab({ channel, setChannel }) {
  return (
    <div className="channel-tab">
      {CHANNELS.map((c, i) => (
        <button key={c}
          className={'channel-btn' + (i === channel ? ' active' : '')}
          onClick={() => setChannel(i)}>
          {c}
        </button>
      ))}
    </div>
  );
}