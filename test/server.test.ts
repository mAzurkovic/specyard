import { mkdirSync, writeFileSync } from "node:fs";
import { request } from "node:http";
import { connect, createServer as createNetServer, type Server as NetServer } from "node:net";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import type { Project } from "../src/projects.js";
import { startServer, type RunningServer } from "../src/server.js";
import { tempDir } from "./helpers.js";

const projects: Project[] = [
  { name: "api", dir: "/repo/specs/api" },
  { name: "ledger", dir: "/repo/specs/ledger" },
];

function uiDir(): string {
  const dir = tempDir("ui");
  mkdirSync(join(dir, "assets"));
  writeFileSync(join(dir, "index.html"), "<!doctype html><title>specyard</title>");
  writeFileSync(join(dir, "assets", "app.js"), "console.log(1)");
  return dir;
}

let running: RunningServer | undefined;
let blocker: NetServer | undefined;
afterEach(async () => {
  await running?.close();
  blocker?.close();
  running = undefined;
  blocker = undefined;
});

async function start(current: Project | null = projects[1] ?? null, port = 0) {
  running = await startServer({ port, projects, current, uiDir: uiDir() });
  return running;
}

const api = (s: RunningServer, path: string, init: RequestInit = {}) =>
  fetch(`${s.url}${path}`, { ...init, headers: { "X-Specyard-Token": s.token, ...init.headers } });

describe("startServer", () => {
  it("listens on 127.0.0.1 only", async () => {
    const s = await start();
    expect(new URL(s.url).hostname).toBe("127.0.0.1");
    expect(s.address).toBe("127.0.0.1");
  });

  it("uses the next port when the asked one is taken", async () => {
    blocker = createNetServer();
    await new Promise<void>((r) => blocker!.listen(0, "127.0.0.1", r));
    const taken = (blocker.address() as { port: number }).port;
    const s = await start(null, taken);
    expect(Number(new URL(s.url).port)).toBeGreaterThan(taken);
  });

  it("makes a new token at each start", async () => {
    const first = (await start()).token;
    await running!.close();
    const second = (await start()).token;
    expect(first).toMatch(/^[0-9a-f]{32}$/);
    expect(second).not.toBe(first);
  });
});

describe("api access", () => {
  it.each([
    ["no token", {}, "", 403],
    ["wrong token", { "X-Specyard-Token": "nope" }, "", 403],
    ["foreign Origin", { Origin: "https://evil.example" }, "TOKEN_HEADER", 403],
    ["token header", {}, "TOKEN_HEADER", 200],
    ["token query", {}, "TOKEN_QUERY", 200],
  ])("%s gives %#", async (_label, headers, tokenAt, status) => {
    const s = await start();
    const query = tokenAt === "TOKEN_QUERY" ? `?t=${s.token}` : "";
    const auth: Record<string, string> = tokenAt === "TOKEN_HEADER" ? { "X-Specyard-Token": s.token } : {};
    const res = await fetch(`${s.url}/api/project${query}`, { headers: { ...auth, ...headers } });
    expect(res.status).toBe(status);
  });

  it("accepts the server's own Origin", async () => {
    const s = await start();
    const res = await api(s, "/api/project", { headers: { Origin: s.url } });
    expect(res.status).toBe(200);
  });
});

