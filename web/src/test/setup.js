import '@testing-library/jest-dom/vitest';

// jsdom 缺失的 API 兜底
if (!window.matchMedia) {
  window.matchMedia = () => ({
    matches: false,
    addEventListener: () => {},
    removeEventListener: () => {},
    addListener: () => {},
    removeListener: () => {},
  });
}

// ResizeObserver 兜底（部分组件可能依赖）
if (!window.ResizeObserver) {
  window.ResizeObserver = class {
    observe() {}
    unobserve() {}
    disconnect() {}
  };
}

// HTMLCanvasElement.getContext 兜底：jsdom 未实现 canvas 2D（getContext 返回 null 并报
// "Not implemented"），ECharts/zrender 初始化时 `ctx.dpr = ...` 会抛
// "Cannot set properties of null"，导致 App 集成测试整页渲染失败。
// 这里替换为一个「记录调用但不真正绘图」的 2D 上下文桩，仅测试环境生效。
const createCtx2dStub = (canvas) => ({
  canvas,
  // zrender 等库会直接在 ctx 上写属性（dpr、style 等），普通对象天然可写
  fillStyle: '', strokeStyle: '', lineWidth: 1, lineCap: 'butt', lineJoin: 'miter',
  font: '', textAlign: 'start', textBaseline: 'alphabetic', globalAlpha: 1,
  globalCompositeOperation: 'source-over', imageSmoothingEnabled: true,
  lineDashOffset: 0, miterLimit: 10, shadowBlur: 0, shadowColor: 'transparent',
  shadowOffsetX: 0, shadowOffsetY: 0, filter: 'none',
  clearRect() {}, fillRect() {}, strokeRect() {},
  beginPath() {}, closePath() {}, moveTo() {}, lineTo() {},
  arc() {}, arcTo() {}, bezierCurveTo() {}, quadraticCurveTo() {}, rect() {},
  fill() {}, stroke() {}, clip() {}, resetClip() {},
  save() {}, restore() {},
  translate() {}, rotate() {}, scale() {}, transform() {}, setTransform() {}, resetTransform() {},
  setLineDash() {}, getLineDash() { return []; },
  drawImage() {}, putImageData() {},
  createImageData(width, height) {
    return { width, height, data: new Uint8ClampedArray(width * height * 4) };
  },
  getImageData(x, y, width, height) {
    return { x, y, width, height, data: new Uint8ClampedArray(width * height * 4) };
  },
  measureText(text) { return { width: String(text ?? '').length * 7 }; },
  createLinearGradient() { return { addColorStop() {} }; },
  createRadialGradient() { return { addColorStop() {} }; },
  createConicGradient() { return { addColorStop() {} }; },
  createPattern() { return null; },
  isPointInPath() { return false; },
  fillText() {}, strokeText() {},
});
window.HTMLCanvasElement.prototype.getContext = function getContextStub(type) {
  // 只桩化 2d；webgl 等其它类型维持返回 null
  return type === '2d' ? createCtx2dStub(this) : null;
};
