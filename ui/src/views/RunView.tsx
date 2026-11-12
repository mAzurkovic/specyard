import { useCallback, useEffect, useState } from "preact/hooks";
import type { RunEvent } from "../../../src/runs/events.js";
import type { RunKind } from "../../../src/runs/RunManager.js";
import { getRun, startRun, useRunUpdates, type RunDetails, type RunUpdate } from "../api.js";
import { diffRows } from "../diffRows.js";
import { featureHref } from "../route.js";

const STATE_TONE = { running: "run", "needs-you": "ask", done: "ok", failed: "bad" } as const;

/** Starts a skill run and opens it: on the feature's Run tab, or the run page for project-level skills. */
export function RunButton({ kind, target, label }: { kind: RunKind; target?: string; label?: string }) {
  const [error, setError] = useState<string | null>(null);
  const start = () =>
    startRun(kind, target).then(
      (id) => (location.hash = target?.includes("·") ? featureHref(target, "run") : `#/run/${id}`),
      (e: Error) => setError(e.message),
    );
  return (
    <>
      <button class="btn sm primary" onClick={() => void start()}>
        {label ?? `Run /${kind}`}
      </button>
      {error && <span class="error">{error}</span>}
    </>
  );
}

/** One run: live events, the skill's last message, what it changed, and a re-run with a comment. */
export function RunView({ runId }: { runId: string }) {
  const [details, setDetails] = useState<RunDetails | null | undefined>(undefined);
  useEffect(() => {
    let live = true;
    void getRun(runId).then((d) => live && setDetails(d));
    return () => {
      live = false;
    };
  }, [runId]);
  const onUpdate = useCallback(
    ({ runId: id, run, event }: RunUpdate) => {
      if (id !== runId) return;
      // The end of a turn can change files; read the run again to show its changes.
      if (event.kind === "end") void getRun(runId).then(setDetails);
      else setDetails((d) => d && { ...d, run, events: [...d.events, event] });
    },
    [runId],
  );
  useRunUpdates(onUpdate);

  if (details === undefined) return <p class="muted">Loading…</p>;
  if (details === null) return <p class="muted">No run {runId}.</p>;
  const { run, events, changes } = details;
  const lastText = [...events].reverse().find((e): e is Extract<RunEvent, { kind: "text" }> => e.kind === "text");
  return (
    <div data-run={run.id}>
      <div class="row">
        <h3>
          /{run.kind} {run.target?.replace("·", " ") ?? ""}
        </h3>
        <span class={`badge ${STATE_TONE[run.state]}`} data-run-state={run.state}>
          {run.state}
        </span>
      </div>
      <div class="term" data-run-events>
        {events.map((e, i) => (
          <div key={i}>{describe(e)}</div>
        ))}
      </div>
      {lastText && run.state === "needs-you" && (
        <div class="panel" data-run-message>
          <pre class="mono" style={{ whiteSpace: "pre-wrap", margin: 0 }}>
            {lastText.text}
          </pre>
        </div>
      )}
      {changes.map((c) => (
        <div class="panel" key={c.path} data-change={c.path}>
          <h3>
            <code>{c.path}</code> {c.before === null ? "added" : c.after === null ? "removed" : "changed"}
          </h3>
          <div class="diff">
            {diffRows(c.before ?? "", c.after ?? "").map((row, i) => (
              <div key={i} class={row.kind === "header" ? "h" : row.kind === "add" ? "a" : row.kind === "del" ? "r" : undefined} data-diff={row.kind}>
                {row.kind === "header" ? row.text : `${row.kind === "add" ? "+" : row.kind === "del" ? "-" : " "} ${row.text}`}
              </div>
            ))}
          </div>
        </div>
      ))}
      {(run.state === "done" || run.state === "failed") && <Rerun kind={run.kind} target={run.target} />}
    </div>
  );
}

function Rerun({ kind, target }: { kind: RunKind; target: string | undefined }) {
  const [comment, setComment] = useState("");
  const [error, setError] = useState<string | null>(null);
  const rerun = () =>
    startRun(kind, target, comment.trim() || undefined).then(
      (id) => (location.hash = target?.includes("·") ? featureHref(target, "run") : `#/run/${id}`),
      (e: Error) => setError(e.message),
    );
  return (
    <div class="panel">
      <h3>Re-run with comment</h3>
      <textarea aria-label="Comment for the re-run" value={comment} onInput={(e) => setComment((e.currentTarget as HTMLTextAreaElement).value)} style={{ width: "100%", minHeight: "60px" }} />
      <div class="row" style={{ marginTop: "8px" }}>
        <button class="btn sm" onClick={() => void rerun()}>
          Re-run /{kind}
        </button>
        {error && <span class="error">{error}</span>}
      </div>
    </div>
  );
}

function describe(e: RunEvent): string {
  switch (e.kind) {
    case "progress":
      return `[${e.tag}] ${e.text}`;
    case "text":
      return e.text.split("\n")[0]!;
    case "subagent-start":
      return `↳ ${e.agent}: ${e.description}`;
    case "subagent-stop":
      return `↲ ${e.status}: ${e.summary}`;
    case "rate-limit":
      return e.resetsAt === undefined ? "Usage limit reached" : `Usage limit reached, resets ${new Date(e.resetsAt).toLocaleTimeString()}`;
    case "end":
      return e.ok ? "— turn ended" : "— turn ended with an error";
  }
}
