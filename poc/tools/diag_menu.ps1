Add-Type @"
using System;
using System.Runtime.InteropServices;
using System.Text;
public class W32C {
    public delegate bool EnumWindowsProc(IntPtr h, IntPtr l);
    [DllImport("user32.dll")] public static extern bool EnumWindows(EnumWindowsProc cb, IntPtr l);
    [DllImport("user32.dll")] public static extern uint GetWindowThreadProcessId(IntPtr h, out uint pid);
    [DllImport("user32.dll")] public static extern int GetWindowText(IntPtr h, StringBuilder s, int n);
    [DllImport("user32.dll")] public static extern IntPtr GetDlgItem(IntPtr h, int id);
    [DllImport("user32.dll")] public static extern IntPtr SendMessage(IntPtr h, uint msg, IntPtr wp, IntPtr lp);
    [DllImport("user32.dll")] public static extern IntPtr SendMessage(IntPtr h, uint msg, int wp, IntPtr lp);
    [DllImport("user32.dll")] public static extern bool PostMessage(IntPtr h, uint msg, IntPtr wp, IntPtr lp);
    [DllImport("user32.dll")] public static extern bool SetForegroundWindow(IntPtr h);
    [DllImport("user32.dll")] public static extern bool ShowWindow(IntPtr h, int cmd);
    [DllImport("user32.dll")] public static extern int IsWindowEnabled(IntPtr h);
    [DllImport("user32.dll")] public static extern bool IsWindowVisible(IntPtr h);
    public const uint WM_COMMAND = 0x0111;
    public const uint BM_CLICK = 0x00F5;
}
"@

Stop-Process -Name SINGAN2 -Force -ErrorAction SilentlyContinue
Start-Sleep -Milliseconds 800

$exe = "E:\AI_Studio\NCR_tool\Singan2_Lai_GBVE_SR_OLD\debug\SINGAN2.exe"
$work = "E:\AI_Studio\NCR_tool\Singan2_Lai_GBVE_SR_OLD\debug"
Start-Process -FilePath $exe -WorkingDirectory $work
Start-Sleep -Seconds 6

$proc = Get-Process -Name SINGAN2 -ErrorAction SilentlyContinue | Select-Object -First 1
Write-Host "PID=$($proc.Id)"

$script:mainHwnd = [IntPtr]::Zero
$cb = [W32C+EnumWindowsProc]{ param($h, $l)
    $p2 = 0; [void][W32C]::GetWindowThreadProcessId($h, [ref]$p2)
    if ($p2 -eq $proc.Id) {
        $sb = New-Object Text.StringBuilder 256
        [void][W32C]::GetWindowText($h, $sb, 256)
        if ($sb.ToString() -match "Authentic2") { $script:mainHwnd = $h }
    }
    return $true
}
[void][W32C]::EnumWindows($cb, [IntPtr]::Zero)
Write-Host "mainHwnd=$script:mainHwnd"

[void][W32C]::ShowWindow($script:mainHwnd, 9)
[void][W32C]::SetForegroundWindow($script:mainHwnd)
Start-Sleep -Milliseconds 800

# diagnose Change button
$btn = [W32C]::GetDlgItem($script:mainHwnd, 40003)
$enabled = if ($btn -ne [IntPtr]::Zero) { [W32C]::IsWindowEnabled($btn) } else { -1 }
$vis = if ($btn -ne [IntPtr]::Zero) { [W32C]::IsWindowVisible($btn) } else { $false }
Write-Host "Change btn=$btn enabled=$enabled visible=$vis"

# click via BM_CLICK
if ($btn -ne [IntPtr]::Zero) {
    [void][W32C]::SendMessage($btn, [W32C]::BM_CLICK, [IntPtr]::Zero, [IntPtr]::Zero)
    Start-Sleep -Milliseconds 1500
}

# enumerate all windows of proc
Write-Host "--- all windows ---"
$cb2 = [W32C+EnumWindowsProc]{ param($h, $l)
    $p2 = 0; [void][W32C]::GetWindowThreadProcessId($h, [ref]$p2)
    if ($p2 -eq $proc.Id) {
        $sb = New-Object Text.StringBuilder 256
        [void][W32C]::GetWindowText($h, $sb, 256)
        $vis = [W32C]::IsWindowVisible([IntPtr]$h)
        $en = [W32C]::IsWindowEnabled([IntPtr]$h)
        Write-Host ("  hwnd={0} vis={1} en={2} title='{3}'" -f $h, $vis, $en, $sb.ToString())
    }
    return $true
}
[void][W32C]::EnumWindows($cb2, [IntPtr]::Zero)
