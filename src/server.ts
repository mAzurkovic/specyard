import { randomBytes } from "node:crypto";
import { readFile } from "node:fs/promises";
import { createServer, type IncomingMessage, type Server, type ServerResponse } from "node:http";
import { extname, join, normalize, sep } from "node:path";
import { authorize } from "./auth.js";
import { buildModel, type ProjectModel } from "./model.js";
import type { Project } from "./projects.js";
import { readMtimes, readProject } from "./readProject.js";
import { watchProject } from "./watch.js";

export type RunningServer = { url: string; address: string; token: string; close: () => Promise<void> };

type Options = { port: number; projects: Project[]; current: Project | null; uiDir: string };

const HOST = "127.0.0.1";
const PORT_TRIES = 20;
const HEARTBEAT_MS = 15_000;
const MAX_BODY = 64 * 1024;
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
      const files = await readProject(project.dir);
      const next = buildModel(project.name, files, await readMtimes(project.dir, files.keys()));
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
  let size = 0;
  const chunks: Buffer[] = [];
  try {
    for await (const chunk of req) {
      size += (chunk as Buffer).length;
      if (size > MAX_BODY) return undefined;
      chunks.push(chunk as Buffer);
    }
    return JSON.parse(Buffer.concat(chunks).toString("utf8"));
  } catch {
    return undefined;
  }
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
