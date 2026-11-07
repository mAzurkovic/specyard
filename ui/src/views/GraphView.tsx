import { useState } from "preact/hooks";
import type { Feature, ProjectModel } from "../../../src/model.js";
import { layoutGraph } from "../graph/layout.js";
import { Inline } from "../Inline.js";
import { issuesByFeature } from "../issues.js";
import { ErrorBadge } from "../IssueViews.js";
import { STAGE, StageBadge } from "../stage.js";

const NODE_TONE: Partial<Record<string, string>> = { ok: "ok", run: "run", ask: "ask", bad: "ask" };

const taskCount = (f: Feature) => {
  const tasks = f.parents.flatMap((p) => p.tasks);
  return tasks.length === 0 ? "" : `${tasks.filter((t) => t.done).length}/${tasks.length} tasks`;
};

export function GraphView({ model }: { model: ProjectModel }) {
  const [selected, setSelected] = useState<string | undefined>(undefined);
  const layout = layoutGraph(model);
  const byId = new Map(model.features.map((f) => [f.id, f]));
  const critical = new Set(model.criticalPath);
  const picked = selected === undefined ? undefined : byId.get(selected);
  const issues = issuesByFeature(model.features, model.issues);

  return (
    <>
      <div class="graph">
        <div class="canvas" style={{ width: `${layout.width}px`, height: `${layout.height}px` }}>
          {layout.lanes.map((lane) => (
            <div class="lane" key={lane.id} style={{ left: `${lane.x}px`, width: `${lane.width}px` }}>
              <span class="lh">
                {lane.id} {lane.name}
              </span>
            </div>
          ))}
          <svg width={layout.width} height={layout.height}>
            <defs>
              <marker id="ar" viewBox="0 0 8 8" refX="7" refY="4" markerWidth="7" markerHeight="7" orient="auto">
                <path class="arrow" d="M0 0L8 4L0 8z" />
              </marker>
              <marker id="arc" viewBox="0 0 8 8" refX="7" refY="4" markerWidth="7" markerHeight="7" orient="auto">
                <path class="arrow crit" d="M0 0L8 4L0 8z" />
              </marker>
            </defs>
            {layout.edges.map((e) => (
              <path
                key={`${e.from}>${e.to}`}
                class={e.critical ? "edges crit" : "edges"}
                d={e.path}
                marker-end={e.critical ? "url(#arc)" : "url(#ar)"}
                data-edge={`${e.from}>${e.to}`}
              />
            ))}
          </svg>
          {layout.nodes.map((n) => {
            const f = byId.get(n.id)!;
            const tone = NODE_TONE[STAGE[f.stage].tone] ?? "";
            return (
              <div
                key={n.id}
                role="button"
                tabIndex={0}
                data-feature={n.id}
                class={`node ${tone}${critical.has(n.id) ? " crit" : ""}${selected === n.id ? " sel" : ""}`}
                style={{ left: `${n.x}px`, top: `${n.y}px` }}
                onClick={() => setSelected(n.id)}
                onDblClick={() => (location.hash = `#/f/${encodeURIComponent(n.id)}`)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") location.hash = `#/f/${encodeURIComponent(n.id)}`;
                  if (e.key === " ") {
                    e.preventDefault();
                    setSelected(n.id);
                  }
                }}
              >
                <b>
                  {f.feature} <Inline text={f.name} />
                </b>
                <div class="meta">
                  <StageBadge stage={f.stage} />
                  <ErrorBadge issues={issues.get(f.id)} />
                  {taskCount(f)}
                </div>
              </div>
            );
          })}
        </div>
      </div>
      <div class="legend">
        {(["done", "running", "needs-you", "tasks-in-review", "needs-tasks"] as const).map((s) => (
          <span key={s}>
            <StageBadge stage={s} />
          </span>
        ))}
        {model.criticalPath.length > 0 && (
          <span style={{ color: "var(--crit)" }}>━ critical path: {model.criticalPath.join(" → ")}</span>
        )}
      </div>
      <div class="row" style={{ marginTop: "12px", alignItems: "stretch" }}>
        <div class="panel" style={{ flex: 1, margin: 0 }}>
          <h3>Can start now</h3>
          {model.canStartNow.length === 0 && <div class="muted">Nothing can start now.</div>}
          {model.canStartNow.map((c) => (
            <div class="row" key={c.id} data-start={c.id} style={{ marginBottom: "6px" }}>
              <StageBadge stage={byId.get(c.id)!.stage} />
              {c.id} <Inline text={byId.get(c.id)!.name} />
              <span class="spacer" />
              <code>{c.action}</code>
            </div>
          ))}
        </div>
        <div class="panel" style={{ flex: 1, margin: 0 }}>
          {picked ? (
            <>
              <h3>
                Selected: {picked.id} <Inline text={picked.name} />
              </h3>
              <div class="muted" style={{ marginBottom: "8px" }}>
                <Inline text={picked.summary} />
              </div>
              <div class="row">
                <StageBadge stage={picked.stage} />
                {model.canStartNow.find((c) => c.id === picked.id)?.action ?? ""}
              </div>
              <div class="muted" style={{ marginTop: "8px" }}>
                Unblocks: {model.edges.filter((e) => e.from === picked.id).map((e) => e.to).join(", ") || "nothing"}
              </div>
            </>
          ) : (
            <div class="muted">Click a feature to see its details. Double-click to open it.</div>
          )}
        </div>
      </div>
    </>
  );
}
