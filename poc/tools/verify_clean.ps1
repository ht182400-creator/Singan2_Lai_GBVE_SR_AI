# 干净启动验证：确认 si2=476 状态下主窗口能否显示
$ErrorActionPreference = 'Continue'
Stop-Process -Name SINGAN2 -Force -ErrorAction SilentlyContinue
Start-Sleep -Milliseconds 800

$exe = "E:\AI_Studio\NCR_tool\Singan2_Lai_GBVE_SR_OLD\release\SINGAN2.exe"
$rel = "E:\AI_Studio\NCR_tool\Singan2_Lai_GBVE_SR_OLD\release"

Write-Host "== 当前文件状态 =="
Get-Item "$rel\singan2.si2" | Select-Object Name, Length, LastWriteTime
Get-Item "$rel\GBV_DIV_H.bin" | Select-Object Name, Length, LastWriteTime
Get-Item "$rel\SINGAN2.exe" | Select-Object Name, Length, LastWriteTime

# 双击式启动（用 Invoke-Item 更贴近用户操作）
Invoke-Item $exe
Start-Sleep -Seconds 6

$proc = Get-Process -Name SINGAN2 -ErrorAction SilentlyContinue | Select-Object -First 1
if (-not $proc) { Write-Host "== 进程不存在 =="; exit 1 }
Write-Host "== 进程存活 PID=$($proc.Id) =="

Add-Type @"
using System;
using System.Runtime.InteropServices;
using System.Text;
public class W {
    public delegate bool EnumWindowsProc(IntPtr h, IntPtr l);
    [DllImport("user32.dll")] public static extern bool EnumWindows(EnumWindowsProc p, IntPtr l);
    [DllImport("user32.dll")] public static extern uint GetWindowThreadProcessId(IntPtr h, out uint pid);
    [DllImport("user32.dll")] public static extern int GetWindowText(IntPtr h, StringBuilder s, int n);
    [DllImport("user32.dll")] public static extern bool IsWindowVisible(IntPtr h);
    [DllImport("user32.dll")] public static extern bool GetWindowRect(IntPtr h, out RECT r);
    [DllImport("user32.dll")] public static extern bool ShowWindow(IntPtr h, int cmd);
    [DllImport("user32.dll")] public static extern bool MoveWindow(IntPtr h, int x, int y, int w, int h, bool repaint);
    [DllImport("user32.dll")] public static extern bool SetForegroundWindow(IntPtr h);
    public struct RECT { public int Left, Top, Right, Bottom; }
}
"@
$targetPid = $proc.Id
$script:matches = @()
$cb = [W+EnumWindowsProc]{
  param($w, $l)
  $p2 = 0
  [void][W]::GetWindowThreadProcessId($w, [ref]$p2)
  if ($p2 -eq $targetPid) {
    $sb = New-Object Text.StringBuilder 256
    [void][W]::GetWindowText($w, $sb, 256)
    $vis = [W]::IsWindowVisible([IntPtr]$w)
    $r = New-Object W+RECT
    [void][W]::GetWindowRect([IntPtr]$w, [ref]$r)
    $script:matches += [pscustomobject]@{
      H = $w; Title = $sb.ToString(); Vis = $vis
      W = $r.Right - $r.Left; H2 = $r.Bottom - $r.Top
    }
  }
  return $true
}
[void][W]::EnumWindows($cb, [IntPtr]::Zero)
Write-Host "== 顶层窗口数: $($script:matches.Count) =="
$script:matches | Format-Table -AutoSize

# 尝试把可见窗口（如果有弹窗）关掉：通过发送 WM_CLOSE 到标题含 "Cannot" 的窗口
Add-Type @"
using System;
using System.Runtime.InteropServices;
public class M {
    [DllImport("user32.dll")] public static extern IntPtr SendMessage(IntPtr hWnd, uint msg, IntPtr wp, IntPtr lp);
    [DllImport("user32.dll")] public static extern bool PostMessage(IntPtr hWnd, uint msg, IntPtr wp, IntPtr lp);
}
"@
foreach ($m in $script:matches) {
  if ($m.Title -match "Cannot|Error|Open File") {
    Write-Host "关闭弹窗: '$($m.Title)'"
    [void][M]::SendMessage([IntPtr]$m.H, 0x0010, [IntPtr]::Zero, [IntPtr]::Zero)  # WM_CLOSE
  }
}
Start-Sleep -Seconds 1

# 主窗口显示
foreach ($m in $script:matches) {
  if ($m.Title -match "Authentic2") {
    Write-Host "显示主窗口: '$($m.Title)' Vis=$($m.Vis)"
    [void][W]::ShowWindow([IntPtr]$m.H, 5)   # SW_SHOW
    [void][W]::SetForegroundWindow([IntPtr]$m.H)
  }
}
Start-Sleep -Seconds 2

# 重新枚举确认
$script:matches = @()
[void][W]::EnumWindows($cb, [IntPtr]::Zero)
Write-Host "== 处理后窗口 =="
$script:matches | Format-Table -AutoSize

Stop-Process -Name SINGAN2 -Force -ErrorAction SilentlyContinue
