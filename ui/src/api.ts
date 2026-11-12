import { useEffect, useState } from "preact/hooks";
import type { ProjectModel } from "../../src/model.js";
import type { RunEvent } from "../../src/runs/events.js";
import type { RunInfo, RunKind } from "../../src/runs/RunManager.js";

export type ProjectRef = { name: string; path: string };
export type ProjectState = { projects: ProjectRef[]; current: ProjectRef | null; model: ProjectModel | null };

const token = new URLSearchParams(location.search).get("t") ?? "";
const auth = { "X-Specyard-Token": token };

export function selectProject(name: string): Promise<Response> {
  return fetch("/api/project", {
    method: "POST",
    headers: { "Content-Type": "application/json", ...auth },
    body: JSON.stringify({ name }),
  });
}

/** Text of a file, by its path in the project folder. */
export async function fetchFile(path: string): Promise<string> {
  const res = await fetch(`/api/file?path=${encodeURIComponent(path)}`, { headers: auth });
  if (!res.ok) throw new Error(`${path} (${res.status})`);
  return res.text();
}

/** Copies a file into the project's context/ folder; the response status says why when it does not. */
export function addContextFile(file: File): Promise<Response> {
  const body = new FormData();
  body.append("file", file);
  return fetch("/api/context", { method: "POST", headers: auth, body });
}

export type RunChange = { path: string; before: string | null; after: string | null };
export type RunDetails = { run: RunInfo; events: RunEvent[]; changes: RunChange[] };
export type RunUpdate = { runId: string; run: RunInfo; event: RunEvent };

/** Starts a skill run; resolves to its id. */
export async function startRun(kind: RunKind, target?: string, comment?: string): Promise<string> {
  const res = await fetch("/api/runs", { method: "POST", headers: { ...auth, "Content-Type": "application/json" }, body: JSON.stringify({ kind, target, comment }) });
  if (!res.ok) throw new Error(`Cannot start /${kind} (${res.status})`);
  return ((await res.json()) as { runId: string }).runId;
}

export async function listRuns(target: string): Promise<RunInfo[]> {
  return (await fetch(`/api/runs?target=${encodeURIComponent(target)}`, { headers: auth })).json() as Promise<RunInfo[]>;
}

export async function getRun(id: string): Promise<RunDetails | null> {
  const res = await fetch(`/api/runs/${encodeURIComponent(id)}`, { headers: auth });
  return res.ok ? ((await res.json()) as RunDetails) : null;
}

/** One stream for the page; project and run events both come through it. */
let stream: EventSource | undefined;
const serverEvents = () => (stream ??= new EventSource(`/api/events?t=${encodeURIComponent(token)}`));

/** Live project state from the server's event stream; null until the first event. */
export function useProjectState(): ProjectState | null {
  const [state, setState] = useState<ProjectState | null>(null);
  useEffect(() => {
    const onProject = (e: Event) => setState(JSON.parse((e as MessageEvent<string>).data) as ProjectState);
    serverEvents().addEventListener("project", onProject);
    return () => serverEvents().removeEventListener("project", onProject);
  }, []);
  return state;
}

/** Calls `onUpdate` for every run event while the component is shown. */
export function useRunUpdates(onUpdate: (update: RunUpdate) => void): void {
  useEffect(() => {
    const onRun = (e: Event) => onUpdate(JSON.parse((e as MessageEvent<string>).data) as RunUpdate);
    serverEvents().addEventListener("run", onRun);
    return () => serverEvents().removeEventListener("run", onRun);
  }, [onUpdate]);
}
