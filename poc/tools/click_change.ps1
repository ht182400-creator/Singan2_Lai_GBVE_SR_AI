Add-Type @"
using System;
using System.Runtime.InteropServices;
using System.Text;
public class W32E {
    public delegate bool EnumWindowsProc(IntPtr h, IntPtr l);
    [StructLayout(LayoutKind.Sequential)] public struct RECT { public int L, T, R, B; }
    [DllImport("user32.dll")] public static extern bool EnumWindows(EnumWindowsProc cb, IntPtr l);
    [DllImport("user32.dll")] public static extern uint GetWindowThreadProcessId(IntPtr h, out uint pid);
    [DllImport("user32.dll")] public static extern int GetWindowText(IntPtr h, StringBuilder s, int n);
    [DllImport("user32.dll")] public static extern IntPtr GetDlgItem(IntPtr h, int id);
    [DllImport("user32.dll")] public static extern bool GetWindowRect(IntPtr h, out RECT r);
    [DllImport("user32.dll")] public static extern bool SetCursorPos(int x, int y);
    [DllImport("user32.dll")] public static extern void mouse_event(uint flags, uint dx, uint dy, uint data, UIntPtr extra);
    [DllImport("user32.dll")] public static extern bool SetForegroundWindow(IntPtr h);
    [DllImport("user32.dll")] public static extern bool ShowWindow(IntPtr h, int cmd);
    public const uint MOUSEEVENTF_LEFTDOWN = 0x0002;
    public const uint MOUSEEVENTF_LEFTUP = 0x0004;
}
"@

Stop-Process -Name SINGAN2 -Force -ErrorAction SilentlyContinue
Start-Sleep -Milliseconds 800
$exe = "E:\AI_Studio\NCR_tool\Singan2_Lai_GBVE_SR_OLD\debug\SINGAN2.exe"
$work = "E:\AI_Studio\NCR_tool\Singan2_Lai_GBVE_SR_OLD\debug"
Start-Process -FilePath $exe -WorkingDirectory $work
Start-Sleep -Seconds 6

$proc = Get-Process -Name SINGAN2 -ErrorAction SilentlyContinue | Select-Object -First 1
$script:mainHwnd = [IntPtr]::Zero
$cb = [W32E+EnumWindowsProc]{ param($h, $l)
    $p2 = 0; [void][W32E]::GetWindowThreadProcessId($h, [ref]$p2)
    if ($p2 -eq $proc.Id) {
        $sb = New-Object Text.StringBuilder 256
        [void][W32E]::GetWindowText($h, $sb, 256)
        if ($sb.ToString() -match "Authentic2") { $script:mainHwnd = $h }
    }
    return $true
}
[void][W32E]::EnumWindows($cb, [IntPtr]::Zero)
Write-Host "mainHwnd=$script:mainHwnd"

[void][W32E]::ShowWindow($script:mainHwnd, 9)
[void][W32E]::SetForegroundWindow($script:mainHwnd)
Start-Sleep -Milliseconds 1000

$btn = [W32E]::GetDlgItem($script:mainHwnd, 40003)
Write-Host "btn=$btn"
if ($btn -eq [IntPtr]::Zero) { Write-Host "no btn"; exit 1 }

$r = New-Object W32E+RECT
[void][W32E]::GetWindowRect($btn, [ref]$r)
$cx = [int](($r.L + $r.R) / 2)
$cy = [int](($r.T + $r.B) / 2)
Write-Host "btn rect=($($r.L),$($r.T))-($($r.R),$($r.B)) center=($cx,$cy)"

[void][W32E]::SetCursorPos($cx, $cy)
Start-Sleep -Milliseconds 300
[void][W32E]::mouse_event([W32E]::MOUSEEVENTF_LEFTDOWN, 0, 0, 0, [UIntPtr]::Zero)
Start-Sleep -Milliseconds 150
[void][W32E]::mouse_event([W32E]::MOUSEEVENTF_LEFTUP, 0, 0, 0, [UIntPtr]::Zero)
Start-Sleep -Milliseconds 1500

Write-Host "--- windows after click ---"
$cb2 = [W32E+EnumWindowsProc]{ param($h, $l)
    $p2 = 0; [void][W32E]::GetWindowThreadProcessId($h, [ref]$p2)
    if ($p2 -eq $proc.Id) {
        $sb = New-Object Text.StringBuilder 256
        [void][W32E]::GetWindowText($h, $sb, 256)
        Write-Host ("  hwnd={0} title='{1}'" -f $h, $sb.ToString())
    }
    return $true
}
[void][W32E]::EnumWindows($cb2, [IntPtr]::Zero)
