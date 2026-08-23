Add-Type @"
using System;
using System.Runtime.InteropServices;
using System.Text;
public class W32F {
    public delegate bool EnumWindowsProc(IntPtr h, IntPtr l);
    [StructLayout(LayoutKind.Sequential)] public struct RECT { public int L, T, R, B; }
    [DllImport("user32.dll")] public static extern bool EnumWindows(EnumWindowsProc cb, IntPtr l);
    [DllImport("user32.dll")] public static extern uint GetWindowThreadProcessId(IntPtr h, out uint pid);
    [DllImport("user32.dll")] public static extern int GetWindowText(IntPtr h, StringBuilder s, int n);
    [DllImport("user32.dll")] public static extern bool IsWindowVisible(IntPtr h);
    [DllImport("user32.dll")] public static extern bool IsIconic(IntPtr h);
    [DllImport("user32.dll")] public static extern bool GetWindowRect(IntPtr h, out RECT r);
    [DllImport("user32.dll")] public static extern bool ShowWindow(IntPtr h, int cmd);
    [DllImport("user32.dll")] public static extern int GetSystemMetrics(int n);
    [DllImport("user32.dll")] public static extern bool MoveWindow(IntPtr hWnd, int x, int y, int w, int hgt, bool r);
    [DllImport("user32.dll")] public static extern bool SetForegroundWindow(IntPtr h);
}
"@

$proc = Get-Process -Name SINGAN2 -ErrorAction SilentlyContinue | Select-Object -First 1
if (-not $proc) { Write-Host "NOT RUNNING"; exit }
Write-Host "PID=$($proc.Id)"
$sw = [W32F]::GetSystemMetrics(0)
$sh = [W32F]::GetSystemMetrics(1)
Write-Host "Screen=$sw x $sh"

$cb = [W32F+EnumWindowsProc]{ param($h, $l)
    $p2 = 0; [void][W32F]::GetWindowThreadProcessId($h, [ref]$p2)
    if ($p2 -eq $proc.Id) {
        $sb = New-Object Text.StringBuilder 256
        [void][W32F]::GetWindowText($h, $sb, 256)
        $vis = [W32F]::IsWindowVisible([IntPtr]$h)
        $ico = [W32F]::IsIconic([IntPtr]$h)
        $r = New-Object W32F+RECT
        [void][W32F]::GetWindowRect([IntPtr]$h, [ref]$r)
        Write-Host ("hwnd={0} vis={1} ico={2} rect=({3},{4})-({5},{6}) w={7} h={8} title='{9}'" -f $h, $vis, $ico, $r.L, $r.T, $r.R, $r.B, ($r.R-$r.L), ($r.B-$r.T), $sb.ToString())
    }
    return $true
}
[void][W32F]::EnumWindows($cb, [IntPtr]::Zero)

# 移动主窗口到可见区域（如果不在屏幕内）
$script:mainHwnd = [IntPtr]::Zero
$cb2 = [W32F+EnumWindowsProc]{ param($h, $l)
    $p2 = 0; [void][W32F]::GetWindowThreadProcessId($h, [ref]$p2)
    if ($p2 -eq $proc.Id) {
        $sb = New-Object Text.StringBuilder 256
        [void][W32F]::GetWindowText($h, $sb, 256)
        if ($sb.ToString() -match "Authentic2") { $script:mainHwnd = $h }
    }
    return $true
}
[void][W32F]::EnumWindows($cb2, [IntPtr]::Zero)
if ($script:mainHwnd -ne [IntPtr]::Zero) {
    [void][W32F]::ShowWindow($script:mainHwnd, 9)
    [void][W32F]::MoveWindow($script:mainHwnd, 0, 0, [Math]::Min(1400, $sw), [Math]::Min(1050, $sh), $true)
    [void][W32F]::SetForegroundWindow($script:mainHwnd)
    Write-Host "moved main window to (0,0) $([Math]::Min(1400,$sw))x$([Math]::Min(1050,$sh))"
}
