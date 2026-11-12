import { query, type Options, type SDKMessage, type SDKUserMessage } from "@anthropic-ai/claude-agent-sdk";
import { randomBytes } from "node:crypto";
import { appendFileSync, existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { mkdir, readdir, readFile, writeFile } from "node:fs/promises";
import { dirname, join, relative } from "node:path";
import { toRunEvents, type RunEvent } from "./events.js";

/** The SDK's `query`, narrowed to what a run uses; tests pass a stand-in. */
export type QueryFn = (params: { prompt: AsyncIterable<SDKUserMessage>; options: Options }) => AsyncIterable<SDKMessage>;

export const RUN_KINDS = ["to-brd", "to-design", "to-milestones", "to-tasks", "expert-review"] as const;
export type RunKind = (typeof RUN_KINDS)[number];
export type RunState = "running" | "needs-you" | "done" | "failed";
export type RunInfo = { id: string; kind: RunKind; target: string | undefined; state: RunState; sessionId: string | undefined; startedAt: number; endedAt?: number };

type Specs = Map<string, string>;
/** `after` holds the spec files as the run left them, once it has ended. */
type Run = { info: RunInfo; input: MessageQueue; lastText: string; after?: Promise<Specs | undefined> };
type Listener = (runId: string, event: RunEvent) => void;

/** A skill that stops on its question template (`Q:` then `Recommend:`) is waiting for the user. */
const ASKS = /^Q: .+\n\s*Recommend: /m;

export class RunManager {
  private readonly runs = new Map<string, Run>();
  private readonly listeners = new Set<Listener>();

  constructor(
    private readonly options: {
      repoRoot: string;
      projectDir: string;
      contextFiles: () => string[];
      /** The project's spec files by relative path, read before and after a run to show what it changed. */
      readSpecs: () => Promise<Specs>;
      runQuery?: QueryFn;
    },
  ) {
    this.reopen();
  }

  subscribe(listener: Listener): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  get(id: string): RunInfo | undefined {
    return this.runs.get(id)?.info;
  }

  list(target?: string): RunInfo[] {
    return [...this.runs.values()]
      .map((r) => r.info)
      .filter((r) => target === undefined || r.target === target)
      .sort((a, b) => b.startedAt - a.startedAt || b.id.localeCompare(a.id));
  }

  async start(request: { kind: RunKind; target?: string; comment?: string }): Promise<RunInfo> {
    const id = `${Date.now().toString(36)}-${randomBytes(3).toString("hex")}`;
    const info: RunInfo = { id, kind: request.kind, target: request.target, state: "running", sessionId: undefined, startedAt: Date.now() };
    const run: Run = { info, input: new MessageQueue(), lastText: "" };
    this.runs.set(id, run);
    this.save(run);
    try {
      // Known limit: runs at the same time on one project each see the other's edits in their diff.
      await this.copySpecs(id, "before");
      run.input.push(this.firstMessage(request));
      const runQuery = this.options.runQuery ?? (query as QueryFn);
      const messages = runQuery({
        prompt: run.input,
        options: { cwd: this.options.repoRoot, settingSources: ["user", "project", "local"] },
      });
      void this.follow(run, messages);
    } catch (error) {
      this.finish(run, "failed");
      throw error;
    }
    return info;
  }

  /** The run's events as logged, oldest first. */
  async events(id: string): Promise<RunEvent[]> {
    const text = await readFile(join(this.runDir(id), "events.jsonl"), "utf8").catch(() => "");
    return text.split("\n").filter(Boolean).map((line) => JSON.parse(line) as RunEvent);
  }

  /** Spec files the run changed, sorted by path; null text means absent. A run still going compares with the files now. */
  async changes(id: string): Promise<{ path: string; before: string | null; after: string | null }[]> {
    const before = (await this.readCopy(id, "before")) ?? new Map<string, string>();
    const after = (await this.runs.get(id)?.after) ?? (await this.readCopy(id, "after")) ?? (await this.options.readSpecs());
    return [...new Set([...before.keys(), ...after.keys()])]
      .sort()
      .map((path) => ({ path, before: before.get(path) ?? null, after: after.get(path) ?? null }))
      .filter((c) => c.before !== c.after);
  }

  /** Sends the user's answer as the next message of a run that waits for one. */
  reply(id: string, text: string): boolean {
    const run = this.runs.get(id);
    if (!run || run.info.state !== "needs-you") return false;
    run.info.state = "running";
    this.save(run);
    run.input.push(text);
    return true;
  }

  /** What a user would type: the skill's command, then the context files and the batching request, then any comment. */
  private firstMessage({ kind, target, comment }: { kind: RunKind; target?: string; comment?: string }): string {
    const command = target === undefined ? `/${kind}` : `/${kind} ${target.replace("·", " ")}`;
    const context = this.options.contextFiles();
    const notes = [...(context.length > 0 ? [`Context files: ${context.join(", ")}`] : []), "Ask batched questions."].join("\n");
    return [command, notes, ...(comment ? [comment] : [])].join("\n\n");
  }

  private async follow(run: Run, messages: AsyncIterable<SDKMessage>): Promise<void> {
    try {
      for await (const message of messages) {
        run.info.sessionId ??= message.session_id;
        for (const event of toRunEvents(message)) this.record(run, event);
      }
    } catch (error) {
      this.record(run, { t: Date.now(), kind: "text", text: `Run stopped: ${(error as Error).message}` });
    }
    if (run.info.endedAt === undefined) this.record(run, { t: Date.now(), kind: "end", ok: false });
  }

  private record(run: Run, event: RunEvent): void {
    if (event.kind === "text") run.lastText = event.text;
    appendFileSync(join(this.runDir(run.info.id), "events.jsonl"), `${JSON.stringify(event)}\n`);
    // Settle the state first, so subscribers see it together with the event that ended the turn.
    if (event.kind === "end") {
      if (!event.ok) this.finish(run, "failed");
      else if (ASKS.test(run.lastText)) {
        run.info.state = "needs-you";
        this.save(run);
      } else this.finish(run, "done");
      run.lastText = "";
    }
    for (const listener of this.listeners) listener(run.info.id, event);
  }

  private finish(run: Run, state: "done" | "failed"): void {
    if (run.info.state === "done" || run.info.state === "failed") return;
    run.info.state = state;
    run.info.endedAt = Date.now();
    this.save(run);
    run.input.close();
    run.after = this.copySpecs(run.info.id, "after").catch((error: unknown) => {
      console.error(`Could not keep what run ${run.info.id} changed: ${(error as Error).message}`);
      return undefined;
    });
  }

  /** Copies the spec files into the run's folder and gives them back. */
  private async copySpecs(id: string, name: "before" | "after"): Promise<Specs> {
    const specs = await this.options.readSpecs();
    for (const [path, text] of specs) {
      const copy = join(this.runDir(id), name, path);
      await mkdir(dirname(copy), { recursive: true });
      await writeFile(copy, text);
    }
    return specs;
  }

  /** A copy made by `copySpecs`, or undefined when there is none. */
  private async readCopy(id: string, name: "before" | "after"): Promise<Specs | undefined> {
    const root = join(this.runDir(id), name);
    const entries = await readdir(root, { recursive: true, withFileTypes: true }).catch(() => undefined);
    if (!entries) return undefined;
    const specs: Specs = new Map();
    for (const e of entries.filter((e) => e.isFile())) {
      const file = join(e.parentPath, e.name);
      specs.set(relative(root, file), await readFile(file, "utf8"));
    }
    return specs;
  }

  /** Runs logged by an earlier start. One that was still going lost its session with that process. */
  private reopen(): void {
    const root = join(this.options.projectDir, ".specyard", "runs");
    if (!existsSync(root)) return;
    for (const id of readdirSync(root)) {
      const file = join(root, id, "run.json");
      if (!existsSync(file)) continue;
      let info: RunInfo;
      try {
        info = JSON.parse(readFileSync(file, "utf8")) as RunInfo;
      } catch (error) {
        console.error(`Skipped the run log ${file}: ${(error as Error).message}`);
        continue;
      }
      const run: Run = { info, input: new MessageQueue(), lastText: "" };
      run.input.close();
      this.runs.set(info.id, run);
      if (info.state === "running" || info.state === "needs-you") {
        info.state = "failed";
        info.endedAt = Date.now();
        this.save(run);
      }
    }
  }

  private runDir(id: string): string {
    return join(this.options.projectDir, ".specyard", "runs", id);
  }

  private save(run: Run): void {
    const root = join(this.options.projectDir, ".specyard");
    mkdirSync(this.runDir(run.info.id), { recursive: true });
    // The folder ignores itself, so run logs never show up in git without touching the repo's .gitignore.
    writeFileSync(join(root, ".gitignore"), "*\n");
    writeFileSync(join(this.runDir(run.info.id), "run.json"), JSON.stringify(run.info, null, 2));
  }
}

/** An async stream of user messages that stays open until the run ends. */
class MessageQueue implements AsyncIterable<SDKUserMessage> {
  private readonly pending: string[] = [];
  private wake: (() => void) | undefined;
  private closed = false;

  push(text: string): void {
    this.pending.push(text);
    this.wake?.();
  }

  close(): void {
    this.closed = true;
    this.wake?.();
  }

  async *[Symbol.asyncIterator](): AsyncIterator<SDKUserMessage> {
    for (;;) {
      const text = this.pending.shift();
      if (text !== undefined) {
        yield { type: "user", message: { role: "user", content: text }, parent_tool_use_id: null };
        continue;
      }
      if (this.closed) return;
      await new Promise<void>((resolve) => (this.wake = resolve));
      this.wake = undefined;
    }
  }
}
