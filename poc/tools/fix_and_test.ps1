# 修复 singan2.si2 + GBV_DIV_H.bin 后测试启动
$ErrorActionPreference = 'Stop'
$exe = "E:\AI_Studio\NCR_tool\Singan2_Lai_GBVE_SR_OLD\release\SINGAN2.exe"
$rel = "E:\AI_Studio\NCR_tool\Singan2_Lai_GBVE_SR_OLD\release"
$old = "E:\AI_Studio\NCR_tool\Singan2_Lai_GBVE_SR_OLD"

Stop-Process -Name SINGAN2 -Force -ErrorAction SilentlyContinue
Start-Sleep -Milliseconds 800

# 1) 备份当前 si2 / div_h（如果还没备份）
$si2Bak = "$rel\singan2.si2.bak_476"
$divBak = "$rel\GBV_DIV_H.bin.bak_zero"
if (-not (Test-Path $si2Bak)) { Copy-Item "$rel\singan2.si2" $si2Bak -Force }
if (-not (Test-Path $divBak)) { Copy-Item "$rel\GBV_DIV_H.bin" $divBak -Force }
Write-Host "si2 当前: $( (Get-Item $rel\singan2.si2).Length ) bytes"
Write-Host "GBV_DIV_H 当前: $( (Get-Item $rel\GBV_DIV_H.bin).Length ) bytes"

# 2) 替换 si2 为根目录完整版 (2119 bytes)
Copy-Item "$old\singan2.si2" "$rel\singan2.si2" -Force
# 3) 复制 32KB 的 GBV_DIV_H.bin
Copy-Item "$old\GBV_DIV_H.bin" "$rel\GBV_DIV_H.bin" -Force
Write-Host "修复后 si2: $( (Get-Item $rel\singan2.si2).Length ) bytes"
Write-Host "修复后 GBV_DIV_H: $( (Get-Item $rel\GBV_DIV_H.bin).Length ) bytes"

# 4) 测试启动
$pi = Start-Process -FilePath $exe -WorkingDirectory $rel -PassThru
Start-Sleep -Seconds 4
$pi.Refresh()
Write-Host "Test: HasExited=$($pi.HasExited) ExitCode=$($pi.ExitCode)"
if (-not $pi.HasExited) {
  Get-Process -Id $pi.Id | Select-Object Id, MainWindowHandle, MainWindowTitle | Format-List
  Start-Sleep -Seconds 2
  Stop-Process -Id $pi.Id -Force
} else {
  # 看看最新的 Application 错误
  Start-Sleep -Seconds 2
  Get-WinEvent -LogName Application -MaxEvents 3 -ErrorAction SilentlyContinue | Where-Object { $_.Message -match 'SINGAN2' } | Select-Object -First 1 | Format-List TimeCreated, Message
}
