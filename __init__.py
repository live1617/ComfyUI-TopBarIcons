# -*- coding: utf-8 -*-
"""
ComfyUI-TopBarIcons —— 顶部图标管理器

纯前端插件：
  * 不注册任何自定义节点（NODE_CLASS_MAPPINGS 为空）
  * 只通过 WEB_DIRECTORY 下发一个前端扩展 web/topbar-icons.js
  * 所有配置存在浏览器 localStorage（立即生效，无需重启 ComfyUI）

版本号以 pyproject.toml 的 [project] version 为唯一来源；
读取失败时回退到 pyproject 里写的同一个值（发版时记得两边一起改）。
"""

import os

NODE_CLASS_MAPPINGS = {}
NODE_DISPLAY_NAME_MAPPINGS = {}

# 必须保留，否则前端 JS 不会被下发
WEB_DIRECTORY = "./web"

_FALLBACK_VERSION = "1.0.0"


def _read_version():
    """从 pyproject.toml 读版本号，读不到就用回退值。"""
    try:
        import re

        path = os.path.join(os.path.dirname(os.path.abspath(__file__)), "pyproject.toml")
        with open(path, "r", encoding="utf-8") as f:
            m = re.search(r'^\s*version\s*=\s*"([^"]+)"', f.read(), re.M)
        if m:
            return m.group(1)
    except Exception:
        pass
    return _FALLBACK_VERSION


__version__ = _read_version()

__all__ = [
    "NODE_CLASS_MAPPINGS",
    "NODE_DISPLAY_NAME_MAPPINGS",
    "WEB_DIRECTORY",
    "__version__",
]

print(
    "\n[TopBarIcons] 顶部图标管理器 v{} 已加载 -> 点击工具条右侧「齿轮」按钮开始管理\n".format(
        __version__
    )
)
