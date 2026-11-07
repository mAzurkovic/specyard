import { randomBytes } from "node:crypto";
import { mkdir, readFile, realpath, writeFile } from "node:fs/promises";
import { createServer, type IncomingMessage, type Server, type ServerResponse } from "node:http";
import { basename, extname, isAbsolute, join, normalize, relative, resolve, sep } from "node:path";
import { authorize } from "./auth.js";
import { readInside } from "./inside.js";
import { buildModel, type ProjectModel } from "./model.js";
import type { Project } from "./projects.js";
import { readContextFiles, readMtimes, readProject } from "./readProject.js";
import { markNotAffected, staleDetails } from "./staleApi.js";
import { watchProject } from "./watch.js";

export type RunningServer = { url: string; address: string; token: string; close: () => Promise<void> };

type Options = { port: number; projects: Project[]; current: Project | null; uiDir: string };

const HOST = "127.0.0.1";
const PORT_TRIES = 20;
const HEARTBEAT_MS = 15_000;
const MAX_BODY = 64 * 1024;
const MAX_UPLOAD = 20 * 1024 * 1024;
// Room for the multipart boundary and part headers around the uploaded file.
const MULTIPART_SLACK = 64 * 1024;
const CONTEXT_TYPES = new Set([".md", ".markdown", ".pdf", ".png", ".jpg", ".jpeg", ".gif", ".webp", ".svg"]);
const TYPES: Record<string, string> = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".json": "application/json",
  ".woff2": "font/woff2",
};

export async function startServer(options: Options): Promise<RunningServer> {
  const token = randomBytes(16).toString("hex");
  let current: Project | null = null;
  let model: ProjectModel | null = null;
  let stopWatching = () => {};
  const listeners = new Set<ServerResponse>();
  const view = (p: Project) => ({ name: p.name, path: p.dir });
  const projectBody = () => JSON.stringify({ projects: options.projects.map(view), current: current && view(current), model });
  const broadcast = () => listeners.forEach((res) => res.write(`event: project\ndata: ${projectBody()}\n\n`));

  const rebuild = async (project: Project) => {
    try {
      const [files, contextFiles] = await Promise.all([readProject(project.dir), readContextFiles(project.dir)]);
      const next = buildModel(project.name, files, await readMtimes(project.dir, files.keys()), contextFiles);
      if (current === project) model = next;
    } catch (error) {
      // Keep showing the last good model; the next change tries again.
      console.error(`specyard: cannot read ${project.dir}: ${(error as Error).message}`);
    }
  };
  const select = async (project: Project) => {
    stopWatching();
    stopWatching = () => {};
    current = project;
    model = null;
    // Watch before the first read, so a quick second switch always closes this watcher.
    try {
      stopWatching = watchProject(project.dir, () => {
        if (current === project) void rebuild(project).then(broadcast);
      });
    } catch (error) {
      console.error(`specyard: cannot watch ${project.dir}: ${(error as Error).message}`);
    }
    await rebuild(project);
  };
  if (options.current) await select(options.current);

  let origin = "";
  const server = createServer((req, res) => {
    let url: URL;
    try {
      url = new URL(req.url ?? "/", origin);
    } catch {
      return void send(res, 400);
    }
    if (!url.pathname.startsWith("/api/")) return void serveStatic(options.uiDir, req.url ?? "/", res);
    if (!authorize(req, url, token, origin)) return void send(res, 403);

    if (url.pathname === "/api/project") {
      if (req.method === "GET") return void send(res, 200, projectBody());
      if (req.method !== "POST") return void send(res, 405);
      return void readJson(req).then((body) => {
        const name = (body as { name?: unknown } | undefined)?.name;
        const picked = options.projects.find((p) => p.name === name);
        if (!picked) return send(res, 400);
        return select(picked).then(() => {
          send(res, 204);
          broadcast();
        });
      });
    }
    if (url.pathname === "/api/events" && req.method === "GET") {
      res.writeHead(200, { "Content-Type": "text/event-stream", "Cache-Control": "no-store", Connection: "keep-alive" });
      res.write(`event: project\ndata: ${projectBody()}\n\n`);
      listeners.add(res);
      const heartbeat = setInterval(() => res.write(":\n\n"), HEARTBEAT_MS);
      req.on("close", () => {
        clearInterval(heartbeat);
        listeners.delete(res);
      });
      return;
    }
    if (url.pathname === "/api/file") {
      if (req.method !== "GET") return void send(res, 405);
      if (!current) return void send(res, 404);
      return void readInside(current.dir, url.searchParams.get("path") ?? "").then((file) => {
        if (typeof file === "number") return send(res, file);
        res.writeHead(200, { "Content-Type": "text/plain; charset=utf-8" });
        res.end(file);
      });
    }
    if (url.pathname === "/api/stale" && req.method === "GET") {
      if (!current || !model) return void send(res, 404);
      return void staleDetails(current.dir, model, url.searchParams.get("file") ?? "").then((details) =>
        details ? send(res, 200, JSON.stringify(details)) : send(res, 404),
      );
    }
    if (url.pathname === "/api/stale/not-affected") {
      if (req.method !== "POST") return void send(res, 405);
      if (!current || !model) return void send(res, 404);
      const [project, snapshot] = [current, model];
      return void readJson(req).then(async (body) => {
        const file = (body as { file?: unknown } | undefined)?.file;
        if (typeof file !== "string") return send(res, 400);
        if (!(await markNotAffected(project.dir, snapshot, file))) return send(res, 404);
        // Rebuild now so the next read already shows the flag gone; the watcher would only follow later.
        await rebuild(project);
        send(res, 204);
        broadcast();
      }).catch((error: Error) => {
        console.error(`specyard: cannot mark ${project.dir} as not affected: ${error.message}`);
        send(res, 500);
      });
    }
    if (url.pathname === "/api/context") {
      if (req.method !== "POST") return void send(res, 405);
      if (!current) return void send(res, 404);
      return void addContextFile(current.dir, req).then(
        (added) => (typeof added === "number" ? send(res, added) : send(res, 201, JSON.stringify({ path: added }))),
        (error: Error) => {
          console.error(`specyard: cannot add a context file: ${error.message}`);
          send(res, 500);
        },
      );
    }
    send(res, 404);
  });

  const port = await listen(server, options.port);
  origin = `http://${HOST}:${port}`;
  return {
    url: origin,
    address: HOST,
    token,
    close: () =>
      new Promise((resolve) => {
        stopWatching();
        listeners.forEach((res) => res.end());
        server.close(() => resolve());
      }),
  };
}

