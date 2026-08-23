Add-Type @"
using System;
using System.Runtime.InteropServices;
using System.Text;
public class W32 {
    public delegate bool EnumWindowsProc(IntPtr h, IntPtr l);
    [DllImport("user32.dll")] public static extern bool EnumWindows(EnumWindowsProc cb, IntPtr l);
    [DllImport("user32.dll")] public static extern uint GetWindowThreadProcessId(IntPtr h, out uint pid);
    [DllImport("user32.dll")] public static extern int GetWindowText(IntPtr h, StringBuilder s, int n);
    [DllImport("user32.dll")] public static extern int GetClassName(IntPtr h, StringBuilder s, int n);
    [DllImport("user32.dll")] public static extern IntPtr FindWindow(string cls, string title);
    [DllImport("user32.dll", CharSet=CharSet.Unicode)] public static extern IntPtr FindWindowW(string cls, string title);
    [DllImport("user32.dll")] public static extern IntPtr SendMessage(IntPtr h, uint msg, IntPtr wp, IntPtr lp);
    [DllImport("user32.dll")] public static extern IntPtr SendMessage(IntPtr h, uint msg, int wp, IntPtr lp);
    [DllImport("user32.dll")] public static extern bool SetForegroundWindow(IntPtr h);
    [DllImport("user32.dll")] public static extern bool SetDlgItemText(IntPtr h, int id, string text);
    public const uint WM_COMMAND = 0x0111;
    public const uint CB_GETCOUNT = 0x0146;
    public const uint CB_GETLBTEXT = 0x0148;
    public const uint CB_SETCURSEL = 0x014E;
    public const uint CB_GETCURSEL = 0x0147;
    public const uint IDOK = 1;
}
"@

$exe = "E:\AI_Studio\NCR_tool\Singan2_Lai_GBVE_SR_OLD\debug\SINGAN2.exe"
$work = "E:\AI_Studio\NCR_tool\Singan2_Lai_GBVE_SR_OLD\debug"

# 1. ensure running
if (-not (Get-Process -Name SINGAN2 -ErrorAction SilentlyContinue)) {
    Start-Process -FilePath $exe -WorkingDirectory $work
    Start-Sleep -Seconds 4
}
$proc = Get-Process -Name SINGAN2 -ErrorAction SilentlyContinue | Select-Object -First 1
if (-not $proc) { Write-Host "FAIL: not running"; exit 1 }
Write-Host "PID=$($proc.Id)"

# 2. find main window
$script:mainHwnd = [IntPtr]::Zero
$cb = [W32+EnumWindowsProc]{ param($h, $l)
    $p2 = 0; [void][W32]::GetWindowThreadProcessId($h, [ref]$p2)
    if ($p2 -eq $proc.Id) {
        $sb = New-Object Text.StringBuilder 256
        [void][W32]::GetWindowText($h, $sb, 256)
        if ($sb.ToString() -match "Authentic2") { $script:mainHwnd = $h }
    }
    return $true
}
[void][W32]::EnumWindows($cb, [IntPtr]::Zero)
Write-Host "mainHwnd=$script:mainHwnd"
if ($script:mainHwnd -eq [IntPtr]::Zero) { Write-Host "FAIL"; exit 1 }

# 3. open Z dialog via menu IDM_Z=40003
[void][W32]::SetForegroundWindow($script:mainHwnd)
[void][W32]::SendMessage($script:mainHwnd, [W32]::WM_COMMAND, [IntPtr]40003, [IntPtr]::Zero)
Start-Sleep -Milliseconds 1000

# 4. find Z dialog
$zDlg = [W32]::FindWindow($null, "Load Coordinate Dialogue")
if ($zDlg -eq [IntPtr]::Zero) { $zDlg = [W32]::FindWindow("SINGAN2DLG", $null) }
Write-Host "Z Dlg=$zDlg"
if ($zDlg -eq [IntPtr]::Zero) {
    # maybe MessageBox blocking? list all windows of proc
    $cb2 = [W32+EnumWindowsProc]{ param($h, $l)
        $p2 = 0; [void][W32]::GetWindowThreadProcessId($h, [ref]$p2)
        if ($p2 -eq $proc.Id) {
            $sb = New-Object Text.StringBuilder 256
            [void][W32]::GetWindowText($h, $sb, 256)
            Write-Host ("  hwnd={0} title='{1}'" -f $h, $sb.ToString())
        }
        return $true
    }
    [void][W32]::EnumWindows($cb2, [IntPtr]::Zero)
    Write-Host "FAIL: Z dialog not found"
    exit 1
}

# 5. enumerate IDC_COMBO1(1269) items, find exact "18"
$count = [W32]::SendMessage($zDlg, [W32]::CB_GETCOUNT, [IntPtr]1269, [IntPtr]::Zero).ToInt32()
Write-Host "COMBO1 count=$count"
$idx18 = -1
for ($i = 0; $i -lt $count; $i++) {
    $buf = [Runtime.InteropServices.Marshal]::AllocHGlobal(128)
    [void][W32]::SendMessage($zDlg, [W32]::CB_GETLBTEXT, $i, $buf)
    $txt = [Runtime.InteropServices.Marshal]::PtrToStringAnsi($buf)
    [Runtime.InteropServices.Marshal]::FreeHGlobal($buf)
    if ($txt -eq "18") { $idx18 = $i; break }
}
Write-Host "index of '18' = $idx18"
if ($idx18 -lt 0) { Write-Host "FAIL: no '18' item"; exit 1 }

# 6. select item 18
[void][W32]::SendMessage($zDlg, [W32]::CB_SETCURSEL, $idx18, [IntPtr]::Zero)
Start-Sleep -Milliseconds 200

# 7. click Load button IDC_ZREAD=1054
[void][W32]::SendMessage($zDlg, [W32]::WM_COMMAND, [IntPtr]1054, [IntPtr]::Zero)
Write-Host "clicked Load, waiting..."
Start-Sleep -Milliseconds 1000

# 8. dismiss "Confirmation" MessageBox if any
$msg = [W32]::FindWindow($null, "Confirmation")
if ($msg -ne [IntPtr]::Zero) {
    Write-Host "found Confirmation msgbox, clicking OK"
    [void][W32]::SendMessage($msg, [W32]::WM_COMMAND, [IntPtr][W32]::IDOK, [IntPtr]::Zero)
    Start-Sleep -Milliseconds 500
}

# 9. check Z dialog closed
$z2 = [W32]::FindWindow($null, "Load Coordinate Dialogue")
Write-Host "Z Dlg after load: $z2  (0=closed=success)"
