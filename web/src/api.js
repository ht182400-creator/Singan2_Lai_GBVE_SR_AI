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

// ============ P1 分析链路 ============

// 以本地路径方式分析（联调/审阅最常用）
export async function analyzeByPath({ datPath, zfilePath, record = 0, kin = 1, country = 0 }) {
  return postJson('/api/analyze-path', {
    dat_path: datPath, zfile_path: zfilePath, record, kin, country,
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

// 生成图表序列（按坐标区域统计 + 列剖面）[原版 CreateGraph 未移植，近似实现]
export async function makeGraph({ datPath, record = 0, zfilePath = '', wave = 0,
  maxAreas = 8, wtablePath = '' }) {
  return postJson('/api/graph/make', {
    dat_path: datPath, record, zfile_path: zfilePath, wave, max_areas: maxAreas,
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
