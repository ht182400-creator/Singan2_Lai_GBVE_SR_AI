# 枚举 SINGAN2 进程的所有顶层窗口（含不可见）
$ErrorActionPreference = 'Stop'
Stop-Process -Name SINGAN2 -Force -ErrorAction SilentlyContinue
Start-Sleep -Milliseconds 600

$exe = "E:\AI_Studio\NCR_tool\Singan2_Lai_GBVE_SR_OLD\release\SINGAN2.exe"
$rel = "E:\AI_Studio\NCR_tool\Singan2_Lai_GBVE_SR_OLD\release"
$pi = Start-Process -FilePath $exe -WorkingDirectory $rel -PassThru
Start-Sleep -Seconds 5
$pi.Refresh()
Write-Host "PID=$($pi.Id) HasExited=$($pi.HasExited)"

if ($pi.HasExited) { Write-Host "ExitCode=$($pi.ExitCode)"; exit 1 }

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
    [DllImport("user32.dll")] public static extern bool GetClientRect(IntPtr h, out RECT r);
    [DllImport("user32.dll")] public static extern int GetWindowLong(IntPtr h, int idx);
    public struct RECT { public int Left, Top, Right, Bottom; }
}
"@

$targetPid = $pi.Id
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
    $style = [W]::GetWindowLong([IntPtr]$w, -16)  # GWL_STYLE
    $exstyle = [W]::GetWindowLong([IntPtr]$w, -20)
    $script:matches += [pscustomobject]@{
      H = $w; Title = $sb.ToString(); Vis = $vis
      L = $r.Left; T = $r.Top; R = $r.Right; B = $r.Bottom
      W = $r.Right - $r.Left; H2 = $r.Bottom - $r.Top
      Style = ("0x{0:X8}" -f ($style -band 0xFFFFFFFF))
      ExStyle = ("0x{0:X8}" -f ($exstyle -band 0xFFFFFFFF))
    }
  }
  return $true
}
[void][W]::EnumWindows($cb, [IntPtr]::Zero)

Write-Host "SINGAN2 顶层窗口数: $($script:matches.Count)"
$script:matches | Format-Table -AutoSize

Stop-Process -Name SINGAN2 -Force -ErrorAction SilentlyContinue
