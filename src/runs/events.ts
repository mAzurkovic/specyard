import type { SDKMessage } from "@anthropic-ai/claude-agent-sdk";

export type RunEvent = { t: number } & (
  | { kind: "progress"; tag: string; text: string }
  | { kind: "text"; text: string }
  | { kind: "subagent-start"; id: string; agent: string; description: string }
  | { kind: "subagent-stop"; id: string; status: string; summary: string }
  | { kind: "rate-limit"; resetsAt: number | undefined }
  | { kind: "end"; ok: boolean }
);

/** The progress lines the workflow skills print, such as `[build 2.1] attempt 1: PASS`. */
const PROGRESS = /^\[(read|build [\w.]+|feature r\d+|ship|stop)\] (.*)$/;
/** Epoch seconds are about 1.7e9 and milliseconds about 1.7e12; the SDK does not say which it sends. */
const toMs = (time: number) => (time < 1e12 ? time * 1000 : time);

/** What a run shows for one SDK message. Text from inside subagents is left to the subagent events. */
export function toRunEvents(message: SDKMessage, t = Date.now()): RunEvent[] {
  switch (message.type) {
    case "assistant": {
      if (message.parent_tool_use_id !== null) return [];
      const events: RunEvent[] = [];
      const plain: string[] = [];
      for (const block of message.message.content) {
        if (block.type !== "text") continue;
        for (const line of block.text.split("\n")) {
          const progress = PROGRESS.exec(line);
          if (progress) events.push({ t, kind: "progress", tag: progress[1]!, text: progress[2]! });
          else plain.push(line);
        }
      }
      const text = plain.join("\n").trim();
      return text ? [...events, { t, kind: "text", text }] : events;
    }
    case "system":
      if (message.subtype === "task_started") {
        return [{ t, kind: "subagent-start", id: message.task_id, agent: message.subagent_type ?? "agent", description: message.description }];
      }
      if (message.subtype === "task_notification") {
        return [{ t, kind: "subagent-stop", id: message.task_id, status: message.status, summary: message.summary }];
      }
      return [];
    case "rate_limit_event": {
      const { status, resetsAt } = message.rate_limit_info;
      return status === "rejected" ? [{ t, kind: "rate-limit", resetsAt: resetsAt === undefined ? undefined : toMs(resetsAt) }] : [];
    }
    case "result":
      return [{ t, kind: "end", ok: !message.is_error }];
    default:
      return [];
  }
}
