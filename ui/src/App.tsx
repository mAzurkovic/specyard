import { useEffect } from "preact/hooks";
import type { InboxItem } from "../../src/inbox.js";
import type { ProjectModel } from "../../src/model.js";
import { selectProject, useProjectState, type ProjectRef } from "./api.js";
import { IconSymbols } from "./icons.js";
import { Inline } from "./Inline.js";
import { IssuesPanel } from "./IssueViews.js";
import { featureHref, milestoneHref, useRoute, type Route } from "./route.js";
import { FeaturePage } from "./views/FeaturePage.js";
import { GraphView } from "./views/GraphView.js";
import { InboxPage } from "./views/InboxPage.js";
import { ListView } from "./views/ListView.js";
import { MilestonePage } from "./views/MilestonePage.js";
import { AddContextFile, ProjectPage } from "./views/ProjectPage.js";
import { RunView } from "./views/RunView.js";

type View = "graph" | "list";

export function App() {
  const state = useProjectState();
  const route = useRoute();
  const current = state?.current ?? null;
  const model = state?.model ?? null;
  const inbox = state?.inbox ?? [];
  useEffect(() => {
    document.title = inbox.length > 0 ? `(${inbox.length}) specyard` : "specyard";
  }, [inbox.length]);
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
        {model && <HeaderCounts model={model} inbox={inbox} />}
      </header>
      {model ? <Sidebar model={model} route={route} inbox={inbox} /> : <nav class="side" />}
      <main>{state && <Body projects={state.projects} current={current} model={model} route={route} inbox={inbox} />}</main>
    </div>
  );
}

function HeaderCounts({ model, inbox }: { model: ProjectModel; inbox: InboxItem[] }) {
  return (
    <>
      <span class="chip run" data-count="running">
        {model.runningRuns} running
      </span>
      <a class="chip ask" data-count="needs-you" href="#/inbox">
        {inbox.length} need you
      </a>
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

function Body({ projects, current, model, route, inbox }: { projects: ProjectRef[]; current: ProjectRef | null; model: ProjectModel | null; route: Route; inbox: InboxItem[] }) {
  if (current) {
    if (!model) {
      return (
        <>
          <h2>{current.name}</h2>
          <p class="muted">The project files cannot be read.</p>
        </>
      );
    }
    return <Page model={model} path={current.path} route={route} inbox={inbox} />;
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

function Page({ model, path, route, inbox }: { model: ProjectModel; path: string; route: Route; inbox: InboxItem[] }) {
  switch (route.page) {
    case "inbox":
      return <InboxPage model={model} items={inbox} selected={route.id} />;
    case "feature":
      return <FeaturePage model={model} id={route.id} tab={route.tab} />;
    case "milestone":
      return <MilestonePage model={model} id={route.id} />;
    case "project":
      return <ProjectPage model={model} path={path} />;
    case "run":
      return <RunView runId={route.id} />;
    case "graph":
    case "list":
      return <Overview model={model} view={route.page} />;
    case "home":
      // Until the required files and the milestones exist, the next planning step is the useful start.
      return model.files.requirements && model.files.design && model.files.milestones ? <Overview model={model} view="graph" /> : <ProjectPage model={model} path={path} />;
  }
}

function Overview({ model, view }: { model: ProjectModel; view: View }) {
  return (
    <>
      <div class="row" style={{ marginBottom: "10px" }}>
        <h2>{model.name}</h2>
        <span class="muted" data-summary>
          {summary(model, view)}
        </span>
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
      {view === "graph" ? <GraphView model={model} /> : <ListView model={model} />}
      <IssuesPanel issues={model.issues} />
    </>
  );
}

function Sidebar({ model, route, inbox }: { model: ProjectModel; route: Route; inbox: InboxItem[] }) {
  const context = model.contextFiles.filter((f) => f.path.startsWith("context/"));
  const mocks = model.contextFiles.length - context.length;
  const projectFiles = [
    ["requirements.md", model.files.requirements],
    ["design.md", model.files.design],
    ["milestones.md", model.files.milestones],
  ] as const;
  const onView = (view: View) => route.page === view || (view === "graph" && route.page === "home" && model.files.milestones);
  return (
    <nav class="side">
      <h4>Project</h4>
      {projectFiles.map(([name, found]) => (
        <a key={name} href="#/project" class={found ? undefined : "muted"}>
          <span class={found ? "dot ok" : "dot"} />
          {name}
          {!found && <span class="count">missing</span>}
        </a>
      ))}
      <h4>Context</h4>
      {context.map((f) => (
        <div class="item" key={f.path}>
          <span class="dot ok" />
          {f.path}
        </div>
      ))}
      {mocks > 0 && (
        <div class="item">
          <span class="dot ok" />
          mocks/<span class="count">{mocks}</span>
        </div>
      )}
      <AddContextFile class="add muted" />
      <h4>Views</h4>
      <a class={onView("graph") ? "on" : ""} href="#/graph">
        Graph
      </a>
      <a class={onView("list") ? "on" : ""} href="#/list">
        List
      </a>
      <a class={route.page === "inbox" ? "on" : ""} href="#/inbox">
        Inbox<span class="count">{inbox.length}</span>
      </a>
      {model.milestones.map((m) => {
        const features = model.features.filter((f) => f.milestone === m.id);
        return (
          <div key={m.id}>
            <h4>
              <a href={milestoneHref(m.id)}>{`${m.id} ${m.name}`}</a>
              <span class="count">
                {features.filter((f) => f.stage === "done").length}/{features.length}
              </span>
            </h4>
            {features.map((f) => (
              <a key={f.id} href={featureHref(f.id)} class={route.page === "feature" && route.id === f.id ? "sub on" : "sub"}>
                <span class={f.stage === "done" ? "dot ok" : "dot"} />
                {f.feature} <Inline text={f.name} />
              </a>
            ))}
          </div>
        );
      })}
    </nav>
  );
}
