// ============================================================================
// ComfyUI-TopBarIcons —— 顶部图标管理器
// 作用：扫描 ComfyUI 顶栏（action bar / 工作流标签栏）里的每一个按钮 / 徽标，
//       允许逐个隐藏（用 CSS 彻底 display:none），并提供「仅图标」「紧凑」两种省空间模式。
// 配置：localStorage["ComfyUI-TopBarIcons.v1"]，改完立即生效。
// 恢复：ComfyUI 设置面板 -> TopBarIcons -> 工具条 -> 恢复全部显示
// 版本：与 pyproject.toml 的 [project] version 保持一致，发版时两边一起改
// ============================================================================
import { app } from "../../scripts/app.js";

/* ------------------------------- 常量 ------------------------------------ */
const VERSION = "1.1.0"; // ← 与 pyproject.toml / __init__.py 保持同步
const EXT_NAME = "ComfyUI.TopBarIcons";
const LS_KEY = "ComfyUI-TopBarIcons.v1";
const API_URL = "/topbar-icons/config"; // 后端接口（插件目录 config.json）
const STYLE_ID = "tbim-rules"; // 隐藏规则
const UISTYLE_ID = "tbim-ui-css"; // 面板样式
const MARK = "data-tbim"; // 标记我们自己注入的 DOM，扫描时排除
const HTXT_CLS = "tbim-htxt"; // 仅图标模式：需要藏起来的文字包裹元素
const IZO_CLS = "tbim-izo"; // 仅图标模式：文字是直接文本节点的按钮

// 扫描范围（新版 Vue 前端 1.16+ / 1.53.x）
const SCOPES = [
  {
    key: "actionbars",
    name: "顶部操作栏",
    sel: '[data-testid="top-menu-actionbars"]',
    exclude: null,
  },
  {
    key: "tabbar",
    name: "工作流标签栏",
    sel: '[data-testid="topbar-workflow-tabs"]',
    exclude: ".workflow-tabs", // 标签页本体不参与（只管线上的操作按钮/徽标）
    advanced: true, // 需要在面板里打开「扩展扫描范围」才会启用
  },
];

// 兜底：很老的 litegraph 前端没有上面的容器，退化到老式菜单区
const FALLBACK_SCOPES = [
  { key: "legacy", name: "旧版菜单", sel: "#comfy-menu, .comfy-menu", exclude: ".comfy-menu-logo" },
];

const GROUP_RULES = [
  ["legacy-topbar-container", "旧版脚本按钮"],
  ["action-bar-buttons", "扩展注册按钮"],
  ["action-bar-card", "执行/队列区"],
  ["app-menu", "主菜单"],
  ["topbar-workflow-tabs", "标签栏"],
  ["top-menu-actionbars", "其他"],
];

/* ------------------------------- 状态 ------------------------------------ */
function emptyState() {
  return {
    hidden: {},
    iconOnly: false,
    compact: false,
    wide: false,
    gearPos: "inner", // inner | tr | br
    gearVisible: true, // 是否显示齿轮入口
    version: 1,
  };
}

let state = emptyState();

// 配置来源："file"（插件目录 config.json，全浏览器通用）| "local"（仅当前浏览器）
let storeMode = "local";
let remoteOK = false;
let remoteTimer = null;
let remotePath = null;

function loadState() {
  const fallback = emptyState();
  try {
    const raw = localStorage.getItem(LS_KEY);
    if (!raw) return fallback;
    const obj = JSON.parse(raw) || {};
    return Object.assign(fallback, obj, {
      hidden: obj.hidden && typeof obj.hidden === "object" ? obj.hidden : {},
    });
  } catch (e) {
    return fallback;
  }
}

function normalize(obj) {
  const base = emptyState();
  if (!obj || typeof obj !== "object") return base;
  return Object.assign(base, obj, {
    hidden: obj.hidden && typeof obj.hidden === "object" ? obj.hidden : {},
  });
}

function saveState() {
  // 本地永远写一份影子副本：后端接口不可用时不至于丢配置
  try {
    localStorage.setItem(LS_KEY, JSON.stringify(state));
  } catch (e) {
    /* ignore */
  }
  pushRemote();
}

/* ---- 远程配置（插件目录 config.json）---- */
function pushRemote() {
  if (remoteTimer) return; // 防抖：连续改动只写一次
  remoteTimer = setTimeout(function () {
    remoteTimer = null;
    if (typeof fetch !== "function") {
      remoteOK = false;
      storeMode = "local";
      updateStoreTag();
      return;
    }
    fetch(API_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(state),
    })
      .then(function (r) {
        if (!r.ok) throw new Error("HTTP " + r.status);
        return r.json();
      })
      .then(function (d) {
        remoteOK = true;
        storeMode = "file";
        if (d && d.path) remotePath = d.path;
        updateStoreTag();
      })
      .catch(function () {
        remoteOK = false;
        storeMode = "local";
        updateStoreTag();
      });
  }, 250);
}

function loadRemote() {
  if (typeof fetch !== "function") {
    storeMode = "local";
    return Promise.resolve(false);
  }
  return fetch(API_URL, { credentials: "same-origin" })
    .then(function (r) {
      if (!r.ok) throw new Error("HTTP " + r.status);
      return r.json();
    })
    .then(function (d) {
      remoteOK = true;
      if (d && d.path) remotePath = d.path;
      if (d && d.config) {
        // 服务器文件是权威来源，覆盖本地
        state = normalize(d.config);
        storeMode = "file";
        try {
          localStorage.setItem(LS_KEY, JSON.stringify(state));
        } catch (e) {
          /* ignore */
        }
        applyRules();
        applyIconOnly();
      } else {
        // 文件还不存在：把当前（本地）配置上传一份，建立文件
        storeMode = "file";
        pushRemote();
      }
      updateStoreTag();
      return true;
    })
    .catch(function () {
      remoteOK = false;
      storeMode = "local";
      updateStoreTag();
      return false;
    });
}

function updateStoreTag() {
  const el = storeTagEl;
  if (!el) return;
  if (storeMode === "file") {
    el.textContent = "配置已保存到插件目录 config.json（换浏览器/换设备同样生效）";
    el.className = "tbim-store ok";
    el.title = remotePath || "";
  } else {
    el.textContent = "配置仅保存在当前浏览器（后端接口不可用，请重启 ComfyUI 后再试）";
    el.className = "tbim-store warn";
    el.title = "";
  }
}

state = loadState();

