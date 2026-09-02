/**
 * Make Graph 统计工具：复刻 OLD OnDrawPaint.cpp / OnDrawGraph.cpp 的分布列表与统计。
 *
 * 原版数据：
 *   - global_graph1_black / global_graph1_white：Data1（IR1）record 粒度数值
 *   - global_graph2_black / global_graph2_white：Data2（IR2）record 粒度数值
 * Web 映射：
 *   - file1 = Data1（IR1，绿色），file2 = Data2（IR2，蓝色）。
 *   - graphData.rows 保存 Data1 统计，graphData.rows2 保存 Data2 统计；
 *     buildGraphStats 分别用 rows / rows2 生成绿/蓝分布，IR1/IR2 为不同文件时互不重叠。
 *   - 单文件或旧数据缺少 rows2 时，file2 回退到 file1（绿/蓝重叠，兼容旧行为）。
 *   - Make Graph 的真实语义是「CreateGraph1 + ComputeSuppleResult 像素统计」：
 *     后端 /api/graph/make 返回 rows[].value，即每个 record 在选区内的黑/白像素数。
 *   - S2/ETC 分布由 Statistics 批量分析提供（S2Chart），与 Make Graph 解耦。
 */

/**
 * 从一行 row 中按函数列号取值（用于 S2Chart / Result Details 等 S2/ETC 场景）。
 * 约定：本函数与下游（GraphPlot / S2Chart）统一使用「0-based 纯值数组」——
 *   row.s2 长度 32，下标 0..31 对应 OLD 的 S2[1..32]；
 *   row.etc 长度 12，下标 0..11 对应 OLD 的 ETC[1..12]。
 * 后端 core 返回的是 1-based（下标 0 恒为 0 未用），故必须在「入库」时
 * 用 normalizeS2/normalizeEtc 丢弃下标 0（见 App.jsx 的 analyze/statistics 处理）。
 * 因此 fn 1..32 → s2[fn-1]，fn 33..44 → etc[fn-33]。
 * @param {{s2?:number[], etc?:number[]}} row
 * @param {number} fn 函数列号 1..44
 * @returns {number|undefined}
 */
export function getColumnValue(row, fn) {
  if (!row) return undefined;
  if (fn >= 1 && fn <= 32) return row.s2?.[fn - 1];
  if (fn >= 33 && fn <= 44) return row.etc?.[fn - 33];
  return undefined;
}

/**
 * 取 Make Graph / Statistics 单 record 的“待统计数值”。
 * 优先使用像素统计值 row.value（复刻 OLD CreateGraph1）；不存在时按 fn 回退到 S2/ETC。
 * @param {{value?:number, s2?:number[], etc?:number[]}} row
 * @param {number} fn 函数列号 1..44（仅当 row.value 不存在时生效）
 * @returns {number|undefined}
 */
export function getGraphValue(row, fn) {
  if (!row) return undefined;
  if (Number.isFinite(row.value)) return row.value;
  return getColumnValue(row, fn);
}

/**
 * 计算一组 record 的“值分布”。
 * 对每一行取 fn 列的值 v，把相同 v 的记录归为一组，输出：
 *   { value, count, records: [1-based record 号], recordStr }
 * 结果按 value 升序排列（与 OLD BubbleSort 后输出一致）。
 *
 * @param {{record:number, s2?:number[], etc?:number[]}[]} rows
 * @param {number} fn 函数列号
 * @returns {{value:number, count:number, records:number[], recordStr:string}[]}
 */
export function buildDistribution(rows, fn) {
  if (!Array.isArray(rows) || rows.length === 0) return [];
  const map = new Map();
  for (const row of rows) {
    const v = getGraphValue(row, fn);
    if (!Number.isFinite(v)) continue;
    const rec = (row.record ?? 0) + 1; // 1-based，与 OLD 一致
    const item = map.get(v);
    if (item) {
      item.count += 1;
      item.records.push(rec);
    } else {
      map.set(v, { value: v, count: 1, records: [rec] });
    }
  }
  const list = Array.from(map.values());
  list.sort((a, b) => a.value - b.value);
  for (const item of list) {
    item.recordStr = item.records.join(',');
  }
  return list;
}

