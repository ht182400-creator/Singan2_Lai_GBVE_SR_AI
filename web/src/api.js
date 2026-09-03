// M3/M4 HTTP API 客户端封装（对应 server/server.cpp，P0–P5 全部端点）。
// 端点总览见 docs/11_模块功能同步方案_P0-P5.md 第 4 节。
// 所有函数返回解析后的 JSON；失败抛 Error(message)。

async function postJson(url, body) {
  const r = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  const data = await r.json();
  if (!r.ok) throw new Error(data.error || `HTTP ${r.status}`);
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
export async function analyzeBatchByPath({ datPath, zfilePath, start = 0, step = 1,
  count = 1, kin = 1, country = 0 }) {
  return postJson('/api/analyze-batch', {
    dat_path: datPath, zfile_path: zfilePath, start, step, count, kin, country,
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
// 在选定区域内的黑/白像素数。返回 { record_count, rows:[{record,value}], wave, threshold, black }
export async function makeGraph({ datPath, zfilePath = '', wave = 0,
  maxRecords = 16, startRecord = 0, step = 1,
  nitiType = 'Gra+Bin', gradType = 0, gain = 1,
  threshold = 90, colorPoint = 150,
  areaX = 0, areaY = 0, areaW = 20, areaH = 20,
  black = true,
  wtablePath = '' }) {
  return postJson('/api/graph/make', {
    dat_path: datPath, zfile_path: zfilePath, wave,
    max_records: maxRecords, start_record: startRecord, step,
    niti_type: nitiType, grad_type: gradType, gain,
    threshold, color_point: colorPoint,
    area_x: areaX, area_y: areaY, area_w: areaW, area_h: areaH,
    black,
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

// ============ P4 ATB / VTB / 坐标 ============

// 解析坐标文件 -> { count, areas:[{x1,y1,x2,y2,a_low,a_high,b_low,b_high,area_min}] }
export async function parseZfile({ path, encoding = 'shift_jis' }) {
  return postJson('/api/zfile/parse', { path, encoding });
}

export async function loadAtb({ path }) {
  return postJson('/api/atb/load', { path });
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