async function listen(server: Server, first: number): Promise<number> {
  for (let i = 0; i < PORT_TRIES; i++) {
    const port = first === 0 ? 0 : first + i;
    try {
      await new Promise<void>((resolve, reject) => {
        server.once("error", reject);
        server.listen(port, HOST, () => {
          server.off("error", reject);
          resolve();
        });
      });
      return (server.address() as { port: number }).port;
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== "EADDRINUSE") throw error;
    }
  }
  throw new Error(`No free port from ${first} to ${first + PORT_TRIES - 1}`);
}

function send(res: ServerResponse, status: number, json?: string): void {
  res.writeHead(status, json === undefined ? {} : { "Content-Type": "application/json" });
  res.end(json);
}

/** Resolves to undefined when the body is missing, aborted, too large or not JSON. Never rejects. */
async function readJson(req: IncomingMessage): Promise<unknown> {
  try {
    const body = await readBody(req, MAX_BODY);
    return body && JSON.parse(body.toString("utf8"));
  } catch {
    return undefined;
  }
}

/** The whole body, or undefined when it is over `limit` bytes. Rejects when the request aborts. */
async function readBody(req: IncomingMessage, limit: number): Promise<Buffer | undefined> {
  let size = 0;
  const chunks: Buffer[] = [];
  // Read to the end even when too large, so the client gets the answer and not a reset connection.
  for await (const chunk of req) {
    size += (chunk as Buffer).length;
    if (size <= limit) chunks.push(chunk as Buffer);
  }
  return size > limit ? undefined : Buffer.concat(chunks);
}

/** Copies the `file` part of a multipart body into the project's `context/`. Resolves to its path, or the status that says why not. */
async function addContextFile(projectDir: string, req: IncomingMessage): Promise<string | 400 | 409 | 413 | 415> {
  let form: FormData;
  try {
    const body = await readBody(req, MAX_UPLOAD + MULTIPART_SLACK);
    if (body === undefined) return 413;
    const headers = { "Content-Type": req.headers["content-type"] ?? "" };
    form = await new Request("http://localhost/", { method: "POST", headers, body: new Uint8Array(body) }).formData();
  } catch {
    // An aborted upload or a body that is not multipart.
    return 400;
  }
  const file = form.get("file");
  if (!(file instanceof File)) return 400;
  if (file.size > MAX_UPLOAD) return 413;
  const name = file.name;
  if (name !== basename(name) || name.startsWith(".")) return 400;
  if (!CONTEXT_TYPES.has(extname(name).toLowerCase())) return 415;

  const dir = join(projectDir, "context");
  await mkdir(dir, { recursive: true });
  try {
    await writeFile(join(dir, name), new Uint8Array(await file.arrayBuffer()), { flag: "wx" });
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "EEXIST") return 409;
    throw error;
  }
  return `context/${name}`;
}

async function serveStatic(root: string, rawPath: string, res: ServerResponse): Promise<void> {
  let pathname: string;
  try {
    pathname = decodeURIComponent(rawPath.split("?")[0] ?? "/");
  } catch {
    return send(res, 404);
  }
  const file = normalize(join(root, pathname));
  if (file !== root && !file.startsWith(root + sep)) return send(res, 404);
  const target = extname(file) ? file : join(root, "index.html");
  try {
    const body = await readFile(target);
    res.writeHead(200, { "Content-Type": TYPES[extname(target)] ?? "application/octet-stream" });
    res.end(body);
  } catch {
    send(res, 404);
  }
}
