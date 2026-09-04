import { useCallback, useState } from 'react';
import { loadVtb } from '../api.js';
import FileBrowser from './FileBrowser.jsx';

/**
 * VTB 区面板（1:1 复刻 OLD resource.rc 915-1279, y147-267 与 WinMain.cpp 实现）：
 * - IDC_TAB_VTB_MODE    (915,147)  6 个 Mode Tab：Real / Test / BV check note / Cheque /
 *                                  Function processing / Other route
 * - IDC_TAB_VTB_PROCESS (915,161)  8 个 Process Tab，文案随 Mode 切换（WinMain.cpp:260 Init_Tab_VTBProcess）：
 *     mode 0-3 : BV-in / Optical / Magnetic / UV / Thickness / BV-out / End Processing / reserved
 *     mode 4   : Image processing / Country / Denomination / Damage / Authentic 1 / Authentic 2 / reserved / reserved
 *     mode 5   : route1..route8
 * - IDC_LIST_VTB        (916,175)  命令列表，行格式（WinMain.cpp:253）：
 *     "%4d %04X %04X" + 每个 param " %04X"  →  序号 function len params...
 * - 选中列表行 → 文本回显到 IDC_EDIT_VTB_SELECT (916,252)（WinMain.cpp:970 LBN_SELCHANGE）
 * - IDC_BUTTON_LOAD_VTB (1195,175) Load VTB... → CTemplateVTB::Load → DisplayVTB
 */
const VTB_MODE_TEXTS = ['Real', 'Test', 'BV check note', 'Cheque', 'Function processing', 'Other route'];
const VTB_PROCESS_TEXTS = [
  ['BV-in', 'Optical', 'Magnetic', 'UV', 'Thickness', 'BV-out', 'End Processing', 'reserved'],
  ['Image processing', 'Country', 'Denomination', 'Damage', 'Authentic 1', 'Authentic 2', 'reserved', 'reserved'],
  ['route1', 'route2', 'route3', 'route4', 'route5', 'route6', 'route7', 'route8'],
];
// u16 → "%04X"
const hex4 = (v) => (v ?? 0).toString(16).toUpperCase().padStart(4, '0');
// 命令行（复刻 OLD DisplayVTB 的 sprintf 格式："%4d %04X %04X" + params 各 " %04X"）
const cmdLine = (c, i) => {
  let s = `${String(i).padStart(4, ' ')} ${hex4(c.function)} ${hex4(c.len)}`;
  for (const p of c.params) s += ` ${hex4(p)}`;
  return s;
};

const VTB_DIR = 'E:\\AI_Studio\\NCR_tool\\Singan2_Lai_GBVE_SR_AI\\data\\ZAR';

export default function VtbPanel({ pushHistory }) {
  const [data, setData] = useState(null);
  const [fileName, setFileName] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [modeIdx, setModeIdx] = useState(0);
  const [procIdx, setProcIdx] = useState(0);
  const [selectText, setSelectText] = useState(''); // IDC_EDIT_VTB_SELECT 回显
  const [selIdx, setSelIdx] = useState(-1);         // 列表选中行（保持高亮，同 OLD LB_GETCURSEL）
  const [showBrowser, setShowBrowser] = useState(false);

  // Load VTB...（复刻 OLD IDC_BUTTON_LOAD_VTB → LoadVTB → DisplayVTB）
  const doLoad = useCallback(async (p) => {
    setLoading(true);
    setError('');
    try {
      const r = await loadVtb({ path: p });
      setData(r);
      setModeIdx(0);
      setProcIdx(0);
      setSelectText('');
      setFileName(p.split(/[\\/]/).pop());
      if (pushHistory) pushHistory(`Load VTB: ${p.split(/[\\/]/).pop()} (${r.note ?? ''})`);
    } catch (e) {
      setError(e.message);
      if (pushHistory) pushHistory(`Load VTB 失败: ${e.message}`);
    } finally {
      setLoading(false);
    }
  }, [pushHistory]);

  // 切 Mode：重建 Process Tab 并复位选中（OLD Init_Tab_VTBProcess：DeleteAll + Insert → curSel 复位 0）
  const onModeChange = (i) => {
    setModeIdx(i);
    setProcIdx(0);
    setSelectText('');
    setSelIdx(-1);
  };

  const mode = data ? data.modes[modeIdx] : null;
  const proc = mode ? mode.processes[procIdx] : null;
  const processTexts = VTB_PROCESS_TEXTS[modeIdx < 4 ? 0 : modeIdx === 4 ? 1 : 2];

  return (
    <fieldset className="vtb-panel">
      <legend>VTB</legend>

      {/* Mode Tab（IDC_TAB_VTB_MODE） */}
      <div className="vtb-tabs">
        {VTB_MODE_TEXTS.map((t, i) => (
          <span
            key={t}
            className={`vtb-tab ${i === modeIdx ? 'active' : ''}`}
            onClick={() => onModeChange(i)}
          >{t}</span>
        ))}
        {/* Load VTB...（IDC_BUTTON_LOAD_VTB，原版位于列表右上） */}
        <button className="btn btn-xs vtb-loadbtn" onClick={() => setShowBrowser(true)} disabled={loading}>
          {loading ? '...' : 'Load VTB...'}
        </button>
      </div>

      {/* Process Tab（IDC_TAB_VTB_PROCESS，文案随 Mode 切换） */}
      <div className="vtb-proc-row">
        {processTexts.map((t, i) => (
          <span
            key={t}
            className={`vtb-proc ${i === procIdx ? 'active' : ''}`}
            title={proc && proc.count ? `${proc.count} 条命令` : t}
            onClick={() => { setProcIdx(i); setSelectText(''); setSelIdx(-1); }}
          >{t}</span>
        ))}
      </div>

      {/* 命令列表（IDC_LIST_VTB，行格式同 OLD DisplayVTB） */}
      {error && <div className="val-empty">{error}</div>}
      <select
        className="vtb-list"
        size={8}
        value={selIdx >= 0 ? String(selIdx) : ''}
        onChange={(e) => {
          // 选中行回显到 IDC_EDIT_VTB_SELECT（OLD LBN_SELCHANGE）
          const i = Number(e.target.value);
          setSelIdx(i);
          if (proc && proc.commands[i]) setSelectText(cmdLine(proc.commands[i], i));
        }}
        disabled={!data}
      >
        {proc && proc.commands.map((c, i) => (
          <option key={i} value={String(i)}>{cmdLine(c, i)}</option>
        ))}
        {proc && proc.commands.length === 0 && (
          <option value="" disabled>(无命令)</option>
        )}
      </select>

      {/* 选中回显（IDC_EDIT_VTB_SELECT） */}
      <input className="vtb-select-edit" value={selectText} readOnly placeholder="选中命令回显" />

      {data && (
        <div className="vtb-note">
          {`${fileName} — ${data.note ?? ''} · ${VTB_MODE_TEXTS[modeIdx]} / ${processTexts[procIdx]}`}
        </div>
      )}

      {/* .GPH 同款本地文件选择（原版为 *.bin 文件对话框） */}
      {showBrowser && (
        <FileBrowser
          title="File selection (*.bin)"
          initialPath={VTB_DIR}
          ext=".bin"
          onOk={(p) => { setShowBrowser(false); doLoad(p); }}
          onClose={() => setShowBrowser(false)}
        />
      )}
    </fieldset>
  );
}
