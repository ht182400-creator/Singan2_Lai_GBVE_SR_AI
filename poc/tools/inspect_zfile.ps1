# 查看 Z 坐标 txt 文件内容
$f = "E:\AI_Studio\NCR_tool\Singan2_Lai_GBVE_SR_OLD\ZAR\X_ATB_ZAR_132006050001.txt"
$enc = [System.Text.Encoding]::GetEncoding(932)
$b = [System.IO.File]::ReadAllBytes($f)
Write-Host "Size: $($b.Length) bytes"
$s = $enc.GetString($b)
$lines = $s -split "`r?`n"
Write-Host "Lines: $($lines.Count)"
Write-Host "--- head 15 lines ---"
for ($i=0; $i -lt [Math]::Min(15,$lines.Count); $i++) { Write-Host ("L{0}: {1}" -f $i, $lines[$i]) }
Write-Host "--- line 50-60 ---"
for ($i=50; $i -lt [Math]::Min(60,$lines.Count); $i++) { Write-Host ("L{0}: {1}" -f $i, $lines[$i]) }
Write-Host "--- tail 8 lines ---"
for ($i=[Math]::Max(0,$lines.Count-8); $i -lt $lines.Count; $i++) { Write-Host ("L{0}: {1}" -f $i, $lines[$i]) }
