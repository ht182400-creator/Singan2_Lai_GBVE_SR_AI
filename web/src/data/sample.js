// 真实模拟数据（离线可跑，无后端时也能展示）
// 与 MFC 原版默认值同构。

export const sampleS2 = [
  12, 15, 22, 38, 65, 92, 130, 154,
  162, 154, 130, 92, 65, 38, 22, 15,
];

export const sampleResults = [
  { name: 'Sample01', ver: 'OK', le: 0.12, se: 0.05, irAdd: 0, gAdd: 0, binaryAdd: 0, speed: 0.95 },
  { name: 'Sample02', ver: 'OK', le: 0.15, se: 0.07, irAdd: 0, gAdd: 0, binaryAdd: 0, speed: 0.92 },
  { name: 'Sample03', ver: 'NG', le: 0.32, se: 0.12, irAdd: 1, gAdd: 1, binaryAdd: 0, speed: 0.74 },
  { name: 'Sample04', ver: 'OK', le: 0.10, se: 0.04, irAdd: 0, gAdd: 0, binaryAdd: 0, speed: 0.96 },
  { name: 'Sample05', ver: 'OK', le: 0.18, se: 0.06, irAdd: 0, gAdd: 0, binaryAdd: 0, speed: 0.88 },
];

// 真币图 ASCII（16×16 模拟矩阵）
export const trueMatrixLines = [
  '....##....##......',
  '...####..####.....',
  '...##########.....',
  '....########......',
  '......####........',
  '.....######.......',
  '....########......',
  '....##....##......',
  '...###....###.....',
  '..####....####....',
  '.#####....#####...',
  '..####....####....',
  '...###....###.....',
  '....##....##......',
  '.....####.........',
  '......##..........',
];

export const reduction1Lines = trueMatrixLines.map((row) => row.replace(/#/g, 'X'));
export const reduction2Lines = trueMatrixLines.map((row) => row.replace(/#/g, '+'));
