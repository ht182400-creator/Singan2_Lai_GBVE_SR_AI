import React, { useState } from 'react';

/**
 * Setting Dialogue（1:1 复刻 OLD IDD_S_SET_DLG + SProc.cpp，Setting→Setting Dialogue 打开）。
 * 三列布局与 resource.rc 一致：左=Country/Format/Header/Offset/Draw Area/Adjust Speed/Graph Data
 * Generation；中=Select Coordinate to be Displayed(check_zahyo[1..25])+Check/Uncheck All；
 * 右=Overwrite(S1..S32)+Dart1/2(soil)+Denom Supplemental(DEN 1-11,12-31)+Mouse Emphasis+OK/Cancel。
 * OLD 语义（SetSetUp :11）：Overwrite/DEN/soil 控制 Ren.cpp 结果落盘各列是否写入；check_zahyo 控制
 * 坐标区域显示；Country/offsets 参与算法；Create1/2=global_GR[0..1]。Web 映射：Country/offsets/
 * Create1/2 直接生效；其余保存于 settings 状态（展示层接入后即插即用）。
 */
export const COUNTRY_NAMES = [
  'None', 'EURO', 'USA', 'China', 'Hongkong', 'Singaple', 'Switzerland', 'Malaysia',
  'thailand', 'Taiwan', 'Indonesia', 'United Kingdom', 'Jordan', 'Japan', 'Egypt',
  'Russia', 'Turkey', 'Poland', 'Saudi Arabia', 'South Africa', 'Mexico', 'Australia',
  'New Zealand', 'Czech Republic', 'Canada', 'Qatar', 'Kuwait', 'Oman', 'Philippines',
  'Iran', 'UAE', 'BV Check Note', 'Norway', 'Chili',
]; // OLD getCountryName（WinMain.cpp:3712）按 CCODE 顺序

// 坐标显示行（label, checkZ 下标 0-based，右列可选）：对应 resource.rc IDC_CHECK_Z1..Z25
const Z_ROWS = [
  ['WM(20×20)', 0, null, null],
  ['WM1', 1, 'etc9', 17],
  ['WM2', 2, 'etc10', 18],
  ['IR1', 3, 'Sup1', 19],
  ['IR2', 4, 'Sup2', 20],
  ['IR3', 5, 'Sup3', 21],
  ['Thread', 6, 'Sup4', 22],
  ['Hologram', 7, 'Sup5', 23],
  ['Dart', 8, 'Sup6', 24],
  ['etc1', 9, null, null],
  ['etc2', 10, null, null],
  ['etc3', 11, null, null],
  ['etc4', 12, null, null],
  ['etc5', 13, null, null],
  ['etc6', 14, null, null],
  ['etc7', 15, null, null],
  ['etc8', 16, null, null],
];

