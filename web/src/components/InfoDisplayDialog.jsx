import React, { useEffect, useMemo, useState } from 'react';
import { getDsparm } from '../api.js';
import { decodeImage } from '../utils/image.js';

/**
 * Infomation Display（1:1 复刻 OLD IDD_J_DLG + JProc.cpp，View→Information 打开）。
 * 4 个 Tab（IDC_J_TAB，jDefaultSet）：
 *  0. Concentration      → 子窗口 IDD_GASO：鼠标选区像素的 3 位十六进制阵列 + 统计
 *                           （点数 IDC_SU / 总和 IDC_SUM / 平均 IDC_AVE / 分散 IDC_B /
 *                            值∈[IJO,IKA] 计数 IDC_IJO_OUT），MouseMoveJ 实时刷新
 *  1. Pixel Distribution → IDD_HIS：make_gr —— 选区每行灰度和（横线）+ 每列灰度和（纵线）
 *                           分布图 + X/Y min/max（IDC_X_MIN/X_MAX/Y_MIN/Y_MAX）
 *  2. Largen each Pixel  → IDD_BIG_IMG：DRAW_J_BIG —— 选区像素按倍率 bai（radio 3..23，默认 3）
 *                           逐像素画灰度矩形放大
 *  3. DSP-ARM Function   → IDD_DSPARM：dsparm_set —— GBVM_DSP_ARM.txt 函数名 + 小图像段
 *                           global_small_image[1580+j] 大端 u16，行格式
 *                           "%04d | %4X ( %5d ) %s"；文件缺失提示 Cannot find Function Name File
 *
 * 数据源：当前 IR1 显示图像（等价 OLD global_twoimg 当前波段）+ 鼠标选区 mousePos/mouseSize
 * （OLD 的选区跟随主画面鼠标移动，Web 的选区本就随 hover/拖选实时更新，天然等价 bClic 联动）。
 */
const TABS = ['Concentration', 'Pixel Distribution', 'Largen each Pixel', 'DSP-ARM Function'];
const BAI_OPTIONS = [3, 5, 7, 9, 11, 13, 15, 17, 19, 21, 23]; // OLD IDC_RADIO1_..11_

