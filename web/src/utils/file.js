/**
 * 浏览器端触发纯文本文件下载。
 *
 * @param {string} filename - 下载文件名（含扩展名）。
 * @param {string} text - 文件内容。
 * @param {string} [mimeType='text/plain;charset=utf-8;'] - MIME 类型。
 * @returns {boolean} 是否触发成功。
 */
export function downloadTextFile(filename, text, mimeType = 'text/plain;charset=utf-8;') {
  try {
    const blob = new Blob([text], { type: mimeType });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL?.(url);
    return true;
  } catch (e) {
    // 浏览器下载异常一般无法恢复，返回 false 供调用方提示用户
    return false;
  }
}
