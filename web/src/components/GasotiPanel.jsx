/**
 * GASOTI 真币图文本区面板。
 * 对应原版 resource.rc：IDC_ZAHYO(629,269) + IDC_GASOTI(629,280,180,61)，
 * 以及右侧第二组 IDC_ZAHYO2(809,269) + IDC_GASOTI2(811,280,179,60)。
 * 双栏并排，Coordinate 行共用一行以压缩高度，避免覆盖下方 Operation。
 *
 * 复刻 OLD Mouse.cpp MouseMove1/2：IR1/IR2 使用**同一个鼠标选区**（box），
 * 但分别从各自的图像（imageData1 = global_twoimg / imageData2 = global_twoimg2）
 * 读取像素值，做到「上线同步显示」。
 * 文本格式复刻 OLD：头行 "(x,y)<-->(x+w,y+h) Black N, White M" + 全区域 %3x 十六进制矩阵。
 */
import React, { useMemo } from 'react';
import { decodeImage } from '../utils/image.js';

// 选区 box { x, y, w, h } → GASOTI 文本（%3x 十六进制像素矩阵，复刻 OLD sprintf("%3x")）
function buildGasotiText(pixels, box) {
  if (!pixels || !box || box.w <= 0 || box.h <= 0) {
    return '(00,00)<-->(00,00) Black  0, White  0';
  }
  const { gray, width, height } = pixels;
  const x1 = Math.max(0, Math.min(width - 1, box.x));
  const y1 = Math.max(0, Math.min(height - 1, box.y));
  const x2 = Math.max(0, Math.min(width - 1, box.x + box.w - 1));
  const y2 = Math.max(0, Math.min(height - 1, box.y + box.h - 1));
  let black = 0;
  let white = 0;
  const lines = [];
  for (let y = y1; y <= y2; y++) {
    let row = '';
    for (let x = x1; x <= x2; x++) {
      const v = gray[y * width + x];
      // 复刻 OLD：%3x（3 字符右对齐，空格补齐，小写）；黑白按 0/255 统计
      row += v.toString(16).padStart(3, ' ');
      if (v === 0) black++;
      else if (v === 255) white++;
    }
    lines.push(row);
  }
  const fmt = (n) => String(n).padStart(2, '0');
  const head = `(${fmt(x1)},${fmt(y1)})<-->(${fmt(box.x + box.w)},${fmt(box.y + box.h)}) Black ${String(black).padStart(3, ' ')}, White ${String(white).padStart(3, ' ')}`;
  return [head, ...lines].join('\n');
}

export default function GasotiPanel({ imageData1, imageData2, box, zfileName = '85901.txt' }) {
  const pixels1 = useMemo(() => decodeImage(imageData1), [imageData1]);
  const pixels2 = useMemo(() => decodeImage(imageData2), [imageData2]);
  // IR1 / IR2 共用同一选区 box，分别读各自图像 → 上下同步
  const leftData = useMemo(() => buildGasotiText(pixels1, box), [pixels1, box]);
  const rightData = useMemo(() => buildGasotiText(pixels2, box), [pixels2, box]);

  return (
    <fieldset className="gasoti-panel">
      <legend>Genuine Note (GASOTI)</legend>
      <div className="gasoti-head">
        <span className="bs-lbl">IR1</span>
        <input className="gasoti-edit" value={zfileName} readOnly title="IR1 区域对应 zfile" />
        <span className="bs-lbl">IR2</span>
        <input className="gasoti-edit" value={zfileName} readOnly title="IR2 区域对应 zfile" />
      </div>
      <div className="gasoti-columns">
        <div className="gasoti-col">
          <textarea className="gasoti-area" value={leftData} readOnly />
        </div>
        <div className="gasoti-col">
          <textarea className="gasoti-area" value={rightData} readOnly />
        </div>
      </div>
    </fieldset>
  );
}
