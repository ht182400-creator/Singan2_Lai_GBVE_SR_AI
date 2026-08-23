# 诊断 SINGAN2.exe 窗口是否创建
$ErrorActionPreference = 'Stop'

Add-Type @"
using System;
using System.Runtime.InteropServices;
using System.Text;
public class W {
    public delegate bool EnumWindowsProc(IntPtr hWnd, IntPtr lParam);
    [DllImport("user32.dll")] public static extern bool EnumWindows(EnumWindowsProc p, IntPtr l);
    [DllImport("user32.dll")] public static extern uint GetWindowThreadProcessId(IntPtr h, out uint pid);
    [DllImport("user32.dll")] public static extern int GetWindowText(IntPtr h, StringBuilder s, int n);
    [DllImport("user32.dll")] public static extern bool IsWindowVisible(IntPtr h);
    [DllImport("user32.dll")] public static extern bool GetWindowRect(IntPtr h, out RECT r);
    [DllImport("user32.dll")] public static extern int GetSystemMetrics(int n);
    [DllImport("user32.dll")] public static extern bool MoveWindow(IntPtr hWnd, int x, int y, int w, int h, bool repaint);
    [DllImport("user32.dll")] public static extern bool ShowWindow(IntPtr hWnd, int cmd);
    [DllImport("user32.dll")] public static extern bool SetForegroundWindow(IntPtr hWnd);
    public struct RECT { public int Left, Top, Right, Bottom; }
}
"@

Stop-Process -Name SINGAN2 -Force -ErrorAction SilentlyContinue
Start-Sleep -Milliseconds 500

$exe = "E:\AI_Studio\NCR_tool\Singan2_Lai_GBVE_SR_OLD\release\SINGAN2.exe"
$work = "E:\AI_Studio\NCR_tool\Singan2_Lai_GBVE_SR_OLD\release"
Start-Process -FilePath $exe -WorkingDirectory $work
Start-Sleep -Seconds 4

$proc = Get-Process -Name SINGAN2 -ErrorAction SilentlyContinue | Select-Object -First 1
if (-not $proc) { Write-Host "SINGAN2 not running"; exit 1 }
Write-Host "PID=$($proc.Id) HasExited=$($proc.HasExited) MWH=$($proc.MainWindowHandle) Threads=$($proc.Threads.Count)"

$script:matches = @()
$cb = [W+EnumWindowsProc]{
  param($w, $l)
  $pid2 = 0
  [void][W]::GetWindowThreadProcessId($w, [ref]$pid2)
  if ($pid2 -eq $proc.Id) {
    $sb = New-Object Text.StringBuilder 256
    [void][W]::GetWindowText($w, $sb, 256)
    $vis = [W]::IsWindowVisible([IntPtr]$w)
    $r = New-Object W+RECT
    [void][W]::GetWindowRect([IntPtr]$w, [ref]$r)
    $script:matches += [pscustomobject]@{
      H = $w; Title = $sb.ToString(); Vis = $vis
      L = $r.Left; T = $r.Top; W = $r.Right - $r.Left; H2 = $r.Bottom - $r.Top
    }
  }
  return $true
}
[void][W]::EnumWindows($cb, [IntPtr]::Zero)

Write-Host "SINGAN2 owns $($script:matches.Count) top-level windows:"
$script:matches | Format-Table -AutoSize

$screenW = [W]::GetSystemMetrics(0)
$screenH = [W]::GetSystemMetrics(1)
Write-Host "Screen: $screenW x $screenH"

# 把所有 SINGAN2 窗口强制移回屏幕内并显示
foreach ($m in $script:matches) {
  $nw = [Math]::Min($m.W, $screenW - 40)
  $nh = [Math]::Min($m.H2, $screenH - 80)
  $nx = 0
  $ny = 0
  [void][W]::MoveWindow([IntPtr]$m.H, $nx, $ny, $nw, $nh, $true)
  [void][W]::ShowWindow([IntPtr]$m.H, 5)  # SW_SHOW
  [void][W]::SetForegroundWindow([IntPtr]$m.H)
  Write-Host "Moved window hwnd=$($m.H) to ($nx,$ny) ${nw}x${nh} title='$($m.Title)'"
}

# 等待并再次检查
Start-Sleep -Seconds 2
$script:matches = @()
[void][W]::EnumWindows($cb, [IntPtr]::Zero)
Write-Host "After move - windows: $($script:matches.Count)"
$script:matches | Format-Table -AutoSize

Stop-Process -Name SINGAN2 -Force -ErrorAction SilentlyContinue
