# 修复 singan2.si2: 把 [座標ファイル] 路径改成 ZAR 里实际存在的 txt
$si2Path = "E:\AI_Studio\NCR_tool\Singan2_Lai_GBVE_SR_OLD\debug\singan2.si2"
$enc = [System.Text.Encoding]::GetEncoding(932)
$b = [System.IO.File]::ReadAllBytes($si2Path)
$s = $enc.GetString($b)
Write-Host "=== Before ==="
Write-Host $s
Write-Host ("=== Length: {0} ===" -f $b.Length)

$old = "Y:\Work\GBVM\04_Area\X_ATB_DOP_5F1906040002.bin.txt"
$new = "E:\AI_Studio\NCR_tool\Singan2_Lai_GBVE_SR_OLD\ZAR\X_ATB_ZAR_132006050001.txt"
$s2 = $s.Replace($old, $new)
Write-Host ""
Write-Host "=== After ==="
Write-Host $s2
if ($s2 -eq $s) { Write-Host "[NO CHANGE] old path not found"; exit 1 }

$bak = $si2Path + ".bak_before_coord"
Copy-Item $si2Path $bak -Force
Write-Host ("Backup: {0}" -f $bak)

$b2 = $enc.GetBytes($s2)
[System.IO.File]::WriteAllBytes($si2Path, $b2)
Write-Host ("Wrote {0} bytes" -f $b2.Length)

$b3 = [System.IO.File]::ReadAllBytes($si2Path)
$s3 = $enc.GetString($b3)
if ($s3.Contains($new)) { Write-Host "OK: new path written" } else { Write-Host "FAIL" }