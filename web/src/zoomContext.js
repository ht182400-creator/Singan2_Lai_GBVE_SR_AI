import { createContext } from 'react';

/**
 * 全局缩放比例（.main-window 的 zoom）。
 * 用于把屏幕像素位移换算回基准坐标（除以 zoom），让面板拖拽手柄在无缩放/放大时都准。
 */
export const ZoomContext = createContext(1);
