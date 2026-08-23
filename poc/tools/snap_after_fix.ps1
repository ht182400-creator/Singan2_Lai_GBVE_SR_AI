# 启动 SINGAN2.exe + 截全屏 + 移动窗口回屏幕内
$ErrorActionPreference = 'Stop'
$exe = "E:\AI_Studio\NCR_tool\Singan2_Lai_GBVE_SR_OLD\release\SINGAN2.exe"
$rel = "E:\AI_Studio\NCR_tool\Singan2_Lai_GBVE_SR_OLD\release"
$out = "E:\AI_Studio\NCR_tool\Singan2_Lai_GBVE_SR_AI\poc\tools"

Stop-Process -Name SINGAN2 -Force -ErrorAction SilentlyContinue
Start-Sleep -Milliseconds 500

$pi = Start-Process -FilePath $exe -WorkingDirectory $rel -PassThru
Start-Sleep -Seconds 5
$pi.Refresh()
Write-Host "HasExited=$($pi.HasExited) ExitCode=$($pi.ExitCode) MWH=$($pi.MainWindowHandle)"

# 找 SINGAN2 进程的真实窗口（不依赖 MainWindowHandle）
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
    [DllImport("user32.dll")] public static extern int GetSystemMetrics(int n);
    [DllImport("user32.dll")] public static extern bool MoveWindow(IntPtr hWnd, int x, int y, int w, int h, bool repaint);
    [DllImport("user32.dll")] public static extern bool ShowWindow(IntPtr hWnd, int cmd);
    [DllImport("user32.dll")] public static extern bool SetForegroundWindow(IntPtr hWnd);
    [DllImport("user32.dll")] public static extern IntPtr GetDesktopWindow();
    [DllImport("user32.dll")] public static extern bool GetClientRect(IntPtr hWnd, out RECT r);
    public struct RECT { public int Left, Top, Right, Bottom; }
}
"@

$proc = Get-Process -Name SINGAN2 -ErrorAction SilentlyContinue | Select-Object -First 1
if (-not $proc) { Write-Host "SINGAN2 not running anymore"; exit 1 }
$targetPid = $proc.Id
Write-Host "SINGAN2 PID=$targetPid"

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
      L = $r.Left; T = $r.Top; R = $r.Right; B = $r.Bottom
      W = $r.Right - $r.Left; H2 = $r.Bottom - $r.Top
    }
  }
  return $true
}
[void][W]::EnumWindows($cb, [IntPtr]::Zero)

Write-Host "SINGAN2 owns $($script:matches.Count) top-level windows:"
$script:matches | Format-Table -AutoSize

$sw = [W]::GetSystemMetrics(0)
$sh = [W]::GetSystemMetrics(1)
Write-Host "Screen: $sw x $sh"

# 把所有 SINGAN2 顶层窗口（即使不可见）强制移到屏幕内并显示
foreach ($m in $script:matches) {
  $nw = [Math]::Min($m.W, $sw - 40)
  $nh = [Math]::Min($m.H2, $sh - 80)
  if ($nw -lt 200) { $nw = [Math]::Min(1280, $sw - 40) }
  if ($nh -lt 200) { $nh = [Math]::Min(800, $sh - 80) }
  [void][W]::MoveWindow([IntPtr]$m.H, 0, 0, $nw, $nh, $true)
  [void][W]::ShowWindow([IntPtr]$m.H, 5)  # SW_SHOW
  [void][W]::SetForegroundWindow([IntPtr]$m.H)
  Write-Host "Moved hwnd=$($m.H) to (0,0) ${nw}x${nh} title='$($m.Title)'"
}
Start-Sleep -Seconds 2

# 截全屏
Add-Type -AssemblyName System.Drawing
Add-Type -AssemblyName System.Windows.Forms
$bmp = New-Object System.Drawing.Bitmap($sw, $sh)
$g = [System.Drawing.Graphics]::FromImage($bmp)
$g.CopyFromScreen(0, 0, 0, 0, $bmp.Size)
$bmp.Save("$out\fullscreen_after_fix.png", [System.Drawing.Imaging.ImageFormat]::Png)
$g.Dispose(); $bmp.Dispose()
Write-Host "saved fullscreen_after_fix.png"

# 只截 SINGAN2 主窗口
$proc.Refresh()
if ($proc.MainWindowHandle -ne 0) {
  $r = New-Object W+RECT
  [void][W]::GetWindowRect([IntPtr]$proc.MainWindowHandle, [ref]$r)
  $bmp2 = New-Object System.Drawing.Bitmap($r.Right - $r.Left, $r.Bottom - $r.Top)
  $g2 = [System.Drawing.Graphics]::FromImage($bmp2)
  $g2.CopyFromScreen($r.Left, $r.Top, 0, 0, $bmp2.Size)
  $bmp2.Save("$out\singan2_after_fix.png", [System.Drawing.Imaging.ImageFormat]::Png)
  $g2.Dispose(); $bmp2.Dispose()
  Write-Host "saved singan2_after_fix.png"
}

Stop-Process -Name SINGAN2 -Force -ErrorAction SilentlyContinue