export default function SettingDialogueDialog({ initial, onOk, onCancel }) {
  const [d, setD] = useState({
    ...initial,
    checkZ: [...initial.checkZ],
    overwrite: [...initial.overwrite],
    den1to11: [...initial.den1to11],
  });
  const set = (patch) => setD((p) => ({ ...p, ...patch }));
  const toggleArr = (key, i) => setD((p) => {
    const arr = [...p[key]];
    arr[i] = !arr[i];
    return { ...p, [key]: arr };
  });

  return (
    <div className="setdlg">
      <div className="setdlg-cols">
        {/* ===== 左列 ===== */}
        <div className="setdlg-col">
          <fieldset className="setdlg-group">
            <legend>Country</legend>
            <select className="setdlg-country" value={d.country}
              onChange={(e) => set({ country: Number(e.target.value) })}>
              {COUNTRY_NAMES.map((n, i) => <option key={n} value={i}>{n}</option>)}
            </select>
          </fieldset>

          <fieldset className="setdlg-group">
            <legend>Format</legend>
            <div className="setdlg-flexrow">
              <label><input type="radio" name="sd-format" checked={d.format === 0} onChange={() => set({ format: 0 })} />M8</label>
              <label className="setdlg-disabled"><input type="radio" name="sd-fmt-e1" disabled />ETC</label>
            </div>
            <div className="setdlg-flexrow">
              <label><input type="radio" name="sd-format" checked={d.format === 1} onChange={() => set({ format: 1 })} />M1</label>
              <label className="setdlg-disabled"><input type="radio" name="sd-fmt-e2" disabled />ETC</label>
            </div>
          </fieldset>

          <fieldset className="setdlg-group">
            <legend>Header Exist?</legend>
            <label><input type="checkbox" checked={d.headerExist} onChange={(e) => set({ headerExist: e.target.checked })} />Yes</label>
          </fieldset>

          <fieldset className="setdlg-group">
            <legend>Offset Value</legend>
            <div className="setdlg-offset"><span>IR-Green offset</span>
              <input type="number" value={d.redOffset} onChange={(e) => set({ redOffset: Number(e.target.value) || 0 })} /></div>
            <div className="setdlg-offset"><span>GP-GR offset</span>
              <input type="number" value={d.grnOffset} onChange={(e) => set({ grnOffset: Number(e.target.value) || 0 })} /></div>
          </fieldset>

          <fieldset className="setdlg-group">
            <legend>Draw Area?</legend>
            <label><input type="checkbox" checked={d.drawArea} onChange={(e) => set({ drawArea: e.target.checked })} />Yes</label>
          </fieldset>

          <fieldset className="setdlg-group">
            <legend>Adjust Speed ?</legend>
            <label><input type="checkbox" checked={d.adjustSpeed} onChange={(e) => set({ adjustSpeed: e.target.checked })} />Yes</label>
            <label className="setdlg-disabled"><input type="checkbox" disabled checked={d.oldTypeAdjust} />Old Type Adjustment</label>
          </fieldset>

          <fieldset className="setdlg-group">
            <legend>Graph Data Generation</legend>
            <label><input type="checkbox" checked={d.create1} onChange={(e) => set({ create1: e.target.checked })} />Create1</label>
            <div className="setdlg-note">（※）勾选 ON 状态时不进行文件输出（原版为日文注释）</div>
            <label><input type="checkbox" checked={d.create2} onChange={(e) => set({ create2: e.target.checked })} />Create2</label>
            <div className="setdlg-note">（※）工具一旦关闭，图表数据将丢失（原版为日文注释）</div>
            <label><input type="checkbox" checked={d.uniqueFileName} onChange={(e) => set({ uniqueFileName: e.target.checked })} />Name Unique File Name</label>
          </fieldset>
        </div>

        {/* ===== 中列：Select Coordinate to be Displayed ===== */}
        <div className="setdlg-col">
          <fieldset className="setdlg-group setdlg-z">
            <legend>Select Coordinate to be Displayed</legend>
            {Z_ROWS.map(([labelA, idxA, labelB, idxB]) => (
              <div key={labelA} className="setdlg-zrow">
                <label><input type="checkbox" checked={d.checkZ[idxA]} onChange={() => toggleArr('checkZ', idxA)} />{labelA}</label>
                {labelB && <label><input type="checkbox" checked={d.checkZ[idxB]} onChange={() => toggleArr('checkZ', idxB)} />{labelB}</label>}
              </div>
            ))}
            <div className="setdlg-zbtns">
              <button className="btn btn-xs" onClick={() => set({ checkZ: Array(25).fill(true) })}>Check All</button>
              <button className="btn btn-xs" onClick={() => set({ checkZ: Array(25).fill(false) })}>Uncheck All</button>
            </div>
          </fieldset>
        </div>

        {/* ===== 右列：Overwrite + Mouse Emphasis + OK/Cancel ===== */}
        <div className="setdlg-col">
          <fieldset className="setdlg-group">
            <legend>Overwrite</legend>
            <div className="setdlg-s32">
              {[0, 1, 2, 3].map((col) => (
                <div key={col} className="setdlg-s32col">
                  {Array.from({ length: 8 }, (_, r) => {
                    const i = col * 8 + r;
                    return (
                      <label key={i}>
                        <input type="checkbox" checked={d.overwrite[i]} onChange={() => toggleArr('overwrite', i)} />
                        {i + 1}
                      </label>
                    );
                  })}
                </div>
              ))}
            </div>
            <div className="setdlg-flexrow">
              <label><input type="checkbox" checked={d.dart1} onChange={(e) => set({ dart1: e.target.checked })} />Dart1</label>
              <label><input type="checkbox" checked={d.dart2} onChange={(e) => set({ dart2: e.target.checked })} />Dart2</label>
            </div>
            <div className="setdlg-denlabel">Denomination Supplemental Function</div>
            <div className="setdlg-s32">
              {[0, 1, 2, 3].map((col) => (
                <div key={col} className="setdlg-s32col">
                  {col < 3
                    ? Array.from({ length: 3 }, (_, r) => {
                        const i = col * 3 + r;
                        return (
                          <label key={i}>
                            <input type="checkbox" checked={d.den1to11[i]} onChange={() => toggleArr('den1to11', i)} />
                            {i + 1}
                          </label>
                        );
                      })
                    : <>
                        <label><input type="checkbox" checked={d.den1to11[9]} onChange={() => toggleArr('den1to11', 9)} />10</label>
                        <label><input type="checkbox" checked={d.den1to11[10]} onChange={() => toggleArr('den1to11', 10)} />11</label>
                        <label><input type="checkbox" checked={d.den12to31} onChange={(e) => set({ den12to31: e.target.checked })} />12 - 31</label>
                      </>
                  }
                </div>
              ))}
            </div>
          </fieldset>

          <fieldset className="setdlg-group">
            <legend>Mouse Emphasis</legend>
            <label><input type="checkbox" checked={d.mouseEmphasis} onChange={(e) => set({ mouseEmphasis: e.target.checked })} />Emphasis</label>
          </fieldset>

          <div className="setdlg-okcancel">
            <button className="btn" onClick={() => onOk(d)}>OK</button>
            <button className="btn" onClick={onCancel}>Cancel</button>
          </div>
        </div>
      </div>
    </div>
  );
}
