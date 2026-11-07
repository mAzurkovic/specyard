import { useEffect, useState } from "preact/hooks";

export type ProjectRef = { name: string; path: string };
export type ProjectState = { projects: ProjectRef[]; current: ProjectRef | null };

const token = new URLSearchParams(location.search).get("t") ?? "";

export function selectProject(name: string): Promise<Response> {
  return fetch("/api/project", {
    method: "POST",
    headers: { "Content-Type": "application/json", "X-Specyard-Token": token },
    body: JSON.stringify({ name }),
  });
}

/** Live project state from the server's event stream; null until the first event. */
export function useProjectState(): ProjectState | null {
  const [state, setState] = useState<ProjectState | null>(null);
  useEffect(() => {
    const events = new EventSource(`/api/events?t=${encodeURIComponent(token)}`);
    events.addEventListener("project", (e) => setState(JSON.parse((e as MessageEvent<string>).data) as ProjectState));
    return () => events.close();
  }, []);
  return state;
}
