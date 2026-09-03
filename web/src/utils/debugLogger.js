/**
 * 前端调试日志器。
 *
 * 用途：在浏览器端记录关键操作与 API 往返，便于排查 IR2 空白、批量分析失败等问题。
 * 日志保留最近 MAX_ENTRIES 条，可导出为文本文件（非静默落盘，需用户触发下载）。
 */
import { downloadTextFile } from './file.js';

// 最大保留条数，防止长期运行后内存无限增长
const MAX_ENTRIES = 2000;

const entries = [];

/**
 * 记录一条日志。
 *
 * @param {string} level - DEBUG / INFO / WARNING / ERROR。
 * @param {string} msg - 日志正文。
 * @param {*} [data] - 可选附加数据（会被 JSON 序列化）。
 */
// 内部写日志：level 级别、module 模块标识、msg 正文、data 可选附加数据
function logCore(level, module, msg, data) {
  try {
    const entry = {
      time: new Date().toISOString(),
      level: String(level).toUpperCase(),
      module: String(module).toUpperCase(),
      msg: String(msg),
      data: data !== undefined ? JSON.stringify(data) : undefined,
    };
    entries.push(entry);
    if (entries.length > MAX_ENTRIES) entries.shift();
  } catch (e) {
    // 日志器自身异常不能影响主流程
  }
}

// 记录一条带模块的日志（operation history / 关键操作应走此函数以区分模块）
export function logModule(level, module, msg, data) {
  logCore(level, module, msg, data);
}

export function log(level, msg, data) {
  logCore(level, 'MISC', msg, data);
}

/** 记录 DEBUG 级别日志。 */
export function logDebug(msg, data) { log('DEBUG', msg, data); }

/** 记录 INFO 级别日志。 */
export function logInfo(msg, data) { log('INFO', msg, data); }

/** 记录 WARNING 级别日志。 */
export function logWarning(msg, data) { log('WARNING', msg, data); }

/** 记录 ERROR 级别日志。 */
export function logError(msg, data) { log('ERROR', msg, data); }

/** 获取当前全部日志副本。 */
export function getLog() {
  return entries.slice();
}

/** 清空日志。 */
export function clearLog() {
  entries.length = 0;
}

/**
 * 将当前日志导出为文本文件。
 *
 * @returns {boolean} 是否导出成功。
 */
export function exportDebugLog() {
  try {
    const lines = entries.map((e) => {
      const base = `${e.time} [${e.level}] [${e.module || 'MISC'}] ${e.msg}`;
      return e.data ? `${base} ${e.data}` : base;
    });
    const filename = `singan2_debug_${new Date().toISOString().slice(0, 10).replace(/-/g, '')}_${new Date().toISOString().slice(11, 19).replace(/:/g, '')}.log`;
    return downloadTextFile(filename, lines.join('\n'), 'text/plain;charset=utf-8;');
  } catch (e) {
    return false;
  }
}
