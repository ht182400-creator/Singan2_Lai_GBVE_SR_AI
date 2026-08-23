# 用原版 debug/SINGAN2.exe 测试，看是否能显示完整界面
$ErrorActionPreference = 'Continue'
Stop-Process -Name SINGAN2 -Force -ErrorAction SilentlyContinue
Start-Sleep -Milliseconds 800

$exe = "E:\AI_Studio\NCR_tool\Singan2_Lai_GBVE_SR_OLD\debug\SINGAN2.exe"
$work = "E:\AI_Studio\NCR_tool\Singan2_Lai_GBVE_SR_OLD\debug"

Write-Host "启动原版: $exe"
$pi = Start-Process -FilePath $exe -WorkingDirectory $work -PassThru
Start-Sleep -Seconds 5
$pi.Refresh()
Write-Host "HasExited=$($pi.HasExited) ExitCode=$($pi.ExitCode) MWH=$($pi.MainWindowHandle)"
if (-not $pi.HasExited) {
  $proc = Get-Process -Id $pi.Id -ErrorAction SilentlyContinue
  if ($proc) { $proc | Select-Object Id, MainWindowTitle, MainWindowHandle | Format-List }
  Start-Sleep -Seconds 2
  Stop-Process -Id $pi.Id -Force -ErrorAction SilentlyContinue
}