export default function InfoDisplayDialog({ imageData, mousePos, mouseSize, datPath, record = 0, onClose }) {
  const [tab, setTab] = useState(0);
  const [ijo, setIjo] = useState(0);   // IDC_IJO 范围下限（默认 0）
  const [ika, setIka] = useState(255); // IDC_IKA 范围上限（默认 255）
  const [bai, setBai] = useState(3);   // 放大倍率（默认 3，同 OLD BIGIMGProc）
  const [dsparm, setDsparm] = useState(null);
  const [dsparmErr, setDsparmErr] = useState('');

  // 图像像素：与 ImagePane 相同的双路径 —— 整通道预载时 imageData.gray 已是 Uint8Array；
  // 否则（/api/image base64 路径）用 decodeImage 解码（u16le 按 min/max 归一化到 0..255）。
  const pixels = useMemo(() => {
    if (!imageData) return null;
    if (imageData.gray) return { width: imageData.width, height: imageData.height, gray: imageData.gray };
    try { return decodeImage(imageData); } catch (e) { return null; }
  }, [imageData]);
  const gray = pixels?.gray ?? null;
  const W = pixels?.width ?? 186;
  const H = pixels?.height ?? 88;
  // 选区（钳制到图像内；OLD MouseMoveJ 同样做钳制）
  const sx = Math.max(0, Math.min(W - 1, mousePos?.x ?? 0));
  const sy = Math.max(0, Math.min(H - 1, mousePos?.y ?? 0));
  const sw = Math.max(1, Math.min(W - sx, mouseSize?.w ?? 20));
  const sh = Math.max(1, Math.min(H - sy, mouseSize?.h ?? 20));

  // ---- Concentration：hex 阵列 + 统计（复刻 MouseMoveJ 的统计段）----
  const conc = useMemo(() => {
    if (!gray) return null;
    let sum = 0, sum2 = 0, ct = 0, inCount = 0;
    const rows = [];
    for (let i = sy; i < sy + sh; i++) {
      const cells = [];
      for (let j = sx; j < sx + sw; j++) {
        const v = gray[i * W + j] & 0xFF;
        if (v >= ijo && v <= ika) inCount++;
        cells.push(v.toString(16).padStart(3, ' ')); // OLD sprintf("%3x", BYTE)
        sum += v;
        sum2 += v * v;
        ct++;
      }
      rows.push(cells.join('')); // OLD sprintf("%3x") 逐个 strcat，无分隔符（每格恒 3 字符）
    }
    const avg = ct ? Math.floor(sum / ct) : 0;
    const disp = ct ? Math.floor(sum2 / ct) - avg * avg : 0; // OLD: sum2/ct - (sum/ct)^2
    return { rows, ct, sum, avg, disp, inCount };
  }, [gray, sx, sy, sw, sh, ijo, ika]);

  // ---- Pixel Distribution：行/列灰度和 ----
  const dist = useMemo(() => {
    if (!gray) return null;
    const rowSum = []; // WidthBox：选区每行（行号 sy..sy+sh-1）在选区列范围内的灰度和
    for (let i = sy; i < sy + sh; i++) {
      let s = 0;
      for (let j = sx; j < sx + sw; j++) s += gray[i * W + j];
      rowSum.push(s);
    }
    const colSum = []; // HeightBox：选区每列
    for (let j = sx; j < sx + sw; j++) {
      let s = 0;
      for (let i = sy; i < sy + sh; i++) s += gray[i * W + j];
      colSum.push(s);
    }
    return { rowSum, colSum };
  }, [gray, sx, sy, sw, sh]);

  // ---- Pixel Distribution canvas 绘制（复刻 make_gr：底框 + 横线/纵线 + 标题）----
  useEffect(() => {
    if (tab !== 1 || !dist) return;
    const canvas = document.getElementById('info-dist-canvas');
    if (!canvas) return;
    let ctx;
    try { ctx = canvas.getContext('2d'); } catch (e) { return; }
    if (!ctx) return;
    const maxR = Math.max(1, ...dist.rowSum);
    const maxC = Math.max(1, ...dist.colSum);
    ctx.fillStyle = '#fff';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.fillStyle = '#000';
    ctx.font = '12px sans-serif';
    ctx.fillText('Pixel Distribution', 120, 20);
    ctx.strokeStyle = '#000';
    ctx.strokeRect(0.5, 50.5, 450, 450);
    // X 分布（每行一条横线，长度 ∝ 行和/最大）
    ctx.beginPath();
    dist.rowSum.forEach((s, k) => {
      const y = 100 + k * 4;
      ctx.moveTo(0, y);
      if (s) ctx.lineTo((s / maxR) * 450, y);
    });
    ctx.stroke();
    // Y 分布（每列一条纵线，高度 ∝ 列和/最大）
    ctx.beginPath();
    dist.colSum.forEach((s, k) => {
      const x = 50 + k * 2;
      ctx.moveTo(x, 500);
      if (s) ctx.lineTo(x, 500 - (s / maxC) * 450);
    });
    ctx.stroke();
  }, [tab, dist]);

  // ---- Largen each Pixel canvas 绘制（复刻 DRAW_J_BIG：抠出选区 → bai×bai 灰度矩形）----
  useEffect(() => {
    if (tab !== 2 || !gray) return;
    const canvas = document.getElementById('info-big-canvas');
    if (!canvas) return;
    let ctx;
    try { ctx = canvas.getContext('2d'); } catch (e) { return; }
    if (!ctx) return;
    canvas.width = sw * bai;
    canvas.height = sh * bai;
    ctx.fillStyle = '#fff';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    for (let i = 0; i < sh; i++) {
      for (let j = 0; j < sw; j++) {
        const c = gray[(sy + i) * W + (sx + j)] & 0xFF; // OLD b_(): RGB(color,color,color)
        ctx.fillStyle = `rgb(${c},${c},${c})`;
        ctx.fillRect(j * bai, i * bai, bai, bai);
      }
    }
  }, [tab, gray, sx, sy, sw, sh, bai]);

  // ---- DSP-ARM Function：加载函数名 + 小图像段 ----
  useEffect(() => {
    if (tab !== 3) return;
    let alive = true;
    getDsparm({ datPath, record })
      .then((r) => { if (alive) { setDsparm(r); setDsparmErr(''); } })
      .catch((e) => { if (alive) setDsparmErr(e.message); });
    return () => { alive = false; };
  }, [tab, datPath, record]);

  return (
    <div className="info-display">
      {/* 4 个 Tab 按钮（IDC_J_TAB） */}
      <div className="info-tabs">
        {TABS.map((t, i) => (
          <button key={t} className={`info-tab ${i === tab ? 'active' : ''}`} onClick={() => setTab(i)}>{t}</button>
        ))}
      </div>

      {/* Tab 0: Concentration（IDD_GASO） */}
      {tab === 0 && (
        <div className="info-body">
          <div className="info-toolbar">
            <span className="mono">{`( ${sx}, ${sy} ) <--> ( ${sx + sw}, ${sy + sh} )`}</span>
            <label>IJO <input type="number" min="0" max="255" value={ijo}
              onChange={(e) => setIjo(Number(e.target.value) || 0)} /></label>
            <label>IKA <input type="number" min="0" max="255" value={ika}
              onChange={(e) => setIka(Number(e.target.value) || 0)} /></label>
          </div>
          {conc ? (
            <>
              <pre className="info-hex">{conc.rows.join('\n')}</pre>
              <div className="info-stats">
                <span>点数: {conc.ct}</span>
                <span>总和: {conc.sum}</span>
                <span>平均: {conc.avg}</span>
                <span>分散: {conc.disp}</span>
                <span>范围计数: {conc.inCount}</span>
              </div>
            </>
          ) : <div className="info-empty">无图像数据</div>}
        </div>
      )}

      {/* Tab 1: Pixel Distribution（IDD_HIS） */}
      {tab === 1 && (dist ? (
        <div className="info-body">
          <div className="info-toolbar mono">
            {`X_MIN=${Math.min(...dist.rowSum)} X_MAX=${Math.max(...dist.rowSum)} Y_MIN=${Math.min(...dist.colSum)} Y_MAX=${Math.max(...dist.colSum)}`}
          </div>
          <canvas id="info-dist-canvas" width={460} height={510} className="info-canvas" />
        </div>
      ) : <div className="info-empty">无图像数据</div>)}

      {/* Tab 2: Largen each Pixel（IDD_BIG_IMG） */}
      {tab === 2 && (gray ? (
        <div className="info-body">
          <div className="info-toolbar">
            {BAI_OPTIONS.map((b) => (
              <label key={b}>
                <input type="radio" name="info-bai" checked={bai === b} onChange={() => setBai(b)} />
                {`x${b}`}
              </label>
            ))}
          </div>
          <canvas id="info-big-canvas" className="info-canvas" />
        </div>
      ) : <div className="info-empty">无图像数据</div>)}

      {/* Tab 3: DSP-ARM Function（IDD_DSPARM） */}
      {tab === 3 && (
        <div className="info-body">
          {dsparmErr && <div className="info-empty">{dsparmErr}</div>}
          {!dsparmErr && dsparm && !dsparm.found && (
            <div className="info-empty">{dsparm.message}</div>
          )}
          {!dsparmErr && dsparm?.found && (
            <div className="info-dsparm">
              {dsparm.items.map((it) => (
                <div key={it.no} className="mono">
                  {`${String(it.no).padStart(4, '0')} | ${it.hex.trim().padStart(4, ' ')} ( ${String(it.dec).padStart(5)} )     ${it.name}`}
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
