import type { Stage } from "../../src/model.js";

type Tone = "ok" | "run" | "ask" | "bad" | "accent" | "idle";

export const STAGE: Record<Stage, { label: string; tone: Tone }> = {
  "needs-design": { label: "needs design", tone: "idle" },
  "needs-tasks": { label: "needs tasks", tone: "idle" },
  "tasks-in-review": { label: "tasks in review", tone: "accent" },
  "waits-on-deps": { label: "waits on deps", tone: "idle" },
  ready: { label: "ready", tone: "accent" },
  running: { label: "running", tone: "run" },
  "needs-you": { label: "needs you", tone: "ask" },
  paused: { label: "paused", tone: "ask" },
  stopped: { label: "stopped", tone: "bad" },
  "pr-open": { label: "PR open", tone: "accent" },
  done: { label: "done", tone: "ok" },
};

export function StageBadge({ stage }: { stage: Stage }) {
  const { label, tone } = STAGE[stage];
  return <span class={`badge ${tone === "idle" ? "" : tone}`}>{label}</span>;
}
