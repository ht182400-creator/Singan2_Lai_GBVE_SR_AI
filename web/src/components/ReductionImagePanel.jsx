import React, { useEffect, useRef, useState, useCallback, useMemo } from 'react';
import { getSmallImage } from '../api.js';

/**
 * Reduction Image 1 / 2 合并面板（复刻 OLD OnDrawPaint.cpp 顶部右侧小图区）。
 *
 * 原版 MFC 语义：
 *   - Reduction Image 1 = Data1 当前 record 的 3 张 22×10 缩小图（global_small_image）。
 *   - Reduction Image 2 = Data2 当前 record 的 3 张 22×10 缩小图（global_small_image2）。
 *   - 下方公共编辑框显示 Match / Not Match：
 *     比较 Data1/Data2 两侧 3 个平面（共 660 字节）是否完全相同。
 *   - 原版没有"Compare Rec"输入框；"Compare Rec"是 Web 为单文件场景补充的快捷入口，
 *     仅当未加载 Data2 时生效，用于在当前文件内另选一个 record 做对比。
 *
 * Web 实现：
 *   - 左侧固定为 Data1（datPath1 / record1）。
 *   - 右侧优先取 Data2（datPath2 / record2）；若 Data2 未加载，则回退到单文件对比 record。
 */

// OLD small image 单平面尺寸：22×10 像素，3 个平面（偏移 0 / 220 / 440）
const SMALL_IMAGE_WIDTH = 22;
const SMALL_IMAGE_HEIGHT = 10;
const SMALL_IMAGE_PLANES = 3;
const SMALL_IMAGE_PLANE_SIZE = SMALL_IMAGE_WIDTH * SMALL_IMAGE_HEIGHT; // 220
const SMALL_IMAGE_COMPARE_BYTES = SMALL_IMAGE_PLANES * SMALL_IMAGE_PLANE_SIZE; // 660

/**
 * 将 base64 字符串解码为 Uint8Array。
 *
 * @param {string} b64 - base64 字符串。
 * @returns {Uint8Array|null} 解码后的数据；失败返回 null。
 */
function decodeBase64(b64) {
  try {
    const s = atob(b64);
    const arr = new Uint8Array(s.length);
    for (let i = 0; i < s.length; i++) arr[i] = s.charCodeAt(i);
    return arr;
  } catch (e) {
    return null;
  }
}

