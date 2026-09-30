# ComfyUI-TopBarIcons (顶部图标管理器)

<p><img src="https://img.shields.io/badge/version-1.1.0-blue" alt="version"> <img src="https://img.shields.io/badge/license-MIT-green" alt="license"> <img src="https://img.shields.io/badge/ComfyUI-custom__node-orange" alt="ComfyUI custom node"></p>

顶栏上那些从来用不上的图标（各种扩展塞进来的按钮、云端/订阅按钮、旧脚本注入的按钮……）可以逐个关掉了。
**纯前端插件，不注册任何节点**，改完立刻生效；配置保存在插件目录的 `config.json`，换浏览器、换浏览器配置文件都不用重新设置。

## 使用方式

装好并重启后，顶部工具条最右侧会出现一个 ⚙ **齿轮按钮**，点开就是管理面板：

- 面板按来源分组列出当前扫描到的所有顶栏元素（顶部操作栏 / 主菜单 / 执行队列区 / 标签栏 / 旧脚本按钮……）
- **取消勾选即隐藏**，勾选恢复，改动即时生效并写入 `config.json`
- **搜索框**：按名称或图标关键字过滤
- **全部显示**：清空所有隐藏规则
- **仅看已隐藏**：只看当前被隐藏的条目
- **重新扫描**：顶栏被 Vue 重建 / 新装了扩展后手动刷一次
- **导出清单**：把扫描结果复制出来（排查、反馈用）
- 对话框支持 `Esc` / 点击遮罩关闭

面板顶部还有几个省地方的开关：

| 选项 | 说明 |
| --- | --- |
| 齿轮位置 | 顶栏内（默认）/ 右上角固定 / 右下角固定 —— 顶栏找不到齿轮时改成固定位置 |
| 显示齿轮入口 | 关闭后齿轮按钮整体隐藏（面板仍可用 `Ctrl+Alt+G` 或设置里的「打开管理面板」进入） |
| 仅图标模式 | 隐藏按钮上的文字说明，只留图标（最省横向空间） |
| 紧凑间距 | 缩小按钮之间的间距和内边距 |
| 扩展扫描范围 | 额外扫描工作流标签栏（含第三方徽标 badge、公告按钮等） |

面板底部会显示当前配置的存储来源（绿色 = 已存到插件目录，黄色 = 仅当前浏览器）。

## 配置保存在哪

默认保存在**插件目录的 `config.json`**：

```
ComfyUI/custom_nodes/ComfyUI-TopBarIcons/config.json
```

- 换浏览器、换浏览器用户配置、清缓存、用另一台电脑访问同一个 ComfyUI，配置都一样生效
- 后端接口不可用时会自动退回浏览器 `localStorage`，功能照常用，只是不跨浏览器（此时面板底部是黄色提示，**一般是因为装完没重启 ComfyUI**）
- 想彻底重置：删掉 `config.json`（或点面板里的「全部显示」），再刷新页面
- 控制台可用 `TopBarIcons.store()` 查当前来源、`TopBarIcons.reload()` 重新从文件拉取

写入只保存白名单字段：`hidden / iconOnly / compact / wide / gearPos / gearVisible`。

## 安装

方式一（推荐，方便更新）：在 `custom_nodes` 目录下克隆仓库

```bash
cd ComfyUI/custom_nodes
git clone https://github.com/live1617/ComfyUI-TopBarIcons.git
```

以后更新只需进入目录拉取：

```bash
cd ComfyUI/custom_nodes/ComfyUI-TopBarIcons
git pull
```

方式二：在 GitHub 页面点 **Code → Download ZIP**，解压后把文件夹放到 `custom_nodes` 下。

方式三：ComfyUI Registry

```bash
comfy node install topbar-icons
```

> ⚠️ 注意不要「套娃」：必须是 `custom_nodes/ComfyUI-TopBarIcons/__init__.py`，
> 而不是 `custom_nodes/ComfyUI-TopBarIcons/ComfyUI-TopBarIcons/__init__.py`。

