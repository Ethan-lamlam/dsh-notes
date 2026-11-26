# dsh-notes-tab

> 给 [DeepSeek Harness](https://github.com/deepseek-ai/deepseek-harness)（`dsh`）的右侧栏「笔记」标签页：**所见即所得的本地 Markdown 笔记本**。不打开 Obsidian、不连云、不需要额外服务。

在一个标签页里直接写、直接看效果：标题就是大字号，列表就是圆点，图片直接显示。数据始终是你磁盘上的 `.md` 文件。

## 特性

- **WYSIWYG 编辑器**：内容以渲染后的样子呈现，光标直接在渲染结果里编辑（不是分屏预览）
- **飞书式快捷键**：`Ctrl+1/2/3` 标题、`Ctrl+0` 正文、`Ctrl+B/I`、`Ctrl+Shift+7/8/9` 列表与引用、`Ctrl+S` 保存
- **内联图片**：`Ctrl+V` 直接粘贴截图，自动存进 `attachments/` 并就地显示；也可用工具栏「Image」选文件
- **本地优先**：笔记是普通 Markdown 文件，图片是同目录下的普通文件，可被 Obsidian / Git / 任何编辑器读取
- **文件管理**：新建（支持 `论文/摘要` 子目录）、删除（两步确认防误触）、刷新
- **无外部依赖**：宿主端零 npm 依赖，客户端只依赖 `react`（DSH 自带）
- **同源路由**：所有读写走 DSH 自己的 web server（`/notes-tab/api/*`），没有额外端口、没有后台进程

## 安装

要求：DeepSeek Harness **0.2.1+**（Web 或 Desktop），Node `^22.19 || >=24`。

### 从 GitHub 安装

```sh
dsh plugin --profile web add github:Ethan-lamlam/dsh-notes-tab
# Desktop 用户把 web 换成 desktop
```

### 从本地目录安装（开发）

```sh
dsh plugin --profile web add /path/to/dsh-notes-tab
```

### 在 GUI 里安装

左侧「插件」→「安装插件」→ 输入包名或仓库地址 → 安装 → **重启 DSH**（bundle 层在启动时装配）。

## 使用

1. 左侧栏底部点 **📓 Notes**（或右侧栏 `+` → 笔记）
2. 右侧栏出现「Notes」标签页
3. 首次使用会自动创建 vault：`~/dsh-notes`（可用配置改）

### 快捷键

| 操作 | 快捷键 |
| --- | --- |
| 一级 / 二级 / 三级标题 | `Ctrl+1` / `Ctrl+2` / `Ctrl+3` |
| 正文 | `Ctrl+0` |
| 加粗 / 斜体 | `Ctrl+B` / `Ctrl+I` |
| 无序列表 | `Ctrl+Shift+8` |
| 有序列表 | `Ctrl+Shift+7` |
| 引用 | `Ctrl+Shift+9` |
| 保存 | `Ctrl+S` |

macOS 上把 `Ctrl` 换成 `Cmd`。

## 配置

在 profile 的 `cordis.patch.yml` 里覆盖：

```yaml
- id: notes-tab
  name: dsh-notes-tab
  config:
    vault: D:/Notes        # 笔记根目录，默认 ~/dsh-notes
```

修改后重启 DSH。

## 数据与格式

- 笔记：`<vault>/*.md`，UTF-8 Markdown
- 图片：`<vault>/attachments/<时间戳>-<随机>.<ext>`，笔记里以相对路径引用：`![图片](attachments/xxx.png)`
- 保存时由富文本序列化回 Markdown，因此文件始终是纯文本

## 兼容与限制

- 编辑器基于 `contenteditable`（`document.execCommand`），轻量、无第三方依赖
- 支持的往返结构：标题、段落、粗体、斜体、行内代码、链接、图片、有序/无序列表、引用、代码块、分割线
- **表格、Mermaid、嵌套列表**这类复杂结构会被简化成纯文本，不做原样往返
- 从网页复制的富文本按纯文本粘贴，避免带入外部样式

## 安全

- 所有路由挂在 DSH 的 web server 上，继承 DSH 的登录态与同源策略
- 路径经过规范化与根目录校验，不能越出 vault
- 单篇笔记上限 1 MB，单张图片上限 20 MB
- 插件不发起任何外部网络请求

## 开发

```sh
git clone https://github.com/Ethan-lamlam/dsh-notes-tab
cd dsh-notes-tab
# 宿主端零依赖；客户端是手写 React（window.__ModuleLoader__）
dsh plugin --profile web add "$(pwd)"
```

仓库结构：

| 路径 | 作用 |
| --- | --- |
| `index.js` | 宿主端：`/notes-tab/api/*` 路由、vault 解析、路径校验 |
| `client.js` | 浏览器端：右侧栏 Tab 注册、WYSIWYG 编辑器、快捷键 |
| `cordis.patch.yml` | bundle 层，插入插件行 |

## License

MIT © Ethan-lamlam
