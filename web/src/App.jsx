import React, { useEffect, useState, useCallback, useMemo, useRef } from 'react';

import TopMenuBar from './components/TopMenuBar.jsx';
import TitleBar from './components/TitleBar.jsx';
import ChannelTab from './components/ChannelTab.jsx';
import SubToolbarRow from './components/SubToolbarRow.jsx';

import ImagePane from './components/ImagePane.jsx';
import DataSelectorBar from './components/DataSelectorBar.jsx';

import MousePointCompact from './components/MousePointCompact.jsx';
import ReductionImagePanel from './components/ReductionImagePanel.jsx';
import ParamPanelGroup from './components/ParamPanelGroup.jsx';
import OperationPanel from './components/OperationPanel.jsx';
import ValidationCompact from './components/ValidationCompact.jsx';
import NotesRow from './components/NotesRow.jsx';
import ThRow from './components/ThRow.jsx';

import MakeGraphRow from './components/MakeGraphRow.jsx';
import GraphFileRow from './components/GraphFileRow.jsx';
import S2Chart from './components/S2Chart.jsx';
import BottomStatusRow from './components/BottomStatusRow.jsx';
import { arrayToText, buildResultRows, s2ToTextList, normalizeS2, normalizeEtc, S2_FUNC_NAMES, shouldAnalyzeData2 } from './utils/analysis.js';
import { buildGraphStats } from './utils/graphStats.js';
import { downloadTextFile } from './utils/file.js';
import { logInfo, logDebug, logError, logWarning, exportDebugLog } from './utils/debugLogger.js';

import DialogModal from './components/DialogModal.jsx';
import ContextMenu from './components/ContextMenu.jsx';
import GraphResultPanel from './components/GraphResultPanel.jsx';
import AtbPanel from './components/AtbPanel.jsx';
import GasotiPanel from './components/GasotiPanel.jsx';
import VtbPanel from './components/VtbPanel.jsx';
import RC from './components/RC.jsx';
import GraphPlot from './components/GraphPlot.jsx';
import GraphViewOverlay from './components/GraphViewOverlay.jsx';

