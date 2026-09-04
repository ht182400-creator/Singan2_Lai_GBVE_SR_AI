// M3/M4 HTTP API 客户端封装（对应 server/server.cpp，P0–P5 全部端点）。
// 端点总览见 docs/11_模块功能同步方案_P0-P5.md 第 4 节。
// 所有函数返回解析后的 JSON；失败抛 Error(message)。
import { logModule } from './utils/debugLogger.js';

async function postJson(url, body) {
  const r = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  const text = await r.text();
  let data;
  try {
    data = text ? JSON.parse(text) : {};
  } catch (e) {
    // 非 JSON 响应（如服务端崩溃/代理错误页）记录原文到调试日志，便于定位 'Unexpected token' 类问题
    logModule('ERROR', 'API', `响应非 JSON（首 200 字符）: ${text.slice(0, 200)}`, { url, status: r.status });
    throw new Error(`服务器返回非 JSON 响应: ${text.slice(0, 80)}`);
  }
  if (!r.ok) {
    const msg = data && data.error ? data.error : `HTTP ${r.status}`;
    logModule('ERROR', 'API', `HTTP 错误 ${r.status}: ${msg}`, { url });
    throw new Error(msg);
  }
  return data;
}

export async function health() {
  const r = await fetch('/health');
  return r.json();
}

// ============ P0 基础数据链路 ============

// 打开 .dat：{ dat_path } -> { record_count, wave_count, waves:[{index,name}] }
export async function openSession(datPath) {
  return postJson('/api/session/open', { dat_path: datPath });
}

// 上传本地 .dat 文件（拖拽 / 文件选择），落到服务器侧 uploads/，返回 { ok, path, name }
// 供 /api/session/open 后续按 path 打开（复刻 OLD DropDlg 拖入即加载）。
export async function uploadDat(file) {
  // 以二进制 body 直接发送（不再用 multipart），避免把大文件整体缓冲进内存，
  // 文件名通过查询参数 name（URL 编码）传给流式落盘的 /api/upload 端点。
  const r = await fetch(
    `/api/upload?name=${encodeURIComponent(file.name)}`,
    { method: 'POST', headers: { 'Content-Type': 'application/octet-stream' }, body: file }
  );
  const data = await r.json();
  if (!r.ok) throw new Error(data.error || `HTTP ${r.status}`);
  return data;
}

// 取单波段图像：-> { width, height, encoding:'u8'|'u16le', min, max, data(base64) }
// mode: 'raw' | '2byte' | 'intermediate'（intermediate 仅支持 Img7..Img15）
export async function getImage({ datPath, record = 0, wave = 0, mode = 'raw',
  wtablePath = '', redOffset = 128, grnOffset = 128 }) {
  return postJson('/api/image', {
    dat_path: datPath, record, wave, mode,
    wtable_path: wtablePath, red_offset: redOffset, grn_offset: grnOffset,
  });
}

// 小图（SMALL_SIZE）
export async function getSmallImage({ datPath, record = 0 }) {
  return postJson('/api/small-image', { dat_path: datPath, record });
}

// DSP-ARM Function 页（Information Display 第 4 页，复刻 OLD JProc.cpp dsparm_set）：
// 读函数名文件 GBVM_DSP_ARM.txt + 小图像段 u16（OLD global_small_image[1580+j] 大端）。
// 文件缺失时 -> { found:false, message:"Cannot find Function Name File..." }
export async function getDsparm({ datPath, record = 0 }) {
  return postJson('/api/dsparm', { dat_path: datPath, record });
}

// 整通道批量下发（网页「秒载 1000 张」核心）：一次取回某波段全部 record 的像素扁平缓冲，
// 浏览器常驻为 Uint8Array 后翻帧只做内存切片、零网络。
// 返回 { width, height, recordCount, data: Uint8Array }（data 长度 = recordCount*width*height）。
// 失败时（波段不支持 / 越界）服务端返回 4xx，这里抛 Error。
export async function getChannelFrames({ datPath, wave = 'Img1' }) {
  const r = await fetch('/api/images/channel', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ dat_path: datPath, wave }),
  });
  if (!r.ok) {
    let msg = `HTTP ${r.status}`;
    try {
      const j = await r.json();
      if (j && j.error) msg = j.error;
    } catch (e) { /* 忽略解析错误 */ }
    throw new Error(msg);
  }
  const buf = new Uint8Array(await r.arrayBuffer());
  const width = parseInt(r.headers.get('X-Width') || '186', 10);
  const height = parseInt(r.headers.get('X-Height') || '88', 10);
  const recordCount = parseInt(r.headers.get('X-Record-Count') || '0', 10);
  return { width, height, recordCount, data: buf };
}

