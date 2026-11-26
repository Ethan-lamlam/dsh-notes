/**
 * dsh-notes-tab — browser half.
 *
 * Registers a right-Sidebar tab type ("notes") and its body: a WYSIWYG
 * Markdown notebook (rendered in place, edited directly) backed by the
 * plugin's own same-origin routes under /notes-tab/api.
 *
 * Also adds a small "📓 Notes" button to the left-sidebar footer that opens
 * the tab. If tab registration is unavailable, the button falls back to the
 * tab guide (openTab("guide")).
 */
window.__ModuleLoader__.load({
  id: "dsh-notes-tab",
  factory: (require) => {
    const React = require("react");
    const h = React.createElement;

    const TAB_ID = "dsh-notes-tab";
    const TAB_KIND = "notes";
    const API = "/notes-tab/api";
    const inject = ["slots", "sidebarRight", "sidebarRightTabs"];

    const assetUrl = (src) =>
      /^(https?:|data:|\/)/i.test(src) ? src : `${API}/asset?path=${encodeURIComponent(src)}`;

    const imgSrcToPath = (src) => {
      try {
        const url = new URL(src, location.origin);
        if (url.pathname === `${API}/asset`) return decodeURIComponent(url.searchParams.get("path") || "");
        return src;
      } catch {
        return src;
      }
    };

    // ------------------------------------------------------- markdown -> html
    function markdownToHtml(md) {
      const esc = (s) => s.replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
      const lines = md.replace(/\r\n/g, "\n").split("\n");
      const out = [];
      let inCode = false;
      let listTag = null;
      let para = [];
      const inline = (raw) => {
        let t = esc(raw);
        t = t.replace(/!\[([^\]]*)\]\(([^)\s]+)\)/g, (_m, alt, src) => `<img alt="${alt}" src="${assetUrl(src)}" />`);
        t = t.replace(/`([^`]+)`/g, "<code>$1</code>");
        t = t.replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>");
        t = t.replace(/(^|[^*])\*([^*]+)\*/g, "$1<em>$2</em>");
        t = t.replace(/\[([^\]]+)\]\((https?:[^)\s]+)\)/g, '<a href="$2" target="_blank" rel="noreferrer">$1</a>');
        return t;
      };
      const flushPara = () => {
        if (para.length) {
          out.push("<p>" + inline(para.join(" ")) + "</p>");
          para = [];
        }
      };
      const closeList = () => {
        if (listTag) {
          out.push(`</${listTag}>`);
          listTag = null;
        }
      };
      for (const line of lines) {
        if (/^```/.test(line)) {
          flushPara(); closeList();
          if (!inCode) { out.push("<pre><code>"); inCode = true; } else { out.push("</code></pre>"); inCode = false; }
          continue;
        }
        if (inCode) { out.push(esc(line) + "\n"); continue; }
        const hm = /^(#{1,6})\s+(.*)$/.exec(line);
        if (hm) {
          flushPara(); closeList();
          out.push(`<h${hm[1].length}>${inline(hm[2])}</h${hm[1].length}>`);
          continue;
        }
        if (/^\s*[-*+]\s+/.test(line)) {
          flushPara();
          if (listTag !== "ul") { closeList(); out.push("<ul>"); listTag = "ul"; }
          out.push("<li>" + inline(line.replace(/^\s*[-*+]\s+/, "")) + "</li>");
          continue;
        }
        if (/^\s*\d+\.\s+/.test(line)) {
          flushPara();
          if (listTag !== "ol") { closeList(); out.push("<ol>"); listTag = "ol"; }
          out.push("<li>" + inline(line.replace(/^\s*\d+\.\s+/, "")) + "</li>");
          continue;
        }
        if (/^\s*>\s?/.test(line)) {
          flushPara(); closeList();
          out.push("<blockquote>" + inline(line.replace(/^\s*>\s?/, "")) + "</blockquote>");
          continue;
        }
        if (/^\s*(---|\*\*\*)\s*$/.test(line)) { flushPara(); closeList(); out.push("<hr />"); continue; }
        if (line.trim() === "") { flushPara(); closeList(); continue; }
        para.push(line.trim());
      }
      flushPara(); closeList();
      if (inCode) out.push("</code></pre>");
      return out.join("\n");
    }

    // ------------------------------------------------------- html -> markdown
    function domToMarkdown(root) {
      const inline = (el) => {
        let out = "";
        for (const node of el.childNodes) {
          if (node.nodeType === 3) {
            out += node.nodeValue.replace(/\u00a0/g, " ");
          } else if (node.nodeType === 1) {
            const tag = node.tagName.toLowerCase();
            if (tag === "br") out += "\n";
            else if (tag === "strong" || tag === "b") out += `**${inline(node)}**`;
            else if (tag === "em" || tag === "i") out += `*${inline(node)}*`;
            else if (tag === "code") out += `\`${node.textContent}\``;
            else if (tag === "a") out += `[${inline(node)}](${node.getAttribute("href") || ""})`;
            else if (tag === "img") out += `![${node.getAttribute("alt") || "image"}](${imgSrcToPath(node.getAttribute("src") || "")})`;
            else out += inline(node);
          }
        }
        return out;
      };
      const blocks = [];
      const walk = (el) => {
        for (const node of el.childNodes) {
          if (node.nodeType === 3) {
            const text = node.nodeValue.replace(/\u00a0/g, " ").trim();
            if (text) blocks.push(text);
            continue;
          }
          if (node.nodeType !== 1) continue;
          const tag = node.tagName.toLowerCase();
          if (/^h[1-6]$/.test(tag)) {
            blocks.push("#".repeat(Number(tag[1])) + " " + inline(node).trim());
          } else if (tag === "p" || tag === "div") {
            const text = inline(node).trim();
            if (text) blocks.push(text);
            else walk(node);
          } else if (tag === "ul" || tag === "ol") {
            let index = 1;
            for (const li of node.children) {
              const text = inline(li).trim();
              if (!text) continue;
              blocks.push(tag === "ul" ? `- ${text}` : `${index++}. ${text}`);
            }
          } else if (tag === "blockquote") {
            const text = inline(node).trim();
            if (text) blocks.push("> " + text);
          } else if (tag === "pre") {
            blocks.push("```\n" + node.textContent.replace(/\n$/, "") + "\n```");
          } else if (tag === "hr") {
            blocks.push("---");
          } else if (tag === "img") {
            blocks.push(`![${node.getAttribute("alt") || "image"}](${imgSrcToPath(node.getAttribute("src") || "")})`);
          } else if (tag === "br") {
            blocks.push("");
          } else {
            walk(node);
          }
        }
      };
      walk(root);
      return blocks.join("\n\n").trim() + (blocks.length ? "\n" : "");
    }

    const EDITOR_CSS = `
      .dsh-notes-editor { outline: none; font-size: 13px; line-height: 1.75; overflow: auto; }
      .dsh-notes-editor:empty:before { content: attr(data-placeholder); color: #999; }
      .dsh-notes-editor h1 { font-size: 1.5em; margin: .55em 0 .25em; font-weight: 700; }
      .dsh-notes-editor h2 { font-size: 1.3em; margin: .5em 0 .25em; font-weight: 700; }
      .dsh-notes-editor h3 { font-size: 1.15em; margin: .45em 0 .2em; font-weight: 600; }
      .dsh-notes-editor p { margin: .35em 0; }
      .dsh-notes-editor ul, .dsh-notes-editor ol { padding-left: 1.5em; margin: .3em 0; }
      .dsh-notes-editor blockquote { border-left: 3px solid rgba(127,127,127,.35); margin: .4em 0; padding: .1em 0 .1em .7em; color: #888; }
      .dsh-notes-editor pre { background: rgba(127,127,127,.12); padding: 8px 10px; border-radius: 6px; overflow: auto; }
      .dsh-notes-editor code { background: rgba(127,127,127,.14); padding: 0 4px; border-radius: 4px; }
      .dsh-notes-editor img { max-width: 100%; border-radius: 6px; display: block; margin: 6px 0; }
      .dsh-notes-editor a { color: #3b6ef6; text-decoration: underline; }
      .dsh-notes-editor hr { border: 0; border-top: 1px solid rgba(127,127,127,.3); margin: 1em 0; }
    `;

    function btnStyle(extra) {
      return {
        border: "1px solid var(--dsw-alias-border-secondary, rgba(127,127,127,0.28))",
        background: "transparent",
        color: "inherit",
        borderRadius: "6px",
        padding: "2px 7px",
        font: "inherit",
        fontSize: "12px",
        cursor: "pointer",
        flexShrink: 0,
        ...extra,
      };
    }

    // ------------------------------------------------------------ notes pane
    function NotesPane() {
      const [files, setFiles] = React.useState([]);
      const [current, setCurrent] = React.useState(null);
      const [dirty, setDirty] = React.useState(false);
      const [msg, setMsg] = React.useState("");
      const [newName, setNewName] = React.useState(null);
      const [loading, setLoading] = React.useState(true);
      const [pendingDelete, setPendingDelete] = React.useState(null);
      const [rootInfo, setRootInfo] = React.useState(null);
      const editorRef = React.useRef(null);
      const fileInputRef = React.useRef(null);
      const currentRef = React.useRef(null);

      React.useEffect(() => {
        if (document.getElementById("dsh-notes-editor-css")) return;
        const style = document.createElement("style");
        style.id = "dsh-notes-editor-css";
        style.textContent = EDITOR_CSS;
        document.head.appendChild(style);
      }, []);

      const flash = (message) => {
        setMsg(message);
        setTimeout(() => setMsg((cur) => (cur === message ? "" : cur)), 1600);
      };

      const loadFiles = React.useCallback(async () => {
        try {
          const res = await fetch(`${API}/files`);
          const data = await res.json();
          setFiles(data.entries || []);
          if (data.root) setRootInfo(data.root);
        } catch (error) {
          setMsg("Cannot read notes: " + error.message);
        } finally {
          setLoading(false);
        }
      }, []);

      React.useEffect(() => { loadFiles(); }, [loadFiles]);

      const openFile = async (rel) => {
        if (dirty && currentRef.current) await saveFile();
        try {
          const res = await fetch(`${API}/file?path=` + encodeURIComponent(rel));
          const data = await res.json();
          if (data.error) throw new Error(data.error);
          setCurrent(rel);
          currentRef.current = rel;
          setDirty(false);
          setMsg("");
          requestAnimationFrame(() => {
            if (editorRef.current) editorRef.current.innerHTML = markdownToHtml(data.text || "");
          });
        } catch (error) {
          setMsg("Open failed: " + error.message);
        }
      };

      const saveFile = async () => {
        const rel = currentRef.current;
        if (!rel) return;
        const el = editorRef.current;
        const markdown = el ? domToMarkdown(el) : "";
        try {
          const res = await fetch(`${API}/file`, {
            method: "POST",
            headers: { "content-type": "application/json" },
            body: JSON.stringify({ path: rel, text: markdown }),
          });
          const data = await res.json();
          if (!res.ok || data.error) throw new Error(data.error || `HTTP ${res.status}`);
          setDirty(false);
          flash("Saved");
          loadFiles();
        } catch (error) {
          setMsg("Save failed: " + error.message);
        }
      };

      const createFile = async () => {
        const name = (newName || "").trim();
        if (!name) return;
        try {
          const res = await fetch(`${API}/create`, {
            method: "POST",
            headers: { "content-type": "application/json" },
            body: JSON.stringify({ path: name }),
          });
          const data = await res.json();
          if (!res.ok || data.error) throw new Error(data.error || `HTTP ${res.status}`);
          setNewName(null);
          await loadFiles();
          setCurrent(data.path);
          currentRef.current = data.path;
          setDirty(false);
          requestAnimationFrame(() => {
            if (editorRef.current) {
              editorRef.current.innerHTML = markdownToHtml("# " + name.replace(/\.md$/i, "").split("/").pop() + "\n\n");
            }
          });
        } catch (error) {
          setMsg("Create failed: " + error.message);
        }
      };

      const deleteFile = async (rel) => {
        try {
          const res = await fetch(`${API}/delete`, {
            method: "POST",
            headers: { "content-type": "application/json" },
            body: JSON.stringify({ path: rel }),
          });
          const data = await res.json();
          if (!res.ok || data.error) throw new Error(data.error || `HTTP ${res.status}`);
          if (currentRef.current === rel) {
            setCurrent(null);
            currentRef.current = null;
            if (editorRef.current) editorRef.current.innerHTML = "";
            setDirty(false);
          }
          setPendingDelete(null);
          flash("Deleted");
          loadFiles();
        } catch (error) {
          setMsg("Delete failed: " + error.message);
        }
      };

      const exec = (command, value) => {
        const el = editorRef.current;
        if (!el) return;
        el.focus();
        try {
          document.execCommand(command, false, value);
        } catch (error) {
          console.error("[notes-tab] execCommand failed", command, error);
        }
        setDirty(true);
      };

      const insertImage = (src) => {
        const el = editorRef.current;
        if (!el) return;
        el.focus();
        document.execCommand("insertImage", false, src);
        setDirty(true);
      };

      const uploadAndInsert = async (file) => {
        flash("Uploading image…");
        try {
          const dataUrl = await new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = () => resolve(reader.result);
            reader.onerror = reject;
            reader.readAsDataURL(file);
          });
          const res = await fetch(`${API}/upload`, {
            method: "POST",
            headers: { "content-type": "application/json" },
            body: JSON.stringify({ dataUrl }),
          });
          const data = await res.json();
          if (!res.ok || data.error) throw new Error(data.error || `HTTP ${res.status}`);
          insertImage(assetUrl(data.path));
          flash("Image inserted");
        } catch (error) {
          setMsg("Image upload failed: " + error.message);
        }
      };

      const onKeyDown = (e) => {
        const ctrl = e.ctrlKey || e.metaKey;
        if (ctrl && e.key.toLowerCase() === "s") { e.preventDefault(); saveFile(); return; }
        if (ctrl && !e.shiftKey && e.key.toLowerCase() === "b") { e.preventDefault(); exec("bold"); return; }
        if (ctrl && !e.shiftKey && e.key.toLowerCase() === "i") { e.preventDefault(); exec("italic"); return; }
        if (ctrl && !e.shiftKey && /^[0-3]$/.test(e.key)) {
          e.preventDefault();
          exec("formatBlock", e.key === "0" ? "p" : `h${e.key}`);
          return;
        }
        if (ctrl && e.shiftKey && e.code === "Digit7") { e.preventDefault(); exec("insertOrderedList"); return; }
        if (ctrl && e.shiftKey && e.code === "Digit8") { e.preventDefault(); exec("insertUnorderedList"); return; }
        if (ctrl && e.shiftKey && e.code === "Digit9") { e.preventDefault(); exec("formatBlock", "blockquote"); return; }
      };

      const onPaste = async (e) => {
        const data = e.clipboardData;
        if (!data) return;
        const items = data.items ? Array.from(data.items) : [];
        const imageItem = items.find((item) => item.type && item.type.startsWith("image/"));
        if (imageItem) {
          e.preventDefault();
          const file = imageItem.getAsFile();
          if (file) await uploadAndInsert(file);
          return;
        }
        const plain = data.getData("text/plain");
        if (plain) {
          e.preventDefault();
          document.execCommand("insertText", false, plain);
          setDirty(true);
        }
      };

      const tree = files.filter((item) => item.type === "dir" || item.type === "file");

      const toolbarButton = (label, title, onClick) =>
        h("button", {
          type: "button",
          key: title,
          title,
          onMouseDown: (e) => e.preventDefault(),
          onClick,
          style: btnStyle({ padding: "1px 6px" }),
        }, label);

      return h(
        "div",
        { style: { display: "flex", flexDirection: "column", height: "100%", minHeight: 0, fontSize: "12px" } },

        h("div", {
          style: {
            display: "flex", alignItems: "center", gap: "6px", padding: "6px 8px",
            borderBottom: "1px solid var(--dsw-alias-border-secondary, rgba(127,127,127,0.2))", flexShrink: 0,
          },
        },
          h("span", {
            title: rootInfo || "",
            style: { flex: 1, color: "var(--dsw-alias-label-tertiary, #888)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" },
          }, current || (loading ? "Loading…" : "Pick a note")),
          h("button", { type: "button", title: "New note", onClick: () => setNewName(""), style: btnStyle() }, "+"),
          h("button", { type: "button", title: "Refresh", onClick: loadFiles, style: btnStyle() }, "⟳"),
          h("button", {
            type: "button", title: "Save (Ctrl+S)", onClick: saveFile, disabled: !current || !dirty,
            style: btnStyle({ opacity: !current || !dirty ? 0.45 : 1 }),
          }, "Save"),
        ),

        h("div", {
          style: {
            display: "flex", flexWrap: "wrap", alignItems: "center", gap: "4px", padding: "4px 8px",
            borderBottom: "1px solid var(--dsw-alias-border-secondary, rgba(127,127,127,0.2))", flexShrink: 0,
          },
        },
          toolbarButton("H1", "Heading 1 (Ctrl+1)", () => exec("formatBlock", "h1")),
          toolbarButton("H2", "Heading 2 (Ctrl+2)", () => exec("formatBlock", "h2")),
          toolbarButton("H3", "Heading 3 (Ctrl+3)", () => exec("formatBlock", "h3")),
          toolbarButton("P", "Paragraph (Ctrl+0)", () => exec("formatBlock", "p")),
          toolbarButton("B", "Bold (Ctrl+B)", () => exec("bold")),
          toolbarButton("I", "Italic (Ctrl+I)", () => exec("italic")),
          toolbarButton("•", "Bullet list (Ctrl+Shift+8)", () => exec("insertUnorderedList")),
          toolbarButton("1.", "Numbered list (Ctrl+Shift+7)", () => exec("insertOrderedList")),
          toolbarButton("❝", "Quote (Ctrl+Shift+9)", () => exec("formatBlock", "blockquote")),
          toolbarButton("Image", "Insert image", () => fileInputRef.current && fileInputRef.current.click()),
          h("input", {
            ref: fileInputRef,
            type: "file",
            accept: "image/*",
            style: { display: "none" },
            onChange: (e) => {
              const file = e.target.files && e.target.files[0];
              if (file) uploadAndInsert(file);
              e.target.value = "";
            },
          }),
        ),

        newName !== null
          ? h("div", { style: { display: "flex", gap: "6px", padding: "6px 8px", borderBottom: "1px solid var(--dsw-alias-border-secondary, rgba(127,127,127,0.2))" } },
              h("input", {
                autoFocus: true,
                value: newName,
                placeholder: "File name, subfolders allowed: papers/notes",
                onChange: (e) => setNewName(e.target.value),
                onKeyDown: (e) => {
                  if (e.key === "Enter") createFile();
                  if (e.key === "Escape") setNewName(null);
                },
                style: {
                  flex: 1, minWidth: 0, background: "transparent", color: "inherit",
                  border: "1px solid var(--dsw-alias-border-secondary, rgba(127,127,127,0.3))",
                  borderRadius: "6px", padding: "3px 6px", font: "inherit",
                },
              }),
              h("button", { type: "button", onClick: createFile, style: btnStyle() }, "Create"),
            )
          : null,

        h("div", {
          style: {
            maxHeight: "30%", overflow: "auto", borderBottom: "1px solid var(--dsw-alias-border-secondary, rgba(127,127,127,0.2))",
            padding: "4px 0", flexShrink: 0,
          },
        },
          tree.length === 0
            ? h("div", { style: { padding: "8px", color: "var(--dsw-alias-label-tertiary, #888)" } }, "(empty)")
            : tree.map((item) =>
                item.type === "dir"
                  ? h("div", { key: item.path, style: { padding: "2px 10px", color: "var(--dsw-alias-label-tertiary, #888)", fontWeight: 600 } }, "📁 " + item.name)
                  : h("div", {
                      key: item.path,
                      onClick: () => openFile(item.path),
                      title: item.path,
                      style: {
                        display: "flex", alignItems: "center", gap: "4px", padding: "3px 6px 3px 10px",
                        cursor: "pointer", borderRadius: "5px", margin: "0 4px",
                        background: item.path === current ? "var(--dsw-alias-interactive-bg-active, rgba(127,127,127,0.14))" : "transparent",
                      },
                    },
                      h("span", { style: { flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" } }, "📄 " + item.path),
                      pendingDelete === item.path
                        ? h("button", {
                            type: "button", title: "Confirm delete",
                            onClick: (e) => { e.stopPropagation(); deleteFile(item.path); },
                            style: btnStyle({ padding: "0 5px", color: "var(--dsw-alias-state-error-primary, #d64545)", borderColor: "var(--dsw-alias-state-error-primary, #d64545)" }),
                          }, "OK")
                        : h("button", {
                            type: "button", title: "Delete",
                            onClick: (e) => {
                              e.stopPropagation();
                              setPendingDelete(item.path);
                              setTimeout(() => setPendingDelete((cur) => (cur === item.path ? null : cur)), 3000);
                            },
                            style: btnStyle({ padding: "0 5px", opacity: 0.6 }),
                          }, "×"),
                    ),
              ),
        ),

        h("div", {
          ref: editorRef,
          className: "dsh-notes-editor",
          contentEditable: true,
          suppressContentEditableWarning: true,
          "data-placeholder": current ? "Write here… (Ctrl+B bold / Ctrl+1 heading / paste an image)" : "Pick or create a note above",
          onInput: () => setDirty(true),
          onKeyDown,
          onPaste,
          style: { flex: 1, minHeight: 0, padding: "10px 12px" },
        }),

        msg
          ? h("div", {
              style: {
                padding: "4px 10px", color: "var(--dsw-alias-label-secondary, #999)",
                borderTop: "1px solid var(--dsw-alias-border-secondary, rgba(127,127,127,0.2))",
              },
            }, msg)
          : null,
      );
    }

    // ----------------------------------------------------------------- body
    function apply(ctx) {
      let tabReady = false;
      try {
        ctx.effect(() =>
          ctx.sidebarRightTabs.register({
            id: TAB_ID,
            kind: TAB_KIND,
            title: () => "Notes",
            guide: [
              {
                order: 20,
                title: () => "Notes",
                description: () => "Local Markdown notebook (WYSIWYG)",
              },
            ],
          }),
        );
        tabReady = !!ctx.sidebarRightTabs.get(TAB_KIND);
      } catch (error) {
        console.error("[notes-tab] tab type registration failed:", error);
      }

      try {
        ctx.effect(() =>
          ctx.slots.inject("sidebar.right.pane.tab", () =>
            ctx.slots.register({ name: "sidebar.right.pane.tab", key: TAB_ID }, NotesPane),
          ),
        );
      } catch (error) {
        console.error("[notes-tab] pane body registration failed:", error);
      }

      const openNotes = () => {
        if (tabReady) {
          try {
            ctx.sidebarRight.openTab(TAB_KIND, { params: {} });
            return;
          } catch (error) {
            console.error("[notes-tab] openTab failed:", error);
          }
        }
        try {
          ctx.sidebarRight.openTab("guide");
        } catch (error) {
          console.error("[notes-tab] guide fallback failed:", error);
        }
      };

      const NotesButton = ({ wide }) =>
        h("button", {
          type: "button",
          title: "Notes (right-sidebar tab)",
          "aria-label": "Open notes",
          onClick: openNotes,
          style: {
            display: "inline-flex", alignItems: "center", justifyContent: "center", gap: "4px",
            height: "26px", minWidth: wide ? "0" : "26px", padding: wide ? "0 8px" : "0 5px",
            borderRadius: "8px",
            border: "1px solid var(--dsw-alias-border-secondary, rgba(127,127,127,0.28))",
            background: "transparent", color: "var(--dsw-alias-label-primary, inherit)",
            font: "inherit", fontSize: "12px", lineHeight: "18px", cursor: "pointer",
            whiteSpace: "nowrap", flexShrink: "0",
          },
        }, wide ? "📓 Notes" : "📓");

      try {
        ctx.slots.inject("sidebar.footer.action", () =>
          ctx.slots.register(
            { name: "sidebar.footer.action", id: "notes-tab-button", order: 8, label: "Notes" },
            (props) => h(NotesButton, { wide: !!(props && props.wide) }),
          ),
        );
      } catch (error) {
        console.error("[notes-tab] footer registration failed:", error);
      }
    }

    return { apply, inject };
  },
});
