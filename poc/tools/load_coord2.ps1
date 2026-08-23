Add-Type @"
using System;
using System.Runtime.InteropServices;
using System.Text;
public class W32B {
    public delegate bool EnumWindowsProc(IntPtr h, IntPtr l);
    [DllImport("user32.dll")] public static extern bool EnumWindows(EnumWindowsProc cb, IntPtr l);
    [DllImport("user32.dll")] public static extern uint GetWindowThreadProcessId(IntPtr h, out uint pid);
    [DllImport("user32.dll")] public static extern int GetWindowText(IntPtr h, StringBuilder s, int n);
    [DllImport("user32.dll")] public static extern IntPtr FindWindow(string cls, string title);
    [DllImport("user32.dll")] public static extern IntPtr FindWindowEx(IntPtr parent, IntPtr after, string cls, string title);
    [DllImport("user32.dll")] public static extern IntPtr GetDlgItem(IntPtr h, int id);
    [DllImport("user32.dll")] public static extern IntPtr SendMessage(IntPtr h, uint msg, IntPtr wp, IntPtr lp);
    [DllImport("user32.dll")] public static extern IntPtr SendMessage(IntPtr h, uint msg, int wp, IntPtr lp);
    [DllImport("user32.dll")] public static extern bool PostMessage(IntPtr h, uint msg, IntPtr wp, IntPtr lp);
    [DllImport("user32.dll")] public static extern bool SetForegroundWindow(IntPtr h);
    [DllImport("user32.dll")] public static extern bool ShowWindow(IntPtr h, int cmd);
    [DllImport("user32.dll")] public static extern bool IsWindowVisible(IntPtr h);
    [DllImport("user32.dll")] public static extern bool IsWindow(IntPtr h);
    [DllImport("user32.dll")] public static extern int GetWindowTextLength(IntPtr h);
    public const uint WM_COMMAND = 0x0111;
    public const uint BM_CLICK = 0x00F5;
    public const uint WM_CLOSE = 0x0010;
    public const uint CB_GETCOUNT = 0x0146;
    public const uint CB_GETLBTEXT = 0x0148;
    public const uint CB_SETCURSEL = 0x014E;
    public const uint IDOK = 1;
    public const uint WM_GETTEXT = 0x000D;
}
"@

$exe = "E:\AI_Studio\NCR_tool\Singan2_Lai_GBVE_SR_OLD\debug\SINGAN2.exe"
$work = "E:\AI_Studio\NCR_tool\Singan2_Lai_GBVE_SR_OLD\debug"

if (-not (Get-Process -Name SINGAN2 -ErrorAction SilentlyContinue)) {
    Start-Process -FilePath $exe -WorkingDirectory $work
    Start-Sleep -Seconds 5
}
$proc = Get-Process -Name SINGAN2 -ErrorAction SilentlyContinue | Select-Object -First 1
if (-not $proc) { Write-Host "FAIL: not running"; exit 1 }
Write-Host "PID=$($proc.Id)"

$script:mainHwnd = [IntPtr]::Zero
$cb = [W32B+EnumWindowsProc]{ param($h, $l)
    $p2 = 0; [void][W32B]::GetWindowThreadProcessId($h, [ref]$p2)
    if ($p2 -eq $proc.Id) {
        $sb = New-Object Text.StringBuilder 256
        [void][W32B]::GetWindowText($h, $sb, 256)
        if ($sb.ToString() -match "Authentic2") { $script:mainHwnd = $h }
    }
    return $true
}
[void][W32B]::EnumWindows($cb, [IntPtr]::Zero)
Write-Host "mainHwnd=$script:mainHwnd"
if ($script:mainHwnd -eq [IntPtr]::Zero) { Write-Host "FAIL"; exit 1 }

[void][W32B]::ShowWindow($script:mainHwnd, 9)
[void][W32B]::SetForegroundWindow($script:mainHwnd)
Start-Sleep -Milliseconds 500

# Try method A: BM_CLICK the Change button (IDM_Z=40003)
$btn = [W32B]::GetDlgItem($script:mainHwnd, 40003)
Write-Host "Change button=$btn"
if ($btn -ne [IntPtr]::Zero) {
    [void][W32B]::SendMessage($btn, [W32B]::BM_CLICK, [IntPtr]::Zero, [IntPtr]::Zero)
    Start-Sleep -Milliseconds 1200
}

$zDlg = [W32B]::FindWindow($null, "Load Coordinate Dialogue")
Write-Host "after BM_CLICK, Z Dlg=$zDlg"

if ($zDlg -eq [IntPtr]::Zero) {
    # Try method B: PostMessage WM_COMMAND 40003
    Write-Host "trying PostMessage WM_COMMAND 40003"
    [void][W32B]::PostMessage($script:mainHwnd, [W32B]::WM_COMMAND, [IntPtr]40003, [IntPtr]::Zero)
    Start-Sleep -Milliseconds 1200
    $zDlg = [W32B]::FindWindow($null, "Load Coordinate Dialogue")
    Write-Host "after PostMessage, Z Dlg=$zDlg"
}

if ($zDlg -eq [IntPtr]::Zero) {
    Write-Host "FAIL: Z dialog still not open"
    exit 1
}

# enumerate combo items
$count = [W32B]::SendMessage($zDlg, [W32B]::CB_GETCOUNT, [IntPtr]1269, [IntPtr]::Zero).ToInt32()
Write-Host "COMBO1 count=$count"
$idx18 = -1
for ($i = 0; $i -lt $count; $i++) {
    $buf = [Runtime.InteropServices.Marshal]::AllocHGlobal(128)
    [void][W32B]::SendMessage($zDlg, [W32B]::CB_GETLBTEXT, $i, $buf)
    $txt = [Runtime.InteropServices.Marshal]::PtrToStringAnsi($buf)
    [Runtime.InteropServices.Marshal]::FreeHGlobal($buf)
    if ($txt -eq "18") { $idx18 = $i; break }
}
Write-Host "index of '18' = $idx18"

if ($idx18 -lt 0) {
    # maybe items are different, print all
    for ($i = 0; $i -lt $count; $i++) {
        $buf = [Runtime.InteropServices.Marshal]::AllocHGlobal(128)
        [void][W32B]::SendMessage($zDlg, [W32B]::CB_GETLBTEXT, $i, $buf)
        $txt = [Runtime.InteropServices.Marshal]::PtrToStringAnsi($buf)
        [Runtime.InteropServices.Marshal]::FreeHGlobal($buf)
        Write-Host "  [$i]=$txt"
    }
    exit 1
}

[void][W32B]::SendMessage($zDlg, [W32B]::CB_SETCURSEL, $idx18, [IntPtr]::Zero)
Start-Sleep -Milliseconds 300

# click Load (IDC_ZREAD=1054)
[void][W32B]::SendMessage($zDlg, [W32B]::WM_COMMAND, [IntPtr]1054, [IntPtr]::Zero)
Write-Host "clicked Load"
Start-Sleep -Milliseconds 1500

# dismiss Confirmation
$msg = [W32B]::FindWindow($null, "Confirmation")
if ($msg -ne [IntPtr]::Zero) {
    Write-Host "dismissing Confirmation"
    [void][W32B]::SendMessage($msg, [W32B]::WM_COMMAND, [IntPtr][W32B]::IDOK, [IntPtr]::Zero)
    Start-Sleep -Milliseconds 600
}

$z2 = [W32B]::FindWindow($null, "Load Coordinate Dialogue")
Write-Host "Z Dlg after load: $z2 (0=closed=success)"