```
ComfyUI/custom_nodes/ComfyUI-TopBarIcons/
```

无任何第三方依赖，无需 pip install；不注册任何节点，节点列表里**不会**出现新节点。

安装后**重启 ComfyUI** 并**强制刷新页面（Ctrl + Shift + R）**即可，顶栏最右侧出现齿轮按钮。

## 旧版菜单模式（重要）

如果你的控制台出现这条提示：

```
[ComfyUI] The legacy queue/history menu is deprecated ... change from "Disabled" to "Top"
```

说明**新式顶部操作栏没启用**（设置项 `Comfy.UseNewMenu = Disabled`），此时没有
`[data-testid="top-menu-actionbars"]`，插件会退化去扫旧菜单，齿轮也可能被旧菜单容器的
`overflow:hidden` 裁掉。两条路：

1. **推荐**：ComfyUI 设置里搜索 **Use new menu**（中文：使用新菜单），从 `Disabled` 改成 **Top**，
   刷新页面 —— 新式顶部操作栏出现，齿轮就正常落在里面
2. 不改设置也行：打开管理面板 ⇒ 「齿轮位置」选 **右上角固定**（或右下角），齿轮就钉在屏幕角落，不再依赖顶栏

## API（前端调用）

| 方法 | 路径 | 说明 |
| --- | --- | --- |
| GET | `/topbar-icons/config` | 读取配置，返回 `{ok, config, path}`；文件不存在时 `config` 为 `null` |
| POST | `/topbar-icons/config` | 写入配置（白名单过滤），返回 `{ok, path}` |

控制台可用的调试方法：

| 方法 | 说明 |
| --- | --- |
| `TopBarIcons.open()` / `.close()` | 打开 / 关闭管理面板 |
| `TopBarIcons.scan()` | 重新扫描顶栏 |
| `TopBarIcons.mount()` | 强制重新挂载齿轮按钮 |
| `TopBarIcons.save()` | 立即保存一次配置 |
| `TopBarIcons.reload()` | 重新从 `config.json` 拉取配置 |
| `TopBarIcons.store()` | 返回 `file`（插件目录）/ `local`（仅当前浏览器） |
| `TopBarIcons.state()` / `.items()` | 当前配置 / 扫描到的条目 |
| `TopBarIcons.version` | 插件版本号 |
| `TopBarIcons.diag()` | 完整诊断信息（版本、存储来源、顶栏容器、条目数、齿轮位置、隐藏规则） |

## 常见问题

**A. 顶栏看不到齿轮按钮**

1. 确认已**重启 ComfyUI + Ctrl + Shift + R 强刷页面**。
2. 第一次成功挂载时齿轮会**绿色高亮闪烁三下**（约 4 秒）便于定位。
3. 快捷键 **Ctrl+Alt+G** 可直接开关面板（齿轮被藏起来也能用）。
4. 打开 ComfyUI **设置（齿轮图标）** → 左侧分类 **TopBarIcons** → 工具条 → 「打开管理面板」／「恢复全部显示」。
5. 还找不到：地址栏改成 `http://127.0.0.1:8188/?tbim=diag` 回车，页面会弹出诊断框，
   点「复制诊断信息」把内容发给开发者即可（不用开 F12）。

**B. 面板底部提示「配置仅保存在当前浏览器」**

后端接口没起来，**重启一次 ComfyUI** 即可（`GET/POST /topbar-icons/config` 是启动时注册的）。
重启后仍为黄色，用 `TopBarIcons.diag()` 看 `remoteOK` / `configPath` 字段。

**C. 某个图标没被扫到**

1. 先点面板里的「重新扫描」。
2. 仍没有就打开「扩展扫描范围」（标签栏上的徽标 / 公告按钮需要它）。
3. 还是没有就点「导出清单」，把那条元素的 JSON 发给开发者补规则。

**D. 两个按钮一起被勾选 / 取消**

