# dsh-notes-tab

A **WYSIWYG local Markdown notebook** for [DeepSeek Harness](https://github.com/deepseek-ai/deepseek-harness) (`dsh`), living in the right sidebar as a native tab.

Type directly in the rendered view — headings look like headings, lists look like lists, pasted images show inline. Everything stays as plain `.md` files on your disk.

## Features

- **WYSIWYG editing** — no split pane; the editor *is* the rendered document
- **Feishu-style shortcuts** — `Ctrl+1/2/3` headings, `Ctrl+0` paragraph, `Ctrl+B/I`, `Ctrl+Shift+7/8/9` lists/quote, `Ctrl+S` save
- **Inline images** — paste a screenshot with `Ctrl+V`; it is stored under `attachments/` and rendered in place
- **Local-first** — notes and images are ordinary files, readable by Obsidian, Git, any editor
- **File management** — create (subfolders supported), delete (two-step confirm), refresh
- **No external service** — host half has zero npm dependencies; all traffic goes through DSH's own same-origin routes (`/notes-tab/api/*`)

## Install

Requires DeepSeek Harness **0.2.1+**, Node `^22.19 || >=24`.

```sh
dsh plugin --profile web add github:Ethan-lamlam/dsh-notes-tab
# use --profile desktop on the Desktop app
```

Restart DSH after installing (the bundle layer is composed at startup).

## Usage

1. Click **📓 Notes** at the bottom of the left sidebar (or `+` in the right sidebar → Notes)
2. A **Notes** tab opens on the right
3. The vault defaults to `~/dsh-notes`

### Shortcuts

| Action | Key |
| --- | --- |
| Heading 1 / 2 / 3 | `Ctrl+1` / `Ctrl+2` / `Ctrl+3` |
| Paragraph | `Ctrl+0` |
| Bold / Italic | `Ctrl+B` / `Ctrl+I` |
| Bullet list | `Ctrl+Shift+8` |
| Numbered list | `Ctrl+Shift+7` |
| Quote | `Ctrl+Shift+9` |
| Save | `Ctrl+S` |

## Configuration

```yaml
- id: notes-tab
  name: dsh-notes-tab
  config:
    vault: D:/Notes        # defaults to ~/dsh-notes
```

## Data

- Notes: `<vault>/*.md` (UTF-8 Markdown)
- Images: `<vault>/attachments/<timestamp>-<random>.<ext>`, referenced as `![image](attachments/xxx.png)`

## Limitations

- Built on `contenteditable` + `document.execCommand` (lightweight, no third-party editor)
- Round-trips: headings, paragraphs, bold, italic, inline code, links, images, lists, quotes, code blocks, rules
- Tables, Mermaid and deeply nested lists degrade to plain text
- Rich text pasted from the web is inserted as plain text

## License

MIT © Ethan-lamlam
