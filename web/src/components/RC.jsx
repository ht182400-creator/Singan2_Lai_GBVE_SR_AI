import React, { useContext } from 'react';
import { useDraggable } from '../hooks/useDraggable.js';
import { useResizable } from '../hooks/useResizable.js';
import { ZoomContext } from '../zoomContext.js';

/**
 * 可拖拽 + 可缩放容器包装：
 *  - 拖标题栏/空白区移动位置（useDraggable，持久化 localStorage）。
 *  - 拖右下角手柄改宽高（useResizable，持久化 localStorage）。
 * defaultLeft / defaultTop 取 styles.css 中该 .rc-xxx 的原始坐标。
 *
 * 内容统一包进 .rc-body（flex:1 填满卡片宽高），这样所有面板都能
 * 左右 + 上下缩放，且内部内容（fieldset/canvas）随卡片自适应填充。
 */
export default function RC({ id, className, dl, dt, as: Tag = 'div', resizable = true, children, ...rest }) {
  const zoom = useContext(ZoomContext);
  const { style, onMouseDown } = useDraggable(id, dl, dt, zoom);
  const { size, onResizeDown } = useResizable(id);
  const sizedStyle = size ? { ...style, width: size.w, height: size.h } : style;
  return (
    <Tag className={`rc ${className}`} style={sizedStyle} onMouseDown={onMouseDown} {...rest}>
      <div className="rc-body">
        {children}
      </div>
      {resizable && (
        <span
          className="rc-resize-handle"
          title="拖拽改变卡片宽高"
          onMouseDown={(e) => onResizeDown(e, zoom)}
        />
      )}
    </Tag>
  );
}