/* ------------------------------ 工具函数 --------------------------------- */
function attrEsc(v) {
  // 属性选择器里的字符串转义
  return String(v).replace(/\\/g, "\\\\").replace(/"/g, '\\"');
}

function cssIdent(v) {
  if (typeof CSS !== "undefined" && CSS.escape) return CSS.escape(String(v));
  return String(v).replace(/[^\w-]/g, function (c) {
    return "\\" + c;
  });
}

function norm(s) {
  return String(s || "").replace(/\s+/g, " ").trim();
}

function iconElOf(el) {
  if (el.tagName === "I" || el.tagName === "SVG") return el;
  return el.querySelector("i, svg") || null;
}

function tooltipText(el) {
  const descId = el.getAttribute("aria-describedby");
  if (descId) {
    const d = document.getElementById(descId);
    const t = norm(d && d.textContent);
    if (t) return t;
  }
  const sr = el.querySelector(".sr-only");
  if (sr) {
    const t = norm(sr.textContent);
    if (t) return t;
  }
  return "";
}

function labelOf(el) {
  const al = norm(el.getAttribute("aria-label"));
  if (al) return al.slice(0, 60);
  const ti = norm(el.getAttribute("title")); // div 开关通常只有 title 提示
  if (ti) return ti.slice(0, 60);
  const tt = tooltipText(el);
  if (tt) return tt.slice(0, 60);
  const parts = [];
  Array.prototype.forEach.call(el.children, function (c) {
    const tag = (c.tagName || "").toUpperCase();
    if (tag === "I" || tag === "SVG" || tag === "INPUT") return;
    const t = norm(c.textContent);
    if (t) parts.push(t);
  });
  if (parts.length) return parts.join(" ").slice(0, 60);
  const own = norm(el.textContent);
  if (own) return own.slice(0, 60);
  return (el.tagName || "el").toLowerCase();
}

// 稳定的图标指纹（剔除尺寸/颜色/状态等易变工具类）
const VOLATILE_CLS = new RegExp(
  "^(size-|text-|bg-|opacity-|animate-|duration-|transition-|rounded|shadow|outline|ring-|" +
    "w-\\d|h-\\d|p[xytrbl]?-\\d|m[xytrbl]?-\\d|gap-\\d|z-\\d|" +
    "flex|inline|block|hidden|relative|absolute|fixed|shrink|grow|items-|justify-|self-|" +
    "border|cursor-|pointer-events|select-|overflow-|sr-only|align-|leading-|tracking-|" +
    "font-|translate-|rotate-|scale-|stroke-|fill-|float-|no-drag|comfyui-)",
  "i"
);

function iconSig(el) {
  const ic = iconElOf(el);
  if (!ic) return "";
  const raw = String(ic.getAttribute("class") || "").split(/\s+/).filter(Boolean);
  let keep = raw.filter(function (t) {
    return t.indexOf(":") < 0 && !VOLATILE_CLS.test(t) && t.length > 2;
  });
  if (!keep.length) keep = raw.filter(function (t) {
    return t.indexOf(":") < 0 && t.length > 2;
  });
  const cls = keep.sort().join(".");
  if (cls) return cls;
  const p = ic.querySelector ? ic.querySelector("path") : null;
  if (p && p.getAttribute("d")) return "svg:" + String(p.getAttribute("d")).slice(0, 40);
  return "";
}

// 结构路径（相对最近的锚点祖先）
function relPath(el, anchor) {
  const parts = [];
  let n = el;
  let guard = 0;
  while (n && n !== anchor && n !== document.body && guard++ < 12) {
    const p = n.parentElement;
    if (!p) break;
    const tag = (n.tagName || "div").toLowerCase();
    const same = Array.prototype.filter.call(p.children, function (c) {
      return c.tagName === n.tagName;
    });
    const idx = same.indexOf(n);
    parts.unshift(idx >= 0 ? tag + ":nth-of-type(" + (idx + 1) + ")" : tag);
    n = p;
  }
  return parts.join(" > ");
}

function anchorSelector(anchor) {
  const tid = anchor.getAttribute && anchor.getAttribute("data-testid");
  if (tid) return '[data-testid="' + attrEsc(tid) + '"]';
  if (anchor && anchor.id) return "#" + cssIdent(anchor.id);
  return anchor && anchor.tagName ? anchor.tagName.toLowerCase() : "*";
}

/* ---------------------------- 元素发现/描述 ------------------------------ */

// 徽标（badge）在 1.5x 里是纯 div + 图标 i[data-testid=badge-icon]
// 把 item 提升到「徽标容器」（即 badges 容器的直接子元素）
function normalizeBadge(el, root) {
  if (el.getAttribute && el.getAttribute("data-testid") === "badge-icon") {
    const host = el.closest(".flex.h-full.shrink-0.items-center");
    if (host) {
      let n = el;
      let guard = 0;
      while (n.parentElement && n.parentElement !== host && guard++ < 8) n = n.parentElement;
      return n;
    }
  }
  return el;
}

function collectItems(root, excludeSel) {
  // 除了标准可点元素，还要抓「非 button 的开关」：
  // 例如 ComfyUI-Chinese-Translation 的翻译开关是 div[id=toggle-translation-button].tl-toggle-pill，
  // 以及各插件常见的 role=switch/menuitem/tab、id 带 toggle 的控件。
  const nodes = Array.prototype.slice.call(
    root.querySelectorAll(
      'button, a, [role="button"], [role="switch"], [role="menuitem"], [role="tab"], ' +
        '[data-testid="badge-icon"], [id*="toggle"], [id*="Toggle"]'
    )
  );
  const uniq = [];
  nodes.forEach(function (el) {
    const it = normalizeBadge(el, root);
    if (!it || it === root) return;
    if (!it.isConnected) return;
    if (it.closest("[" + MARK + "]")) return; // 我们自己注入的东西
    if (excludeSel && it.closest(excludeSel)) return;
    if (uniq.indexOf(it) < 0) uniq.push(it);
  });

  // 只保留「最外层」的可点元素（父级也是按钮就不重复登记子集）
  return uniq.filter(function (el) {
    for (let p = el.parentElement; p && p !== root; p = p.parentElement) {
      if (uniq.indexOf(p) >= 0) return false;
    }
    return true;
  });
}

function groupOf(el, root) {
  let n = el;
  let guard = 0;
  while (n && n !== root && guard++ < 20) {
    const tid = n.getAttribute && n.getAttribute("data-testid");
    if (tid) {
      for (let i = 0; i < GROUP_RULES.length; i++) {
        if (GROUP_RULES[i][0] === tid) return GROUP_RULES[i][1];
      }
    }
    if (n.classList && n.classList.contains("comfyui-menu")) return "主菜单";
    if (n.id && n.id === "comfy-menu") return "主菜单";
    n = n.parentElement;
  }
  return root.getAttribute && root.getAttribute("data-testid") === "topbar-workflow-tabs"
    ? "标签栏"
    : "其他";
}

function identityOf(el, root) {
  const tid = el.getAttribute("data-testid");
  if (tid) return "t:" + tid;
  if (el.id && !/\d{3,}/.test(el.id)) return "#" + el.id;
  const sig = iconSig(el);
  const txt = norm(el.textContent);
  const stableTxt = txt && txt.length <= 40 && !/\d/.test(txt) ? txt : "";
  // 图标 + 文本一起用，降低「不同按钮用了同一图标」导致的指纹撞车
  if (sig && stableTxt) return "i:" + sig + "|" + stableTxt;
  if (sig) return "i:" + sig;
  const al = norm(el.getAttribute("aria-label"));
  if (al && !/\d/.test(al)) return "a:" + al;
  if (stableTxt) return "x:" + stableTxt;
  if (el.id) return "#" + el.id;
  return "p:" + relPath(el, root);
}

function uniqueSelector(el, root) {
  const candidates = [];
  const tid = el.getAttribute("data-testid");
  if (tid) candidates.push('[data-testid="' + attrEsc(tid) + '"]');
  if (el.id) candidates.push("#" + cssIdent(el.id));

  const ic = iconElOf(el);
  if (ic && ic !== el) {
    const cls = String(ic.getAttribute("class") || "")
      .split(/\s+/)
      .filter(Boolean)
      .map(cssIdent);
    if (cls.length) {
      candidates.push(el.tagName.toLowerCase() + ":has(> i." + cls.join(".") + ")");
      candidates.push(el.tagName.toLowerCase() + ":has(i." + cls.join(".") + ")");
    }
  }
  const al = norm(el.getAttribute("aria-label"));
  if (al) {
    candidates.push(
      el.tagName.toLowerCase() + '[aria-label="' + attrEsc(al) + '"]',
      anchorSelector(root) + ' [aria-label="' + attrEsc(al) + '"]'
    );
  }
  const path = relPath(el, root);
  if (path) candidates.push(anchorSelector(root) + " > " + path);
  const ownCls = String(el.getAttribute("class") || "")
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 4)
    .map(cssIdent);
  if (ownCls.length) candidates.push(el.tagName.toLowerCase() + "." + ownCls.join("."));

  for (let i = 0; i < candidates.length; i++) {
    const sel = candidates[i];
    let found = null;
    try {
      found = document.querySelectorAll(sel);
    } catch (e) {
      continue;
    }
    let hit = false;
    for (let j = 0; j < found.length; j++) {
      if (found[j] === el) {
        hit = true;
        break;
      }
    }
    if (hit && found.length === 1) return sel;
  }
  return null;
}

