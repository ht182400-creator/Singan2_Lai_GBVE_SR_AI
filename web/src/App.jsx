import React, { useEffect, useState, useCallback } from 'react';

import TopMenuBar from './components/TopMenuBar.jsx';
import TitleBar from './components/TitleBar.jsx';
import ChannelTab from './components/ChannelTab.jsx';
import SubToolbarRow from './components/SubToolbarRow.jsx';

import ImagePane from './components/ImagePane.jsx';
import DataSelectorBar from './components/DataSelectorBar.jsx';

import MousePointCompact from './components/MousePointCompact.jsx';
import ReductionImageCompact from './components/ReductionImageCompact.jsx';
import ParamPanelGroup from './components/ParamPanelGroup.jsx';
import OperationPanel from './components/OperationPanel.jsx';
import ValidationCompact from './components/ValidationCompact.jsx';
import NotesRow from './components/NotesRow.jsx';
import ThRow from './components/ThRow.jsx';

import MakeGraphRow from './components/MakeGraphRow.jsx';
import StatisticsRow from './components/StatisticsRow.jsx';
import GraphFileRow from './components/GraphFileRow.jsx';
import S2Chart from './components/S2Chart.jsx';
import BottomStatusRow from './components/BottomStatusRow.jsx';

import DialogModal from './components/DialogModal.jsx';
import ContextMenu from './components/ContextMenu.jsx';
import ListResultsView from './components/ListResultsView.jsx';
import ResultDetails from './components/ResultDetails.jsx';
import AtbPanel from './components/AtbPanel.jsx';
import GasotiPanel from './components/GasotiPanel.jsx';
import VtbPanel from './components/VtbPanel.jsx';
import RC from './components/RC.jsx';
import GraphPlot from './components/GraphPlot.jsx';

import { sampleResults } from './data/sample.js';