import {
  openSession, getImage, analyzeByPath, analyzeBatchByPath, runImageOps, makeGraph, getSmallImage,
  parseZfile, uploadDat,
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
// 批量分析取样数上限（仅作极端保护，正常 = 本文件 record 数；MFC 为一次性全量返回）
const STATISTICS_MAX_RECORDS = 200000;

export default function App() {
  const [activeMenu, setActiveMenu] = useState(null);
  const [activeDialog, setActiveDialog] = useState(null);
  const [channel, setChannel] = useState(0);
  const [subActive, setSubActive] = useState('IR1');
  const [history, setHistory] = useState(['Ready']);
  // Table Function 下拉（原版 IDC_COMBO_SET_TABLE_FUNCTION，位于 Operation History 容器内 x=715,y=55）
  const [tableFunc, setTableFunc] = useState('000 IR-Gr+offset');
  const TABLE_FUNCS = ['000 IR-Gr+offset', '001 Difference', '002 Test', '003 TBD'];
  const [viewMode, setViewMode] = useState('image'); // image / graph / multi
  const [ctxMenu, setCtxMenu] = useState(null);

  // ---- 右键菜单相关状态 ----
  const [showGrid, setShowGrid] = useState(false);
  const [mouseShowV, setMouseShowV] = useState(true); // Show(V) = free-hand 拖选开关
  const [mouseFollow, setMouseFollow] = useState(true); // bClic：true=区域跟随光标，false=固定
  const [selectMode, setSelectMode] = useState(1); // 1=Don't Show, 2=Absolute, 3=Speed
  const [redOffset, setRedOffset] = useState(128);
  const [grnOffset, setGrnOffset] = useState(128);
  const [coordInfo, setCoordInfo] = useState(null);

  // ATB 面板 state（最右侧独立区）
  const [atbFile, setAtbFile] = useState('atb_file.atb');
  const [atbVer, setAtbVer] = useState('TH1');
  const [atbList] = useState(['ATB_001', 'ATB_002', 'ATB_003', 'ATB_004', 'ATB_005', 'ATB_006', 'ATB_007']);
  const [atbSel, setAtbSel] = useState(-1);
  const [atbRadio, setAtbRadio] = useState(0);

  // ---- P0 会话 / 数据状态（对应 MAIN.H global_Mai / global_oneimg）----
  // Data1 / Data2：复刻 MFC 双文件路径，可分别打开不同 .dat（global_FileName / global_FileName2）
  const [datPath1, setDatPath1] = useState(DEFAULT_DAT);
  const [datPath2, setDatPath2] = useState(DEFAULT_DAT);
  const [zfilePath, setZfilePath] = useState(DEFAULT_ZFILE);
  const [wtablePath] = useState(DEFAULT_WTABLE);
  const [recordCount1, setRecordCount1] = useState(0);
  const [recordCount2, setRecordCount2] = useState(0);
  const [record1, setRecord1] = useState(0);          // Data1 当前记录（0 基，global_SizeCnt）
  const [record2, setRecord2] = useState(0);          // Data2 当前记录（0 基，global_SizeCnt2）
  const [syncMove, setSyncMove] = useState(true);     // 复刻 IDC_CHECK_SYNC_MOVE
  const [viewWave, setViewWave] = useState(VIEW_WAVES['IR1 (A1)']);
  const [ir1Img, setIr1Img] = useState(null);         // IR1 画布图像（来自 Data1）
  const [ir2Img, setIr2Img] = useState(null);         // IR2 画布图像（来自 Data2）
  const [busy, setBusy] = useState(false);

  // 最近路径下拉（复刻 IDC_NAME_COMBO / IDC_NAME_COMBO2 历史，持久化到 localStorage）
  const loadRecent = useCallback((key) => {
    try { const v = localStorage.getItem(key); return v ? JSON.parse(v) : null; } catch { return null; }
  }, []);
  const saveRecent = useCallback((key, arr) => {
    try { localStorage.setItem(key, JSON.stringify(arr.slice(0, 20))); } catch {}
  }, []);
  const prependRecent = useCallback((setter, key, path) => {
    setter((prev) => {
      const next = [path, ...prev.filter((p) => p !== path)].slice(0, 20);
      saveRecent(key, next);
      return next;
    });
  }, [saveRecent]);
  const [recentPaths1, setRecentPaths1] = useState(() => loadRecent('singan2.ai.recentPaths1') || [DEFAULT_DAT]);
  const [recentPaths2, setRecentPaths2] = useState(() => loadRecent('singan2.ai.recentPaths2') || [DEFAULT_DAT]);

  // ---- P1 分析结果（对应 S2[32] / global_etc）----
  const [s2, setS2] = useState(null);
  const [etc, setEtc] = useState(null);
  // Data2（IR2）独立分析结果：当 IR1/IR2 为不同文件时并列显示 Result Details / 跨 record 趋势
  const [s2_2, setS2_2] = useState(null);
  const [etc_2, setEtc_2] = useState(null);
  // ---- P4 Validation Result（来自小图像段，见 core extract_small_image_validation）----
  const [validation, setValidation] = useState(null);
  const [kin, setKin] = useState(1);
  const [country, setCountry] = useState(0);
  const [batchStats, setBatchStats] = useState(null); // Statistics 批量结果（Data1）
  const [batchStats2, setBatchStats2] = useState(null); // Statistics 批量结果（Data2）

  // ---- P5 鼠标点（对应 OLD mouse_range_point + global_stop_mouse_range）----
  const [mousePos, setMousePos] = useState(null);            // {x,y} 图像像素（选区左上角）
  const [mouseSize, setMouseSize] = useState({ w: 20, h: 20 }); // 默认 20×20

  // ---- P3 图表 ----
  const [graphData, setGraphData] = useState(null);
  const [graphFn, setGraphFn] = useState(1); // 函数列号（对应 OLD global_select_no，1..44）
  // 批量参数（吸收原 StatisticsRow）：Start/Step/Times/1<2
  // 默认值对齐 OLD MFC：IDC_EDIT_GRAPH_STATIS_START/STEP/TIMES = 10 / 10 / 5
  const [mgStart, setMgStart] = useState(10);
  const [mgStep, setMgStep] = useState(10);
  const [mgTimes, setMgTimes] = useState(5);
  const [mgCmp12, setMgCmp12] = useState(false);
  // Make Graph 复选框/单选参数（对应 OLD IDC_CHECK_MAKE_GRAPH/2、Black/White、+Area、+TH）
  const [mgInclude1, setMgInclude1] = useState(true);
  const [mgInclude2, setMgInclude2] = useState(true);
  const [mgBw, setMgBw] = useState('black');
  const [mgArea, setMgArea] = useState(true);
  const [mgTh, setMgTh] = useState(true);
  // 阈值（对应 OLD IDC_SLIDER_NITI / global_th）：提升到 App 级，
  // 供 ParamPanelGroup 与 GraphPlot 标题共享，修复 TH 不同步（issue#2）
  const [threshold, setThreshold] = useState(90);
  // Image Processing 参数（供 Make Graph 复刻 OLD CreateGraph1 的 gradient/niti 管线）
  const [ipParams, setIpParams] = useState({ gradType: 0, gain: 1, nitiType: 'Gra+Bin', threshold: 90, colorPoint: 150 });

  const pushHistory = useCallback((msg) => {
    setHistory((h) => [`${msg} @ ${new Date().toLocaleTimeString()}`, ...h].slice(0, 50));
  }, []);

  // ===== P0：打开数据 + 加载波段图像 =====
  // Data1 / Data2 各自独立：IR1 来自 datPath1+record1，IR2 来自 datPath2+record2；
  // 当前波段 viewWave 全局一致（复刻 MFC 同一通道同时看两文件）。
  // counts 用于在 handleOpen 里绕过 React 状态批处理导致的旧 closure（打开 Data2 时 recordCount2 尚未刷新）
  const loadImages = useCallback(async (rec1, rec2, wave, counts = {}) => {
    const c1 = counts.count1 ?? recordCount1;
    const c2 = counts.count2 ?? recordCount2;
    setBusy(true);
    try {
      const [a, b] = await Promise.all([
        c1 > 0
          ? getImage({
              datPath: datPath1, record: rec1, wave: wave.name, mode: wave.mode, wtablePath,
              redOffset, grnOffset,
            })
          : Promise.resolve(null),
        c2 > 0
          ? getImage({
              datPath: datPath2, record: rec2, wave: wave.name, mode: '2byte', wtablePath,
              redOffset, grnOffset,
            })
          : Promise.resolve(null),
      ]);
      if (a) setIr1Img(a);
      if (b) setIr2Img(b);
      // 首次加载把鼠标点默认放到图像中心（以 Data1 图像尺寸为准）
      if (a) {
        setMousePos((p) => {
          if (p) return p;
          const w = a.width ? a.width : 186;
          const h = a.height ? a.height : 88;
          return { x: Math.max(0, Math.floor((w - 20) / 2)), y: Math.max(0, Math.floor((h - 20) / 2)) };
        });
      }
      // 预览小图取自 Data1
      if (c1 > 0) {
        try {
          const sm = await getSmallImage({ datPath: datPath1, record: rec1 });
          setValidation(sm.validation || null);
        } catch (e) {
          setValidation(null);
        }
      }
    } catch (e) {
      pushHistory(`图像加载失败: ${e.message}`);
    } finally {
      setBusy(false);
    }
  }, [datPath1, datPath2, recordCount1, recordCount2, wtablePath, redOffset, grnOffset, pushHistory]);

  const handleOpen = useCallback(async (path, panelIndex, jumpTo) => {
    const p = path || (panelIndex === 2 ? datPath2 : datPath1);
    setBusy(true);
    try {
      const s = await openSession(p);
      logInfo(`openSession Data${panelIndex}`, { path: p, record_count: s.record_count, wave_count: s.wave_count });
      const target = jumpTo != null ? Math.max(0, Math.min(s.record_count - 1, jumpTo - 1)) : 0;
      if (panelIndex === 2) {
        setDatPath2(p);
        setRecordCount2(s.record_count);
        setRecord2(target);
        prependRecent(setRecentPaths2, 'singan2.ai.recentPaths2', p);
        // Make Graph / Statistics 的 Times 默认覆盖 Data1/Data2 中较大文件的全部记录
        setMgStart(0);
        setMgStep(1);
        setMgTimes(Math.min(Math.max(recordCount1, s.record_count, 1), 8192));
      } else {
        setDatPath1(p);
        setRecordCount1(s.record_count);
        setRecord1(target);
        prependRecent(setRecentPaths1, 'singan2.ai.recentPaths1', p);
        // Make Graph / Statistics 的 Times 默认覆盖 Data1/Data2 中较大文件的全部记录
        setMgStart(0);
        setMgStep(1);
        setMgTimes(Math.min(Math.max(s.record_count, recordCount2, 1), 8192));
        // 若 Data2 路径与 Data1 相同，同步其总张数，保证两画布都能渲染
        if (datPath2 === p) {
          setRecordCount2(s.record_count);
          if (syncMove) {
            const t2 = Math.min(target, s.record_count - 1);
            setRecord2(t2);
          }
        } else if (syncMove && recordCount2 > 0) {
          const t2 = Math.min(target, recordCount2 - 1);
          setRecord2(t2);
        }
      }
      setS2(null);          // 清空分析缓存，Validation 面板不再显示上一份图结果
      setEtc(null);
      pushHistory(`打开 Data${panelIndex} ${s.record_count} 枚（13 波段/枚）`);
      setBusy(false);
      const r1 = panelIndex === 1 ? target : record1;
      const r2 = panelIndex === 2
        ? target
        : (syncMove && recordCount2 > 0 ? Math.min(target, recordCount2 - 1) : record2);
      // 用本次打开后的最新总张数调用 loadImages，避免 closure 中的 recordCount2 还是旧值
      const nextCount1 = panelIndex === 1 ? s.record_count : recordCount1;
      const nextCount2 = panelIndex === 2
        ? s.record_count
        : (datPath2 === p ? s.record_count : recordCount2);
      await loadImages(r1, r2, viewWave, { count1: nextCount1, count2: nextCount2 });
    } catch (e) {
      logError(`openSession Data${panelIndex} failed`, { path: p, message: e.message });
      pushHistory(`打开失败: ${e.message}`);
      setBusy(false);
    }
  }, [datPath1, datPath2, record1, record2, syncMove, recordCount2, viewWave, loadImages, pushHistory, prependRecent]);

  // 上传并打开本地 .dat（拖拽到 IR1→Data1 / IR2→Data2，或点 Open 选文件）：复刻 OLD DropDlg 拖入即加载
  const handleOpenFile = useCallback(async (file, panelIndex = 1) => {
    setBusy(true);
    try {
      const up = await uploadDat(file);
      pushHistory(`上传 ${up.name} → Data${panelIndex}`);
      await handleOpen(up.path, panelIndex, null);
    } catch (e) {
      pushHistory(`打开失败: ${e.message}`);
      setBusy(false);
    }
  }, [handleOpen, pushHistory]);

  const handleNav = useCallback(async (panelIndex, delta) => {
    if (panelIndex === 1) {
      if (!recordCount1) { pushHistory('请先 Go 打开 Data1'); return; }
      const next1 = Math.max(0, Math.min(recordCount1 - 1, record1 + delta));
      if (next1 === record1) return;
      setRecord1(next1);
      let next2 = record2;
      if (syncMove && recordCount2 > 0) {
        next2 = Math.max(0, Math.min(recordCount2 - 1, record2 + delta));
        setRecord2(next2);
      }
      setS2(null);
      setEtc(null);
      await loadImages(next1, next2, viewWave);
      pushHistory(`Data1 Record ${next1 + 1}/${recordCount1}` + (syncMove ? `, Data2 ${next2 + 1}/${recordCount2}` : ''));
    } else {
      if (!recordCount2) { pushHistory('请先 Go 打开 Data2'); return; }
      const next2 = Math.max(0, Math.min(recordCount2 - 1, record2 + delta));
      if (next2 === record2) return;
      setRecord2(next2);
      setS2(null);
      setEtc(null);
      await loadImages(record1, next2, viewWave);
      pushHistory(`Data2 Record ${next2 + 1}/${recordCount2}`);
    }
  }, [recordCount1, recordCount2, record1, record2, syncMove, viewWave, loadImages, pushHistory]);

  // 切换通道/副通道 → 换波段
  const handleWaveSelect = useCallback(async (label) => {
    const w = VIEW_WAVES[label];
    if (!w) return;
    setViewWave(w);
    pushHistory(`波段 → ${label}(${w.name})`);
    await loadImages(record1, record2, w);
  }, [record1, record2, loadImages, pushHistory]);

  const handleChannel = useCallback((i) => {
    setChannel(i);
    handleWaveSelect(CHANNEL_LABELS[i]);
  }, [handleWaveSelect]);

  // ===== P1：运行分析（ALL32）=====
  // 当 IR1/IR2 为不同文件时，Data1/Data2 分别计算并各自显示 Result Details。
  const runAnalysis = useCallback(async () => {
    setBusy(true);
    const need2 = datPath2 && recordCount2 > 0 && !(datPath1 === datPath2 && record1 === record2);
    logInfo('runAnalysis start', { datPath1, datPath2, record1, record2, need2, zfilePath, kin, country });
    try {
      const tasks = [
        analyzeByPath({ datPath: datPath1, zfilePath, record: record1, kin, country }),
      ];
      if (need2) {
        tasks.push(analyzeByPath({ datPath: datPath2, zfilePath, record: record2, kin, country }));
      }
      const results = await Promise.all(tasks);
      logDebug('runAnalysis response', { need2, s2Len1: results[0].s2?.length, etcLen1: results[0].etc?.length, s2Len2: results[1]?.s2?.length });
      // 显示层归一化：丢弃后端 1-based 的未用下标 0（s2[0]/etc[0] 恒为 0）
      setS2(normalizeS2(results[0].s2));
      setEtc(normalizeEtc(results[0].etc));
      if (need2) {
        setS2_2(normalizeS2(results[1].s2));
        setEtc_2(normalizeEtc(results[1].etc));
      } else if (datPath1 === datPath2 && record1 === record2) {
        // 同文件同记录：直接复用，避免重复请求
        setS2_2(normalizeS2(results[0].s2));
        setEtc_2(normalizeEtc(results[0].etc));
      } else {
        setS2_2(null);
        setEtc_2(null);
      }
      pushHistory(`分析 record=${record1}` + (need2 ? ` / Data2=${record2}` : '') + ` 完成 s2[${results[0].s2.length}] etc[${results[0].etc.length}]`);
    } catch (e) {
      logError('runAnalysis error', { message: e.message, stack: e.stack });
      pushHistory(`分析失败: ${e.message}`);
    } finally {
      setBusy(false);
    }
  }, [datPath1, datPath2, zfilePath, record1, record2, recordCount2, kin, country, pushHistory]);

  // ===== P1：批量统计（Statistics）=====
  // Data1/Data2 分别批量分析；不同文件时各自生成跨 record 趋势，同文件时只保留一份。
  const runStatistics = useCallback(async (start, step, times) => {
    if (!recordCount1) {
      pushHistory('Statistics：请先打开数据');
      return;
    }
    setBusy(true);
    try {
      const computeBatch = async (datPath, recordCount, label) => {
        const stepVal = step || 1;
        const startVal = Math.max(0, Math.min(recordCount - 1, start));
        // 按 Start/Step 在当前文件内最多能取到的不重复记录数，避免 record 数小的文件被重复分析
        const available = Math.max(1, Math.floor(Math.max(0, recordCount - 1 - startVal) / stepVal) + 1);
        const n = Math.max(1, Math.min(times || 1, available, STATISTICS_MAX_RECORDS));
        logInfo(`Statistics ${label} request`, { datPath, zfilePath, start: startVal, step: stepVal, count: n, recordCount, available, kin, country });
        // 批量分析：一次 HTTP 请求让服务端并行计算 n 个 record（替代逐条发 200 次）
        const resp = await analyzeBatchByPath({ datPath, zfilePath, start: startVal, step: stepVal, count: n, kin, country });
        const all = []; // 每条 {recordNo, s2, etc}，供 S2Chart 多记录 txt 列表
        const list = [];
        const rawResults = resp.results || [];
        const errors = [];
        let skipped = 0;
        for (const item of rawResults) {
          if (!item.s2) {
            skipped++;
            if (item.error) errors.push(item.error);
            continue;
          } // 跳过服务端单条失败
          const ns2 = normalizeS2(item.s2);
          const netc = normalizeEtc(item.etc || []);
          list.push(ns2);
          all.push({ recordNo: item.record + 1, s2: ns2, etc: netc });
        }
        logDebug(`Statistics ${label} response`, { requested: n, returned: rawResults.length, valid: list.length, skipped, sampleErrors: errors.slice(0, 5), respCount: resp.count, respRecordCount: resp.record_count });
        if (!list.length) {
          const errHint = errors.length ? `；样例错误：${errors.slice(0, 3).join(' / ')}` : '';
          logWarning(`Statistics ${label} no valid results`, { requested: n, returned: rawResults.length, skipped, errors: errors.slice(0, 5) });
          pushHistory(`Statistics ${label} 服务端未返回有效结果（请求 ${n} 枚，返回 ${rawResults.length} 条，有效 0 条${skipped ? `，跳过 ${skipped} 条` : ''}）${errHint}`);
          return { avg: [], std: [], count: 0, all: [], firstS2: [] };
        }
        pushHistory(`Statistics ${label} 批量分析 请求 ${n} 枚 / 返回 ${rawResults.length} 条 / 有效 ${list.length} 条 / 跳过 ${skipped} 条 完成`);
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
        return { avg, std, count: list.length, all, firstS2: list[0] };
      };

      // 与 Make Graph 的 1/2 复选框一致：仅分析被勾选的文件，避免「只分析 IR1」时仍计算和显示 IR2 的 Result Details / 趋势
      let b1 = null;
      if (mgInclude1) {
        b1 = await computeBatch(datPath1, recordCount1, 'IR1');
        setBatchStats({ avg: b1.avg, std: b1.std, count: b1.count, all: b1.all });
        setS2(b1.firstS2);
      } else {
        setBatchStats(null);
        setS2(null);
      }

      let b2 = null;
      if (shouldAnalyzeData2(mgInclude2, datPath1, datPath2, recordCount2)) {
        b2 = await computeBatch(datPath2, recordCount2, 'IR2');
        setBatchStats2({ avg: b2.avg, std: b2.std, count: b2.count, all: b2.all });
        setS2_2(b2.firstS2);
      } else {
        setBatchStats2(null);
        setS2_2(null);
      }

      if (!b1 && !b2) {
        pushHistory('Statistics：请勾选 1 或 2 至少一个文件');
      } else {
        pushHistory(`Statistics 完成：Data1=${b1 ? b1.count : 0} 枚` + (b2 ? ` / Data2=${b2.count} 枚` : ''));
      }
    } catch (e) {
      pushHistory(`Statistics 失败: ${e.message}`);
    } finally {
      setBusy(false);
    }
  }, [datPath1, datPath2, zfilePath, kin, country, recordCount1, recordCount2, mgInclude1, mgInclude2, pushHistory]);

  // ===== P2：图像处理（ImageEngine 算子）=====
  // 复刻 OLD NitiMain + NitiMain2：同一份阈值/算子分别施加到 Data1 / Data2，IR1 / IR2 同步更新
  const processImage = useCallback(async (ops) => {
    setBusy(true);
    try {
      const tasks = [];
      if (datPath1) tasks.push(runImageOps({ datPath: datPath1, record: record1, wave: viewWave.name, ops, wtablePath }).then((img) => ({ panel: 1, img })));
      if (datPath2) tasks.push(runImageOps({ datPath: datPath2, record: record2, wave: viewWave.name, ops, wtablePath }).then((img) => ({ panel: 2, img })));
      const results = await Promise.all(tasks);
      for (const r of results) {
        if (r.panel === 1) setIr1Img(r.img);
        else setIr2Img(r.img);
      }
      pushHistory(`图像处理: ${ops.map((o) => o.op).join('+')} (IR1/IR2)`);
    } catch (e) {
      pushHistory(`图像处理失败: ${e.message}`);
    } finally {
      setBusy(false);
    }
  }, [datPath1, datPath2, record1, record2, viewWave, wtablePath, pushHistory]);

  const restoreImage = useCallback(async () => {
    await loadImages(record1, record2, viewWave);
    pushHistory('Restore Image');
  }, [loadImages, record1, record2, viewWave, pushHistory]);

  // ===== P3：Make Graph（复刻 OLD CreateGraph1 + ComputeSuppleResult：跨 record 像素统计）=====
  // IR1（file1，绿色）/ IR2（file2，蓝色）分别按 datPath1 / datPath2 计算，结果合并到 graphData.rows / rows2
  const handleMakeGraph = useCallback(async () => {
    setBusy(true);
    try {
      const area = mousePos && mouseSize ? {
        areaX: mousePos.x,
        areaY: mousePos.y,
        areaW: mouseSize.w,
        areaH: mouseSize.h,
      } : { areaX: 0, areaY: 0, areaW: 20, areaH: 20 };
      const baseArgs = {
        wave: viewWave ? viewWave.name : 0,
        maxRecords: mgTimes,
        startRecord: mgStart,
        step: mgStep,
        ...ipParams,
        ...area,
        black: mgBw === 'black',
        wtablePath,
      };
      const tasks = [];
      if (mgInclude1) tasks.push(makeGraph({ ...baseArgs, datPath: datPath1 }).then((g) => ({ tag: 1, g })));
      if (mgInclude2 && recordCount2 > 0) tasks.push(makeGraph({ ...baseArgs, datPath: datPath2 }).then((g) => ({ tag: 2, g })));
      if (!tasks.length) throw new Error('请勾选 1 或 2，并先 Go 打开对应数据');
      const results = await Promise.all(tasks);
      let g1 = null;
      let g2 = null;
      for (const r of results) {
        if (r.tag === 1) g1 = r.g;
        else g2 = r.g;
      }
      logInfo('Make Graph response', { ir1Rows: g1?.rows?.length, ir2Rows: g2?.rows?.length, params: baseArgs });
      const merged = {
        ...(g1 || g2),
        rows: g1 ? g1.rows : (g2 ? g2.rows : []),
        rows2: g2 ? g2.rows : undefined,
        file1_path: datPath1,
        file2_path: datPath2,
      };
      setGraphData(merged);
      pushHistory(`Make Graph: IR1=${merged.rows.length} IR2=${merged.rows2 ? merged.rows2.length : 0} record 像素统计（Start=${mgStart} Step=${mgStep} Times=${mgTimes} TH=${ipParams.threshold}）`);
    } catch (e) {
      logError('Make Graph error', { message: e.message, stack: e.stack });
      pushHistory(`Make Graph 失败: ${e.message}`);
    } finally {
      setBusy(false);
    }
  }, [datPath1, datPath2, recordCount2, mgInclude1, mgInclude2, viewWave, mousePos, mouseSize, ipParams, mgBw, mgStart, mgStep, mgTimes, wtablePath, pushHistory]);

  // ===== View All Result：导出 Statistics / Make Graph 的跨 record 数据为 CSV =====
  const exportAllResults = useCallback(() => {
    const rows = batchStats?.all?.length
      ? batchStats.all
      : (graphData?.rows?.map((r) => ({
          recordNo: r.record + 1,
          s2: r.s2,
          etc: r.etc,
        })) ?? []);
    if (!rows.length) {
      pushHistory('View All Result：无跨 record 数据，请先运行 Statistics 或 Make Graph');
      return;
    }
    const header = ['record', ...S2_FUNC_NAMES, ...Array.from({ length: 12 }, (_, i) => `ETC[${i + 1}]`)].join(',');
    const lines = rows.map((r) => [r.recordNo, ...(r.s2 || []), ...(r.etc || [])].join(','));
    const csv = [header, ...lines].join('\n');
    const filename = `graph_all_results_${new Date().toISOString().slice(0, 10).replace(/-/g, '')}.csv`;
    if (downloadTextFile(filename, csv, 'text/csv;charset=utf-8;')) {
      pushHistory(`View All Result：已导出 ${rows.length} 条记录 CSV → ${filename}`);
    } else {
      pushHistory('View All Result：CSV 导出失败');
    }
  }, [batchStats, graphData, pushHistory]);

  const handleAction = (k) => {
    pushHistory(k);
    if (k === 'Cont. (Alt+R)' || k === 'Cont') setActiveDialog('confirm');
    if (k === 'Coordinate') setActiveDialog('coordinate');
    if (k === 'Finish') setActiveDialog('finish');
  };

  /**
   * 主画布右键菜单动作分发（对应 OLD resource.rc IDR_POPMENU）。
   */
  const handleContextAction = useCallback(async (k) => {
    setCtxMenu(null);
    switch (k) {
      case 'grid':
        setShowGrid((v) => {
          pushHistory(`Grid ${!v ? 'ON' : 'OFF'}`);
          return !v;
        });
        break;
      case 'restore':
        await restoreImage();
        break;
      case 'mousePoint':
        setMouseShowV((v) => {
          pushHistory(`MousePoint(V) ${!v ? 'ON' : 'OFF'}`);
          return !v;
        });
        break;
      case 'showArea-none':
        setSelectMode(1);
        pushHistory("Show Area: Don't Show");
        break;
      case 'showArea-abs':
        setSelectMode(2);
        pushHistory('Show Area: Absolute');
        break;
      case 'showArea-speed':
        setSelectMode(3);
        pushHistory('Show Area: Speed Adjusted');
        break;
      case 'showInfo':
        setActiveDialog('info');
        pushHistory('Show Information');
        break;
      case 'detailSetting':
        setActiveDialog('setting');
        pushHistory('Detail Setting');
        break;
      case 'gradient':
        await processImage([{ op: 'gradient', gtype: 0, amp: 1 }]);
        break;
      case 'binary':
        await processImage([{ op: 'niti', s: 128 }]);
        break;
      case 'noise':
        await processImage([{ op: 'smooth' }]);
        break;
      case 'restoreImg':
        await restoreImage();
        break;
      case 'switchView':
        setViewMode((m) => {
          const next = m === 'image' ? 'graph' : 'image';
          pushHistory(`Switch View → ${next}`);
          return next;
        });
        break;
      case 'reloadCoord':
        if (!zfilePath) {
          pushHistory('Re-Load Coordinate：未设置 zfile');
          break;
        }
        try {
          const z = await parseZfile({ path: zfilePath });
          setCoordInfo(z);
          pushHistory(`Re-Load Coordinate：${z.count ?? z.areas?.length ?? 0} 区域`);
        } catch (e) {
          pushHistory(`Re-Load Coordinate 失败：${e.message}`);
        }
        break;
      default:
        pushHistory(`CtxMenu → ${k}`);
    }
  }, [pushHistory, restoreImage, processImage, zfilePath]);

  // ---- P5 鼠标点：IR1 悬浮跟随 + 点击固定/跟随切换 + 自由手拖选（复刻 OLD MouseMove1 / L_Down / Freemove_mouse）----
  const clampMouse = useCallback((pos) => ({
    x: Math.max(0, Math.min((ir1Img?.width ?? 186) - mouseSize.w, pos.x)),
    y: Math.max(0, Math.min((ir1Img?.height ?? 88) - mouseSize.h, pos.y)),
  }), [ir1Img, mouseSize]);

  // MouseMove1：bClic=true（跟随模式）时区域（固定尺寸）跟随光标
  const handleMouseHover = useCallback((pos) => {
    if (!pos || !mouseFollow) return; // bClic=false 固定模式不跟随
    setMousePos(clampMouse(pos));
  }, [mouseFollow, clampMouse]);

  // L_Down（非自由手模式）：点击切换 bClic（固定/跟随），并固定到该点
  const handleMouseClick = useCallback((pos) => {
    if (!pos) return;
    setMousePos(clampMouse(pos));
    setMouseFollow((f) => {
      pushHistory(`Mouse Point → (${pos.x},${pos.y}) ${f ? '固定' : '跟随'}`);
      return !f;
    });
  }, [clampMouse, pushHistory]);

  // 自由手拖选完成（Show(V) 开）：把拖拽区域写入 mousePos + mouseSize（对应 L_Up）
  // 完成后 bClic=TRUE（跟随），这样取消 Show(V) 后区域可任意移动
  const handleMouseSelect = useCallback((sel) => {
    if (!sel) {
      pushHistory('Mouse Point 拖选取消');
      return;
    }
    const w = Math.max(1, sel.x2 - sel.x1 + 1);
    const h = Math.max(1, sel.y2 - sel.y1 + 1);
    setMouseSize({ w, h });
    setMousePos({
      x: Math.max(0, Math.min((ir1Img?.width ?? 186) - w, sel.x1)),
      y: Math.max(0, Math.min((ir1Img?.height ?? 88) - h, sel.y1)),
    });
    setMouseFollow(true);
    pushHistory(`Mouse Point 拖选 → ${w}×${h} @ (${sel.x1},${sel.y1})`);
  }, [ir1Img, pushHistory]);

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
    handleOpen(DEFAULT_DAT, 1, null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const onContextMenu = (e) => {
    e.preventDefault();
    setCtxMenu({ x: e.clientX, y: e.clientY });
  };

  const filesDiffer = datPath1 !== datPath2 && recordCount2 > 0;
  const chartData = s2 ?? batchStats?.avg ?? null;
  const chartData2 = filesDiffer ? (s2_2 ?? batchStats2?.avg ?? null) : null;
  // Result Details 行：当前 s2 → R1..R32（Statistics 批量时显示均值）
  const resultRows = useMemo(() => buildResultRows(s2), [s2]);
  const resultRows2 = useMemo(() => buildResultRows(s2_2), [s2_2]);

  // Graph1/Graph2 文本：Make Graph 生成跨 record 分布后显示 OLD 风格列表；否则回退单条 s2/etc
  const graphStats = useMemo(
    () => buildGraphStats(graphData, graphFn, { include1: mgInclude1, include2: mgInclude2 }),
    [graphData, graphFn, mgInclude1, mgInclude2]
  );
  const graph1Text = graphData ? graphStats.text1 : arrayToText(s2, 3);
  const graph2Text = graphData ? graphStats.text2 : arrayToText(etc, 3);

  const renderMainCanvas = () => {
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
    const box = mousePos ? { x: mousePos.x, y: mousePos.y, w: mouseSize.w, h: mouseSize.h } : null;
    return (
      <div className="image-stack" onContextMenu={onContextMenu}>
        <ImagePane
          title="IR1"
          imageData={ir1Img}
          showGrid={showGrid}
          box={box}
          showBox={!!box}
          onHover={handleMouseHover}
          onClick={handleMouseClick}
          freeHand={mouseShowV}
          onSelect={handleMouseSelect}
          onSizeChange={setMouseSize}
          onFileDrop={(f) => handleOpenFile(f, 1)}
        />
        <DataSelectorBar
          pushHistory={pushHistory}
          datPath1={datPath1} setDatPath1={setDatPath1}
          datPath2={datPath2} setDatPath2={setDatPath2}
          record1={record1} recordCount1={recordCount1}
          record2={record2} recordCount2={recordCount2}
          onNav1={(d) => handleNav(1, d)} onNav2={(d) => handleNav(2, d)}
          onGo1={(p, n) => handleOpen(p, 1, n)}
          onGo2={(p, n) => handleOpen(p, 2, n)}
          onOpen1={(p) => handleOpen(p, 1, undefined)}
          onOpen2={(p) => handleOpen(p, 2, undefined)}
          onOpenFile1={(f) => handleOpenFile(f, 1)}
          onOpenFile2={(f) => handleOpenFile(f, 2)}
          syncMove={syncMove} setSyncMove={setSyncMove}
          recentPaths1={recentPaths1} recentPaths2={recentPaths2}
        />
        <ImagePane
          title="IR2"
          imageData={ir2Img}
          showGrid={showGrid}
          box={box}
          showBox={!!box}
          onFileDrop={(f) => handleOpenFile(f, 2)}
        />
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
        <RC id="mouse-point" className="rc-mouse-point" dl={22} dt={0}>
          <MousePointCompact
            pushHistory={pushHistory}
            showV={mouseShowV}
            setShowV={setMouseShowV}
            size={mouseSize}
            onApply={({ w, h }) => setMouseSize({ w: Math.max(1, w), h: Math.max(1, h) })}
          />
        </RC>
        {/* Operation History (rc 714,6) — resource.rc 真实存在，曾被误删；Switch View 置于其后 */}
        <RC id="op-history" className="rc-op-history" dl={122} dt={8}>
          <div className="op-history-head">
            <span>Operation History</span>
            <button className="btn btn-xs" onClick={() => setViewMode((m) => { const next = m === 'image' ? 'graph' : 'image'; pushHistory(`Switch View → ${next}`); return next; })}>Switch View</button>
            <button className="btn btn-xs" onClick={() => { const ok = exportDebugLog(); pushHistory(ok ? 'Debug Log 已导出' : 'Debug Log 导出失败'); }}>Debug Log</button>
            <button className="btn btn-xs" onClick={() => { setHistory(['Ready']); pushHistory('Clear History'); }}>Clear</button>
          </div>
          <select className="op-history-list" size={3}>
            {history.slice(0, 16).map((h, i) => (
              <option key={i} value={i}>{h}</option>
            ))}
          </select>
          {/* Table Function 下拉：原版 resource.rc IDC_COMBO_SET_TABLE_FUNCTION 位于 Operation History 容器内 (715,55) */}
          <div className="op-history-table">
            <label title="选择附加基波计算方式；000 IR-Gr+offset 会在读全波段时计算 IR - GreenRef + offset 图像">
              Table Function:
              <select
                className="op-table-select"
                value={tableFunc}
                onChange={(e) => {
                  setTableFunc(e.target.value);
                  pushHistory(`Table Function → ${e.target.value}`);
                }}
              >
                {TABLE_FUNCS.map((t) => (
                  <option key={t} value={t}>{t}</option>
                ))}
              </select>
            </label>
          </div>
        </RC>
        {/* Reduction Image 1 / 2（rc 1101,2 起合并面板，与原版一致：两列各 3 张小图 + Match/Not Match） */}
        <RC id="reduction" className="rc-reduction" dl={586} dt={3}>
          <ReductionImagePanel
            datPath1={datPath1}
            record1={record1}
            recordCount1={recordCount1}
            datPath2={datPath2}
            record2={record2}
            recordCount2={recordCount2}
            pushHistory={pushHistory}
          />
        </RC>
        {/* Image Processing (rc 630,77) — P2：算子实时作用于当前波段 */}
        <RC id="image-processing" className="rc-image-processing" dl={20} dt={103}>
          <ParamPanelGroup pushHistory={pushHistory} onProcess={processImage} onRestore={restoreImage} threshold={threshold} onThresholdChange={setThreshold} onParamsChange={setIpParams} />
        </RC>
        {/* Validation Result N=1/N=2 (rc 630,216 / 630,243) — 现关联当前分析图像；VTB 比对字段待 P4 接入 */}
        <RC id="validation" className="rc-validation" dl={20} dt={264}>
          <ValidationCompact validation={validation} record={record1} />
        </RC>
        {/* GASOTI 真币图文本区 (rc 629,269) — resource.rc 真实存在，曾被误删 */}
        <RC id="gasoti" className="rc-gasoti" dl={19} dt={390}>
          <GasotiPanel
            imageData1={ir1Img}
            imageData2={ir2Img}
            box={mousePos ? { x: mousePos.x, y: mousePos.y, w: mouseSize.w, h: mouseSize.h } : null}
            zfileName={zfilePath ? zfilePath.split(/[\\/]/).pop() : ''}
          />
        </RC>
        {/* Operation (rc 630,350) — RUN=执行 ALL32 分析 */}
        <RC id="operation" className="rc-operation" dl={220} dt={585}>
          <OperationPanel pushHistory={pushHistory} onRun={runAnalysis} />
        </RC>
        {/* Notes / TH Row (rc 630,530 / 630,570) */}
        <RC id="notes" className="rc-notes" dl={220} dt={770}><NotesRow /></RC>
        <RC id="th-row" className="rc-th-row" dl={20} dt={700}><ThRow pushHistory={pushHistory} /></RC>
        {/* Make Graph 容器（原 StatisticsRow + MakeGraphRow + GraphPlot 三合一） */}
        <RC id="make-graph" className="rc-make-graph" dl={20} dt={500}>
          <MakeGraphRow
            pushHistory={pushHistory}
            onMakeGraph={handleMakeGraph}
            onStatistics={runStatistics}
            include1={mgInclude1} setInclude1={setMgInclude1}
            include2={mgInclude2} setInclude2={setMgInclude2}
            bw={mgBw} setBw={setMgBw}
            area={mgArea} setArea={setMgArea}
            th={mgTh} setTh={setMgTh}
            fn={graphFn} setFn={setGraphFn}
            start={mgStart} setStart={setMgStart}
            step={mgStep} setStep={setMgStep}
            times={mgTimes} setTimes={setMgTimes}
            total={Math.max(recordCount1 || 0, recordCount2 || 0) || null}
            cmp12={mgCmp12} setCmp12={setMgCmp12}
          />
          <div className="mg-graph-wrap">
            <GraphPlot
              graphData={graphData}
              fn={graphFn}
              include1={mgInclude1}
              include2={mgInclude2}
              bw={mgBw}
              area={mgArea}
              th={mgTh}
              cmp12={mgCmp12}
              mousePos={mousePos}
              mouseSize={mouseSize}
              channelLabel={CHANNEL_LABELS[channel]}
              threshold={threshold}
            />
          </div>
        </RC>
        {/* Graph File 行 (rc 997,265) */}
        <RC id="graph-file" className="rc-graph-file" dl={461} dt={350}><GraphFileRow pushHistory={pushHistory} /></RC>
        {/* Graph1 / Graph2 / Result Details 合并为单一「Graph 结果」面板（更友好、减少零散容器） */}
        <RC id="graph-result" className="rc-graph-result" dl={547} dt={475}>
          <GraphResultPanel
            fn={graphFn}
            graph1Text={graph1Text}
            graph2Text={graph2Text}
            resultRows={resultRows}
            resultRows2={filesDiffer && mgInclude2 ? resultRows2 : null}
            pushHistory={pushHistory}
            filesDiffer={filesDiffer}
            include2={mgInclude2}
            history={history}
            onClearResult1={() => { setS2(null); setEtc(null); }}
            onClearResult2={() => { setS2_2(null); setEtc_2(null); }}
          />
        </RC>
        {/* S2 图表 + IR1/IR2 txt 列表（Graph 区右侧加宽至 150px）— 跨 record 函数值 */}
        <RC id="s2chart" className={filesDiffer && mgInclude2 ? 'rc-s2chart dual' : 'rc-s2chart'} dl={715} dt={475}>
          {filesDiffer && mgInclude2 ? (
            <>
              <S2Chart
                title="IR1/Data1"
                fileName="graph1.grp"
                s2={chartData}
                graphData={batchStats?.all ? { record_count: batchStats.all.length, rows: batchStats.all.map((r) => ({ record: r.recordNo - 1, s2: r.s2, etc: r.etc })) } : null}
                fn={graphFn}
              />
              <S2Chart
                title="IR2/Data2"
                fileName="graph2.grp"
                s2={chartData2}
                graphData={batchStats2?.all ? { record_count: batchStats2.all.length, rows: batchStats2.all.map((r) => ({ record: r.recordNo - 1, s2: r.s2, etc: r.etc })) } : null}
                fn={graphFn}
              />
            </>
          ) : (
            <S2Chart
              fileName="graph1.grp"
              s2={chartData}
              graphData={batchStats?.all ? { record_count: batchStats.all.length, rows: batchStats.all.map((r) => ({ record: r.recordNo - 1, s2: r.s2, etc: r.etc })) } : null}
              fn={graphFn}
            />
          )}
        </RC>
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
        {/* 2026-09-01：右侧滚动留白，强制滚动容器出现纵向/横向滚动条，避免面板全部挤在可视区内 */}
        <div className="right-area-spacer" aria-hidden="true" />
      </div>

      {/* Graph 视图覆盖层：复刻 MFC Switch View 的左侧图 + 右侧函数列表 + View All Result */}
      {viewMode === 'graph' && (
        <GraphViewOverlay
          graphData={graphData}
          batchStatsAll={batchStats?.all}
          fn={graphFn}
          setFn={setGraphFn}
          pushHistory={pushHistory}
          include1={mgInclude1}
          include2={mgInclude2}
          bw={mgBw}
          area={mgArea}
          th={mgTh}
          cmp12={mgCmp12}
          mousePos={mousePos}
          mouseSize={mouseSize}
          channelLabel={CHANNEL_LABELS[channel]}
          threshold={ipParams.threshold}
          onViewAllResult={exportAllResults}
          onClose={() => setViewMode('image')}
        />
      )}

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
      {activeDialog === 'info' && (
        <DialogModal title="Show Information" actions={['Close']}
          onAction={() => setActiveDialog(null)}
          onClose={() => setActiveDialog(null)}>
          <div style={{ lineHeight: 1.6 }}>
            <div>DAT: {datPath}</div>
            <div>Z File: {zfilePath}</div>
            <div>Record: {record + 1} / {recordCount}</div>
            <div>Wave: {viewWave.name} ({viewWave.mode})</div>
            <div>Grid: {showGrid ? 'ON' : 'OFF'}</div>
            <div>MousePoint(V): {mouseShowV ? 'ON' : 'OFF'}</div>
            <div>Show Area Mode: {selectMode === 1 ? "Don't Show" : selectMode === 2 ? 'Absolute' : 'Speed Adjusted'}</div>
            {coordInfo && (
              <div>Coordinate Areas: {coordInfo.count ?? coordInfo.areas?.length ?? 0}</div>
            )}
          </div>
        </DialogModal>
      )}
      {activeDialog === 'setting' && (
        <DialogModal title="Detail Setting" actions={['Apply', 'Cancel']}
          onAction={(a) => {
            if (a === 'Apply') {
              loadImages(record, viewWave);
              pushHistory(`Detail Setting Applied (R=${redOffset}, G=${grnOffset})`);
            }
            setActiveDialog(null);
          }}
          onClose={() => setActiveDialog(null)}>
          <div style={{ display: 'grid', gap: 8 }}>
            <label>
              Red Offset:
              <input type="number" value={redOffset} onChange={(e) => setRedOffset(Number(e.target.value))} style={{ marginLeft: 8, width: 60 }} />
            </label>
            <label>
              Green Offset:
              <input type="number" value={grnOffset} onChange={(e) => setGrnOffset(Number(e.target.value))} style={{ marginLeft: 8, width: 60 }} />
            </label>
            <div style={{ fontSize: 11, color: '#555' }}>Apply 后重新加载当前波段。</div>
          </div>
        </DialogModal>
      )}

      {ctxMenu && (
        <ContextMenu x={ctxMenu.x} y={ctxMenu.y} onClose={() => setCtxMenu(null)}
          onAction={handleContextAction} />
      )}
    </div>
  );
}