/* ------------------------------ 扫描/应用 -------------------------------- */
let items = []; // 最近一次扫描得到的条目
const itemByKey = Object.create(null);

// 只包含一个可点子元素的容器（通常是带边框的卡片），一起隐藏以免留空壳
function lonelyParent(el, root) {
  const p = el.parentElement;
  if (!p || p === root || p === document.body || !p.children) return null;
  const kids = Array.prototype.filter.call(p.children, function (c) {
    return c.nodeType === undefined || c.nodeType === 1;
  });
  return kids.length === 1 ? p : null;
}

// 当前生效的「范围 + 根元素」列表
function activeRoots() {
  const list = [];
  const main = document.querySelector(SCOPES[0].sel);
  if (main) {
    list.push({ scope: SCOPES[0], root: main });
    if (state.wide) {
      const tabs = document.querySelector(SCOPES[1].sel);
      if (tabs) list.push({ scope: SCOPES[1], root: tabs });
    }
  } else {
    FALLBACK_SCOPES.forEach(function (scope) {
      const r = document.querySelector(scope.sel);
      if (r) list.push({ scope: scope, root: r });
    });
  }
  return list;
}

function scan() {
  const list = [];
  activeRoots().forEach(function (entry) {
    const scope = entry.scope;
    const root = entry.root;
    const found = collectItems(root, scope.exclude);
    found.forEach(function (el) {
      const group = groupOf(el, root);
      const id = identityOf(el, root);
      const key = scope.key + "|" + group + "|" + id;
      const sel = uniqueSelector(el, root);
      // 如果这个按钮独占一个带边框的容器卡片，连容器一起隐藏，避免留下空壳占位
      const lonely = lonelyParent(el, root);
      const lonelySel = lonely ? uniqueSelector(lonely, root) : null;
      list.push({
        el: el,
        key: key,
        sel: sel,
        lonelySel: lonelySel && lonelySel !== sel ? lonelySel : null,
        label: labelOf(el),
        icon: iconElOf(el),
        group: group,
        scope: scope.name,
      });
    });
  });

  // 消歧：万一多个元素算出同一个身份指纹（如同图标同文案的不同按钮），
  // 按 DOM 顺序给重复的 key 编号，保证每个条目的勾选状态互相独立。
  const dup = Object.create(null);
  list.forEach(function (it) {
    dup[it.key] = (dup[it.key] || 0) + 1;
  });
  const seen = Object.create(null);
  list.forEach(function (it) {
    if (dup[it.key] > 1) {
      seen[it.key] = (seen[it.key] || 0) + 1;
      it.key = it.key + "#" + seen[it.key];
    }
  });

  items = list;
  Object.keys(itemByKey).forEach(function (k) {
    delete itemByKey[k];
  });
  list.forEach(function (it) {
    itemByKey[it.key] = it;
  });
  applyIconOnly(); // 内部会调用 applyRules()
  return list;
}

function rulesCSS() {
  const out = [];
  Object.keys(state.hidden).forEach(function (key) {
    if (!state.hidden[key]) return;
    const it = itemByKey[key];
    if (it && it.sel) out.push(it.sel + " { display: none !important; }");
    if (it && it.lonelySel) out.push(it.lonelySel + " { display: none !important; }");
  });

  if (state.iconOnly) {
    // 文字由扫描时动态打标记（applyIconOnly），这里只提供样式，不依赖任何 testid
    out.push("." + HTXT_CLS + "{display:none !important}");
    out.push("." + IZO_CLS + "{font-size:0 !important;line-height:0 !important}");
    out.push(
      "." + IZO_CLS + " > i," + "." + IZO_CLS + " > svg{font-size:16px !important;width:16px;height:16px}"
    );
    out.push('[data-testid="top-menu-actionbars"] button { min-width: 0 !important; padding-inline: 6px !important; }');
  }
  if (state.compact) {
    out.push('[data-testid="top-menu-actionbars"] .actionbar-container { gap: 2px !important; }');
    out.push('[data-testid="top-menu-actionbars"] button { padding-inline: 6px !important; }');
    out.push('[data-testid="action-bar-buttons"] { gap: 0px !important; }');
  }
  return out.join("\n");
}

function ensureStyleEl() {
  let el = document.getElementById(STYLE_ID);
  if (!el) {
    el = document.createElement("style");
    el.id = STYLE_ID;
    el.setAttribute(MARK, "1");
    (document.head || document.documentElement).appendChild(el);
  }
  return el;
}

function applyRules() {
  const el = ensureStyleEl();
  const css = rulesCSS();
  if (el.textContent !== css) el.textContent = css;
}

/* 仅图标模式：不猜 testid，直接在扫描结果上给「文字部分」打标记 */
function isAbsPos(c) {
  if (typeof getComputedStyle !== "function") return false;
  try {
    return getComputedStyle(c).position === "absolute" || getComputedStyle(c).position === "fixed";
  } catch (e) {
    return false;
  }
}

