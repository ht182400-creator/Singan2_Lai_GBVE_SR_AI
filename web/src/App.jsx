import React, { useEffect, useState, useCallback, useRef } from 'react';

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
import {
  openSession, getImage, analyzeByPath, runImageOps, makeGraph,
} from './api.js';

// ---------------------------------------------------------------------------
// 通道/副通道 → 波段图像映射（对照 WinMain.cpp ImgType[] 与 mariner_reader 的
// WAVE_TO_IMG：k=0..12 → Img1,Img20,Img21,Img22,Img2..Img6,Img16..Img19）。
// Img1..Img6 / Img16..Img22 为原始波段(raw)；Img7..Img15 为中间计算波段(intermediate)。
// 语义对应需以对拍确认为准（P0 标注）。
const VIEW_WAVES = {
  'IR1 (A1)':        { name: 'Img1',  mode: 'raw' },
  'Green P (B)':     { name: 'Img2',  mode: 'raw' },
  'Green Ref_F (C)': { name: 'Img3',  mode: 'raw' },
  'Green Ref_B (D)': { name: 'Img4',  mode: 'raw' },
  'Blue Ref_F (E1)': { name: 'Img5',  mode: 'raw' },
  'Blue Ref_B (E2)': { name: 'Img6',  mode: 'raw' },
  'IR^2/64':         { name: 'Img7',  mode: 'intermediate' },
  'IR-Gr+offset':    { name: 'Img8',  mode: 'intermediate' },
  'Gp-Gr+offset':    { name: 'Img9',  mode: 'intermediate' },
  'abs(IR-Gp)':      { name: 'Img10', mode: 'intermediate' },
  'IR - Gp':         { name: 'Img11', mode: 'intermediate' },
  '(IR-Gp)^2/8':     { name: 'Img12', mode: 'intermediate' },
  'Gp - IR':         { name: 'Img13', mode: 'intermediate' },
  'IR & Gp':         { name: 'Img14', mode: 'intermediate' },
  'IR | Gp':         { name: 'Img15', mode: 'intermediate' },
  'Red Ref_F (F1)':  { name: 'Img16', mode: 'raw' },
  'Red Ref_B (F2)':  { name: 'Img17', mode: 'raw' },
  UV1:               { name: 'Img18', mode: 'raw' },
  UV2:               { name: 'Img19', mode: 'raw' },
  'IR2 (A2)':        { name: 'Img20', mode: 'raw' },
  'IR3_F (A3)':      { name: 'Img21', mode: 'raw' },
  'IR4_B (A4)':      { name: 'Img22', mode: 'raw' },
};
const CHANNEL_LABELS = [
  'IR1 (A1)', 'Green P (B)', 'Green Ref_F (C)', 'Green Ref_B (D)',
  'Blue Ref_F (E1)', 'Blue Ref_B (E2)', 'IR^2/64', 'IR-Gr+offset',
  'Gp-Gr+offset', 'abs(IR-Gp)',
];
const SUB_LABELS = [
  'IR - Gp', '(IR-Gp)^2/8', 'Gp - IR', 'IR & Gp', 'IR | Gp',
  'Red Ref_F (F1)', 'Red Ref_B (F2)', 'UV1', 'UV2', 'IR2 (A2)', 'IR3_F (A3)', 'IR4_B (A4)',
];