// ============ P1 分析链路 ============

// 以本地路径方式分析（联调/审阅最常用）
export async function analyzeByPath({ datPath, zfilePath, record = 0, kin = 1, country = 0 }) {
  return postJson('/api/analyze-path', {
    dat_path: datPath, zfile_path: zfilePath, record, kin, country,
  });
}

// 批量分析（Statistics/Make Graph 用）：单文件多 record 一次请求，服务端并行计算
// { datPath, zfilePath, start, step, count, kin, country } -> { count, record_count, results:[{record,s2,etc}] }
// warm=true 时服务端仅填充预计算缓存、响应不含 results（省带宽，用于打开文件后的后台预热）
export async function analyzeBatchByPath({ datPath, zfilePath, start = 0, step = 1,
  count = 1, kin = 1, country = 0, warm = false }) {
  return postJson('/api/analyze-batch', {
    dat_path: datPath, zfile_path: zfilePath, start, step, count, kin, country,
    warm: warm ? 1 : 0,
  });
}

// 多部件上传 .dat 分析
export async function analyzeUpload({ file, zfilePath, record = 0, kin = 1, country = 0 }) {
  const fd = new FormData();
  fd.append('dat', file);
  fd.append('record', String(record));
  fd.append('kin', String(kin));
  fd.append('country', String(country));
  if (zfilePath) fd.append('zfile_path', zfilePath);
  const r = await fetch('/api/analyze', { method: 'POST', body: fd });
  const data = await r.json();
  if (!r.ok) throw new Error(data.error || `HTTP ${r.status}`);
  return data;
}

// ============ P2 图像处理 ============

// 对指定记录/波段依次应用算子：ops = [{op:'gradient',gtype,amp},{op:'niti',s},{op:'smooth'},...]
export async function runImageOps({ datPath, record = 0, wave = 0, ops = [], wtablePath = '' }) {
  return postJson('/api/imageops', {
    dat_path: datPath, record, wave, ops, wtable_path: wtablePath,
  });
}

// ============ P3 Graph ============

// 生成图表序列：复刻 OLD CreateGraph1 + ComputeSuppleResult —— 批量统计每 record
// resultMethod 对应 OLD IDC_LIST_GRAPH_FUNS 测量方法：
//   0=Sum pixels（黑/白像素数） 1=width（黑/白水平跨度） 2=height(TBD) 3=differenct neighbour（相邻差分累加，用阈值） 4=(TBD)
// 返回 { record_count, rows:[{record,value}], wave, threshold, black }
export async function makeGraph({ datPath, zfilePath = '', wave = 0,
  maxRecords = 16, startRecord = 0, step = 1,
  nitiType = 'Gra+Bin', gradType = 0, gain = 1,
  threshold = 90, colorPoint = 150,
  areaX = 0, areaY = 0, areaW = 20, areaH = 20,
  black = true, resultMethod = 0,
  wtablePath = '' }) {
  return postJson('/api/graph/make', {
    dat_path: datPath, zfile_path: zfilePath, wave,
    max_records: maxRecords, start_record: startRecord, step,
    niti_type: nitiType, grad_type: gradType, gain,
    threshold, color_point: colorPoint,
    area_x: areaX, area_y: areaY, area_w: areaW, area_h: areaH,
    black,
    result_method: resultMethod,
    wtable_path: wtablePath,
  });
}

// 序列合成：mode = diff | max | min | avg
export async function combineGraph({ a = [], b = [], mode = 'diff' }) {
  return postJson('/api/graph/combine', { a, b, mode });
}

// .grp 存取（JSON 文本格式）
export async function saveGraph({ path, series = [] }) {
  return postJson('/api/graph/save', { path, series });
}

export async function loadGraph({ path }) {
  return postJson('/api/graph/load', { path });
}

// .GPH 原版二进制保存（复刻 OLD Save Graph：USHORT head[100] + series1[2300] + series2[2300]）
// head: { tabNo, startX, startY, rangeX, rangeY, s, black }
export async function gphSave({ path, head = {}, series1 = [], series2 = [] }) {
  return postJson('/api/graph/gph-save', {
    path,
    tab_no: head.tabNo ?? 0, start_x: head.startX ?? 0, start_y: head.startY ?? 0,
    range_x: head.rangeX ?? 0, range_y: head.rangeY ?? 0,
    s: head.s ?? 0, black: head.black ?? true,
    series1, series2,
  });
}