// 按钮里包裹文字、可以整块藏掉的子元素
function textPartsOf(el) {
  const parts = [];
  Array.prototype.forEach.call(el.children, function (c) {
    const tag = (c.tagName || "").toUpperCase();
    if (tag === "I" || tag === "SVG" || tag === "INPUT") return; // 图标本身
    const cls = String(c.className || "");
    if (cls.indexOf("sr-only") >= 0) return; // 无障碍朗读文本
    if (isAbsPos(c)) return; // 角标/队列计数，不能藏
    const t = norm(c.textContent);
    if (!t) return;
    parts.push(c);
  });
  return parts;
}

function clearIconOnlyMarks() {
  const marked = document.querySelectorAll("." + HTXT_CLS + ", ." + IZO_CLS);
  Array.prototype.forEach.call(marked, function (el) {
    el.classList.remove(HTXT_CLS, IZO_CLS);
  });
}

function applyIconOnly() {
  clearIconOnlyMarks();
  applyRules();
  if (!state.iconOnly) return;
  items.forEach(function (it) {
    const el = it.el;
    if (!el || !el.isConnected || !el.children) return;
    if (isHidden(it.key)) return; // 已经隐藏的不用管
    const parts = textPartsOf(el);
    if (parts.length) {
      // 注意：只给「文字包裹元素」加标记类，绝不给按钮自身打 data-tbim
      // （打了会被下一次扫描当成插件自己的 UI 排除掉，条目就消失了）
      parts.forEach(function (p) {
        p.classList.add(HTXT_CLS);
      });
      return;
    }
    // 没有包裹元素：文字是按钮的直接文本节点 → 用 font-size:0 处理
    let ownText = false;
    Array.prototype.forEach.call(el.childNodes, function (n) {
      if (n.nodeType === 3 && norm(n.nodeValue)) ownText = true;
    });
    if (ownText) el.classList.add(IZO_CLS);
  });
}

function setHidden(key, hidden) {
  if (hidden) state.hidden[key] = true;
  else delete state.hidden[key];
  saveState();
  applyIconOnly(); // 显隐变化后重算「仅图标」标记
}

function isHidden(key) {
  return !!state.hidden[key];
}

/* ------------------------------- 面板 UI -------------------------------- */
let panelEl = null;
let rowBox = null;
let storeTagEl = null; // 面板底部「配置存储位置」提示

function ensureUIStyle() {
  if (document.getElementById(UISTYLE_ID)) return;
  const st = document.createElement("style");
  st.id = UISTYLE_ID;
  st.setAttribute(MARK, "1");
  st.textContent = [
    ".tbim-mask{position:fixed;inset:0;z-index:99999;display:flex;align-items:center;justify-content:center;background:rgba(0,0,0,.45);backdrop-filter:blur(2px);font-family:Inter,system-ui,-apple-system,'Segoe UI',Roboto,'Microsoft YaHei',sans-serif}",
    ".tbim-panel{width:560px;max-width:94vw;max-height:80vh;display:flex;flex-direction:column;border-radius:12px;background:var(--bg-color,#ffffff);color:var(--input-text,#1f1f1f);border:1px solid rgba(127,127,127,.35);box-shadow:0 20px 50px rgba(0,0,0,.35);overflow:hidden}",
    ".tbim-head{display:flex;align-items:center;gap:8px;padding:12px 14px;border-bottom:1px solid rgba(127,127,127,.22)}",
    ".tbim-title{font-size:14px;font-weight:600;flex:1}",
    ".tbim-x{border:none;background:transparent;color:inherit;font-size:18px;line-height:1;cursor:pointer;opacity:.7;padding:2px 6px;border-radius:6px}",
    ".tbim-x:hover{opacity:1;background:rgba(127,127,127,.18)}",
    ".tbim-tools{display:flex;flex-wrap:wrap;gap:8px;align-items:center;padding:10px 14px;border-bottom:1px solid rgba(127,127,127,.22)}",
    ".tbim-tools input[type=search]{flex:1;min-width:140px;padding:5px 8px;border-radius:6px;border:1px solid rgba(127,127,127,.4);background:transparent;color:inherit;font-size:12px}",
    ".tbim-btn{padding:4px 9px;font-size:12px;border-radius:6px;border:1px solid rgba(127,127,127,.4);background:rgba(127,127,127,.12);color:inherit;cursor:pointer;white-space:nowrap}",
    ".tbim-btn:hover{background:rgba(127,127,127,.24)}",
    ".tbim-opts{display:flex;flex-wrap:wrap;gap:14px;padding:8px 14px;font-size:12px;border-bottom:1px solid rgba(127,127,127,.22);opacity:.9}",
    ".tbim-opts label{display:flex;align-items:center;gap:5px;cursor:pointer;user-select:none}",
    ".tbim-body{flex:1;overflow-y:auto;padding:6px 14px 12px}",
    ".tbim-grp{margin:10px 0 4px;font-size:11px;font-weight:700;letter-spacing:.4px;opacity:.55;text-transform:uppercase}",
    ".tbim-row{display:flex;align-items:center;gap:8px;padding:5px 6px;border-radius:6px;cursor:pointer;font-size:13px;line-height:1.2}",
    ".tbim-row:hover{background:rgba(127,127,127,.14)}",
    ".tbim-row.off{opacity:.45}",
    ".tbim-ic{width:20px;height:20px;display:inline-flex;align-items:center;justify-content:center;flex:none;overflow:hidden;color:inherit}",
    ".tbim-ic>*{max-width:20px;max-height:20px;display:inline-block}",
    ".tbim-lb{flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}",
    ".tbim-key{font-size:10px;opacity:.4;max-width:130px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}",
    ".tbim-empty{padding:20px;text-align:center;font-size:13px;opacity:.6}",
    ".tbim-tip{padding:8px 14px;font-size:11px;opacity:.55;border-top:1px solid rgba(127,127,127,.22)}",
    ".tbim-ver{margin-left:8px;padding:1px 6px;border-radius:999px;font-size:10px;font-weight:600;letter-spacing:.3px;vertical-align:middle;opacity:.75;background:rgba(127,127,127,.22);border:1px solid rgba(127,127,127,.35)}",
    ".tbim-store{padding:6px 14px;font-size:11px;line-height:1.5;border-top:1px solid rgba(127,127,127,.22);word-break:break-all}",
    ".tbim-store.ok{color:#3fb950;opacity:.9}",
    ".tbim-store.warn{color:#d29922;opacity:.9}",
    ".tbim-gear{width:30px;height:30px;flex:none;display:inline-flex;align-items:center;justify-content:center;border-radius:999px;border:1px solid rgba(127,127,127,.55);background:rgba(127,127,127,.14);color:var(--input-text,#222);cursor:pointer;opacity:.9;transition:opacity .15s,background .15s;z-index:50}",
    ".tbim-gear:hover{opacity:1;background:rgba(127,127,127,.3)}",
    ".tbim-gear svg{width:18px;height:18px}",
    ".tbim-gear-float{position:fixed;top:8px;right:8px;z-index:99998;background:rgba(127,127,127,.35)}",
    ".tbim-gear-float-tr{position:fixed;top:8px;right:8px;z-index:99998;background:rgba(127,127,127,.35)}",
    ".tbim-gear-float-br{position:fixed;bottom:8px;right:8px;z-index:99998;background:rgba(127,127,127,.35)}",
    ".tbim-diag{position:fixed;left:12px;top:12px;z-index:100000;width:460px;max-width:94vw;max-height:70vh;display:flex;flex-direction:column;gap:8px;padding:12px;border-radius:10px;background:var(--bg-color,#fff);color:var(--input-text,#222);border:1px solid rgba(127,127,127,.45);box-shadow:0 18px 40px rgba(0,0,0,.35);font-size:12px}",
    ".tbim-diag-title{font-weight:600}",
    ".tbim-diag-pre{margin:0;flex:1;overflow:auto;white-space:pre-wrap;word-break:break-all;background:rgba(127,127,127,.14);padding:8px;border-radius:6px;font-size:11px}",
    ".tbim-diag-bar{display:flex;gap:8px}",
    "@keyframes tbim-flash{0%{box-shadow:0 0 0 0 rgba(74,222,128,.85)}70%{box-shadow:0 0 0 12px rgba(74,222,128,0)}100%{box-shadow:0 0 0 0 rgba(74,222,128,0)}}",
    ".tbim-gear-flash{animation:tbim-flash 1.4s ease-out 3}",
  ].join("\n");
  (document.head || document.documentElement).appendChild(st);
}

