import { useEffect, useState } from "preact/hooks";
import type { ProjectModel, Stage } from "../../src/model.js";
import { selectProject, useProjectState, type ProjectRef } from "./api.js";
import { IconSymbols } from "./icons.js";
import { IssuesPanel } from "./IssueViews.js";
import { GraphView } from "./views/GraphView.js";
import { ListView } from "./views/ListView.js";

type View = "graph" | "list";

function useView(): View {
  const read = (): View => (location.hash === "#/list" ? "list" : "graph");
  const [view, setView] = useState(read);
  useEffect(() => {
    const onHash = () => setView(read());
    addEventListener("hashchange", onHash);
    return () => removeEventListener("hashchange", onHash);
  }, []);
  return view;
}

export function App() {
  const state = useProjectState();
  const view = useView();
  const current = state?.current ?? null;
  const model = state?.model ?? null;
  return (
    <div class="app">
      <IconSymbols />
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
        {model && <HeaderCounts model={model} />}
      </header>
      <nav class="side">{model && <Sidebar model={model} view={view} />}</nav>
      <main>{state && <Body projects={state.projects} current={current} model={model} view={view} />}</main>
    </div>
  );
}

function HeaderCounts({ model }: { model: ProjectModel }) {
  const count = (stage: Stage) => model.features.filter((f) => f.stage === stage).length;
  return (
    <>
      <span class="chip run" data-count="running">
        {count("running")} running
      </span>
      <span class="chip ask" data-count="needs-you">
        {count("needs-you")} need you
      </span>
    </>
  );
}

function summary(model: ProjectModel, view: View): string {
  const parts = [`${model.milestones.length} milestones`, `${model.features.length} features`];
  if (view === "list") {
    const tasks = model.features.flatMap((f) => f.parents.flatMap((p) => p.tasks));
    parts.push(`${tasks.length} tasks`, `${tasks.filter((t) => t.done).length} done`);
  } else {
    parts.push(`${model.features.filter((f) => f.stage === "done").length} done`);
  }
  return parts.join(" · ");
}

function Sidebar({ model, view }: { model: ProjectModel; view: View }) {
  const done = (ids: string[]) => ids.filter((id) => model.features.find((f) => f.id === id)?.stage === "done").length;
  return (
    <>
      <h4>Project</h4>
      {(["requirements", "design", "milestones"] as const).map((file) => (
        <div class={`item${model.files[file] ? "" : " muted"}`} key={file}>
          <span class={`dot${model.files[file] ? " ok" : ""}`} />
          {file}.md
          {!model.files[file] && <span class="count">missing</span>}
        </div>
      ))}
      <h4>Views</h4>
      <a class={view === "graph" ? "on" : ""} href="#/graph">
        Graph
      </a>
      <a class={view === "list" ? "on" : ""} href="#/list">
        List
      </a>
      {model.milestones.length > 0 && <h4>Milestones</h4>}
      {model.milestones.map((m) => (
        <a key={m.id} href="#/list">
          {m.id} {m.name}
          <span class="count">
            {done(m.features)}/{m.features.length}
          </span>
        </a>
      ))}
    </>
  );
}

function Body({ projects, current, model, view }: { projects: ProjectRef[]; current: ProjectRef | null; model: ProjectModel | null; view: View }) {
  if (current) {
    return (
      <>
        <div class="row" style={{ marginBottom: "10px" }}>
          <h2>{current.name}</h2>
          {model && (
            <span class="muted" data-summary>
              {summary(model, view)}
            </span>
          )}
          <span class="spacer" />
          <div class="seg">
            <a class={view === "graph" ? "on" : ""} href="#/graph">
              Graph
            </a>
            <a class={view === "list" ? "on" : ""} href="#/list">
              List
            </a>
          </div>
        </div>
        {model && (view === "graph" ? <GraphView model={model} /> : <ListView model={model} />)}
        {model && <IssuesPanel issues={model.issues} />}
      </>
    );
  }
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
