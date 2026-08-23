import React from 'react';

/**
 * 统一对话框：标题 + Backdrop + 内容 + actions[] 按钮列表
 * 五个对话框共用此组件
 */
export default function DialogModal({ title, onClose, onAction, actions, children }) {
  return (
    <div className="dialog-backdrop" onClick={onClose}>
      <div className="dialog-window" onClick={(e) => e.stopPropagation()}>
        <div className="dialog-title">
          {title}
          <button className="dialog-x" onClick={onClose}>×</button>
        </div>
        <div className="dialog-body">{children}</div>
        <div className="dialog-actions">
          {actions.map((a) => (
            <button key={a} className="btn" onClick={() => onAction?.(a)}>{a}</button>
          ))}
        </div>
      </div>
    </div>
  );
}
