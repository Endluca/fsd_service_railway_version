#!/usr/bin/env python3
import sys
from pathlib import Path
import shutil

def dedupe_file(file_path: str) -> int:
    p = Path(file_path)
    if not p.exists():
        print(f"文件不存在: {p}")
        return 1

    # 备份原文件
    backup = p.with_suffix(p.suffix + ".bak")
    shutil.copy2(p, backup)

    seen = set()
    unique_lines = []

    # 逐行读取，按行内容（不含行尾换行符）判断“完全重复”
    with p.open("r", encoding="utf-8") as f:
        for line in f:
            name = line.rstrip("\n")
            if name not in seen:
                seen.add(name)
                unique_lines.append(name)

    # 写回去重后的内容（保持原始行内容，不做额外空格大小写处理）
    with p.open("w", encoding="utf-8") as f:
        for i, name in enumerate(unique_lines):
            f.write(name)
            if i < len(unique_lines) - 1:
                f.write("\n")

    print(f"去重完成：保留 {len(unique_lines)} 条唯一姓名。备份文件：{backup}")
    return 0

if __name__ == "__main__":
    target = sys.argv[1] if len(sys.argv) > 1 else "/Users/51talk/Desktop/code/fsd_services_timeliness_bashboard-main_副本/test.md"
    sys.exit(dedupe_file(target))