旧版本（1.0.x）曾因同图标按钮共用身份 key 出现联动，1.1.0 已修复（指纹加入文案特征 + 重复 key 自动编号）。
若遇到过，把那两个按钮重新取消勾选一次即可。

## 实现原理

前端脚本扫描顶栏容器里的所有可点元素（默认 `[data-testid="top-menu-actionbars"]`，
扩展模式下加 `[data-testid="topbar-workflow-tabs"]`），为每个元素计算：

- **稳定身份指纹**（优先级：data-testid > 元素 id > 图标类名 > aria-label > 结构路径）→ 作为配置 key，
  尽量不受顺序变动、语言切换影响；同图标同文案的按钮会自动加 `#1`、`#2` 编号消歧
- **唯一 CSS 选择器**（同样按上述优先级，并校验全局唯一性）→ 注入 `<style>` 用
  `display:none !important` 隐藏，因此 Vue 重渲染也不会「复活」被隐藏的按钮
- 若该按钮独占一个带边框的容器卡片，则连容器一起隐藏，避免留下空壳继续占位

「仅图标模式」不依赖任何写死的 testid：扫描时给包裹文字的元素动态打标记再隐藏，
图标和无障碍朗读文本、角标计数都不受影响。

MutationObserver 监听顶栏 DOM 变化自动重扫（节流 250ms，列表内容没变就不重建 DOM，避免闪烁），
并有 3s 定时兜底；容器被重建时会自动重新挂载齿轮按钮。

## 文件结构

```
ComfyUI-TopBarIcons/
├── __init__.py          # 空节点映射 + WEB_DIRECTORY + 配置读写接口
├── web/
│   └── topbar-icons.js  # 全部前端逻辑
├── icon.svg / icon.png  # Registry 列表图标（400x400）
├── config.json          # 运行时生成的配置（不进版本库，换浏览器也通用）
├── pyproject.toml       # ComfyUI Registry 元数据（PublisherId / Repository 需自行核对）
├── LICENSE              # MIT
└── README.md
```

## 版本信息

当前版本 **v1.1.0**（与 `pyproject.toml` 的 `[project] version` 一致）。查看方式：

- 管理面板标题右侧的 `v1.1.0` 小标签
- 浏览器控制台启动横幅 `[TopBarIcons] v1.1.0 ...`
- 控制台执行 `TopBarIcons.version`，或 `TopBarIcons.diag()` 里的 `version` 字段
- ComfyUI 启动日志（Python 侧从 `pyproject.toml` 读取后打印）

发版时三处要一起改：`pyproject.toml` 的 `version`、`web/topbar-icons.js` 顶部的 `VERSION`、
`__init__.py` 的 `_FALLBACK_VERSION`（Python 主用 pyproject 的值，回退值保持一致即可）。

## 版本历史

| 版本 | 日期 | 更新内容 |
| --- | --- | --- |
| 1.1.0 | 2026-09-30 | 配置改存插件目录 `config.json`（新增 GET/POST `/topbar-icons/config`），换浏览器/换设备通用；接口不可用时自动退回 localStorage；面板底部显示存储来源，新增 `TopBarIcons.store() / reload() / save()` |
| 1.0.0 | 2026-09-27 | 首个正式发布版：齿轮入口 + 图标显隐管理面板、按来源分组、仅图标模式 / 紧凑间距、旧版菜单模式降级与齿轮兜底挂载、扫描非 button 控件（如翻译开关） |

## 兼容性

在 ComfyUI 前端 **1.53.x**（新版 Vue 前端）上开发验证。旧的 litegraph 前端没有
`top-menu-actionbars` 这套容器，脚本会自动降级（扫描 `#comfy-menu` 所在的顶栏），
但大部分新版本的 props 都依赖 DOM testid，建议前端版本 >= 1.16。

## 开源协议

本项目基于 [MIT License](LICENSE) 开源，欢迎自由使用、修改和分发。
