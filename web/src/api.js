// M3 HTTP API 客户端封装。
// 端点（server/server.cpp）：
//   GET  /health
//   POST /api/analyze-path   {dat_path, zfile_path, record, kin, country}
//   POST /api/analyze        multipart: dat=file, record/kin/country/zfile_path
//
// 返回结构：{ s2:[...], etc:[...] } 或 { error:"..." }

export async function health() {
  const r = await fetch('/health')
  return r.json()
}

// 以本地路径方式分析（联调/审阅最常用）
export async function analyzeByPath({ datPath, zfilePath, record = 0, kin = 1, country = 0 }) {
  const r = await fetch('/api/analyze-path', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      dat_path: datPath,
      zfile_path: zfilePath,
      record,
      kin,
      country
    })
  })
  const data = await r.json()
  if (!r.ok) throw new Error(data.error || `HTTP ${r.status}`)
  return data
}

// 多部件上传 .dat 分析
export async function analyzeUpload({ file, zfilePath, record = 0, kin = 1, country = 0 }) {
  const fd = new FormData()
  fd.append('dat', file)
  fd.append('record', String(record))
  fd.append('kin', String(kin))
  fd.append('country', String(country))
  if (zfilePath) fd.append('zfile_path', zfilePath)
  const r = await fetch('/api/analyze', { method: 'POST', body: fd })
  const data = await r.json()
  if (!r.ok) throw new Error(data.error || `HTTP ${r.status}`)
  return data
}