/**
 * 计算平均值（与 OLD avgDev 一致）。
 * @param {number[]} arr
 * @returns {number}
 */
export function avgDev(arr) {
  if (!arr.length) return 0;
  return arr.reduce((s, v) => s + v, 0) / arr.length;
}

/**
 * 计算样本标准差（与 OLD stdDev 一致，除以 n-1）。
 * @param {number[]} arr
 * @returns {number}
 */
export function stdDev(arr) {
  if (arr.length < 2) return 0;
  const avg = avgDev(arr);
  const sum = arr.reduce((s, v) => s + (v - avg) ** 2, 0);
  return Math.sqrt(sum / (arr.length - 1));
}

/**
 * 计算 sigma（value 偏离 avg 多少倍 std）。
 * @param {number} stddev
 * @param {number} avg
 * @param {number} value
 * @returns {number}
 */
export function sigmaCompute(stddev, avg, value) {
  if (!stddev) return 0;
  return (value - avg) / stddev;
}

/**
 * 把分布数组转为 OLD 风格文本列表：
 *   "  12 (   3 ) <= 1,5,9,"
 * @param {{value:number, count:number, recordStr:string}[]} dist
 * @param {number} digits 数值小数位
 * @returns {string}
 */
export function distributionToText(dist, digits = 2) {
  if (!dist.length) return '';
  const allInt = dist.every((d) => Number.isInteger(d.value));
  const usedDigits = allInt ? 0 : digits;
  return dist
    .map((d) => {
      const val = d.value.toFixed(usedDigits);
      return `${val.padStart(6, ' ')} ( ${String(d.count).padStart(3, ' ')} ) <= ${d.recordStr}`;
    })
    .join('\n');
}

/**
 * 一次生成 Graph1/Graph2 所需的分布与统计。
 *
 * @param {{rows:{record:number, value?:number, s2?:number[], etc?:number[]}[], rows2?:{record:number, value?:number, s2?:number[], etc?:number[]}[]} | null} graphData
 * @param {number} fn 函数列号（仅当 graphData 为 S2/ETC 数据时生效；像素统计会忽略 fn 使用 row.value）
 * @param {{include1?:boolean, include2?:boolean}} options
 * @returns {{
 *   dist1: object[], dist2: object[],
 *   text1: string, text2: string,
 *   stats1: object, stats2: object,
 *   values1: number[], values2: number[]
 * }}
 */
export function buildGraphStats(graphData, fn, options = {}) {
  const file1 = graphData && Array.isArray(graphData.rows) ? graphData.rows : [];
  // file2 优先取 rows2（IR2 独立文件）；缺省则回退到 file1（单文件同文件场景，绿/蓝重叠，兼容旧行为）
  const file2 = graphData && Array.isArray(graphData.rows2) ? graphData.rows2
    : (options.include2 !== false ? file1 : []);
  const include1 = options.include1 !== false;
  const include2 = options.include2 !== false;

  // Graph1 = file1（绿色）/ Graph2 = file2（蓝色）：IR1/IR2 为不同文件时分别统计、互不重叠
  const rows1 = include1 ? file1 : [];
  const rows2 = include2 ? file2 : [];

  const dist1 = buildDistribution(rows1, fn);
  const dist2 = buildDistribution(rows2, fn);

  const values1 = rows1.map((r) => getGraphValue(r, fn)).filter(Number.isFinite);
  const values2 = rows2.map((r) => getGraphValue(r, fn)).filter(Number.isFinite);

  const mkStats = (values) => ({
    avg: avgDev(values),
    std: stdDev(values),
    min: values.length ? Math.min(...values) : 0,
    max: values.length ? Math.max(...values) : 0,
    count: values.length,
  });

  return {
    dist1,
    dist2,
    text1: distributionToText(dist1),
    text2: distributionToText(dist2),
    stats1: mkStats(values1),
    stats2: mkStats(values2),
    values1,
    values2,
  };
}
