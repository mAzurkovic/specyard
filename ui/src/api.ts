import { useEffect, useState } from "preact/hooks";
import type { ProjectModel } from "../../src/model.js";
import type { StaleDetails } from "../../src/staleApi.js";

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

/** Live project state from the server's event stream; null until the first event. */
/** Null when the file is not stale (any other failure too: the page then says so). */
export async function staleDetails(file: string): Promise<StaleDetails | null> {
  const res = await fetch(`/api/stale?file=${encodeURIComponent(file)}`, { headers: auth });
  return res.ok ? ((await res.json()) as StaleDetails) : null;
}

export function markNotAffected(file: string): Promise<Response> {
  return fetch("/api/stale/not-affected", { method: "POST", headers: { ...auth, "Content-Type": "application/json" }, body: JSON.stringify({ file }) });
}

export function useProjectState(): ProjectState | null {
  const [state, setState] = useState<ProjectState | null>(null);
  useEffect(() => {
    const events = new EventSource(`/api/events?t=${encodeURIComponent(token)}`);
    events.addEventListener("project", (e) => setState(JSON.parse((e as MessageEvent<string>).data) as ProjectState));
    return () => events.close();
  }, []);
  return state;
}
