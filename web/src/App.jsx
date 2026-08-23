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

      {/* 右侧区：绝对定位 X613, Y88, 宽787，高682；内部所有面板直接用 .rc 坐标(局部 left=rcX-613, top=rcY) */}
      <div className="right-area">
        {/* Mouse Point (rc 631,1) */}
        <div className="rc rc-mouse-point"><MousePointCompact pushHistory={pushHistory} /></div>
        {/* Reduction Image 1 / 2 (rc 1101,2 / 1182,2) */}
        <div className="rc rc-reduction-1"><ReductionImageCompact variant={1} pushHistory={pushHistory} /></div>
        <div className="rc rc-reduction-2"><ReductionImageCompact variant={2} pushHistory={pushHistory} /></div>
        {/* Image Processing (rc 630,77) */}
        <div className="rc rc-image-processing"><ParamPanelGroup pushHistory={pushHistory} /></div>
        {/* Validation Result N=1/N=2 (rc 630,216 / 630,243) */}
        <div className="rc rc-validation"><ValidationCompact /></div>
        {/* Operation (rc 630,350) */}
        <div className="rc rc-operation"><OperationPanel pushHistory={pushHistory} /></div>
        {/* Notes / TH Row (rc 630,530 / 630,570) */}
        <div className="rc rc-notes"><NotesRow /></div>
        <div className="rc rc-th-row"><ThRow pushHistory={pushHistory} /></div>
        {/* Make Graph / Statistics (rc 630,341) */}
        <div className="rc rc-make-graph"><MakeGraphRow pushHistory={pushHistory} /></div>
        <div className="rc rc-statistics"><StatisticsRow pushHistory={pushHistory} /></div>
        {/* Graph File 行 (rc 997,265) */}
        <div className="rc rc-graph-file"><GraphFileRow pushHistory={pushHistory} /></div>
        {/* Graph1 / Graph2 黑底编辑框 (rc 1068,361 / 1068,492) */}
        <fieldset className="rc rc-graph1"><legend>Graph1</legend><textarea className="graph-black-edit" defaultValue={'0.12\n0.05\n0.88\n0.91\n0.79'} /></fieldset>
        <fieldset className="rc rc-graph2"><legend>Graph2</legend><textarea className="graph-black-edit" defaultValue={'0.10\n0.07\n0.85\n0.93\n0.81'} /></fieldset>
        {/* S2 图表（Graph 区右侧） */}
        <div className="rc rc-s2chart"><S2Chart fileName="graph1.grp" /></div>
        {/* 最右端大区：Result Details / ATB / VTB (rc 916,16, 宽484) */}
        <div className="rc rc-right-end">
          <ResultDetails pushHistory={pushHistory} />
          <AtbPanel
            fileName={atbFile} setFileName={setAtbFile}
            version={atbVer} setVersion={setAtbVer}
            list={atbList} selected={atbSel} setSelected={setAtbSel}
            radioMode={atbRadio} setRadioMode={setAtbRadio}
            pushHistory={pushHistory}
          />
        </div>
      </div>

      {/* 底部全局状态栏（Coordinate/Function rc 629,646；底部 static top682 全宽1400） */}
      <BottomStatusRow
        coordFileName="E:\AI_Studio\NCR_tool\Singan2_Lai_GBVE_SR_AtlaKataWORK_ATL_240_10309\85901.txt"
        funcNameFile="functions.txt"
        onChangeCoord={() => setActiveDialog('loadCoord')}
        onChangeFunc={() => setActiveDialog('funcName')}
      />

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