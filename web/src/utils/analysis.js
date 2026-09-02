/**
 * Make Graph / 分析结果 → 右侧卡片（Graph1/Graph2 / S2Chart / Result Details）的格式化工具。
 * 对应原版 ON_DRAW_GRAPH / S2 输出。
 */

/**
 * 是否应分析 Data2（IR2）：需勾选「2」、Data2 已加载（recordCount2>0）、且与 Data1 为不同文件。
 * 这是 Statistics 与 Make Graph 统一的控制条件，避免「只分析 IR1」时仍算/显示 IR2，
 * 同时满足「两个不同文件且勾选 2」时同时显示 IR1 与 IR2。
 */
export function shouldAnalyzeData2(include2, datPath1, datPath2, recordCount2) {
  return !!include2 && !!datPath2 && recordCount2 > 0 && datPath1 !== datPath2;
}

/**
 * S2[1..32] 默认业务名称（与 OLD WinMain.cpp/Out_.cpp 默认 func_name 列表一致）。
 * 若后续加载 function name 文件，可替换为文件中的名称。
 */
export const S2_FUNC_NAMES = [
  'New GreenP WM', 'Old GreenP WM', 'Infre-Red WM', 'GreenP WM',
  'WM1 IR Cons.', 'WM1 IR WhiteRatio', 'WM1 GP Cons.', 'WM1 GP WhiteRatio',
  'WM1 Neighbor-Diff', 'WM1 IR Emphasis', 'WM1 IR-G Diff', 'Counterfeit CC',
  'Thread IR Con.', 'IR1 White Ratio', 'IR2 White Ratio', 'IR3 White Ratio',
  'NCR Hologram', 'Thread Gradiant', 'ETC1 Gradient', 'ETC2 Colour Diff',
  'Reserved', 'Reserved', 'Reserved', 'Reserved',
  'Reserved', 'Reserved', 'Reserved', 'Reserved',
  'Reserved', 'Reserved', 'Reserved', 'Reserved',
];

/**
 * 把 s2[32] 转为 Result Details 行
 * 每行: { id: 'R1'..'R32', name: 业务名称, th: 默认阈值, val: s2[i], ok: val >= th }
 * 若提供 perThresholds（长度 32）则用其作为该函数的阈值
 */
export function buildResultRows(s2, perThresholds) {
  if (!s2) return [];
  return s2.map((v, i) => {
    const th = perThresholds && perThresholds[i] != null ? perThresholds[i] : 0.5;
    return {
      id: `R${i + 1}`,
      name: S2_FUNC_NAMES[i] || 'Unknown',
      th,
      val: v,
      ok: Number.isFinite(v) ? v >= th : false,
    };
  });
}

/**
 * 数组 → 文本列表（每行一个值）。小数 3 位
 */
export function arrayToText(arr, digits = 3) {
  if (!arr) return '';
  return arr.map((v) => (Number.isFinite(v) ? v.toFixed(digits) : '—')).join('\n');
}

/**
 * 后端 s2 为长度 33 的 1-based 数组（下标 0 恒为 0 未用，真实值 S2[1..32] 在下标 [1..32]）。
 * 显示层（Graph1 文本 / Result Details / S2Chart 单条回退）需要纯值 0-based 数组，
 * 这里丢弃未用的下标 0，得到长度 32 的 [S2[1]..S2[32]]。
 */
export function normalizeS2(s2) {
  return Array.isArray(s2) ? s2.slice(1, 33) : s2;
}

/**
 * 后端 etc 为长度 15 的 1-based 数组（下标 0 恒为 0 未用，真实值 ETC[1..12] 在下标 [1..12]）。
 * 丢弃未用下标 0 并截到长度 12，得到 [ETC[1]..ETC[12]]。
 */
export function normalizeEtc(etc) {
  return Array.isArray(etc) ? etc.slice(1, 13) : etc;
}

/**
 * s2 → IR1/IR2 txt 列表文本（按函数序号 + 值）
 *   1664  17
 *   1667  17  18  19  21
 * record 缺省时省略首列
 */
export function s2ToTextList(s2, recordNo) {
  if (!s2) return '';
  // 约定 0-based 纯值数组（下标 0 对应 S2[1]），后端 1-based 的下标 0 已在入库处丢弃
  return s2
    .map((v, i) => {
      const idx = String(i + 1).padStart(2, '0');
      const val = Number.isFinite(v) ? v.toFixed(2) : '—';
      return recordNo != null ? `${recordNo}  ${idx}  ${val}` : `${idx}  ${val}`;
    })
    .join('\n');
}
