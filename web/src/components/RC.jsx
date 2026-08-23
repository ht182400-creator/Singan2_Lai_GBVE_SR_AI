import React from 'react';
import { useDraggable } from '../hooks/useDraggable.js';

/**
 * 可拖拽容器包装：用标题栏/空白区拖动，位置持久化到 localStorage。
 * defaultLeft / defaultTop 取 styles.css 中该 .rc-xxx 的原始坐标。
 */
export default function RC({ id, className, dl, dt, as: Tag = 'div', children, ...rest }) {
  const { style, onMouseDown } = useDraggable(id, dl, dt);
  return (
    <Tag className={`rc ${className}`} style={style} onMouseDown={onMouseDown} {...rest}>
      {children}
    </Tag>
  );
}
