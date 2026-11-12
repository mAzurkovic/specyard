import type { ProjectModel } from "../../../src/model.js";
import { Markdown } from "../markdown.js";
import { featureHref } from "../route.js";
import { StageBadge } from "../stage.js";
import { RunButton } from "./RunView.js";

export function MilestonePage({ model, id }: { model: ProjectModel; id: string }) {
  const milestone = model.milestones.find((m) => m.id === id);
  if (!milestone) {
    return (
      <div class="panel">
        <h3>No milestone {id}</h3>
        <p class="muted">milestones.md does not list it.</p>
      </div>
    );
  }
  const features = model.features.filter((f) => f.milestone === milestone.id);
  return (
    <>
      <div class="crumb">
        {model.name} › {milestone.id}
      </div>
      <div class="row">
        <h2>{`${milestone.id} ${milestone.name}`}</h2>
        <span class="spacer" />
        <RunButton kind="to-design" target={milestone.id} />
        <RunButton kind="to-tasks" target={milestone.id} />
        <RunButton kind="expert-review" target={milestone.id} />
      </div>
      <div class="sub-h">Needs: {milestone.needs.join(", ") || "none"}</div>
      <div class="panel md">
        <h4>Delivers</h4>
        {milestone.delivers ? (
          <p class="delivers">
            <Markdown inline text={milestone.delivers} />
          </p>
        ) : (
          <p class="muted">Not stated.</p>
        )}
        <h4>Exit criteria</h4>
        {milestone.exitCriteria.length > 0 ? (
          <ul class="exit">
            {milestone.exitCriteria.map((c) => (
              <li key={c}>
                <Markdown inline text={c} />
              </li>
            ))}
          </ul>
        ) : (
          <p class="muted">None listed.</p>
        )}
      </div>
      <div class="panel">
        <h3>Features</h3>
        <table>
          <thead>
            <tr>
              <th>Feature</th>
              <th>Stage</th>
              <th>Needs</th>
            </tr>
          </thead>
          <tbody>
            {features.map((f) => (
              <tr key={f.id}>
                <td>
                  <a href={featureHref(f.id)}>{`${f.feature} ${f.name}`}</a>
                  <div class="muted">
                    <Markdown inline text={f.summary} />
                  </div>
                </td>
                <td>
                  <StageBadge stage={f.stage} />
                </td>
                <td class="mono">{f.needs.join(", ") || "none"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}