describe("/api/project", () => {
  it("returns the projects and the current one", async () => {
    const s = await start();
    expect(await (await api(s, "/api/project")).json()).toEqual({
      projects: [
        { name: "api", path: "/repo/specs/api" },
        { name: "ledger", path: "/repo/specs/ledger" },
      ],
      current: { name: "ledger", path: "/repo/specs/ledger" },
    });
  });

  it("selects a listed project", async () => {
    const s = await start(null);
    const res = await api(s, "/api/project", { method: "POST", body: JSON.stringify({ name: "api" }) });
    expect(res.status).toBe(204);
    expect((await (await api(s, "/api/project")).json()).current).toEqual({ name: "api", path: "/repo/specs/api" });
  });

  it.each([['{"name":"other"}'], ["not json"], ['{"name":3}']])("rejects selecting %s", async (body) => {
    const s = await start(null);
    expect((await api(s, "/api/project", { method: "POST", body })).status).toBe(400);
  });

  it("rejects a body over 64 KB", async () => {
    const s = await start(null);
    const body = JSON.stringify({ name: "api", pad: "x".repeat(70_000) });
    expect((await api(s, "/api/project", { method: "POST", body })).status).toBe(400);
  });

  it("rejects other methods", async () => {
    const s = await start();
    expect((await api(s, "/api/project", { method: "DELETE" })).status).toBe(405);
  });

  it("returns 404 for an unknown api path", async () => {
    const s = await start();
    expect((await api(s, "/api/nope")).status).toBe(404);
  });
});

describe("/api/events", () => {
  async function readEvents(res: Response, count: number): Promise<string[]> {
    const reader = res.body!.pipeThrough(new TextDecoderStream()).getReader();
    let buffer = "";
    const events: string[] = [];
    while (events.length < count) {
      const { value, done } = await reader.read();
      if (done) break;
      buffer += value;
      const parts = buffer.split("\n\n");
      buffer = parts.pop() ?? "";
      events.push(...parts.filter((p) => p.startsWith("event:")));
    }
    await reader.cancel();
    return events;
  }

  it("sends the project on connect and after a selection", async () => {
    const s = await start(null);
    const res = await fetch(`${s.url}/api/events?t=${s.token}`);
    expect(res.headers.get("content-type")).toBe("text/event-stream");
    const pending = readEvents(res, 2);
    await new Promise((r) => setTimeout(r, 50));
    await api(s, "/api/project", { method: "POST", body: JSON.stringify({ name: "api" }) });
    const [first, second] = await pending;
    expect(first).toContain("event: project");
    expect(JSON.parse(first!.split("data: ")[1]!).current).toBeNull();
    expect(JSON.parse(second!.split("data: ")[1]!).current).toEqual({ name: "api", path: "/repo/specs/api" });
  });
});

describe("static files", () => {
  it("serves files without a token, with their content type", async () => {
    const s = await start();
    const res = await fetch(`${s.url}/assets/app.js`);
    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toContain("text/javascript");
  });

  it("returns 404 for a missing file", async () => {
    const s = await start();
    expect((await fetch(`${s.url}/assets/missing.js`)).status).toBe(404);
  });

  it("falls back to index.html for app routes", async () => {
    const s = await start();
    const res = await fetch(`${s.url}/some/route`);
    expect(res.headers.get("content-type")).toContain("text/html");
    expect(await res.text()).toContain("<title>specyard</title>");
  });

  it("returns 404 for a malformed path and keeps serving", async () => {
    const s = await start();
    expect((await fetch(`${s.url}/%E0%A4%A`)).status).toBe(404);
    expect((await fetch(`${s.url}/assets/app.js`)).status).toBe(200);
  });

  it("answers 400 to a request target that is not a valid URL and keeps serving", async () => {
    const s = await start();
    const url = new URL(s.url);
    const reply = await new Promise<string>((resolve, reject) => {
      const socket = connect(Number(url.port), url.hostname, () => socket.write("GET http://[/x HTTP/1.1\r\nHost: x\r\n\r\n"));
      socket.once("data", (chunk) => {
        socket.destroy();
        resolve(chunk.toString());
      });
      socket.on("error", reject);
    });
    expect(reply).toMatch(/^HTTP\/1\.1 400/);
    expect((await fetch(`${s.url}/assets/app.js`)).status).toBe(200);
  });

  it("refuses paths outside the ui folder", async () => {
    const s = await start();
    const status = await new Promise<number>((resolve, reject) => {
      const url = new URL(s.url);
      request({ host: url.hostname, port: url.port, path: "/../../etc/passwd" }, (res) => resolve(res.statusCode ?? 0))
        .on("error", reject)
        .end();
    });
    expect(status).toBe(404);
  });
});
