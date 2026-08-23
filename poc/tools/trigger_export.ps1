# 通过 Win32 API 直接触发 SINGAN2.exe 的 Ren() 批量计算和 View All Result 写入 CSV
# 绕开 UI 按钮隐藏的问题
# 用法：先手动启动 debug/SINGAN2.exe + 加载好数据/ATB + 切到列表视图，然后运行此脚本
$ErrorActionPreference = 'Stop'

Add-Type @"
using System;
using System.Runtime.InteropServices;
using System.Text;
public class W {
    public delegate bool EnumWindowsProc(IntPtr h, IntPtr l);
    [DllImport("user32.dll")] public static extern bool EnumWindows(EnumWindowsProc p, IntPtr l);
    [DllImport("user32.dll")] public static extern uint GetWindowThreadProcessId(IntPtr h, out uint pid);
    [DllImport("user32.dll")] public static extern int GetWindowText(IntPtr h, StringBuilder s, int n);
    [DllImport("user32.dll")] public static extern IntPtr GetDlgItem(IntPtr h, int id);
    [DllImport("user32.dll")] public static extern IntPtr SendMessage(IntPtr h, uint msg, IntPtr wp, IntPtr lp);
    [DllImport("user32.dll")] public static extern bool PostMessage(IntPtr h, uint msg, IntPtr wp, IntPtr lp);
    [DllImport("user32.dll")] public static extern IntPtr FindWindowEx(IntPtr parent, IntPtr child, string cls, string name);
}
"@

# 找到 SINGAN2 主窗口
$target = $null
$cb = [W+EnumWindowsProc]{
  param($h, $l)
  $sb = New-Object Text.StringBuilder 256
  [void][W]::GetWindowText($h, $sb, 256)
  if ($sb.ToString() -match 'Authentic2') {
    $script:target = $h
    return $false
  }
  return $true
}
[void][W]::EnumWindows($cb, [IntPtr]::Zero)
if (-not $target) { Write-Host "未找到 SINGAN2 窗口"; exit 1 }
Write-Host "找到主窗口 hwnd=$target"

# 控件 ID 来自 WinMain.cpp 的 resource.h
# IDC_REN = 1057 (Run All / Cont.(&R))
# IDC_BUTTON_GR = 1058 (View All Result)
$IDC_REN = 1057
$IDC_BUTTON_GR = 1058

Write-Host "触发 Run All (IDC_REN=$IDC_REN)..."
$hRen = [W]::GetDlgItem([IntPtr]$target, $IDC_REN)
Write-Host "  IDC_REN 句柄: $hRen (0 = 不存在/隐藏)"

if ($hRen -eq [IntPtr]::Zero) {
  Write-Host "!! Cont.(&R) 按钮在当前进程里不存在/没创建 — 原版 debug exe 这个按钮是 NOT WS_VISIBLE 且没被显式 ShowWindow 出来"
  Write-Host "  只能改方案：直接修改内存里的 S2_gr 或 SendMessage 父窗口的 WM_COMMAND"
  Write-Host "  尝试直接 SendMessage 父窗口 WM_COMMAND..."
  [void][W]::PostMessage([IntPtr]$target, 0x0111, [IntPtr]$IDC_REN, [IntPtr]::Zero)  # WM_COMMAND = 0x111
  Start-Sleep -Seconds 2
  Write-Host "  第一次尝试：已 PostMessage(WM_COMMAND, IDC_REN)。如果是块操作可能要等更久"
} else {
  [void][W]::PostMessage($hRen, 0x00F5, [IntPtr]::Zero, [IntPtr]::Zero)  # BM_CLICK = 0xF5
  Start-Sleep -Seconds 1
  Write-Host "  已发送 BM_CLICK 给 IDC_REN"
}

# 等待批量计算完成（40 枚可能 30 秒+）
Write-Host "等待批量计算完成（最多 120 秒）..."
for ($i = 0; $i -lt 120; $i++) {
  Start-Sleep -Seconds 1
  $proc = Get-Process -Name SINGAN2 -ErrorAction SilentlyContinue
  if (-not $proc) { Write-Host "  进程已退出"; break }
  if (($i % 10) -eq 0) { Write-Host "  已等待 ${i}s..." }
}

Write-Host "触发 View All Result (IDC_BUTTON_GR=$IDC_BUTTON_GR)..."
$hGr = [W]::GetDlgItem([IntPtr]$target, $IDC_BUTTON_GR)
Write-Host "  IDC_BUTTON_GR 句柄: $hGr (0 = 不存在/隐藏)"
if ($hGr -eq [IntPtr]::Zero) {
  Write-Host "  按钮未创建 — 尝试 PostMessage WM_COMMAND 给主窗口"
  [void][W]::PostMessage([IntPtr]$target, 0x0111, [IntPtr]$IDC_BUTTON_GR, [IntPtr]::Zero)
} else {
  [void][W]::PostMessage($hGr, 0x00F5, [IntPtr]::Zero, [IntPtr]::Zero)
}

# 检查 a.csv 是否生成
$csvPath = "E:\AI_Studio\NCR_tool\Singan2_Lai_GBVE_SR_OLD\release\a.csv"
if (Test-Path $csvPath) {
  $size = (Get-Item $csvPath).Length
  Write-Host "a.csv 已生成: $csvPath (${size} bytes)"
} else {
  Write-Host "a.csv 仍不存在（导出可能失败，需要 FileSave 对话框手动选路径）"
}
