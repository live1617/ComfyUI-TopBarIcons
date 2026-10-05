# -*- coding: utf-8 -*-
"""
ComfyUI-TopBarIcons —— 顶部图标管理器

纯前端插件：
  * 不注册任何自定义节点（NODE_CLASS_MAPPINGS 为空）
  * 只通过 WEB_DIRECTORY 下发一个前端扩展 web/topbar-icons.js
  * 配置默认保存在插件目录的 config.json（换浏览器 / 换设备都通用），
    后端接口不可用时自动回退到浏览器 localStorage。

版本号以 pyproject.toml 的 [project] version 为唯一来源；
读取失败时回退到 pyproject 里写的同一个值（发版时记得两边一起改）。
"""

import json
import os
import re

NODE_CLASS_MAPPINGS = {}
NODE_DISPLAY_NAME_MAPPINGS = {}

# 必须保留，否则前端 JS 不会被下发
WEB_DIRECTORY = "./web"

_HERE = os.path.dirname(os.path.abspath(__file__))
CONFIG_FILE = os.path.join(_HERE, "config.json")

_FALLBACK_VERSION = "1.1.1"

# 允许写入 config.json 的字段白名单（防止把任意数据写进磁盘）
_BOOL_KEYS = ("iconOnly", "compact", "wide", "gearVisible")
_GEAR_POS = ("inner", "tr", "br")


def _read_version():
    """从 pyproject.toml 读版本号，读不到就用回退值。"""
    try:
        with open(os.path.join(_HERE, "pyproject.toml"), "r", encoding="utf-8") as f:
            m = re.search(r'^\s*version\s*=\s*"([^"]+)"', f.read(), re.M)
        if m:
            return m.group(1)
    except Exception:
        pass
    return _FALLBACK_VERSION


def _clean_exclude(value):
    """排除规则：只接受字符串数组，去重并限制条数/长度。"""
    if not isinstance(value, list):
        return []
    out = []
    for item in value[:50]:
        if not isinstance(item, str):  # 只接受字符串选择器
            continue
        s = item.strip()
        if s and len(s) <= 200 and s not in out:
            out.append(s)
    return out


def _sanitize(data):
    """只保留白名单字段，避免把任意数据写进磁盘。"""
    if not isinstance(data, dict):
        return {}
    out = {"hidden": {}, "version": 1}
    hidden = data.get("hidden")
    if isinstance(hidden, dict):
        for k, v in hidden.items():
            k = str(k)
            if v and 0 < len(k) <= 300:
                out["hidden"][k] = True
    for b in _BOOL_KEYS:
        out[b] = bool(data.get(b, False))
    gp = data.get("gearPos", "inner")
    out["gearPos"] = gp if gp in _GEAR_POS else "inner"
    out["exclude"] = _clean_exclude(data.get("exclude"))
    return out


def _register_routes():
    """注册两个 HTTP 接口：GET 读配置 / POST 写配置（存插件目录 config.json）。"""
    try:
        from aiohttp import web
        from server import PromptServer

        server = PromptServer.instance

        @server.routes.get("/topbar-icons/config")
        async def tbim_get_config(request):
            try:
                with open(CONFIG_FILE, "r", encoding="utf-8") as f:
                    cfg = json.load(f)
                if not isinstance(cfg, dict):
                    cfg = None
            except FileNotFoundError:
                cfg = None
            except Exception as exc:  # 文件损坏等情况
                return web.json_response({"ok": False, "error": str(exc)}, status=500)
            return web.json_response({"ok": True, "config": cfg, "path": CONFIG_FILE})

        @server.routes.post("/topbar-icons/config")
        async def tbim_set_config(request):
            try:
                data = await request.json()
            except Exception:
                return web.json_response({"ok": False, "error": "invalid json"}, status=400)
            cfg = _sanitize(data)
            try:
                with open(CONFIG_FILE, "w", encoding="utf-8") as f:
                    json.dump(cfg, f, ensure_ascii=False, indent=2)
            except Exception as exc:
                return web.json_response({"ok": False, "error": str(exc)}, status=500)
            return web.json_response({"ok": True, "path": CONFIG_FILE})

        return True
    except Exception as exc:  # 后端不可用时前端仍可工作（退回 localStorage）
        print("[TopBarIcons] 配置接口注册失败，将只使用浏览器本地存储：", exc)
        return False


__version__ = _read_version()
CONFIG_API = _register_routes()

__all__ = [
    "NODE_CLASS_MAPPINGS",
    "NODE_DISPLAY_NAME_MAPPINGS",
    "WEB_DIRECTORY",
    "__version__",
]

print(
    "\n[TopBarIcons] 顶部图标管理器 v{} 已加载 -> 点击工具条右侧「齿轮」按钮开始管理".format(
        __version__
    )
)
print(
    "[TopBarIcons] 配置存储：{}\n".format(
        os.path.join("custom_nodes", "ComfyUI-TopBarIcons", "config.json")
        if CONFIG_API
        else "浏览器 localStorage（后端接口不可用）"
    )
)