export default function ReductionImagePanel({
  datPath,
  record,
  recordCount,
  datPath1,
  record1,
  recordCount1,
  datPath2,
  record2,
  recordCount2,
  pushHistory,
}) {
  // 兼容旧 props（datPath/record/recordCount）与新的双文件命名。
  const leftPath = datPath1 || datPath || '';
  const leftRecord = record1 ?? record ?? 0;
  const leftRecordCount = recordCount1 ?? recordCount ?? 1;

  const hasData2 = !!datPath2;
  const rightPath = hasData2 ? datPath2 : leftPath;
  const rightRecordCount = hasData2 ? (recordCount2 ?? 1) : leftRecordCount;

  // 单文件场景下的手动对比 record；加载 Data2 时该值被忽略。
  const [manualRecord, setManualRecord] = useState(leftRecord);
  const [small1, setSmall1] = useState(null);
  const [small2, setSmall2] = useState(null);
  const [loading, setLoading] = useState(false);

  const canvasRefs = useRef([]);

  /**
   * 加载指定 dat / record 的小图数据。
   *
   * @param {string} path - .dat 路径。
   * @param {number} rec - 0 基 record 序号。
   * @returns {Promise<Uint8Array|null>} 小图数据；失败返回 null。
   */
  const loadSmall = useCallback(async (path, rec) => {
    if (!path) return null;
    try {
      const res = await getSmallImage({ datPath: path, record: rec });
      return res && res.data ? decodeBase64(res.data) : null;
    } catch (e) {
      pushHistory?.(`Reduction Image 加载失败: ${e.message}`);
      return null;
    }
  }, [pushHistory]);

  // 当前 Data1 record 变化时，同步更新 manualRecord（若未手动偏离）
  useEffect(() => {
    setManualRecord((prev) => (prev === leftRecord ? leftRecord : prev));
  }, [leftRecord]);

  // 计算右侧实际对比 record
  const rightRecord = hasData2 ? (record2 ?? 0) : manualRecord;

  // 加载两侧小图
  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    (async () => {
      const [s1, s2] = await Promise.all([
        loadSmall(leftPath, leftRecord),
        loadSmall(rightPath, rightRecord),
      ]);
      if (cancelled) return;
      setSmall1(s1);
      setSmall2(s2);
      setLoading(false);
    })();
    return () => { cancelled = true; };
  }, [leftPath, leftRecord, rightPath, rightRecord, loadSmall]);

  /** 在 canvas 上绘制一个 22×10 平面（ plane = 0/1/2 ）。 */
  const drawPlane = useCallback((data, plane, canvas) => {
    if (!canvas || !data) return;
    const width = SMALL_IMAGE_WIDTH;
    const height = SMALL_IMAGE_HEIGHT;
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    const img = ctx.createImageData(width, height);
    const offset = plane * SMALL_IMAGE_PLANE_SIZE;
    for (let i = 0; i < SMALL_IMAGE_PLANE_SIZE; i++) {
      const v = data[offset + i] ?? 0;
      const idx = i * 4;
      img.data[idx] = v;
      img.data[idx + 1] = v;
      img.data[idx + 2] = v;
      img.data[idx + 3] = 255;
    }
    ctx.putImageData(img, 0, 0);
  }, []);

  /** 计算两侧 3 个平面（共 660 字节）是否完全匹配。 */
  const match = useMemo(() => {
    if (!small1 || !small2 || small1.length < SMALL_IMAGE_COMPARE_BYTES || small2.length < SMALL_IMAGE_COMPARE_BYTES) return null;
    for (let p = 0; p < SMALL_IMAGE_PLANES; p++) {
      const off = p * SMALL_IMAGE_PLANE_SIZE;
      for (let i = 0; i < SMALL_IMAGE_PLANE_SIZE; i++) {
        if (small1[off + i] !== small2[off + i]) return false;
      }
    }
    return true;
  }, [small1, small2]);

  // 6 个 canvas 绘制
  useEffect(() => {
    for (let side = 0; side < 2; side++) {
      const data = side === 0 ? small1 : small2;
      for (let p = 0; p < 3; p++) {
        const idx = side * 3 + p;
        drawPlane(data, p, canvasRefs.current[idx]);
      }
    }
  }, [small1, small2, drawPlane]);

  /**
   * 处理 Compare Rec 输入变化。
   * 加载 Data2 时该输入只读；仅在单文件场景下可编辑。
   *
   * @param {React.ChangeEvent<HTMLInputElement>} e - 输入事件。
   */
  const handleCompareChange = (e) => {
    if (hasData2) return;
    const v = Number(e.target.value);
    if (!Number.isFinite(v)) return;
    const rec = Math.max(0, Math.min(leftRecordCount - 1, v - 1));
    setManualRecord(rec);
    pushHistory?.(`Reduction Image 对比 record → ${rec + 1}`);
  };

  const displayRecord = hasData2 ? (record2 ?? 0) + 1 : manualRecord + 1;
  const compareInputTitle = hasData2
    ? 'Data2 当前 record（已加载 Data2，Compare Rec 只读）'
    : '单文件对比 record（1 基）';

  return (
    <fieldset className="reduction-panel">
      <legend>Reduction Image</legend>
      <div className="rp-grid">
        <div className="rp-col">
          <div className="rp-col-title">1</div>
          {[0, 1, 2].map((p) => (
            <canvas
              key={`1-${p}`}
              ref={(el) => { canvasRefs.current[p] = el; }}
              className="rp-canvas"
              title={`Reduction Image 1 - Plane ${p + 1}`}
            />
          ))}
        </div>
        <div className="rp-col">
          <div className="rp-col-title">2</div>
          {[0, 1, 2].map((p) => (
            <canvas
              key={`2-${p}`}
              ref={(el) => { canvasRefs.current[3 + p] = el; }}
              className="rp-canvas"
              title={`Reduction Image 2 - Plane ${p + 1}`}
            />
          ))}
        </div>
      </div>
      <div className="rp-footer">
        <label className="rp-compare-label">
          Compare Rec:
          <input
            type="number"
            min={1}
            max={rightRecordCount || 1}
            value={Math.min(displayRecord, rightRecordCount || 1)}
            onChange={handleCompareChange}
            readOnly={hasData2}
            title={compareInputTitle}
          />
        </label>
        <span className="rp-result" data-match={match}>
          {match === null ? '—' : match ? 'Match' : 'Not Match'}
        </span>
        {loading && <span className="rp-loading">loading…</span>}
        <span
          className="rp-help"
          title="左列＝Data1 当前 record；右列＝Data2 当前 record（未加载 Data2 时可输入 Compare Rec 在同文件内另选一个 record 对比）。Match / Not Match 表示两侧 3 张 22×10 小图共 660 字节是否完全一致。"
        >
          ?
        </span>
      </div>
    </fieldset>
  );
}
