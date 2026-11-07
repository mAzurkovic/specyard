import { selectProject, useProjectState, type ProjectRef } from "./api.js";

export function App() {
  const state = useProjectState();
  const current = state?.current ?? null;
  return (
    <div class="app">
      <header class="top">
        <span class="logo">
          <b>◆</b> specyard
        </span>
        {current && (
          <span class="proj">
            {current.name} · {current.path}
          </span>
        )}
        <span class="spacer" />
      </header>
      <nav class="side" />
      <main>{state && <Body projects={state.projects} current={current} />}</main>
    </div>
  );
}

function Body({ projects, current }: { projects: ProjectRef[]; current: ProjectRef | null }) {
  if (current) return <h2>{current.name}</h2>;
  if (projects.length === 0) {
    return (
      <div class="panel">
        <h3>No project in specs/</h3>
        <p class="muted">
          Run <code>/to-brd</code> to write the requirements and start one.
        </p>
      </div>
    );
  }
  return (
    <div class="panel">
      <h3>Pick a project</h3>
      {projects.map((p) => (
        <div class="row" key={p.name}>
          <button class="btn" onClick={() => void selectProject(p.name)}>
            {p.name}
          </button>
          <span class="muted mono">{p.path}</span>
        </div>
      ))}
    </div>
  );
}
