import React, { useEffect, useMemo, useRef, useState } from 'react';

/**
 * 日志查看器：浮动窗口，支持拖拽 / 最小化 / 最大化 / 关闭。
 * 工具栏提供查找（上/下翻 + 高亮）、复制、全选、按级别过滤、自动换行、刷新（后端日志）。
 * 不同日志级别用不同前景色标注；不同模块用不同稳定配色标注，便于快速区分来源。
 *
 * @param {string} kind - 'ui' | 'backend'，仅用于语义区分。
 * @param {string} title - 窗口标题。
 * @param {Array<{time:string,level:string,module:string,msg:string}>} lines - 已解析的日志行。
 * @param {boolean} loading - 是否加载中。
 * @param {string} error - 加载错误信息（非空表示出错）。
 * @param {Function} onClose - 关闭回调。
 * @param {Function|null} onRefresh - 后端刷新回调（ui 日志为 null）。
 */
export default function LogViewer({ kind, title, lines, loading, error, onClose, onRefresh }) {
  const [pos, setPos] = useState({ x: 140, y: 80 });
  const [size, setSize] = useState({ w: 780, h: 540 });
  const [minimized, setMinimized] = useState(false);
  const [maximized, setMaximized] = useState(false);
  const [search, setSearch] = useState('');
  const [matchIdx, setMatchIdx] = useState(0);
  const [filters, setFilters] = useState({ ERROR: true, WARNING: true, INFO: true, DEBUG: true, LOG: true });
  const [wrap, setWrap] = useState(false);
  const [copied, setCopied] = useState(false);
  const bodyRef = useRef(null);
  const lineRefs = useRef([]);

  // 各日志级别对应的前景色
  const LEVEL_COLOR = {
    ERROR: '#ff4d4f', WARNING: '#fa8c16', INFO: '#1890ff', DEBUG: '#8c8c8c', LOG: '#595959',
  };
  const LEVELS = ['ERROR', 'WARNING', 'INFO', 'DEBUG', 'LOG'];
  // 模块名 -> 稳定配色（按字符串哈希取色，保证同一模块颜色一致）
  const MODULE_PALETTE = ['#c0392b', '#27ae60', '#2980b9', '#8e44ad', '#d35400', '#16a085', '#2c3e50', '#c0399b', '#7f8c8d', '#e67e22'];
  const moduleColor = (mod) => {
    const s = String(mod || '-');
    let h = 0;
    for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0;
    return MODULE_PALETTE[h % MODULE_PALETTE.length];
  };
  // 将文本按关键字切分，命中部分用 <mark> 高亮（大小写不敏感）
  const highlight = (text, q) => {
    if (!q) return text;
    const lower = String(text).toLowerCase();
    const ql = q.toLowerCase();
    const nodes = [];
    let i = 0;
    let k = 0;
    while (i <= lower.length) {
      const idx = lower.indexOf(ql, i);
      if (idx < 0) {
        if (i < text.length) nodes.push(text.slice(i));
        break;
      }
      if (idx > i) nodes.push(text.slice(i, idx));
      nodes.push(<mark key={k++} className="log-hit">{text.slice(idx, idx + q.length)}</mark>);
      i = idx + q.length;
    }
    return nodes;
  };

  // 按级别过滤 + 关键字过滤后的可见行
  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return lines.filter((l) => {
      if (!filters[l.level]) return false;
      if (!q) return true;
      const full = `${l.time} ${l.level} [${l.module}] ${l.msg}`.toLowerCase();
      return full.includes(q);
    });
  }, [lines, filters, search]);

  // 查找匹配总数（filtered 已仅包含命中行）
  const matchCount = useMemo(() => (search.trim() ? filtered.length : 0), [filtered, search]);

  // 关键字变化时重置当前匹配位置
  useEffect(() => { setMatchIdx(0); }, [search]);
  // 当前匹配行滚动到可视区中部
  useEffect(() => {
    const el = lineRefs.current[matchIdx];
    if (el) el.scrollIntoView({ block: 'center' });
  }, [matchIdx, filtered]);
  // 卸载时清理可能残留的拖拽监听
  useEffect(() => () => { window.onmousemove = null; window.onmouseup = null; }, []);

  // 标题栏拖拽移动
  const onTitleMouseDown = (e) => {
    if (maximized || minimized) return;
    const sx = e.clientX;
    const sy = e.clientY;
    const ox = pos.x;
    const oy = pos.y;
    const onMove = (ev) => {
      setPos({
        x: Math.max(0, ox + ev.clientX - sx),
        y: Math.max(0, oy + ev.clientY - sy),
      });
    };
    const onUp = () => {
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
    };
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
  };

  // 查找上/下翻
  const gotoMatch = (dir) => {
    if (matchCount === 0) return;
    setMatchIdx((i) => {
      let n = i + dir;
      if (n < 0) n = matchCount - 1;
      if (n >= matchCount) n = 0;
      return n;
    });
  };

  // 复制当前可见行文本到剪贴板（兼容非安全上下文降级方案）
  const copyAll = async () => {
    const text = filtered.map((l) => `${l.time} ${l.level} [${l.module}] ${l.msg}`).join('\n');
    try {
      if (navigator.clipboard && navigator.clipboard.writeText) {
        await navigator.clipboard.writeText(text);
      } else {
        const ta = document.createElement('textarea');
        ta.value = text;
        document.body.appendChild(ta);
        ta.select();
        document.execCommand('copy');
        document.body.removeChild(ta);
      }
      setCopied(true);
      setTimeout(() => setCopied(false), 1200);
    } catch (e) {
      setCopied(false);
    }
  };

  // 全选：选中日志正文全部文本
  const selectAll = () => {
    if (bodyRef.current) window.getSelection().selectAllChildren(bodyRef.current);
  };

  const toggleLevel = (lv) => setFilters((f) => ({ ...f, [lv]: !f[lv] }));

  const winStyle = maximized
    ? { left: 0, top: 0, width: '100vw', height: '100vh' }
    : { left: pos.x, top: pos.y, width: size.w, height: size.h };

  return (
    <div className="logviewer-backdrop">
      <div className="logviewer-window" style={winStyle}>
        <div className="logviewer-title" onMouseDown={onTitleMouseDown}>
          <span className="logviewer-title-text">{title}</span>
          <span className="logviewer-title-btns">
            <button className="lv-btn" title="最小化" onClick={() => setMinimized((m) => !m)}>{minimized ? '▢' : '—'}</button>
            <button className="lv-btn" title="最大化/还原" onClick={() => setMaximized((m) => !m)}>{maximized ? '❒' : '▢'}</button>
            <button className="lv-btn lv-close" title="关闭" onClick={onClose}>×</button>
          </span>
        </div>
        {!minimized && (
          <>
            <div className="logviewer-toolbar">
              <input
                className="lv-search"
                placeholder="查找…"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
              <button className="btn btn-xs" onClick={() => gotoMatch(-1)} title="上一个">◀</button>
              <button className="btn btn-xs" onClick={() => gotoMatch(1)} title="下一个">▶</button>
              <span className="lv-match">{matchCount ? `${matchIdx + 1}/${matchCount}` : '0/0'}</span>
              <span className="lv-sep" />
              <button className="btn btn-xs" onClick={copyAll}>{copied ? '已复制' : '复制'}</button>
              <button className="btn btn-xs" onClick={selectAll}>全选</button>
              {onRefresh && <button className="btn btn-xs" onClick={onRefresh}>刷新</button>}
              <span className="lv-sep" />
              <label className="lv-wrap"><input type="checkbox" checked={wrap} onChange={(e) => setWrap(e.target.checked)} /> 换行</label>
              <span className="lv-sep" />
              {LEVELS.map((lv) => (
                <label key={lv} className="lv-filter" style={{ color: LEVEL_COLOR[lv] }}>
                  <input type="checkbox" checked={filters[lv]} onChange={() => toggleLevel(lv)} /> {lv}
                </label>
              ))}
            </div>
            <div
              className="logviewer-body"
              ref={bodyRef}
              style={{ whiteSpace: wrap ? 'pre-wrap' : 'pre' }}
            >
              {loading && <div className="lv-state">加载中…</div>}
              {!loading && error && <div className="lv-state lv-error">{error}</div>}
              {!loading && !error && filtered.length === 0 && (
                <div className="lv-state">无日志（或当前过滤条件下无匹配）</div>
              )}
              {!loading && !error && filtered.map((l, i) => (
                <div
                  key={i}
                  ref={(el) => { lineRefs.current[i] = el; }}
                  className={'log-line' + (i === matchIdx && search.trim() ? ' log-line-current' : '')}
                >
                  <span className="log-time">{l.time}</span>{' '}
                  <span className="log-level" style={{ color: LEVEL_COLOR[l.level] || LEVEL_COLOR.LOG }}>{l.level}</span>{' '}
                  <span className="log-module" style={{ color: moduleColor(l.module) }}>[{l.module}]</span>{' '}
                  <span className="log-msg">{highlight(l.msg, search.trim())}</span>
                </div>
              ))}
            </div>
            <div className="logviewer-status">
              共 {lines.length} 行 · 当前显示 {filtered.length} 行
            </div>
          </>
        )}
      </div>
    </div>
  );
}