export default function App() {
  const [activeMenu, setActiveMenu] = useState(null);
  const [activeDialog, setActiveDialog] = useState(null);
  const [channel, setChannel] = useState(0);
  const [subActive, setSubActive] = useState('IR1');
  const [history, setHistory] = useState(['Ready']);
  const [viewMode, setViewMode] = useState('image'); // image / list / multi
  const [ctxMenu, setCtxMenu] = useState(null);

  // ATB 面板 state（最右侧独立区）
  const [atbFile, setAtbFile] = useState('atb_file.atb');
  const [atbVer, setAtbVer] = useState('TH1');
  const [atbList] = useState(['ATB_001', 'ATB_002', 'ATB_003', 'ATB_004', 'ATB_005', 'ATB_006', 'ATB_007']);
  const [atbSel, setAtbSel] = useState(-1);
  const [atbRadio, setAtbRadio] = useState(0);

  const pushHistory = useCallback((msg) => {
    setHistory((h) => [`${msg} @ ${new Date().toLocaleTimeString()}`, ...h].slice(0, 50));
  }, []);

  const handleAction = (k) => {
    pushHistory(k);
    if (k === 'Cont. (Alt+R)' || k === 'Cont') setActiveDialog('confirm');
    if (k === 'Coordinate') setActiveDialog('coordinate');
    if (k === 'Finish') setActiveDialog('finish');
  };

  // Alt+R global → Cont. Confirm dialog
  useEffect(() => {
    const onKey = (e) => {
      if (e.altKey && (e.key === 'r' || e.key === 'R')) {
        e.preventDefault();
        setActiveDialog('confirm');
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  const onContextMenu = (e) => {
    e.preventDefault();
    setCtxMenu({ x: e.clientX, y: e.clientY });
  };

  const renderMainCanvas = () => {
    if (viewMode === 'list') return <ListResultsView results={sampleResults} />;
    if (viewMode === 'multi') {
      return (
        <div className="multi-pane">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="multi-cell">
              <ImagePane title={`Multi #${i + 1}`} small />
            </div>
          ))}
        </div>
      );
    }
    return (
      <div className="image-stack" onContextMenu={onContextMenu}>
        <ImagePane title="IR1" />
        <DataSelectorBar />
        <ImagePane title="IR2" />
      </div>
    );
  };

  return (
        <div className="main-window" onClick={() => { setActiveMenu(null); setCtxMenu(null); }}>
        <TitleBar onResize={() => {}} />
        <TopMenuBar activeMenu={activeMenu} setActiveMenu={setActiveMenu} setActiveDialog={setActiveDialog} pushHistory={pushHistory} />
        <ChannelTab channel={channel} setChannel={setChannel} />
        <SubToolbarRow active={subActive} setActive={setSubActive} pushHistory={pushHistory} />

      {/* 左侧主画布：绝对定位 X0–613, Y88 起 */}
      <div className="main-canvas">{renderMainCanvas()}</div>

      {/* 右侧区：绝对定位 X900, Y44, 宽900，高956；内部所有面板直接用 .rc 坐标(局部 left=rcX-613, top=rcY*1.337) */}
      <div className="right-area">
        {/* Mouse Point (rc 631,1) */}
        <RC id="mouse-point" className="rc-mouse-point" dl={22} dt={0}><MousePointCompact pushHistory={pushHistory} /></RC>
        {/* Operation History (rc 714,6) — resource.rc 真实存在，曾被误删；Switch View 置于其后 */}
        <RC id="op-history" className="rc-op-history" dl={122} dt={8}>
          <div className="op-history-head">
            <span>Operation History</span>
            <button className="btn btn-xs" onClick={() => pushHistory('Switch View')}>Switch View</button>
            <button className="btn btn-xs" onClick={() => pushHistory('Clear History')}>Clear</button>
          </div>
          <select className="op-history-list" size={3}>
            {history.slice(0, 16).map((h, i) => (
              <option key={i} value={i}>{h}</option>
            ))}
          </select>
        </RC>
        {/* Reduction Image 1 / 2 (rc 1101,2 / 1182,2) */}
        <RC id="reduction-1" className="rc-reduction-1" dl={586} dt={3}><ReductionImageCompact variant={1} pushHistory={pushHistory} /></RC>
        <RC id="reduction-2" className="rc-reduction-2" dl={683} dt={3}><ReductionImageCompact variant={2} pushHistory={pushHistory} /></RC>
        {/* Image Processing (rc 630,77) */}
        <RC id="image-processing" className="rc-image-processing" dl={20} dt={103}><ParamPanelGroup pushHistory={pushHistory} /></RC>
        {/* Validation Result N=1/N=2 (rc 630,216 / 630,243) */}
        <RC id="validation" className="rc-validation" dl={20} dt={264}><ValidationCompact /></RC>
        {/* GASOTI 真币图文本区 (rc 629,269) — resource.rc 真实存在，曾被误删 */}
        <RC id="gasoti" className="rc-gasoti" dl={19} dt={390}><GasotiPanel /></RC>
        {/* Operation (rc 630,350) */}
        <RC id="operation" className="rc-operation" dl={220} dt={585}><OperationPanel pushHistory={pushHistory} /></RC>
        {/* Notes / TH Row (rc 630,530 / 630,570) */}
        <RC id="notes" className="rc-notes" dl={220} dt={770}><NotesRow /></RC>
        <RC id="th-row" className="rc-th-row" dl={20} dt={700}><ThRow pushHistory={pushHistory} /></RC>
        {/* Make Graph / Statistics (rc 630,341 / 892,342) */}
        <RC id="make-graph" className="rc-make-graph" dl={20} dt={500}><MakeGraphRow pushHistory={pushHistory} /></RC>
        <RC id="statistics" className="rc-statistics" dl={485} dt={395}><StatisticsRow pushHistory={pushHistory} /></RC>
        {/* Make Graph 下方绘图区 / 图例 (500x250, 可拖拽) */}
        <RC id="graph-plot" className="rc-graph-plot" dl={20} dt={540} as="fieldset"><legend>Graph</legend><GraphPlot /></RC>
        {/* Graph File 行 (rc 997,265) */}
        <RC id="graph-file" className="rc-graph-file" dl={461} dt={350}><GraphFileRow pushHistory={pushHistory} /></RC>
        {/* Graph1 / Graph2 黑底编辑框 (rc 1068,361 / 1068,492) */}
        <RC id="graph1" className="rc-graph1" dl={547} dt={475} as="fieldset"><legend>Graph1</legend><textarea className="graph-black-edit" defaultValue={'0.12\n0.05\n0.88\n0.91\n0.79'} /></RC>
        <RC id="graph2" className="rc-graph2" dl={547} dt={620} as="fieldset"><legend>Graph2</legend><textarea className="graph-black-edit" defaultValue={'0.10\n0.07\n0.85\n0.93\n0.81'} /></RC>
        {/* S2 图表（Graph 区右侧窄条） */}
        <RC id="s2chart" className="rc-s2chart" dl={732} dt={475}><S2Chart fileName="graph1.grp" /></RC>
        {/* VTB 区 (rc 915,147) — resource.rc 真实存在，曾被误删 */}
        <RC id="vtb" className="rc-vtb" dl={362} dt={197}><VtbPanel pushHistory={pushHistory} /></RC>
        {/* ATB 区 (rc 917,4) */}
        <RC id="atb" className="rc-atb" dl={364} dt={5}>
          <AtbPanel
            fileName={atbFile} setFileName={setAtbFile}
            version={atbVer} setVersion={setAtbVer}
            list={atbList} selected={atbSel} setSelected={setAtbSel}
            radioMode={atbRadio} setRadioMode={setAtbRadio}
            pushHistory={pushHistory}
          />
        </RC>
        {/* Result Details（Web 自创汇总）置于 ATB 下方右侧空白区 */}
        <RC id="result" className="rc-result" dl={380} dt={775}>
          <ResultDetails pushHistory={pushHistory} />
        </RC>
      </div>

      {/* 底部全局状态栏（全宽 1800，位于窗口最底；Coordinate/Function 已移入） */}
      <BottomStatusRow />

      {activeDialog === 'confirm' && (
        <DialogModal
          title="Cont. Confirm"
          actions={['OK', 'Cancel']}
          onAction={(a) => { pushHistory(`Cont → ${a}`); setActiveDialog(null); }}
          onClose={() => setActiveDialog(null)}
        >
          <div>Are you sure to continue processing?</div>
          <div style={{ marginTop: 6, color: '#555' }}>
            Current batch = IR1 / IR2 / UV1 / IR3 (auto-detected)<br />
            Operation: Coordinate + Reduce + Compare
          </div>
        </DialogModal>
      )}
      {activeDialog === 'coordinate' && (
        <DialogModal title="Coordinate Settings" actions={['Apply', 'Close']}
          onAction={(a) => { pushHistory(`Coordinate → ${a}`); if (a === 'Close') setActiveDialog(null); }}
          onClose={() => setActiveDialog(null)}>
          <div>文件: <input defaultValue="default.zahyo" /></div>
          <div style={{ marginTop: 6 }}>通道: <select><option>IR1</option><option>IR2</option><option>UV1</option><option>IR3</option></select></div>
        </DialogModal>
      )}
      {activeDialog === 'finish' && (
        <DialogModal title="Finish" actions={['Yes', 'No']}
          onAction={() => setActiveDialog(null)}
          onClose={() => setActiveDialog(null)}>
          <div>Save current results before exit?</div>
        </DialogModal>
      )}
      {activeDialog === 'loadCoord' && (
        <DialogModal title="Load Coordinate File" actions={['Open', 'Cancel']}
          onAction={() => setActiveDialog(null)}
          onClose={() => setActiveDialog(null)}>
          <div>选择 z file</div>
        </DialogModal>
      )}
      {activeDialog === 'funcName' && (
        <DialogModal title="Load Function Name File" actions={['Open', 'Cancel']}
          onAction={() => setActiveDialog(null)}
          onClose={() => setActiveDialog(null)}>
          <div>选择 functions.txt</div>
        </DialogModal>
      )}

      {ctxMenu && (
        <ContextMenu x={ctxMenu.x} y={ctxMenu.y} onClose={() => setCtxMenu(null)}
          onAction={(k) => { pushHistory(`CtxMenu → ${k}`); setCtxMenu(null); }} />
      )}
    </div>
  );
}