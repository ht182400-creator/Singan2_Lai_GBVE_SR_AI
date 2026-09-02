import React from 'react';
import ResultDetails from './ResultDetails.jsx';
import { S2_FUNC_NAMES } from '../utils/analysis.js';

/**
 * Graph 结果面板：把 Graph1 / Graph2 / Result Details 整合到一个清晰的容器里。
 *
 * 结构：
 *   - 顶部标题：显示当前函数列号 Fn[N] + 业务名称，并说明 Graph1/Graph2 含义
 *   - 中上：Graph1 (S2[1..32]) 与 Graph2 (ETC[1..12]) 并排，白底黑字更易读
 *   - 中下：Result Details 表格（R1–R32 判定，带名称）
 *   - 底部：简要提示条
 */
/**
 * Graph 结果面板：把 Graph1 / Graph2 / Result Details 整合到一个清晰的容器里。
 *
 * 结构：
 *   - 顶部标题：显示当前函数列号 Fn[N] + 业务名称
 *   - 中上：Graph1 (S2) 与 Graph2 (ETC) 并排
 *   - 中下：Result Details 表格（R1–R32 判定）
 *   - 底部：简要提示条
 *
 * @param {Object} props
 * @param {number} [props.fn] - 当前函数列号。
 * @param {string} [props.graph1Text] - Graph1 文本。
 * @param {string} [props.graph2Text] - Graph2 文本。
 * @param {Array} [props.resultRows] - IR1/Data1 结果行。
 * @param {Array} [props.resultRows2] - IR2/Data2 结果行。
 * @param {Function} [props.pushHistory] - 操作历史回调。
 * @param {boolean} [props.filesDiffer] - 两文件是否不同。
 * @param {boolean} [props.include2] - 是否显示 Data2。
 * @param {string[]} [props.history] - 操作历史文本，用于在 IR2 未生成时显示最近报错。
 * @param {Function} [props.onClearResult1] - 清空 Data1 Result Details。
 * @param {Function} [props.onClearResult2] - 清空 Data2 Result Details。
 */
export default function GraphResultPanel({
  fn = 1,
  graph1Text = '',
  graph2Text = '',
  resultRows = [],
  resultRows2 = null,
  pushHistory,
  filesDiffer = false,
  include2 = false,
  history = [],
  onClearResult1,
  onClearResult2,
}) {
  const fnName = fn <= 32 ? `S2[${fn}] ${S2_FUNC_NAMES[fn - 1] || ''}`.trim() : `ETC[${fn - 32}]`;
  const showSecond = resultRows2 && resultRows2.length > 0;
  const expectSecond = filesDiffer && include2 && !showSecond;
  const ir2Hint = history.slice().reverse().find((h) => /IR2|Data2|Statistics IR2|分析 Data2|Data2=/.test(h));

  return (
    <div className="graph-result-panel">
      <div
        className="grp-header"
        title={`当前绘图函数列 global_select_no = ${fn}（${fnName}）。Graph1 = S2 主分析函数 32 维，Graph2 = ETC 辅助函数 12 维。`}
      >
        <span>Graph 结果</span>
        <span className="grp-fn">Fn[{fn}] {fnName}</span>
      </div>

      <div className="grp-split">
        <fieldset className="grp-box">
          <legend title="S2[1..32]：32 维主分析函数值。每行一项，顺序对应 R1–R32。">
            Graph1 (S2)
          </legend>
          <textarea
            readOnly
            value={graph1Text || '（运行分析或 Make Graph 后显示）'}
            title="S2[1..32] 的数值列表。每行 = S2[i]，顺序对应 Result Details 的 R1–R32。"
          />
        </fieldset>

        <fieldset className="grp-box">
          <legend title="ETC[1..12]：12 维辅助函数值，用于补充判定。">
            Graph2 (ETC)
          </legend>
          <textarea
            readOnly
            value={graph2Text || '（运行分析后显示）'}
            title="ETC[1..12] 的数值列表。每行 = ETC[i]。"
          />
        </fieldset>
      </div>

      <div className={showSecond || expectSecond ? 'grp-result-split' : ''}>
        <ResultDetails pushHistory={pushHistory} rows={resultRows} title="Result Details (IR1 / Data1)" onClear={onClearResult1} />
        {showSecond && <ResultDetails pushHistory={pushHistory} rows={resultRows2} title="Result Details (IR2 / Data2)" onClear={onClearResult2} />}
        {expectSecond && (
          <fieldset className="result-details rd-missing">
            <legend>Result Details (IR2/Data2)</legend>
            <div className="rd-empty rd-warn">
              IR2 数据未生成：Statistics 批量分析未返回有效结果，请查看下方 History 面板的报错信息。
              <br />
              常见原因：Data2 路径为空、Data2 与 Data1 为同一文件，或 IR2 的 .dat/.z 文件不匹配。
              {ir2Hint && (
                <>
                  <br />
                  <span className="rd-hint">最新相关记录：{ir2Hint}</span>
                </>
              )}
            </div>
          </fieldset>
        )}
      </div>

      <div
        className="grp-help"
        title="Result Details：R1–R32 对应 S2[1..32]，每行 Value 为当前 record 的分析值，Judge = Value ≥ Thresh 则 OK，否则 NG；OK/NG 计数 = 32 项中满足条件的数量。Make Graph / Statistics 在多个 record 上批量计算后，右侧 Sheet# 列出每个取样 record 的函数值。"
      >
        提示：R1–R32 对应 S2[1..32]；OK/NG 计数 = 32 项中 Value ≥ Thresh 的数量；Sheet# 为取样 record 序号，后接该 record 的当前函数值。
      </div>
    </div>
  );
}
