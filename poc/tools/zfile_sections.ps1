# 查看 Z 坐标 txt 文件的段标题与行数分布
$f = "E:\AI_Studio\NCR_tool\Singan2_Lai_GBVE_SR_OLD\ZAR\X_ATB_ZAR_132006050001.txt"
$enc = [System.Text.Encoding]::GetEncoding(932)
$b = [System.IO.File]::ReadAllBytes($f)
$s = $enc.GetString($b)
$lines = $s -split "`r?`n"

Write-Host ("Total lines: {0}" -f $lines.Count)
Write-Host "--- section header lines (containing 【) ---"
$dataLine = 0
for ($i=0; $i -lt $lines.Count; $i++) {
  $l = $lines[$i].Trim()
  if ($l -like "*【*") {
    $head = $l.Substring(0, [Math]::Min(40, $l.Length))
    Write-Host ("L{0} [dataLines={1}]: {2}" -f $i, $dataLine, $head)
    $dataLine = 0
  } elseif ($l -ne "") {
    $dataLine++
  }
}
Write-Host ("Last section dataLines: {0}" -f $dataLine)
