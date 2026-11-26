/**
 * dsh-notes-tab — host half.
 *
 * Serves a vault of Markdown files under /notes-tab/api/* on the DSH web
 * server (same origin, no extra port, no background service). The browser
 * half renders the right-sidebar "Notes" tab and talks to these routes.
 *
 * Zero runtime dependencies beyond Node builtins.
 */

import { promises as fs, existsSync, mkdirSync } from "node:fs";
import path from "node:path";
import os from "node:os";

export const name = "notes-tab";
export const inject = ["webServer"];

const BASE = "/notes-tab";
const DEFAULT_VAULT = path.join(os.homedir(), "dsh-notes");

const IMAGE_MIME = {
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".gif": "image/gif",
  ".webp": "image/webp",
  ".bmp": "image/bmp",
  ".svg": "image/svg+xml",
  ".avif": "image/avif",
};

const CONFIG_SHAPE = { vault: "string" };
const CONFIG_DEFAULTS = { vault: "" };

/** Hand-built Standard Schema so the plugin needs no runtime dependency. */
export const Config = {
  "~standard": {
    version: 1,
    vendor: "dsh-notes-tab",
    validate(value) {
      if (value === void 0 || value === null) value = {};
      if (typeof value !== "object") {
        return { issues: [{ message: "config must be an object", path: [] }] };
      }
      const vault = typeof value.vault === "string" && value.vault.trim() !== "" ? value.vault.trim() : CONFIG_DEFAULTS.vault;
      return { value: { vault } };
    },
  },
  shape: CONFIG_SHAPE,
  defaults: CONFIG_DEFAULTS,
};

function vaultRoot(config) {
  const configured = config && typeof config.vault === "string" ? config.vault.trim() : "";
  return path.resolve(configured || DEFAULT_VAULT);
}

function inside(root, target) {
  const rel = path.relative(root, target);
  return rel === "" || (!rel.startsWith("..") && !path.isAbsolute(rel));
}

function safeJoin(root, rel) {
  const cleaned = String(rel ?? "").replace(/\\/g, "/").replace(/^\/+/, "");
  if (cleaned.split("/").some((part) => part === "..")) throw new Error("bad path");
  const abs = path.resolve(root, cleaned);
  if (!inside(root, abs)) throw new Error("path outside vault");
  return abs;
}

async function walk(root, dir, base = "") {
  const out = [];
  const entries = await fs.readdir(dir, { withFileTypes: true }).catch(() => []);
  entries.sort((a, b) => a.name.localeCompare(b.name, "zh"));
  for (const entry of entries) {
    if (entry.name.startsWith(".")) continue;
    const rel = base ? `${base}/${entry.name}` : entry.name;
    if (entry.isDirectory()) {
      if (base === "" && entry.name === "attachments") continue;
      out.push({ type: "dir", path: rel, name: entry.name });
      out.push(...(await walk(root, path.join(dir, entry.name), rel)));
    } else if (/\.md$/i.test(entry.name)) {
      const stat = await fs.stat(path.join(dir, entry.name)).catch(() => null);
      out.push({ type: "file", path: rel, name: entry.name, mtime: stat ? stat.mtimeMs : 0, size: stat ? stat.size : 0 });
    }
  }
  return out;
}

function send(res, code, body, headers = {}) {
  res.writeHead(code, { "cache-control": "no-store", ...headers });
  res.end(body);
}
function json(res, code, value) {
  send(res, code, JSON.stringify(value), { "content-type": "application/json; charset=utf-8" });
}
async function readBody(req, limit = 4 * 1024 * 1024) {
  const chunks = [];
  let size = 0;
  for await (const chunk of req) {
    size += chunk.length;
    if (size > limit) throw new Error("body too large");
    chunks.push(chunk);
  }
  return Buffer.concat(chunks).toString("utf8");
}

