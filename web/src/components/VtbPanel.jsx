/**
 * VTB 区面板。
 * 对应原版 resource.rc：IDC_TAB_VTB_MODE(915,147) / IDC_TAB_VTB_PROCESS(915,161) 两个 Tab，
 * IDC_LIST_VTB(916,175,278,75) 列表 + IDC_BUTTON_LOAD_VTB(1195,175) + IDC_EDIT_VTB_SELECT(916,252)。
 * P4：现接入 /api/vtb/load，渲染解析后的 6 Mode × 8 Process × command 结构（command = function/len/params/sum）。
 */
import { useState } from 'react';

export default function VtbPanel({ pushHistory }) {
  const [path, setPath] = useState('data/ZAR/X_VTB_ZAR_131601260001.bin');
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [modeIdx, setModeIdx] = useState(0);
  const [procIdx, setProcIdx] = useState(0);

  /** 加载并解析 VTB 模板文件（调用 /api/vtb/load） */
  const onLoad = async () => {
    if (!path) return;
    setLoading(true);
    setError('');
    try {
      const r = await fetch('/api/vtb/load', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ path }),
      });
      const j = await r.json();
      if (j.error) {
        setError(j.error);
        setData(null);
      } else {
        setData(j);
        setModeIdx(0);
        setProcIdx(0);
      }
      if (pushHistory) pushHistory(`Load VTB: ${path}`);
    } catch (e) {
      setError(String(e));
      setData(null);
    } finally {
      setLoading(false);
    }
  };

  const mode = data ? data.modes[modeIdx] : null;
  const proc = mode ? mode.processes[procIdx] : null;

  return (
    <fieldset className="vtb-panel">
      <legend>VTB</legend>
      <div className="gasoti-row">
        <input
          className="gasoti-edit"
          placeholder="VTB 文件路径"
          value={path}
          onChange={(e) => setPath(e.target.value)}
        />
        <button className="btn btn-xs" onClick={onLoad} disabled={loading}>
          {loading ? '...' : 'Load VTB'}
        </button>
      </div>
      {error && <div className="val-empty">{error}</div>}
      {data && (
        <>
          <div className="vtb-tabs">
            {data.modes.map((m, i) => (
              <span
                key={i}
                className={`vtb-tab ${i === modeIdx ? 'active' : ''}`}
                onClick={() => { setModeIdx(i); setProcIdx(0); }}
              >M{i}</span>
            ))}
          </div>
          <div className="vtb-proc-row">
            {mode.processes.map((p, i) => (
              <span
                key={i}
                className={`vtb-proc ${i === procIdx ? 'active' : ''}`}
                title={`${p.count} 条命令`}
                onClick={() => setProcIdx(i)}
              >P{i}</span>
            ))}
          </div>
          <div className="vtb-cmd-table">
            <div className="vtb-cmd-head">
              <span>fn</span><span>len</span><span>params</span><span>sum</span>
            </div>
            {proc && proc.commands.map((c, i) => (
              <div key={i} className="vtb-cmd-row">
                <span>0x{c.function.toString(16).toUpperCase()}</span>
                <span>{c.len}</span>
                <span>{c.params.join(',')}</span>
                <span>{c.sum ?? ''}</span>
              </div>
            ))}
            {proc && proc.commands.length === 0 && (
              <div className="vtb-cmd-empty">无命令</div>
            )}
          </div>
          <div className="vtb-note">{data.note}</div>
        </>
      )}
    </fieldset>
  );
}
