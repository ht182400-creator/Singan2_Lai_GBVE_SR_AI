/**
 * GASOTI 真币图文本区面板。
 * 对应原版 resource.rc：IDC_ZAHYO(629,269) + IDC_GASOTI(629,280,180,61)，
 * 以及右侧第二组 IDC_ZAHYO2(809,269) + IDC_GASOTI2(811,280,179,60)。
 * 双栏并排，Coordinate 行共用一行以压缩高度，避免覆盖下方 Operation。
 */
import React from 'react';

export default function GasotiPanel() {
  const leftData = [
    "(36,28)<-->(56,48 ) Black  0, White  0",
    "5D 6B 6D 6F 65 5B 6B 5E 5B 71 7B 7D 3F 4F",
    "65 7B 6F 6D 73 6D 6F 5F 79 7D 6D 55 4F 4F",
    "69 73 71 69 6F 6B 6B 6D 73 73 6B 4B 4B 4C",
    "63 71 71 73 71 73 6D 75 7F 6D 61 47 37 4B",
    "5D 6D 5B 69 65 69 6D 6F 73 77 73 69 4B 4C"
  ].join("\n");

  const rightData = [
    "(36,28)<-->(56,48 ) Black  0, White  0",
    "77 7D 77 77 83 81 87 89 83 73 69 5D 67 4C",
    "6D 65 83 79 79 7F 7F 85 91 83 7B 6B 6B 4C",
    "67 7B 7D 7D 7B 7B 87 8B 8B 75 77 5D 5F 4C",
    "65 77 7D 7F 7D 75 83 83 8B 85 7F 6F 6F 4C",
    "6B 7D 7B 83 77 79 89 83 81 7B 6B 6F 6F 4C"
  ].join("\n");

  return (
    <fieldset className="gasoti-panel">
      <legend>Genuine Note (GASOTI)</legend>
      <div className="gasoti-head">
        <span className="bs-lbl">Coordinate</span>
        <input className="gasoti-edit" defaultValue="85901.txt" readOnly />
        <span className="bs-lbl">Coordinate</span>
        <input className="gasoti-edit" defaultValue="85901.txt" readOnly />
      </div>
      <div className="gasoti-columns">
        <div className="gasoti-col">
          <textarea className="gasoti-area" defaultValue={leftData} readOnly />
        </div>
        <div className="gasoti-col">
          <textarea className="gasoti-area" defaultValue={rightData} readOnly />
        </div>
      </div>
    </fieldset>
  );
}