export function apply(ctx, config) {
  const root = vaultRoot(config);

  const register = (pathname, handler) => {
    try {
      ctx.webServer.register({
        kind: "exact",
        path: pathname,
        handler: async (req, res) => {
          try {
            await handler(req, res);
          } catch (error) {
            json(res, 400, { error: String(error?.message ?? error) });
          }
        },
      });
    } catch (error) {
      ctx.logger?.warn?.(`[notes-tab] route ${pathname} failed: ${String(error)}`);
    }
  };

  register(`${BASE}/api/info`, async (req, res) => {
    const exists = existsSync(root);
    return json(res, 200, { root, exists, name: "dsh-notes-tab", version: "0.1.0" });
  });

  register(`${BASE}/api/files`, async (req, res) => {
    mkdirSync(root, { recursive: true });
    return json(res, 200, { root, entries: await walk(root, root) });
  });

  register(`${BASE}/api/file`, async (req, res) => {
    const url = new URL(req.url ?? "/", "http://127.0.0.1");
    if (req.method === "GET") {
      const abs = safeJoin(root, url.searchParams.get("path"));
      const text = await fs.readFile(abs, "utf8");
      const stat = await fs.stat(abs);
      return json(res, 200, { path: url.searchParams.get("path"), text, mtime: stat.mtimeMs });
    }
    if (req.method === "POST") {
      const body = JSON.parse(await readBody(req));
      const abs = safeJoin(root, body.path);
      if (!/\.md$/i.test(abs)) throw new Error("only .md files");
      await fs.mkdir(path.dirname(abs), { recursive: true });
      const tmp = `${abs}.tmp-${process.pid}`;
      await fs.writeFile(tmp, String(body.text ?? ""), "utf8");
      await fs.rename(tmp, abs);
      return json(res, 200, { ok: true, mtime: (await fs.stat(abs)).mtimeMs });
    }
    return json(res, 405, { error: "method not allowed" });
  });

  register(`${BASE}/api/create`, async (req, res) => {
    const body = JSON.parse(await readBody(req));
    let rel = String(body.path ?? "").trim();
    if (!rel) throw new Error("empty path");
    if (!/\.md$/i.test(rel)) rel += ".md";
    const abs = safeJoin(root, rel);
    await fs.mkdir(path.dirname(abs), { recursive: true });
    await fs.writeFile(abs, String(body.text ?? `# ${path.basename(rel, ".md")}\n\n`), { flag: "wx" });
    return json(res, 200, { ok: true, path: rel });
  });

  register(`${BASE}/api/delete`, async (req, res) => {
    const body = JSON.parse(await readBody(req));
    const abs = safeJoin(root, body.path);
    if (abs === root) throw new Error("refuse to delete the vault root");
    await fs.rm(abs, { force: true });
    return json(res, 200, { ok: true });
  });

  register(`${BASE}/api/upload`, async (req, res) => {
    const body = JSON.parse(await readBody(req, 25 * 1024 * 1024));
    const raw = String(body.dataUrl ?? body.data ?? "");
    const match = /^data:([^;,]+)?(?:;base64)?,(.*)$/s.exec(raw);
    const base64 = match ? match[2] : raw;
    if (!base64) throw new Error("empty image");
    const buffer = Buffer.from(base64, "base64");
    if (buffer.length > 20 * 1024 * 1024) throw new Error("image too large (20 MB)");
    const mimeExt = match && match[1] ? String(match[1]).split("/")[1] : "png";
    const ext = (mimeExt || "png").replace(/[^a-z0-9]/gi, "").toLowerCase() || "png";
    const filename = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;
    const dir = path.join(root, "attachments");
    await fs.mkdir(dir, { recursive: true });
    await fs.writeFile(path.join(dir, filename), buffer);
    return json(res, 200, { ok: true, path: `attachments/${filename}` });
  });

  register(`${BASE}/api/asset`, async (req, res) => {
    const url = new URL(req.url ?? "/", "http://127.0.0.1");
    const abs = safeJoin(root, url.searchParams.get("path"));
    const type = IMAGE_MIME[path.extname(abs).toLowerCase()] || "application/octet-stream";
    const data = await fs.readFile(abs);
    send(res, 200, data, { "content-type": type, "cache-control": "private, max-age=60" });
  });
}
