import type { Issue } from "../../src/model.js";
import { issueLocation, sortIssues } from "./issues.js";

/** Error count for one feature; nothing when it has no errors. */
export function ErrorBadge({ issues }: { issues: Issue[] | undefined }) {
  const errors = issues?.filter((i) => i.kind === "error").length ?? 0;
  if (errors === 0) return null;
  return (
    <span class="badge bad" data-error>
      {errors} error{errors === 1 ? "" : "s"}
    </span>
  );
}

export function IssuesPanel({ issues }: { issues: Issue[] }) {
  if (issues.length === 0) return null;
  return (
    <div class="panel" data-issues style={{ marginTop: "12px" }}>
      <h3>Issues</h3>
      <table>
        <tbody>
          {sortIssues(issues).map((i) => (
            <tr key={`${i.file}:${i.line}:${i.message}`}>
              <td>
                <span class={`badge ${i.kind === "error" ? "bad" : "stale"}`}>{i.kind}</span>
              </td>
              <td>
                <code>{issueLocation(i)}</code>
              </td>
              <td>{i.message}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function StaleBadge({ stale }: { stale: boolean }) {
  if (!stale) return null;
  return (
    <span class="badge stale" data-stale title="Made from a spec that changed since">
      stale
    </span>
  );
}
