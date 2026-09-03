import React, { useCallback, useEffect, useState } from 'react';
import { fsList } from '../api.js';

/**
 * 本地文件选择对话框（复刻 OLD GetOpenFileName 的「File selection」）。
 * 浏览器无法直接取得本地绝对路径，故由 server 的 /api/fs/list 代为列目录：
 * - 双击目录进入；点「..」返回上级；路径框可直接输入后回车/点「转到」；
 * - 单击文件选中，双击文件或点「打开」返回完整路径 onOk(fullPath)。
 * props: title, initialPath, ext（如 ".bin"）, onOk(path), onClose()
 */
export default function FileBrowser({ title, initialPath, ext = '', onOk, onClose }) {
  const [path, setPath] = useState(initialPath || '');
  const [items, setItems] = useState({ path: '', parent: '', dirs: [], files: [] });
  const [selected, setSelected] = useState(''); // 当前选中的文件名
  const [err, setErr] = useState('');

  // 目录 + 文件名 -> 完整路径（Windows 反斜杠；已带分隔符则直接拼）
  const join = useCallback((dir, name) => {
    if (!dir) return name;
    return (dir.endsWith('\\') || dir.endsWith('/')) ? dir + name : `${dir}\\${name}`;
  }, []);

  // 加载目录内容；失败时保留在当前界面并显示错误
  const load = useCallback(async (p) => {
    try {
      const r = await fsList({ path: p, ext });
      setItems(r);
      setPath(r.path);
      setSelected('');
      setErr('');
    } catch (e) {
      setErr(e.message);
    }
  }, [ext]);

  // 首次挂载：从初始路径加载
  useEffect(() => { load(initialPath || ''); }, [load, initialPath]);

  const confirmFile = useCallback((name) => {
    onOk(join(path, name));
  }, [onOk, path, join]);

  const handleListKeyDown = (e) => {
    if (e.key === 'Enter' && selected) confirmFile(selected);
  };

  return (
    <div className="fb-overlay" onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="fb-dialog">
        <div className="fb-title">{title}</div>
        <div className="fb-path-row">
          <input
            className="fb-path"
            value={path}
            onChange={(e) => setPath(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') load(path); }}
          />
          <button className="btn" onClick={() => load(path)}>转到</button>
        </div>
        <div className="fb-list" onKeyDown={handleListKeyDown} tabIndex={0}>
          {items.parent !== '' && (
            <div className="fb-item fb-dir" onClick={() => load(items.parent)} title="返回上级目录">..</div>
          )}
          {/* 目录：单击即进入（等价资源管理器双击，降低操作成本） */}
          {items.dirs.map((d) => (
            <div key={`d-${d}`} className="fb-item fb-dir" onClick={() => load(join(path, d))}
              title={`进入目录 ${join(path, d)}`}>
              {`[${d}]`}
            </div>
          ))}
          {items.files.map((f) => (
            <div
              key={`f-${f}`}
              className={`fb-item fb-file${selected === f ? ' fb-selected' : ''}`}
              onClick={() => setSelected(f)}
              onDoubleClick={() => confirmFile(f)}
            >
              {f}
            </div>
          ))}
        </div>
        {err && <div className="fb-err">{err}</div>}
        <div className="fb-btns">
          <button className="btn" disabled={!selected} onClick={() => confirmFile(selected)}>打开</button>
          <button className="btn" onClick={onClose}>取消</button>
        </div>
      </div>
    </div>
  );
}