function mkButton(text, title, onClick) {
  const b = document.createElement("button");
  b.className = "tbim-btn";
  b.type = "button";
  b.textContent = text;
  if (title) b.title = title;
  b.setAttribute(MARK, "1");
  b.addEventListener("click", function (e) {
    e.preventDefault();
    e.stopPropagation();
    onClick();
  });
  return b;
}

function buildPanel() {
  ensureUIStyle();
  const mask = document.createElement("div");
  mask.className = "tbim-mask";
  mask.setAttribute(MARK, "1");

  const panel = document.createElement("div");
  panel.className = "tbim-panel";
  panel.setAttribute(MARK, "1");
  mask.appendChild(panel);

  // 标题栏
  const head = document.createElement("div");
  head.className = "tbim-head";
  const title = document.createElement("div");
  title.className = "tbim-title";
  title.textContent = "顶部工具条图标管理";
  const vTag = document.createElement("span");
  vTag.className = "tbim-ver";
  vTag.setAttribute(MARK, "1");
  vTag.textContent = "v" + VERSION;
  vTag.title = "ComfyUI-TopBarIcons 版本";
  title.appendChild(vTag);
  const x = document.createElement("button");
  x.className = "tbim-x";
  x.type = "button";
  x.textContent = "✕";
  x.setAttribute(MARK, "1");
  x.addEventListener("click", closePanel);
  head.appendChild(title);
  head.appendChild(x);
  panel.appendChild(head);

  // 工具行
  const tools = document.createElement("div");
  tools.className = "tbim-tools";
  const search = document.createElement("input");
  search.type = "search";
  search.placeholder = "搜索名称 / 图标…";
  search.setAttribute(MARK, "1");
  tools.appendChild(search);
  tools.appendChild(
    mkButton("全部显示", "恢复显示所有已扫描到的图标", function () {
      Object.keys(itemByKey).forEach(function (k) {
        delete state.hidden[k];
      });
      state.hidden = {};
      saveState();
      refreshPanel();
    })
  );
  tools.appendChild(
    mkButton("仅看已隐藏", "", function () {
      onlyHidden = !onlyHidden;
      refreshPanel();
    })
  );
  tools.appendChild(
    mkButton("导出清单", "复制当前扫描到的图标清单到剪贴板", function () {
      const data = items.map(function (it) {
        return { key: it.key, label: it.label, group: it.group, hidden: isHidden(it.key) };
      });
      const txt = JSON.stringify(data, null, 2);
      try {
        navigator.clipboard.writeText(txt);
        alert("已复制 " + data.length + " 条清单");
      } catch (e) {
        console.log("[TopBarIcons] 清单：", txt);
        alert("剪贴板不可用，清单已输出到控制台");
      }
    })
  );
  tools.appendChild(
    mkButton("重新扫描", "", function () {
      scan();
      refreshPanel();
    })
  );
  panel.appendChild(tools);

  // 选项行
  const opts = document.createElement("div");
  opts.className = "tbim-opts";
  opts.appendChild(
    mkChk("仅图标模式（隐藏按钮文字）", "iconOnly", function () {
      applyIconOnly();
    })
  );
  opts.appendChild(
    mkChk("紧凑间距", "compact", function () {
      applyRules();
    })
  );
  opts.appendChild(
    mkChk("扩展扫描范围（含标签栏徽标）", "wide", function () {
      scan();
      refreshPanel();
    })
  );
  opts.appendChild(
    mkChk("显示齿轮入口", "gearVisible", function () {
      applyGearVisible();
    })
  );
  opts.appendChild(
    mkSelect(
      "齿轮位置",
      "gearPos",
      [
        ["inner", "顶栏内（默认）"],
        ["tr", "右上角固定"],
        ["br", "右下角固定"],
      ],
      function () {
        remountGear();
      }
    )
  );
  panel.appendChild(opts);

  // 列表
  rowBox = document.createElement("div");
  rowBox.className = "tbim-body";
  rowBox.setAttribute(MARK, "1");
  rowBox.addEventListener("wheel", function (e) {
    e.stopPropagation();
  }, { passive: true });
  panel.appendChild(rowBox);

  const tip = document.createElement("div");
  tip.className = "tbim-tip";
  tip.textContent = "取消勾选即隐藏该图标；改动即时生效。按 Esc 或点击空白处关闭。";
  panel.appendChild(tip);

  // 配置存储位置提示（文件 / 仅浏览器）
  storeTagEl = document.createElement("div");
  storeTagEl.className = "tbim-store";
  storeTagEl.setAttribute(MARK, "1");
  panel.appendChild(storeTagEl);
  updateStoreTag();

  mask.addEventListener("mousedown", function (e) {
    if (e.target === mask) closePanel();
  });
  search.addEventListener("input", function () {
    refreshPanel();
  });

  document.body.appendChild(mask);
  panelEl = mask;
  panelEl.__search = search;
  document.addEventListener("keydown", onKey, true);
  return mask;
}

function mkChk(text, field, onChange) {
  const lab = document.createElement("label");
  lab.setAttribute(MARK, "1");
  const cb = document.createElement("input");
  cb.type = "checkbox";
  cb.checked = !!state[field];
  cb.addEventListener("change", function () {
    state[field] = cb.checked;
    saveState();
    onChange();
  });
  lab.appendChild(cb);
  const s = document.createElement("span");
  s.textContent = text;
  lab.appendChild(s);
  return lab;
}

