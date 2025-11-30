# py_imports.py
# 轻量 Python import & symbol 提取器
# - 支持:
#   - 顶层 import / from import
#   - 顶层函数
#   - 顶层类
#   - 类中方法: 以 ClassName.method 命名
#
# 输出结构:
# {
#   "file": "...",
#   "lang": "py",
#   "imports": [
#       {"source": "pkg", "specifiers": ["name", "*", ...]},
#       ...
#   ],
#   "exports": [
#       {"name": "foo", "type": "function", "loc": {"line":1,"column":0}},
#       {"name": "Bar", "type": "class", "loc": {...}},
#       {"name": "Bar.method", "type": "method", "loc": {...}},
#       ...
#   ],
#   "meta": { "parseMs": 3 }
# }

import ast
import json
import os
import sys
import time


def loc_of(node):
    return {
        "line": int(getattr(node, "lineno", 1)),
        "column": int(getattr(node, "col_offset", 0)),
    }


def handle_imports(node, imports):
    # import x, y as z
    if isinstance(node, ast.Import):
        for alias in node.names:
            source = alias.name  # 原始模块名
            imports.append({
                "source": source,
                "specifiers": ["*"],  # 对简单 import 视作整模块
            })

    # from pkg import a, b as c
    elif isinstance(node, ast.ImportFrom):
        # level > 0 表示相对导入，这里直接保留为相对形式
        if node.level and node.module:
            # 形如 ".utils" -> ".utils"
            source = "." * node.level + (node.module or "")
        elif node.level and not node.module:
            # 形如 "from . import x"
            source = "." * node.level
        else:
            source = node.module or ""

        specs = [alias.name for alias in node.names]
        imports.append({
            "source": source,
            "specifiers": specs,
        })


def extract(file_path: str):
    start = time.time()
    with open(file_path, "r", encoding="utf-8") as f:
        code = f.read()

    try:
        tree = ast.parse(code, filename=file_path)
    except SyntaxError:
        return {
            "file": file_path,
            "lang": "py",
            "imports": [],
            "exports": [],
            "meta": {"parseMs": int((time.time() - start) * 1000), "syntaxError": True},
        }

    imports = []
    exports = []

    for node in tree.body:
        # --- imports ---
        if isinstance(node, (ast.Import, ast.ImportFrom)):
            handle_imports(node, imports)
            continue

        # --- 顶层函数 ---
        if isinstance(node, ast.FunctionDef):
            exports.append({
                "name": node.name,
                "type": "function",
                "loc": loc_of(node),
            })
            continue

        # --- 顶层类 + 类方法 ---
        if isinstance(node, ast.ClassDef):
            class_name = node.name

            # 类本身
            exports.append({
                "name": class_name,
                "type": "class",
                "loc": loc_of(node),
            })

            # 类体里的方法：ClassName.method
            for item in node.body:
                if isinstance(item, ast.FunctionDef):
                    exports.append({
                        "name": f"{class_name}.{item.name}",
                        "type": "method",
                        "loc": loc_of(item),
                    })

            continue

    return {
        "file": file_path,
        "lang": "py",
        "imports": imports,
        "exports": exports,
        "meta": {"parseMs": int((time.time() - start) * 1000)},
    }


def main():
    if len(sys.argv) < 2:
        print(json.dumps({
            "error": "missing file path",
        }))
        return

    file_path = sys.argv[1]
    # 防守一下：保证是绝对路径，方便前端/TS 那边用
    if not os.path.isabs(file_path):
        file_path = os.path.abspath(file_path)

    result = extract(file_path)
    print(json.dumps(result, ensure_ascii=False))


if __name__ == "__main__":
    main()
