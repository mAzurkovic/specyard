import { useState } from "preact/hooks";
import type { Feature, ProjectModel } from "../../../src/model.js";
import { ago, latest } from "../format.js";
import { Icon, ICON_LEGEND } from "../icons.js";
import { Inline } from "../Inline.js";
import { issuesByFeature } from "../issues.js";
import { ErrorBadge, StaleBadge } from "../IssueViews.js";
import { StageBadge } from "../stage.js";
import { fixTaskIcon, taskIcon } from "../taskState.js";

function counts(features: Feature[]): string {
  const tasks = features.flatMap((f) => f.parents.flatMap((p) => p.tasks));
  return tasks.length === 0 ? "–" : `${tasks.filter((t) => t.done).length}/${tasks.length}`;
}

export function ListView({ model }: { model: ProjectModel }) {
  const [open, setOpen] = useState<Set<string>>(() => new Set(model.milestones.map((m) => m.id)));
  const toggle = (id: string) =>
    setOpen((prev) => {
      const next = new Set(prev);
      if (!next.delete(id)) next.add(id);
      return next;
    });
  const byId = new Map(model.features.map((f) => [f.id, f]));
  const issues = issuesByFeature(model.issues);

  return (
    <div class="panel" style={{ padding: 0 }}>
      <table>
        <thead>
          <tr>
            <th style={{ width: "44%" }}>Item</th>
            <th>Stage</th>
            <th>Needs</th>
            <th>Tasks</th>
            <th>Last activity</th>
          </tr>
        </thead>
        <tbody>
          {model.milestones.map((m) => {
            const features = m.features.map((id) => byId.get(id)!);
            const done = features.filter((f) => f.stage === "done").length;

            return [
              <tr class="group" key={m.id} data-milestone={m.id} onClick={() => toggle(m.id)}>
                <td>
                  {open.has(m.id) ? "▾" : "▸"} {m.id} {m.name}
                </td>
                <td>
                  <span class="badge accent">
                    {done} of {features.length} done
                  </span>
                </td>
                <td class="muted">{m.needs.join(", ")}</td>
                <td>{counts(features)}</td>
                <td class="muted">{ago(latest(features.map((f) => f.updatedAt)))}</td>
              </tr>,
              ...(open.has(m.id) ? features.flatMap((f) => featureRows(f, open.has(f.id), () => toggle(f.id), <ErrorBadge issues={issues.get(f.id)} />)) : []),
            ];
          })}
        </tbody>
      </table>
      <div class="legend" style={{ padding: "10px 14px", margin: 0, borderTop: "1px solid var(--line)" }}>
        {ICON_LEGEND.map(([name, label]) => (
          <span key={name}>
            <Icon name={name} />
            {label}
          </span>
        ))}
      </div>
    </div>
  );
}

function featureRows(f: Feature, expanded: boolean, toggle: () => void, errors: preact.JSX.Element) {
  const tasks = f.parents.flatMap((p) => p.tasks.map((t) => ({ t, p })));
  const rows = [
    <tr key={f.id} data-feature-row={f.id} onClick={toggle} style={{ cursor: tasks.length ? "pointer" : "default" }}>
      <td style={{ paddingLeft: "26px" }}>
        {tasks.length ? (expanded ? "▾" : "▸") : "·"} {f.feature} <Inline text={f.name} />
      </td>
      <td>
        <StageBadge stage={f.stage} /> <StaleBadge stale={f.stale} /> {errors}
      </td>
      <td class="muted">{f.needs.join(", ") || "none"}</td>
      <td>{counts([f])}</td>
      <td class="muted">{ago(f.updatedAt)}</td>
    </tr>,
  ];
  if (!expanded) return rows;
  for (const { t, p } of tasks) {
    rows.push(
      <tr key={`${f.id}/${t.id}`} data-task={`${f.id}/${t.id}`}>
        <td style={{ paddingLeft: "48px" }}>
          <Icon name={taskIcon(t, p, f)} />
          {t.id} <Inline text={t.text} />
          {p.mode === "parallel" && <span class="badge"> parallel</span>}
        </td>
        <td class="muted">{t.attempts > 0 ? `${t.attempts} attempt${t.attempts === 1 ? "" : "s"}` : ""}</td>
        <td />
        <td />
        <td />
      </tr>,
    );
  }
  for (const fix of f.fixTasks) {
    rows.push(
      <tr key={`${f.id}/${fix.id}`} data-task={`${f.id}/${fix.id}`}>
        <td style={{ paddingLeft: "48px" }}>
          <Icon name={fixTaskIcon(fix)} />
          Fix {fix.id}: <Inline text={fix.lastFailure} />
        </td>
        <td class="muted">fix task</td>
        <td />
        <td />
        <td />
      </tr>,
    );
  }
  return rows;
}
