/**
 * VTB 区面板。
 * 对应原版 resource.rc：IDC_TAB_VTB_MODE(915,147) / IDC_TAB_VTB_PROCESS(915,161) 两个 Tab，
 * IDC_LIST_VTB(916,175,278,75) 列表 + IDC_BUTTON_LOAD_VTB(1195,175) + IDC_EDIT_VTB_SELECT(916,252)。
 * 该区域曾被对照清单误判为“原版无此区域”而删除，此处按 resource.rc 真实坐标恢复渲染。
 */
import { useState } from 'react';

/** VTB 列表示例数据（占位，后续接入 M 系列后端） */
const VTB_ITEMS = ['VTB_001', 'VTB_002', 'VTB_003', 'VTB_004', 'VTB_005'];

export default function VtbPanel({ pushHistory }) {
  const [tab, setTab] = useState('mode');
  const [sel, setSel] = useState('');

  /** 处理 Load VTB 按钮点击，记录历史 */
  const onLoad = () => {
    if (pushHistory) pushHistory('Load VTB...');
  };

  return (
    <fieldset className="vtb-panel">
      <legend>VTB</legend>
      <div className="vtb-tabs">
        <span
          className={`vtb-tab ${tab === 'mode' ? 'active' : ''}`}
          onClick={() => setTab('mode')}
        >Mode</span>
        <span
          className={`vtb-tab ${tab === 'process' ? 'active' : ''}`}
          onClick={() => setTab('process')}
        >Process</span>
      </div>
      <select
        className="vtb-list"
        size={4}
        value={sel}
        onChange={(e) => setSel(e.target.value)}
      >
        {VTB_ITEMS.map((it) => (
          <option key={it} value={it}>{it}</option>
        ))}
      </select>
      <div className="gasoti-row">
        <input
          className="gasoti-edit"
          placeholder="VTB select"
          value={sel}
          onChange={(e) => setSel(e.target.value)}
        />
        <button className="btn btn-xs" onClick={onLoad}>Load VTB...</button>
      </div>
    </fieldset>
  );
}
