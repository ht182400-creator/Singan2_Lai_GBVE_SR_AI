$ErrorActionPreference = "Stop"
$old = "E:\AI_Studio\NCR_tool\Singan2_Lai_GBVE_SR_OLD"
$debug = Join-Path $old "debug"
$zar = Join-Path $old "ZAR"
$enc = [System.Text.Encoding]::GetEncoding(932)

$si2 = Join-Path $debug "singan2.si2"
if (Test-Path "$si2.bak2") { Remove-Item "$si2.bak2" -Force }
Copy-Item $si2 "$si2.bak2" -Force
Write-Host "si2 backed up: singan2.si2.bak2"

$coord = Join-Path $zar "X_ATB_ZAR_132006050001.txt"
$dat = Join-Path $zar "2A_DA_111017_115542.dat"
Copy-Item $coord (Join-Path $debug "X_ATB_ZAR_132006050001.txt") -Force
Copy-Item $dat (Join-Path $debug "2A_DA_111017_115542.dat") -Force
Write-Host "copied coord+dat -> debug"

$s = $enc.GetString([System.IO.File]::ReadAllBytes($si2))

$oldCoord = "E:\AI_Studio\NCR_tool\Singan2_Lai_GBVE_SR_OLD\ZAR\X_ATB_ZAR_132006050001.txt"
$newCoord = "E:\AI_Studio\NCR_tool\Singan2_Lai_GBVE_SR_OLD\debug\X_ATB_ZAR_132006050001.txt"
$s = $s.Replace($oldCoord, $newCoord)

$oldDat = "E:\AI_Studio\NCR_tool\Singan2_Lai_GBVE_SR_AI\data\2A_DA_111017_115542.dat"
$newDat = "E:\AI_Studio\NCR_tool\Singan2_Lai_GBVE_SR_OLD\debug\2A_DA_111017_115542.dat"
$s = $s.Replace($oldDat, $newDat)

[System.IO.File]::WriteAllBytes($si2, $enc.GetBytes($s))
Write-Host "si2 paths updated"

$s2 = $enc.GetString([System.IO.File]::ReadAllBytes($si2))
$lines = $s2 -split "`r?`n"
Write-Host "--- updated coord/dat lines ---"
$lines | Where-Object { $_ -match "座標ファイル|2A_DA" } | Select-Object -First 4
Write-Host "--- files in debug ---"
Get-ChildItem $debug -Filter "X_ATB_ZAR_132006050001.txt" | Select-Object Name, Length
Get-ChildItem $debug -Filter "2A_DA_111017_115542.dat" | Select-Object Name, Length
