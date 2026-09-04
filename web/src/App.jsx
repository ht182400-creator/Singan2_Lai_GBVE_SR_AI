import React, { useEffect, useState, useCallback, useMemo, useRef } from 'react';
import { ZoomContext } from './zoomContext.js';

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
import FilePathPanel from './components/FilePathPanel.jsx';
import { arrayToText, buildResultRows, s2ToTextList, normalizeS2, normalizeEtc, S2_FUNC_NAMES, shouldAnalyzeData2 } from './utils/analysis.js';
import { buildGraphStats } from './utils/graphStats.js';
import { downloadTextFile } from './utils/file.js';
import { logInfo, logDebug, logError, logWarning, logModule, exportDebugLog, getLog } from './utils/debugLogger.js';

import DialogModal from './components/DialogModal.jsx';
import LogViewer from './components/LogViewer.jsx';
import ContextMenu from './components/ContextMenu.jsx';
import InfoDisplayDialog from './components/InfoDisplayDialog.jsx';
import GraphResultPanel from './components/GraphResultPanel.jsx';
import AtbPanel from './components/AtbPanel.jsx';
import FileBrowser from './components/FileBrowser.jsx';
import GasotiPanel from './components/GasotiPanel.jsx';
import VtbPanel from './components/VtbPanel.jsx';
import RC from './components/RC.jsx';
import GraphPlot from './components/GraphPlot.jsx';
import GraphViewOverlay from './components/GraphViewOverlay.jsx';

