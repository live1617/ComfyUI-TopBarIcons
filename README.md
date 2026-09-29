# ComfyUI-TopBarIcons —— 顶部图标管理器

顶栏上那些从来用不上的图标（各种扩展塞进来的按钮、云端/订阅按钮、旧脚本注入的按钮……）可以逐个关掉了。
纯前端插件，不注册任何节点，改完立刻生效；**配置保存在插件目录的 `config.json`**，换浏览器、换浏览器配置文件都不用重新设置。

![version](https://img.shields.io/badge/version-1.1.0-blue) ![python](https://img.shields.io/badge/python-%3E%3D3.8-green) ![license](https://img.shields.io/badge/license-MIT-lightgrey)

## 安装

三种方式任选其一，目标都是把插件放到这个位置：

```
ComfyUI/custom_nodes/ComfyUI-TopBarIcons/
```

### 方式一：Git 克隆（推荐，方便后续更新）

进入 ComfyUI 的 `custom_nodes` 目录后执行：

```bash
cd ComfyUI/custom_nodes
git clone https://github.com/live1617/ComfyUI-TopBarIcons.git
```

以后更新只需进入目录拉取：

```bash
cd ComfyUI/custom_nodes/ComfyUI-TopBarIcons
git pull
```

也可以在 ComfyUI-Manager 里用「Install via Git URL」填仓库地址
`https://github.com/live1617/ComfyUI-TopBarIcons.git`，效果一样。

### 方式二：手动下载

在 GitHub 仓库页面点 **Code → Download ZIP**，解压后把整个 `ComfyUI-TopBarIcons`
文件夹放进 `ComfyUI/custom_nodes/`。

### 方式三：ComfyUI Registry

```bash
comfy node install topbar-icons
```

三种方式装完后都需要**重启 ComfyUI**（首次安装要让前端静态目录被挂载）。
无任何 Python 依赖、不注册任何节点。

## 用法

1. 重启 ComfyUI（首次安装需要，让前端静态目录被挂载），然后 **Ctrl+Shift+R** 强刷页面。
2. 在顶部工具条最右侧会出现一个 **齿轮按钮** ⇒ 点击打开「顶部工具条图标管理」面板。
3. 面板里列出了当前所有被扫描到的顶栏元素（按来源分组），**取消勾选即隐藏**，勾选恢复。
4. 改动即时生效，并写入插件目录的 `config.json`，下次打开（换浏览器也一样）自动生效。

### 面板上的其它开关

| 选项 | 说明 |
| --- | --- |
| 齿轮位置 | 顶栏内（默认）/ 右上角固定 / 右下角固定 —— 顶栏找不到齿轮时改成固定位置 |
| 显示齿轮入口 | 关闭后齿轮按钮整体隐藏（面板仍可用 Ctrl+Alt+G 或设置里的「打开管理面板」进入） |
| 仅图标模式 | 隐藏按钮上的文字说明，只留图标（最省横向空间） |
| 紧凑间距 | 缩小按钮之间的间距和内边距 |
| 扩展扫描范围 | 额外扫描工作流标签栏（含第三方徽标 badge、公告按钮等） |
| 全部显示 | 清空所有隐藏规则 |
| 只看到已隐藏 | 只看当前被隐藏的条目 |
| 导出清单 | 把扫描结果复制出来（排查/反馈用） |

## 配置保存在哪

默认保存在**插件目录的 `config.json`**：

```
ComfyUI/custom_nodes/ComfyUI-TopBarIcons/config.json
```

- 换浏览器、换浏览器用户配置、清缓存、用另一台电脑访问同一个 ComfyUI，配置都一样生效。
- 面板底部会显示当前实际存储来源：
  - 绿色「配置已保存到插件目录 config.json」——正常走文件；
  - 黄色「配置仅保存在当前浏览器」——后端接口没起来（**一般是因为装完没重启 ComfyUI**），重启即可。
- 后端接口不可用时会自动退回浏览器 `localStorage`，功能照常用，只是不跨浏览器。
- 想彻底重置：删掉 `config.json`（或点面板里的「全部显示」），再刷新页面。

实现上就是两个本地接口（不联网）：`GET /topbar-icons/config` 读、`POST /topbar-icons/config` 写。
写入会做字段白名单过滤，只保存 `hidden / iconOnly / compact / wide / gearPos / gearVisible`。
控制台可用 `TopBarIcons.store()` 查当前来源、`TopBarIcons.reload()` 重新从文件拉取。

## 旧版菜单模式（重要）

你的 ComfyUI 如果控制台出现这条提示：

```
[ComfyUI] The legacy queue/history menu is deprecated ... change from "Disabled" to "Top"
```

说明 **新式顶部操作栏没启用**（设置项 `Comfy.UseNewMenu = Disabled`），此时没有
`[data-testid="top-menu-actionbars"]`，插件会退化去扫旧菜单，齿轮也可能被旧菜单容器的
`overflow:hidden` 裁掉。两条路：

1. **推荐**：ComfyUI 设置里搜索 **Use new menu**（中文：使用新菜单），从 `Disabled` 改成 **Top**，
   刷新页面 —— 新式顶部操作栏出现，齿轮就正常落在里面。
2. 不改设置也行：打开管理面板 ⇒ 「齿轮位置」选 **右上角固定**（或右下角），齿轮就钉在屏幕角落，不再依赖顶栏。

## 找不到齿轮按钮了怎么办

第一次成功挂载时，齿轮会**绿色高亮闪烁三下**（约 4 秒）方便定位。

- 快捷键 **Ctrl+Alt+G** 直接开关面板（齿轮被藏起来也能用）。
- 打开 ComfyUI 设置面板 ⇒ 左侧 **TopBarIcons** ⇒ **工具条** ⇒ 「打开管理面板」。
- 或者在同一处点「恢复全部显示」一键还原。
- 或者在浏览器控制台执行 `TopBarIcons.open()`。
- 极端情况：删掉插件目录里的 `config.json`（配置存储首选），并清掉浏览器 localStorage 的 `ComfyUI-TopBarIcons.v1`（回退副本）。

## 排查

扩展加载后会在控制台打印一行「齿轮按钮挂载于：xxx」；万一所有挂载位置都不可见，
齿轮会自动改为 `position:fixed` 钉在屏幕右上角（纯图标，不占空间）。

### 方式一（推荐，不用开控制台）

把地址栏改成下面这样回车：

```
http://127.0.0.1:8188/?tbim=diag
```

页面左上角会弹出诊断框，点「复制诊断信息」后把内容发给开发者即可。

### 方式二（浏览器控制台）

1. 在 ComfyUI 页面按 **F12**（或 `Ctrl+Shift+I`，Chrome/Edge 直接按 `Ctrl+Shift+J` 就是控制台）。
2. 切到 **Console / 控制台** 标签页（顶部那排）。
3. 输入下面的命令回车，把输出的 JSON 复制出来：

```js
TopBarIcons.diag()
```

输出里能看到：顶栏容器是否找到、扫描到几个图标、齿轮挂在哪个元素上、坐标尺寸、当前隐藏规则。
控制台里还可以用 `TopBarIcons.mount()` 强制重新挂载齿轮、`TopBarIcons.open()` 直接打开面板。

## 实现原理

前端脚本扫描顶栏容器里的所有可点元素（默认 `[data-testid="top-menu-actionbars"]`，
扩展模式下加 `[data-testid="topbar-workflow-tabs"]`），为每个元素计算：

- **稳定身份指纹**（优先级：data-testid > 元素 id > 图标类名 > aria-label > 结构路径）→ 作为配置 key，
  尽量不受顺序变动、语言切换影响；
- **唯一 CSS 选择器**（同样按上述优先级，并校验全局唯一性）→ 注入 `<style>` 用
  `display:none !important` 隐藏，因此 Vue 重渲染也不会「复活」被隐藏的按钮；
- 若该按钮独占一个带边框的容器卡片，则连容器一起隐藏，避免留下空壳继续占位。

MutationObserver 监听顶栏 DOM 变化自动重扫（节流 250ms），并有 3s 定时兜底；
容器被重建时会自动重新挂载齿轮按钮。

## 文件结构

```
ComfyUI-TopBarIcons/
├── __init__.py          # 空节点映射 + WEB_DIRECTORY（仅下发前端）
├── web/
│   └── topbar-icons.js  # 全部逻辑
├── icon.svg / icon.png  # Registry 列表图标（400x400）
├── config.json          # 运行时生成的配置（不进版本库，换浏览器也通用）
├── pyproject.toml       # ComfyUI Registry 元数据（PublisherId / Repository 需自行核对）
├── LICENSE              # MIT
└── README.md
```

## 版本信息

当前版本 **v1.1.0**（与 `pyproject.toml` 的 `[project] version` 一致）。查看方式：

- 管理面板标题右侧的 `v1.1.0` 小标签；
- 浏览器控制台启动横幅 `[TopBarIcons] v1.1.0 ...`；
- 控制台执行 `TopBarIcons.version`，或 `TopBarIcons.diag()` 里的 `version` 字段；
- ComfyUI 启动日志（Python 侧从 `pyproject.toml` 读取后打印）。


## 兼容性

在 ComfyUI 前端 **1.53.x**（新版 Vue 前端）上开发验证。旧的 litegraph 前端没有
`top-menu-actionbars` 这套容器，脚本会自动降级（扫描 `#comfy-menu` 所在的顶栏），
但大部分新版本的 props 都依赖 DOM testid，建议前端版本 >= 1.16。
