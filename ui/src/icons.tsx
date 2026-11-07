export type TaskIcon = "done" | "running" | "failed" | "ask" | "todo" | "wait" | "fix";

/** One copy of each icon, referenced by <use>. Render once per page. */
export function IconSymbols() {
  return (
    <svg width="0" height="0" style="position:absolute" aria-hidden="true">
      <defs>
        <symbol id="i-done" viewBox="0 0 16 16">
          <circle cx="8" cy="8" r="7" style="fill:var(--ok)" />
          <path d="M4.8 8.3l2.1 2.1 4.3-4.6" style="fill:none;stroke:#fff;stroke-width:1.8;stroke-linecap:round;stroke-linejoin:round" />
        </symbol>
        <symbol id="i-todo" viewBox="0 0 16 16">
          <circle cx="8" cy="8" r="6.2" style="fill:none;stroke:var(--idle);stroke-width:1.6" />
        </symbol>
        <symbol id="i-wait" viewBox="0 0 16 16">
          <circle cx="8" cy="8" r="6.2" style="fill:none;stroke:var(--idle);stroke-width:1.6;stroke-dasharray:2.4 2.2" />
        </symbol>
        <symbol id="i-running" viewBox="0 0 16 16">
          <circle cx="8" cy="8" r="6.2" style="fill:none;stroke:var(--run-soft);stroke-width:2.2" />
          <path d="M8 1.8a6.2 6.2 0 0 1 6.2 6.2" style="fill:none;stroke:var(--run);stroke-width:2.2;stroke-linecap:round" />
        </symbol>
        <symbol id="i-failed" viewBox="0 0 16 16">
          <circle cx="8" cy="8" r="7" style="fill:var(--bad)" />
          <path d="M5.6 5.6l4.8 4.8M10.4 5.6l-4.8 4.8" style="stroke:#fff;stroke-width:1.8;stroke-linecap:round" />
        </symbol>
        <symbol id="i-ask" viewBox="0 0 16 16">
          <circle cx="8" cy="8" r="7" style="fill:var(--ask)" />
          <path d="M8 4.4v4.3" style="stroke:#fff;stroke-width:1.8;stroke-linecap:round" />
          <circle cx="8" cy="11.4" r="1.1" style="fill:#fff" />
        </symbol>
        <symbol id="i-fix" viewBox="0 0 16 16">
          <circle cx="8" cy="8" r="7" style="fill:var(--ok)" />
          <path d="M10.6 4.2a2.4 2.4 0 0 0-3 3L4.4 10.4l1.2 1.2 3.2-3.2a2.4 2.4 0 0 0 3-3l-1.3 1.3-1.1-.3-.3-1.1z" style="fill:#fff" />
        </symbol>
      </defs>
    </svg>
  );
}

export function Icon({ name }: { name: TaskIcon }) {
  return (
    <svg class={`ti${name === "running" ? " spin" : ""}`} data-icon={name} aria-label={name} role="img">
      <use href={`#i-${name}`} />
    </svg>
  );
}

export const ICON_LEGEND: [TaskIcon, string][] = [
  ["done", "done"],
  ["running", "running"],
  ["failed", "failed 3 attempts"],
  ["ask", "needs you"],
  ["todo", "to do"],
  ["wait", "waits on a task"],
  ["fix", "fix task, done"],
];