function mkSelect(text, field, options, onChange) {
  const lab = document.createElement("label");
  lab.setAttribute(MARK, "1");
  const s = document.createElement("select");
  s.setAttribute(MARK, "1");
  s.style.fontSize = "12px";
  s.style.borderRadius = "6px";
  s.style.border = "1px solid rgba(127,127,127,.4)";
  s.style.background = "transparent";
  s.style.color = "inherit";
  s.style.padding = "2px 4px";
  options.forEach(function (o) {
    const op = document.createElement("option");
    op.value = o[0];
    op.textContent = o[1];
    if (state[field] === o[0]) op.selected = true;
    s.appendChild(op);
  });
  s.addEventListener("change", function () {
    state[field] = s.value;
    saveState();
    onChange();
  });
  const t = document.createElement("span");
  t.textContent = text;
  lab.appendChild(t);
  lab.appendChild(s);
  return lab;
}

// 齿轮显隐开关变化后统一处理
function applyGearVisible() {
  if (!state.gearVisible) {
    if (gear && gear.isConnected) {
      try {
        gear.remove();
      } catch (e) {
        /* ignore */
      }
    }
    if (gear) gear.__host = null;
  } else {
    const r = hostRoot();
    mountGear(r || document.body);
  }
}

// 重新挂载齿轮（切换位置后）
function remountGear() {
  if (!gear) return;
  try {
    gear.remove();
  } catch (e) {
    /* ignore */
  }
  mountGear(hostRoot() || document.body);
}

let onlyHidden = false;

// 当前列表的签名：key + 显隐状态 + 文案。顶栏频繁变动时只有签名真变了才重建列表，
// 否则面板会每秒被整个重建一遍（视觉上就是「闪烁」）。
let lastPanelSig = null;
function listSignature() {
  return items
    .map(function (it) {
      return it.key + "\u0001" + (isHidden(it.key) ? "h" : "v") + "\u0001" + it.label;
    })
    .join("\u0002");
}

function refreshPanel() {
  if (!panelEl) return;
  lastPanelSig = listSignature();
  const box = rowBox;
  const searchEl = panelEl.__search;
  const q = norm(searchEl && searchEl.value).toLowerCase();
  const scrollTop = box.scrollTop; // 重建后保持滚动位置
  box.textContent = "";

  const visible = items.filter(function (it) {
    if (onlyHidden && !isHidden(it.key)) return false;
    if (!q) return true;
    return (
      (it.label || "").toLowerCase().indexOf(q) >= 0 ||
      (it.key || "").toLowerCase().indexOf(q) >= 0 ||
      (it.group || "").toLowerCase().indexOf(q) >= 0
    );
  });

  if (!visible.length) {
    const e = document.createElement("div");
    e.className = "tbim-empty";
    e.textContent = items.length ? "没有匹配的条目" : "没有扫描到任何工具条元素（ComfyUI 尚未渲染完成？点「重新扫描」试试）";
    box.appendChild(e);
    box.scrollTop = scrollTop;
    return;
  }

  const groups = [];
  const map = Object.create(null);
  visible.forEach(function (it) {
    const g = it.scope + " · " + it.group;
    if (!map[g]) {
      map[g] = [];
      groups.push(g);
    }
    map[g].push(it);
  });

  groups.forEach(function (g) {
    const h = document.createElement("div");
    h.className = "tbim-grp";
    h.textContent = g;
    box.appendChild(h);
    map[g].forEach(function (it) {
      box.appendChild(buildRow(it));
    });
  });
  box.scrollTop = scrollTop;
}

function buildRow(it) {
  const row = document.createElement("label");
  row.className = "tbim-row" + (isHidden(it.key) ? " off" : "");
  row.setAttribute(MARK, "1");
  row.title = it.key;

  const cb = document.createElement("input");
  cb.type = "checkbox";
  cb.checked = !isHidden(it.key);
  cb.addEventListener("change", function () {
    setHidden(it.key, !cb.checked);
    refreshPanel(); // 重建所有行，保证同选择器/同源的行状态一致
  });

  const icWrap = document.createElement("span");
  icWrap.className = "tbim-ic";
  if (it.icon) {
    const clone = it.icon.cloneNode(true);
    clone.removeAttribute && clone.removeAttribute("data-testid");
    icWrap.appendChild(clone);
  } else {
    const dot = document.createElement("span");
    dot.textContent = "●";
    dot.style.fontSize = "10px";
    dot.style.opacity = ".5";
    icWrap.appendChild(dot);
  }

  const lb = document.createElement("span");
  lb.className = "tbim-lb";
  lb.textContent = it.label;

  const key = document.createElement("span");
  key.className = "tbim-key";
  key.textContent = it.key;

  row.appendChild(cb);
  row.appendChild(icWrap);
  row.appendChild(lb);
  row.appendChild(key);
  return row;
}

function onKey(e) {
  if (e.key === "Escape") closePanel();
}

function openPanel() {
  scan();
  if (!panelEl) buildPanel();
  panelEl.style.display = "flex";
  refreshPanel();
}

function closePanel() {
  if (!panelEl) return;
  panelEl.style.display = "none";
  document.removeEventListener("keydown", onKey, true);
}

/* -------------------------------- 齿轮 ---------------------------------- */
let gear = null;

function createGear() {
  const b = document.createElement("button");
  b.className = "tbim-gear";
  b.type = "button";
  b.title = "工具条图标管理（ComfyUI-TopBarIcons）";
  b.setAttribute("aria-label", "工具条图标管理");
  b.setAttribute(MARK, "1");
  b.innerHTML =
    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" ' +
    'stroke-linecap="round" stroke-linejoin="round" width="16" height="16">' +
    '<line x1="4" y1="21" x2="4" y2="14"></line>' +
    '<line x1="4" y1="10" x2="4" y2="3"></line>' +
    '<line x1="12" y1="21" x2="12" y2="12"></line>' +
    '<line x1="12" y1="8" x2="12" y2="3"></line>' +
    '<line x1="20" y1="21" x2="20" y2="16"></line>' +
    '<line x1="20" y1="12" x2="20" y2="3"></line>' +
    '<line x1="1" y1="14" x2="7" y2="14"></line>' +
    '<line x1="9" y1="8" x2="15" y2="8"></line>' +
    '<line x1="17" y1="16" x2="23" y2="16"></line></svg>';
  b.addEventListener("mousedown", function (e) {
    e.preventDefault(); // 避免画布失焦
  });
  b.addEventListener("click", function (e) {
    e.preventDefault();
    e.stopPropagation();
    if (panelEl && panelEl.style.display !== "none") closePanel();
    else openPanel();
  });
  return b;
}

