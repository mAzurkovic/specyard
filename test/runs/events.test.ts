import type { SDKMessage } from "@anthropic-ai/claude-agent-sdk";
import { describe, expect, it } from "vitest";
import { toRunEvents } from "../../src/runs/events.js";

const msg = (m: object) => m as unknown as SDKMessage;
const assistant = (text: string, parent: string | null = null) =>
  msg({ type: "assistant", parent_tool_use_id: parent, session_id: "s1", message: { content: [{ type: "text", text }] } });
const NOW = 1_000;

describe("toRunEvents", () => {
  it("turns progress lines into progress events and other lines into one text event", () => {
    const text = "[read] tasks.md: 2 parents, 5 tasks.\n[build 1.1] attempt 1: PASS\nNow writing the second task.";
    expect(toRunEvents(assistant(text), NOW)).toEqual([
      { t: NOW, kind: "progress", tag: "read", text: "tasks.md: 2 parents, 5 tasks." },
      { t: NOW, kind: "progress", tag: "build 1.1", text: "attempt 1: PASS" },
      { t: NOW, kind: "text", text: "Now writing the second task." },
    ]);
  });

  it("reads the feature loop, ship and stop tags", () => {
    const text = "[feature r2] verify: PASS 6 of 6.\n[ship] PR: https://x/pr/1\n[stop] 1.3 failed 3 attempts.";
    expect(toRunEvents(assistant(text), NOW).map((e) => (e.kind === "progress" ? e.tag : e.kind))).toEqual(["feature r2", "ship", "stop"]);
  });

  it("ignores text from inside a subagent", () => {
    expect(toRunEvents(assistant("[read] inner", "toolu_1"), NOW)).toEqual([]);
  });

  it("reports a subagent starting and stopping", () => {
    expect(toRunEvents(msg({ type: "system", subtype: "task_started", task_id: "t1", subagent_type: "general-purpose", description: "Verify M1 F1" }), NOW)).toEqual([
      { t: NOW, kind: "subagent-start", id: "t1", agent: "general-purpose", description: "Verify M1 F1" },
    ]);
    expect(toRunEvents(msg({ type: "system", subtype: "task_notification", task_id: "t1", status: "completed", summary: "PASS 30 of 30" }), NOW)).toEqual([
      { t: NOW, kind: "subagent-stop", id: "t1", status: "completed", summary: "PASS 30 of 30" },
    ]);
  });

  it.each([
    ["seconds", 1_700_000_000],
    ["milliseconds", 1_700_000_000_000],
  ])("reports a rejected rate limit with its reset time given in %s, in ms", (_unit, resetsAt) => {
    const limit = msg({ type: "rate_limit_event", rate_limit_info: { status: "rejected", resetsAt } });
    expect(toRunEvents(limit, NOW)).toEqual([{ t: NOW, kind: "rate-limit", resetsAt: 1_700_000_000_000 }]);
  });

  it("ignores an allowed rate limit, and keeps a rejected one with no reset time", () => {
    expect(toRunEvents(msg({ type: "rate_limit_event", rate_limit_info: { status: "allowed" } }), NOW)).toEqual([]);
    expect(toRunEvents(msg({ type: "rate_limit_event", rate_limit_info: { status: "rejected" } }), NOW)).toEqual([{ t: NOW, kind: "rate-limit", resetsAt: undefined }]);
  });

  it("reports the end of a turn, ok or not", () => {
    expect(toRunEvents(msg({ type: "result", subtype: "success", is_error: false }), NOW)).toEqual([{ t: NOW, kind: "end", ok: true }]);
    expect(toRunEvents(msg({ type: "result", subtype: "error_during_execution", is_error: true }), NOW)).toEqual([{ t: NOW, kind: "end", ok: false }]);
  });

  it("ignores every other message", () => {
    expect(toRunEvents(msg({ type: "system", subtype: "init", session_id: "s1" }), NOW)).toEqual([]);
    expect(toRunEvents(msg({ type: "user", message: { content: "x" } }), NOW)).toEqual([]);
  });
});