// .GPH 原版二进制读取（复刻 OLD Load Graph/DisplayGraphs）
// -> { path, head:{tabNo,startX,startY,rangeX,rangeY,s,black}, series1[], series2[] }
export async function gphLoad({ path }) {
  return postJson('/api/graph/gph-load', { path });
}

// ============ P4 ATB / VTB / 坐标 ============

// 解析坐标文件 -> { count, areas:[{x1,y1,x2,y2,a_low,a_high,b_low,b_high,area_min}] }
export async function parseZfile({ path, encoding = 'shift_jis' }) {
  return postJson('/api/zfile/parse', { path, encoding });
}

// 加载 ATB 二进制文件（复刻 OLD LoadATB）：
// -> { path, isSru, areaCount, areaNames[128], area, entries, lines[], bytes[] }
// lines 与 OLD SetDefaultATBList 格式串一致；bytes 为 area#0 的 entries*8 原始条目字节。
export async function loadAtb({ path }) {
  return postJson('/api/atb/load', { path });
}

// 切换 area（复刻 OLD IDC_COMBO_ATB_TYPE CBN_SELCHANGE -> SetDefaultATBList）
// -> { area, entries, lines[], bytes[] }
export async function atbArea({ index }) {
  return postJson('/api/atb/area', { index });
}

// 更新条目并整表写回文件（复刻 OLD Save/Update、Clear、Clear 4D、Set 4D 的公共写回路径）
// bytes 为 8 字节 [x,y,w,h,th1..th4]；-> { area, entries, lines[], bytes[], written }
export async function atbUpdate({ area, entry, bytes }) {
  return postJson('/api/atb/update', { area, entry, bytes });
}

// Load Size...（复刻 OLD LoadCTB）：解析 CTB 文件的 note 尺寸列表
// -> { path, notes[] }，notes 形如 "Note:001 = 152 x 070"
export async function loadCtb({ path }) {
  return postJson('/api/atb/ctb', { path });
}

// 本地文件浏览（等价 OLD GetOpenFileName；浏览器拿不到本地绝对路径，由 server 代列目录）。
// path 可为目录或文件（文件取其所在目录）；ext 如 ".bin" 过滤文件，空则不过滤。
// -> { path, parent, dirs[], files[] }
export async function fsList({ path = '', ext = '' }) {
  const q = `path=${encodeURIComponent(path)}&ext=${encodeURIComponent(ext)}`;
  const r = await fetch(`/api/fs/list?${q}`);
  const data = await r.json();
  if (!r.ok) throw new Error(data.error || `HTTP ${r.status}`);
  return data;
}

export async function loadVtb({ path }) {
  return postJson('/api/vtb/load', { path });
}

// ============ P5 保存与配置 ============

// 导出 CSV：rows 为二维数组
export async function exportCsv({ path, header = '', rows = [] }) {
  return postJson('/api/export/csv', { path, header, rows });
}

export async function saveConfig({ path, config }) {
  return postJson('/api/config/save', { path, config });
}

export async function loadConfig({ path }) {
  return postJson('/api/config/load', { path });
}

// ============ 日志查看器 ============

// 读取后端 C++ 调试日志（singan2_debug.log）文本内容。
// 返回 { exists:bool, size:int, content:string }，文件不存在时 exists=false。
export async function getBackendLog() {
  const r = await fetch('/api/debug-log');
  if (!r.ok) throw new Error(`HTTP ${r.status}`);
  return r.json();
}

// 将后端日志纯文本解析为结构化行：{ time, level, module, msg }。
// 兼容两种格式：
//   [ts] LEVEL [MODULE] msg   （dbg 输出，带级别与模块）
//   [ts] msg                  （debug_log 输出，无级别/模块，按 LOG/- 处理）
export function parseBackendLog(text) {
  const lines = String(text || '').split(/\r?\n/);
  const re = /^\[([^\]]+)\]\s+(?:(\w+)\s+\[([^\]]+)\]\s+)?(.*)$/;
  const out = [];
  for (const ln of lines) {
    if (ln === '') continue;
    const m = re.exec(ln);
    if (m) {
      out.push({
        time: m[1],
        level: m[2] || 'LOG',
        module: m[2] ? (m[3] || '-') : '-',
        msg: (m[4] || '').replace(/^\s+/, ''),
      });
    } else {
      out.push({ time: '', level: 'LOG', module: '-', msg: ln });
    }
  }
  return out;
}