// 元素是否真的「看得见」（尺寸/可见性/是否在视口内）
function isVisible(el) {
  if (!el || !el.isConnected) return false;
  if (typeof el.getBoundingClientRect !== "function") return true;
  let r = null;
  try {
    r = el.getBoundingClientRect();
  } catch (e) {
    return true;
  }
  if (!r || r.width < 6 || r.height < 6) return false;
  if (typeof getComputedStyle === "function") {
    const cs = getComputedStyle(el);
    if (cs.display === "none" || cs.visibility === "hidden") return false;
    if (parseFloat(cs.opacity) < 0.05) return false;
  }
  const vw = (typeof window !== "undefined" && window.innerWidth) || 1e9;
  const vh = (typeof window !== "undefined" && window.innerHeight) || 1e9;
  // 必须完整落在视口内：被 overflow:hidden 裁掉（跑到屏幕外）的也算不可见
  if (!(r.left >= -2 && r.top >= -2 && r.right <= vw + 2 && r.bottom <= vh + 2)) return false;
  // 命中测试：被祖先 overflow 裁掉 / 被别的元素盖住时，点不到自己 → 视作不可见
  if (typeof document.elementFromPoint === "function") {
    try {
      const cx = r.left + r.width / 2;
      const cy = r.top + r.height / 2;
      const hit = document.elementFromPoint(cx, cy);
      if (hit && hit !== el && !el.contains(hit) && !hit.contains(el)) {
        // 盖住它的是我们自己的模态面板/诊断框时不算遮挡
        //（否则面板开着时重挂齿轮，会被遮罩误判成不可见而降级成悬浮）
        if (hit.closest && hit.closest("[" + MARK + "]")) return true;
        return false;
      }
    } catch (e) {
      /* ignore */
    }
  }
  return true;
}

function describeEl(el) {
  if (!el) return "null";
  return (
    (el.getAttribute && el.getAttribute("data-testid")) ||
    el.id ||
    String(el.className || "").slice(0, 40) ||
    (el.tagName || "?").toLowerCase()
  );
}

function mountGear(root) {
  if (!gear) gear = createGear();
  // 开关关闭：齿轮入口整体移除
  if (state.gearVisible === false) {
    if (gear.isConnected) {
      try {
        gear.remove();
      } catch (e) {
        /* ignore */
      }
    }
    gear.__host = null;
    gear.__floating = false; // 清掉悬浮标记，重开时按当前 gearPos 重新挂载
    gear.classList.remove("tbim-gear-float", "tbim-gear-float-tr", "tbim-gear-float-br");
    return;
  }
  if (gear.isConnected && isVisible(gear) && !gear.__floating) return;
  if (gear.__floating && isVisible(gear)) return;

  // 用户手动指定了固定位置 → 直接钉在屏幕角落，不再往顶栏里塞
  if (state.gearPos && state.gearPos !== "inner") {
    if (gear.parentElement !== document.body) {
      try {
        document.body.appendChild(gear);
      } catch (e) {
        /* ignore */
      }
    }
    gear.__floating = true;
    gear.classList.remove("tbim-gear-float-tr", "tbim-gear-float-br");
    gear.classList.add(
      state.gearPos === "br" ? "tbim-gear-float-br" : "tbim-gear-float-tr"
    );
    gear.__host = "body(固定:" + state.gearPos + ")";
    return;
  }
  gear.classList.remove("tbim-gear-float-tr", "tbim-gear-float-br");

  const hosts = [
    root.querySelector('[data-testid="action-bar-card"] > div'),
    root.querySelector(".actionbar-container"),
    root.querySelector('[data-testid="action-bar-buttons"]'),
    root.querySelector('[data-testid="action-bar-card"]'),
    root.querySelector(".comfy-menu-right"),
    root,
  ];
  for (let i = 0; i < hosts.length; i++) {
    const h = hosts[i];
    if (!h) continue;
    try {
      h.appendChild(gear);
    } catch (e) {
      continue;
    }
    if (isVisible(gear)) {
      gear.__floating = false;
      gear.classList.remove("tbim-gear-float");
      gear.__host = describeEl(h);
      if (!gear.__announced) {
        gear.__announced = true;
        gear.classList.add("tbim-gear-flash");
        setTimeout(function () {
          gear.classList.remove("tbim-gear-flash");
        }, 4200);
        console.log("[TopBarIcons] 齿轮按钮挂载于：" + gear.__host);
      }
      return;
    }
  }

  // 全部候选位置都不可见 → 兜底：固定在右上角（纯图标，不占空间）
  if (gear.parentElement !== document.body) {
    try {
      document.body.appendChild(gear);
    } catch (e) {
      /* ignore */
    }
  }
  gear.__floating = true;
  gear.classList.add("tbim-gear-float");
  gear.__host = "body(悬浮兜底)";
}

/* ------------------------------ 生命周期 -------------------------------- */
let observeTimer = null;
let observedTarget = null;
let observer = null;

function hostRoot() {
  // 齿轮挂载的主容器：新版取 actionbars，旧版退回 comfy-menu
  return document.querySelector(SCOPES[0].sel) || document.querySelector(FALLBACK_SCOPES[0].sel);
}

function getMainRoot() {
  return hostRoot();
}

function tick() {
  const root = getMainRoot();
  if (!root) return false;
  scan();
  mountGear(root);
  watch(root);
  return true;
}

function watch(el) {
  if (observer && observedTarget === el) return;
  stopWatch();
  observedTarget = el;
  if (typeof MutationObserver === "undefined") return;
  observer = new MutationObserver(function () {
    if (observeTimer) return;
    observeTimer = setTimeout(function () {
      observeTimer = null;
      if (observedTarget && observedTarget.isConnected) {
        scan();
        if (panelEl && panelEl.style.display !== "none") {
          // 列表没变化就不重建（顶栏秒级跳动/徽标刷新不该让面板闪烁）
          const sig = listSignature();
          if (sig !== lastPanelSig) refreshPanel();
        }
      }
    }, 250);
  });
  observer.observe(el, { childList: true, subtree: true });
}

function stopWatch() {
  if (observer) {
    try {
      observer.disconnect();
    } catch (e) {
      /* ignore */
    }
  }
  observer = null;
  observedTarget = null;
}

const RETRY = [0, 120, 400, 900, 1800, 3200, 6000, 10000, 16000];

let rootWarned = false;

function boot(idx) {
  idx = idx || 0;
  if (tick()) return;
  if (idx >= RETRY.length) {
    idx = RETRY.length - 1;
    if (!rootWarned) {
      rootWarned = true;
      console.warn(
        "[TopBarIcons] 没找到顶栏容器（" + SCOPES[0].sel + " / " + FALLBACK_SCOPES[0].sel + "），请用 ?tbim=diag 排查"
      );
    }
  }
  setTimeout(function () {
    boot(idx + 1);
  }, RETRY[Math.min(idx, RETRY.length - 1)]);
}

