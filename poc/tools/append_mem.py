import os
from datetime import date
mem_dir = r"E:\AI_Studio\NCR_tool\Singan2_Lai_GBVE_SR_OLD\.codebuddy\memory"
os.makedirs(mem_dir, exist_ok=True)
today = date.today().isoformat()
f = os.path.join(mem_dir, today + ".md")
note = """\n### Singan2 日文乱码修复 (ftfy + /c 65001) 2026-08-22\n- resource.rc 之前被双重编码损坏 (UTF-8 → GBK → UTF-8 mojibake)，导致 Setting 对话框等显示 `烒?粥?烒?` 这种乱码\n- 用 ftfy.fix_text() 恢复大部分内容，写回 UTF-8 (无 BOM)\n- vcxproj 用 `/c 65001` 让 rc.exe 按 UTF-8 解读 UTF-8 源文件\n- ftfy 恢复不完美：部分字符如 `"WM乮20仏20乯"` 应为 `"WM(20×20)"`，但已是合法 Unicode，运行时中文 Windows 用 cp936 字体渲染\n- a.csv 现在 OK：Z 文件 Load 成功，坐标填满，第 1 列 `枚目` 正常 UTF-8\n- 备份：resource.rc.ftfy_bak, resource.rc.bak4\n- 字体：FONT 9 用 ASCII `MS PGothic`，FONT 8 用 `MS Mincho`（避开 RC 解析日文字体名问题）\n"""
if not os.path.exists(f):
    open(f, "w", encoding="utf-8").write(f"## {today}\n")
open(f, "a", encoding="utf-8").write(note)
print("appended:", f)