const DEFAULT_DAT = 'E:\\AI_Studio\\NCR_tool\\Singan2_Lai_GBVE_SR_AI\\data\\2A_DA_111017_115542.dat';
const DEFAULT_ZFILE = 'E:\\AI_Studio\\NCR_tool\\Singan2_Lai_GBVE_SR_AI\\data\\ZAR\\X_ATB_ZAR_132006050001.txt';
const DEFAULT_WTABLE = 'E:\\AI_Studio\\NCR_tool\\Singan2_Lai_GBVE_SR_AI\\data\\GBV_DIV_H.bin';

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

  // ---- P0 会话 / 数据状态（对应 MAIN.H global_Mai / global_oneimg）----
  const [datPath, setDatPath] = useState(DEFAULT_DAT);
  const [zfilePath, setZfilePath] = useState(DEFAULT_ZFILE);
  const [wtablePath] = useState(DEFAULT_WTABLE);
  const [recordCount, setRecordCount] = useState(0);
  const [record, setRecord] = useState(0);            // global_Mai（0 基）
  const [viewWave, setViewWave] = useState(VIEW_WAVES['IR1 (A1)']);
  const [ir1Img, setIr1Img] = useState(null);         // IR1 画布图像
  const [ir2Img, setIr2Img] = useState(null);         // IR2 画布图像
  const [busy, setBusy] = useState(false);

  // ---- P1 分析结果（对应 S2[32] / global_etc）----
  const [s2, setS2] = useState(null);
  const [etc, setEtc] = useState(null);
  const [kin, setKin] = useState(1);
  const [country, setCountry] = useState(0);
  const [batchStats, setBatchStats] = useState(null); // Statistics 批量结果

  // ---- P3 图表 ----
  const [graphData, setGraphData] = useState(null);

  const pushHistory = useCallback((msg) => {
    setHistory((h) => [`${msg} @ ${new Date().toLocaleTimeString()}`, ...h].slice(0, 50));
  }, []);

  // ===== P0：打开数据 + 加载波段图像 =====
  const loadImages = useCallback(async (rec, wave) => {
    setBusy(true);
    try {
      // IR2 固定取 Img2（另一面 SRU_Side 尚未移植，暂以第 2 波段近似）
      const [a, b] = await Promise.all([
        getImage({ datPath, record: rec, wave: wave.name, mode: wave.mode, wtablePath }),
        getImage({ datPath, record: rec, wave: 'Img2', mode: 'raw', wtablePath }),
      ]);
      setIr1Img(a);
      setIr2Img(b);
    } catch (e) {
      pushHistory(`图像加载失败: ${e.message}`);
    } finally {
      setBusy(false);
    }
  }, [datPath, wtablePath, pushHistory]);

  const handleOpen = useCallback(async (path, jumpTo) => {
    const p = path || datPath;
    setBusy(true);
    try {
      const s = await openSession(p);
      setDatPath(p);
      setRecordCount(s.record_count);
      const target = jumpTo != null ? Math.max(0, Math.min(s.record_count - 1, jumpTo - 1)) : 0;
      setRecord(target);
      pushHistory(`打开 ${s.record_count} 枚（13 波段/枚）`);
      setBusy(false);
      await loadImages(target, viewWave);
    } catch (e) {
      pushHistory(`打开失败: ${e.message}`);
      setBusy(false);
    }
  }, [datPath, viewWave, loadImages, pushHistory]);

  const handleNav = useCallback(async (delta) => {
    if (!recordCount) {
      pushHistory('请先 Go 打开数据文件');
      return;
    }
    const next = Math.max(0, Math.min(recordCount - 1, record + delta));
    if (next === record) return;
    setRecord(next);
    await loadImages(next, viewWave);
    pushHistory(`Record ${next + 1}/${recordCount}`);
  }, [recordCount, record, viewWave, loadImages, pushHistory]);

  // 切换通道/副通道 → 换波段
  const handleWaveSelect = useCallback(async (label) => {
    const w = VIEW_WAVES[label];
    if (!w) return;
    setViewWave(w);
    pushHistory(`波段 → ${label}(${w.name})`);
    await loadImages(record, w);
  }, [record, loadImages, pushHistory]);

  const handleChannel = useCallback((i) => {
    setChannel(i);
    handleWaveSelect(CHANNEL_LABELS[i]);
  }, [handleWaveSelect]);

  // ===== P1：运行分析（ALL32）=====
  const runAnalysis = useCallback(async () => {
    setBusy(true);
    try {
      const res = await analyzeByPath({ datPath, zfilePath, record, kin, country });
      setS2(res.s2);
      setEtc(res.etc);
      pushHistory(`分析 record=${record} 完成 s2[${res.s2.length}] etc[${res.etc.length}]`);
    } catch (e) {
      pushHistory(`分析失败: ${e.message}`);
    } finally {
      setBusy(false);
    }
  }, [datPath, zfilePath, record, kin, country, pushHistory]);

  // ===== P1：批量统计（Statistics）=====
  const runStatistics = useCallback(async (start, step, times) => {
    if (!recordCount) {
      pushHistory('Statistics：请先打开数据');
      return;
    }
    setBusy(true);
    try {
      const n = Math.max(1, Math.min(times || 1, 40));
      const list = [];
      for (let i = 0; i < n; i++) {
        const rec = Math.max(0, Math.min(recordCount - 1, start + i * (step || 1)));
        const r = await analyzeByPath({ datPath, zfilePath, record: rec, kin, country });
        list.push(r.s2);
        pushHistory(`Statistics ${i + 1}/${n} rec=${rec}`);
      }
      const len = list[0].length;
      const avg = [];
      const std = [];
      for (let j = 0; j < len; j++) {
        let s = 0;
        for (const row of list) s += row[j];
        const m = s / list.length;
        let v = 0;
        for (const row of list) v += (row[j] - m) ** 2;
        avg.push(m);
        std.push(Math.sqrt(v / list.length));
      }
      setBatchStats({ avg, std, count: list.length });
      setS2(list[0]);
      pushHistory(`Statistics 完成：${list.length} 枚`);
    } catch (e) {
      pushHistory(`Statistics 失败: ${e.message}`);
    } finally {
      setBusy(false);
    }
  }, [datPath, zfilePath, kin, country, recordCount, pushHistory]);

  // ===== P2：图像处理（ImageEngine 算子）=====
  const processImage = useCallback(async (ops) => {
    setBusy(true);
    try {
      const img = await runImageOps({
        datPath, record, wave: viewWave.name, ops, wtablePath,
      });
      setIr1Img(img);
      pushHistory(`图像处理: ${ops.map((o) => o.op).join('+')}`);
    } catch (e) {
      pushHistory(`图像处理失败: ${e.message}`);
    } finally {
      setBusy(false);
    }
  }, [datPath, record, viewWave, wtablePath, pushHistory]);

  const restoreImage = useCallback(async () => {
    await loadImages(record, viewWave);
    pushHistory('Restore Image');
  }, [loadImages, record, viewWave, pushHistory]);

  // ===== P3：Make Graph =====
  const handleMakeGraph = useCallback(async () => {
    setBusy(true);
    try {
      const g = await makeGraph({
        datPath, record, zfilePath, wave: viewWave.name, maxAreas: 8, wtablePath,
      });
      setGraphData(g);
      pushHistory(`Make Graph: ${g.series.length} 序列 / ${g.stats.length} 区域`);
    } catch (e) {
      pushHistory(`Make Graph 失败: ${e.message}`);
    } finally {
      setBusy(false);
    }
  }, [datPath, record, zfilePath, viewWave, wtablePath, pushHistory]);

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

  // 挂载后自动打开默认数据（P0 验收：能看到真实图像）；无后端时静默失败
  const mountedRef = useRef(false);
  useEffect(() => {
    if (mountedRef.current) return;
    mountedRef.current = true;
    handleOpen(DEFAULT_DAT, null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const onContextMenu = (e) => {
    e.preventDefault();
    setCtxMenu({ x: e.clientX, y: e.clientY });
  };

  const chartData = s2 ?? batchStats?.avg ?? null;

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
        <ImagePane title="IR1" imageData={ir1Img} />
        <DataSelectorBar
          pushHistory={pushHistory}
          datPath={datPath} setDatPath={setDatPath}
          record={record} recordCount={recordCount}
          onNav={handleNav} onGo={handleOpen}
        />
        <ImagePane title="IR2" imageData={ir2Img} />
      </div>
    );
  };

  return (
        <div className="main-window" onClick={() => { setActiveMenu(null); setCtxMenu(null); }}>
        <TitleBar onResize={() => {}} />
        <TopMenuBar activeMenu={activeMenu} setActiveMenu={setActiveMenu} setActiveDialog={setActiveDialog} pushHistory={pushHistory} />
        <ChannelTab channel={channel} setChannel={handleChannel} />
        <SubToolbarRow active={subActive} setActive={setSubActive} pushHistory={pushHistory} onSelect={handleWaveSelect} />

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
        {/* Image Processing (rc 630,77) — P2：算子实时作用于当前波段 */}
        <RC id="image-processing" className="rc-image-processing" dl={20} dt={103}>
          <ParamPanelGroup pushHistory={pushHistory} onProcess={processImage} onRestore={restoreImage} />
        </RC>
        {/* Validation Result N=1/N=2 (rc 630,216 / 630,243) — 判定需 ATB/VTB 模板比较[需补移植] */}
        <RC id="validation" className="rc-validation" dl={20} dt={264}><ValidationCompact /></RC>
        {/* GASOTI 真币图文本区 (rc 629,269) — resource.rc 真实存在，曾被误删 */}
        <RC id="gasoti" className="rc-gasoti" dl={19} dt={390}><GasotiPanel /></RC>
        {/* Operation (rc 630,350) — RUN=执行 ALL32 分析 */}
        <RC id="operation" className="rc-operation" dl={220} dt={585}>
          <OperationPanel pushHistory={pushHistory} onRun={runAnalysis} />
        </RC>
        {/* Notes / TH Row (rc 630,530 / 630,570) */}
        <RC id="notes" className="rc-notes" dl={220} dt={770}><NotesRow /></RC>
        <RC id="th-row" className="rc-th-row" dl={20} dt={700}><ThRow pushHistory={pushHistory} /></RC>
        {/* Make Graph / Statistics (rc 630,341 / 892,342) — P3/P1 接后端 */}
        <RC id="make-graph" className="rc-make-graph" dl={20} dt={500}>
          <MakeGraphRow pushHistory={pushHistory} onMakeGraph={handleMakeGraph} />
        </RC>
        <RC id="statistics" className="rc-statistics" dl={485} dt={395}>
          <StatisticsRow pushHistory={pushHistory} onStatistics={runStatistics} />
        </RC>
        {/* Make Graph 下方绘图区 / 图例 (500x250, 可拖拽) — P3：真实序列 */}
        <RC id="graph-plot" className="rc-graph-plot" dl={20} dt={540} as="fieldset">
          <legend>Graph</legend>
          <GraphPlot graphData={graphData} />
        </RC>
        {/* Graph File 行 (rc 997,265) */}
        <RC id="graph-file" className="rc-graph-file" dl={461} dt={350}><GraphFileRow pushHistory={pushHistory} /></RC>
        {/* Graph1 / Graph2 黑底编辑框 (rc 1068,361 / 1068,492) */}
        <RC id="graph1" className="rc-graph1" dl={547} dt={475} as="fieldset"><legend>Graph1</legend><textarea className="graph-black-edit" defaultValue={'0.12\n0.05\n0.88\n0.91\n0.79'} /></RC>
        <RC id="graph2" className="rc-graph2" dl={547} dt={620} as="fieldset"><legend>Graph2</legend><textarea className="graph-black-edit" defaultValue={'0.10\n0.07\n0.85\n0.93\n0.81'} /></RC>
        {/* S2 图表（Graph 区右侧窄条）— P1：真实 s2 / 批量均值 */}
        <RC id="s2chart" className="rc-s2chart" dl={732} dt={475}><S2Chart fileName="graph1.grp" s2={chartData} /></RC>
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
          onAction={(a) => { pushHistory(`Cont → ${a}`); if (a === 'OK') runAnalysis(); setActiveDialog(null); }}
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
