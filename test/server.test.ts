import { existsSync, mkdirSync, readFileSync, rmSync, symlinkSync, writeFileSync } from "node:fs";
import { request } from "node:http";
import { connect, createServer as createNetServer, type Server as NetServer } from "node:net";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import type { Project } from "../src/projects.js";
import { startServer, type RunningServer } from "../src/server.js";
import { tempDir } from "./helpers.js";

const repo = tempDir("repo");
const projects: Project[] = ["api", "ledger"].map((name) => {
  const dir = join(repo, "specs", name);
  mkdirSync(dir, { recursive: true });
  writeFileSync(join(dir, "requirements.md"), `# ${name}\n`);
  return { name, dir };
});
const apiPath = projects[0]!.dir;
const ledgerPath = projects[1]!.dir;

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
  it("returns the projects, the current one and its model", async () => {
    const s = await start();
    const body = await (await api(s, "/api/project")).json();
    expect(body.projects).toEqual([
      { name: "api", path: apiPath },
      { name: "ledger", path: ledgerPath },
    ]);
    expect(body.current).toEqual({ name: "ledger", path: ledgerPath });
    expect(body.model).toMatchObject({ name: "ledger", files: { requirements: true, design: false, milestones: false } });
  });

  it("has no model while no project is selected", async () => {
    const s = await start(null);
    expect((await (await api(s, "/api/project")).json()).model).toBeNull();
  });

  it("selects a listed project", async () => {
    const s = await start(null);
    const res = await api(s, "/api/project", { method: "POST", body: JSON.stringify({ name: "api" }) });
    expect(res.status).toBe(204);
    const body = await (await api(s, "/api/project")).json();
    expect(body.current).toEqual({ name: "api", path: apiPath });
    expect(body.model.name).toBe("api");
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

  it("selecting a project whose folder is gone keeps the server up and shows no model", async () => {
    const goneDir = join(repo, "specs", "gone");
    mkdirSync(goneDir);
    writeFileSync(join(goneDir, "requirements.md"), "# gone\n");
    const gone: Project = { name: "gone", dir: goneDir };
    running = await startServer({ port: 0, projects: [...projects, gone], current: projects[1]!, uiDir: uiDir() });
    rmSync(goneDir, { recursive: true });
    const res = await api(running, "/api/project", { method: "POST", body: JSON.stringify({ name: "gone" }) });
    expect(res.status).toBe(204);
    const body = await (await api(running, "/api/project")).json();
    expect(body.current.name).toBe("gone");
    expect(body.model).toBeNull();
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

describe("/api/file", () => {
  mkdirSync(join(ledgerPath, "m1-core", "f1-base"), { recursive: true });
  writeFileSync(join(ledgerPath, "m1-core", "f1-base", "tasks.md"), "# Base — Tasks\n");
  writeFileSync(join(repo, "secret.md"), "outside\n");
  symlinkSync(join(repo, "secret.md"), join(ledgerPath, "escape.md"));
  symlinkSync(join(ledgerPath, "requirements.md"), join(ledgerPath, "alias.md"));

  const file = (s: RunningServer, path: string) => api(s, `/api/file?path=${encodeURIComponent(path)}`);

  it("returns the text of a file in the project folder", async () => {
    const res = await file(await start(), "m1-core/f1-base/tasks.md");
    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toBe("text/plain; charset=utf-8");
    expect(await res.text()).toBe("# Base — Tasks\n");
  });

  it("follows a symlink that stays inside the project folder", async () => {
    expect(await (await file(await start(), "alias.md")).text()).toBe("# ledger\n");
  });

  it.each([
    ["a path up and out", "../../secret.md"],
    ["a path up and out after a folder", "m1-core/../../../secret.md"],
    ["an absolute path outside", join(repo, "secret.md")],
    ["a symlink that points outside", "escape.md"],
    ["a sibling project", "../api/requirements.md"],
  ])("refuses %s with 403", async (_label, path) => {
    expect((await file(await start(), path)).status).toBe(403);
  });

  it.each([
    ["a missing file", "nope.md"],
    ["a folder", "m1-core"],
    ["the project folder itself", ""],
  ])("returns 404 for %s", async (_label, path) => {
    expect((await file(await start(), path)).status).toBe(404);
  });

  it("returns 404 while no project is selected", async () => {
    expect((await file(await start(null), "requirements.md")).status).toBe(404);
  });

  it("returns 404 when the project folder is gone", async () => {
    const goneDir = join(repo, "specs", "vanished");
    mkdirSync(goneDir);
    writeFileSync(join(goneDir, "requirements.md"), "# vanished\n");
    running = await startServer({ port: 0, projects, current: { name: "vanished", dir: goneDir }, uiDir: uiDir() });
    rmSync(goneDir, { recursive: true });
    expect((await file(running, "requirements.md")).status).toBe(404);
  });

  it("needs the token", async () => {
    const s = await start();
    expect((await fetch(`${s.url}/api/file?path=requirements.md`)).status).toBe(403);
  });

  it("rejects other methods", async () => {
    expect((await api(await start(), "/api/file?path=requirements.md", { method: "POST" })).status).toBe(405);
  });
});

describe("/api/context", () => {
  const MB = 1024 * 1024;
  const upload = (s: RunningServer, name: string, body: BlobPart = "# note\n", field = "file") => {
    const form = new FormData();
    form.append(field, new File([body], name));
    return api(s, "/api/context", { method: "POST", body: form });
  };
  const contextDir = join(ledgerPath, "context");
  afterEach(() => rmSync(contextDir, { recursive: true, force: true }));

  it.each([["notes.md"], ["spec.markdown"], ["hld.pdf"], ["flow.png"], ["photo.JPG"], ["photo.jpeg"], ["anim.gif"], ["shot.webp"], ["chart.svg"]])(
    "copies %s into context/, making the folder",
    async (name) => {
      const res = await upload(await start(), name, "bytes\n");
      expect(res.status).toBe(201);
      expect(await res.json()).toEqual({ path: `context/${name}` });
      expect(readFileSync(join(contextDir, name), "utf8")).toBe("bytes\n");
    },
  );

  it("copies binary content byte for byte", async () => {
    const bytes = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0, 255, 13, 10]);
    expect((await upload(await start(), "pixel.png", bytes)).status).toBe(201);
    expect(new Uint8Array(readFileSync(join(contextDir, "pixel.png")))).toEqual(bytes);
  });

  it.each([["run.sh"], ["page.html"], ["notes.txt"], ["Makefile"]])("refuses %s with 415 and writes nothing", async (name) => {
    expect((await upload(await start(), name)).status).toBe(415);
    expect(existsSync(join(contextDir, name))).toBe(false);
  });

  it("refuses a name that exists with 409 and keeps the old file", async () => {
    const s = await start();
    await upload(s, "notes.md", "first\n");
    expect((await upload(s, "notes.md", "second\n")).status).toBe(409);
    expect(readFileSync(join(contextDir, "notes.md"), "utf8")).toBe("first\n");
  });

  it("answers 500 when context/ cannot be made, and keeps serving", async () => {
    writeFileSync(contextDir, "a file where the folder should be\n");
    const s = await start();
    expect((await upload(s, "notes.md")).status).toBe(500);
    expect((await api(s, "/api/project")).status).toBe(200);
  });

  it("answers 500 when context/ cannot be written to", async () => {
    mkdirSync(contextDir, { mode: 0o555 });
    expect((await upload(await start(), "notes.md")).status).toBe(500);
    expect(existsSync(join(contextDir, "notes.md"))).toBe(false);
  });

  it("takes a file of exactly 20 MB", async () => {
    expect((await upload(await start(), "big.pdf", new Uint8Array(20 * MB))).status).toBe(201);
  });

  it("refuses a file over 20 MB with 413 and writes nothing", async () => {
    expect((await upload(await start(), "huge.pdf", new Uint8Array(20 * MB + 1))).status).toBe(413);
    expect(existsSync(join(contextDir, "huge.pdf"))).toBe(false);
  });

  it("refuses a body far over the limit with 413", async () => {
    expect((await upload(await start(), "huge.pdf", new Uint8Array(30 * MB))).status).toBe(413);
  });

  it.each([
    ["a body that is not multipart", () => ({ body: "plain", headers: { "Content-Type": "text/plain" } })],
    ["a form without a file field", () => ({ body: (() => { const f = new FormData(); f.append("file", "text only"); return f; })() })],
  ])("refuses %s with 400", async (_label, init) => {
    expect((await api(await start(), "/api/context", { method: "POST", ...init() })).status).toBe(400);
  });

  it("refuses a form whose file is under another field with 400", async () => {
    expect((await upload(await start(), "notes.md", "x", "other")).status).toBe(400);
  });

  it.each([["../uploaded.md"], ["sub/notes.md"], [".hidden.md"], [".."]])("refuses the name %s with 400", async (name) => {
    const s = await start();
    const boundary = "b0undary";
    const body = `--${boundary}\r\nContent-Disposition: form-data; name="file"; filename="${name}"\r\n\r\nx\r\n--${boundary}--\r\n`;
    const res = await api(s, "/api/context", { method: "POST", body, headers: { "Content-Type": `multipart/form-data; boundary=${boundary}` } });
    expect(res.status).toBe(400);
    expect(existsSync(join(ledgerPath, "uploaded.md"))).toBe(false);
    expect(existsSync(contextDir)).toBe(false);
  });

  it("returns 404 while no project is selected", async () => {
    expect((await upload(await start(null), "notes.md")).status).toBe(404);
  });

  it("needs the token", async () => {
    const s = await start();
    const form = new FormData();
    form.append("file", new File(["x"], "notes.md"));
    expect((await fetch(`${s.url}/api/context`, { method: "POST", body: form })).status).toBe(403);
  });

  it("rejects other methods", async () => {
    expect((await api(await start(), "/api/context")).status).toBe(405);
  });

  it("lists the new file in the model through the watcher", async () => {
    const s = await start();
    expect((await upload(s, "notes.md")).status).toBe(201);
    await expect
      .poll(async () => (await (await api(s, "/api/project")).json()).model.contextFiles.map((f: { path: string }) => f.path), { timeout: 2000 })
      .toEqual(["context/notes.md"]);
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
    expect(JSON.parse(second!.split("data: ")[1]!).current).toEqual({ name: "api", path: apiPath });
  });

  it("sends the rebuilt model within 2 s of a spec file change", async () => {
    const s = await start();
    const res = await fetch(`${s.url}/api/events?t=${s.token}`);
    const pending = readEvents(res, 2);
    await new Promise((r) => setTimeout(r, 300));
    const changedAt = Date.now();
    writeFileSync(join(ledgerPath, "design.md"), "# design\n");
    const [, second] = await pending;
    expect(Date.now() - changedAt).toBeLessThan(2000);
    expect(JSON.parse(second!.split("data: ")[1]!).model.files.design).toBe(true);
    rmSync(join(ledgerPath, "design.md"));
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