// 兜底：万一整个容器被 Vue 重建导致 observer 失效
setInterval(function () {
  const root = getMainRoot();
  if (!root) return;
  if (observedTarget !== root) {
    if (tick()) return;
  }
}, 3000);

/* ------------------------------ 注册扩展 -------------------------------- */
try {
  app.registerExtension({
    name: EXT_NAME,
    settings: [
      {
        id: "TopBarIcons.Toolbar.OpenPanel",
        name: "打开工具条图标管理面板",
        defaultValue: null,
        category: ["TopBarIcons", "工具条", "打开管理面板"],
        tooltip: "隐藏/显示顶部工具条上的任意图标按钮",
        type: function renderOpenButton() {
          const b = document.createElement("button");
          b.textContent = "打开管理面板";
          b.setAttribute(MARK, "1");
          b.onclick = function (e) {
            e.preventDefault();
            e.stopPropagation();
            openPanel();
          };
          return b;
        },
      },
      {
        id: "TopBarIcons.Toolbar.ResetAll",
        name: "恢复全部显示",
        defaultValue: null,
        category: ["TopBarIcons", "工具条", "恢复全部显示"],
        tooltip: "清空所有隐藏规则",
        type: function renderResetButton() {
          const b = document.createElement("button");
          b.textContent = "恢复全部显示";
          b.setAttribute(MARK, "1");
          b.onclick = function (e) {
            e.preventDefault();
            e.stopPropagation();
            state.hidden = {};
            state.iconOnly = false;
            state.compact = false;
            saveState();
            scan();
            alert("[TopBarIcons] 已恢复全部显示");
          };
          return b;
        },
      },
    ],
  });
} catch (e) {
  console.warn("[TopBarIcons] registerExtension 失败:", e);
}

// 调试入口
window.TopBarIcons = {
  version: VERSION,
  open: openPanel,
  close: closePanel,
  scan: scan,
  state: function () {
    return state;
  },
  items: function () {
    return items;
  },
  // 强制重新挂载齿轮（排查用）
  mount: function () {
    const r = hostRoot();
    if (!r) return null;
    scan();
    if (gear) {
      try {
        gear.remove();
      } catch (e) {
        /* ignore */
      }
    }
    mountGear(r);
    return gear ? gear.__host || "(unknown)" : null;
  },
  // 配置来源：file（插件目录 config.json）/ local（仅当前浏览器）
  store: function () {
    return storeMode;
  },
  // 立即保存一次配置（调试用）
  save: function () {
    saveState();
    return storeMode;
  },
  // 重新从插件目录拉取配置
  reload: function () {
    return loadRemote().then(function (ok) {
      scan();
      if (panelEl && panelEl.style.display !== "none") refreshPanel();
      return ok;
    });
  },
  // 排查「齿轮不见了」用：在控制台执行 TopBarIcons.diag()，把结果贴出来
  diag: function () {
    const root = hostRoot();
    const g = gear || null;
    let rect = null;
    if (g && typeof g.getBoundingClientRect === "function") {
      try {
        const r = g.getBoundingClientRect();
        rect = { x: Math.round(r.x), y: Math.round(r.y), w: Math.round(r.width), h: Math.round(r.height) };
      } catch (e) {
        rect = "err";
      }
    }
    const st = document.getElementById(STYLE_ID);
    return {
      version: VERSION,
      store: storeMode, // file | local
      remoteOK: remoteOK,
      configPath: remotePath,
      mode: document.querySelector(SCOPES[0].sel) ? "new-topbar" : "legacy-fallback",
      rootFound: !!root,
      root: root ? describeEl(root) : null,
      itemCount: items.length,
      hiddenCount: Object.keys(state.hidden).length,
      gear: g
        ? {
            connected: !!g.isConnected,
            host: g.__host || null,
            floating: !!g.__floating,
            visible: isVisible(g),
            rect: rect,
          }
        : null,
      rules: st ? st.textContent : null,
    };
  },
};

// URL 加 ?tbim=diag 时自动弹出诊断框，不用开控制台
function diagJSON() {
  try {
    return JSON.stringify(window.TopBarIcons.diag(), null, 2);
  } catch (e) {
    return "diag 失败: " + e;
  }
}

function showDiagBox() {
  if (document.getElementById("tbim-diag")) return;
  const box = document.createElement("div");
  box.id = "tbim-diag";
  box.setAttribute(MARK, "1");
  box.className = "tbim-diag";
  const t = document.createElement("div");
  t.className = "tbim-diag-title";
  t.textContent = "TopBarIcons 诊断信息 v" + VERSION + "（复制后发给开发者）";
  const pre = document.createElement("pre");
  pre.className = "tbim-diag-pre";
  pre.textContent = diagJSON();
  const bar = document.createElement("div");
  bar.className = "tbim-diag-bar";
  const copy = mkButton("复制诊断信息", "", function () {
    try {
      navigator.clipboard.writeText(pre.textContent);
      copy.textContent = "已复制 ✓";
    } catch (e) {
      copy.textContent = "复制失败，请手动选中";
    }
  });
  const refresh = mkButton("刷新", "", function () {
    scan();
    pre.textContent = diagJSON();
  });
  const close = mkButton("关闭", "", function () {
    box.remove();
  });
  bar.appendChild(copy);
  bar.appendChild(refresh);
  bar.appendChild(close);
  box.appendChild(t);
  box.appendChild(pre);
  box.appendChild(bar);
  box.addEventListener("wheel", function (e) {
    e.stopPropagation();
  }, { passive: true });
  document.body.appendChild(box);
}

// 快捷键兜底：Ctrl+Alt+G 开关面板（齿轮被藏起来也能用）
document.addEventListener(
  "keydown",
  function (e) {
    if (!e.ctrlKey || !e.altKey) return;
    const k = (e.key || "").toLowerCase();
    if (k !== "g") return;
    e.preventDefault();
    e.stopPropagation();
    if (panelEl && panelEl.style.display !== "none") closePanel();
    else openPanel();
  },
  true
);

console.log(
  "%c[TopBarIcons] v" +
    VERSION +
    " 顶部图标管理器已就绪：点击工具条右侧齿轮图标开始管理（或按 Ctrl+Alt+G）",
  "color:#4ade80"
);

// ?tbim=diag 时页面加载后自动弹诊断框
(function () {
  let want = false;
  try {
    want = typeof location !== "undefined" && /[?&]tbim=diag/.test(location.search || "");
  } catch (e) {
    want = false;
  }
  if (!want) return;
  const tries = [0, 800, 2000, 4000, 8000];
  let i = 0;
  (function step() {
    scan();
    if (i === tries.length - 1 || hostRoot()) {
      showDiagBox();
      return;
    }
    setTimeout(step, tries[++i]);
  })();
})();

boot(0);

// 启动后拉取插件目录里的配置（config.json），拿到就覆盖本地、并以文件为准
loadRemote().then(function (ok) {
  if (!ok) return;
  scan();
  if (panelEl && panelEl.style.display !== "none") refreshPanel();
});
