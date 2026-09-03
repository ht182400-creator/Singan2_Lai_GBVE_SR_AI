import React from 'react';

/**
 * ATB 面板（1:1 复刻 OLD resource.rc 右上区，rc 917,4）：
 * - IDC_STATIC_ATB_FILE_NAME  文件名静态框（带边框，仅文件名.扩展名）
 * - IDC_COMBO_ATB_TYPE        area 下拉（"001 4000 WM1" ... 共 128 项）
 * - IDC_LIST_ATB              条目列表（"%03d %03d%c: xxx,xxx,..." 512/1024 行）
 * - IDC_RADIO_ATB_TH1..TH4    TH1-4 单选（决定 Show/Save 使用哪个阈值字节）
 * - IDC_BUTTON_ATB_CLEAR_4_DIR / IDC_BUTTON_ATB_CLEAR           Clear 4D / Clear
 * - IDC_BUTTON_LOAD_ATB / IDC_BUTTON_DISPLAY_ATB_SELECT / IDC_BUTTON_ATB_SHOW_ALL
 *   / IDC_BUTTON_ATB_SET_4_DIR / IDC_BUTTON_ATB_UPDATE          Load.../Show/Show All/Set 4D.../Save...
 * - IDC_COMBO_DENOS_SIZE / IDC_BUTTON_LOAD_DENOS_SIZE           Note 尺寸下拉 + Load Size...
 */
export default function AtbPanel({
  fileName, areaNames, areaIndex, onAreaChange,
  lines, selected, setSelected,
  thIndex, setThIndex,
  sizeNotes, sizeIndex, setSizeIndex,
  onLoad, onShow, onShowAll, onSave, onClear, onClear4D, onSet4D, onLoadSize,
  loaded, onContextMenu,
}) {
  return (
    <div className="atb-panel" onContextMenu={onContextMenu}>
      {/* 文件名静态框（OLD 仅显示 文件名.扩展名） */}
      <div className="atb-filename" title={fileName}>{fileName || '(no file)'}</div>

      {/* area 下拉（001 4000 WM1 ...） */}
      <select
        className="atb-area-combo"
        value={areaIndex}
        onChange={(e) => onAreaChange(Number(e.target.value))}
        disabled={!loaded}
      >
        {areaNames.map((n, i) => (
          <option key={n} value={i}>{`${String(i + 1).padStart(3, '0')} ${n}`}</option>
        ))}
      </select>

      {/* 条目列表（单选，与 OLD LB_GETCURSEL 一致） */}
      <div className="atb-list">
        <select
          className="atb-listbox"
          size={9}
          value={selected >= 0 ? String(selected) : ''}
          onChange={(e) => setSelected(e.target.value === '' ? -1 : Number(e.target.value))}
          disabled={!loaded}
        >
          {lines.map((it, i) => (
            <option key={i} value={String(i)}>{it}</option>
          ))}
        </select>
      </div>

      {/* TH1-4 单选 + Clear 4D + Clear（OLD y=96 一行） */}
      <div className="atb-row-th">
        {[0, 1, 2, 3].map((i) => (
          <label key={i}>
            <input
              type="radio"
              name="atb-th"
              checked={thIndex === i}
              onChange={() => setThIndex(i)}
            />
            {`TH${i + 1}`}
          </label>
        ))}
        <button className="btn" disabled={!loaded} onClick={onClear4D}>Clear 4D</button>
        <button className="btn" disabled={!loaded} onClick={onClear}>Clear</button>
      </div>

      {/* Load.../Show/Show All/Set 4D.../Save...（OLD y=111 一行） */}
      <div className="atb-row-btns">
        <button className="btn" onClick={onLoad}>Load...</button>
        <button className="btn" disabled={!loaded || selected < 0} onClick={onShow}>Show</button>
        <button className="btn" disabled={!loaded} onClick={onShowAll}>Show All</button>
        <button className="btn" disabled={!loaded || selected < 0} onClick={onSet4D}>Set 4D...</button>
        <button className="btn" disabled={!loaded || selected < 0} onClick={onSave}>Save...</button>
      </div>

      {/* Note 尺寸下拉 + Load Size...（OLD y=130 一行，IDC_COMBO_DENOS_SIZE） */}
      <div className="atb-row-size">
        <select
          className="atb-size-combo"
          value={sizeIndex}
          onChange={(e) => setSizeIndex(Number(e.target.value))}
          disabled={sizeNotes.length === 0}
        >
          {sizeNotes.length === 0 && <option value={0}>Note:ATB.001</option>}
          {sizeNotes.map((n, i) => (
            <option key={n} value={i}>{n}</option>
          ))}
        </select>
        <button className="btn" onClick={onLoadSize}>Load Size...</button>
      </div>
    </div>
  );
}