import {
  openSession, getImage, analyzeByPath, analyzeBatchByPath, runImageOps, makeGraph, getSmallImage,
  getChannelFrames, parseZfile, uploadDat, getBackendLog, parseBackendLog,
  loadAtb, atbArea, atbUpdate, loadCtb, gphSave, gphLoad,
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
// ATB / CTB 默认样本（复刻 OLD LoadATB / Load Size... 的文件选择，ZAR 样本与 OLD 一致）
const ATB_DEFAULT_BIN = 'E:\\AI_Studio\\NCR_tool\\Singan2_Lai_GBVE_SR_AI\\data\\ZAR\\X_ATB_ZAR_132006050001.bin';
const ATB_DEFAULT_CTB = 'E:\\AI_Studio\\NCR_tool\\Singan2_Lai_GBVE_SR_AI\\data\\ZAR\\X_CTB_ZAR_131601260001_BV100.bin';
// .GPH 图形文件目录（OLD graphfilePath = "GraphFiles"，Save Graph 缺省名 _tempGraph）
const GRAPH_FILES_DIR = 'E:\\AI_Studio\\NCR_tool\\Singan2_Lai_GBVE_SR_AI\\data\\GraphFiles';
// 数据目录（Setting→Load→Data 的文件选择起点）
const DATA_DIR = 'E:\\AI_Studio\\NCR_tool\\Singan2_Lai_GBVE_SR_AI\\data';
// Show All 四色轮换（复刻 OLD OnDrawPaint：ii%4 -> 红/绿/黄/品红）
const ATB_COLORS = ['rgb(255,0,0)', 'rgb(0,255,0)', 'rgb(255,255,0)', 'rgb(255,0,255)'];
// 批量分析取样数上限（仅作极端保护，正常 = 本文件 record 数；MFC 为一次性全量返回）
const STATISTICS_MAX_RECORDS = 200000;

export default function App() {
  const [activeMenu, setActiveMenu] = useState(null);
  const [activeDialog, setActiveDialog] = useState(null);
  // 日志查看器状态：logViewer=null|'ui'|'backend'；logLines 为已解析日志行
  const [logViewer, setLogViewer] = useState(null);
  const [logLines, setLogLines] = useState([]);
  const [logLoading, setLogLoading] = useState(false);
  const [logViewError, setLogViewError] = useState(''); // 日志查看器错误文案（勿命名为 logError，会遮蔽 debugLogger 的 logError 函数）
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

  // ATB 面板 state（1:1 复刻 OLD ATB 区，rc 917,4）
  const [atbPath, setAtbPath] = useState(ATB_DEFAULT_BIN);     // 当前 ATB 文件路径（OLD global_ATB_edit_file）
  const [atbInfo, setAtbInfo] = useState(null);                // { isSru, areaNames[128], areaCount }
  const [atbAreaIdx, setAtbAreaIdx] = useState(0);             // 当前 area（OLD IDC_COMBO_ATB_TYPE）
  const [atbLines, setAtbLines] = useState([]);                // 条目文本行（OLD IDC_LIST_ATB）
  const [atbBytes, setAtbBytes] = useState(null);              // 当前 area 原始条目字节（entries*8）
  const [atbSel, setAtbSel] = useState(-1);                    // 选中条目（OLD LB_GETCURSEL）
  const [atbTh, setAtbTh] = useState(0);                       // TH1-4 单选（OLD GetSelectTHValue）
  const [atbOverlay, setAtbOverlay] = useState(null);          // Show All 叠加矩形（IR1 上绘制）
  const [sizeNotes, setSizeNotes] = useState([]);              // CTB note 尺寸列表（OLD IDC_COMBO_DENOS_SIZE）
  const [sizeIdx, setSizeIdx] = useState(0);                   // 选中 note 尺寸

  // Graph 操作区 state（复刻 OLD 991-1279, y265-341）
  const [gphName, setGphName] = useState('');                  // 图形文件名（IDC_EDIT_GRAPH_FILE_NAME，原版无 handler）
  const [gphResultMethod, setGphResultMethod] = useState(0);   // 测量方法（IDC_LIST_GRAPH_FUNS：0=Sum pixels 1=width 3=diff neighbour）
  const [gphList, setGphList] = useState([]);                  // 已载 .GPH 名单（IDC_EDIT_AREA_LIST，原版为隐藏多行框）

  // ---- 全局缩放（拖右下角手柄缩放，内容等比放大/缩小）----
  const BASE_W = 2400; // .main-window 基准宽度（styles.css 一致，2026-09-03 左侧扩宽 200 → 2200→2400）
  const BASE_H = 1450; // .main-window 基准高度
  const [zoom, setZoom] = useState(() =>
    typeof window !== 'undefined'
      ? Math.min(window.innerWidth / BASE_W, window.innerHeight / BASE_H)
      : 1);
  const viewportRef = useRef(null);
  const zoomRef = useRef(zoom);
  zoomRef.current = zoom;
  const onResizeHandleDown = useCallback((e) => {
    e.preventDefault();
    e.stopPropagation();
    const vp = viewportRef.current;
    const move = (ev) => {
      const rect = vp.getBoundingClientRect();
      const x = ev.clientX - rect.left + vp.scrollLeft;
      const y = ev.clientY - rect.top + vp.scrollTop;
      const z = Math.min(x / BASE_W, y / BASE_H);
      setZoom(Math.max(0.3, Math.min(3, z)));
    };
    const up = () => {
      window.removeEventListener('mousemove', move);
      window.removeEventListener('mouseup', up);
    };
    window.addEventListener('mousemove', move);
    window.addEventListener('mouseup', up);
  }, []);

  // ---- 左侧区整体缩放（拖右下角手柄缩放，作用于 .left-area：顶部按钮 + 图像 + databar，不影响右侧）----
  const BASE_LW = 1100; // .left-area 基准宽（styles.css .left-area 一致）
  const BASE_LH = 966; // .left-area 基准高（top34 + main-canvas 912 = 1000；1000-34=966）
  const [leftZoom, setLeftZoom] = useState(1);
  const leftZoomRef = useRef(leftZoom);
  leftZoomRef.current = leftZoom;
  const onLeftResizeHandleDown = useCallback((e) => {
    e.preventDefault();
    e.stopPropagation();
    const wrap = e.currentTarget.parentElement; // .left-area（未缩放，作为定位基准）
    if (!wrap) return;
    const rect = wrap.getBoundingClientRect();
    const ox = rect.left, oy = rect.top;
    const sx = e.clientX, sy = e.clientY;
    const sdx = sx - ox, sdy = sy - oy; // 初始指针相对 wrap 左上角的屏幕偏移
    const startZ = leftZoomRef.current;
    const move = (ev) => {
      const dx = ev.clientX - ox, dy = ev.clientY - oy;
      const f = Math.min(dx / sdx, dy / sdy); // 等比缩放（取较小轴，贴合手柄拖拽）
      setLeftZoom(Math.max(0.3, Math.min(4, startZ * f)));
    };
    const up = () => {
      window.removeEventListener('mousemove', move);
      window.removeEventListener('mouseup', up);
    };
    window.addEventListener('mousemove', move);
    window.addEventListener('mouseup', up);
  }, []);

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
  // 打开即并行预载全部 13 个原始波段（Img1..Img6 + Img16..Img22），复刻 OLD「整个文件常驻内存」：
  // 之后任意波段 / 任意帧翻动都只做内存切片（零网络、瞬时）。默认开；关闭则首次切波段仍需下载一次。
  const [preloadAllWaves, setPreloadAllWaves] = useState(true);
  const [ir1Img, setIr1Img] = useState(null);         // IR1 画布图像（来自 Data1）
  const [ir2Img, setIr2Img] = useState(null);         // IR2 画布图像（来自 Data2）
  const [busy, setBusy] = useState(false);
  const [busyText, setBusyText] = useState('');
  const [busyStart, setBusyStart] = useState(null);

  const startBusy = useCallback((text) => {
    setBusyText(text);
    setBusyStart(Date.now());
    setBusy(true);
  }, []);
  const stopBusy = useCallback(() => {
    setBusy(false);
  }, []);
  useEffect(() => {
    if (!busy) {
      setBusyText('');
      setBusyStart(null);
    }
  }, [busy]);

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
  const [statDiag, setStatDiag] = useState(null); // Statistics 批量分析诊断（请求/返回/有效/跳过），屏上直接可见

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

  // operation history 同时写入调试日志（分模块/级别），便于复现 Statistics/Make Graph 等问题
  const pushHistory = useCallback((msg, opts = {}) => {
    const level = opts.level || 'INFO';
    const module = opts.module || 'UI';
    setHistory((h) => [`${msg} @ ${new Date().toLocaleTimeString()}`, ...h].slice(0, 50));
    logModule(level, module, msg, opts.data);
  }, []);

  // ===== P0：打开数据 + 加载波段图像 =====
  // Data1 / Data2 各自独立：IR1 来自 datPath1+record1，IR2 来自 datPath2+record2；
  // 当前波段 viewWave 全局一致（复刻 MFC 同一通道同时看两文件）。
  // counts 用于在 handleOpen 里绕过 React 状态批处理导致的旧 closure（打开 Data2 时 recordCount2 尚未刷新）
  // paths 用于在 handleOpen 里传入刚打开的真实路径，避免 loadImages 闭包里的 datPath1/datPath2 仍是旧值
  // （否则会出现「IR1 显示成 IR2 内容」：setDatPath1 已更新但 loadImages 仍用旧路径加载图像）。

  // ---- 整通道预载缓存（网页「秒载 1000 张」核心）----
  // 复刻 OLD 文件常驻内存 + 指针直取：把一个波段的全部 record 像素一次性取回浏览器常驻为
  // Uint8Array，翻帧只做内存切片（零网络、瞬时）。对应主流图像序列方案（OHIF/Napari/视频帧播放器）。
  // channelCache: key(datPath::waveName) -> { buf, width, height, count }
  // channelInFlight: key -> Promise（去重，避免同一通道并发重复下载）
  const channelCacheRef = useRef(new Map());
  const channelInFlightRef = useRef(new Map());
  const CHANNEL_CACHE_LIMIT = 32; // 超出后按插入顺序淘汰最旧，防止多文件/多波段无限占用内存

  const ensureChannel = useCallback(async (datPath, waveName) => {
    const key = datPath + '::' + waveName;
    const cache = channelCacheRef.current;
    if (cache.has(key)) return cache.get(key);
    if (channelInFlightRef.current.has(key)) return channelInFlightRef.current.get(key);
    const p = getChannelFrames({ datPath, wave: waveName })
      .then((r) => {
        const entry = { buf: r.data, width: r.width, height: r.height, count: r.recordCount };
        cache.set(key, entry);
        if (cache.size > CHANNEL_CACHE_LIMIT) {
          const oldest = cache.keys().next().value; // Map 保留插入顺序
          cache.delete(oldest);
        }
        channelInFlightRef.current.delete(key);
        return entry;
      })
      .catch((e) => {
        channelInFlightRef.current.delete(key);
        throw e;
      });
    channelInFlightRef.current.set(key, p);
    return p;
  }, []);

  // 打开文件后并行预载全部 13 个原始波段（Img1..Img6 + Img16..Img22），复刻 OLD「整个文件常驻内存」：
  // 之后任意波段 / 任意帧翻动都只做内存切片（零网络、瞬时）。中间计算波段(Img7..Img15)服务端无整通道存储，跳过。
  // 去重由 ensureChannel 的 channelInFlightRef 保证；fire-and-forget，不阻塞打开流程。
  const preloadAllWavesFor = useCallback((datPath) => {
    if (!datPath) return;
    const names = Object.values(VIEW_WAVES).filter((w) => w.mode === 'raw').map((w) => w.name);
    logInfo('预载全部原始波段', { datPath, count: names.length });
    const tasks = names.map((n) => ensureChannel(datPath, n));
    Promise.allSettled(tasks).then((res) => {
      const ok = res.filter((r) => r.status === 'fulfilled' && r.value).length;
      logInfo('预载全部原始波段完成', { datPath, ok, total: names.length });
      pushHistory(`预载 ${ok}/${names.length} 波段完成`, { module: 'Prewarm' });
    });
  }, [ensureChannel, logInfo, pushHistory]);

  // 打开文件 / 设坐标后，后台预热全部 record 的 S2/ETC（warm 仅填充服务端缓存、不回传 results）。
  // 使随后的 Statistics 命中预计算缓存、秒级返回；复刻 OLD「整文件常驻内存」体验（Statistics 慢的根因之二）。
  const warmedRef = useRef(new Set());
  const prewarmAnalysis = useCallback(async (datPath, zfile, kin, country, recordCount) => {
    if (!datPath || !zfile || !recordCount) return;
    const key = `${datPath}|${zfile}|${kin}|${country}`;
    if (warmedRef.current.has(key)) return;  // 已预热过则跳过（去重）
    warmedRef.current.add(key);
    logInfo('后台预热分析缓存', { datPath, recordCount });
    try {
      // count=全部 record；warm 模式服务端只填充缓存、响应不含 results（省带宽）
      await analyzeBatchByPath({ datPath, zfilePath: zfile, start: 0, step: 1, count: recordCount, kin, country, warm: true });
      logInfo('分析缓存预热完成', { datPath, recordCount });
    } catch (e) {
      warmedRef.current.delete(key);  // 预热失败（如坐标尚未就绪）→ 允许后续重试
      logWarning('分析缓存预热失败（下次重试）', { message: e.message });
    }
  }, [analyzeBatchByPath, logInfo, logWarning]);

  // 打开文件或切换坐标/通道参数后，对 Data1/Data2 各触发一次后台预热（fire-and-forget，不阻塞 UI）
  useEffect(() => {
    if (!zfilePath) return;
    if (datPath1) prewarmAnalysis(datPath1, zfilePath, kin, country, recordCount1);
    if (datPath2 && recordCount2 > 0 && datPath1 !== datPath2) {
      prewarmAnalysis(datPath2, zfilePath, kin, country, recordCount2);
    }
  }, [zfilePath, datPath1, datPath2, recordCount1, recordCount2, kin, country, prewarmAnalysis]);

  // 取一侧（Data1/Data2）当前 record 的显示像素：优先整通道切片；失败回退逐张 getImage
  const loadSideChannel = useCallback(async (datPath, record, waveName) => {
    try {
      const ch = await ensureChannel(datPath, waveName);
      if (ch && record >= 0 && record < ch.count) {
        const n = ch.width * ch.height;
        const gray = ch.buf.slice(record * n, record * n + n); // 复制该帧，避免渲染引用整缓冲
        return { width: ch.width, height: ch.height, gray, record, wave: waveName };
      }
    } catch (e) {
      logWarning?.('整通道预载失败，回退逐张取图', { datPath, waveName, message: e.message });
    }
    // 回退：兼容中间波段 / 不支持整通道预载的波段
    try {
      return await getImage({
        datPath, record, wave: waveName, mode: 'raw', wtablePath, redOffset, grnOffset,
      });
    } catch (e2) {
      return null;
    }
  }, [ensureChannel, wtablePath, redOffset, grnOffset, logWarning]);

  const loadImages = useCallback(async (rec1, rec2, wave, counts = {}, paths = {}) => {
    const d1 = paths.datPath1 ?? datPath1;
    const d2 = paths.datPath2 ?? datPath2;
    const c1 = counts.count1 ?? recordCount1;
    const c2 = counts.count2 ?? recordCount2;
    startBusy('加载图像...');
    try {
      const [a, b] = await Promise.all([
        c1 > 0 ? loadSideChannel(d1, rec1, wave.name) : Promise.resolve(null),
        c2 > 0 ? loadSideChannel(d2, rec2, wave.name) : Promise.resolve(null),
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
          const sm = await getSmallImage({ datPath: d1, record: rec1 });
          setValidation(sm.validation || null);
        } catch (e) {
          setValidation(null);
        }
      }
    } catch (e) {
      pushHistory(`图像加载失败: ${e.message}`, { level: 'ERROR', module: 'Image' });
    } finally {
      stopBusy();
    }
  }, [datPath1, datPath2, recordCount1, recordCount2, wtablePath, redOffset, grnOffset, loadSideChannel, pushHistory]);

  const handleOpen = useCallback(async (path, panelIndex, jumpTo) => {
    const p = path || (panelIndex === 2 ? datPath2 : datPath1);
    startBusy(`打开 Data${panelIndex}...`);
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
      pushHistory(`打开 Data${panelIndex} ${s.record_count} 枚（13 波段/枚）`, { module: 'File' });
      stopBusy();
      const r1 = panelIndex === 1 ? target : record1;
      const r2 = panelIndex === 2
        ? target
        : (syncMove && recordCount2 > 0 ? Math.min(target, recordCount2 - 1) : record2);
      // 用本次打开后的最新总张数调用 loadImages，避免 closure 中的 recordCount2 还是旧值
      const nextCount1 = panelIndex === 1 ? s.record_count : recordCount1;
      const nextCount2 = panelIndex === 2
        ? s.record_count
        : (datPath2 === p ? s.record_count : recordCount2);
      await loadImages(r1, r2, viewWave, { count1: nextCount1, count2: nextCount2 },
        { datPath1: panelIndex === 1 ? p : datPath1, datPath2: panelIndex === 2 ? p : datPath2 });
      if (preloadAllWaves) preloadAllWavesFor(p); // 打开即并行预载全部原始波段（不阻塞 UI）
    } catch (e) {
      logError(`openSession Data${panelIndex} failed`, { path: p, message: e.message });
      pushHistory(`打开失败: ${e.message}`, { level: 'ERROR', module: 'File' });
      stopBusy();
    }
  }, [datPath1, datPath2, record1, record2, syncMove, recordCount2, viewWave, loadImages, pushHistory, prependRecent, preloadAllWaves, preloadAllWavesFor]);

  // 上传并打开本地 .dat（拖拽到 IR1→Data1 / IR2→Data2，或点 Open 选文件）：复刻 OLD DropDlg 拖入即加载
  const handleOpenFile = useCallback(async (file, panelIndex = 1) => {
    startBusy('上传/打开文件...');
    try {
      const up = await uploadDat(file);
      pushHistory(`上传 ${up.name} → Data${panelIndex}`);
      await handleOpen(up.path, panelIndex, null);
    } catch (e) {
      pushHistory(`打开失败: ${e.message}`, { level: 'ERROR', module: 'Upload' });
      stopBusy();
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
    const need2 = datPath2 && recordCount2 > 0 && !(datPath1 === datPath2 && record1 === record2);
    startBusy(`分析 Data1${need2 ? ' + Data2' : ''}...`);
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
      stopBusy();
    }
  }, [datPath1, datPath2, zfilePath, record1, record2, recordCount2, kin, country, pushHistory]);

  // ===== P1：批量统计（Statistics）=====
  // Data1/Data2 分别批量分析；不同文件时各自生成跨 record 趋势，同文件时只保留一份。
  const runStatistics = useCallback(async (start, step, times) => {
    if (!recordCount1) {
      pushHistory('Statistics：请先打开数据');
      return;
    }
    startBusy(`Statistics ${start}/${step}/${times} ...`);
    setStatDiag(null);
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
        const backendMs = resp.elapsed_ms ?? 0;
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
          const diag = { label, requested: n, returned: rawResults.length, valid: 0, skipped, errors: errors.slice(0, 3), backendMs };
          return { avg: [], std: [], count: 0, all: [], firstS2: [], diag };
        }
        pushHistory(`Statistics ${label} 批量分析 请求 ${n} 枚 / 返回 ${rawResults.length} 条 / 有效 ${list.length} 条 / 跳过 ${skipped} 条 完成`, { module: 'Statistics' });
        const diag = { label, requested: n, returned: rawResults.length, valid: list.length, skipped, errors: errors.slice(0, 3), backendMs };
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
        return { avg, std, count: list.length, all, firstS2: list[0], diag };
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
      // 屏上诊断：把请求/返回/有效/跳过直接显示在 Statistics 按钮下方，方便定位 1044 不返回等问题
      const diags = [b1?.diag, b2?.diag].filter(Boolean);
      setStatDiag(diags.length ? diags : null);
    } catch (e) {
      pushHistory(`Statistics 失败: ${e.message}`, { level: 'ERROR', module: 'Statistics', data: { message: e.message } });
    } finally {
      stopBusy();
    }
  }, [datPath1, datPath2, zfilePath, kin, country, recordCount1, recordCount2, mgInclude1, mgInclude2, pushHistory]);

  // ===== P2：图像处理（ImageEngine 算子）=====
  // 复刻 OLD NitiMain + NitiMain2：同一份阈值/算子分别施加到 Data1 / Data2，IR1 / IR2 同步更新
  const processImage = useCallback(async (ops) => {
    startBusy(`图像处理 ${ops.map((o) => o.op).join('+')}...`);
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
      stopBusy();
    }
  }, [datPath1, datPath2, record1, record2, viewWave, wtablePath, pushHistory]);

  const restoreImage = useCallback(async () => {
    await loadImages(record1, record2, viewWave);
    pushHistory('Restore Image');
  }, [loadImages, record1, record2, viewWave, pushHistory]);

  // ===== P3：Make Graph（复刻 OLD CreateGraph1 + ComputeSuppleResult：跨 record 像素统计）=====
  // IR1（file1，绿色）/ IR2（file2，蓝色）分别按 datPath1 / datPath2 计算，结果合并到 graphData.rows / rows2
  const handleMakeGraph = useCallback(async () => {
    startBusy(`Make Graph ${mgStart}/${mgStep}/${mgTimes} ...`);
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
        resultMethod: gphResultMethod, // OLD IDC_LIST_GRAPH_FUNS 测量方法（0=Sum pixels / 1=width / 3=diff neighbour）
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
      pushHistory(`Make Graph: IR1=${merged.rows.length} IR2=${merged.rows2 ? merged.rows2.length : 0} record 像素统计（Start=${mgStart} Step=${mgStep} Times=${mgTimes} TH=${ipParams.threshold}）`, { module: 'MakeGraph' });
    } catch (e) {
      logError('Make Graph error', { message: e.message, stack: e.stack });
      pushHistory(`Make Graph 失败: ${e.message}`, { level: 'ERROR', module: 'MakeGraph', data: { message: e.message } });
    } finally {
      stopBusy();
    }
  }, [datPath1, datPath2, recordCount2, mgInclude1, mgInclude2, viewWave, mousePos, mouseSize, ipParams, mgBw, mgStart, mgStep, mgTimes, wtablePath, gphResultMethod, pushHistory]);

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
   * 打开日志查看器：kind='ui' 直接读取前端内存日志；kind='backend' 调后端接口读取 singan2_debug.log。
   * @param {'ui'|'backend'} kind
   */
  const openLogViewer = useCallback(async (kind) => {
    pushHistory(kind === 'ui' ? 'Review UI Log' : 'Review Backend Log');
    if (kind === 'ui') {
      try {
        const entries = getLog();        setLogLines(entries.map((e) => ({
          time: e.time,
          level: e.level || 'LOG',
          module: e.module || 'MISC',
          msg: e.data ? `${e.msg} ${e.data}` : e.msg,
        })));
        setLogViewError('');
      } catch (ex) {
        setLogLines([]);
        setLogViewError('读取 UI 日志失败: ' + (ex && ex.message ? ex.message : String(ex)));
      }
      setLogLoading(false);
      setLogViewer(kind);
      return;
    }
    // 后端日志：异步拉取
    setLogViewer(kind);
    setLogLoading(true);
    setLogViewError('');
    try {
      const data = await getBackendLog();
      if (!data || !data.exists) {
        setLogLines([]);
        setLogViewError('后端日志文件不存在（singan2_debug.log）');
      } else {
        setLogLines(parseBackendLog(data.content));
      }
    } catch (ex) {
      setLogLines([]);
      setLogViewError('读取后端日志失败: ' + (ex && ex.message ? ex.message : String(ex)));
    } finally {
      setLogLoading(false);
    }
  }, [pushHistory]);

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
        // OLD popup 顶层 "Restore" = IDC_RUN → MainRun：重读当前 record 数据并重跑完整算法管线
        await restoreImage();
        await runAnalysis();
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
        // OLD IDM_GRADI：读取梯度滑条当前增益后 MainGradient（此前误用固定 amp=1）
        await processImage([{ op: 'gradient', gtype: ipParams.gradType, amp: ipParams.gain }]);
        break;
      case 'binary':
        // OLD IDM_NITI_：读取二值化滑条当前阈值后 NitiMain/NitiMain2（此前误用固定 s=128）
        await processImage([{ op: 'niti', s: threshold }]);
        break;
      case 'noise':
        // OLD IDC_ON_JYOKYO：smooth_median
        await processImage([{ op: 'smooth' }]);
        break;
      case 'restoreImg':
        // OLD Image Prosess→Restore = IDC_RUN → MainRun（同顶层 Restore）
        await restoreImage();
        await runAnalysis();
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
  }, [pushHistory, restoreImage, processImage, zfilePath, runAnalysis, ipParams, threshold]);

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

  // ==================== ATB（1:1 复刻 OLD WinMain.cpp ATB 区）====================
  // 取当前 area 第 entry 条目的 8 字节 [x,y,w,h,th1..th4]
  const atbEntryBytes = useCallback((entry) => {
    if (!atbBytes || entry < 0 || (entry + 1) * 8 > atbBytes.length) return null;
    return Array.from(atbBytes.slice(entry * 8, entry * 8 + 8));
  }, [atbBytes]);

  // 文件选择对话框当前打开的目标：null | 'atb'（Load...）| 'ctb'（Load Size...）
  const [atbBrowser, setAtbBrowser] = useState(null);

  // Load...（复刻 OLD IDC_BUTTON_LOAD_ATB -> LoadATB：读文件、填 area 名单与 area#0 列表）
  const doAtbLoad = useCallback(async (p) => {
    if (!p) return;
    try {
      const res = await loadAtb({ path: p });
      setAtbPath(p);
      setAtbInfo({ isSru: res.isSru, areaNames: res.areaNames, areaCount: res.areaCount });
      setAtbAreaIdx(0);
      setAtbLines(res.lines);
      setAtbBytes(Uint8Array.from(res.bytes));
      setAtbSel(-1);
      setAtbOverlay(null);
      pushHistory(`ATB Load: ${p.split(/[\\/]/).pop()}${res.isSru ? ' (SRU)' : ''}`);
    } catch (e) {
      pushHistory(`ATB Load 失败: ${e.message}`);
    }
  }, [pushHistory]);

  // Load... 按钮：打开文件浏览对话框（等价 OLD GetOpenFileName，*.bin）
  const handleAtbLoad = useCallback(() => setAtbBrowser('atb'), []);

  // area 切换（复刻 OLD IDC_COMBO_ATB_TYPE CBN_SELCHANGE -> SetDefaultATBList）
  const handleAtbArea = useCallback(async (idx) => {
    try {
      const res = await atbArea({ index: idx });
      setAtbAreaIdx(idx);
      setAtbLines(res.lines);
      setAtbBytes(Uint8Array.from(res.bytes));
      setAtbSel(-1);
    } catch (e) {
      pushHistory(`ATB 切换 area 失败: ${e.message}`);
    }
  }, [pushHistory]);

  // 更新条目公共路径（服务端更新缓存 + 整表写回文件，复刻 OLD fwrite 回写）
  const atbWriteEntry = useCallback(async (entry, bytes8, label) => {
    try {
      const res = await atbUpdate({ area: atbAreaIdx, entry, bytes: bytes8 });
      setAtbLines(res.lines);
      setAtbBytes(Uint8Array.from(res.bytes));
      pushHistory(`ATB ${label}: area ${atbAreaIdx + 1} entry ${entry + 1} -> [${bytes8.join(',')}]`);
    } catch (e) {
      pushHistory(`ATB ${label} 失败: ${e.message}`);
    }
  }, [atbAreaIdx, pushHistory]);

  // Show（复刻 OLD IDC_BUTTON_DISPLAY_ATB_SELECT：选区移到条目矩形，阈值框取该 TH 字节）
  const handleAtbShow = useCallback(() => {
    const b = atbEntryBytes(atbSel);
    if (!b) return;
    setMousePos({ x: b[0], y: b[1] });
    setMouseSize({ w: b[2], h: b[3] });
    setThreshold(b[4 + atbTh]); // OLD: IDC_NITI_SIKI_BOX = 选中 TH 的阈值字节
    pushHistory(`ATB Show: entry ${atbSel + 1} -> (${b[0]},${b[1]}) ${b[2]}×${b[3]} TH${atbTh + 1}=${b[4 + atbTh]}`);
  }, [atbEntryBytes, atbSel, atbTh, pushHistory]);

  // Show All（复刻 OLD IDC_BUTTON_ATB_SHOW_ALL + OnDrawPaint：按 TH 面画全部 note 矩形，4 色轮换）
  const handleAtbShowAll = useCallback(() => {
    if (atbOverlay) {
      setAtbOverlay(null);
      pushHistory('ATB Show All: OFF');
      return;
    }
    const entries = atbBytes ? atbBytes.length / 8 : 0;
    const notes = Math.floor(entries / 4); // 128（普通）/ 256（SRU）
    const rects = [];
    for (let ii = 0; ii < notes; ii++) {
      const b = atbEntryBytes(ii * 4 + atbTh); // OLD: entry = ii*4 + faceToShow
      if (!b || (b[2] === 0 && b[3] === 0)) continue; // OLD: w==0 且 h==0 跳过
      rects.push({
        x: b[0], y: b[1], w: b[2], h: b[3],
        color: ATB_COLORS[ii % 4],
        label: `${ii + 1}${'ABCD'[atbTh]}`,
      });
    }
    setAtbOverlay(rects);
    pushHistory(`ATB Show All: ${rects.length} 矩形 (TH${atbTh + 1})`);
  }, [atbOverlay, atbBytes, atbTh, atbEntryBytes, pushHistory]);

  // Clear（复刻 OLD IDC_BUTTON_ATB_CLEAR：所选条目 8 字节清零 + 确认 + 写回文件）
  const handleAtbClear = useCallback(() => {
    if (atbSel < 0 || !atbEntryBytes(atbSel)) return;
    if (!window.confirm(`Sure?\nArea no ${atbAreaIdx + 1}\nClear entry ${atbSel + 1}?`)) return;
    atbWriteEntry(atbSel, [0, 0, 0, 0, 0, 0, 0, 0], 'Clear');
  }, [atbSel, atbAreaIdx, atbEntryBytes, atbWriteEntry]);

  // Clear 4D（复刻 OLD IDC_BUTTON_ATB_CLEAR_4_DIR：仅允许 A 面（%4==0），清 A/B/C/D 四方向）
  const handleAtbClear4D = useCallback(() => {
    if (atbSel < 0) return;
    if (atbSel % 4 !== 0) {
      window.alert('Please select A dirction for set 4 dirs!');
      return;
    }
    if (!window.confirm(`Sure?\nArea no ${atbAreaIdx + 1}\nClear 4 dirs from entry ${atbSel + 1}?`)) return;
    (async () => {
      for (let k = 0; k < 4; k++) {
        await atbWriteEntry(atbSel + k, [0, 0, 0, 0, 0, 0, 0, 0], `Clear4D-${'ABCD'[k]}`);
      }
    })();
  }, [atbSel, atbAreaIdx, atbWriteEntry]);

  // Save...（复刻 OLD IDC_BUTTON_ATB_UPDATE：用当前鼠标选区 + 阈值框写所选条目）
  const handleAtbSave = useCallback(() => {
    const b = atbEntryBytes(atbSel);
    if (!b || !mousePos) return;
    const nb = [...b];
    nb[0] = mousePos.x; nb[1] = mousePos.y;
    nb[2] = mouseSize.w; nb[3] = mouseSize.h;
    nb[4 + atbTh] = threshold; // OLD: updateBytes[4+selectIndex] = s（仅写当前 TH 位）
    if (!window.confirm(`Sure?\nArea no ${atbAreaIdx + 1}\nupdate with [${nb.join(',')}]?`)) return;
    atbWriteEntry(atbSel, nb, 'Save');
  }, [atbEntryBytes, atbSel, mousePos, mouseSize, atbTh, threshold, atbAreaIdx, atbWriteEntry]);

  // Set 4D...（复刻 OLD IDC_BUTTON_ATB_SET_4_DIR：A 面选区按 note 尺寸推导 B/C/D 三方向）
  const handleAtbSet4D = useCallback(() => {
    if (atbSel < 0) return;
    if (atbSel % 4 !== 0) {
      window.alert('Please select A dirction for set 4 dirs!');
      return;
    }
    if (sizeNotes.length === 0) {
      window.alert('Please run Load Size to select denos size firstly!');
      return;
    }
    // 尺寸下拉文本 "Note:001 = 152 x 070" -> (length, height)
    const m = /Note:\s*\d+\s*=\s*(\d+)\s*x\s*(\d+)/.exec(sizeNotes[sizeIdx] || '');
    if (!m) return;
    const denoLength = Number(m[1]);
    const denoHeight = Number(m[2]);
    const b = atbEntryBytes(atbSel);
    if (!b || !mousePos) return;
    const a = [...b];
    a[0] = mousePos.x; a[1] = mousePos.y; a[2] = mouseSize.w; a[3] = mouseSize.h;
    a[4 + atbTh] = threshold;
    // OLD 公式：B=右上镜像 / C=左下 / D=右下；坐标为奇数时取偶（valueAbnormal 时中止）
    const mk = (x, y) => {
      let ex = x, ey = y;
      if (ex <= 0 || ey <= 0) return null;
      if (ex % 2 !== 0) ex -= 1;
      if (ey % 2 !== 0) ey -= 1;
      return [ex, ey, a[2], a[3], a[4], a[5], a[6], a[7]];
    };
    const bb = mk(denoLength - a[0] - a[2], denoHeight - a[1] - a[3]);
    const cc = mk(a[0], denoHeight - a[1] - a[3]);
    const dd = mk(denoLength - a[0] - a[2], a[1]);
    if (!bb || !cc || !dd) {
      window.alert('Computed area invalid (check note size vs selection)!');
      return;
    }
    if (!window.confirm(`Note length=${denoLength} height=${denoHeight}\nSure?\nArea no ${atbAreaIdx + 1}\nA=[${a.join(',')}]`)) return;
    (async () => {
      await atbWriteEntry(atbSel, a, 'Set4D-A');
      await atbWriteEntry(atbSel + 1, bb, 'Set4D-B');
      await atbWriteEntry(atbSel + 2, cc, 'Set4D-C');
      await atbWriteEntry(atbSel + 3, dd, 'Set4D-D');
    })();
  }, [atbSel, sizeNotes, sizeIdx, atbEntryBytes, mousePos, mouseSize, atbTh, threshold, atbAreaIdx, atbWriteEntry]);

  // Load Size...（复刻 OLD IDC_BUTTON_LOAD_DENOS_SIZE -> LoadCTB：解析 note 尺寸列表）
  const doLoadCtb = useCallback(async (p) => {
    if (!p) return;
    try {
      const res = await loadCtb({ path: p });
      setSizeNotes(res.notes);
      setSizeIdx(0);
      pushHistory(`Load Size: ${p.split(/[\\/]/).pop()} (${res.notes.length} notes)`);
    } catch (e) {
      pushHistory(`Load Size 失败: ${e.message}`);
    }
  }, [pushHistory]);

  // Load Size... 按钮：打开文件浏览对话框（等价 OLD GetOpenFileName，*.bin）
  const handleAtbLoadSize = useCallback(() => setAtbBrowser('ctb'), []);

  // ==================== 顶部菜单命令分发（对照 OLD resource.rc IDR_MENU + WinMain.cpp WM_COMMAND）====================
  // tool→History=IDC_VER(履历对话框) Finish=IDM_EXIT；View→Grid=IDM_GRID Information=IDM_JOHO
  // Image→7 Reductions=IDM_IMG_DRAW；Setting→Setting Dialogue=IDM_S_DLG Load→Coordinate=IDM_Z；
  // Short→Calculate all=IDM_ALL_REN(ComboRen)。ATB/Data/Create1/2/3/Country 为新版菜单，接 Web 等价能力。
  const handleMenuCommand = useCallback((k) => {
    switch (k) {
      case 'history': // OLD IDC_VER：履历（History）查看器 → Web 用历史记录列表对话框
        setActiveDialog('history');
        break;
      case 'finish': // OLD IDM_EXIT：SendMessage(WM_CLOSE)
      case 'fin': // Short→Finish (Alt+F)（新版菜单）
        setActiveDialog('finish');
        break;
      case 'grid': // OLD IDM_GRID：global_grid 切换
        setShowGrid((v) => { pushHistory(`Grid ${!v ? 'ON' : 'OFF'}`); return !v; });
        break;
      case 'info': // OLD IDM_JOHO：IDD_J_DLG Information Display
        setActiveDialog('info');
        break;
      case 'img-th': // OLD IDM_IMG_DRAW：IDD_IMG "7 Reduction Images"
        // Web 的 Reduction Image 面板常驻右上（rc 1101,2），无需独立窗口
        pushHistory('7 Reductions：Reduction Image 面板常驻右上侧（rc 1101,2）');
        break;
      case 'img-bright': // 新版菜单 Brightness Adjust → Detail Setting（R/G 增益重载当前波段）
        setActiveDialog('setting');
        break;
      case 'sdialog': // OLD IDM_S_DLG：IDD_S_SET_DLG Setting Dialogue
        setActiveDialog('setting');
        break;
      case 'l-coord': // OLD IDM_Z：IDD_Z_DLG Load Coordinate Dialogue
        setActiveDialog('coordinate');
        break;
      case 'l-atb': // 新版菜单 Load→ATB：等价 ATB 面板 Load...
        setAtbBrowser('atb');
        break;
      case 'l-data': // 新版菜单 Load→Data：选择并打开 .dat（Data1）
        setAtbBrowser('dat');
        break;
      case 'c1': // OLD Create1 → global_GR[0] 落盘开关；Web 等价 Graph1 结果包含开关
        setMgInclude1((v) => { pushHistory(`Create1 (Graph1) ${!v ? 'ON' : 'OFF'}`); return !v; });
        break;
      case 'c2': // OLD Create2 → global_GR[1]；Web 等价 Graph2 结果包含开关
        setMgInclude2((v) => { pushHistory(`Create2 (Graph2) ${!v ? 'ON' : 'OFF'}`); return !v; });
        break;
      case 'c3': // OLD Create3 → global_GR[2]；Web 暂无对应落盘目标
        pushHistory('Create3：Web 暂无对应功能（OLD global_GR[2] 结果落盘开关）');
        break;
      case 'country': // OLD Country 选择（global_SelectCountry）
        setActiveDialog('setting');
        break;
      case 'calcall': // OLD IDM_ALL_REN → ComboRen：全部组合跑批 → Web 批量 Statistics
        runStatistics(mgStart, mgStep, mgTimes);
        break;
      default:
        break;
    }
  }, [pushHistory, setShowGrid, setAtbBrowser, setMgInclude1, setMgInclude2, runStatistics, mgStart, mgStep, mgTimes]);

  // ==================== Graph 操作区（复刻 OLD WinMain 1980-2065 + DisplayGraphs）====================
  // Load Graph...（IDC_BUTTON_LOAD_GRAPH）：读 .GPH（head[100]+series1/2）→ 立即显示 + 加入名单
  const doLoadGph = useCallback(async (p) => {
    try {
      const r = await gphLoad({ path: p });
      setGraphData({
        rows: r.series1.map((v, i) => ({ record: i, value: v })),
        rows2: r.series2.map((v, i) => ({ record: i, value: v })),
        file1_path: p,
      });
      setGphList((l) => (l.some((x) => x.path === p) ? l : [...l, { name: p.split(/[\\/]/).pop(), path: p }]));
      pushHistory(`Load Graph: ${p.split(/[\\/]/).pop()} (${r.series1.length} pts)`);
    } catch (e) {
      pushHistory(`Load Graph 失败: ${e.message}`);
    }
  }, [pushHistory]);

  // 文件浏览对话框「打开」：按目标分发到 ATB / CTB / GPH / Data(.dat) 载入
  const handleBrowserOk = useCallback((p) => {
    const kind = atbBrowser;
    setAtbBrowser(null);
    if (kind === 'atb') doAtbLoad(p);
    else if (kind === 'ctb') doLoadCtb(p);
    else if (kind === 'gph') doLoadGph(p);
    else if (kind === 'dat') handleOpen(p, 1);
  }, [atbBrowser, doAtbLoad, doLoadCtb, doLoadGph, handleOpen]);

  // Load Graph... 按钮：打开 .GPH 文件选择
  const handleLoadGraphBtn = useCallback(() => setAtbBrowser('gph'), []);

  // Save Graph（IDC_BUTTON_SAVE_GRAPH）：当前序列存 <GraphFiles>\<名>.GPH（空名用 _tempGraph，同 OLD）
  const handleSaveGraph = useCallback(async () => {
    if (!graphData || !graphData.rows || graphData.rows.length === 0) {
      window.alert('No graph data to save! Run Make Graph / Load Graph first.');
      return;
    }
    const name = (gphName || '_tempGraph').replace(/\.gph$/i, '');
    const p = `${GRAPH_FILES_DIR}\\${name}.GPH`;
    try {
      await gphSave({
        path: p,
        head: {
          startX: mousePos ? mousePos.x : 0, startY: mousePos ? mousePos.y : 0,
          rangeX: mouseSize ? mouseSize.w : 0, rangeY: mouseSize ? mouseSize.h : 0,
          s: ipParams.threshold, black: mgBw === 'black',
        },
        series1: graphData.rows.map((r) => r.value),
        series2: (graphData.rows2 || []).map((r) => r.value),
      });
      pushHistory(`Save Graph: ${p} (${graphData.rows.length} pts)`);
    } catch (e) {
      pushHistory(`Save Graph 失败: ${e.message}`);
    }
  }, [graphData, gphName, mousePos, mouseSize, ipParams.threshold, mgBw, pushHistory]);

  // Clear（IDC_BUTTON_CLEAR_GRAPH_LIST）：清空已载名单（原版为隐藏多行框 IDC_EDIT_AREA_LIST）
  const handleClearGraphList = useCallback(() => {
    setGphList([]);
    pushHistory('Clear Graph List');
  }, [pushHistory]);

  // Graph (Combine)（IDC_BUTTON_MAKE_COMBINE_GRAPH）：名单内全部 .GPH 逐点累加（复刻 DisplayGraphs）
  const handleCombineGraph = useCallback(async () => {
    if (gphList.length === 0) {
      window.alert('No graph files loaded! Use Load Graph... first.');
      return;
    }
    try {
      let s1 = null;
      let s2 = null;
      for (const item of gphList) {
        const r = await gphLoad({ path: item.path });
        if (s1 === null) {
          s1 = [...r.series1];
          s2 = [...r.series2];
        } else {
          // OLD DisplayGraphs：combineDatas[jj] += dataValues[jj]
          for (let i = 0; i < r.series1.length && i < s1.length; i++) s1[i] += r.series1[i];
          for (let i = 0; i < r.series2.length && i < s2.length; i++) s2[i] += r.series2[i];
        }
      }
      setGraphData({
        rows: s1.map((v, i) => ({ record: i, value: v })),
        rows2: s2.map((v, i) => ({ record: i, value: v })),
        file1_path: 'combine',
      });
      pushHistory(`Graph (Combine): ${gphList.length} 文件累加完成`);
    } catch (e) {
      pushHistory(`Graph (Combine) 失败: ${e.message}`);
    }
  }, [gphList, pushHistory]);

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
          areas={atbOverlay}
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
        <div className="app-viewport" ref={viewportRef}>
        <ZoomContext.Provider value={zoom}>
        <div className="main-window" style={{ zoom }}
          onClick={() => { setActiveMenu(null); setCtxMenu(null); }}>
        <TitleBar onResize={() => {}} />
        <TopMenuBar activeMenu={activeMenu} setActiveMenu={setActiveMenu} onCommand={handleMenuCommand} pushHistory={pushHistory} />
        {/* 左侧区整体包裹：统一缩放 顶部按钮 + 图像 + databar（不影响右侧） */}
        <div className="left-area" style={{ zoom: leftZoom }}>
        <ChannelTab channel={channel} setChannel={handleChannel} />
        <SubToolbarRow active={subActive} setActive={setSubActive} pushHistory={pushHistory} onSelect={handleWaveSelect} />
        <label className="preload-all-waves" title="打开文件后并行预载全部 13 个原始波段，复刻 OLD 全文件常驻；关闭则首次切波段仍需下载一次">
          <input type="checkbox" checked={preloadAllWaves} onChange={(e) => {
            const v = e.target.checked;
            setPreloadAllWaves(v);
            // 中途开启时，对当前已打开的两个文件立即补预载
            if (v) { preloadAllWavesFor(datPath1); preloadAllWavesFor(datPath2); }
          }} />
          打开即预载全部波段
        </label>

      {/* 左侧主画布：内层 .main-canvas 填满 .main-canvas-wrap，缩放由外层 .left-area 统一控制 */}
      <div className="main-canvas-wrap">
      <div className="main-canvas">
        {renderMainCanvas()}
      </div>
        {/* 左侧区独立缩放手柄：拖拽整体放大/缩小（不影响右侧区） */}
        <div
          className="left-resize-handle"
          title="拖拽缩放左侧区（拉大 / 缩小）"
          style={{ left: BASE_LW * leftZoom, top: BASE_LH * leftZoom, transform: 'translate(-100%, -100%)' }}
          onMouseDown={onLeftResizeHandleDown}
        />
      </div>
      </div>

      {/* 右侧区：绝对定位 X1100, Y44, 宽1300, 高1356；内部所有面板直接用 .rc 坐标(局部 left=rcX-613, top=rcY*1.337) */}
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
            <button className="btn btn-xs" onClick={() => openLogViewer('ui')}>UI Log</button>
            <button className="btn btn-xs" onClick={() => openLogViewer('backend')}>Backend Log</button>
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
            statDiag={statDiag}
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
        {/* Graph 操作区 (rc 997,265 原址；默认移至 VTB 右侧空位，RC 可拖拽微调) */}
        <RC id="graph-file" className="rc-graph-file" dl={810} dt={300}>
          <GraphFileRow
            gphName={gphName} setGphName={setGphName}
            resultMethod={gphResultMethod} setResultMethod={setGphResultMethod}
            onLoadGraph={handleLoadGraphBtn}
            onSaveGraph={handleSaveGraph}
            onClearList={handleClearGraphList}
            onCombine={handleCombineGraph}
            onContextMenu={onContextMenu}
          />
        </RC>
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
        {/* S2 图表（IR1/IR2 同图叠加）+ 数值列表 — 跨 record 函数值 */}
        <RC id="s2chart" className="rc-s2chart" dl={715} dt={475}>
          <S2Chart
            fileName="graph1.grp"
            s2={chartData}
            fn={graphFn}
            graphData={batchStats?.all ? { record_count: batchStats.all.length, rows: batchStats.all.map((r) => ({ record: r.recordNo - 1, s2: r.s2, etc: r.etc })) } : null}
            graphData2={(filesDiffer && mgInclude2 && batchStats2?.all) ? { record_count: batchStats2.all.length, rows: batchStats2.all.map((r) => ({ record: r.recordNo - 1, s2: r.s2, etc: r.etc })) } : null}
          />
        </RC>
        {/* VTB 区 (rc 915,147；下移 100 给加高后的 ATB 让位) — resource.rc 真实存在，曾被误删 */}
        <RC id="vtb" className="rc-vtb" dl={362} dt={297}><VtbPanel pushHistory={pushHistory} /></RC>
        {/* ATB 区 (rc 917,4) — 1:1 复刻 OLD ATB 控件组 */}
        <RC id="atb" className="rc-atb" dl={364} dt={5}>
          <AtbPanel
            fileName={atbPath.split(/[\\/]/).pop()}
            areaNames={atbInfo ? atbInfo.areaNames : []}
            areaIndex={atbAreaIdx}
            onAreaChange={handleAtbArea}
            lines={atbLines}
            selected={atbSel}
            setSelected={setAtbSel}
            thIndex={atbTh}
            setThIndex={setAtbTh}
            sizeNotes={sizeNotes}
            sizeIndex={sizeIdx}
            setSizeIndex={setSizeIdx}
            loaded={!!atbBytes}
            onLoad={handleAtbLoad}
            onShow={handleAtbShow}
            onShowAll={handleAtbShowAll}
            onSave={handleAtbSave}
            onClear={handleAtbClear}
            onClear4D={handleAtbClear4D}
            onSet4D={handleAtbSet4D}
            onLoadSize={handleAtbLoadSize}
            onContextMenu={onContextMenu}
          />
        </RC>
        {/* Coordinate / Function Name File（rc 629,646）— 从底部状态栏移入右侧区，作为可拖拽 RC */}
        <RC id="file-paths" className="rc-file-paths" dl={19} dt={864}>
          <FilePathPanel
            zfilePath={zfilePath}
            setZfilePath={setZfilePath}
            setActiveDialog={setActiveDialog}
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
      <BottomStatusRow busy={busy} busyText={busyText} busyStart={busyStart} />

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
      {activeDialog === 'history' && (
        // tool→History（OLD IDC_VER → IDD_RIREKI_DLG 履历对话框）：显示本次会话操作履历
        <DialogModal title="History" actions={['Close']}
          onAction={() => setActiveDialog(null)}
          onClose={() => setActiveDialog(null)}>
          <div style={{ maxHeight: 420, overflowY: 'auto', fontSize: 11, fontFamily: 'Consolas, monospace' }}>
            {history.length === 0 && <div>(无记录)</div>}
            {history.map((h, i) => <div key={i}>{h}</div>)}
          </div>
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
        // View→Information（OLD IDM_JOHO → IDD_J_DLG "Infomation Display"，JProc.cpp 4 页）
        <DialogModal title="Infomation Display" actions={['Close']}
          onAction={() => setActiveDialog(null)}
          onClose={() => setActiveDialog(null)}>
          <InfoDisplayDialog
            imageData={ir1Img}
            mousePos={mousePos}
            mouseSize={mouseSize}
            datPath={datPath1}
            record={record1}
          />
        </DialogModal>
      )}
      {activeDialog === 'infoLegacy' && (
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

      {logViewer && (
        <LogViewer
          kind={logViewer}
          title={logViewer === 'ui' ? 'UI 日志（前端）' : '后端日志（C++ singan2_debug.log）'}
          lines={logLines}
          loading={logLoading}
          error={logViewError}
          onClose={() => setLogViewer(null)}
          onRefresh={logViewer === 'backend' ? () => openLogViewer('backend') : null}
        />
      )}

      {/* ATB/CTB/GPH/Data 本地文件选择对话框（等价 OLD GetOpenFileName） */}
      {atbBrowser && (
        <FileBrowser
          title={atbBrowser === 'atb' ? 'ATB File selection (*.bin)'
            : atbBrowser === 'ctb' ? 'CTB File selection (*.bin)'
            : atbBrowser === 'dat' ? 'Data File selection (*.dat)'
            : 'File selection (*.GPH)'}
          initialPath={atbBrowser === 'atb' ? atbPath
            : atbBrowser === 'ctb' ? ATB_DEFAULT_CTB
            : atbBrowser === 'dat' ? DATA_DIR
            : GRAPH_FILES_DIR}
          ext={atbBrowser === 'gph' ? '.gph' : atbBrowser === 'dat' ? '.dat' : '.bin'}
          onOk={handleBrowserOk}
          onClose={() => setAtbBrowser(null)}
        />
      )}

      {ctxMenu && (
        <ContextMenu x={ctxMenu.x} y={ctxMenu.y} onClose={() => setCtxMenu(null)}
          onAction={handleContextAction} />
      )}

      {/* 右下角缩放手柄：拖拽改变全局 zoom，容器内所有控件等比放大/缩小 */}
      <div className="resize-handle" title="拖拽缩放（拉大/缩小）" onMouseDown={onResizeHandleDown} />
        </div>
        </ZoomContext.Provider>
      </div>
  );
}
